import {
    evaluateOverZeroGapFilter,
    formatGapFilterJournalMessage,
    getCurrentZeroGap,
} from '../gap-filter';

describe('getCurrentZeroGap', () => {
    it('returns 0 for empty input', () => {
        expect(getCurrentZeroGap([])).toBe(0);
        expect(getCurrentZeroGap(null)).toBe(0);
    });

    it('resets to 0 when the latest digit is 0', () => {
        expect(getCurrentZeroGap([1, 2, 0])).toBe(0);
    });

    it('counts consecutive non-zeros since the last 0', () => {
        // Spec example: 0,7,5,2,8,4,0,9,6 → gap 2
        expect(getCurrentZeroGap([0, 7, 5, 2, 8, 4, 0, 9, 6])).toBe(2);
        expect(getCurrentZeroGap([0, 7, 5, 2, 8, 4])).toBe(5);
    });

    it('never returns a negative gap', () => {
        expect(getCurrentZeroGap([3, 4, 5])).toBe(3);
    });
});

describe('evaluateOverZeroGapFilter', () => {
    const digits = [0, 7, 5, 2, 8, 4]; // gap = 5

    it('allows trades when the filter is disabled', () => {
        const result = evaluateOverZeroGapFilter(digits, {
            enabled: false,
            min_gap: 10,
            max_gap: 20,
        });
        expect(result.allowed).toBe(true);
        expect(result.gap).toBe(5);
    });

    it('allows trades when gap is within range', () => {
        const result = evaluateOverZeroGapFilter(digits, {
            enabled: true,
            min_gap: 3,
            max_gap: 10,
            journal_enabled: true,
        });
        expect(result.allowed).toBe(true);
        expect(result.message).toContain('Gap Filter PASSED');
        expect(result.message).toContain('Trade Allowed');
    });

    it('blocks when gap is below minimum', () => {
        const result = evaluateOverZeroGapFilter([0, 9], {
            enabled: true,
            min_gap: 3,
            max_gap: 10,
        });
        expect(result.allowed).toBe(false);
        expect(result.message).toContain('Minimum Required: 3');
        expect(result.message).toContain('Trade Blocked');
    });

    it('blocks when gap exceeds maximum', () => {
        // 14 consecutive non-zeros after the last 0
        const result = evaluateOverZeroGapFilter([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5], {
            enabled: true,
            min_gap: 3,
            max_gap: 10,
        });
        expect(result.allowed).toBe(false);
        expect(result.gap).toBe(14);
        expect(result.message).toContain('Maximum Allowed: 10');
    });
});

describe('formatGapFilterJournalMessage', () => {
    it('formats a pass message', () => {
        expect(
            formatGapFilterJournalMessage({ allowed: true, gap: 6, min_gap: 3, max_gap: 10 })
        ).toBe('Gap Filter PASSED\nCurrent Gap: 6\nAllowed Range: 3–10\nTrade Allowed');
    });
});
