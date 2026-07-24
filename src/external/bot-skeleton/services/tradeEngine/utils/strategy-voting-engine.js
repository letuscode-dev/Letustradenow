/**
 * Strategy Voting Engine — runs independent Digit Differs strategies each tick,
 * aggregates weighted votes, and returns a Differs barrier only when confidence
 * clears the user threshold (no ties).
 */

import {
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_MAX_ABSTAINING,
    DEFAULT_MIN_VOTING_STRATEGIES,
    DEFAULT_TICK_WINDOW,
    STRATEGY_VOTING_META,
} from './strategy-voting-meta';
import { STRATEGY_EVALUATORS } from './strategy-voting-strategies';

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toInt = (value, fallback, min = null) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (min !== null && n < min) {
        n = min;
    }
    return n;
};

export const createStrategyVotingState = () => ({
    coldDigitState: null,
    lastSummary: null,
});

export const resetStrategyVotingState = state => {
    if (!state) {
        return createStrategyVotingState();
    }
    state.coldDigitState = null;
    state.lastSummary = null;
    return state;
};

/**
 * Merge form/block options with strategy metadata defaults.
 * Supports flat keys: boolean_sv_<id>, weight_sv_<id>
 * and nested options.strategies[id] = { enabled, weight }.
 */
export const resolveStrategyConfigs = (options = {}) => {
    const nested = options.strategies && typeof options.strategies === 'object' ? options.strategies : {};
    return STRATEGY_VOTING_META.map(meta => {
        const flat_en = options[`boolean_sv_${meta.id}`];
        const flat_wt = options[`weight_sv_${meta.id}`];
        const over = nested[meta.id] || {};
        const enabled = toBool(
            over.enabled !== undefined ? over.enabled : flat_en !== undefined ? flat_en : meta.default_enabled,
            meta.default_enabled
        );
        const weight = Math.max(
            0,
            toNumber(
                over.weight !== undefined ? over.weight : flat_wt !== undefined ? flat_wt : meta.default_weight,
                meta.default_weight
            )
        );
        return { ...meta, enabled, weight };
    });
};

export const normalizeStrategyVotingOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    tick_window: Math.max(10, toInt(options.tick_window, DEFAULT_TICK_WINDOW, 10)),
    confidence_threshold: Math.max(1, Math.min(100, toInt(options.confidence_threshold, DEFAULT_CONFIDENCE_THRESHOLD, 1))),
    min_voting_strategies: Math.max(1, toInt(options.min_voting_strategies, DEFAULT_MIN_VOTING_STRATEGIES, 1)),
    max_abstaining_strategies: Math.max(0, toInt(options.max_abstaining_strategies, DEFAULT_MAX_ABSTAINING, 0)),
    journal_enabled: toBool(options.journal_enabled, true),
    vote_summary: toBool(options.vote_summary, true),
    confidence_display: toBool(options.confidence_display, true),
    tie_rejection: toBool(options.tie_rejection, true),
    debug_mode: toBool(options.debug_mode, false),
    strategies: resolveStrategyConfigs(options),
});

const formatSummary = ({
    ballots,
    votes,
    total_weight,
    winner,
    confidence,
    decision,
    reason,
    confidence_display,
}) => {
    const lines = ['=================================================', 'Strategy Voting Summary', ''];
    for (let i = 0; i < ballots.length; i++) {
        const b = ballots[i];
        const num = String(i + 1).padStart(2, '0');
        if (!b.enabled) {
            lines.push(`Strategy ${num} (${b.label}) → Disabled`);
        } else if (b.digit < 0) {
            lines.push(`Strategy ${num} (${b.label}) → No Vote`);
        } else {
            lines.push(`Strategy ${num} (${b.label}) → Digit ${b.digit} (Weight ${b.weight})`);
        }
    }
    lines.push('', '---', '', 'Vote Totals');
    for (let d = 0; d <= 9; d++) {
        lines.push(`Digit ${d} : ${votes[d].toFixed(1)}`);
    }
    lines.push('', '---', '');
    if (winner >= 0) {
        lines.push(`Winning Digit : ${winner}`);
        if (confidence_display) {
            lines.push(`Confidence : ${confidence}%`);
        }
        lines.push(`Total Vote Weight : ${total_weight.toFixed(1)}`);
    } else {
        lines.push('Winning Digit : —');
    }
    lines.push(`Decision : ${decision}`);
    if (reason) {
        lines.push(`Reason : ${reason}`);
    }
    lines.push('=================================================');
    return lines.join('\n');
};

/**
 * @returns {{
 *   prediction: number,
 *   allowed: boolean,
 *   enabled: boolean,
 *   winner: number,
 *   confidence: number,
 *   total_weight: number,
 *   votes: number[],
 *   voters: number,
 *   abstainers: number,
 *   decision: string,
 *   reason: string,
 *   journal_messages: Array<{className:string,message:string}>,
 * }}
 */
export const evaluateStrategyVoting = (digits, raw_options = {}, state = null) => {
    const options = normalizeStrategyVotingOptions(raw_options);
    const tracker = state || createStrategyVotingState();
    const journal_messages = [];

    const empty = (decision, reason) => {
        const result = {
            prediction: -1,
            allowed: false,
            enabled: options.enabled,
            winner: -1,
            confidence: 0,
            total_weight: 0,
            votes: new Array(10).fill(0),
            voters: 0,
            abstainers: 0,
            decision,
            reason,
            journal_messages,
        };
        if (options.journal_enabled && options.vote_summary) {
            journal_messages.push({
                className: 'journal__text',
                message: formatSummary({
                    ballots: [],
                    votes: result.votes,
                    total_weight: 0,
                    winner: -1,
                    confidence: 0,
                    decision,
                    reason,
                    confidence_display: options.confidence_display,
                }),
            });
        } else if (options.journal_enabled && reason) {
            journal_messages.push({ className: 'journal__text', message: reason });
        }
        tracker.lastSummary = result;
        return result;
    };

    if (!options.enabled) {
        return empty('NO TRADE', 'Strategy voting disabled.');
    }

    if (!Array.isArray(digits) || digits.length < 2) {
        return empty('NO TRADE', 'No valid signals (waiting for ticks).');
    }

    const ctx = { state: tracker };
    const ballots = [];
    const votes = new Array(10).fill(0);
    let voters = 0;
    let abstainers = 0;
    let disabled = 0;

    for (let i = 0; i < options.strategies.length; i++) {
        const cfg = options.strategies[i];
        const ballot = {
            id: cfg.id,
            label: cfg.label,
            enabled: cfg.enabled,
            weight: cfg.weight,
            digit: -1,
        };

        if (!cfg.enabled || cfg.weight <= 0) {
            disabled += 1;
            ballots.push(ballot);
            continue;
        }

        const evaluate = STRATEGY_EVALUATORS[cfg.id];
        let digit = -1;
        if (typeof evaluate === 'function') {
            try {
                digit = Number(evaluate(digits, ctx));
            } catch (err) {
                digit = -1;
                if (options.debug_mode && options.journal_enabled) {
                    journal_messages.push({
                        className: 'journal__text--error',
                        message: `Strategy ${cfg.label} error: ${err && err.message ? err.message : err}`,
                    });
                }
            }
        }

        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            ballot.digit = -1;
            abstainers += 1;
        } else {
            ballot.digit = digit;
            votes[digit] += cfg.weight;
            voters += 1;
        }
        ballots.push(ballot);
    }

    const total_weight = votes.reduce((sum, v) => sum + v, 0);

    let winner = -1;
    let best = 0;
    let tie = false;
    for (let d = 0; d <= 9; d++) {
        if (votes[d] > best) {
            best = votes[d];
            winner = d;
            tie = false;
        } else if (votes[d] === best && best > 0) {
            tie = true;
        }
    }
    if (tie) {
        winner = -1;
    }

    const confidence = total_weight > 0 && winner >= 0 ? Math.round((best / total_weight) * 100) : 0;

    let decision = 'NO TRADE';
    let reason = '';
    let allowed = false;

    if (voters === 0) {
        reason = 'No valid signals.';
    } else if (voters < options.min_voting_strategies) {
        reason = `Minimum votes not reached (${voters}/${options.min_voting_strategies}).`;
    } else if (abstainers > options.max_abstaining_strategies) {
        reason = `Too many abstaining strategies (${abstainers}/${options.max_abstaining_strategies}).`;
    } else if (tie || winner < 0) {
        reason = options.tie_rejection ? 'Tie detected.' : 'No unique winning digit.';
    } else if (confidence < options.confidence_threshold) {
        reason = `Confidence below threshold (${confidence}% < ${options.confidence_threshold}%).`;
    } else {
        decision = 'TRADE';
        reason = '';
        allowed = true;
    }

    const result = {
        prediction: allowed ? winner : -1,
        allowed,
        enabled: true,
        winner: winner >= 0 ? winner : -1,
        confidence,
        total_weight,
        votes: votes.slice(),
        voters,
        abstainers,
        decision,
        reason,
        journal_messages,
    };

    if (options.journal_enabled && (options.vote_summary || allowed || options.debug_mode)) {
        journal_messages.push({
            className: allowed ? 'journal__text--success' : 'journal__text',
            message: formatSummary({
                ballots,
                votes,
                total_weight,
                winner: winner >= 0 ? winner : -1,
                confidence,
                decision,
                reason,
                confidence_display: options.confidence_display,
            }),
        });
    }

    tracker.lastSummary = { ...result, ballots, disabled };
    return result;
};

export { STRATEGY_VOTING_META };
