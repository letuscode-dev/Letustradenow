/**
 * Digit frequency analysis — least/most frequent last digit in a sliding window.
 */

import {
    getSlidingDigitWindow,
    clampDigitPercentageWindow,
    MAX_WINDOW,
} from './digit-percentage-condition';

export const ANALYSIS_LEAST_FREQUENT = 'LEAST_FREQUENT';
export const ANALYSIS_MOST_FREQUENT = 'MOST_FREQUENT';

/**
 * @param {string|undefined} value
 * @returns {'LEAST_FREQUENT'|'MOST_FREQUENT'}
 */
export const normalizeDigitFrequencyType = value => {
    const normalized = String(value || ANALYSIS_LEAST_FREQUENT).toUpperCase();
    return normalized === ANALYSIS_MOST_FREQUENT ? ANALYSIS_MOST_FREQUENT : ANALYSIS_LEAST_FREQUENT;
};

/**
 * @param {Array<number|string>} digits - oldest → newest
 * @param {number} sample_size
 * @param {string} analysis_type
 * @returns {number} digit 0–9, or -1 when the window is not full yet
 */
export const analyzeDigitFrequency = (digits, sample_size, analysis_type) => {
    const window_size = clampDigitPercentageWindow(sample_size);
    const sample = getSlidingDigitWindow(digits || [], window_size);
    if (sample.length < window_size) {
        return -1;
    }

    const counts = Array(10).fill(0);
    for (let i = 0; i < sample.length; i++) {
        counts[sample[i]] += 1;
    }

    const type = normalizeDigitFrequencyType(analysis_type);
    if (type === ANALYSIS_MOST_FREQUENT) {
        return counts.reduce((best, count, index) => (count > counts[best] ? index : best), 0);
    }
    return counts.reduce((best, count, index) => (count < counts[best] ? index : best), 0);
};

/** Even/Odd frequency scan default. Matches the Deriv tick-history depth. */
export const EVEN_ODD_DEFAULT_WINDOW = MAX_WINDOW;

/** 0 = trade Even, 1 = trade Odd. */
export const EVEN_ODD_SIDE_EVEN = 0;
export const EVEN_ODD_SIDE_ODD = 1;

const EVEN_DIGITS = [0, 2, 4, 6, 8];
const ODD_DIGITS = [1, 3, 5, 7, 9];

/**
 * Window for the Even/Odd scan. Missing or invalid values use 1,000 ticks.
 * @param {number} value
 * @returns {number}
 */
export const clampEvenOddWindow = value => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) {
        n = EVEN_ODD_DEFAULT_WINDOW;
    }
    if (n > MAX_WINDOW) {
        n = MAX_WINDOW;
    }
    return n;
};

const leastInGroup = (counts, group) =>
    group.reduce((best, digit) => (counts[digit] < counts[best] ? digit : best), group[0]);

/**
 * Even/Odd signal from last-digit frequency.
 *
 * The most frequent digit chooses the opposite contract: even → Odd, odd → Even.
 * The entry digit is the least frequent digit in the same even or odd group as
 * that dominant digit. Ties keep the lower digit.
 *
 * @param {Array<number|string>} digits - oldest → newest
 * @param {number} sample_size
 * @returns {{ ready: boolean, dominant: number, entry: number, side: number }}
 */
export const analyzeEvenOddParity = (digits, sample_size) => {
    const empty = { ready: false, dominant: -1, entry: -1, side: -1 };
    const window_size = clampEvenOddWindow(sample_size);
    const sample = getSlidingDigitWindow(digits || [], window_size);
    if (sample.length < window_size) {
        return empty;
    }

    const counts = Array(10).fill(0);
    for (let i = 0; i < sample.length; i++) {
        counts[sample[i]] += 1;
    }

    const dominant = counts.reduce((best, count, index) => (count > counts[best] ? index : best), 0);
    const dominant_is_even = dominant % 2 === 0;

    return {
        ready: true,
        dominant,
        entry: leastInGroup(counts, dominant_is_even ? EVEN_DIGITS : ODD_DIGITS),
        side: dominant_is_even ? EVEN_ODD_SIDE_ODD : EVEN_ODD_SIDE_EVEN,
    };
};
