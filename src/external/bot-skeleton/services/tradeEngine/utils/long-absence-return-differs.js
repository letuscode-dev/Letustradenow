/**
 * Long-Absence Return Differs — wait after a digit returns from a long absence.
 *
 * For each digit 0–9 independently:
 * 1. Track consecutive absence ticks
 * 2. When absence meets the threshold and the digit reappears, register a return event
 * 3. Optionally require multiple appearances within a confirmation window
 * 4. Wait a configurable delay, then place Digit Differs (purchase lead for 1-tick settle)
 * 5. Cancel if the digit reappears during the delay (optional)
 */

export const DEFAULT_MIN_ABSENCE_THRESHOLD = 20;
export const DEFAULT_MAX_ABSENCE_THRESHOLD = 0;
export const DEFAULT_RETURN_DELAY = 2;
export const DEFAULT_REQUIRED_RETURN_CONFIRMATIONS = 1;
export const DEFAULT_CONFIRMATION_WINDOW = 5;
export const DEFAULT_MAX_SIGNAL_AGE = 0;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0;
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 8;
export const PURCHASE_LEAD_TICKS = 1;

export const createDigitState = digit => ({
    digit,
    initialized: false,
    currentAbsence: 0,
    lastCompletedAbsence: 0,
    lastOccurrenceTick: -1,
    schedulePhase: 'none',
    returnDetected: false,
    returnAbsenceDuration: 0,
    returnDetectedTick: -1,
    confirmationCount: 0,
    confirmationDeadlineTick: -1,
    targetTick: null,
    fireTick: null,
    signalStatus: 'none',
    signalAgeDeadline: null,
    lastCountdownRemaining: null,
    tradePlacedThisCycle: false,
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
    suppressJournal: false,
    pendingJournal: [],
    lastJournal: [],
    lastDashboard: '',
});

export const resetTrackerState = state => {
    Object.assign(state, createTrackerState());
};

export const armLongAbsenceReturnActiveTrade = (state, digit) => {
    if (!state) {
        return;
    }
    state.activeTradePhase = 'signaled';
    state.activeTradeDigit = digit;
    state.activeTradeLogEmitted = false;
    state.signaledAtTick = state.tickIndex;
};

export const openLongAbsenceReturnActiveTrade = state => {
    if (!state || state.activeTradePhase !== 'signaled') {
        return;
    }
    state.activeTradePhase = 'open';
};

export const releaseLongAbsenceReturnActiveTrade = state => {
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

export const normalizeLongAbsenceReturnOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    min_absence_threshold: Math.max(1, toInt(options.min_absence_threshold, DEFAULT_MIN_ABSENCE_THRESHOLD, 1)),
    max_absence_threshold: toInt(options.max_absence_threshold, DEFAULT_MAX_ABSENCE_THRESHOLD, 0),
    return_delay: Math.max(0, toInt(options.return_delay, DEFAULT_RETURN_DELAY, 0)),
    cancel_on_early_reappearance: toBool(
        options.cancel_on_early_reappearance ?? options.boolean_cancel_early,
        true
    ),
    required_return_confirmations: Math.max(
        1,
        toInt(options.required_return_confirmations, DEFAULT_REQUIRED_RETURN_CONFIRMATIONS, 1)
    ),
    confirmation_window: Math.max(
        1,
        toInt(options.confirmation_window, DEFAULT_CONFIRMATION_WINDOW, 1)
    ),
    max_signal_age: toInt(options.max_signal_age, DEFAULT_MAX_SIGNAL_AGE, 0),
    one_active_trade_only: toBool(options.one_active_trade_only, true),
    queue_signals: toBool(options.queue_signals, false),
    cooldown_after_trade: toInt(options.cooldown_after_trade, DEFAULT_COOLDOWN, 0),
    max_trades_per_session: toInt(options.max_trades_per_session, DEFAULT_MAX_TRADES, 0),
    journal_enabled: toBool(options.journal_enabled, true),
    dashboard_enabled: toBool(options.dashboard_enabled, true),
});

const clearDigitSchedule = digit_state => {
    digit_state.schedulePhase = 'none';
    digit_state.returnDetected = false;
    digit_state.returnAbsenceDuration = 0;
    digit_state.returnDetectedTick = -1;
    digit_state.confirmationCount = 0;
    digit_state.confirmationDeadlineTick = -1;
    digit_state.targetTick = null;
    digit_state.fireTick = null;
    digit_state.signalStatus = 'none';
    digit_state.signalAgeDeadline = null;
    digit_state.lastCountdownRemaining = null;
};

const isAbsenceInRange = (absence, options) => {
    if (absence < options.min_absence_threshold) {
        return false;
    }
    if (options.max_absence_threshold > 0 && absence > options.max_absence_threshold) {
        return false;
    }
    return true;
};

const getScheduledDigits = state =>
    state.digits.filter(ds => ds.schedulePhase === 'countdown' || ds.schedulePhase === 'confirming');

const compareSignalPriority = (absence_a, tick_a, absence_b, tick_b) => {
    if (absence_a !== absence_b) {
        return absence_b - absence_a;
    }
    return tick_a - tick_b;
};

const shouldReplaceScheduled = (existing, absence, detected_tick) => {
    const cmp = compareSignalPriority(
        existing.returnAbsenceDuration,
        existing.returnDetectedTick,
        absence,
        detected_tick
    );
    return cmp > 0;
};

const canScheduleNewSignal = (state, absence, detected_tick, options) => {
    const scheduled = getScheduledDigits(state);
    if (!scheduled.length) {
        return true;
    }
    if (options.queue_signals) {
        return true;
    }
    return scheduled.every(ds => shouldReplaceScheduled(ds, absence, detected_tick));
};

const discardLowerPrioritySignals = (state, absence, detected_tick) => {
    for (let i = 0; i <= 9; i++) {
        const ds = state.digits[i];
        if (
            (ds.schedulePhase === 'countdown' || ds.schedulePhase === 'confirming') &&
            shouldReplaceScheduled(ds, absence, detected_tick)
        ) {
            clearDigitSchedule(ds);
            ds.tradePlacedThisCycle = false;
        }
    }
};

const startCountdown = (state, digit_state, options) => {
    const wait = Math.max(0, options.return_delay);
    const lead = Math.max(0, PURCHASE_LEAD_TICKS);
    const return_tick = state.tickIndex;
    const target_tick = return_tick + wait + 1;
    const fire_tick = Math.max(return_tick, target_tick - lead);

    digit_state.schedulePhase = 'countdown';
    digit_state.returnDetected = true;
    digit_state.targetTick = target_tick;
    digit_state.fireTick = fire_tick;
    digit_state.signalStatus = 'waiting';
    digit_state.tradePlacedThisCycle = false;
    digit_state.lastCountdownRemaining = null;
    digit_state.signalAgeDeadline =
        options.max_signal_age > 0 ? return_tick + options.max_signal_age : null;

    pushJournal(
        state,
        options,
        'journal__text',
        `Digit ${digit_state.digit} returned after ${digit_state.returnAbsenceDuration} ticks.\nValid long-absence return detected.`
    );
    pushJournal(
        state,
        options,
        'journal__text',
        `Waiting ${wait} tick${wait === 1 ? '' : 's'} before DIFFER ${digit_state.digit}.`
    );
};

const beginReturnDetection = (state, digit_state, completed_absence, options) => {
    if (!canScheduleNewSignal(state, completed_absence, state.tickIndex, options)) {
        return;
    }

    discardLowerPrioritySignals(state, completed_absence, state.tickIndex);

    digit_state.returnAbsenceDuration = completed_absence;
    digit_state.returnDetectedTick = state.tickIndex;
    digit_state.lastCompletedAbsence = completed_absence;

    pushJournal(
        state,
        options,
        'journal__text',
        `Digit ${digit_state.digit} absence count reached ${completed_absence} ticks.`
    );

    if (options.required_return_confirmations <= 1) {
        startCountdown(state, digit_state, options);
        return;
    }

    digit_state.schedulePhase = 'confirming';
    digit_state.returnDetected = true;
    digit_state.confirmationCount = 1;
    digit_state.confirmationDeadlineTick = state.tickIndex + options.confirmation_window;
    digit_state.signalStatus = 'waiting';
};

const cancelScheduledSignal = (state, digit_state, options, reason) => {
    clearDigitSchedule(digit_state);
    digit_state.tradePlacedThisCycle = false;

    if (reason === 'early') {
        digit_state.signalStatus = 'cancelled';
        pushJournal(
            state,
            options,
            'journal__text--error',
            `Signal cancelled: Digit ${digit_state.digit} reappeared during the waiting period.`
        );
    } else if (reason === 'expired') {
        digit_state.signalStatus = 'expired';
        pushJournal(
            state,
            options,
            'journal__text--error',
            'Signal expired: Trade could not be placed within the allowed signal age.'
        );
    } else if (reason === 'missed') {
        digit_state.signalStatus = 'expired';
        pushJournal(
            state,
            options,
            'journal__text--error',
            `Digit ${digit_state.digit} signal cancelled: missed expected cycle tick.`
        );
    }
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
        `Digit ${digit_state.digit} countdown: ${remaining} tick${remaining === 1 ? '' : 's'} remaining.`
    );
};

const expireConfirmingIfNeeded = (state, digit_state, options, tick_index) => {
    if (digit_state.schedulePhase !== 'confirming') {
        return;
    }
    if (tick_index <= digit_state.confirmationDeadlineTick) {
        return;
    }
    if (digit_state.confirmationCount >= options.required_return_confirmations) {
        return;
    }
    clearDigitSchedule(digit_state);
    digit_state.tradePlacedThisCycle = false;
};

const expireSignalAgeIfNeeded = (state, digit_state, options, tick_index) => {
    if (
        digit_state.schedulePhase !== 'countdown' ||
        digit_state.signalAgeDeadline == null ||
        tick_index <= digit_state.signalAgeDeadline
    ) {
        return;
    }
    cancelScheduledSignal(state, digit_state, options, 'expired');
};

const handleDigitAppearance = (state, digit_state, options) => {
    const completed_absence = digit_state.currentAbsence;

    if (digit_state.schedulePhase === 'countdown') {
        if (options.cancel_on_early_reappearance) {
            cancelScheduledSignal(state, digit_state, options, 'early');
        }
    } else if (digit_state.schedulePhase === 'confirming') {
        digit_state.confirmationCount += 1;
        if (digit_state.confirmationCount >= options.required_return_confirmations) {
            startCountdown(state, digit_state, options);
        }
    } else if (isAbsenceInRange(completed_absence, options)) {
        beginReturnDetection(state, digit_state, completed_absence, options);
    }

    digit_state.currentAbsence = 0;
    digit_state.lastOccurrenceTick = state.tickIndex;
};

export const processDigitTick = (state, digit, options = normalizeLongAbsenceReturnOptions()) => {
    const d = Number(digit);
    if (!Number.isInteger(d) || d < 0 || d > 9) {
        return;
    }

    state.tickIndex += 1;

    const appeared = state.digits[d];

    if (!appeared.initialized) {
        appeared.initialized = true;
        appeared.currentAbsence = 0;
        appeared.lastOccurrenceTick = state.tickIndex;
        clearDigitSchedule(appeared);
        appeared.tradePlacedThisCycle = false;
    } else {
        handleDigitAppearance(state, appeared, options);
    }

    for (let i = 0; i <= 9; i++) {
        if (i !== d) {
            state.digits[i].currentAbsence += 1;
        }

        const ds = state.digits[i];
        expireConfirmingIfNeeded(state, ds, options, state.tickIndex);
        logCountdownIfNeeded(state, ds, options, state.tickIndex);
        expireSignalAgeIfNeeded(state, ds, options, state.tickIndex);

        if (
            ds.schedulePhase === 'countdown' &&
            ds.targetTick != null &&
            state.tickIndex >= ds.targetTick &&
            !ds.tradePlacedThisCycle
        ) {
            cancelScheduledSignal(state, ds, options, 'missed');
        }
    }
};

export const syncTrackerWithDigitTicks = (state, digit_ticks, options = {}) => {
    if (!Array.isArray(digit_ticks) || digit_ticks.length === 0) {
        return;
    }

    const normalized = normalizeLongAbsenceReturnOptions(options);
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
    if (digit_state.tradePlacedThisCycle) {
        return false;
    }
    return tick_index >= digit_state.fireTick && tick_index < digit_state.targetTick;
};

export const selectEligibleDigit = (digit_states, tick_index = Number.MAX_SAFE_INTEGER) => {
    const eligible = digit_states.filter(ds => isDigitEligible(ds, {}, tick_index));
    if (!eligible.length) {
        return -1;
    }

    eligible.sort(
        (a, b) =>
            compareSignalPriority(
                a.returnAbsenceDuration,
                a.returnDetectedTick,
                b.returnAbsenceDuration,
                b.returnDetectedTick
            ) || a.digit - b.digit
    );

    return eligible[0].digit;
};

const formatStatusLabel = digit_state => {
    if (digit_state.signalStatus === 'cancelled') {
        return 'Cancelled';
    }
    if (digit_state.signalStatus === 'expired') {
        return 'Expired';
    }
    if (digit_state.signalStatus === 'completed') {
        return 'Completed';
    }
    if (digit_state.schedulePhase === 'confirming') {
        return 'Confirming';
    }
    if (digit_state.schedulePhase === 'countdown') {
        return 'Waiting';
    }
    return 'Idle';
};

const getDelayRemaining = (digit_state, tick_index) => {
    if (digit_state.schedulePhase !== 'countdown' || digit_state.fireTick == null) {
        return 0;
    }
    return Math.max(0, digit_state.fireTick - tick_index);
};

export const formatDigitDashboard = (digit_state, tick_index) => {
    const lines = [
        `Digit ${digit_state.digit}`,
        `Current absence: ${digit_state.currentAbsence}`,
        `Last completed absence: ${digit_state.lastCompletedAbsence}`,
        `Return detected: ${digit_state.returnDetected ? 'Yes' : 'No'}`,
        `Delay remaining: ${getDelayRemaining(digit_state, tick_index)}`,
        `Status: ${formatStatusLabel(digit_state)}`,
    ];
    return lines.join('\n');
};

export const formatDashboard = (state, highlight_digit = -1) => {
    const sections = [];
    for (let d = 0; d <= 9; d++) {
        const ds = state.digits[d];
        const active =
            ds.schedulePhase !== 'none' ||
            ds.returnDetected ||
            ds.currentAbsence >= 5 ||
            d === highlight_digit;
        if (!active) {
            continue;
        }
        const prefix = d === highlight_digit ? '▶ ' : '';
        sections.push(`${prefix}${formatDigitDashboard(ds, state.tickIndex)}`);
    }
    return sections.join('\n\n');
};

export const evaluateLongAbsenceReturnDiffers = (
    digits,
    raw_options = {},
    state = createTrackerState()
) => {
    const options = normalizeLongAbsenceReturnOptions(raw_options);
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

    if (state.activeTradePhase === 'signaled' && state.tickIndex > state.signaledAtTick) {
        releaseLongAbsenceReturnActiveTrade(state);
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
            eligible,
        };
    };

    let dashboard = null;
    if (options.dashboard_enabled) {
        const leader = selectEligibleDigit(state.digits, state.tickIndex);
        const next_dashboard = formatDashboard(state, leader);
        if (next_dashboard !== state.lastDashboard) {
            dashboard = next_dashboard;
            state.lastDashboard = next_dashboard;
        }
    }

    if (!options.one_active_trade_only && state.activeTradePhase !== 'none') {
        releaseLongAbsenceReturnActiveTrade(state);
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

    const eligible_digits = [];
    for (let i = 0; i <= 9; i++) {
        if (isDigitEligible(state.digits[i], options, state.tickIndex)) {
            eligible_digits.push(i);
        }
    }

    let prediction = -1;
    if (eligible_digits.length) {
        prediction = selectEligibleDigit(state.digits, state.tickIndex);
    }

    if (prediction >= 0) {
        const ds = state.digits[prediction];
        ds.tradePlacedThisCycle = true;
        ds.signalStatus = 'completed';
        clearDigitSchedule(ds);

        state.tradesThisSession += 1;
        if (options.cooldown_after_trade > 0) {
            state.cooldownUntilTick = state.tickIndex + options.cooldown_after_trade;
        }
        if (options.one_active_trade_only) {
            armLongAbsenceReturnActiveTrade(state, prediction);
        }

        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: 'Return delay completed.\nPlacing DIFFER ' + prediction + '.',
            });
            journal_messages.push({
                className: 'journal__text--success',
                message: `DIFFER ${prediction} trade placed.`,
            });
        }
    }

    return finish(prediction, eligible_digits, dashboard);
};
