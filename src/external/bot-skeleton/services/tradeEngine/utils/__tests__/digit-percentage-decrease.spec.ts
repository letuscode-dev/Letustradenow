import {
    createDigitPercentageDecreaseState,
    detectDigitPercentageDecrease,
    evaluateDigitPercentageDecrease,
    isDigitPercentageDecreaseSignalConsumed,
    makeDigitPercentageDecreaseSignalKey,
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
    it('collects until the analysis window is full', () => {
        const result = evaluateDigitPercentageDecrease(Array(999).fill(1), {
            analysis_window: 1000,
            journal_enabled: false,
        });
        expect(result.matched).toBe(false);
        expect(result.analysis.ready).toBe(false);
        expect(result.analysis.need).toBe(1000);
    });

    it('seeds baseline on first full window then signals on next tip decrease', () => {
        const state = createDigitPercentageDecreaseState();
        const windowDigits = Array(1000).fill(5);

        const baseline = evaluateDigitPercentageDecrease(windowDigits, {
            analysis_window: 1000,
            min_decrease: 0.1,
            journal_enabled: false,
        }, state);
        expect(baseline.matched).toBe(false);
        expect(baseline.analysis.reason).toBe('baseline_seeded');

        // Slide: drop one 5, add 7 → digit 5 falls by 0.1pp
        const next = [...windowDigits.slice(1), 7];
        const result = evaluateDigitPercentageDecrease(next, {
            analysis_window: 1000,
            min_decrease: 0.1,
            journal_enabled: true,
        }, state);

        expect(result.matched).toBe(true);
        expect(result.prediction).toBe(5);
        expect(result.drop).toBeCloseTo(0.1, 5);
    });

    it('re-evaluates on each new tip and keeps signal for the same tip', () => {
        const state = createDigitPercentageDecreaseState();
        const base = Array(1000).fill(3);
        evaluateDigitPercentageDecrease(base, { journal_enabled: false }, state);

        const tip1 = [...base.slice(1), 8];
        const first = evaluateDigitPercentageDecrease(tip1, { journal_enabled: false }, state);
        expect(first.matched).toBe(true);
        expect(first.prediction).toBe(3);

        const again = evaluateDigitPercentageDecrease(tip1, { journal_enabled: false }, state);
        expect(again.matched).toBe(true);
        expect(again.prediction).toBe(3);
    });

    it('does not signal when percentages are unchanged', () => {
        const state = createDigitPercentageDecreaseState();
        const base = Array(1000).fill(4);
        evaluateDigitPercentageDecrease(base, { journal_enabled: false }, state);
        const same = evaluateDigitPercentageDecrease([...base.slice(1), 4], {
            journal_enabled: false,
        }, state);
        expect(same.matched).toBe(false);
    });

    it('respects a higher min_decrease threshold', () => {
        const state = createDigitPercentageDecreaseState();
        const base = Array(1000).fill(2);
        detectDigitPercentageDecrease(base, { min_decrease: 0.5 }, state);
        const result = detectDigitPercentageDecrease([...base.slice(1), 9], {
            analysis_window: 1000,
            min_decrease: 0.5,
        }, state);
        expect(result.matched).toBe(false);
    });

    it('builds a stable consume key for the same tip signal', () => {
        const tip_fp = '1000:7';
        const result = { matched: true, prediction: 5, drop: 0.1 };
        const key = makeDigitPercentageDecreaseSignalKey(result, tip_fp);
        expect(key).toContain('5');
        expect(isDigitPercentageDecreaseSignalConsumed(result, tip_fp, key)).toBe(true);
        expect(isDigitPercentageDecreaseSignalConsumed(result, tip_fp, '')).toBe(false);
        expect(
            isDigitPercentageDecreaseSignalConsumed(result, '1001:8', key)
        ).toBe(false);
    });
});
