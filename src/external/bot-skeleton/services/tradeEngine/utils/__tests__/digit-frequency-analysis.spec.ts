import {
    analyzeDigitFrequency,
    analyzeEvenOddParity,
    clampEvenOddWindow,
    ANALYSIS_LEAST_FREQUENT,
    ANALYSIS_MOST_FREQUENT,
    EVEN_ODD_SIDE_EVEN,
    EVEN_ODD_SIDE_ODD,
} from '../digit-frequency-analysis';

describe('analyzeDigitFrequency', () => {
    it('returns -1 until the window is full', () => {
        expect(analyzeDigitFrequency([1, 2, 3], 5, ANALYSIS_LEAST_FREQUENT)).toBe(-1);
    });

    it('returns the least frequent digit', () => {
        // Every digit appears at least once; 0 is coldest (twice vs thrice).
        const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(analyzeDigitFrequency(digits, 29, ANALYSIS_LEAST_FREQUENT)).toBe(0);
    });

    it('returns the most frequent digit', () => {
        const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(analyzeDigitFrequency(digits, 29, ANALYSIS_MOST_FREQUENT)).toBe(1);
    });

    it('breaks ties toward the lower digit index', () => {
        const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(analyzeDigitFrequency(digits, 10, ANALYSIS_LEAST_FREQUENT)).toBe(0);
        expect(analyzeDigitFrequency(digits, 10, ANALYSIS_MOST_FREQUENT)).toBe(0);
    });
});

describe('analyzeEvenOddParity', () => {
    it('waits until the window is full and defaults a missing window to 1000', () => {
        expect(analyzeEvenOddParity([0, 1, 2], 5).ready).toBe(false);
        expect(clampEvenOddWindow(undefined)).toBe(1000);
        expect(clampEvenOddWindow(250)).toBe(250);
        expect(clampEvenOddWindow(5000)).toBe(1000);
    });

    it('trades Odd from the least frequent even digit when the hottest digit is even', () => {
        // 2 is hottest (5). Even counts: 0 and 8 once, so the lower digit 0 is the entry.
        const digits = [2, 2, 2, 2, 2, 4, 4, 4, 6, 6, 0, 8, 1, 1, 1, 1, 3, 5, 7, 9];
        expect(analyzeEvenOddParity(digits, 20)).toEqual({
            ready: true,
            dominant: 2,
            entry: 0,
            side: EVEN_ODD_SIDE_ODD,
        });
    });

    it('trades Even from the least frequent odd digit when the hottest digit is odd', () => {
        // 1 is hottest (6). Odd counts of 1: 3, 7 and 9, so the lower digit 3 is the entry.
        const digits = [1, 1, 1, 1, 1, 1, 5, 5, 3, 7, 9, 0, 0, 2, 2, 4, 4, 6, 6, 8];
        expect(analyzeEvenOddParity(digits, 20)).toEqual({
            ready: true,
            dominant: 1,
            entry: 3,
            side: EVEN_ODD_SIDE_EVEN,
        });
    });

    it('breaks a tie for the hottest digit toward the lower digit', () => {
        // 0 and 1 both appear three times; 0 wins, so the side is Odd and the entry is 2.
        const digits = [0, 0, 0, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(analyzeEvenOddParity(digits, 14)).toEqual({
            ready: true,
            dominant: 0,
            entry: 2,
            side: EVEN_ODD_SIDE_ODD,
        });
    });
});
