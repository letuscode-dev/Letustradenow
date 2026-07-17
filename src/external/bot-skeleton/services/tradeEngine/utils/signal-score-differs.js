/**
 * Signal Score Differs — modular multi-condition scoring engine.
 *
 * Each digit 0–9 is scored by independent enabled conditions. When the total
 * reaches the user minimum, the highest-scoring digit is returned for Differs.
 */

export const DEFAULT_MIN_SIGNAL_SCORE = 6;
export const DEFAULT_FREQUENCY_WINDOW = 30;
export const DEFAULT_RECENT_APPEARANCE_WINDOW = 5;
export const DEFAULT_LONG_ABSENCE_THRESHOLD = 30;
export const DEFAULT_SPIKE_RECENT_WINDOW = 10;
export const DEFAULT_SPIKE_HISTORICAL_WINDOW = 50;
export const DEFAULT_MIN_GAP = 1;
export const DEFAULT_MAX_GAP = 20;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0;
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 8;

export const SCORE_MOST_FREQUENT = 2;
export const SCORE_REPEATED_GAP = 3;
export const SCORE_RECENT_DOUBLE = 2;
export const SCORE_FREQUENCY_SPIKE = 2;
export const SCORE_LONG_ABSENCE = -1;

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   tieKey: 'repeated_gap'|'frequency_spike'|'most_frequent'|null,
 *   evaluate: (digit: number, ctx: ReturnType<typeof buildScoreContext>, options: ReturnType<typeof normalizeSignalScoreOptions>) => boolean,
 * }} ScoreCondition
 */

/** @type {ScoreCondition[]} */
export const SCORE_CONDITIONS = [
    {
        id: 'most_frequent',
        label: 'Most Frequent',
        tieKey: 'most_frequent',
        evaluate: (digit, ctx, options) => {
            if (!options.most_frequent_enabled) {
                return false;
            }
            return ctx.mostFrequentDigit === digit;
        },
    },
    {
        id: 'repeated_gap',
        label: 'Repeated Gap',
        tieKey: 'repeated_gap',
        evaluate: (digit, ctx, options) => {
            if (!options.repeated_gap_enabled) {
                return false;
            }
            return ctx.repeatedGapDigits.has(digit);
        },
    },
    {
        id: 'recent_double',
        label: 'Recent Double Appearance',
        tieKey: null,
        evaluate: (digit, ctx, options) => {
            if (!options.recent_double_enabled) {
                return false;
            }
            return (ctx.recentAppearanceCounts[digit] || 0) >= 2;
        },
    },
    {
        id: 'frequency_spike',
        label: 'Frequency Spike',
        tieKey: 'frequency_spike',
        evaluate: (digit, ctx, options) => {
            if (!options.frequency_spike_enabled) {
                return false;
            }
            return ctx.frequencySpikeDigits.has(digit);
        },
    },
    {
        id: 'long_absence',
        label: 'Long Absence',
        tieKey: null,
        evaluate: (digit, ctx, options) => {
            if (!options.long_absence_enabled) {
                return false;
            }
            return (ctx.currentGaps[digit] || 0) > options.long_absence_threshold;
        },
    },
];

export const createDigitState = digit => ({
    digit,
    initialized: false,
    currentGap: 0,
    lastGap: null,
    repeatedGapConfirmed: false,
    lastOccurrenceTick: -1,
    firstQualifiedTick: -1,
});

export const createTrackerState = () => ({
    digits: Array.from({ length: 10 }, (_, digit) => createDigitState(digit)),
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
    suppressJournal: false,
    pendingJournal: [],
    lastJournal: [],
    lastDashboard: '',
    lastNoTradeLogTick: -1,
});

export const resetTrackerState = state => {
    Object.assign(state, createTrackerState());
};

export const armSignalScoreDiffersActiveTrade = (state, digit) => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'signaled';
    state.activeTradeDigit = digit;
    state.activeTradeLogEmitted = false;
    state.signaledAtTick = state.tickIndex;
};

export const openSignalScoreDiffersActiveTrade = state => {
    if (!state || state.activeTradePhase !== 'signaled') {
        return;
    }
    state.activeTradePhase = 'open';
};

export const releaseSignalScoreDiffersActiveTrade = state => {
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

const toNum = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

const gapInRange = (gap, min_gap, max_gap) => gap !== null && gap >= min_gap && gap <= max_gap;

export const normalizeSignalScoreOptions = (options = {}) => {
    let min_gap = toInt(options.min_gap, DEFAULT_MIN_GAP, 0);
    let max_gap = toInt(options.max_gap, DEFAULT_MAX_GAP, 0);
    if (max_gap < min_gap) {
        max_gap = min_gap;
    }

    return {
        enabled: toBool(options.enabled, true),
        min_signal_score: toInt(options.min_signal_score, DEFAULT_MIN_SIGNAL_SCORE, 0),
        frequency_window: Math.max(1, toInt(options.frequency_window, DEFAULT_FREQUENCY_WINDOW, 1)),
        recent_appearance_window: Math.max(2, toInt(options.recent_appearance_window, DEFAULT_RECENT_APPEARANCE_WINDOW, 2)),
        long_absence_threshold: toInt(options.long_absence_threshold, DEFAULT_LONG_ABSENCE_THRESHOLD, 0),
        spike_recent_window: Math.max(1, toInt(options.spike_recent_window, DEFAULT_SPIKE_RECENT_WINDOW, 1)),
        spike_historical_window: Math.max(1, toInt(options.spike_historical_window, DEFAULT_SPIKE_HISTORICAL_WINDOW, 1)),
        min_gap,
        max_gap,
        most_frequent_enabled: toBool(options.most_frequent_enabled ?? options.boolean_most_frequent, true),
        most_frequent_score: toNum(options.most_frequent_score, SCORE_MOST_FREQUENT),
        repeated_gap_enabled: toBool(options.repeated_gap_enabled ?? options.boolean_repeated_gap, true),
        repeated_gap_score: toNum(options.repeated_gap_score, SCORE_REPEATED_GAP),
        recent_double_enabled: toBool(options.recent_double_enabled ?? options.boolean_recent_double, true),
        recent_double_score: toNum(options.recent_double_score, SCORE_RECENT_DOUBLE),
        frequency_spike_enabled: toBool(options.frequency_spike_enabled ?? options.boolean_frequency_spike, true),
        frequency_spike_score: toNum(options.frequency_spike_score, SCORE_FREQUENCY_SPIKE),
        long_absence_enabled: toBool(options.long_absence_enabled ?? options.boolean_long_absence, true),
        long_absence_score: toNum(options.long_absence_score, SCORE_LONG_ABSENCE),
        one_active_trade_only: toBool(options.one_active_trade_only, true),
        cooldown_after_trade: toInt(options.cooldown_after_trade, DEFAULT_COOLDOWN, 0),
        max_trades_per_session: toInt(options.max_trades_per_session, DEFAULT_MAX_TRADES, 0),
        journal_enabled: toBool(options.journal_enabled, true),
        dashboard_enabled: toBool(options.dashboard_enabled, true),
    };
};

const scoreForCondition = (condition_id, options) => {
    switch (condition_id) {
        case 'most_frequent':
            return options.most_frequent_score;
        case 'repeated_gap':
            return options.repeated_gap_score;
        case 'recent_double':
            return options.recent_double_score;
        case 'frequency_spike':
            return options.frequency_spike_score;
        case 'long_absence':
            return options.long_absence_score;
        default:
            return 0;
    }
};

const isConditionEnabled = (condition_id, options) => {
    switch (condition_id) {
        case 'most_frequent':
            return options.most_frequent_enabled;
        case 'repeated_gap':
            return options.repeated_gap_enabled;
        case 'recent_double':
            return options.recent_double_enabled;
        case 'frequency_spike':
            return options.frequency_spike_enabled;
        case 'long_absence':
            return options.long_absence_enabled;
        default:
            return false;
    }
};

const countDigitsInWindow = (digits, window_size) => {
    const counts = Array(10).fill(0);
    const slice = digits.slice(-window_size);
    for (let i = 0; i < slice.length; i++) {
        const d = Number(slice[i]);
        if (Number.isInteger(d) && d >= 0 && d <= 9) {
            counts[d] += 1;
        }
    }
    return counts;
};

const findMostFrequentDigit = counts => {
    let best_digit = -1;
    let best_count = -1;
    for (let d = 0; d <= 9; d++) {
        if (counts[d] > best_count) {
            best_count = counts[d];
            best_digit = d;
        }
    }
    return best_count > 0 ? best_digit : -1;
};

const findFrequencySpikeDigits = (digits, recent_window, historical_window) => {
    const spike_digits = new Set();
    const total_needed = recent_window + historical_window;
    if (digits.length < total_needed) {
        return spike_digits;
    }

    const recent_slice = digits.slice(-recent_window);
    const historical_slice = digits.slice(-total_needed, -recent_window);
    const recent_counts = countDigitsInWindow(recent_slice, recent_window);
    const historical_counts = countDigitsInWindow(historical_slice, historical_window);

    for (let d = 0; d <= 9; d++) {
        const recent_rate = recent_counts[d] / recent_window;
        const historical_rate = historical_counts[d] / historical_window;
        if (recent_counts[d] >= 2 && recent_rate > historical_rate) {
            spike_digits.add(d);
        }
    }

    return spike_digits;
};

/**
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {ReturnType<typeof normalizeSignalScoreOptions>} options
 */
export const buildScoreContext = (state, options) => {
    const digits = state.recentDigits;
    const frequency_counts = countDigitsInWindow(digits, options.frequency_window);
    const recent_appearance_counts = countDigitsInWindow(digits, options.recent_appearance_window);
    const most_frequent_digit = findMostFrequentDigit(frequency_counts);
    const frequency_spike_digits = findFrequencySpikeDigits(
        digits,
        options.spike_recent_window,
        options.spike_historical_window
    );

    const repeated_gap_digits = new Set();
    const current_gaps = Array(10).fill(0);
    for (let d = 0; d <= 9; d++) {
        const ds = state.digits[d];
        current_gaps[d] = ds.initialized ? ds.currentGap : 0;
        if (ds.repeatedGapConfirmed) {
            repeated_gap_digits.add(d);
        }
    }

    return {
        mostFrequentDigit: most_frequent_digit,
        frequencyCounts: frequency_counts,
        recentAppearanceCounts: recent_appearance_counts,
        frequencySpikeDigits: frequency_spike_digits,
        repeatedGapDigits: repeated_gap_digits,
        currentGaps: current_gaps,
    };
};

/**
 * @param {number} digit
 * @param {ReturnType<typeof buildScoreContext>} ctx
 * @param {ReturnType<typeof normalizeSignalScoreOptions>} options
 */
export const scoreDigit = (digit, ctx, options) => {
    const breakdown = [];
    let total = 0;

    for (let i = 0; i < SCORE_CONDITIONS.length; i++) {
        const condition = SCORE_CONDITIONS[i];
        if (!isConditionEnabled(condition.id, options)) {
            continue;
        }

        const applies = condition.evaluate(digit, ctx, options);
        const points = scoreForCondition(condition.id, options);
        if (applies) {
            total += points;
        }
        breakdown.push({
            id: condition.id,
            label: condition.label,
            applies,
            points,
            signedPoints: applies ? points : 0,
        });
    }

    return { digit, total, breakdown };
};

/**
 * @param {Array<{digit:number,total:number,breakdown:Array}>} scored
 * @param {number} min_score
 * @param {ReturnType<typeof createTrackerState>} state
 */
export const selectWinningDigit = (scored, min_score, state) => {
    const qualified = scored.filter(entry => entry.total >= min_score);
    if (!qualified.length) {
        return -1;
    }

    qualified.sort((a, b) => {
        if (b.total !== a.total) {
            return b.total - a.total;
        }

        const tie_score = key => {
            const entry_a = a.breakdown.find(row => row.id === key);
            const entry_b = b.breakdown.find(row => row.id === key);
            const pts_a = entry_a?.applies ? entry_a.signedPoints : 0;
            const pts_b = entry_b?.applies ? entry_b.signedPoints : 0;
            return pts_b - pts_a;
        };

        const gap_diff = tie_score('repeated_gap');
        if (gap_diff !== 0) {
            return gap_diff;
        }
        const spike_diff = tie_score('frequency_spike');
        if (spike_diff !== 0) {
            return spike_diff;
        }
        const freq_diff = tie_score('most_frequent');
        if (freq_diff !== 0) {
            return freq_diff;
        }

        const tick_a = state.digits[a.digit].firstQualifiedTick;
        const tick_b = state.digits[b.digit].firstQualifiedTick;
        if (tick_a !== tick_b) {
            return (tick_a < 0 ? Number.MAX_SAFE_INTEGER : tick_a) - (tick_b < 0 ? Number.MAX_SAFE_INTEGER : tick_b);
        }

        return a.digit - b.digit;
    });

    return qualified[0].digit;
};

export const formatScoreDashboard = (scored, highlight_digit = -1) => {
    const lines = [];
    for (let d = 0; d <= 9; d++) {
        const entry = scored.find(row => row.digit === d);
        const score = entry ? entry.total : 0;
        const prefix = d === highlight_digit ? '▶ ' : '';
        lines.push(`${prefix}${d} : ${score}`);
    }
    return lines.join('\n');
};

const formatSigned = value => (value > 0 ? `+${value}` : `${value}`);

const formatDigitJournal = (entry, options) => {
    const lines = [`Evaluating Digit ${entry.digit}`, ''];
    for (let i = 0; i < entry.breakdown.length; i++) {
        const row = entry.breakdown[i];
        const mark = row.applies ? '✓' : '✗';
        const display_points = row.applies ? row.signedPoints : row.points;
        lines.push(`${mark} ${row.label}`);
        lines.push(formatSigned(display_points));
        lines.push('');
    }
    lines.push('Final Score', '', `${entry.total}`, '', 'Minimum Required', '', `${options.min_signal_score}`);
    return lines.join('\n');
};

/**
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {number} digit
 * @param {ReturnType<typeof normalizeSignalScoreOptions>} options
 */
export const processDigitTick = (state, digit, options) => {
    const d = Number(digit);
    if (!Number.isInteger(d) || d < 0 || d > 9) {
        return;
    }

    state.tickIndex += 1;
    const tick = state.tickIndex;
    state.recentDigits.push(d);

    const max_history =
        Math.max(
            options.frequency_window,
            options.recent_appearance_window,
            options.spike_recent_window + options.spike_historical_window
        ) + 5;
    if (state.recentDigits.length > max_history) {
        state.recentDigits = state.recentDigits.slice(-max_history);
    }

    const appeared = state.digits[d];

    if (!appeared.initialized) {
        appeared.initialized = true;
        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;
        appeared.lastGap = null;
        appeared.repeatedGapConfirmed = false;
    } else {
        const completed = appeared.currentGap;
        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;

        if (gapInRange(completed, options.min_gap, options.max_gap)) {
            if (appeared.lastGap !== null && appeared.lastGap === completed) {
                appeared.repeatedGapConfirmed = true;
            }
            appeared.lastGap = completed;
        } else {
            appeared.lastGap = null;
            appeared.repeatedGapConfirmed = false;
        }
    }

    for (let i = 0; i <= 9; i++) {
        if (i !== d) {
            state.digits[i].currentGap += 1;
        }
    }
};

export const syncTrackerWithDigitTicks = (state, digit_ticks, options = {}) => {
    if (!Array.isArray(digit_ticks) || digit_ticks.length === 0) {
        return;
    }

    const normalized = normalizeSignalScoreOptions(options);
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
        processDigitTick(state, tick.digit, normalized);
        state.lastProcessedEpoch = Number(tick.epoch);
    }

    state.suppressJournal = false;
    state.processedCount = digit_ticks.length;
};

export const syncTrackerWithDigits = (state, digits, options = {}) => {
    if (!Array.isArray(digits)) {
        return;
    }
    const digit_ticks = digits.map((digit, index) => ({
        digit,
        epoch: index + 1,
    }));
    syncTrackerWithDigitTicks(state, digit_ticks, options);
};

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

export const evaluateSignalScoreDiffers = (digits, raw_options = {}, state = createTrackerState()) => {
    const options = normalizeSignalScoreOptions(raw_options);
    const journal_messages = [];

    if (!options.enabled) {
        return {
            prediction: -1,
            enabled: false,
            journal_messages,
            dashboard: null,
            scores: Array(10).fill(0),
            eligible: [],
        };
    }

    syncTrackerWithDigitTicks(state, toDigitTicks(digits), options);

    if (state.activeTradePhase === 'signaled' && state.tickIndex > state.signaledAtTick) {
        releaseSignalScoreDiffersActiveTrade(state);
    }

    const ctx = buildScoreContext(state, options);
    const scored = [];
    for (let d = 0; d <= 9; d++) {
        const entry = scoreDigit(d, ctx, options);
        scored.push(entry);
        if (entry.total >= options.min_signal_score) {
            const ds = state.digits[d];
            if (ds.firstQualifiedTick < 0) {
                ds.firstQualifiedTick = state.tickIndex;
            }
        } else {
            state.digits[d].firstQualifiedTick = -1;
        }
    }

    if (Array.isArray(state.pendingJournal) && state.pendingJournal.length) {
        const pending = state.pendingJournal;
        const keep = Math.max(0, pending.length - MAX_JOURNAL_MESSAGES_PER_EVALUATE);
        for (let i = keep; i < pending.length; i++) {
            journal_messages.push(pending[i]);
        }
        state.pendingJournal = [];
    }

    const finish = (prediction, eligible = [], dashboard = null) => {
        if (journal_messages.length > MAX_JOURNAL_MESSAGES_PER_EVALUATE) {
            journal_messages.splice(0, journal_messages.length - MAX_JOURNAL_MESSAGES_PER_EVALUATE);
        }
        state.lastJournal = journal_messages.slice();
        return {
            prediction,
            enabled: true,
            journal_messages,
            dashboard,
            scores: scored.map(row => row.total),
            eligible,
        };
    };

    let dashboard = null;
    if (options.dashboard_enabled) {
        const highest = scored.reduce((best, row) => (row.total > best.total ? row : best), scored[0]);
        const next_dashboard = formatScoreDashboard(scored, highest.digit);
        if (next_dashboard !== state.lastDashboard) {
            dashboard = next_dashboard;
            state.lastDashboard = next_dashboard;
        }
    }

    if (!options.one_active_trade_only && state.activeTradePhase !== 'none') {
        releaseSignalScoreDiffersActiveTrade(state);
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

    const prediction = selectWinningDigit(scored, options.min_signal_score, state);
    const eligible = scored.filter(row => row.total >= options.min_signal_score).map(row => row.digit);

    if (prediction >= 0) {
        const winner = scored.find(row => row.digit === prediction);
        state.tradesThisSession += 1;
        if (options.cooldown_after_trade > 0) {
            state.cooldownUntilTick = state.tickIndex + options.cooldown_after_trade;
        }
        if (options.one_active_trade_only) {
            armSignalScoreDiffersActiveTrade(state, prediction);
        }

        if (options.journal_enabled && winner) {
            journal_messages.push({
                className: 'journal__text',
                message: formatDigitJournal(winner, options),
            });
            journal_messages.push({
                className: 'journal__text--success',
                message: 'Signal Confirmed',
            });
            journal_messages.push({
                className: 'journal__text--success',
                message: `DIFFER ${prediction}`,
            });
        }
    } else if (options.journal_enabled && state.lastNoTradeLogTick !== state.tickIndex) {
        const highest = scored.reduce((best, row) => (row.total > best.total ? row : best), scored[0]);
        state.lastNoTradeLogTick = state.tickIndex;
        journal_messages.push({
            className: 'journal__text',
            message: `Highest Score\n\n${highest.total}\n\nMinimum Required\n\n${options.min_signal_score}\n\nNo trade generated.`,
        });
    }

    return finish(prediction, eligible, dashboard);
};
