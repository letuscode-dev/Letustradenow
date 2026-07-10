/**
 * Digit-pair transition analysis over a rolling last-digit window.
 * Counts all from→to transitions, then when the current digit matches a
 * pattern destination (to), Differs the digit that initiated that pattern (from).
 *
 * Example: strong 0→3 and current digit is 3 → Differs 0.
 */

export const DEFAULT_TICK_WINDOW = 120;
export const DEFAULT_PATTERN_THRESHOLD = 5;

/**
 * @param {Array<number|string>} digits - last-digit sequence (oldest → newest)
 * @param {number} threshold - minimum transition count to treat as a valid pattern
 * @returns {{ from: number, to: number, count: number } | null}
 */
export const getDigitTransitionSignal = (digits, threshold = DEFAULT_PATTERN_THRESHOLD) => {
    if (!Array.isArray(digits) || digits.length < 2) {
        return null;
    }

    const numeric_threshold = Math.max(1, Math.floor(Number(threshold)) || DEFAULT_PATTERN_THRESHOLD);
    const window_digits = digits
        .map(digit => Number(digit))
        .filter(digit => Number.isInteger(digit) && digit >= 0 && digit <= 9);

    if (window_digits.length < 2) {
        return null;
    }

    const current = window_digits[window_digits.length - 1];
    const counts = new Array(100).fill(0);

    for (let i = 1; i < window_digits.length; i++) {
        const from = window_digits[i - 1];
        const to = window_digits[i];
        counts[from * 10 + to] += 1;
    }

    // Find the strongest transition that ends on the current digit (…→current).
    let best_from = -1;
    let best_count = 0;

    for (let from = 0; from <= 9; from++) {
        const count = counts[from * 10 + current];
        if (count > best_count) {
            best_count = count;
            best_from = from;
        }
    }

    if (best_from < 0 || best_count < numeric_threshold) {
        return null;
    }

    return {
        from: best_from,
        to: current,
        count: best_count,
    };
};

/**
 * Returns the digit that initiated the strongest qualifying transition into the
 * current digit, or -1 when no pattern qualifies.
 * Example: strong 0→3 and current digit is 3 → returns 0 (place Differs on 0).
 * @param {Array<number|string>} digits
 * @param {number} threshold
 * @returns {number}
 */
export const getDigitTransitionPrediction = (digits, threshold = DEFAULT_PATTERN_THRESHOLD) => {
    const signal = getDigitTransitionSignal(digits, threshold);
    return signal ? signal.from : -1;
};
