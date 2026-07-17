/**
 * Adaptive Digit Gap Differs — repeated-gap confirmation signal.
 *
 * For each digit 0–9 independently:
 * 1. Track tick positions and the gap (intervening ticks) between appearances
 * 2. Require two consecutive equal gaps within min–max (e.g. 7→5→7→5→7)
 * 3. After confirmation, wait that same gap again, then place Digit Differs
 * 4. Purchase one tick early (duration-1 lead) so the contract settles on the
 *    expected cycle tick — not the tick after it
 * 5. Cancel if the digit appears before the wait completes
 *
 * Assumption: after two equal gaps, the digit may fail to repeat a third time.
 */

export const DEFAULT_MIN_ADAPTIVE_GAP = 10;
export const DEFAULT_MAX_ADAPTIVE_GAP = 15;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0; // 0 = unlimited
/** Hard cap — Journal/UI must stay responsive. */
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 5;
/**
 * Fire the Differs purchase this many ticks before the expected occurrence so a
 * 1-tick contract settles on the target tick (avoids off-by-one late entry).
 */
export const PURCHASE_LEAD_TICKS = 1;

export const SELECTION_FIRST = 0;
export const SELECTION_LARGEST_ADAPTIVE = 1;
export const SELECTION_HIGHEST_EXCESS = 2;
export const SELECTION_LARGEST_CURRENT = 3;

/**
 * @returns {{
 *   digit: number,
 *   initialized: boolean,
 *   currentGap: number,
 *   lastOccurrenceTick: number,
 *   lastGap: number|null,
 *   schedulePhase: 'none'|'countdown',
 *   scheduleGap: number|null,
 *   targetTick: number|null,
 *   fireTick: number|null,
 *   tradePlacedThisCycle: boolean,
 * }}
 */
export const createDigitState = digit => ({
    digit,
    initialized: false,
    currentGap: 0,
    lastOccurrenceTick: -1,
    /** Most recent completed gap — candidate for a matching repeat. */
    lastGap: null,
    /** none | countdown — waiting until fireTick to place Differs. */
    schedulePhase: 'none',
    scheduleGap: null,
    targetTick: null,
    fireTick: null,
    tradePlacedThisCycle: false,
});

/**
 * @returns {{
 *   digits: ReturnType<typeof createDigitState>[],
 *   processedCount: number,
 *   tickIndex: number,
 *   tradesThisSession: number,
 *   cooldownUntilTick: number,
 *   lastProcessedEpoch: number|null,
 *   cooldownLogEmitted: boolean,
 *   maxTradesLogEmitted: boolean,
 *   activeTradePhase: 'none'|'signaled'|'open',
 *   activeTradeDigit: number|null,
 *   activeTradeLogEmitted: boolean,
 *   pendingJournal: Array<{className: string, message: string}>,
 *   lastJournal: Array,
 *   lastDashboard: string,
 * }}
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
    activeTradePhase: 'none',
    activeTradeDigit: null,
    activeTradeLogEmitted: false,
    pendingJournal: [],
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

const pushJournal = (state, options, className, message) => {
    if (!options?.journal_enabled) {
        return;
    }
    if (!state.pendingJournal) {
        state.pendingJournal = [];
    }
    state.pendingJournal.push({ className, message });
};

const clearDigitSchedule = digit_state => {
    digit_state.schedulePhase = 'none';
    digit_state.scheduleGap = null;
    digit_state.targetTick = null;
    digit_state.fireTick = null;
};

const gapInRange = (gap, options) =>
    gap !== null && gap >= options.min_adaptive_gap && gap <= options.max_adaptive_gap;

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
 * Schedule Differs after two equal consecutive gaps were confirmed.
 * targetTick = confirmation tick + gap + 1 (expected next occurrence).
 * fireTick = targetTick - PURCHASE_LEAD_TICKS (purchase so duration-1 settles on target).
 */
const scheduleConfirmedGap = (state, digit_state, gap, options) => {
    const lead = Math.max(0, PURCHASE_LEAD_TICKS);
    const target_tick = state.tickIndex + gap + 1;
    const fire_tick = Math.max(state.tickIndex, target_tick - lead);

    digit_state.schedulePhase = 'countdown';
    digit_state.scheduleGap = gap;
    digit_state.targetTick = target_tick;
    digit_state.fireTick = fire_tick;
    digit_state.tradePlacedThisCycle = false;

    pushJournal(
        state,
        options,
        'journal__text--success',
        `Digit ${digit_state.digit} repeated gap confirmed: ${gap}, ${gap}.`
    );
    pushJournal(
        state,
        options,
        'journal__text',
        `Waiting ${gap} ticks before placing Differs ${digit_state.digit}.`
    );
};

/**
 * Process a single incoming last digit against tracker state.
 * Appeared digit completes/resets first; all other digits increment once.
 *
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {number} digit
 * @param {ReturnType<typeof normalizeAdaptiveGapOptions>} [options]
 */
export const processDigitTick = (state, digit, options = normalizeAdaptiveGapOptions()) => {
    const d = Number(digit);
    if (!Number.isInteger(d) || d < 0 || d > 9) {
        return;
    }

    state.tickIndex += 1;
    const tick = state.tickIndex;
    const appeared = state.digits[d];

    if (!appeared.initialized) {
        appeared.initialized = true;
        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;
        appeared.lastGap = null;
        clearDigitSchedule(appeared);
        appeared.tradePlacedThisCycle = false;
    } else {
        const completed = appeared.currentGap;

        // Digit returned before the scheduled wait finished → cancel.
        if (appeared.schedulePhase === 'countdown' && appeared.targetTick != null && tick < appeared.targetTick) {
            pushJournal(
                state,
                options,
                'journal__text--error',
                `Digit ${d} signal cancelled: appeared early before Differs.`
            );
            clearDigitSchedule(appeared);
            appeared.lastGap = null;
        }

        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;
        appeared.tradePlacedThisCycle = false;

        if (gapInRange(completed, options)) {
            if (appeared.lastGap !== null && appeared.lastGap === completed) {
                // Two consecutive equal gaps — only schedule if not already waiting.
                if (appeared.schedulePhase === 'none') {
                    scheduleConfirmedGap(state, appeared, completed, options);
                }
                // After confirmation the candidate chain resets so the same
                // pattern cannot spawn a duplicate schedule until used/cancelled.
                appeared.lastGap = null;
            } else {
                appeared.lastGap = completed;
                pushJournal(
                    state,
                    options,
                    'journal__text',
                    `Digit ${d} first gap recorded: ${completed} ticks.`
                );
            }
        } else {
            // Out-of-band gap breaks the equal-gap chain.
            appeared.lastGap = null;
        }
    }

    // Continue every other digit's wait, and expire missed fire windows.
    for (let i = 0; i <= 9; i++) {
        if (i !== d) {
            state.digits[i].currentGap += 1;
        }

        const ds = state.digits[i];
        if (
            ds.schedulePhase === 'countdown' &&
            ds.targetTick != null &&
            state.tickIndex >= ds.targetTick
        ) {
            // Missed the purchase lead window — cancel rather than trade late.
            pushJournal(
                state,
                options,
                'journal__text--error',
                `Digit ${i} signal cancelled: missed expected cycle tick.`
            );
            clearDigitSchedule(ds);
            ds.lastGap = null;
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

    const normalized = normalizeAdaptiveGapOptions(options);
    let start = 0;
    if (state.lastProcessedEpoch != null) {
        start = digit_ticks.findIndex(tick => Number(tick.epoch) > state.lastProcessedEpoch);
        if (start < 0) {
            return;
        }
    }

    state.pendingJournal = [];
    state.lastJournal = [];

    for (let i = start; i < digit_ticks.length; i++) {
        const tick = digit_ticks[i];
        processDigitTick(state, tick.digit, normalized);
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
 * Remaining ticks until the scheduled Differs fire (purchase lead tick).
 */
export const getRemainingTicks = digit_state => {
    if (digit_state.schedulePhase !== 'countdown' || digit_state.fireTick == null) {
        return digit_state.initialized ? digit_state.currentGap : null;
    }
    return digit_state.fireTick;
};

/**
 * Digit is ready to Differs on this evaluate (purchase lead tick reached).
 */
export const isDigitEligible = (digit_state, options, tick_index) => {
    if (!digit_state.initialized || digit_state.schedulePhase !== 'countdown') {
        return false;
    }
    if (digit_state.fireTick == null || digit_state.targetTick == null) {
        return false;
    }
    if (options.one_trade_per_cycle && digit_state.tradePlacedThisCycle) {
        return false;
    }
    // Purchase on the lead tick so duration-1 settles on targetTick.
    return tick_index >= digit_state.fireTick && tick_index < digit_state.targetTick;
};

/**
 * Pick one eligible digit using the selection mode.
 *
 * @param {ReturnType<typeof createDigitState>[]} digit_states
 * @param {Partial<ReturnType<typeof normalizeAdaptiveGapOptions>>} options
 * @param {number} tick_index
 * @returns {number} digit or -1
 */
export const selectEligibleDigit = (digit_states, options, tick_index = Number.MAX_SAFE_INTEGER) => {
    const eligible = digit_states.filter(ds => isDigitEligible(ds, options, tick_index));
    if (!eligible.length) {
        return -1;
    }

    const mode = options.selection_mode;
    const gapOf = ds => ds.scheduleGap ?? -1;

    if (mode === SELECTION_LARGEST_ADAPTIVE || mode === SELECTION_HIGHEST_EXCESS || mode === SELECTION_LARGEST_CURRENT) {
        eligible.sort((a, b) => gapOf(b) - gapOf(a) || a.digit - b.digit);
    } else {
        eligible.sort((a, b) => a.digit - b.digit);
    }

    return eligible[0].digit;
};

/**
 * Live dashboard table for all digits.
 */
export const formatGapDashboard = (digit_states, tick_index = -1) => {
    const rows = [];
    for (let i = 0; i < digit_states.length; i++) {
        const ds = digit_states[i];
        const last = ds.lastGap === null ? '-' : ds.lastGap;
        let status = '-';
        if (!ds.initialized) {
            status = '-';
        } else if (ds.schedulePhase === 'countdown' && ds.targetTick != null) {
            const left = Math.max(0, ds.fireTick - tick_index);
            status = left <= 0 ? 'ready' : `cd ${left}`;
        } else if (ds.tradePlacedThisCycle) {
            status = 'done';
        } else if (ds.lastGap !== null) {
            status = `gap ${ds.lastGap}`;
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

    if (Array.isArray(state.pendingJournal) && state.pendingJournal.length) {
        for (let i = 0; i < state.pendingJournal.length; i++) {
            journal_messages.push(state.pendingJournal[i]);
        }
        state.pendingJournal = [];
    }

    const finish = (prediction, eligible = []) => {
        let dashboard = null;
        if (options.dashboard_enabled) {
            const next_dashboard = formatGapDashboard(state.digits, state.tickIndex);
            if (next_dashboard !== state.lastDashboard) {
                dashboard = next_dashboard;
                state.lastDashboard = next_dashboard;
            }
        }
        if (journal_messages.length > MAX_JOURNAL_MESSAGES_PER_EVALUATE) {
            // Keep the newest messages — confirmations / cancels / trades matter most.
            journal_messages.splice(0, journal_messages.length - MAX_JOURNAL_MESSAGES_PER_EVALUATE);
        }
        state.lastJournal = journal_messages.slice();
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
        if (isDigitEligible(state.digits[i], options, state.tickIndex)) {
            eligible_digits.push(i);
        }
    }

    let prediction = -1;

    if (eligible_digits.length) {
        prediction = selectEligibleDigit(state.digits, options, state.tickIndex);
    }

    if (prediction >= 0) {
        const ds = state.digits[prediction];
        ds.tradePlacedThisCycle = true;
        clearDigitSchedule(ds);
        ds.lastGap = null;
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
                message: `Differs ${prediction} trade placed on the expected cycle tick.`,
            });
        }
    }

    return finish(prediction, eligible_digits);
};
