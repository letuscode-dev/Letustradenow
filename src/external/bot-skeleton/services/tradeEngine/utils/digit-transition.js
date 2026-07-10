/**
 * Digit-pair transition analysis over a rolling last-digit window.
 * Counts from→to transitions and returns the strongest pattern for the
 * current last digit when its frequency meets the threshold.
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

    let best_to = -1;
    let best_count = 0;

    for (let to = 0; to <= 9; to++) {
        const count = counts[current * 10 + to];
        if (count > best_count) {
            best_count = count;
            best_to = to;
        }
    }

    if (best_to < 0 || best_count < numeric_threshold) {
        return null;
    }

    return {
        from: current,
        to: best_to,
        count: best_count,
    };
};

/**
 * Returns the predicted "next" digit for Differs, or -1 when no pattern qualifies.
 * @param {Array<number|string>} digits
 * @param {number} threshold
 * @returns {number}
 */
export const getDigitTransitionPrediction = (digits, threshold = DEFAULT_PATTERN_THRESHOLD) => {
    const signal = getDigitTransitionSignal(digits, threshold);
    return signal ? signal.to : -1;
};
