/**
 * Same-Digit Wait Differs (Bot #2) — watch the last N ticks (default 2);
 * when they are all the same digit D, wait M ticks (default 2), then place
 * Digit Differs on D. After the trade settles, resume watching.
 *
 * Recovery stake sizing uses the shared payout-based recovery mechanism.
 *
 * File / export names keep `window-index-differs` for strategy key stability.
 */

export const DEFAULT_MATCH_COUNT = 2;
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
    tick_window: Math.max(
        2,
        toInt(options.tick_window ?? options.match_count, DEFAULT_MATCH_COUNT, 2)
    ),
    trade_wait: Math.max(
        0,
        toInt(options.trade_wait ?? options.wait_ticks, DEFAULT_WAIT_TICKS, 0)
    ),
    journal_enabled: toBool(options.journal_enabled, true),
});

/**
 * @returns {{
 *   phase: SameDigitWaitPhase,
 *   matchCount: number,
 *   waitTicks: number,
 *   targetDigit: number,
 *   matchEndLength: number,
 *   lastPrediction: number,
 *   matchNotified: boolean,
 *   waitNotified: boolean,
 * }}
 */
export const createWindowIndexDiffersState = (match_count = DEFAULT_MATCH_COUNT) => ({
    phase: 'watching',
    matchCount: Math.max(2, toInt(match_count, DEFAULT_MATCH_COUNT, 2)),
    waitTicks: DEFAULT_WAIT_TICKS,
    targetDigit: -1,
    matchEndLength: 0,
    lastPrediction: -1,
    matchNotified: false,
    waitNotified: false,
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
    state.matchEndLength = 0;
    state.lastPrediction = -1;
    state.matchNotified = false;
    state.waitNotified = false;
    return state;
};

/**
 * After a Differs trade settles, clear the armed signal and resume watching.
 *
 * @param {ReturnType<typeof createWindowIndexDiffersState>} state
 * @param {number} [_result_digit] - unused; kept for call-site compatibility
 */
export const applyWindowIndexDiffersResult = (state, _result_digit) => {
    return resetWindowIndexDiffersState(state || createWindowIndexDiffersState());
};

const allSameDigit = digits => {
    if (!digits.length) {
        return false;
    }
    const first = digits[0];
    for (let i = 1; i < digits.length; i++) {
        if (digits[i] !== first) {
            return false;
        }
    }
    return true;
};

/**
 * @param {Array<number|{digit:number}|string>} digits
 * @param {object} raw_options
 * @param {ReturnType<typeof createWindowIndexDiffersState>} state
 * @returns {{
 *   prediction: number,
 *   allowed: boolean,
 *   enabled: boolean,
 *   phase: SameDigitWaitPhase,
 *   target_digit: number,
 *   wait_remaining: number,
 *   match_count: number,
 *   trade_wait: number,
 *   journal_messages: Array<{className:string,message:string}>,
 * }}
 */
export const evaluateWindowIndexDiffers = (digits, raw_options = {}, state = null) => {
    const options = normalizeWindowIndexDiffersOptions(raw_options);
    const journal_messages = [];
    const tracker = state || createWindowIndexDiffersState(options.tick_window);
    tracker.matchCount = options.tick_window;
    tracker.waitTicks = options.trade_wait;

    const empty = (extra = {}) => ({
        prediction: -1,
        allowed: false,
        enabled: options.enabled,
        phase: tracker.phase,
        target_digit: tracker.targetDigit,
        wait_remaining: Math.max(
            0,
            tracker.waitTicks - Math.max(0, (extra.sequence_length || 0) - tracker.matchEndLength)
        ),
        match_count: tracker.matchCount,
        trade_wait: tracker.waitTicks,
        journal_messages,
        ...extra,
    });

    if (!options.enabled) {
        return empty({ enabled: false });
    }

    // Idempotent while armed so trade-options re-runs do not drop the signal.
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
            match_count: tracker.matchCount,
            trade_wait: tracker.waitTicks,
            journal_messages,
        };
    }

    const sequence = normalizeDigitSequence(digits);
    const seq_len = sequence.length;

    if (tracker.phase === 'watching') {
        if (seq_len < tracker.matchCount) {
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text',
                    message: `Watching for ${tracker.matchCount} matching digits (${seq_len}/${tracker.matchCount}).`,
                });
            }
            return empty({ sequence_length: seq_len });
        }

        const recent = sequence.slice(-tracker.matchCount);
        if (!allSameDigit(recent)) {
            return empty({ sequence_length: seq_len });
        }

        tracker.targetDigit = recent[0];
        tracker.matchEndLength = seq_len;
        tracker.matchNotified = false;
        tracker.waitNotified = false;
        tracker.lastPrediction = -1;

        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Matched ${tracker.matchCount}× digit ${tracker.targetDigit}.`,
            });
            tracker.matchNotified = true;
        }

        if (tracker.waitTicks <= 0) {
            tracker.phase = 'armed';
            tracker.lastPrediction = tracker.targetDigit;
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text--success',
                    message: `DIFFERS ${tracker.targetDigit} (no wait).`,
                });
            }
            return {
                prediction: tracker.lastPrediction,
                allowed: true,
                enabled: true,
                phase: tracker.phase,
                target_digit: tracker.targetDigit,
                wait_remaining: 0,
                match_count: tracker.matchCount,
                trade_wait: tracker.waitTicks,
                journal_messages,
            };
        }

        tracker.phase = 'waiting';
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text',
                message: `Waiting ${tracker.waitTicks} tick(s) before Differs ${tracker.targetDigit}.`,
            });
            tracker.waitNotified = true;
        }
        return empty({ sequence_length: seq_len });
    }

    if (tracker.phase === 'waiting') {
        if (seq_len < tracker.matchEndLength) {
            // History reset — start over.
            resetWindowIndexDiffersState(tracker);
            return empty({ sequence_length: seq_len });
        }

        const waited = seq_len - tracker.matchEndLength;
        if (waited < tracker.waitTicks) {
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text',
                    message: `Waiting ${waited}/${tracker.waitTicks} before Differs ${tracker.targetDigit}.`,
                });
            }
            return empty({
                sequence_length: seq_len,
                wait_remaining: tracker.waitTicks - waited,
            });
        }

        tracker.phase = 'armed';
        tracker.lastPrediction = tracker.targetDigit;
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Wait complete → DIFFERS ${tracker.targetDigit}`,
            });
        }
        return {
            prediction: tracker.lastPrediction,
            allowed: true,
            enabled: true,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            wait_remaining: 0,
            match_count: tracker.matchCount,
            trade_wait: tracker.waitTicks,
            journal_messages,
        };
    }

    return empty({ sequence_length: seq_len });
};
