/**
 * Digit percentage condition — Over / Under share of last N digits.
 *
 * Over digits: 5–9. Under digits: 0–4.
 * Passes when the selected group's share of the last `window` digits
 * is at least `threshold` percent.
 */

import { getLatestDigitSample } from './percentage-filter';

export const DEFAULT_THRESHOLD = 5;
export const DEFAULT_WINDOW = 100;
export const OVER_DIGITS = new Set([5, 6, 7, 8, 9]);
export const UNDER_DIGITS = new Set([0, 1, 2, 3, 4]);

const toDirection = value => {
    const normalized = String(value || 'OVER').toUpperCase();
    return normalized === 'UNDER' ? 'UNDER' : 'OVER';
};

const toThreshold = value => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = DEFAULT_THRESHOLD;
    }
    if (n < 0) {
        n = 0;
    }
    if (n > 100) {
        n = 100;
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
 * @returns {Set<number>}
 */
export const getDigitGroup = direction => (toDirection(direction) === 'UNDER' ? UNDER_DIGITS : OVER_DIGITS);

/**
 * @param {number[]} sample
 * @param {'OVER'|'UNDER'} direction
 * @returns {number}
 */
export const countGroupDigits = (sample, direction) => {
    if (!Array.isArray(sample) || sample.length === 0) {
        return 0;
    }
    const group = getDigitGroup(direction);
    let count = 0;
    for (let i = 0; i < sample.length; i++) {
        if (group.has(sample[i])) {
            count += 1;
        }
    }
    return count;
};

/**
 * @param {{
 *   status: 'collecting'|'passed'|'failed',
 *   direction: 'OVER'|'UNDER',
 *   percentage: number,
 *   threshold: number,
 *   tick_count: number,
 *   sample_size: number,
 * }} params
 * @returns {string}
 */
export const formatDigitPercentageJournalMessage = ({
    status,
    direction,
    percentage,
    threshold,
    tick_count,
    sample_size,
}) => {
    const label = direction === 'UNDER' ? 'Under' : 'Over';

    if (status === 'collecting') {
        return `${label} digit condition collecting ticks (${tick_count}/${sample_size}).`;
    }

    if (status === 'passed') {
        return `${label} ${percentage}% of last ${sample_size} digits ≥ ${threshold}%. Condition passed.`;
    }

    return `${label} ${percentage}% of last ${sample_size} digits < ${threshold}%. Condition failed.`;
};

/**
 * @param {Array<number|string>} digits
 * @param {{ direction?: string, threshold?: number, sample_size?: number, journal_enabled?: boolean }} options
 */
export const evaluateDigitPercentageCondition = (digits, options = {}) => {
    const direction = toDirection(options.direction);
    const threshold = toThreshold(options.threshold);
    const sample_size = toWindow(options.sample_size);
    const journal_enabled =
        options.journal_enabled === undefined || options.journal_enabled === null
            ? true
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
            percentage: 0,
            threshold,
            tick_count,
            sample_size,
        });
        return {
            allowed: false,
            status: 'collecting',
            direction,
            percentage: 0,
            threshold,
            tick_count,
            sample_size,
            matching_count: 0,
            journal_enabled,
            message,
        };
    }

    const matching_count = countGroupDigits(sample, direction);
    const percentage = Math.round((matching_count / sample_size) * 100);
    const allowed = percentage >= threshold;
    const status = allowed ? 'passed' : 'failed';
    const message = formatDigitPercentageJournalMessage({
        status,
        direction,
        percentage,
        threshold,
        tick_count,
        sample_size,
    });

    return {
        allowed,
        status,
        direction,
        percentage,
        threshold,
        tick_count,
        sample_size,
        matching_count,
        journal_enabled,
        message,
    };
};
