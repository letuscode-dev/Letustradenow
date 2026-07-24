/**
 * Same-Digit Wait Differs (Bot #2)
 *
 * On each new tick: if previous_digit === current_digit, remember that digit,
 * wait `trade_wait` ticks (default 2), then place Digit Differs on it.
 * After the trade settles, resume watching.
 *
 * Wait progress uses tick epochs / tickIndex so a filled sliding cache cannot
 * stall the countdown (array length alone stops growing once history is full).
 *
 * Export names keep `window-index-differs` for strategy-key stability.
 */

export const DEFAULT_WAIT_TICKS = 2;

/** @typedef {'watching' | 'waiting' | 'armed'} SameDigitWaitPhase */

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

const toDigit = value => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
};

/**
 * @param {Array<number|{digit:number,epoch?:number}|string>} digit_ticks
 * @returns {Array<{digit:number,epoch:number|null}>}
 */
export const normalizeDigitTicks = digit_ticks => {
    if (!Array.isArray(digit_ticks) || digit_ticks.length === 0) {
        return [];
    }
    const out = [];
    for (let i = 0; i < digit_ticks.length; i++) {
        const item = digit_ticks[i];
        if (item !== null && typeof item === 'object') {
            const digit = toDigit(item.digit ?? item.quote);
            if (digit === null) {
                continue;
            }
            const epoch_raw = item.epoch;
            const epoch = epoch_raw === undefined || epoch_raw === null ? null : Number(epoch_raw);
            out.push({
                digit,
                epoch: Number.isFinite(epoch) ? epoch : null,
            });
        } else {
            const digit = toDigit(item);
            if (digit !== null) {
                out.push({ digit, epoch: null });
            }
        }
    }
    return out;
};

/** @deprecated kept for older imports/tests */
export const normalizeDigitSequence = digits =>
    normalizeDigitTicks(digits).map(tick => tick.digit);

export const normalizeWindowIndexDiffersOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    trade_wait: Math.max(
        0,
        toInt(options.trade_wait ?? options.wait_ticks, DEFAULT_WAIT_TICKS, 0)
    ),
    journal_enabled: toBool(options.journal_enabled, true),
});

/**
 * @returns {{
 *   phase: SameDigitWaitPhase,
 *   tickIndex: number,
 *   lastProcessedEpoch: number|null,
 *   previousDigit: number,
 *   targetDigit: number,
 *   matchTickIndex: number,
 *   fireTick: number,
 *   waitTicks: number,
 *   lastPrediction: number,
 * }}
 */
export const createWindowIndexDiffersState = () => ({
    phase: 'watching',
    tickIndex: -1,
    lastProcessedEpoch: null,
    previousDigit: -1,
    targetDigit: -1,
    matchTickIndex: -1,
    fireTick: -1,
    waitTicks: DEFAULT_WAIT_TICKS,
    lastPrediction: -1,
});

/**
 * @param {ReturnType<typeof createWindowIndexDiffersState> | null} state
 */
export const resetWindowIndexDiffersState = state => {
    if (!state) {
        return createWindowIndexDiffersState();
    }
    state.phase = 'watching';
    state.targetDigit = -1;
    state.matchTickIndex = -1;
    state.fireTick = -1;
    state.lastPrediction = -1;
    // Keep tickIndex / previousDigit / lastProcessedEpoch so the next live tick
    // continues cleanly after a settled trade.
    return state;
};

/**
 * After a Differs trade settles, clear the armed signal and resume watching.
 *
 * @param {ReturnType<typeof createWindowIndexDiffersState>} state
 * @param {number} [_result_digit]
 */
export const applyWindowIndexDiffersResult = (state, _result_digit) => {
    return resetWindowIndexDiffersState(state || createWindowIndexDiffersState());
};

const armPrediction = (tracker, journal_messages, options, reason) => {
    tracker.phase = 'armed';
    tracker.lastPrediction = tracker.targetDigit;
    if (options.journal_enabled) {
        journal_messages.push({
            className: 'journal__text--success',
            message: `${reason} → DIFFERS ${tracker.targetDigit}`,
        });
    }
};

/**
 * Process one newly arrived last digit.
 */
const processNewTick = (tracker, digit, options, journal_messages) => {
    tracker.tickIndex += 1;
    const tick = tracker.tickIndex;
    const previous = tracker.previousDigit;

    if (tracker.phase === 'armed') {
        tracker.previousDigit = digit;
        return;
    }

    if (tracker.phase === 'waiting') {
        if (tick >= tracker.fireTick) {
            armPrediction(tracker, journal_messages, options, 'Wait complete');
        } else if (options.journal_enabled) {
            const waited = tick - tracker.matchTickIndex;
            journal_messages.push({
                className: 'journal__text',
                message: `Waiting ${waited}/${tracker.waitTicks} before Differs ${tracker.targetDigit}.`,
            });
        }
        tracker.previousDigit = digit;
        return;
    }

    // watching: previous_digit === current_digit → start wait / arm
    if (previous >= 0 && previous === digit) {
        tracker.targetDigit = digit;
        tracker.matchTickIndex = tick;
        tracker.waitTicks = options.trade_wait;

        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Repeat detected: previous=${previous}, current=${digit}.`,
            });
        }

        if (tracker.waitTicks <= 0) {
            armPrediction(tracker, journal_messages, options, 'No wait');
        } else {
            tracker.phase = 'waiting';
            tracker.fireTick = tick + tracker.waitTicks;
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text',
                    message: `Waiting ${tracker.waitTicks} tick(s) before Differs ${digit}.`,
                });
            }
        }
    }

    tracker.previousDigit = digit;
};

/**
 * Advance state for newly seen ticks (by epoch, or by plain-array growth in tests).
 *
 * @param {Array<number|{digit:number,epoch?:number}|string>} digit_ticks
 * @param {object} raw_options
 * @param {ReturnType<typeof createWindowIndexDiffersState>} state
 */
export const evaluateWindowIndexDiffers = (digit_ticks, raw_options = {}, state = null) => {
    const options = normalizeWindowIndexDiffersOptions(raw_options);
    const journal_messages = [];
    const tracker = state || createWindowIndexDiffersState();
    tracker.waitTicks = options.trade_wait;

    const empty = (extra = {}) => ({
        prediction: -1,
        allowed: false,
        enabled: options.enabled,
        phase: tracker.phase,
        target_digit: tracker.targetDigit,
        wait_remaining:
            tracker.phase === 'waiting'
                ? Math.max(0, tracker.fireTick - tracker.tickIndex)
                : 0,
        trade_wait: tracker.waitTicks,
        journal_messages,
        ...extra,
    });

    if (!options.enabled) {
        return empty({ enabled: false });
    }

    if (
        tracker.phase === 'armed' &&
        tracker.lastPrediction >= 0 &&
        tracker.lastPrediction <= 9
    ) {
        return {
            prediction: tracker.lastPrediction,
            allowed: true,
            enabled: true,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            wait_remaining: 0,
            trade_wait: tracker.waitTicks,
            journal_messages,
        };
    }

    const ticks = normalizeDigitTicks(digit_ticks);
    const has_epochs = ticks.some(tick => tick.epoch !== null);

    if (has_epochs) {
        // First live call: anchor on the newest tick so old cache repeats are ignored.
        if (tracker.lastProcessedEpoch === null && ticks.length) {
            const newest = ticks[ticks.length - 1];
            if (newest.epoch !== null) {
                tracker.lastProcessedEpoch = newest.epoch;
            }
            tracker.previousDigit = newest.digit;
            if (tracker.tickIndex < 0) {
                tracker.tickIndex = 0;
            }
            return empty();
        }

        for (let i = 0; i < ticks.length; i++) {
            const { digit, epoch } = ticks[i];
            if (epoch !== null && epoch === tracker.lastProcessedEpoch) {
                continue;
            }
            if (epoch !== null && tracker.lastProcessedEpoch !== null && epoch < tracker.lastProcessedEpoch) {
                continue;
            }
            if (epoch !== null) {
                tracker.lastProcessedEpoch = epoch;
            }
            processNewTick(tracker, digit, options, journal_messages);
            if (tracker.phase === 'armed') {
                break;
            }
        }
    } else {
        // Unit tests / plain digit lists: treat list growth as new ticks.
        const start_index = Math.max(0, tracker.tickIndex + 1);
        for (let i = start_index; i < ticks.length; i++) {
            processNewTick(tracker, ticks[i].digit, options, journal_messages);
            if (tracker.phase === 'armed') {
                break;
            }
        }
    }

    if (
        tracker.phase === 'armed' &&
        tracker.lastPrediction >= 0 &&
        tracker.lastPrediction <= 9
    ) {
        return {
            prediction: tracker.lastPrediction,
            allowed: true,
            enabled: true,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            wait_remaining: 0,
            trade_wait: tracker.waitTicks,
            journal_messages,
        };
    }

    return empty();
};
