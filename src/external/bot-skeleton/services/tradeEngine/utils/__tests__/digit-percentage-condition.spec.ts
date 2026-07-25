import {
    DEFAULT_WINDOW,
    MAX_WINDOW,
    countMatchingDigits,
    digitMatchesDirection,
    evaluateDigitPercentageCondition,
    getDigitPercentageValue,
} from '../digit-percentage-condition';

describe('digitMatchesDirection', () => {
    it('matches Over as strictly greater than the barrier', () => {
        expect(digitMatchesDirection('OVER', 5, 6)).toBe(true);
        expect(digitMatchesDirection('OVER', 5, 5)).toBe(false);
        expect(digitMatchesDirection('OVER', 5, 4)).toBe(false);
    });

    it('matches Under as strictly less than the barrier', () => {
        expect(digitMatchesDirection('UNDER', 4, 3)).toBe(true);
        expect(digitMatchesDirection('UNDER', 4, 4)).toBe(false);
        expect(digitMatchesDirection('UNDER', 4, 5)).toBe(false);
    });
});

describe('countMatchingDigits', () => {
    it('counts Over 5 and Under 4 digits in a full 0–9 sample', () => {
        const sample = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(countMatchingDigits(sample, 'OVER', 5)).toBe(4); // 6–9
        expect(countMatchingDigits(sample, 'UNDER', 4)).toBe(4); // 0–3
    });
});

describe('evaluateDigitPercentageCondition', () => {
    const makeWindow = (matching: number[], filler: number, size = DEFAULT_WINDOW) => {
        const digits = [...matching];
        while (digits.length < size) {
            digits.push(filler);
        }
        return digits.slice(0, size);
    };

    it('returns 0 while collecting ticks', () => {
        const result = evaluateDigitPercentageCondition(Array.from({ length: 40 }, () => 7), {
            direction: 'OVER',
            barrier: 5,
            sample_size: 100,
        });
        expect(result.percentage).toBe(0);
        expect(result.status).toBe('collecting');
        expect(result.tick_count).toBe(40);
    });

    it('returns the Over barrier percentage for the last window', () => {
        // 40 digits > 5, rest = 1 → 40%
        const result = evaluateDigitPercentageCondition(makeWindow(Array(40).fill(8), 1), {
            direction: 'OVER',
            barrier: 5,
            sample_size: 100,
        });
        expect(result.status).toBe('ready');
        expect(result.percentage).toBe(40);
        expect(result.matching_count).toBe(40);
    });

    it('returns the Under barrier percentage for the last window', () => {
        // 25 digits < 4, rest = 9 → 25%
        const result = evaluateDigitPercentageCondition(makeWindow(Array(25).fill(2), 9), {
            direction: 'UNDER',
            barrier: 4,
            sample_size: 100,
        });
        expect(result.status).toBe('ready');
        expect(result.percentage).toBe(25);
        expect(result.matching_count).toBe(25);
    });

    it('uses only the newest window digits', () => {
        const older = Array.from({ length: 50 }, () => 1);
        const newer = Array.from({ length: 100 }, () => 8);
        const result = evaluateDigitPercentageCondition([...older, ...newer], {
            direction: 'OVER',
            barrier: 5,
            sample_size: 100,
        });
        expect(result.percentage).toBe(100);
    });

    it('supports comparing Over % > Under % like purchase conditions', () => {
        // Over 5 → 60 digits in 6–9; Under 4 → 20 digits in 0–3
        const digits = [...Array(60).fill(8), ...Array(20).fill(1), ...Array(20).fill(5)];
        const over = getDigitPercentageValue(digits, {
            direction: 'OVER',
            barrier: 5,
            sample_size: 100,
        });
        const under = getDigitPercentageValue(digits, {
            direction: 'UNDER',
            barrier: 4,
            sample_size: 100,
        });
        expect(over).toBe(60);
        expect(under).toBe(20);
        expect(over > under).toBe(true);
    });

    it('clamps the window to the Deriv history limit', () => {
        const digits = Array.from({ length: MAX_WINDOW }, () => 8);
        const result = evaluateDigitPercentageCondition(digits, {
            direction: 'OVER',
            barrier: 5,
            sample_size: 5000,
        });
        expect(result.sample_size).toBe(MAX_WINDOW);
        expect(result.percentage).toBe(100);
    });

    it('returns a plain finite number from getDigitPercentageValue while collecting', () => {
        const value = getDigitPercentageValue([1, 2, 3], {
            direction: 'OVER',
            barrier: 5,
            sample_size: 100,
        });
        expect(value).toBe(0);
        expect(typeof value).toBe('number');
    });
});
