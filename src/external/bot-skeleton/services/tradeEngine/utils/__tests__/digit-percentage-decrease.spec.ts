import {
    detectDigitPercentageDecrease,
    evaluateDigitPercentageDecrease,
    normalizeDigitPercentageDecreaseOptions,
} from '../digit-percentage-decrease';

describe('normalizeDigitPercentageDecreaseOptions', () => {
    it('defaults to 1000-tick window and 0.1pp decrease', () => {
        const opts = normalizeDigitPercentageDecreaseOptions({});
        expect(opts.analysis_window).toBe(1000);
        expect(opts.min_decrease).toBe(0.1);
    });
});

describe('evaluateDigitPercentageDecrease', () => {
    it('collects until window+1 ticks', () => {
        const result = evaluateDigitPercentageDecrease(Array(1000).fill(1), {
            journal_enabled: false,
        });
        expect(result.matched).toBe(false);
        expect(result.analysis.ready).toBe(false);
    });

    it('signals Differ on the digit that aged out (0.1pp drop on 1000 window)', () => {
        // 1000 ticks of digit 5, then tip 7 → digit 5 drops by 0.1%
        const digits = [...Array(1000).fill(5), 7];
        const result = evaluateDigitPercentageDecrease(digits, {
            analysis_window: 1000,
            min_decrease: 0.1,
            journal_enabled: true,
        });
        expect(result.matched).toBe(true);
        expect(result.prediction).toBe(5);
        expect(result.drop).toBeCloseTo(0.1, 5);
        expect(result.aged_out).toBe(5);
        expect(result.aged_in).toBe(7);
    });

    it('does not signal when the same digit rolls through', () => {
        const digits = [...Array(1000).fill(4), 4];
        const result = evaluateDigitPercentageDecrease(digits, {
            analysis_window: 1000,
            min_decrease: 0.1,
            journal_enabled: false,
        });
        expect(result.matched).toBe(false);
        expect(result.prediction).toBe(-1);
    });

    it('respects a higher min_decrease threshold', () => {
        const digits = [...Array(1000).fill(2), 9];
        const result = detectDigitPercentageDecrease(digits, {
            analysis_window: 1000,
            min_decrease: 0.5,
            journal_enabled: false,
        });
        expect(result.matched).toBe(false);
    });
});
