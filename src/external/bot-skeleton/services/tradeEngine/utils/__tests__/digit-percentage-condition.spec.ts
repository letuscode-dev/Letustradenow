import {
    DEFAULT_WINDOW,
    MAX_WINDOW,
    appendToSlidingDigitWindow,
    countMatchingDigits,
    digitMatchesDirection,
    evaluateDigitPercentageCondition,
    getDigitPercentageValue,
    getSlidingDigitWindow,
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

describe('getSlidingDigitWindow / appendToSlidingDigitWindow', () => {
    it('keeps only the newest N digits', () => {
        const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
        expect(getSlidingDigitWindow(digits, 4)).toEqual([7, 8, 9, 0]);
    });

    it('drops the oldest digit when a new one arrives on a full window', () => {
        const window = [1, 2, 3, 4, 5];
        const next = appendToSlidingDigitWindow(window, 9, 5);
        expect(next).toEqual([2, 3, 4, 5, 9]);
        expect(next).not.toContain(1);
        expect(next[next.length - 1]).toBe(9);
    });

    it('grows until the window is full before dropping', () => {
        expect(appendToSlidingDigitWindow([1, 2], 3, 5)).toEqual([1, 2, 3]);
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
        const result = evaluateDigitPercentageCondition(makeWindow(Array(25).fill(2), 9), {
            direction: 'UNDER',
            barrier: 4,
            sample_size: 100,
        });
        expect(result.status).toBe('ready');
        expect(result.percentage).toBe(25);
        expect(result.matching_count).toBe(25);
    });

    it('uses only the newest window digits (oldest fall off)', () => {
        const older = Array.from({ length: 50 }, () => 1);
        const newer = Array.from({ length: 100 }, () => 8);
        const result = evaluateDigitPercentageCondition([...older, ...newer], {
            direction: 'OVER',
            barrier: 5,
            sample_size: 100,
        });
        expect(result.percentage).toBe(100);
    });

    it('updates the percentage when the window slides after a new digit', () => {
        // Window of 5: four Unders (1) + one Over (8) → Over 5 = 20%
        const before = [1, 1, 1, 1, 8];
        expect(getDigitPercentageValue(before, { direction: 'OVER', barrier: 5, sample_size: 5 })).toBe(20);

        // New Over digit arrives → oldest 1 drops → three Unders + two Overs → 40%
        const after = [...before, 9];
        expect(getSlidingDigitWindow(after, 5)).toEqual([1, 1, 1, 8, 9]);
        expect(getDigitPercentageValue(after, { direction: 'OVER', barrier: 5, sample_size: 5 })).toBe(40);
    });

    it('supports comparing Over % > Under % like purchase conditions', () => {
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

    it('honours a user-configured window size other than 100', () => {
        // 10 Overs in a window of 25 → 40%
        const digits = [...Array(10).fill(8), ...Array(15).fill(1)];
        expect(
            getDigitPercentageValue(digits, { direction: 'OVER', barrier: 5, sample_size: 25 })
        ).toBe(40);
        // Same series with window 10 → only the last 10 (all Unders) → 0%
        expect(
            getDigitPercentageValue(digits, { direction: 'OVER', barrier: 5, sample_size: 10 })
        ).toBe(0);
        // Window 250 is accepted (not clamped down to 100) — collecting until full.
        const short = evaluateDigitPercentageCondition(digits, {
            direction: 'OVER',
            barrier: 5,
            sample_size: 250,
        });
        expect(short.sample_size).toBe(250);
        expect(short.status).toBe('collecting');
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

    it('ignores invalid digits when building the window sample', () => {
        const digits = [...Array(5).fill(NaN), ...Array(40).fill(8), ...Array(60).fill(1)];
        const value = getDigitPercentageValue(digits, {
            direction: 'OVER',
            barrier: 5,
            sample_size: 100,
        });
        expect(value).toBe(40);
    });
});
