/**
 * Window Index Differs — collect n digits as a reference window (indexes 1..n).
 * In the next window of n ticks, at each index i place Digit Differs on the digit
 * that sat at the same index in the previous window. When all n indexes are done,
 * roll the just-collected window into the new reference and repeat.
 *
 * Designed to stay tick-aligned: evaluate is idempotent (safe to re-run), never
 * blocks an armed prediction, and trading does not wait on history fetches.
 *
 * Recovery stake sizing uses the shared payout-based recovery mechanism.
 */

export const DEFAULT_TICK_WINDOW = 5;

/** @typedef {'collecting' | 'trading'} WindowIndexDiffersPhase */

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
 * @param {Array<number|{digit:number}|string>} digits
 * @returns {number[]}
 */
export const normalizeDigitSequence = digits => {
    if (!Array.isArray(digits) || digits.length === 0) {
        return [];
    }
    const out = [];
    for (let i = 0; i < digits.length; i++) {
        const item = digits[i];
        const value =
            typeof item === 'object' && item !== null && 'digit' in item
                ? Number(item.digit)
                : Number(item);
        if (Number.isInteger(value) && value >= 0 && value <= 9) {
            out.push(value);
        }
    }
    return out;
};

export const normalizeWindowIndexDiffersOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    tick_window: Math.max(2, toInt(options.tick_window ?? options.window_size, DEFAULT_TICK_WINDOW, 2)),
    journal_enabled: toBool(options.journal_enabled, true),
});

/**
 * @returns {{
 *   phase: WindowIndexDiffersPhase,
 *   windowSize: number,
 *   reference: number[],
 *   currentWindow: number[],
 *   nextIndex: number,
 *   lastPrediction: number,
 *   tradesInWindow: number,
 *   referenceReadyNotified: boolean,
 * }}
 */
export const createWindowIndexDiffersState = (window_size = DEFAULT_TICK_WINDOW) => ({
    phase: 'collecting',
    windowSize: Math.max(2, toInt(window_size, DEFAULT_TICK_WINDOW, 2)),
    reference: [],
    currentWindow: [],
    nextIndex: 0,
    lastPrediction: -1,
    tradesInWindow: 0,
    referenceReadyNotified: false,
});

/**
 * @param {ReturnType<typeof createWindowIndexDiffersState> | null} state
 */
export const resetWindowIndexDiffersState = state => {
    if (!state) {
        return createWindowIndexDiffersState();
    }
    state.phase = 'collecting';
    state.reference = [];
    state.currentWindow = [];
    state.nextIndex = 0;
    state.lastPrediction = -1;
    state.tradesInWindow = 0;
    state.referenceReadyNotified = false;
    return state;
};

/**
 * After a Differs trade settles, record the result digit at the current index
 * and advance immediately so the next tick can be armed without a gap.
 *
 * @param {ReturnType<typeof createWindowIndexDiffersState>} state
 * @param {number} result_digit - last digit of the tick that settled the contract
 */
export const applyWindowIndexDiffersResult = (state, result_digit) => {
    if (!state || state.phase !== 'trading' || state.reference.length < state.windowSize) {
        return state || createWindowIndexDiffersState();
    }

    const digit = Number(result_digit);
    const idx = Math.max(0, Math.floor(Number(state.nextIndex)) || 0);

    if (Number.isInteger(digit) && digit >= 0 && digit <= 9) {
        state.currentWindow[idx] = digit;
    }

    state.lastPrediction = -1;
    state.nextIndex = idx + 1;
    state.tradesInWindow = (Number(state.tradesInWindow) || 0) + 1;

    if (state.nextIndex >= state.windowSize) {
        const completed = [];
        for (let i = 0; i < state.windowSize; i++) {
            const value = state.currentWindow[i];
            if (!Number.isInteger(value) || value < 0 || value > 9) {
                state.phase = 'collecting';
                state.reference = [];
                state.currentWindow = [];
                state.nextIndex = 0;
                state.tradesInWindow = 0;
                state.referenceReadyNotified = false;
                return state;
            }
            completed.push(value);
        }
        // Roll immediately — next evaluate arms index 1 of the new window.
        state.reference = completed;
        state.currentWindow = [];
        state.nextIndex = 0;
        state.tradesInWindow = 0;
        state.phase = 'trading';
        state.referenceReadyNotified = false;
    }

    return state;
};

/**
 * @param {Array<number|{digit:number}|string>} digits
 * @param {object} raw_options
 * @param {ReturnType<typeof createWindowIndexDiffersState>} state
 * @returns {{
 *   prediction: number,
 *   allowed: boolean,
 *   enabled: boolean,
 *   phase: WindowIndexDiffersPhase,
 *   index: number,
 *   window_size: number,
 *   reference: number[],
 *   journal_messages: Array<{className:string,message:string}>,
 * }}
 */
export const evaluateWindowIndexDiffers = (digits, raw_options = {}, state = null) => {
    const options = normalizeWindowIndexDiffersOptions(raw_options);
    const journal_messages = [];
    const tracker = state || createWindowIndexDiffersState(options.tick_window);
    tracker.windowSize = options.tick_window;

    const empty = (extra = {}) => ({
        prediction: -1,
        allowed: false,
        enabled: options.enabled,
        phase: tracker.phase,
        index: tracker.nextIndex,
        window_size: tracker.windowSize,
        reference: tracker.reference.slice(),
        journal_messages,
        ...extra,
    });

    if (!options.enabled) {
        return empty({ enabled: false });
    }

    // Idempotent: if we already armed this index, keep returning the same
    // prediction so a re-run of trade options cannot drop the signal mid-tick.
    if (
        tracker.phase === 'trading' &&
        tracker.reference.length >= tracker.windowSize &&
        tracker.lastPrediction >= 0 &&
        tracker.lastPrediction <= 9
    ) {
        return {
            prediction: tracker.lastPrediction,
            allowed: true,
            enabled: true,
            phase: tracker.phase,
            index: tracker.nextIndex,
            window_size: tracker.windowSize,
            reference: tracker.reference.slice(),
            journal_messages,
        };
    }

    const sequence = normalizeDigitSequence(digits);

    if (tracker.phase === 'collecting' || tracker.reference.length < tracker.windowSize) {
        if (sequence.length < tracker.windowSize) {
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text',
                    message: `Collecting reference window (${sequence.length}/${tracker.windowSize}).`,
                });
            }
            tracker.phase = 'collecting';
            return empty();
        }

        tracker.reference = sequence.slice(-tracker.windowSize);
        tracker.currentWindow = [];
        tracker.nextIndex = 0;
        tracker.tradesInWindow = 0;
        tracker.phase = 'trading';
        tracker.lastPrediction = -1;
        tracker.referenceReadyNotified = false;
    }

    const index = tracker.nextIndex;
    if (index < 0 || index >= tracker.reference.length) {
        tracker.phase = 'collecting';
        tracker.reference = [];
        tracker.nextIndex = 0;
        tracker.lastPrediction = -1;
        tracker.referenceReadyNotified = false;
        return empty();
    }

    const prediction = tracker.reference[index];
    tracker.lastPrediction = prediction;

    if (options.journal_enabled) {
        if (!tracker.referenceReadyNotified) {
            tracker.referenceReadyNotified = true;
            journal_messages.push({
                className: 'journal__text--success',
                message: [
                    'Reference window ready — trading every tick.',
                    tracker.reference.map((d, i) => `${i + 1}:${d}`).join(', '),
                ].join('\n'),
            });
        }
        journal_messages.push({
            className: 'journal__text--success',
            message: `Index ${index + 1}/${tracker.windowSize} → DIFFERS ${prediction}`,
        });
    }

    return {
        prediction,
        allowed: true,
        enabled: true,
        phase: tracker.phase,
        index,
        window_size: tracker.windowSize,
        reference: tracker.reference.slice(),
        journal_messages,
    };
};
