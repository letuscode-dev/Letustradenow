/**
 * Digit percentage value — Over / Under share of last N digits vs a barrier.
 *
 * Sliding window (required behaviour):
 *   Keep only the newest N digits. When a new digit arrives, the oldest digit
 *   in that window is removed and the new digit is appended.
 *
 * Over barrier B → digits strictly greater than B (e.g. Over 5 → 6–9)
 * Under barrier B → digits strictly less than B (e.g. Under 4 → 0–3)
 *
 * Returns the integer percentage (0–100) of matching digits in the window.
 * Window size N is user-configurable (default 100 only when missing). Soft-capped
 * at MAX_WINDOW to match Deriv live tick history depth — never hard-capped at 100.
 */

export const DEFAULT_BARRIER = 5;
export const DEFAULT_WINDOW = 100;
/** Matches ticks_service requestTicks `count: 1000`. */
export const MAX_WINDOW = 1000;

const toDirection = value => {
    const normalized = String(value || 'OVER').toUpperCase();
    return normalized === 'UNDER' ? 'UNDER' : 'OVER';
};

const toBarrier = value => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = DEFAULT_BARRIER;
    }
    if (n < 0) {
        n = 0;
    }
    if (n > 9) {
        n = 9;
    }
    return n;
};

const toWindow = value => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) {
        n = DEFAULT_WINDOW;
    }
    if (n > MAX_WINDOW) {
        n = MAX_WINDOW;
    }
    return n;
};

/** Public clamp for runtime callers (BotInterface / generators). */
export const clampDigitPercentageWindow = value => toWindow(value);

const isValidDigit = digit => Number.isInteger(digit) && digit >= 0 && digit <= 9;

/**
 * Build / refresh a sliding window of the newest `window_size` valid digits.
 * Equivalent to: drop everything older than the last N digits.
 *
 * @param {Array<number|string>} digits - oldest → newest
 * @param {number} window_size
 * @returns {number[]}
 */
export const getSlidingDigitWindow = (digits, window_size = DEFAULT_WINDOW) => {
    const size = toWindow(window_size);
    if (!Array.isArray(digits) || digits.length === 0) {
        return [];
    }

    // Scan newest → oldest and stop once we have N valid digits.
    // Callers typically pass only the last N ticks already, but this stays O(N).
    const cleaned = [];
    for (let i = digits.length - 1; i >= 0 && cleaned.length < size; i--) {
        const digit = Number(digits[i]);
        if (isValidDigit(digit)) {
            cleaned.push(digit);
        }
    }

    cleaned.reverse();
    return cleaned;
};

/**
 * Advance a sliding window by one digit: remove the oldest when full, then append.
 *
 * @param {number[]} window
 * @param {number} next_digit
 * @param {number} window_size
 * @returns {number[]}
 */
export const appendToSlidingDigitWindow = (window, next_digit, window_size = DEFAULT_WINDOW) => {
    const size = toWindow(window_size);
    const digit = Number(next_digit);
    if (!isValidDigit(digit)) {
        return Array.isArray(window) ? window.slice() : [];
    }

    const next = Array.isArray(window) ? window.slice() : [];
    next.push(digit);
    if (next.length > size) {
        // Drop the oldest digit(s) so the window stays at most N.
        return next.slice(next.length - size);
    }
    return next;
};

/**
 * @param {'OVER'|'UNDER'} direction
 * @param {number} barrier
 * @param {number} digit
 * @returns {boolean}
 */
export const digitMatchesDirection = (direction, barrier, digit) => {
    if (!isValidDigit(digit)) {
        return false;
    }
    if (toDirection(direction) === 'UNDER') {
        return digit < barrier;
    }
    return digit > barrier;
};

/**
 * @param {number[]} sample
 * @param {'OVER'|'UNDER'} direction
 * @param {number} barrier
 * @returns {number}
 */
export const countMatchingDigits = (sample, direction, barrier) => {
    if (!Array.isArray(sample) || sample.length === 0) {
        return 0;
    }
    let count = 0;
    for (let i = 0; i < sample.length; i++) {
        if (digitMatchesDirection(direction, barrier, sample[i])) {
            count += 1;
        }
    }
    return count;
};

/**
 * @param {{
 *   status: 'collecting'|'ready',
 *   direction: 'OVER'|'UNDER',
 *   barrier: number,
 *   percentage: number,
 *   tick_count: number,
 *   sample_size: number,
 * }} params
 * @returns {string}
 */
export const formatDigitPercentageJournalMessage = ({
    status,
    direction,
    barrier,
    percentage,
    tick_count,
    sample_size,
}) => {
    const label = direction === 'UNDER' ? 'Under' : 'Over';

    if (status === 'collecting') {
        return `${label} ${barrier}: collecting ticks (${tick_count}/${sample_size}).`;
    }

    return `${label} ${barrier}: ${percentage}% of last ${sample_size} digits.`;
};

/**
 * @param {Array<number|string>} digits
 * @param {{ direction?: string, barrier?: number, sample_size?: number, journal_enabled?: boolean }} options
 */
export const evaluateDigitPercentageCondition = (digits, options = {}) => {
    const direction = toDirection(options.direction);
    const barrier = toBarrier(options.barrier ?? options.threshold);
    const sample_size = toWindow(options.sample_size);
    const journal_enabled =
        options.journal_enabled === undefined || options.journal_enabled === null
            ? false
            : options.journal_enabled === true ||
              options.journal_enabled === 1 ||
              options.journal_enabled === 'TRUE' ||
              options.journal_enabled === 'true';

    // Always the newest N digits — oldest falls off as the series grows.
    const sample = getSlidingDigitWindow(digits, sample_size);
    const tick_count = sample.length;

    if (tick_count < sample_size) {
        const message = formatDigitPercentageJournalMessage({
            status: 'collecting',
            direction,
            barrier,
            percentage: 0,
            tick_count,
            sample_size,
        });
        return {
            percentage: 0,
            status: 'collecting',
            direction,
            barrier,
            tick_count,
            sample_size,
            matching_count: 0,
            journal_enabled,
            message,
        };
    }

    const matching_count = countMatchingDigits(sample, direction, barrier);
    const percentage = Math.round((matching_count / sample_size) * 100);
    const message = formatDigitPercentageJournalMessage({
        status: 'ready',
        direction,
        barrier,
        percentage,
        tick_count,
        sample_size,
    });

    return {
        percentage,
        status: 'ready',
        direction,
        barrier,
        tick_count,
        sample_size,
        matching_count,
        journal_enabled,
        message,
    };
};

/**
 * Convenience helper for the bot runtime — always a finite number 0–100.
 *
 * @param {Array<number|string>} digits
 * @param {{ direction?: string, barrier?: number, sample_size?: number }} options
 * @returns {number}
 */
export const getDigitPercentageValue = (digits, options = {}) => {
    const result = evaluateDigitPercentageCondition(digits, options);
    const percentage = Number(result.percentage);
    return Number.isFinite(percentage) ? percentage : 0;
};
