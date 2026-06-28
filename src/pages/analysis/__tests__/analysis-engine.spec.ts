import { generateAnalysisSnapshot } from '../analysis-engine';
import type { AnalysisCandle, AnalysisSymbol, AnalysisTick, TimeframeOption } from '../analysis-types';

const symbol: AnalysisSymbol = {
    displayName: 'Volatility 100 Index',
    exchangeIsOpen: true,
    market: 'synthetic_index',
    marketDisplayName: 'Derived',
    pip: 0.01,
    submarket: 'random_index',
    submarketDisplayName: 'Continuous Indices',
    symbol: 'R_100',
};

const timeframe: TimeframeOption = {
    granularity: 60,
    horizon: '1-3 candles',
    label: '1m',
};

const makeCandle = (index: number, close: number, range = 1): AnalysisCandle => ({
    close,
    epoch: 1700000000 + index * 60,
    high: close + range / 2,
    low: close - range / 2,
    open: close - 0.2,
});

const makeTick = (index: number, digit: number): AnalysisTick => ({
    digit,
    epoch: 1700000000 + index,
    quote: 100 + digit / 100,
});

const makeTicks = (digits: number[]) => digits.map((digit, index) => makeTick(index, digit));

describe('generateAnalysisSnapshot', () => {
    it('creates a rise idea when trend and momentum align upward', () => {
        const candles = Array.from({ length: 40 }, (_, index) => {
            const pullback = index % 3 === 0 ? -0.35 : 0.1;
            return makeCandle(index, 100 + index * 0.1 + pullback);
        });

        const snapshot = generateAnalysisSnapshot(candles, [], symbol, timeframe, 'rise_fall');

        expect(snapshot.trend).toBe('up');
        expect(snapshot.ideas.some(idea => idea.direction === 'rise')).toBe(true);
    });

    it('prioritises waiting when recent range spikes', () => {
        const candles = Array.from({ length: 35 }, (_, index) =>
            makeCandle(index, 100 + index * 0.12, index > 26 ? 5 : 1)
        );

        const snapshot = generateAnalysisSnapshot(candles, [], symbol, timeframe, 'rise_fall');

        expect(snapshot.volatility).toBe('spike');
        expect(snapshot.ideas[0].direction).toBe('wait');
    });

    it('creates an Over idea from a derived digit distribution', () => {
        const digits = [
            ...Array.from({ length: 12 }, () => [5, 6, 7, 8, 9]).flat(),
            0,
            1,
            2,
            3,
            4,
            0,
            1,
            2,
            3,
            4,
        ];

        const snapshot = generateAnalysisSnapshot([], makeTicks(digits), symbol, timeframe, 'over_under', 100, 4);

        expect(snapshot.digitStats?.overCount).toBeGreaterThan(snapshot.digitStats?.underCount ?? 0);
        expect(snapshot.ideas[0]).toMatchObject({
            direction: 'over',
            prediction: 'Over 4',
        });
    });

    it('uses the selected tick sample size and Over/Under barrier', () => {
        const olderOverDigits = Array.from({ length: 60 }, () => 8);
        const recentUnderDigits = Array.from({ length: 30 }, () => 2);

        const snapshot = generateAnalysisSnapshot(
            [],
            makeTicks([...olderOverDigits, ...recentUnderDigits]),
            symbol,
            timeframe,
            'over_under',
            30,
            7
        );

        expect(snapshot.digitStats?.sampleSize).toBe(30);
        expect(snapshot.digitStats?.underCount).toBe(30);
        expect(snapshot.ideas[0]).toMatchObject({
            direction: 'under',
            prediction: 'Under 7',
        });
    });

    it('creates Differs and Matches ideas from hot and cold digits', () => {
        const digits = [
            0,
            1,
            2,
            ...Array.from({ length: 16 }, () => 7),
            ...Array.from({ length: 4 }, () => [4, 5, 6, 8, 9]).flat(),
        ];

        const snapshot = generateAnalysisSnapshot([], makeTicks(digits), symbol, timeframe, 'matches_differs', 100, 4);

        expect(snapshot.digitStats?.coldDigit).toBe(3);
        expect(snapshot.ideas.some(idea => idea.direction === 'differs' && idea.prediction === 'Differs 3')).toBe(true);
        expect(snapshot.ideas.some(idea => idea.direction === 'matches' && idea.prediction === 'Matches 7')).toBe(true);
    });
});
