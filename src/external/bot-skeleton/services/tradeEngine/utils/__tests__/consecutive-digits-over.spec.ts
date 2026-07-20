import {
    allDigitsMeetMinimum,
    evaluateConsecutiveDigitsOver,
    getRecentDigits,
} from '../consecutive-digits-over';

describe('consecutive-digits-over', () => {
    it('reads the last N digits', () => {
        expect(getRecentDigits([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    });

    it('requires every digit to meet the minimum', () => {
        expect(allDigitsMeetMinimum([3, 5, 9], 3)).toBe(true);
        expect(allDigitsMeetMinimum([3, 2, 9], 3)).toBe(false);
        expect(allDigitsMeetMinimum([3, 4], 3)).toBe(true);
    });

    it('places Over 2 when last 3 digits are >= 3 and not recovering', () => {
        const result = evaluateConsecutiveDigitsOver([1, 3, 5, 7], { journal_enabled: false }, false);
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(2);
        expect(result.recent_digits).toEqual([3, 5, 7]);
    });

    it('places Over 3 when recovering', () => {
        const result = evaluateConsecutiveDigitsOver([4, 6, 8], { journal_enabled: false }, true);
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(3);
    });

    it('rejects when any of the last 3 digits is below 3', () => {
        const result = evaluateConsecutiveDigitsOver([5, 6, 2], { journal_enabled: false }, false);
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
        const ticks = [1, 2, 3, 4, 5];
        const first = evaluateConsecutiveDigitsOver(ticks.slice(0, 4), { journal_enabled: false }, false);
        expect(first.allowed).toBe(false); // 1,2,3,4 → last 3 = 2,3,4 fails on 2

        const second = evaluateConsecutiveDigitsOver(ticks.slice(0, 5), { journal_enabled: false }, false);
        expect(second.allowed).toBe(true); // 3,4,5
        expect(second.prediction).toBe(2);
    });
});
