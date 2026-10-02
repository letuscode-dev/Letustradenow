import {
    buildProposalRequest,
    clampInt,
    getDigitRanks,
    getDigitStats,
    getPredictionBounds,
    getSideProbability,
    getTradeType,
    isDigitMarket,
} from '../manual-trader-utils';

describe('manual-trader-utils', () => {
    const digits = [7, 7, 7, 9, 9, 1, 2, 3, 0, 5, 7, 9];

    it('computes digit % over the last N ticks only', () => {
        const stats = getDigitStats([4, 4, 4, ...digits], digits.length);
        expect(stats[4].count).toBe(0);
        expect(stats[7].count).toBe(4);
        expect(stats[7].pct).toBeCloseTo((4 / 12) * 100);
        expect(stats.reduce((total, s) => total + s.pct, 0)).toBeCloseTo(100);
    });

    it('ranks most, 2nd most, least and 2nd least (ties go to the smaller digit)', () => {
        const ranks = getDigitRanks(getDigitStats(digits, 12));
        expect(ranks[7]).toBe('most');
        expect(ranks[9]).toBe('second_most');
        expect(ranks[4]).toBe('least');
        expect(ranks[6]).toBe('second_least');
        expect(getDigitRanks(getDigitStats([], 120))).toEqual({});
    });

    it('computes each side’s window win rate', () => {
        const stats = getDigitStats(digits, 12);
        expect(getSideProbability('DIGITMATCH', 7, stats)).toBeCloseTo((4 / 12) * 100);
        expect(getSideProbability('DIGITDIFF', 7, stats)).toBeCloseTo((8 / 12) * 100);
        expect(getSideProbability('DIGITOVER', 5, stats)).toBeCloseTo((7 / 12) * 100);
        expect(getSideProbability('DIGITUNDER', 5, stats)).toBeCloseTo((4 / 12) * 100);
        expect(getSideProbability('DIGITEVEN', 0, stats)).toBeCloseTo((2 / 12) * 100);
        expect(getSideProbability('DIGITODD', 0, stats)).toBeCloseTo((10 / 12) * 100);
    });

    it('limits predictions per contract', () => {
        expect(getPredictionBounds('DIGITOVER')).toEqual({ min: 0, max: 8 });
        expect(getPredictionBounds('DIGITUNDER')).toEqual({ min: 1, max: 9 });
        expect(getPredictionBounds('DIGITMATCH')).toEqual({ min: 0, max: 9 });
    });

    it('builds a 1-tick stake proposal, with a barrier only for digit-prediction contracts', () => {
        const base = { symbol: 'R_100', stake: 0.5, duration: 1, currency: 'USD', prediction: 5 };
        expect(buildProposalRequest({ ...base, contract_type: 'DIGITDIFF' })).toEqual({
            proposal: 1,
            amount: 0.5,
            basis: 'stake',
            contract_type: 'DIGITDIFF',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            underlying_symbol: 'R_100',
            barrier: '5',
        });
        expect(buildProposalRequest({ ...base, contract_type: 'DIGITEVEN' })).not.toHaveProperty('barrier');
    });

    it('accepts only volatility indices and clamps inputs', () => {
        expect(isDigitMarket('R_100')).toBe(true);
        expect(isDigitMarket('1HZ10V')).toBe(true);
        expect(isDigitMarket('JD10')).toBe(false);
        expect(clampInt('abc', 120, 10, 1000)).toBe(120);
        expect(clampInt('5000', 120, 10, 1000)).toBe(1000);
        expect(getTradeType('even_odd').uses_prediction).toBe(false);
    });
});
