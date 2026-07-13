/**
 * Adaptive Per-Digit Gap Differs — trade filter / signal.
 *
 * For each digit 0–9 independently:
 * - Current gap = ticks since that digit last appeared (the waiting period)
 * - When the digit appears again, the completed gap is measured
 * - If that completed gap is within min–max, place Differs on that digit
 * - Current gap resets to 0 immediately on appearance and the next wait begins
 *
 * Example: digit 3 appears, then 10 ticks later 3 appears again with gap 10
 * (and 10 is within min–max) → Differs 3. Same for every digit.
 */

export const DEFAULT_MIN_ADAPTIVE_GAP = 10;
export const DEFAULT_MAX_ADAPTIVE_GAP = 15;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0; // 0 = unlimited
/** Hard cap — Journal/UI must stay responsive. */
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 2;

export const SELECTION_FIRST = 0;
export const SELECTION_LARGEST_ADAPTIVE = 1;
export const SELECTION_HIGHEST_EXCESS = 2;
export const SELECTION_LARGEST_CURRENT = 3;

/**
 * @returns {{ digit: number, initialized: boolean, currentGap: number, completedGap: number|null, adaptiveTriggerGap: number|null, lastOccurrenceTick: number, gapCompletedThisTick: boolean, pendingSignal: boolean, tradePlacedThisCycle: boolean }}
 */
export const createDigitState = digit => ({
    digit,
    initialized: false,
    currentGap: 0,
    completedGap: null,
    adaptiveTriggerGap: null,
    lastOccurrenceTick: -1,
    /** Sticky until traded or replaced by the next completed cycle. */
    pendingSignal: false,
    tradePlacedThisCycle: false,
});

/**
 * @returns {{ digits: ReturnType<typeof createDigitState>[], processedCount: number, tickIndex: number, tradesThisSession: number, cooldownUntilTick: number, lastProcessedEpoch: number|null, cooldownLogEmitted: boolean, maxTradesLogEmitted: boolean, activeTradePhase: 'none'|'signaled'|'open', activeTradeDigit: number|null, activeTradeLogEmitted: boolean, lastJournal: Array, lastDashboard: string }}
 */
export const createTrackerState = () => ({
    digits: Array.from({ length: 10 }, (_, digit) => createDigitState(digit)),
    processedCount: 0,
    tickIndex: -1,
    tradesThisSession: 0,
    cooldownUntilTick: -1,
    lastProcessedEpoch: null,
    cooldownLogEmitted: false,
    maxTradesLogEmitted: false,
    // none | signaled | open — used by one_active_trade_only until the contract settles
    activeTradePhase: 'none',
    activeTradeDigit: null,
    activeTradeLogEmitted: false,
    lastJournal: [],
    lastDashboard: '',
});

export const resetTrackerState = state => {
    Object.assign(state, createTrackerState());
};

/** Mark that a Differs signal was emitted (waiting for purchase / open contract). */
export const armAdaptiveDigitGapActiveTrade = (state, digit) => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'signaled';
    state.activeTradeDigit = digit;
    state.activeTradeLogEmitted = false;
};

/** Purchase succeeded — contract is open. */
export const openAdaptiveDigitGapActiveTrade = state => {
    if (!state || state.activeTradePhase !== 'signaled') {
        return;
    }
    state.activeTradePhase = 'open';
};

/** Contract sold / bot stop / purchase failed — allow new signals. */
export const releaseAdaptiveDigitGapActiveTrade = state => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'none';
    state.activeTradeDigit = null;
    state.activeTradeLogEmitted = false;
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

/**
 * Normalize user options for one evaluation.
 */
export const normalizeAdaptiveGapOptions = (options = {}) => {
    let min_gap = toInt(options.min_adaptive_gap, DEFAULT_MIN_ADAPTIVE_GAP, 0);
    let max_gap = toInt(options.max_adaptive_gap, DEFAULT_MAX_ADAPTIVE_GAP, 0);
    if (max_gap < min_gap) {
        max_gap = min_gap;
    }

    return {
        enabled: toBool(options.enabled, true),
        min_adaptive_gap: min_gap,
        max_adaptive_gap: max_gap,
        one_trade_per_cycle: toBool(options.one_trade_per_cycle, true),
        one_active_trade_only: toBool(options.one_active_trade_only, true),
        selection_mode: toInt(options.selection_mode, SELECTION_FIRST, 0),
        cooldown_after_trade: toInt(options.cooldown_after_trade, DEFAULT_COOLDOWN, 0),
        max_trades_per_session: toInt(options.max_trades_per_session, DEFAULT_MAX_TRADES, 0),
        journal_enabled: toBool(options.journal_enabled, true),
        dashboard_enabled: toBool(options.dashboard_enabled, false),
    };
};

/**
 * Process a single incoming last digit against tracker state.
 * Appeared digit completes/resets first; all other digits increment once.
 *
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {number} digit
 */
export const processDigitTick = (state, digit) => {
    const d = Number(digit);
    if (!Number.isInteger(d) || d < 0 || d > 9) {
        return;
    }

    state.tickIndex += 1;
    const tick = state.tickIndex;
    const appeared = state.digits[d];

    if (!appeared.initialized) {
        // First occurrence — start waiting; no completed gap yet.
        appeared.initialized = true;
        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;
        appeared.pendingSignal = false;
        appeared.tradePlacedThisCycle = false;
    } else {
        // Finished waiting: completed gap is the wait length until this reappearance.
        const completed = appeared.currentGap;
        appeared.completedGap = completed;
        appeared.adaptiveTriggerGap = completed;
        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;
        appeared.pendingSignal = true;
        appeared.tradePlacedThisCycle = false;
    }

    // Increment every other digit once for this tick (continue their wait).
    for (let i = 0; i <= 9; i++) {
        if (i !== d) {
            state.digits[i].currentGap += 1;
        }
    }
};

/**
 * Sync tracker with digit ticks identified by epoch.
 * Required because Deriv's tick cache is a fixed-size sliding window.
 *
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {Array<{ epoch: number, digit: number|string }>} digit_ticks
 * @param {object} options
 */
export const syncTrackerWithDigitTicks = (state, digit_ticks, options = {}) => {
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

    state.lastJournal = [];

    for (let i = start; i < digit_ticks.length; i++) {
        const tick = digit_ticks[i];
        processDigitTick(state, tick.digit);
        state.lastProcessedEpoch = Number(tick.epoch);
    }

    state.processedCount = digit_ticks.length;
};

/**
 * Sync from a plain digit array (append-only / tests).
 *
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {Array<number|string>} digits
 * @param {object} options
 */
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

/**
 * Normalize evaluate input: either plain digits or {epoch, digit} ticks.
 */
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

/**
 * Remaining ticks display helper (waiting for digit to reappear).
 */
export const getRemainingTicks = digit_state => {
    if (!digit_state.initialized) {
        return null;
    }
    // While waiting for reappearance we only know current wait length.
    return digit_state.currentGap;
};

/**
 * Whether a digit should Differs: it finished a wait (reappeared) and that
 * completed gap sits inside the configured min–max band.
 */
export const isDigitEligible = (digit_state, options) => {
    if (!digit_state.initialized || !digit_state.pendingSignal) {
        return false;
    }
    const gap = digit_state.completedGap;
    if (gap === null) {
        return false;
    }
    if (gap < options.min_adaptive_gap || gap > options.max_adaptive_gap) {
        return false;
    }
    if (options.one_trade_per_cycle && digit_state.tradePlacedThisCycle) {
        return false;
    }
    return true;
};

/**
 * Pick one eligible digit using the selection mode.
 *
 * @param {ReturnType<typeof createDigitState>[]} digit_states
 * @param {Partial<ReturnType<typeof normalizeAdaptiveGapOptions>>} options
 * @returns {number} digit or -1
 */
export const selectEligibleDigit = (digit_states, options) => {
    const eligible = digit_states.filter(ds => isDigitEligible(ds, options));
    if (!eligible.length) {
        return -1;
    }

    const mode = options.selection_mode;

    if (mode === SELECTION_LARGEST_ADAPTIVE) {
        eligible.sort((a, b) => b.completedGap - a.completedGap || a.digit - b.digit);
    } else if (mode === SELECTION_HIGHEST_EXCESS || mode === SELECTION_LARGEST_CURRENT) {
        eligible.sort((a, b) => b.completedGap - a.completedGap || a.digit - b.digit);
    } else {
        eligible.sort((a, b) => a.digit - b.digit);
    }

    return eligible[0].digit;
};

/**
 * Live dashboard table for all digits.
 */
export const formatGapDashboard = digit_states => {
    const rows = [];
    for (let i = 0; i < digit_states.length; i++) {
        const ds = digit_states[i];
        const last = ds.completedGap === null ? '-' : ds.completedGap;
        let status = '-';
        if (!ds.initialized) {
            status = '-';
        } else if (ds.pendingSignal) {
            status = 'ready';
        } else if (ds.tradePlacedThisCycle) {
            status = 'done';
        } else {
            status = `wait ${ds.currentGap}`;
        }
        rows.push(`${ds.digit}:${ds.currentGap}/${last} ${status}`);
    }
    return rows.join(' · ');
};

/**
 * Evaluate adaptive gap Differs signal for the latest digit window.
 *
 * @param {Array<number|string>|{epoch:number,digit:number|string}[]} digits
 * @param {object} raw_options
 * @param {ReturnType<typeof createTrackerState>} state - mutable persistent state
 * @returns {{ prediction: number, enabled: boolean, journal_messages: Array<{className: string, message: string}>, dashboard: string|null, eligible: number[] }}
 */
export const evaluateAdaptiveDigitGap = (digits, raw_options = {}, state = createTrackerState()) => {
    const options = normalizeAdaptiveGapOptions(raw_options);
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

    syncTrackerWithDigitTicks(state, toDigitTicks(digits), options);

    const finish = (prediction, eligible = []) => {
        let dashboard = null;
        if (options.dashboard_enabled) {
            const next_dashboard = formatGapDashboard(state.digits);
            if (next_dashboard !== state.lastDashboard) {
                dashboard = next_dashboard;
                state.lastDashboard = next_dashboard;
            }
        }
        if (journal_messages.length > MAX_JOURNAL_MESSAGES_PER_EVALUATE) {
            journal_messages.length = MAX_JOURNAL_MESSAGES_PER_EVALUATE;
        }
        return { prediction, enabled: true, journal_messages, dashboard, eligible };
    };

    if (!options.one_active_trade_only && state.activeTradePhase !== 'none') {
        releaseAdaptiveDigitGapActiveTrade(state);
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
        return finish(-1);
    }

    if (state.tickIndex < state.cooldownUntilTick) {
        if (options.journal_enabled && !state.cooldownLogEmitted) {
            state.cooldownLogEmitted = true;
            journal_messages.push({
                className: 'journal__text--error',
                message: `Blocked: cooldown (${state.cooldownUntilTick - state.tickIndex} left)`,
            });
        }
        return finish(-1);
    }
    state.cooldownLogEmitted = false;

    // Drop pending signals whose completed wait is outside min–max.
    for (let i = 0; i <= 9; i++) {
        const ds = state.digits[i];
        if (
            ds.pendingSignal &&
            ds.completedGap !== null &&
            (ds.completedGap < options.min_adaptive_gap || ds.completedGap > options.max_adaptive_gap)
        ) {
            ds.pendingSignal = false;
        }
    }

    if (options.one_active_trade_only && state.activeTradePhase !== 'none') {
        if (options.journal_enabled && !state.activeTradeLogEmitted) {
            state.activeTradeLogEmitted = true;
            journal_messages.push({
                className: 'journal__text--error',
                message:
                    state.activeTradeDigit != null
                        ? `Blocked: waiting for Differs ${state.activeTradeDigit}`
                        : 'Blocked: waiting for open Differs',
            });
        }
        return finish(-1);
    }

    const eligible_digits = [];
    for (let i = 0; i <= 9; i++) {
        if (isDigitEligible(state.digits[i], options)) {
            eligible_digits.push(i);
        }
    }

    let prediction = -1;

    if (eligible_digits.length) {
        prediction = selectEligibleDigit(state.digits, options);
    }

    if (prediction >= 0) {
        const ds = state.digits[prediction];
        ds.tradePlacedThisCycle = true;
        ds.pendingSignal = false;
        state.tradesThisSession += 1;
        if (options.cooldown_after_trade > 0) {
            state.cooldownUntilTick = state.tickIndex + options.cooldown_after_trade;
        }
        if (options.one_active_trade_only) {
            armAdaptiveDigitGapActiveTrade(state, prediction);
        }

        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Differs ${prediction} · waited gap ${ds.completedGap}`,
            });
        }
    }

    return finish(prediction, eligible_digits);
};
