import {
    detectTripleDigitMartingaleSignal,
    evaluateSymbolTripleDigitSignal,
    pickFirstTripleDigitMatch,
    makeTripleDigitSignalKey,
    isTripleDigitSignalConsumed,
} from '../triple-digit-martingale';

describe('triple digit martingale signal', () => {
    it('signals Differs on the digit before a triple repeat', () => {
        const result = detectTripleDigitMartingaleSignal([9, 4, 7, 7, 7]);
        expect(result.matched).toBe(true);
        expect(result.prediction).toBe(4);
        expect(result.reason).toBe('triple_repeat');
    });

    it('requires four digits', () => {
        expect(detectTripleDigitMartingaleSignal([7, 7, 7]).matched).toBe(false);
    });

    it('ignores non-matching tips', () => {
        expect(detectTripleDigitMartingaleSignal([1, 2, 3, 3]).matched).toBe(false);
    });

    it('picks the first matching symbol evaluation', () => {
        const match = pickFirstTripleDigitMatch([
            evaluateSymbolTripleDigitSignal('R_10', [1, 2, 3, 4]),
            evaluateSymbolTripleDigitSignal('R_25', [5, 8, 8, 8]),
            evaluateSymbolTripleDigitSignal('R_50', [9, 1, 1, 1]),
        ]);
        expect(match?.symbol).toBe('R_25');
        expect(match?.prediction).toBe(5);
    });

    it('deduplicates consumed signal keys', () => {
        const match = evaluateSymbolTripleDigitSignal('1HZ50V', [2, 3, 3, 3]);
        const key = makeTripleDigitSignalKey(match, 100);
        expect(isTripleDigitSignalConsumed(match, 100, key)).toBe(true);
        expect(isTripleDigitSignalConsumed(match, 101, key)).toBe(false);
    });
});
