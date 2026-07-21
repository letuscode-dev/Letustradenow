/**
 * Consecutive Digits Over — last N digits all < max_digit → Over barrier.
 *
 * Phases:
 * - base: last 6 digits all < 7 → Over 2
 * - immediate: after Over 2 loss → enter Over 3 on the next tick (no digit analysis)
 * - analysis: after Over 3 loss → require the digit signal again before trading
 *
 * Master toggle: options.enabled (Quick Strategy "Enable strategy").
 */

export const DEFAULT_DIGIT_COUNT = 6;
export const DEFAULT_MAX_DIGIT = 7;
export const DEFAULT_BASE_PREDICTION = 2;
export const DEFAULT_RECOVERY_PREDICTION = 3;

/** @typedef {'base' | 'immediate' | 'analysis'} ConsecutiveDigitsOverPhase */

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

export const normalizeConsecutiveDigitsOverOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    digit_count: Math.max(1, toInt(options.digit_count, DEFAULT_DIGIT_COUNT, 1)),
    max_digit: Math.max(1, Math.min(10, toInt(options.max_digit ?? options.min_digit, DEFAULT_MAX_DIGIT, 1))),
    base_prediction: Math.max(0, Math.min(9, toInt(options.base_prediction, DEFAULT_BASE_PREDICTION, 0))),
    recovery_prediction: Math.max(
        0,
        Math.min(9, toInt(options.recovery_prediction, DEFAULT_RECOVERY_PREDICTION, 0))
    ),
    journal_enabled: toBool(options.journal_enabled, true),
});

/**
 * @returns {{
 *   phase: ConsecutiveDigitsOverPhase,
 *   lastPrediction: number,
 * }}
 */
export const createConsecutiveDigitsOverState = () => ({
    phase: 'base',
    lastPrediction: -1,
});

/**
 * Reset phase state (e.g. on bot stop).
 * @param {{ phase?: ConsecutiveDigitsOverPhase, lastPrediction?: number } | null} state
 */
export const resetConsecutiveDigitsOverState = state => {
    if (!state) {
        return createConsecutiveDigitsOverState();
    }
    state.phase = 'base';
    state.lastPrediction = -1;
    return state;
};

/**
 * Advance phase after a settled trade.
 *
 * Over 2 loss → immediate Over 3 (no analysis).
 * Over 3 loss → analysis (require digit signal again).
 * Win → base when flat, otherwise stay in analysis until recovered.
 *
 * @param {{ phase: ConsecutiveDigitsOverPhase, lastPrediction: number }} state
 * @param {boolean} is_win
 * @param {boolean} [still_recovering]
 */
export const applyConsecutiveDigitsOverResult = (state, is_win, still_recovering = false) => {
    if (!state) {
        return createConsecutiveDigitsOverState();
    }

    if (is_win) {
        state.phase = still_recovering ? 'analysis' : 'base';
        state.lastPrediction = -1;
        return state;
    }

    const last = Number(state.lastPrediction);
    if (last === DEFAULT_RECOVERY_PREDICTION || state.phase === 'immediate') {
        state.phase = 'analysis';
    } else {
        state.phase = 'immediate';
    }
    state.lastPrediction = -1;
    return state;
};

/**
 * Returns the last `count` digits from a digit list or digit-tick list.
 * @param {Array<number|{digit:number}>} digits
 * @param {number} count
 * @returns {number[]}
 */
export const getRecentDigits = (digits, count) => {
    if (!Array.isArray(digits) || digits.length === 0) {
        return [];
    }
    const normalized = digits.map(item => {
        if (typeof item === 'object' && item !== null && 'digit' in item) {
            return Number(item.digit);
        }
        return Number(item);
    });
    return normalized.slice(-count);
};

/**
 * True when every digit in the window is strictly less than max_digit.
 * @param {number[]} window_digits
 * @param {number} max_digit
 */
export const allDigitsBelowMaximum = (window_digits, max_digit) => {
    if (!Array.isArray(window_digits) || window_digits.length === 0) {
        return false;
    }
    for (let i = 0; i < window_digits.length; i++) {
        const digit = window_digits[i];
        if (!Number.isInteger(digit) || digit < 0 || digit >= max_digit) {
            return false;
        }
    }
    return true;
};

/**
 * Evaluate consecutive-digits Over signal with phase-aware recovery.
 *
 * @param {Array<number|{digit:number}>} digits
 * @param {object} raw_options
 * @param {{ phase?: ConsecutiveDigitsOverPhase, lastPrediction?: number } | null} [phase_state]
 * @returns {{
 *   prediction: number,
 *   allowed: boolean,
 *   enabled: boolean,
 *   phase: ConsecutiveDigitsOverPhase,
 *   is_recovering: boolean,
 *   recent_digits: number[],
 *   journal_messages: Array<{className:string,message:string}>,
 * }}
 */
export const evaluateConsecutiveDigitsOver = (digits, raw_options = {}, phase_state = null) => {
    const options = normalizeConsecutiveDigitsOverOptions(raw_options);
    const journal_messages = [];
    const state = phase_state || createConsecutiveDigitsOverState();
    const phase = state.phase === 'immediate' || state.phase === 'analysis' ? state.phase : 'base';
    const is_recovering = phase === 'immediate' || phase === 'analysis';

    if (!options.enabled) {
        return {
            prediction: -1,
            allowed: false,
            enabled: false,
            phase,
            is_recovering,
            recent_digits: [],
            journal_messages,
        };
    }

    // Immediate Over 3: no digit analysis — enter on the next tick after Over 2 loss.
    if (phase === 'immediate') {
        const prediction = options.recovery_prediction;
        state.lastPrediction = prediction;
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--warn',
                message: [
                    'Immediate recovery — skipping digit analysis.',
                    '',
                    `Mode: Immediate`,
                    `Placing OVER ${prediction}.`,
                ].join('\n'),
            });
        }
        return {
            prediction,
            allowed: true,
            enabled: true,
            phase,
            is_recovering: true,
            recent_digits: getRecentDigits(digits, options.digit_count),
            journal_messages,
        };
    }

    const recent_digits = getRecentDigits(digits, options.digit_count);
    if (recent_digits.length < options.digit_count) {
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text',
                message: `Waiting for ${options.digit_count} ticks (have ${recent_digits.length}).`,
            });
        }
        return {
            prediction: -1,
            allowed: false,
            enabled: true,
            phase,
            is_recovering,
            recent_digits,
            journal_messages,
        };
    }

    const signal = allDigitsBelowMaximum(recent_digits, options.max_digit);
    if (!signal) {
        return {
            prediction: -1,
            allowed: false,
            enabled: true,
            phase,
            is_recovering,
            recent_digits,
            journal_messages,
        };
    }

    // Base and analysis both require the digit signal; analysis keeps recovery stake.
    const prediction = options.base_prediction;
    const mode_label = phase === 'analysis' ? 'Analysis' : 'Base';
    state.lastPrediction = prediction;

    if (options.journal_enabled) {
        journal_messages.push({
            className: 'journal__text--success',
            message: [
                phase === 'analysis'
                    ? 'Analysis signal detected after recovery loss.'
                    : 'Consecutive digits signal detected.',
                '',
                `Last ${options.digit_count} digits:`,
                recent_digits.join(', '),
                '',
                `All digits < ${options.max_digit}.`,
                '',
                `Mode: ${mode_label}`,
                `Placing OVER ${prediction}.`,
            ].join('\n'),
        });
    }

    return {
        prediction,
        allowed: true,
        enabled: true,
        phase,
        is_recovering,
        recent_digits,
        journal_messages,
    };
};
