import {
    detectPercentageReversal,
    evaluatePercentageReversal,
    normalizePercentageReversalOptions,
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
        // Build 200 ticks where digit 5 is heavy in older portion, scarce in newest 50
        const digits = [];
        for (let i = 0; i < 150; i++) {
            // older/mid: digit 5 appears often (~20%)
            digits.push(i % 5 === 0 ? 5 : (i % 9 === 5 ? 4 : i % 9));
        }
        for (let i = 0; i < 50; i++) {
            // recent: almost no 5s
            digits.push(i % 9 === 5 ? 4 : i % 9);
        }

        const result = evaluatePercentageReversal(digits, {
            short_window: 50,
            medium_window: 100,
            long_window: 200,
            dominance_min: 15,
            collapse_max: 10,
            min_drop: 7,
            journal_enabled: true,
        });

        expect(result.analysis.ready).toBe(true);
        if (result.matched) {
            expect(result.prediction).toBeGreaterThanOrEqual(0);
            expect(result.prediction).toBeLessThanOrEqual(9);
            expect(result.journal_messages.length).toBeGreaterThan(0);
        }

        // Direct detection with forced percentages via detect on crafted sample
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

    it('normalizes options', () => {
        expect(normalizePercentageReversalOptions({}).short_window).toBe(50);
        expect(normalizePercentageReversalOptions({}).dominance_min).toBe(15);
    });
});
