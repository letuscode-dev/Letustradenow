/**
 * Over 0 Gap Filter — trade filter (not a prediction).
 *
 * Gap = consecutive non-zero last digits (1–9) since the most recent digit 0.
 * Resets to 0 whenever a 0 appears. Never negative.
 *
 * Example: 0,7,5,2,8,4,0,9,6 → gaps 0,1,2,3,4,5,0,1,2
 */

export const DEFAULT_MIN_GAP = 3;
export const DEFAULT_MAX_GAP = 10;
export const DEFAULT_GAP_HISTORY = 500;

/**
 * Compute the current zero-gap from a last-digit sequence (oldest → newest).
 * Scans from the newest tick backward until a 0 (or start of history).
 *
 * @param {Array<number|string>} digits
 * @returns {number} gap >= 0
 */
export const getCurrentZeroGap = digits => {
    if (!Array.isArray(digits) || digits.length === 0) {
        return 0;
    }

    let gap = 0;

    for (let i = digits.length - 1; i >= 0; i--) {
        const digit = Number(digits[i]);

        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            continue;
        }

        // Digit 0 resets the gap immediately.
        if (digit === 0) {
            break;
        }

        gap += 1;
    }

    return gap;
};

/**
 * Build the journal message for a gap-filter evaluation.
 *
 * @param {{ allowed: boolean, gap: number, min_gap: number, max_gap: number }} params
 * @returns {string}
 */
export const formatGapFilterJournalMessage = ({ allowed, gap, min_gap, max_gap }) => {
    if (allowed) {
        return [
            'Gap Filter PASSED',
            `Current Gap: ${gap}`,
            `Allowed Range: ${min_gap}–${max_gap}`,
            'Trade Allowed',
        ].join('\n');
    }

    if (gap < min_gap) {
        return [
            'Gap Filter FAILED',
            `Current Gap: ${gap}`,
            `Minimum Required: ${min_gap}`,
            'Trade Blocked',
        ].join('\n');
    }

    return [
        'Gap Filter FAILED',
        `Current Gap: ${gap}`,
        `Maximum Allowed: ${max_gap}`,
        'Trade Blocked',
    ].join('\n');
};

/**
 * Evaluate the Over 0 gap filter for the latest digit window.
 *
 * When `enabled` is false, the trade is always allowed (filter ignored).
 *
 * @param {Array<number|string>} digits - last-digit sequence (oldest → newest)
 * @param {{ enabled?: boolean, min_gap?: number, max_gap?: number, journal_enabled?: boolean }} options
 * @returns {{ allowed: boolean, gap: number, min_gap: number, max_gap: number, enabled: boolean, journal_enabled: boolean, message: string }}
 */
export const evaluateOverZeroGapFilter = (digits, options = {}) => {
    const enabled = options.enabled !== false && options.enabled !== 0 && options.enabled !== 'FALSE';
    const journal_enabled =
        options.journal_enabled === true ||
        options.journal_enabled === 1 ||
        options.journal_enabled === 'TRUE';

    let min_gap = Math.floor(Number(options.min_gap));
    let max_gap = Math.floor(Number(options.max_gap));

    if (!Number.isFinite(min_gap) || min_gap < 0) {
        min_gap = DEFAULT_MIN_GAP;
    }
    if (!Number.isFinite(max_gap) || max_gap < 0) {
        max_gap = DEFAULT_MAX_GAP;
    }
    if (max_gap < min_gap) {
        max_gap = min_gap;
    }

    const gap = getCurrentZeroGap(digits);

    // Filter off → allow normal Over 0 strategy.
    const allowed = !enabled || (gap >= min_gap && gap <= max_gap);

    const message = formatGapFilterJournalMessage({ allowed, gap, min_gap, max_gap });

    return {
        allowed,
        gap,
        min_gap,
        max_gap,
        enabled: !!enabled,
        journal_enabled,
        message,
    };
};
