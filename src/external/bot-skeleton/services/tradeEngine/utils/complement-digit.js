/**
 * Complement Digit Differs — when the last two digits sum to 9 (mirror pairs
 * 0↔9, 1↔8, 2↔7, 3↔6, 4↔5), Differs the previous digit.
 *
 * Examples:
 *   previous=0, current=9 → Differs 0
 *   previous=9, current=0 → Differs 9
 *   previous=4, current=5 → Differs 4
 */

const toDigit = value => {
    const n = Math.floor(Number(value));
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
};

const toBool = (value, default_value = true) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

/**
 * @param {Array<number|string>} digits - oldest → newest
 * @returns {number} previous digit to Differs, or -1 when no complement pair
 */
export const getComplementDigitPrediction = digits => {
    if (!Array.isArray(digits) || digits.length < 2) {
        return -1;
    }

    const previous = toDigit(digits[digits.length - 2]);
    const current = toDigit(digits[digits.length - 1]);
    if (previous === null || current === null) {
        return -1;
    }

    // Mirror pairs always sum to 9.
    if (previous + current === 9) {
        return previous;
    }

    return -1;
};

/**
 * @param {Array<number|string>} digits
 * @param {{ enabled?: boolean, journal_enabled?: boolean }} [options]
 * @returns {{ prediction: number, enabled: boolean, journal_messages: Array<{className: string, message: string}> }}
 */
export const evaluateComplementDigit = (digits, options = {}) => {
    const enabled = toBool(options.enabled, true);
    const journal_enabled = toBool(options.journal_enabled, true);
    const journal_messages = [];

    if (!enabled) {
        return { prediction: -1, enabled: false, journal_messages };
    }

    if (!Array.isArray(digits) || digits.length < 2) {
        return { prediction: -1, enabled: true, journal_messages };
    }

    const previous = toDigit(digits[digits.length - 2]);
    const current = toDigit(digits[digits.length - 1]);
    if (previous === null || current === null) {
        return { prediction: -1, enabled: true, journal_messages };
    }

    const prediction = previous + current === 9 ? previous : -1;

    if (journal_enabled && prediction >= 0) {
        journal_messages.push({
            className: 'journal__text--success',
            message: `Complement ${previous}→${current} · Differs ${prediction}`,
        });
    }

    return { prediction, enabled: true, journal_messages };
};
