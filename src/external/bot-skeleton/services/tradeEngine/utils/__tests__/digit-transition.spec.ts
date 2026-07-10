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

    it('detects the strongest transition from the current last digit', () => {
        // Current digit is 1. Pattern 1→7 appears three times; threshold is 3.
        const digits = [1, 7, 1, 7, 1, 7, 1];
        expect(getDigitTransitionSignal(digits, 3)).toEqual({ from: 1, to: 7, count: 3 });
        expect(getDigitTransitionPrediction(digits, 3)).toBe(7);
    });

    it('ignores patterns below the threshold', () => {
        const digits = [1, 7, 1, 7, 1];
        expect(getDigitTransitionSignal(digits, 5)).toBeNull();
        expect(getDigitTransitionPrediction(digits, 5)).toBe(-1);
    });

    it('uses the default threshold when invalid', () => {
        expect(DEFAULT_PATTERN_THRESHOLD).toBe(5);
        const digits = Array.from({ length: 10 }, () => [2, 9]).flat().concat(2);
        // 2→9 appears 10 times
        expect(getDigitTransitionSignal(digits, Number.NaN)?.to).toBe(9);
    });
});
