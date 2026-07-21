import {
    allDigitsBelowMaximum,
    evaluateConsecutiveDigitsOver,
    getRecentDigits,
} from '../consecutive-digits-over';

describe('consecutive-digits-over', () => {
    it('reads the last N digits', () => {
        expect(getRecentDigits([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    });

    it('requires every digit to be strictly below the maximum', () => {
        expect(allDigitsBelowMaximum([3, 5, 6], 7)).toBe(true);
        expect(allDigitsBelowMaximum([3, 7, 6], 7)).toBe(false);
        expect(allDigitsBelowMaximum([0, 1, 2], 7)).toBe(true);
    });

    it('places Over 2 when last 3 digits are < 7 and not recovering', () => {
        const result = evaluateConsecutiveDigitsOver([8, 3, 5, 6], { journal_enabled: false }, false);
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(2);
        expect(result.recent_digits).toEqual([3, 5, 6]);
    });

    it('places Over 3 when recovering', () => {
        const result = evaluateConsecutiveDigitsOver([4, 5, 6], { journal_enabled: false }, true);
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(3);
    });

    it('rejects when any of the last 3 digits is >= 7', () => {
        const result = evaluateConsecutiveDigitsOver([5, 6, 7], { journal_enabled: false }, false);
        expect(result.allowed).toBe(false);
        expect(result.prediction).toBe(-1);
    });

    it('waits until enough ticks are available', () => {
        const result = evaluateConsecutiveDigitsOver([5, 6], { journal_enabled: true }, false);
        expect(result.allowed).toBe(false);
        expect(result.prediction).toBe(-1);
        expect(result.journal_messages.length).toBeGreaterThan(0);
    });

    it('does not miss a qualifying window on consecutive ticks', () => {
        const ticks = [9, 8, 1, 2, 3];
        const first = evaluateConsecutiveDigitsOver(ticks.slice(0, 3), { journal_enabled: false }, false);
        expect(first.allowed).toBe(false); // 9,8,1 → fails on 9 and 8

        const second = evaluateConsecutiveDigitsOver(ticks.slice(0, 5), { journal_enabled: false }, false);
        expect(second.allowed).toBe(true); // 1,2,3
        expect(second.prediction).toBe(2);
    });
});
