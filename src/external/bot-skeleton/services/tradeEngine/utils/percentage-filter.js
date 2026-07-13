/**
 * Percentage Filter — Digits Over 2 trade filter.
 *
 * Analyses the last 100 completed ticks. Winning digits for Over 2 are 3–9;
 * losing digits are 0–2. Over 2 percentage = (wins ÷ 100) × 100, which equals
 * the win count when the sample size is exactly 100.
 *
 * Trade only when the sample is full and percentage ≥ configured threshold.
 */

export const SAMPLE_SIZE = 100;
export const DEFAULT_THRESHOLD = 75;
export const OVER_BARRIER = 2;
/** Digits that win an Over 2 contract (strictly greater than 2). */
export const WINNING_DIGITS = new Set([3, 4, 5, 6, 7, 8, 9]);

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
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

/**
 * Take the newest `sample_size` valid last digits (oldest → newest).
 *
 * @param {Array<number|string>} digits
 * @param {number} sample_size
 * @returns {number[]}
 */
export const getLatestDigitSample = (digits, sample_size = SAMPLE_SIZE) => {
    if (!Array.isArray(digits) || digits.length === 0) {
        return [];
    }

    const cleaned = [];
    for (let i = 0; i < digits.length; i++) {
        const digit = Number(digits[i]);
        if (Number.isInteger(digit) && digit >= 0 && digit <= 9) {
            cleaned.push(digit);
        }
    }

    if (cleaned.length <= sample_size) {
        return cleaned;
    }

    return cleaned.slice(cleaned.length - sample_size);
};

/**
 * Count winning Over 2 digits (3–9) in a sample.
 *
 * @param {number[]} sample
 * @returns {number}
 */
export const countWinningDigits = sample => {
    if (!Array.isArray(sample) || sample.length === 0) {
        return 0;
    }

    let wins = 0;
    for (let i = 0; i < sample.length; i++) {
        if (WINNING_DIGITS.has(sample[i])) {
            wins += 1;
        }
    }
    return wins;
};

/**
 * @param {{
 *   status: 'collecting'|'passed'|'failed'|'disabled',
 *   percentage: number,
 *   threshold: number,
 *   tick_count: number,
 *   sample_size: number,
 * }} params
 * @returns {string}
 */
export const formatPercentageFilterJournalMessage = ({
    status,
    percentage,
    threshold,
    tick_count,
    sample_size,
}) => {
    if (status === 'disabled') {
        return 'Percentage Filter disabled. Trade allowed without threshold check.';
    }

    if (status === 'collecting') {
        return `Collecting tick history: ${tick_count}/${sample_size} ticks.`;
    }

    if (status === 'passed') {
        return `Over 2 condition passed: ${percentage}% ≥ ${threshold}%. Purchasing contract.`;
    }

    return `Over 2 condition failed: ${percentage}% < ${threshold}%. Waiting for the next tick.`;
};

/**
 * Evaluate the Over 2 percentage filter.
 *
 * @param {Array<number|string>} digits - last-digit sequence (oldest → newest)
 * @param {{ enabled?: boolean, threshold?: number, journal_enabled?: boolean, sample_size?: number }} options
 * @returns {{
 *   allowed: boolean,
 *   status: 'collecting'|'passed'|'failed'|'disabled',
 *   percentage: number,
 *   threshold: number,
 *   tick_count: number,
 *   sample_size: number,
 *   winning_count: number,
 *   enabled: boolean,
 *   journal_enabled: boolean,
 *   message: string,
 * }}
 */
export const evaluatePercentageFilter = (digits, options = {}) => {
    const enabled = toBool(options.enabled, true);
    const journal_enabled = toBool(options.journal_enabled, true);
    const threshold = toThreshold(options.threshold);
    let sample_size = Math.floor(Number(options.sample_size));
    if (!Number.isFinite(sample_size) || sample_size < 1) {
        sample_size = SAMPLE_SIZE;
    }

    const sample = getLatestDigitSample(digits, sample_size);
    const tick_count = sample.length;

    if (!enabled) {
        const message = formatPercentageFilterJournalMessage({
            status: 'disabled',
            percentage: 0,
            threshold,
            tick_count,
            sample_size,
        });
        return {
            allowed: true,
            status: 'disabled',
            percentage: 0,
            threshold,
            tick_count,
            sample_size,
            winning_count: 0,
            enabled: false,
            journal_enabled,
            message,
        };
    }

    if (tick_count < sample_size) {
        const message = formatPercentageFilterJournalMessage({
            status: 'collecting',
            percentage: 0,
            threshold,
            tick_count,
            sample_size,
        });
        return {
            allowed: false,
            status: 'collecting',
            percentage: 0,
            threshold,
            tick_count,
            sample_size,
            winning_count: 0,
            enabled: true,
            journal_enabled,
            message,
        };
    }

    const winning_count = countWinningDigits(sample);
    // With a fixed sample of 100, win count === percentage.
    const percentage = Math.round((winning_count / sample_size) * 100);
    const allowed = percentage >= threshold;
    const status = allowed ? 'passed' : 'failed';
    const message = formatPercentageFilterJournalMessage({
        status,
        percentage,
        threshold,
        tick_count,
        sample_size,
    });

    return {
        allowed,
        status,
        percentage,
        threshold,
        tick_count,
        sample_size,
        winning_count,
        enabled: true,
        journal_enabled,
        message,
    };
};
