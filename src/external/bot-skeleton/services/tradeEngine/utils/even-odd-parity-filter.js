/**
 * Reusable even/odd parity filter for Digit Differs strategies.
 */

export const FILTER_MODE_MATCHING = 0;
export const FILTER_MODE_OPPOSITE = 1;
export const FILTER_MODE_ANY_IMBALANCE = 2;

export const THRESHOLD_COUNT = 0;
export const THRESHOLD_PERCENT = 1;

export const EVEN_DIGITS = [0, 2, 4, 6, 8];
export const ODD_DIGITS = [1, 3, 5, 7, 9];

export const isEvenDigit = digit => Number(digit) % 2 === 0;

export const getDigitParity = digit => (isEvenDigit(digit) ? 'even' : 'odd');

export const getParityLabel = parity => (parity === 'even' ? 'Even' : 'Odd');

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

export const normalizeParityFilterOptions = (options = {}) => {
    const filter_mode = toInt(options.filter_mode, FILTER_MODE_MATCHING, 0);
    const threshold_type = toInt(options.threshold_type, THRESHOLD_COUNT, 0);

    return {
        filter_enabled: options.filter_enabled !== false && options.filter_enabled !== 0,
        parity_window: Math.max(1, toInt(options.parity_window ?? options.analysis_window, 10, 1)),
        filter_mode,
        threshold_type,
        matching_parity_count: Math.max(1, toInt(options.matching_parity_count, 7, 1)),
        matching_parity_percent: Math.min(
            100,
            Math.max(1, toInt(options.matching_parity_percent, 70, 1))
        ),
    };
};

/**
 * @param {number[]} digits
 * @param {number} window_size
 */
export const analyzeParityWindow = (digits, window_size) => {
    const window = Math.max(1, window_size);
    const slice = Array.isArray(digits) ? digits.slice(-window) : [];
    let even_count = 0;
    let odd_count = 0;

    for (let i = 0; i < slice.length; i++) {
        const digit = Number(slice[i]);
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            continue;
        }
        if (isEvenDigit(digit)) {
            even_count += 1;
        } else {
            odd_count += 1;
        }
    }

    const total = even_count + odd_count;
    const even_percent = total > 0 ? (even_count / total) * 100 : 0;
    const odd_percent = total > 0 ? (odd_count / total) * 100 : 0;

    return {
        even_count,
        odd_count,
        even_percent,
        odd_percent,
        total,
    };
};

const passesThreshold = (actual_count, actual_percent, required_count, required_percent, threshold_type, window_size) => {
    if (threshold_type === THRESHOLD_PERCENT) {
        return actual_percent >= required_percent;
    }
    return actual_count >= required_count;
};

/**
 * @param {number} target_digit
 * @param {ReturnType<typeof analyzeParityWindow>} stats
 * @param {ReturnType<typeof normalizeParityFilterOptions>} options
 */
export const evaluateParityFilter = (target_digit, stats, options) => {
    const parity = getDigitParity(target_digit);
    const mode = options.filter_mode;
    const threshold_type = options.threshold_type;
    const required_count = Math.min(options.matching_parity_count, options.parity_window);
    const required_percent = options.matching_parity_percent;

    let relevant_count = 0;
    let relevant_percent = 0;
    let opposite_count = 0;
    let opposite_percent = 0;
    let mode_label = 'Matching-Parity Dominance';

    if (parity === 'even') {
        relevant_count = stats.even_count;
        relevant_percent = stats.even_percent;
        opposite_count = stats.odd_count;
        opposite_percent = stats.odd_percent;
    } else {
        relevant_count = stats.odd_count;
        relevant_percent = stats.odd_percent;
        opposite_count = stats.even_count;
        opposite_percent = stats.even_percent;
    }

    let passed = false;
    let dominance_percent = relevant_percent;

    if (mode === FILTER_MODE_MATCHING) {
        mode_label = 'Matching-Parity Dominance';
        passed = passesThreshold(
            relevant_count,
            relevant_percent,
            required_count,
            required_percent,
            threshold_type,
            options.parity_window
        );
        dominance_percent = relevant_percent;
    } else if (mode === FILTER_MODE_OPPOSITE) {
        mode_label = 'Opposite-Parity Dominance';
        passed = passesThreshold(
            opposite_count,
            opposite_percent,
            required_count,
            required_percent,
            threshold_type,
            options.parity_window
        );
        dominance_percent = opposite_percent;
    } else {
        mode_label = 'Any Strong Imbalance';
        const dominant_count = Math.max(stats.even_count, stats.odd_count);
        const dominant_percent = Math.max(stats.even_percent, stats.odd_percent);
        passed = passesThreshold(
            dominant_count,
            dominant_percent,
            required_count,
            required_percent,
            threshold_type,
            options.parity_window
        );
        dominance_percent = dominant_percent;
    }

    const required_label =
        threshold_type === THRESHOLD_PERCENT
            ? `${required_percent}%`
            : `${required_count}`;

    return {
        passed,
        parity,
        parity_label: getParityLabel(parity),
        mode_label,
        required_label,
        relevant_count,
        relevant_percent,
        opposite_count,
        opposite_percent,
        dominance_percent,
        stats,
    };
};

export const formatParityDashboard = ({
    options,
    stats,
    target_digit = -1,
    target_parity = '',
    filter_result = null,
    primary_source = '',
    signal_age = 0,
    confirmation_count = 0,
    required_confirmations = 1,
    trade_status = 'Idle',
}) => {
    const lines = [
        `Analysis window: ${options.parity_window}`,
        '',
        `Even count: ${stats.even_count}`,
        `Odd count: ${stats.odd_count}`,
        '',
        `Even percentage: ${Math.round(stats.even_percent)}%`,
        `Odd percentage: ${Math.round(stats.odd_percent)}%`,
        '',
        `Target digit: ${target_digit >= 0 ? target_digit : '—'}`,
        `Target parity: ${target_parity || '—'}`,
        '',
        `Required threshold: ${filter_result?.required_label ?? '—'}`,
        `Filter status: ${filter_result?.passed ? 'Passed' : filter_result ? 'Failed' : '—'}`,
        '',
        `Primary signal source: ${primary_source || '—'}`,
        `Signal age: ${signal_age}`,
        `Confirmation count: ${confirmation_count} / ${required_confirmations}`,
        `Trade status: ${trade_status}`,
    ];
    return lines.join('\n');
};
