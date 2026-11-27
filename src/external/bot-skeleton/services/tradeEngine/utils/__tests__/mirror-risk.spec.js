import { applyMirrorSettlement, createMirrorRiskState } from '../mirror-risk';

const round = value => Math.round(value * 100) / 100;

describe('mirror recovery and limits', () => {
    it('recovers accumulated loss at 9.6%, then resets on win', () => {
        const state = createMirrorRiskState();
        applyMirrorSettlement(state, { result: 'lost', profit: -5 }, round);
        expect(state).toMatchObject({ stake: 52.08, totalLoss: 5, lossCount: 1, inARow: 1 });
        applyMirrorSettlement(state, { result: 'won', profit: 5 }, round);
        expect(state).toMatchObject({ stake: 5, totalLoss: 0, lossCount: 1, inARow: 0, totalProfit: 0 });
    });

    it('stops on the configured consecutive loss count', () => {
        const state = createMirrorRiskState();
        applyMirrorSettlement(state, { result: 'lost', profit: -5 }, round);
        applyMirrorSettlement(state, { result: 'lost', profit: -52.08 }, round);
        expect(state).toMatchObject({ stopped: true, totalLoss: 57.08, inARow: 2, stopReason: 'Maximum consecutive losses reached' });
    });

    it('stops at take profit and does not restart from later settlements', () => {
        const state = createMirrorRiskState({ profitThreshold: 10 });
        applyMirrorSettlement(state, { result: 'won', profit: 10 }, round);
        applyMirrorSettlement(state, { result: 'lost', profit: -5 }, round);
        expect(state).toMatchObject({ stopped: true, stopReason: 'Profit threshold reached', totalProfit: 5 });
    });

    it('rejects invalid settings and non-settled or inconsistent results', () => {
        expect(() => createMirrorRiskState({ maxLosses: 0 })).toThrow();
        expect(() => applyMirrorSettlement(createMirrorRiskState(), { result: 'open', profit: 0 })).toThrow();
        expect(() => applyMirrorSettlement(createMirrorRiskState(), { result: 'lost', profit: 1 })).toThrow();
    });
});
