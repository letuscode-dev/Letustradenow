/**
 * Increasing Gap Differs — arithmetic progression gap signal.
 *
 * For each digit 0–9 independently:
 * 1. Track gaps between consecutive appearances
 * 2. When the last N gaps form an arithmetic progression (equal step), predict the next gap
 * 3. Wait exactly that many ticks, then place Digit Differs (purchase lead for 1-tick settle)
 * 4. Cancel the schedule if the digit appears early (optional)
 */

export const DEFAULT_MIN_GAP = 1;
export const DEFAULT_MAX_GAP = 20;
export const DEFAULT_MIN_COMMON_DIFF = 1;
export const DEFAULT_MAX_COMMON_DIFF = 5;
export const DEFAULT_GAPS_REQUIRED = 3;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0;
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 5;
export const PURCHASE_LEAD_TICKS = 1;

export const SELECTION_FIRST = 0;
export const SELECTION_LARGEST_PREDICTED_GAP = 1;

/**
 * @returns {{
 *   digit: number,
 *   initialized: boolean,
 *   currentGap: number,
 *   lastOccurrenceTick: number,
 *   gapHistory: number[],
 *   schedulePhase: 'none'|'countdown',
 *   predictedGap: number|null,
 *   commonDifference: number|null,
 *   targetTick: number|null,
 *   fireTick: number|null,
 *   tradePlacedThisCycle: boolean,
 *   lastCountdownRemaining: number|null,
 * }}
 */
export const createDigitState = digit => ({
    digit,
    initialized: false,
    currentGap: 0,
    lastOccurrenceTick: -1,
    gapHistory: [],
    schedulePhase: 'none',
    predictedGap: null,
    commonDifference: null,
    targetTick: null,
    fireTick: null,
    tradePlacedThisCycle: false,
    lastCountdownRemaining: null,
});

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
    signaledAtTick: -1,
    pendingJournal: [],
    lastJournal: [],
});

export const resetTrackerState = state => {
    Object.assign(state, createTrackerState());
};

export const armIncreasingDigitGapActiveTrade = (state, digit) => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'signaled';
    state.activeTradeDigit = digit;
    state.activeTradeLogEmitted = false;
    state.signaledAtTick = state.tickIndex;
};

export const openIncreasingDigitGapActiveTrade = state => {
    if (!state || state.activeTradePhase !== 'signaled') {
        return;
    }
    state.activeTradePhase = 'open';
};

export const releaseIncreasingDigitGapActiveTrade = state => {
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

const clearDigitSchedule = digit_state => {
    digit_state.schedulePhase = 'none';
    digit_state.predictedGap = null;
    digit_state.commonDifference = null;
    digit_state.targetTick = null;
    digit_state.fireTick = null;
    digit_state.lastCountdownRemaining = null;
};

const gapInRange = (gap, options) =>
    gap !== null && gap >= options.min_gap && gap <= options.max_gap;

const diffInRange = (diff, options) =>
    diff >= options.min_common_diff && diff <= options.max_common_diff;

export const formatGapHistory = gaps => gaps.join(' → ');

/**
 * @param {number[]} gaps - at least gaps_required entries
 * @param {number} gaps_required
 * @returns {{ commonDifference: number, predictedGap: number }|null}
 */
export const detectArithmeticProgression = (gaps, gaps_required = DEFAULT_GAPS_REQUIRED) => {
    const required = Math.max(2, Math.floor(gaps_required));
    if (!Array.isArray(gaps) || gaps.length < required) {
        return null;
    }

    const window = gaps.slice(-required);
    const differences = [];
    for (let i = 1; i < window.length; i++) {
        differences.push(window[i] - window[i - 1]);
    }

    const common = differences[0];
    if (!differences.every(d => d === common)) {
        return null;
    }

    const last_gap = window[window.length - 1];
    return {
        commonDifference: common,
        predictedGap: last_gap + common,
    };
};

export const normalizeIncreasingGapOptions = (options = {}) => {
    let min_gap = toInt(options.min_gap, DEFAULT_MIN_GAP, 0);
    let max_gap = toInt(options.max_gap, DEFAULT_MAX_GAP, 0);
    if (max_gap < min_gap) {
        max_gap = min_gap;
    }

    let min_common_diff = toInt(options.min_common_diff, DEFAULT_MIN_COMMON_DIFF, 0);
    let max_common_diff = toInt(options.max_common_diff, DEFAULT_MAX_COMMON_DIFF, 0);
    if (max_common_diff < min_common_diff) {
        max_common_diff = min_common_diff;
    }

    const gaps_required = Math.max(2, toInt(options.gaps_required, DEFAULT_GAPS_REQUIRED, 2));

    return {
        enabled: toBool(options.enabled, true),
        min_gap,
        max_gap,
        min_common_diff,
        max_common_diff,
        gaps_required,
        cancel_early_appearance: toBool(options.cancel_early_appearance, true),
        one_trade_per_cycle: toBool(options.one_trade_per_cycle, true),
        one_active_trade_only: toBool(options.one_active_trade_only, true),
        selection_mode: toInt(options.selection_mode, SELECTION_FIRST, 0),
        cooldown_after_trade: toInt(options.cooldown_after_trade, DEFAULT_COOLDOWN, 0),
        max_trades_per_session: toInt(options.max_trades_per_session, DEFAULT_MAX_TRADES, 0),
        journal_enabled: toBool(options.journal_enabled, true),
    };
};

const resetGapCollection = digit_state => {
    digit_state.gapHistory = [];
};

const cancelPrediction = (state, digit_state, options, reason) => {
    clearDigitSchedule(digit_state);
    resetGapCollection(digit_state);
    digit_state.tradePlacedThisCycle = false;

    if (reason === 'early') {
        pushJournal(state, options, 'journal__text--error', 'Prediction cancelled.');
        pushJournal(
            state,
            options,
            'journal__text',
            `Digit ${digit_state.digit} appeared earlier than the predicted gap.`
        );
        pushJournal(state, options, 'journal__text', 'Collecting a new gap sequence.');
    }
};

const tryScheduleProgression = (state, digit_state, options) => {
    if (digit_state.schedulePhase !== 'none') {
        return;
    }

    const progression = detectArithmeticProgression(digit_state.gapHistory, options.gaps_required);
    if (!progression) {
        return;
    }

    const { commonDifference, predictedGap } = progression;
    const window = digit_state.gapHistory.slice(-options.gaps_required);

    if (!window.every(gap => gapInRange(gap, options))) {
        return;
    }
    if (!diffInRange(commonDifference, options)) {
        return;
    }
    if (!gapInRange(predictedGap, options)) {
        return;
    }

    const wait = Math.max(0, predictedGap);
    const lead = Math.max(0, PURCHASE_LEAD_TICKS);
    const target_tick = state.tickIndex + wait + 1;
    const fire_tick = Math.max(state.tickIndex, target_tick - lead);

    digit_state.schedulePhase = 'countdown';
    digit_state.predictedGap = predictedGap;
    digit_state.commonDifference = commonDifference;
    digit_state.targetTick = target_tick;
    digit_state.fireTick = fire_tick;
    digit_state.tradePlacedThisCycle = false;
    digit_state.lastCountdownRemaining = null;

    const diff_label = commonDifference >= 0 ? `+${commonDifference}` : `${commonDifference}`;

    pushJournal(
        state,
        options,
        'journal__text',
        `Digit ${digit_state.digit} gap history:\n${formatGapHistory(window)}`
    );
    pushJournal(state, options, 'journal__text--success', 'Arithmetic progression detected.');
    pushJournal(state, options, 'journal__text', `Common difference: ${diff_label}`);
    pushJournal(state, options, 'journal__text', `Predicted next gap: ${predictedGap}`);
    pushJournal(
        state,
        options,
        'journal__text',
        `Waiting ${predictedGap} ticks before placing DIFFER ${digit_state.digit}.`
    );
};

const recordCompletedGap = (state, digit_state, completed, options) => {
    if (!gapInRange(completed, options)) {
        resetGapCollection(digit_state);
        return;
    }

    digit_state.gapHistory.push(completed);
    const keep = Math.max(options.gaps_required + 2, options.gaps_required);
    if (digit_state.gapHistory.length > keep) {
        digit_state.gapHistory = digit_state.gapHistory.slice(-keep);
    }

    tryScheduleProgression(state, digit_state, options);
};

const logCountdownIfNeeded = (state, digit_state, options, tick_index) => {
    if (
        digit_state.schedulePhase !== 'countdown' ||
        digit_state.fireTick == null ||
        tick_index >= digit_state.fireTick
    ) {
        return;
    }

    const remaining = digit_state.fireTick - tick_index;
    if (remaining <= 0 || digit_state.lastCountdownRemaining === remaining) {
        return;
    }

    digit_state.lastCountdownRemaining = remaining;
    pushJournal(
        state,
        options,
        'journal__text',
        `Countdown: ${remaining} tick${remaining === 1 ? '' : 's'} remaining...`
    );
};

/**
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {number} digit
 * @param {ReturnType<typeof normalizeIncreasingGapOptions>} [options]
 */
export const processDigitTick = (state, digit, options = normalizeIncreasingGapOptions()) => {
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
        clearDigitSchedule(appeared);
        appeared.tradePlacedThisCycle = false;
        resetGapCollection(appeared);
    } else {
        const completed = appeared.currentGap;
        const in_countdown = appeared.schedulePhase === 'countdown';

        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;

        if (in_countdown) {
            if (options.cancel_early_appearance) {
                cancelPrediction(state, appeared, options, 'early');
            }
        } else {
            appeared.tradePlacedThisCycle = false;
            recordCompletedGap(state, appeared, completed, options);
        }
    }

    for (let i = 0; i <= 9; i++) {
        if (i !== d) {
            state.digits[i].currentGap += 1;
        }

        const ds = state.digits[i];
        logCountdownIfNeeded(state, ds, options, state.tickIndex);

        if (
            ds.schedulePhase === 'countdown' &&
            ds.targetTick != null &&
            state.tickIndex >= ds.targetTick
        ) {
            pushJournal(
                state,
                options,
                'journal__text--error',
                `Digit ${i} signal cancelled: missed expected cycle tick.`
            );
            clearDigitSchedule(ds);
            resetGapCollection(ds);
        }
    }
};

export const syncTrackerWithDigitTicks = (state, digit_ticks, options = {}) => {
    if (!Array.isArray(digit_ticks) || digit_ticks.length === 0) {
        return;
    }

    const normalized = normalizeIncreasingGapOptions(options);
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
    return tick_index >= digit_state.fireTick && tick_index < digit_state.targetTick;
};

export const selectEligibleDigit = (digit_states, options, tick_index = Number.MAX_SAFE_INTEGER) => {
    const eligible = digit_states.filter(ds => isDigitEligible(ds, options, tick_index));
    if (!eligible.length) {
        return -1;
    }

    const mode = options.selection_mode;
    if (mode === SELECTION_LARGEST_PREDICTED_GAP) {
        eligible.sort(
            (a, b) => (b.predictedGap ?? -1) - (a.predictedGap ?? -1) || a.digit - b.digit
        );
    } else {
        eligible.sort((a, b) => a.digit - b.digit);
    }

    return eligible[0].digit;
};

export const evaluateIncreasingDigitGap = (digits, raw_options = {}, state = createTrackerState()) => {
    const options = normalizeIncreasingGapOptions(raw_options);
    const journal_messages = [];

    if (!options.enabled) {
        return {
            prediction: -1,
            enabled: false,
            journal_messages,
            eligible: [],
        };
    }

    syncTrackerWithDigitTicks(state, toDigitTicks(digits), options);

    // Purchase happens after this call returns — a prior 'signaled' state is stale on a new tick.
    if (state.activeTradePhase === 'signaled' && state.tickIndex > state.signaledAtTick) {
        releaseIncreasingDigitGapActiveTrade(state);
    }

    if (Array.isArray(state.pendingJournal) && state.pendingJournal.length) {
        const pending = state.pendingJournal;
        const keep = Math.max(0, pending.length - MAX_JOURNAL_MESSAGES_PER_EVALUATE);
        for (let i = keep; i < pending.length; i++) {
            journal_messages.push(pending[i]);
        }
        state.pendingJournal = [];
    }

    const finish = (prediction, eligible = []) => {
        if (journal_messages.length > MAX_JOURNAL_MESSAGES_PER_EVALUATE) {
            journal_messages.splice(0, journal_messages.length - MAX_JOURNAL_MESSAGES_PER_EVALUATE);
        }
        state.lastJournal = journal_messages.slice();
        return { prediction, enabled: true, journal_messages, eligible };
    };

    if (!options.one_active_trade_only && state.activeTradePhase !== 'none') {
        releaseIncreasingDigitGapActiveTrade(state);
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
        resetGapCollection(ds);
        state.tradesThisSession += 1;
        if (options.cooldown_after_trade > 0) {
            state.cooldownUntilTick = state.tickIndex + options.cooldown_after_trade;
        }
        if (options.one_active_trade_only) {
            armIncreasingDigitGapActiveTrade(state, prediction);
        }

        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `DIFFER ${prediction} trade placed.`,
            });
        }
    }

    return finish(prediction, eligible_digits);
};
