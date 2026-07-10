import {
    DEFAULT_PATTERN_THRESHOLD,
    getDigitTransitionPrediction,
    getDigitTransitionSignal,
} from '@/external/bot-skeleton/services/tradeEngine/utils/digit-transition';

describe('digit transition analysis', () => {
    it('returns null when the window is too short', () => {
        expect(getDigitTransitionSignal([1], 2)).toBeNull();
        expect(getDigitTransitionPrediction([1, 2], 99)).toBe(-1);
    });

    it('differs the starter digit when current matches the pattern destination', () => {
        // Current digit is 3. Pattern 0→3 appears three times; threshold is 3.
        const digits = [0, 3, 0, 3, 0, 3];
        expect(getDigitTransitionSignal(digits, 3)).toEqual({ from: 0, to: 3, count: 3 });
        // Differs the digit that initiated the pattern (0), not the current digit (3).
        expect(getDigitTransitionPrediction(digits, 3)).toBe(0);
    });

    it('ignores patterns below the threshold', () => {
        const digits = [0, 3, 0, 3];
        expect(getDigitTransitionSignal(digits, 5)).toBeNull();
        expect(getDigitTransitionPrediction(digits, 5)).toBe(-1);
    });

    it('uses the default threshold when invalid', () => {
        expect(DEFAULT_PATTERN_THRESHOLD).toBe(5);
        // Ends on 9; 2→9 appears 10 times.
        const digits = Array.from({ length: 10 }, () => [2, 9]).flat();
        expect(getDigitTransitionSignal(digits, Number.NaN)).toEqual({ from: 2, to: 9, count: 10 });
        expect(getDigitTransitionPrediction(digits, Number.NaN)).toBe(2);
    });
});
