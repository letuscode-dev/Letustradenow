/**
 * Rank Drop Differs
 *
 * Uses one Analysis Window size (min 50, default 1000), ranked at two moments:
 *
 *   INITIAL = the window as it was Lookback Ticks ago (default 100)
 *   LATER   = the window ending at the current tick
 *
 *   rank digits 0–9 from highest to lowest frequency in each (#1 = most frequent;
 *   tied counts share a rank, e.g. 1, 2, 2, 4)
 *   → drop = later rank − initial rank (positive = deteriorated)
 *   → the single biggest drop ≥ Minimum Rank Drop (default 3) → DIFFER that digit
 *
 * Several digits sharing the biggest drop means no trade — nothing is ever
 * selected randomly. Optional new-tick confirmation: the same digit must still be
 * the unique biggest qualifying mover on the next tick.
 *
 * WIN/LOSS statistics come from the settled purchased contract.
 */

import {
    createLiveStats,
    describeLiveStats,
    describeSettlement,
    recordSettledDiffersContract,
} from './differs-contract-settlement';
import { MAX_ANALYSIS_WINDOW } from './top-two-digit-gap-differ';

export const STATUS = {
    DISABLED: 'DISABLED',
    COLLECTING: 'COLLECTING',
    NO_RANK_DROP: 'NO_RANK_DROP',
    DROP_TOO_SMALL: 'DROP_TOO_SMALL',
    MOVER_TIED: 'MOVER_TIED',
    AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
    SETUP_CANCELLED: 'SETUP_CANCELLED',
    SIGNAL_CONSUMED: 'SIGNAL_CONSUMED',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const MIN_ANALYSIS_WINDOW = 50;
export const MIN_LOOKBACK_TICKS = 1;
export const MAX_RANK_DROP = 9;

/**
 * With fair digits (1000-tick window, 100-tick lookback) the biggest drop is ≥ 3
 * places in ~48% of windows and ≥ 4 in ~21%; 3 matches a #1 → #4 move.
 */
export const DEFAULT_OPTIONS = {
    analysis_window: 1000,
    lookback_ticks: 100,
    min_rank_drop: 3,
    enabled: true,
    confirmation: true,
    journal_enabled: true,
};

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const isProvided = value => value !== undefined && value !== null && value !== '';

const toBool = (value, default_value) => {
    if (!isProvided(value)) return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const clampSetting = ({ label, value, fallback, min, max, adjustments }) => {
    if (!isProvided(value)) return fallback;
    const requested = Number(value);
    if (!Number.isFinite(requested)) {
        adjustments.push({ setting: label, requested: value, actual: fallback, reason: 'not a number, default used' });
        return fallback;
    }
    let actual = Math.floor(requested);
    let reason = actual !== requested ? 'whole numbers only' : '';
    if (actual < min) {
        actual = min;
        reason = `minimum allowed value is ${min}`;
    } else if (actual > max) {
        actual = max;
        reason = `maximum allowed value is ${max}`;
    }
    if (actual !== requested) adjustments.push({ setting: label, requested, actual, reason });
    return actual;
};

export const normalizeRankDropOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    const adjustments = [];
    const analysis_window = clampSetting({
        label: 'Analysis Window',
        value: options.analysis_window,
        fallback: d.analysis_window,
        min: MIN_ANALYSIS_WINDOW,
        max: MAX_ANALYSIS_WINDOW - MIN_LOOKBACK_TICKS,
        adjustments,
    });
    return {
        analysis_window,
        // Window + lookback is loaded in one history request, capped at MAX_ANALYSIS_WINDOW ticks.
        lookback_ticks: clampSetting({
            label: 'Lookback Ticks',
            value: options.lookback_ticks,
            fallback: Math.min(d.lookback_ticks, MAX_ANALYSIS_WINDOW - analysis_window),
            min: MIN_LOOKBACK_TICKS,
            max: Math.min(analysis_window, MAX_ANALYSIS_WINDOW - analysis_window),
            adjustments,
        }),
        min_rank_drop: clampSetting({
            label: 'Minimum Rank Drop',
            value: options.min_rank_drop,
            fallback: d.min_rank_drop,
            min: 1,
            max: MAX_RANK_DROP,
            adjustments,
        }),
        enabled: toBool(options.enabled, d.enabled),
        confirmation: toBool(options.confirmation, d.confirmation),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        adjustments,
    };
};

export const createRankDropState = () => ({
    last_tip_fp: null,
    armed: null,
    last_result: null,
    pending_outcome: null,
    last_settled_contract_id: null,
    just_settled: null,
    live: createLiveStats(),
});

export const resetRankDropState = (state = null) => {
    const next = createRankDropState();
    if (!state || typeof state !== 'object') return next;
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, next);
    return state;
};

export const recordRankDropContract = recordSettledDiffersContract;

const normalizeTicks = ticks =>
    (Array.isArray(ticks) ? ticks : []).flatMap(item => {
        const digit = toDigit(item && typeof item === 'object' ? item.digit ?? item.quote : item);
        if (digit === null) return [];
        const epoch = item && typeof item === 'object' ? Number(item.epoch) : NaN;
        return [{ digit, epoch: Number.isFinite(epoch) ? epoch : null }];
    });

const tipFingerprint = ticks => {
    const tip = ticks[ticks.length - 1];
    if (tip.epoch !== null) return `e:${tip.epoch}`;
    const tail = ticks
        .slice(-20)
        .map(t => t.digit)
        .join('');
    return `n:${ticks.length}:${tail}`;
};

const countDigits = digits => {
    const counts = Array.from({ length: 10 }, () => 0);
    digits.forEach(d => {
        counts[d] += 1;
    });
    return counts;
};

/** Competition ranking: #1 = highest count, tied counts share the same rank. */
export const rankDigits = counts => counts.map(c => 1 + counts.filter(other => other > c).length);

/** Rank comparison of the window Lookback Ticks ago vs the current window (no state). */
export const analyzeRankDrop = (digits_all, raw_options = {}) => {
    const options = normalizeRankDropOptions(raw_options);
    const { analysis_window: W, lookback_ticks: L } = options;
    if (digits_all.length < W + L) {
        return {
            options,
            status: STATUS.COLLECTING,
            rejection: `Need ${W + L} ticks (window + lookback), have ${digits_all.length}.`,
            target: null,
            mover: null,
            movers: [],
            biggest_drop: 0,
            condition_passed: false,
        };
    }
    const span = digits_all.slice(-(W + L));
    const initial_counts = countDigits(span.slice(0, W));
    const later_counts = countDigits(span.slice(L));
    const initial_ranks = rankDigits(initial_counts);
    const later_ranks = rankDigits(later_counts);
    const drops = later_ranks.map((r, d) => r - initial_ranks[d]);
    const biggest_drop = Math.max(...drops);
    const movers = drops.flatMap((drop, d) => (drop === biggest_drop ? [d] : []));

    const base = {
        options,
        initial_counts,
        later_counts,
        initial_ranks,
        later_ranks,
        drops,
        biggest_drop,
        movers,
        mover: movers.length === 1 ? movers[0] : null,
        target: null,
        condition_passed: false,
    };

    if (biggest_drop <= 0) {
        return { ...base, status: STATUS.NO_RANK_DROP, rejection: 'No digit lost rank.' };
    }
    if (biggest_drop < options.min_rank_drop) {
        return {
            ...base,
            status: STATUS.DROP_TOO_SMALL,
            rejection: `Biggest rank drop ${biggest_drop} < minimum ${options.min_rank_drop}.`,
        };
    }
    if (movers.length > 1) {
        return {
            ...base,
            status: STATUS.MOVER_TIED,
            rejection: `Digits ${movers.join(', ')} share the biggest rank drop (${biggest_drop}).`,
        };
    }
    return { ...base, target: movers[0], condition_passed: true, status: STATUS.VALID_SIGNAL, rejection: '' };
};

const describeRanking = (counts, ranks) =>
    [...counts.keys()]
        .sort((a, b) => ranks[a] - ranks[b] || a - b)
        .map(d => `#${ranks[d]} ${d}(${counts[d]})`)
        .join('  ');

const buildJournal = ({ options, analysis, status, rejection, target, settled, state, confirmation_status, loaded }) => {
    const messages = [{ className: 'journal__text', message: '══ RANK DROP DIFFERS ══' }];
    const push = (message, className = 'journal__text') => messages.push({ className, message });

    if (settled) push(describeSettlement(settled), settled.result === 'WIN' ? 'journal__text--success' : 'journal__text--error');
    options.adjustments.forEach(adj =>
        push(
            `SETTING ADJUSTED: ${adj.setting} requested ${adj.requested} → actual ${adj.actual} (${adj.reason})`,
            'journal__text--warn'
        )
    );

    const needed = options.analysis_window + options.lookback_ticks;
    push(
        `Window: ${options.analysis_window} ticks | Lookback: ${options.lookback_ticks} ticks | Minimum Rank Drop: ${options.min_rank_drop}${
            loaded < needed ? ` (loaded ${loaded}/${needed})` : ''
        }`
    );

    if (analysis) {
        push(`Initial: ${describeRanking(analysis.initial_counts, analysis.initial_ranks)}`);
        push(`Later:   ${describeRanking(analysis.later_counts, analysis.later_ranks)}`);
        if (analysis.biggest_drop > 0) {
            push(
                analysis.mover !== null
                    ? `Biggest Mover: Digit ${analysis.mover} | #${analysis.initial_ranks[analysis.mover]} → #${analysis.later_ranks[analysis.mover]} | Drop: ${analysis.biggest_drop}`
                    : `Biggest Mover: tied (${analysis.movers.join(', ')}) | Drop: ${analysis.biggest_drop}`
            );
        }
        push(`Condition: ${analysis.condition_passed ? 'PASSED' : 'FAILED'}`);
    }
    if (options.confirmation) push(`Confirmation: ${confirmation_status}`);

    if (status === STATUS.VALID_SIGNAL) push(`Target: DIFFER ${target}`, 'journal__text--success');
    else push(`WHY NO TRADE? ${status} — ${rejection}`);

    push(describeLiveStats(state.live));
    return messages;
};

export const evaluateRankDrop = (raw_ticks, raw_options = {}, state = createRankDropState()) => {
    const options = normalizeRankDropOptions(raw_options);
    const needed = options.analysis_window + options.lookback_ticks;
    const ticks = normalizeTicks(raw_ticks).slice(-needed);

    if (!ticks.length) {
        return {
            prediction: -1,
            matched: false,
            status: STATUS.COLLECTING,
            rejection: 'No ticks yet.',
            why_no_trade: 'No ticks yet.',
            options,
            journal_messages: [],
        };
    }

    const fp = tipFingerprint(ticks);
    if (fp === state.last_tip_fp && state.last_result) {
        // The first poll of a tick already handed out its signal; re-polls must not re-trade it.
        if (state.last_result.matched) {
            state.last_result = {
                ...state.last_result,
                prediction: -1,
                barrier: -1,
                matched: false,
                contract_type: null,
                status: STATUS.SIGNAL_CONSUMED,
                rejection: 'Signal on this tick already traded — waiting for the next tick.',
                why_no_trade: 'Signal on this tick already traded — waiting for the next tick.',
            };
        }
        return { ...state.last_result, journal_messages: [] };
    }

    const tip = ticks[ticks.length - 1];
    const settled = state.just_settled;
    state.just_settled = null;
    state.last_tip_fp = fp;

    let prediction = -1;
    let status;
    let rejection = '';
    let target = null;
    let analysis = null;
    let confirmation_status = options.confirmation ? 'WAITING FOR SETUP' : 'OFF';
    const armed = state.armed;
    state.armed = null;

    if (!options.enabled) {
        status = STATUS.DISABLED;
        rejection = 'Strategy disabled.';
    } else if (ticks.length < needed) {
        status = STATUS.COLLECTING;
        rejection = `Need ${needed} ticks (window + lookback), have ${ticks.length}.`;
    } else {
        analysis = analyzeRankDrop(
            ticks.map(t => t.digit),
            options
        );
        if (analysis.target === null) {
            status = armed ? STATUS.SETUP_CANCELLED : analysis.status;
            rejection = armed
                ? `Setup DIFFER ${armed.target} no longer valid on the new tick — ${analysis.rejection}`
                : analysis.rejection;
            if (armed) confirmation_status = 'CANCELLED';
        } else if (!options.confirmation || (armed && armed.target === analysis.target)) {
            target = analysis.target;
            prediction = target;
            status = STATUS.VALID_SIGNAL;
            if (options.confirmation) confirmation_status = 'CONFIRMED';
            state.pending_outcome = { target, type: 'RANK_DROP', epoch: tip.epoch };
        } else {
            state.armed = { target: analysis.target };
            status = armed ? STATUS.SETUP_CANCELLED : STATUS.AWAITING_CONFIRMATION;
            confirmation_status = armed ? 'CANCELLED — new setup waiting' : 'AWAITING NEXT TICK';
            rejection = armed
                ? `Biggest mover changed from ${armed.target} to ${analysis.target} — old setup cancelled, new setup waiting for next-tick confirmation.`
                : `Setup DIFFER ${analysis.target} found — confirming on the next tick.`;
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({
              options,
              analysis,
              status,
              rejection,
              target,
              settled,
              state,
              confirmation_status,
              loaded: ticks.length,
          })
        : [];

    const { trades, wins } = state.live;
    const result = {
        prediction,
        barrier: prediction,
        matched: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITDIFF' : null,
        target,
        mover: analysis?.mover ?? null,
        biggest_drop: analysis?.biggest_drop ?? null,
        initial_ranks: analysis?.initial_ranks ?? [],
        later_ranks: analysis?.later_ranks ?? [],
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        confirmation_status,
        settled,
        live: { ...state.live, win_rate: trades > 0 ? (wins / trades) * 100 : 0 },
        options,
        journal_messages,
    };
    state.last_result = result;
    return result;
};

/**
 * Backtest without look-ahead. There is no purchased contract in a replay, so each
 * signal is settled with a simulated 1-tick contract on the following tick.
 */
export const replayRankDrop = (raw_ticks, raw_options = {}) => {
    const options = normalizeRankDropOptions({ ...raw_options, journal_enabled: false });
    const state = createRankDropState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const pending = state.pending_outcome;
        if (pending) {
            recordRankDropContract(state, {
                contract_id: `replay-${i}`,
                status: digits[i] !== pending.target ? 'won' : 'lost',
                barrier: pending.target,
                exit_tick: digits[i],
            });
        }
        const result = evaluateRankDrop(digits.slice(0, i + 1), options, state);
        if (result.matched) signals.push({ tip: i, target: result.target });
    }

    const { trades, wins, losses } = state.live;
    return {
        total_ticks: digits.length,
        valid_signals: signals.length,
        trades,
        wins,
        losses,
        win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        signals,
        options,
    };
};
