import {
    detectPercentageReversal,
    evaluatePercentageReversal,
    evaluateSymbolPercentageReversal,
    normalizePercentageReversalOptions,
    pickBestPercentageReversalMatch,
    resolveScanSymbols,
    scoreDigitReversal,
} from '../percentage-reversal';

describe('scoreDigitReversal', () => {
    const options = normalizePercentageReversalOptions({});

    it('matches dominance collapsing into underrepresentation', () => {
        // Example: 200→17%, 100→20%, 50→8%
        const row = scoreDigitReversal(5, 8, 20, 17, options);
        expect(row.matched).toBe(true);
        expect(row.drop).toBe(12);
        expect(row.status).toBe('DOMINANCE → COLLAPSE');
    });

    it('rejects stable high percentage', () => {
        const row = scoreDigitReversal(5, 18, 19, 17, options);
        expect(row.matched).toBe(false);
    });

    it('rejects collapse without prior dominance', () => {
        const row = scoreDigitReversal(3, 5, 11, 10, options);
        expect(row.matched).toBe(false);
    });
});

describe('evaluatePercentageReversal', () => {
    it('returns NO SIGNAL while collecting', () => {
        const result = evaluatePercentageReversal([1, 2, 3], { journal_enabled: false });
        expect(result.matched).toBe(false);
        expect(result.prediction).toBe(-1);
    });

    it('signals Differ on the collapsing dominant digit', () => {
        const forced = Array.from({ length: 200 }, (_, i) => {
            if (i < 150) return i % 5 === 0 ? 7 : 1;
            return 1; // last 50: no 7s
        });
        const check = detectPercentageReversal(forced, {
            dominance_min: 15,
            collapse_max: 10,
            min_drop: 7,
            journal_enabled: false,
        });
        const row7 = check.digit_rows[7];
        expect(row7.long_pct).toBeGreaterThanOrEqual(15);
        expect(row7.short_pct).toBe(0);
        expect(check.matched).toBe(true);
        expect(check.prediction).toBe(7);
    });

    it('normalizes options including switch_symbol', () => {
        expect(normalizePercentageReversalOptions({}).short_window).toBe(50);
        expect(normalizePercentageReversalOptions({}).dominance_min).toBe(15);
        expect(normalizePercentageReversalOptions({}).switch_symbol).toBe(true);
    });

    it('resolves explicit Selected Symbols for multi-market scan', () => {
        expect(resolveScanSymbols({ symbols: '1HZ50V, R_10, R_25' })).toEqual([
            '1HZ50V',
            'R_10',
            'R_25',
        ]);
    });

    it('picks the strongest collapse across symbols', () => {
        const forcedStrong = Array.from({ length: 200 }, (_, i) => {
            if (i < 150) return i % 5 === 0 ? 7 : 1;
            return 1;
        });
        const weak = Array.from({ length: 200 }, () => 1);
        const a = evaluateSymbolPercentageReversal('R_10', forcedStrong, {
            dominance_min: 15,
            collapse_max: 10,
            min_drop: 7,
        });
        const b = evaluateSymbolPercentageReversal('R_25', weak, {
            dominance_min: 15,
            collapse_max: 10,
            min_drop: 7,
        });
        expect(a.matched).toBe(true);
        expect(b.matched).toBe(false);
        const best = pickBestPercentageReversalMatch([b, a]);
        expect(best?.symbol).toBe('R_10');
        expect(best?.prediction).toBe(7);
    });
});
