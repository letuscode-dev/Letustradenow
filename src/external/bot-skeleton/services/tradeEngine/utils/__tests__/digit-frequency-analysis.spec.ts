import {
    analyzeDigitFrequency,
    ANALYSIS_LEAST_FREQUENT,
    ANALYSIS_MOST_FREQUENT,
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
