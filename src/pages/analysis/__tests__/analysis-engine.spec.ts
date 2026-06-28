import { generateAnalysisSnapshot } from '../analysis-engine';
import type { AnalysisCandle, AnalysisSymbol, TimeframeOption } from '../analysis-types';

const symbol: AnalysisSymbol = {
    displayName: 'Volatility 100 Index',
    exchangeIsOpen: true,
    marketDisplayName: 'Derived',
    pip: 0.01,
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

describe('generateAnalysisSnapshot', () => {
    it('creates a rise idea when trend and momentum align upward', () => {
        const candles = Array.from({ length: 40 }, (_, index) => {
            const pullback = index % 3 === 0 ? -0.35 : 0.1;
            return makeCandle(index, 100 + index * 0.1 + pullback);
        });

        const snapshot = generateAnalysisSnapshot(candles, symbol, timeframe);

        expect(snapshot.trend).toBe('up');
        expect(snapshot.ideas.some(idea => idea.direction === 'rise')).toBe(true);
    });

    it('prioritises waiting when recent range spikes', () => {
        const candles = Array.from({ length: 35 }, (_, index) =>
            makeCandle(index, 100 + index * 0.12, index > 26 ? 5 : 1)
        );

        const snapshot = generateAnalysisSnapshot(candles, symbol, timeframe);

        expect(snapshot.volatility).toBe('spike');
        expect(snapshot.ideas[0].direction).toBe('wait');
    });
});
