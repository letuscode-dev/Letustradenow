import { computeDigitDistribution } from '../digit-distribution';
import type { AnalysisTick } from '../analysis-types';

const tick = (digit: number, quote = 100 + digit, epoch = digit): AnalysisTick => ({ digit, epoch, quote });

describe('computeDigitDistribution', () => {
    it('returns an empty board when there are no ticks', () => {
        const board = computeDigitDistribution([]);

        expect(board.sampleSize).toBe(0);
        expect(board.hotDigit).toBeNull();
        expect(board.secondHotDigit).toBeNull();
        expect(board.coldDigit).toBeNull();
        expect(board.lastDigit).toBeNull();
        expect(board.recentDigits).toEqual([]);
        expect(board.percents.every(percent => percent === 0)).toBe(true);
        expect(board.lastPrice).toBeNull();
    });

    it('uses only the newest ticks in the selected window', () => {
        const ticks = Array.from({ length: 12 }, (_, index) => tick(index < 8 ? 1 : 9, 100 + index, index));
        const board = computeDigitDistribution(ticks, 4);

        expect(board.sampleSize).toBe(4);
        expect(board.counts[9]).toBe(4);
        expect(board.counts[1]).toBe(0);
        expect(board.recentDigits).toEqual([9, 9, 9, 9]);
        expect(board.lastPrice).toBe(111);
    });

    it('highlights the most recent digit when two digits share the top share', () => {
        const ticks = [2, 2, 2, 6, 6, 6].map((digit, index) => tick(digit, 200 + index, index));
        const board = computeDigitDistribution(ticks, 100);

        expect(board.percents[2]).toBe(50);
        expect(board.percents[6]).toBe(50);
        expect(board.hotDigit).toBe(6);
        expect(board.lastDigit).toBe(6);
    });

    it('keeps the newest digit separate from the fullest digit', () => {
        const ticks = [...Array.from({ length: 6 }, () => 9), 3].map((digit, index) => tick(digit, 500 + index, index));
        const board = computeDigitDistribution(ticks, 100);

        expect(board.hotDigit).toBe(9);
        expect(board.secondHotDigit).toBe(3);
        expect(board.lastDigit).toBe(3);
        expect(board.coldDigit).toBe(0);
    });

    it('circles the second fullest digit, using the later one when that count is tied', () => {
        const ticks = [4, 4, 6, 6, 9, 9, 9, 9, 9].map((digit, index) => tick(digit, 600 + index, index));
        const board = computeDigitDistribution(ticks, 100);

        expect(board.hotDigit).toBe(9);
        expect(board.secondHotDigit).toBe(6);
    });

    it('splits even and odd, and Over 4 against Under 5, across the whole sample', () => {
        const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const board = computeDigitDistribution(digits.map((digit, index) => tick(digit, 300 + index, index)), 100);

        expect(board.evenPercent + board.oddPercent).toBe(100);
        expect(board.evenPercent).toBe(50);
        expect(board.overPercent).toBe(50);
        expect(board.underPercent).toBe(50);
        expect(board.overPercent + board.underPercent).toBe(100);
    });

    it('counts a higher quote as a rise and a lower quote as a fall', () => {
        const ticks = [10, 11, 11, 9].map((quote, index) => tick(quote % 10, quote, index));
        const board = computeDigitDistribution(ticks, 100);

        expect(board.risePercent).toBe(50);
        expect(board.fallPercent).toBe(50);
    });

    it('keeps the last ten digits with the newest one at the end', () => {
        const ticks = Array.from({ length: 15 }, (_, index) => tick(index % 10, 400 + index, index));
        const board = computeDigitDistribution(ticks, 1000);

        expect(board.recentDigits).toEqual([5, 6, 7, 8, 9, 0, 1, 2, 3, 4]);
        expect(board.recentDigits.at(-1)).toBe(4);
    });
});
