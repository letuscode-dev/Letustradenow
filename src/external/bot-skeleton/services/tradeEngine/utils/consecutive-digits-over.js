/**
 * Consecutive Digits Over — last N digits all >= min_digit → Over barrier.
 *
 * Base mode: Over 2 (barrier 2)
 * Recovery mode (after Over 2 loss): Over 3 (barrier 3) with payout-based recovery stake
 */

export const DEFAULT_DIGIT_COUNT = 3;
export const DEFAULT_MIN_DIGIT = 3;
export const DEFAULT_BASE_PREDICTION = 2;
export const DEFAULT_RECOVERY_PREDICTION = 3;

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
    min_digit: Math.max(0, Math.min(9, toInt(options.min_digit, DEFAULT_MIN_DIGIT, 0))),
    base_prediction: Math.max(0, Math.min(9, toInt(options.base_prediction, DEFAULT_BASE_PREDICTION, 0))),
    recovery_prediction: Math.max(
        0,
        Math.min(9, toInt(options.recovery_prediction, DEFAULT_RECOVERY_PREDICTION, 0))
    ),
    journal_enabled: toBool(options.journal_enabled, true),
});

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
 * True when every digit in the window is >= min_digit.
 * @param {number[]} window_digits
 * @param {number} min_digit
 */
export const allDigitsMeetMinimum = (window_digits, min_digit) => {
    if (!Array.isArray(window_digits) || window_digits.length === 0) {
        return false;
    }
    for (let i = 0; i < window_digits.length; i++) {
        const digit = window_digits[i];
        if (!Number.isInteger(digit) || digit < min_digit || digit > 9) {
            return false;
        }
    }
    return true;
};

/**
 * Evaluate consecutive-digits Over signal.
 *
 * @param {Array<number|{digit:number}>} digits
 * @param {object} raw_options
 * @param {boolean} is_recovering - when true, return recovery barrier (Over 3)
 * @returns {{
 *   prediction: number,
 *   allowed: boolean,
 *   enabled: boolean,
 *   is_recovering: boolean,
 *   recent_digits: number[],
 *   journal_messages: Array<{className:string,message:string}>,
 * }}
 */
export const evaluateConsecutiveDigitsOver = (digits, raw_options = {}, is_recovering = false) => {
    const options = normalizeConsecutiveDigitsOverOptions(raw_options);
    const journal_messages = [];

    if (!options.enabled) {
        return {
            prediction: -1,
            allowed: false,
            enabled: false,
            is_recovering: !!is_recovering,
            recent_digits: [],
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
            is_recovering: !!is_recovering,
            recent_digits,
            journal_messages,
        };
    }

    const signal = allDigitsMeetMinimum(recent_digits, options.min_digit);
    if (!signal) {
        return {
            prediction: -1,
            allowed: false,
            enabled: true,
            is_recovering: !!is_recovering,
            recent_digits,
            journal_messages,
        };
    }

    const prediction = is_recovering ? options.recovery_prediction : options.base_prediction;
    const mode_label = is_recovering ? 'Recovery' : 'Base';

    if (options.journal_enabled) {
        journal_messages.push({
            className: 'journal__text--success',
            message: [
                'Consecutive digits signal detected.',
                '',
                `Last ${options.digit_count} digits:`,
                recent_digits.join(', '),
                '',
                `All digits >= ${options.min_digit}.`,
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
        is_recovering: !!is_recovering,
        recent_digits,
        journal_messages,
    };
};
