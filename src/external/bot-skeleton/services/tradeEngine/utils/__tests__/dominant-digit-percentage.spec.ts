import {
    classifySignalStrength,
    detectDominantDigitPercentage,
    evaluateDominantDigitPercentage,
    normalizeDominantDigitPercentageOptions,
    resolveTargetDigit,
    TIE_HANDLING,
} from '../dominant-digit-percentage';

const makeWindow = (dominantDigit, dominantCount, total) => {
    const digits = [];
    for (let i = 0; i < dominantCount; i++) digits.push(dominantDigit);
    let fill = 0;
    while (digits.length < total) {
        const d = fill % 10;
        fill += 1;
        if (d === dominantDigit) continue;
        digits.push(d);
    }
    return digits.slice(0, total);
};

describe('normalizeDominantDigitPercentageOptions', () => {
    it('applies defaults', () => {
        const opts = normalizeDominantDigitPercentageOptions({});
        expect(opts.analysis_window).toBe(200);
        expect(opts.min_dominant_percent).toBe(15);
        expect(opts.tie_handling).toBe(TIE_HANDLING.REJECT);
        expect(opts.max_target_rank).toBe(1);
    });
});

describe('classifySignalStrength', () => {
    const opts = normalizeDominantDigitPercentageOptions({});

    it('classifies bands', () => {
        expect(classifySignalStrength(14, opts)).toBe('NO SIGNAL');
        expect(classifySignalStrength(15.5, opts)).toBe('WEAK');
        expect(classifySignalStrength(18, opts)).toBe('MODERATE');
        expect(classifySignalStrength(22, opts)).toBe('STRONG');
        expect(classifySignalStrength(26, opts)).toBe('VERY STRONG');
    });
});

describe('resolveTargetDigit', () => {
    it('rejects ties by default', () => {
        const ranked = [
            { digit: 3, percent: 15 },
            { digit: 7, percent: 15 },
            { digit: 1, percent: 10 },
        ];
        const result = resolveTargetDigit({
            ranked,
            options: normalizeDominantDigitPercentageOptions({}),
            short_window_result: { digit: -1, tied: false },
            state: { last_dominant: -1 },
        });
        expect(result.digit).toBe(-1);
        expect(result.reason).toBe('tie_rejected');
    });
});

describe('evaluateDominantDigitPercentage', () => {
    it('returns no signal while collecting', () => {
        const result = evaluateDominantDigitPercentage([1, 2, 3], {
            min_sample: 50,
            journal_enabled: false,
        });
        expect(result.matched).toBe(false);
        expect(result.prediction).toBe(-1);
    });

    it('signals DIFFER on dominant digit above threshold', () => {
        // 36/200 = 18% for digit 3
        const digits = makeWindow(3, 36, 200);
        const result = evaluateDominantDigitPercentage(digits, {
            analysis_window: 200,
            min_sample: 50,
            min_dominant_percent: 15,
            enable_dominance_gap: false,
            enable_persistence: false,
            enable_multi_window: false,
            journal_enabled: true,
        });
        expect(result.matched).toBe(true);
        expect(result.prediction).toBe(3);
        expect(result.dominant_percent).toBeGreaterThanOrEqual(15);
        expect(result.journal_messages.length).toBeGreaterThan(0);
    });

    it('blocks when below threshold', () => {
        const digits = makeWindow(7, 26, 200); // 13%
        const result = evaluateDominantDigitPercentage(digits, {
            analysis_window: 200,
            min_dominant_percent: 15,
            journal_enabled: false,
        });
        expect(result.matched).toBe(false);
        expect(result.prediction).toBe(-1);
    });

    it('requires dominance gap when enabled', () => {
        // Build nearly tied top two: digit 3 at 18%, digit 6 at 16.5% → gap 1.5 < 3
        const digits = [];
        for (let i = 0; i < 36; i++) digits.push(3);
        for (let i = 0; i < 33; i++) digits.push(6);
        while (digits.length < 200) {
            const d = digits.length % 10;
            if (d === 3 || d === 6) {
                digits.push(1);
            } else {
                digits.push(d);
            }
        }
        const result = evaluateDominantDigitPercentage(digits.slice(0, 200), {
            analysis_window: 200,
            min_dominant_percent: 15,
            enable_dominance_gap: true,
            min_dominance_gap: 3,
            journal_enabled: false,
        });
        expect(result.analysis.dominance_gap).toBeLessThan(3);
        expect(result.matched).toBe(false);
    });

    it('tracks persistence across tip updates', () => {
        const state = { last_dominant: -1, persistence: 0, last_tip_fp: '' };
        const base = makeWindow(3, 40, 200);
        detectDominantDigitPercentage(base, { journal_enabled: false }, state);
        expect(state.last_dominant).toBe(3);
        detectDominantDigitPercentage([...base, 1], { journal_enabled: false }, state);
        expect(state.persistence).toBeGreaterThanOrEqual(1);
        detectDominantDigitPercentage([...base, 1, 2], {
            enable_persistence: true,
            min_persistence: 3,
            journal_enabled: false,
        }, state);
        // After enough same-dominant tips, persistence climbs
        expect(state.last_dominant).toBe(3);
    });
});
