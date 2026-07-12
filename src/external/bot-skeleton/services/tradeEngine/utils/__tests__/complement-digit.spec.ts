import { evaluateComplementDigit, getComplementDigitPrediction } from '../complement-digit';

describe('getComplementDigitPrediction', () => {
    it('returns current digit for each complement pair', () => {
        expect(getComplementDigitPrediction([0, 9])).toBe(9);
        expect(getComplementDigitPrediction([9, 0])).toBe(0);
        expect(getComplementDigitPrediction([1, 8])).toBe(8);
        expect(getComplementDigitPrediction([8, 1])).toBe(1);
        expect(getComplementDigitPrediction([2, 7])).toBe(7);
        expect(getComplementDigitPrediction([7, 2])).toBe(2);
        expect(getComplementDigitPrediction([3, 6])).toBe(6);
        expect(getComplementDigitPrediction([6, 3])).toBe(3);
        expect(getComplementDigitPrediction([4, 5])).toBe(5);
        expect(getComplementDigitPrediction([5, 4])).toBe(4);
    });

    it('returns -1 when the last two digits are not complements', () => {
        expect(getComplementDigitPrediction([0, 1])).toBe(-1);
        expect(getComplementDigitPrediction([3, 3])).toBe(-1);
        expect(getComplementDigitPrediction([4, 4])).toBe(-1);
    });

    it('returns -1 with fewer than two digits', () => {
        expect(getComplementDigitPrediction([])).toBe(-1);
        expect(getComplementDigitPrediction([9])).toBe(-1);
    });

    it('uses only the last two digits in a longer window', () => {
        expect(getComplementDigitPrediction([1, 2, 3, 0, 9])).toBe(9);
        expect(getComplementDigitPrediction([9, 0, 4, 2])).toBe(-1);
    });
});

describe('evaluateComplementDigit', () => {
    it('journals a short signal line when a complement fires', () => {
        const result = evaluateComplementDigit([4, 5], { journal_enabled: true });
        expect(result.prediction).toBe(5);
        expect(result.journal_messages).toHaveLength(1);
        expect(result.journal_messages[0].message).toBe('Complement 4→5 · Differs 5');
    });

    it('returns -1 with no journal when disabled or no pair', () => {
        expect(evaluateComplementDigit([4, 5], { enabled: false }).prediction).toBe(-1);
        expect(evaluateComplementDigit([1, 2], { journal_enabled: true }).journal_messages).toHaveLength(0);
    });
});
