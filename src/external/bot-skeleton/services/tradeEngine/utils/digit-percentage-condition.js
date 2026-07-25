/**
 * Digit percentage value — Over / Under share of last N digits vs a barrier.
 *
 * Over barrier B → digits strictly greater than B (e.g. Over 5 → 6–9)
 * Under barrier B → digits strictly less than B (e.g. Under 4 → 0–3)
 *
 * Returns the percentage (0–100) of matching digits in the newest window.
 */

import { getLatestDigitSample } from './percentage-filter';

export const DEFAULT_BARRIER = 5;
export const DEFAULT_WINDOW = 100;

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
    if (n > 5000) {
        n = 5000;
    }
    return n;
};

/**
 * @param {'OVER'|'UNDER'} direction
 * @param {number} barrier
 * @param {number} digit
 * @returns {boolean}
 */
export const digitMatchesDirection = (direction, barrier, digit) => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
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
 * @returns {{
 *   percentage: number,
 *   status: 'collecting'|'ready',
 *   direction: 'OVER'|'UNDER',
 *   barrier: number,
 *   tick_count: number,
 *   sample_size: number,
 *   matching_count: number,
 *   journal_enabled: boolean,
 *   message: string,
 * }}
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

    const sample = getLatestDigitSample(digits, sample_size);
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
