/**
 * Conditional Differs With High/Low Filter — primary digit signal + High/Low confirmation.
 */

import {
    FILTER_MODE_STANDALONE,
    analyzeHighLowWindow,
    evaluateHighLowFilter,
    formatHighLowDashboard,
    getDigitGroup,
    getGroupLabel,
    normalizeHighLowFilterOptions,
    resolveDominantGroup,
    selectStandaloneDominantDigit,
} from './high-low-group-filter';
import {
    PRIMARY_FREQUENCY_SPIKE,
    PRIMARY_INCREASING_GAP,
    PRIMARY_LONG_ABSENCE_RETURN,
    PRIMARY_MOST_FREQUENT,
    PRIMARY_RECENT_DOUBLE,
    PRIMARY_REPEATED_GAP,
    PRIMARY_SIGNAL_SCORE,
    probePrimarySignals,
} from './conditional-even-odd-differs';

export const DEFAULT_MAX_SIGNAL_AGE = 2;
export const DEFAULT_REQUIRED_CONFIRMATIONS = 1;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0;
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 8;

const PRIMARY_SOURCE_LABELS = {
    [PRIMARY_SIGNAL_SCORE]: 'Signal Score',
    [PRIMARY_INCREASING_GAP]: 'Increasing Gap',
    [PRIMARY_LONG_ABSENCE_RETURN]: 'Long-Absence Return',
    [PRIMARY_REPEATED_GAP]: 'Repeated Gap',
    [PRIMARY_MOST_FREQUENT]: 'Most Frequent',
    [PRIMARY_RECENT_DOUBLE]: 'Recent Double',
    [PRIMARY_FREQUENCY_SPIKE]: 'Frequency Spike',
};

export const createTrackerState = () => ({
    recentDigits: [],
    processedCount: 0,
    tickIndex: -1,
    tradesThisSession: 0,
    cooldownUntilTick: -1,
    lastProcessedEpoch: null,
    cooldownLogEmitted: false,
    maxTradesLogEmitted: false,
    activeTradePhase: 'none',
    activeTradeDigit: null,
    activeTradeLogEmitted: false,
    signaledAtTick: -1,
    pendingSignal: null,
    previousDominantGroup: null,
    suppressJournal: false,
    pendingJournal: [],
    lastJournal: [],
    lastDashboard: '',
    lastRejectLogTick: -1,
    lastConfirmLogTick: -1,
});

export const resetTrackerState = state => {
    Object.assign(state, createTrackerState());
};

export const armConditionalHighLowActiveTrade = (state, digit) => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'signaled';
    state.activeTradeDigit = digit;
    state.activeTradeLogEmitted = false;
    state.signaledAtTick = state.tickIndex;
};

export const openConditionalHighLowActiveTrade = state => {
    if (!state || state.activeTradePhase !== 'signaled') {
        return;
    }
    state.activeTradePhase = 'open';
};

export const releaseConditionalHighLowActiveTrade = state => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'none';
    state.activeTradeDigit = null;
    state.activeTradeLogEmitted = false;
    state.signaledAtTick = -1;
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
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

const pushJournal = (state, options, className, message) => {
    if (!options?.journal_enabled || state.suppressJournal) {
        return;
    }
    if (!state.pendingJournal) {
        state.pendingJournal = [];
    }
    state.pendingJournal.push({ className, message });
};

export const normalizeConditionalHighLowOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    ...normalizeHighLowFilterOptions({
        filter_enabled: options.filter_enabled ?? options.boolean_high_low_filter,
        analysis_window: options.analysis_window ?? options.high_low_window,
        filter_mode: options.filter_mode,
        threshold_type: options.threshold_type,
        dominant_group_count: options.dominant_group_count,
        dominance_percent: options.dominance_percent,
        tie_action: options.tie_action,
        require_most_frequent: options.require_most_frequent ?? options.boolean_require_most_frequent,
        min_target_appearances: options.min_target_appearances,
        min_target_group_share: options.min_target_group_share,
        allow_tied_most_frequent:
            options.allow_tied_most_frequent ?? options.boolean_allow_tied_most_frequent,
    }),
    required_confirmations: Math.max(
        1,
        toInt(
            options.required_confirmations ?? options.required_consecutive_confirmations,
            DEFAULT_REQUIRED_CONFIRMATIONS,
            1
        )
    ),
    max_signal_age: toInt(options.max_signal_age, DEFAULT_MAX_SIGNAL_AGE, 0),
    primary_signal_source: String(options.primary_signal_source || PRIMARY_SIGNAL_SCORE).toLowerCase(),
    primary_options: options.primary_options || options,
    one_active_trade_only: toBool(options.one_active_trade_only, true),
    cooldown_after_trade: toInt(options.cooldown_after_trade, DEFAULT_COOLDOWN, 0),
    max_trades_per_session: toInt(options.max_trades_per_session, DEFAULT_MAX_TRADES, 0),
    journal_enabled: toBool(options.journal_enabled, true),
    dashboard_enabled: toBool(options.dashboard_enabled, true),
});

const toDigitTicks = input => {
    if (!Array.isArray(input) || input.length === 0) {
        return [];
    }
    if (typeof input[0] === 'object' && input[0] !== null && 'epoch' in input[0]) {
        return input.map(tick => ({
            epoch: Number(tick.epoch),
            digit: tick.digit,
        }));
    }
    return input.map((digit, index) => ({
        epoch: index + 1,
        digit,
    }));
};

const syncRecentDigits = (state, digit_ticks, options) => {
    if (!Array.isArray(digit_ticks) || digit_ticks.length === 0) {
        return;
    }

    let start = 0;
    if (state.lastProcessedEpoch != null) {
        start = digit_ticks.findIndex(tick => Number(tick.epoch) > state.lastProcessedEpoch);
        if (start < 0) {
            return;
        }
    }

    state.pendingJournal = [];
    state.lastJournal = [];
    const ticks_to_process = digit_ticks.length - start;
    state.suppressJournal = ticks_to_process > 1;

    for (let i = start; i < digit_ticks.length; i++) {
        const tick = digit_ticks[i];
        state.tickIndex += 1;
        state.recentDigits.push(Number(tick.digit));
        state.lastProcessedEpoch = Number(tick.epoch);
    }

    const keep = Math.max(options.analysis_window, 20) + 5;
    if (state.recentDigits.length > keep) {
        state.recentDigits = state.recentDigits.slice(-keep);
    }

    state.suppressJournal = false;
    state.processedCount = digit_ticks.length;
};

const clearPendingSignal = state => {
    state.pendingSignal = null;
};

const sortCandidates = candidates =>
    candidates.sort(
        (a, b) =>
            b.strength - a.strength ||
            b.appearances - a.appearances ||
            b.groupShare - a.groupShare ||
            a.detectedTick - b.detectedTick ||
            a.digit - b.digit
    );

const formatSuccessJournal = (candidate, filter_result, options) => {
    const stats = filter_result.stats;
    const dominant = filter_result.dominant_label;
    const required_side = dominant === 'High' ? 'High count' : 'Low count';

    return [
        'Primary Digit Differs signal detected.',
        '',
        'Target digit:',
        String(candidate.digit),
        '',
        'Target group:',
        filter_result.group_label,
        '',
        `Recent ${options.analysis_window} ticks:`,
        `High = ${stats.high_count}`,
        `Low = ${stats.low_count}`,
        '',
        'High percentage:',
        `${Math.round(stats.high_percent)}%`,
        '',
        `Required ${required_side}:`,
        filter_result.required_label,
        '',
        `${dominant} dominance confirmed.`,
        '',
        `${dominant} digit frequencies:`,
        filter_result.frequency_text,
        '',
        `Digit ${candidate.digit} is the most frequent ${dominant} digit.`,
        '',
        'High/Low filter passed.',
        '',
        `Placing DIFFER ${candidate.digit}.`,
    ].join('\n');
};

const formatRejectJournal = (candidate, filter_result, options) => {
    const stats = filter_result.stats;
    const reason = filter_result.fail_reason;

    if (reason === 'no_dominant_group' || reason === 'no_dominant_group_tie') {
        return [
            'High/Low filter evaluation:',
            '',
            `High = ${stats.high_count}`,
            `Low = ${stats.low_count}`,
            '',
            'No dominant group detected.',
            '',
            'Signal rejected.',
        ].join('\n');
    }

    if (reason === 'group_mismatch' || reason === 'group_mismatch_opposite') {
        return [
            'Primary target:',
            `Digit ${candidate.digit}`,
            '',
            'Target group:',
            filter_result.group_label,
            '',
            'Recent window:',
            `High = ${stats.high_count}`,
            `Low = ${stats.low_count}`,
            '',
            `${filter_result.dominant_label || 'One'} group dominates.`,
            '',
            'Matching-group filter failed.',
            '',
            `Digit ${candidate.digit} signal rejected.`,
        ].join('\n');
    }

    if (reason === 'weak_appearances') {
        return [
            `${filter_result.dominant_label || 'Group'} dominance confirmed.`,
            '',
            'Target digit:',
            String(candidate.digit),
            '',
            `Digit ${candidate.digit} appearances:`,
            String(filter_result.appearances),
            '',
            'Minimum required appearances:',
            String(options.min_target_appearances),
            '',
            'Target frequency condition failed.',
            '',
            'No trade placed.',
        ].join('\n');
    }

    if (reason === 'weak_group_share') {
        return [
            `${filter_result.dominant_label || 'Group'} dominance confirmed.`,
            '',
            'Target digit:',
            String(candidate.digit),
            '',
            `Digit ${candidate.digit} group share:`,
            `${Math.round(filter_result.group_share * 10) / 10}%`,
            '',
            'Minimum required group share:',
            `${options.min_target_group_share}%`,
            '',
            'Target frequency condition failed.',
            '',
            'No trade placed.',
        ].join('\n');
    }

    if (reason === 'not_most_frequent' || reason === 'not_group_leader') {
        return [
            `${filter_result.dominant_label || 'Group'} dominance confirmed.`,
            '',
            'Target digit:',
            String(candidate.digit),
            '',
            `Most frequent ${filter_result.dominant_label} digit:`,
            String(filter_result.most_frequent),
            '',
            'Target is not the group leader.',
            '',
            'Signal rejected.',
        ].join('\n');
    }

    return [
        'Primary Digit Differs signal detected.',
        '',
        `Target digit: ${candidate.digit}`,
        `Target group: ${filter_result.group_label}`,
        '',
        `Recent ${options.analysis_window} ticks:`,
        `High = ${stats.high_count}`,
        `Low = ${stats.low_count}`,
        '',
        'High/Low filter failed.',
        '',
        'Signal rejected.',
    ].join('\n');
};

export const evaluateConditionalHighLowDiffers = (
    digits,
    raw_options = {},
    state = createTrackerState(),
    primary_states = {}
) => {
    const options = normalizeConditionalHighLowOptions(raw_options);
    const journal_messages = [];

    if (!options.enabled) {
        return {
            prediction: -1,
            enabled: false,
            journal_messages,
            dashboard: null,
            eligible: [],
        };
    }

    const digit_ticks = toDigitTicks(digits);
    syncRecentDigits(state, digit_ticks, options);

    if (state.activeTradePhase === 'signaled' && state.tickIndex > state.signaledAtTick) {
        releaseConditionalHighLowActiveTrade(state);
    }

    const hl_stats = analyzeHighLowWindow(state.recentDigits, options.analysis_window);
    const filter_context = {
        previous_dominant_group: state.previousDominantGroup,
    };

    // Track previous completed-window dominance for tie handling.
    const probe_dominance = resolveDominantGroup(hl_stats, options, filter_context);
    if (probe_dominance.group && !probe_dominance.tied) {
        state.previousDominantGroup = probe_dominance.group;
    }

    let candidates = [];

    if (options.filter_mode === FILTER_MODE_STANDALONE) {
        const standalone = selectStandaloneDominantDigit(hl_stats, options, filter_context);
        if (standalone.digit >= 0) {
            candidates.push({
                digit: standalone.digit,
                strength: standalone.filter_result?.appearances ?? 0,
                source: 'standalone',
                detectedTick: state.tickIndex,
                appearances: standalone.filter_result?.appearances ?? 0,
                groupShare: standalone.filter_result?.group_share ?? 0,
                filterPassed: true,
                filterResult: standalone.filter_result,
            });
        }
    } else {
        const primary = probePrimarySignals(
            state,
            digit_ticks,
            {
                ...options,
                primary_signal_source: options.primary_signal_source,
                primary_options: options.primary_options,
            },
            primary_states
        );

        for (let i = 0; i < primary.length; i++) {
            const filter_result = evaluateHighLowFilter(
                primary[i].digit,
                hl_stats,
                options,
                filter_context
            );
            candidates.push({
                digit: primary[i].digit,
                strength: primary[i].strength,
                source: primary[i].source,
                detectedTick: primary[i].detectedTick ?? state.tickIndex,
                appearances: filter_result.appearances,
                groupShare: filter_result.group_share,
                filterPassed: !options.filter_enabled || filter_result.passed,
                filterResult: filter_result,
            });
        }
    }

    candidates = candidates.filter(candidate => candidate.filterPassed);
    candidates = sortCandidates(candidates);

    if (state.pendingSignal) {
        const age = state.tickIndex - state.pendingSignal.detectedTick;
        if (options.max_signal_age > 0 && age > options.max_signal_age) {
            if (options.journal_enabled) {
                pushJournal(
                    state,
                    options,
                    'journal__text--error',
                    `Digit ${state.pendingSignal.digit} signal expired after ${options.max_signal_age} ticks.\n\nNo valid High/Low confirmation was completed.`
                );
            }
            clearPendingSignal(state);
        }
    }

    let pending = state.pendingSignal;
    if (pending && pending.confirmationCount === 0) {
        const still_primary = candidates.some(
            candidate => candidate.digit === pending.digit && candidate.source === pending.source
        );
        if (!still_primary) {
            clearPendingSignal(state);
            pending = null;
        }
    }

    if (!pending && candidates.length) {
        const best = candidates[0];
        const filter_result =
            best.filterResult || evaluateHighLowFilter(best.digit, hl_stats, options, filter_context);
        state.pendingSignal = {
            digit: best.digit,
            source: best.source,
            strength: best.strength,
            detectedTick: state.tickIndex,
            confirmationCount: 0,
            lastFilterPassed: !options.filter_enabled || filter_result.passed,
        };
        pending = state.pendingSignal;

        if (options.journal_enabled) {
            if (filter_result.passed) {
                pushJournal(
                    state,
                    options,
                    'journal__text',
                    formatSuccessJournal(best, filter_result, options).replace(
                        `\n\nPlacing DIFFER ${best.digit}.`,
                        options.required_confirmations > 1 ? '' : `\n\nPlacing DIFFER ${best.digit}.`
                    )
                );
            } else {
                pushJournal(state, options, 'journal__text', formatRejectJournal(best, filter_result, options));
            }
        }
    }

    let prediction = -1;

    if (pending) {
        const filter_result = evaluateHighLowFilter(pending.digit, hl_stats, options, filter_context);
        const filter_passed = !options.filter_enabled || filter_result.passed;

        if (filter_passed) {
            if (pending.confirmationCount === 0) {
                pending.confirmationCount = 1;
            } else if (state.tickIndex > pending.lastConfirmTick) {
                pending.confirmationCount += 1;
            }
            pending.lastConfirmTick = state.tickIndex;
            pending.lastFilterPassed = true;

            if (
                options.journal_enabled &&
                pending.confirmationCount < options.required_confirmations &&
                state.lastConfirmLogTick !== state.tickIndex
            ) {
                state.lastConfirmLogTick = state.tickIndex;
                pushJournal(
                    state,
                    options,
                    'journal__text',
                    `Digit ${pending.digit} High/Low confirmation:\n${pending.confirmationCount} of ${options.required_confirmations} completed.`
                );
            }

            if (pending.confirmationCount >= options.required_confirmations) {
                prediction = pending.digit;

                if (options.journal_enabled) {
                    pushJournal(
                        state,
                        options,
                        'journal__text--success',
                        `${
                            options.required_confirmations > 1
                                ? `Digit ${pending.digit} High/Low confirmation:\n${pending.confirmationCount} of ${options.required_confirmations} completed.\n\nSignal confirmed.\n\n`
                                : ''
                        }High/Low filter passed.\n\nPlacing DIFFER ${prediction}.`
                    );
                }
            }
        } else {
            if (options.journal_enabled && state.lastRejectLogTick !== state.tickIndex) {
                state.lastRejectLogTick = state.tickIndex;
                pushJournal(
                    state,
                    options,
                    'journal__text',
                    formatRejectJournal(pending, filter_result, options)
                );
            }
            pending.confirmationCount = 0;
            pending.lastFilterPassed = false;
        }
    }

    if (Array.isArray(state.pendingJournal) && state.pendingJournal.length) {
        const pending_journal = state.pendingJournal;
        const keep = Math.max(0, pending_journal.length - MAX_JOURNAL_MESSAGES_PER_EVALUATE);
        for (let i = keep; i < pending_journal.length; i++) {
            journal_messages.push(pending_journal[i]);
        }
        state.pendingJournal = [];
    }

    const finish = (final_prediction, eligible = [], dashboard = null) => {
        if (journal_messages.length > MAX_JOURNAL_MESSAGES_PER_EVALUATE) {
            journal_messages.splice(0, journal_messages.length - MAX_JOURNAL_MESSAGES_PER_EVALUATE);
        }
        state.lastJournal = journal_messages.slice();
        return {
            prediction: final_prediction,
            enabled: true,
            journal_messages,
            dashboard,
            eligible,
        };
    };

    let dashboard = null;
    if (options.dashboard_enabled) {
        const target_digit = pending?.digit ?? candidates[0]?.digit ?? -1;
        const filter_result =
            target_digit >= 0
                ? evaluateHighLowFilter(target_digit, hl_stats, options, filter_context)
                : null;
        const next_dashboard = formatHighLowDashboard({
            options,
            stats: hl_stats,
            target_digit,
            target_group: filter_result?.group_label ?? '',
            filter_result,
            primary_source:
                options.filter_mode === FILTER_MODE_STANDALONE
                    ? 'Standalone Dominant Digit'
                    : PRIMARY_SOURCE_LABELS[options.primary_signal_source] ||
                      options.primary_signal_source,
            signal_age: pending ? state.tickIndex - pending.detectedTick : 0,
            confirmation_count: pending?.confirmationCount ?? 0,
            required_confirmations: options.required_confirmations,
            trade_status:
                prediction >= 0
                    ? 'Placing'
                    : pending
                      ? 'Confirming'
                      : candidates.length
                        ? 'Waiting'
                        : 'Idle',
        });
        if (next_dashboard !== state.lastDashboard) {
            dashboard = next_dashboard;
            state.lastDashboard = next_dashboard;
        }
    }

    if (!options.one_active_trade_only && state.activeTradePhase !== 'none') {
        releaseConditionalHighLowActiveTrade(state);
    }

    const max_trades = options.max_trades_per_session;
    if (max_trades > 0 && state.tradesThisSession >= max_trades) {
        if (options.journal_enabled && !state.maxTradesLogEmitted) {
            state.maxTradesLogEmitted = true;
            journal_messages.push({
                className: 'journal__text--error',
                message: `Blocked: max trades (${max_trades})`,
            });
        }
        return finish(-1, [], dashboard);
    }

    if (state.tickIndex < state.cooldownUntilTick) {
        if (options.journal_enabled && !state.cooldownLogEmitted) {
            state.cooldownLogEmitted = true;
            journal_messages.push({
                className: 'journal__text--error',
                message: `Blocked: cooldown (${state.cooldownUntilTick - state.tickIndex} left)`,
            });
        }
        return finish(-1, [], dashboard);
    }
    state.cooldownLogEmitted = false;

    if (options.one_active_trade_only && state.activeTradePhase === 'open') {
        if (options.journal_enabled && !state.activeTradeLogEmitted) {
            state.activeTradeLogEmitted = true;
            journal_messages.push({
                className: 'journal__text--error',
                message:
                    state.activeTradeDigit != null
                        ? `Blocked: waiting for DIFFER ${state.activeTradeDigit}`
                        : 'Blocked: waiting for open DIFFER',
            });
        }
        return finish(-1, [], dashboard);
    }

    if (prediction >= 0) {
        state.tradesThisSession += 1;
        if (options.cooldown_after_trade > 0) {
            state.cooldownUntilTick = state.tickIndex + options.cooldown_after_trade;
        }
        if (options.one_active_trade_only) {
            armConditionalHighLowActiveTrade(state, prediction);
        }
        clearPendingSignal(state);

        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `DIFFER ${prediction} trade placed.`,
            });
        }
    }

    const eligible = candidates.map(candidate => candidate.digit);
    return finish(prediction, eligible, dashboard);
};

// Re-export helpers useful for tests / UI labels.
export { getDigitGroup, getGroupLabel, PRIMARY_SIGNAL_SCORE };
