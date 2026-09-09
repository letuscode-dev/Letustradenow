/**
 * Digit frequency analysis — least/most frequent last digit in a sliding window.
 */

import { getSlidingDigitWindow, clampDigitPercentageWindow } from './digit-percentage-condition';

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
