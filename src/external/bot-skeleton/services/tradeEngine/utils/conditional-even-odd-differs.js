/**
 * Conditional Differs With Even/Odd Filter — primary digit signal + parity confirmation.
 */

import {
    analyzeParityWindow,
    evaluateParityFilter,
    formatParityDashboard,
    normalizeParityFilterOptions,
} from './even-odd-parity-filter';
import {
    buildScoreContext,
    createTrackerState as createSignalScoreTrackerState,
    scoreDigit,
    selectWinningDigit,
    syncTrackerWithDigitTicks as syncSignalScoreTicks,
} from './signal-score-differs';
import {
    createTrackerState as createIncreasingGapTrackerState,
    isDigitEligible as isIncreasingGapEligible,
    selectEligibleDigit as selectIncreasingGapDigit,
    syncTrackerWithDigitTicks as syncIncreasingGapTicks,
} from './increasing-digit-gap';
import {
    createTrackerState as createLongAbsenceTrackerState,
    isDigitEligible as isLongAbsenceEligible,
    selectEligibleDigit as selectLongAbsenceDigit,
    syncTrackerWithDigitTicks as syncLongAbsenceTicks,
} from './long-absence-return-differs';
import {
    createTrackerState as createAdaptiveGapTrackerState,
    isDigitEligible as isAdaptiveGapEligible,
    selectEligibleDigit as selectAdaptiveGapDigit,
    syncTrackerWithDigitTicks as syncAdaptiveGapTicks,
} from './adaptive-digit-gap';

export const DEFAULT_MAX_SIGNAL_AGE = 2;
export const DEFAULT_REQUIRED_CONFIRMATIONS = 1;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0;
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 8;

export const PRIMARY_SIGNAL_SCORE = 'signal_score';
export const PRIMARY_INCREASING_GAP = 'increasing_gap';
export const PRIMARY_LONG_ABSENCE_RETURN = 'long_absence_return';
export const PRIMARY_REPEATED_GAP = 'repeated_gap';
export const PRIMARY_MOST_FREQUENT = 'most_frequent';
export const PRIMARY_RECENT_DOUBLE = 'recent_double';
export const PRIMARY_FREQUENCY_SPIKE = 'frequency_spike';

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

export const armConditionalEvenOddActiveTrade = (state, digit) => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'signaled';
    state.activeTradeDigit = digit;
    state.activeTradeLogEmitted = false;
    state.signaledAtTick = state.tickIndex;
};

export const openConditionalEvenOddActiveTrade = state => {
    if (!state || state.activeTradePhase !== 'signaled') {
        return;
    }
    state.activeTradePhase = 'open';
};

export const releaseConditionalEvenOddActiveTrade = state => {
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

export const normalizeConditionalEvenOddOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    ...normalizeParityFilterOptions({
        filter_enabled: options.filter_enabled ?? options.boolean_even_odd_filter,
        parity_window: options.parity_window ?? options.analysis_window,
        filter_mode: options.filter_mode,
        threshold_type: options.threshold_type,
        matching_parity_count: options.matching_parity_count,
        matching_parity_percent: options.matching_parity_percent,
    }),
    required_confirmations: Math.max(
        1,
        toInt(options.required_confirmations ?? options.required_consecutive_confirmations, DEFAULT_REQUIRED_CONFIRMATIONS, 1)
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

    const keep = Math.max(options.parity_window, 20) + 5;
    if (state.recentDigits.length > keep) {
        state.recentDigits = state.recentDigits.slice(-keep);
    }

    state.suppressJournal = false;
    state.processedCount = digit_ticks.length;
};

const buildPrimaryOptions = (options, source) => {
    const base = options.primary_options || {};
    if (source === PRIMARY_SIGNAL_SCORE) {
        return {
            enabled: true,
            journal_enabled: false,
            dashboard_enabled: false,
            one_active_trade_only: false,
            min_signal_score: base.min_signal_score ?? 6,
            frequency_window: base.frequency_window ?? 30,
            recent_appearance_window: base.recent_appearance_window ?? 5,
            long_absence_threshold: base.long_absence_threshold ?? 30,
            spike_recent_window: base.spike_recent_window ?? 10,
            spike_historical_window: base.spike_historical_window ?? 50,
            min_gap: base.min_gap ?? 1,
            max_gap: base.max_gap ?? 20,
            most_frequent_enabled: base.most_frequent_enabled ?? true,
            repeated_gap_enabled: base.repeated_gap_enabled ?? true,
            recent_double_enabled: base.recent_double_enabled ?? true,
            frequency_spike_enabled: base.frequency_spike_enabled ?? true,
            long_absence_enabled: base.long_absence_enabled ?? true,
        };
    }
    if (source === PRIMARY_INCREASING_GAP) {
        return {
            enabled: true,
            journal_enabled: false,
            one_active_trade_only: false,
            min_gap: base.min_gap ?? 1,
            max_gap: base.max_gap ?? 20,
            min_common_diff: base.min_common_diff ?? 1,
            max_common_diff: base.max_common_diff ?? 5,
            gaps_required: base.gaps_required ?? 3,
            cancel_early_appearance: base.cancel_early_appearance ?? true,
        };
    }
    if (source === PRIMARY_LONG_ABSENCE_RETURN) {
        return {
            enabled: true,
            journal_enabled: false,
            dashboard_enabled: false,
            one_active_trade_only: false,
            min_absence_threshold: base.min_absence_threshold ?? 20,
            return_delay: base.return_delay ?? 2,
            cancel_on_early_reappearance: base.cancel_on_early_reappearance ?? true,
            required_return_confirmations: base.required_return_confirmations ?? 1,
            confirmation_window: base.confirmation_window ?? 5,
        };
    }
    if (source === PRIMARY_REPEATED_GAP) {
        return {
            enabled: true,
            journal_enabled: false,
            one_active_trade_only: false,
            min_adaptive_gap: base.min_adaptive_gap ?? base.min_gap ?? 10,
            max_adaptive_gap: base.max_adaptive_gap ?? base.max_gap ?? 15,
            trade_wait: base.trade_wait ?? 1,
        };
    }
    return {
        enabled: true,
        journal_enabled: false,
        dashboard_enabled: false,
        frequency_window: base.frequency_window ?? 30,
        recent_appearance_window: base.recent_appearance_window ?? 5,
        spike_recent_window: base.spike_recent_window ?? 10,
        spike_historical_window: base.spike_historical_window ?? 50,
        min_gap: base.min_gap ?? 1,
        max_gap: base.max_gap ?? 20,
    };
};

/**
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {Array<{epoch:number,digit:number}>} digit_ticks
 * @param {ReturnType<typeof normalizeConditionalEvenOddOptions>} options
 * @param {object} primary_states
 */
export const probePrimarySignals = (state, digit_ticks, options, primary_states = {}) => {
    const source = options.primary_signal_source;
    const primary_opts = buildPrimaryOptions(options, source);
    const detected_tick = state.tickIndex;
    const candidates = [];

    if (source === PRIMARY_SIGNAL_SCORE) {
        const ss_state = primary_states.signalScoreState || createSignalScoreTrackerState();
        syncSignalScoreTicks(ss_state, digit_ticks, primary_opts);
        const ctx = buildScoreContext(ss_state, primary_opts);
        const scored = [];
        for (let d = 0; d <= 9; d++) {
            scored.push(scoreDigit(d, ctx, primary_opts));
        }
        const digit = selectWinningDigit(scored, primary_opts.min_signal_score, ss_state);
        if (digit >= 0) {
            const entry = scored.find(row => row.digit === digit);
            candidates.push({
                digit,
                strength: entry?.total ?? 0,
                source,
                detectedTick: detected_tick,
                dominancePercent: 0,
            });
        }
        if (primary_states.signalScoreState) {
            Object.assign(primary_states.signalScoreState, ss_state);
        }
        return candidates;
    }

    if (source === PRIMARY_INCREASING_GAP) {
        const ig_state = primary_states.increasingGapState || createIncreasingGapTrackerState();
        syncIncreasingGapTicks(ig_state, digit_ticks, primary_opts);
        for (let d = 0; d <= 9; d++) {
            if (isIncreasingGapEligible(ig_state.digits[d], primary_opts, ig_state.tickIndex)) {
                candidates.push({
                    digit: d,
                    strength: ig_state.digits[d].predictedGap ?? 0,
                    source,
                    detectedTick: detected_tick,
                    dominancePercent: 0,
                });
            }
        }
        if (primary_states.increasingGapState) {
            Object.assign(primary_states.increasingGapState, ig_state);
        }
        return sortCandidates(candidates);
    }

    if (source === PRIMARY_LONG_ABSENCE_RETURN) {
        const lar_state = primary_states.longAbsenceState || createLongAbsenceTrackerState();
        syncLongAbsenceTicks(lar_state, digit_ticks, primary_opts);
        for (let d = 0; d <= 9; d++) {
            if (isLongAbsenceEligible(lar_state.digits[d], primary_opts, lar_state.tickIndex)) {
                candidates.push({
                    digit: d,
                    strength: lar_state.digits[d].returnAbsenceDuration ?? 0,
                    source,
                    detectedTick: detected_tick,
                    dominancePercent: 0,
                });
            }
        }
        if (primary_states.longAbsenceState) {
            Object.assign(primary_states.longAbsenceState, lar_state);
        }
        return sortCandidates(candidates);
    }

    if (source === PRIMARY_REPEATED_GAP) {
        const ad_state = primary_states.adaptiveGapState || createAdaptiveGapTrackerState();
        syncAdaptiveGapTicks(ad_state, digit_ticks, primary_opts);
        for (let d = 0; d <= 9; d++) {
            if (isAdaptiveGapEligible(ad_state.digits[d], primary_opts, ad_state.tickIndex)) {
                candidates.push({
                    digit: d,
                    strength: ad_state.digits[d].scheduleGap ?? 0,
                    source,
                    detectedTick: detected_tick,
                    dominancePercent: 0,
                });
            }
        }
        if (primary_states.adaptiveGapState) {
            Object.assign(primary_states.adaptiveGapState, ad_state);
        }
        return sortCandidates(candidates);
    }

    const ss_state = primary_states.signalScoreState || createSignalScoreTrackerState();
    const light_opts = buildPrimaryOptions(options, PRIMARY_SIGNAL_SCORE);
    syncSignalScoreTicks(ss_state, digit_ticks, light_opts);
    const ctx = buildScoreContext(ss_state, light_opts);

    if (source === PRIMARY_MOST_FREQUENT && ctx.mostFrequentDigit >= 0) {
        const digit = ctx.mostFrequentDigit;
        candidates.push({
            digit,
            strength: ctx.frequencyCounts[digit] ?? 0,
            source,
            detectedTick: detected_tick,
            dominancePercent: 0,
        });
    } else if (source === PRIMARY_RECENT_DOUBLE) {
        for (let d = 0; d <= 9; d++) {
            const count = ctx.recentAppearanceCounts[d] || 0;
            if (count >= 2) {
                candidates.push({
                    digit: d,
                    strength: count,
                    source,
                    detectedTick: detected_tick,
                    dominancePercent: 0,
                });
            }
        }
    } else if (source === PRIMARY_FREQUENCY_SPIKE) {
        ctx.frequencySpikeDigits.forEach(digit => {
            const recent = ctx.frequencyCounts[digit] || 0;
            candidates.push({
                digit,
                strength: recent,
                source,
                detectedTick: detected_tick,
                dominancePercent: 0,
            });
        });
    }

    if (primary_states.signalScoreState) {
        Object.assign(primary_states.signalScoreState, ss_state);
    }

    return sortCandidates(candidates);
};

const sortCandidates = candidates =>
    candidates.sort((a, b) => b.strength - a.strength || a.detectedTick - b.detectedTick || a.digit - b.digit);

const clearPendingSignal = state => {
    state.pendingSignal = null;
};

const formatPrimaryJournal = (candidate, filter_result, options, confirmation_count, required_confirmations) => {
    const stats = filter_result.stats;
    const parity_name = filter_result.parity_label.toLowerCase();
    const required_parity_label =
        filter_result.parity === 'even' ? 'even count' : 'odd count';

    const lines = [
        'Primary signal detected.',
        '',
        `Target digit: ${candidate.digit}`,
        `Parity: ${filter_result.parity_label}`,
        '',
        `Recent ${options.parity_window} ticks:`,
        `Even = ${stats.even_count}`,
        `Odd = ${stats.odd_count}`,
        '',
        'Filter mode:',
        filter_result.mode_label,
        '',
        `Required ${required_parity_label}:`,
        filter_result.required_label,
    ];

    if (confirmation_count > 0 && confirmation_count < required_confirmations) {
        lines.push('');
        lines.push(
            `Even/Odd confirmation for digit ${candidate.digit}:\n${confirmation_count} of ${required_confirmations} completed.`
        );
    }

    return lines.join('\n');
};

export const evaluateConditionalEvenOddDiffers = (
    digits,
    raw_options = {},
    state = createTrackerState(),
    primary_states = {}
) => {
    const options = normalizeConditionalEvenOddOptions(raw_options);
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
        releaseConditionalEvenOddActiveTrade(state);
    }

    const parity_stats = analyzeParityWindow(state.recentDigits, options.parity_window);
    let candidates = probePrimarySignals(state, digit_ticks, options, primary_states);

    for (let i = 0; i < candidates.length; i++) {
        const filter_result = evaluateParityFilter(candidates[i].digit, parity_stats, options);
        candidates[i].dominancePercent = filter_result.dominance_percent;
        candidates[i].filterPassed = !options.filter_enabled || filter_result.passed;
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
                    `Target digit ${state.pendingSignal.digit} signal expired.\n\nMaximum signal age:\n${options.max_signal_age} ticks\n\nNo trade placed.`
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
        const filter_result = evaluateParityFilter(best.digit, parity_stats, options);
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
            pushJournal(
                state,
                options,
                'journal__text',
                formatPrimaryJournal(best, filter_result, options, 0, options.required_confirmations)
            );
        }
    }

    let prediction = -1;

    if (pending) {
        const filter_result = evaluateParityFilter(pending.digit, parity_stats, options);
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
                    `Even/Odd confirmation for digit ${pending.digit}:\n${pending.confirmationCount} of ${options.required_confirmations} completed.`
                );
            }

            if (pending.confirmationCount >= options.required_confirmations) {
                prediction = pending.digit;

                if (options.journal_enabled) {
                    pushJournal(
                        state,
                        options,
                        'journal__text--success',
                        `${options.required_confirmations > 1 ? 'Signal confirmed.\n\n' : ''}Even/Odd filter passed.\n\nPlacing DIFFER ${prediction}.`
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
                    `${formatPrimaryJournal(
                        pending,
                        filter_result,
                        options,
                        pending.confirmationCount,
                        options.required_confirmations
                    )}\n\nEven/Odd filter failed.\n\nSignal rejected.`
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
            target_digit >= 0 ? evaluateParityFilter(target_digit, parity_stats, options) : null;
        const next_dashboard = formatParityDashboard({
            options,
            stats: parity_stats,
            target_digit,
            target_parity: filter_result?.parity_label ?? '',
            filter_result,
            primary_source: PRIMARY_SOURCE_LABELS[options.primary_signal_source] || options.primary_signal_source,
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
        releaseConditionalEvenOddActiveTrade(state);
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
            armConditionalEvenOddActiveTrade(state, prediction);
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
