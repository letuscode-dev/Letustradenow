import { createMirrorRuntime } from '../mirror-runtime';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const round = value => Math.round(value * 100) / 100;

describe('mirror recovery order', () => {
    it('uses 6.46 as the next stake after a 0.62 loss at 9.6%', async () => {
        let id = 0;
        const buy = jest.fn(async order => ({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ settings: { stake: 0.62 }, journal: jest.fn(), round, buy,
            refreshContract: async () => ({}) });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -0.62 });
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 7, stake: 6.46 });
    });

    it('uses the recovery stake on the very next purchase after a loss', async () => {
        let id = 0;
        const buy = jest.fn(async order => ({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ settings: {}, journal: jest.fn(), round, buy, refreshContract: async () => ({}) });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        expect(buy.mock.calls.map(([order]) => order)).toEqual([{ barrier: 4, stake: 5 }]);
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        expect(buy.mock.calls.map(([order]) => order)).toEqual([
            { barrier: 4, stake: 5 }, { barrier: 7, stake: 52.08 },
        ]);
        await flush();
        runtime.settle({ contract_id: 2, status: 'won', sell_price: 57.08, profit: 5 });
        runtime.tick(7, 2);
        expect(buy.mock.calls[2][0]).toEqual({ barrier: 4, stake: 5 });
    });

    it('uses a settled result immediately even if the earlier status request is still pending', async () => {
        let id = 0;
        let resolveFirstStatus;
        const buy = jest.fn(async order => ({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const refreshContract = contractId => contractId === 1
            ? new Promise(resolve => { resolveFirstStatus = resolve; }) : Promise.resolve({});
        const runtime = createMirrorRuntime({ settings: {}, journal: jest.fn(), round, buy, refreshContract });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        runtime.settle({ contract_id: 1, status: 'open', profit: -5 });
        expect(buy).toHaveBeenCalledTimes(1);
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 7, stake: 52.08 });
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        resolveFirstStatus({ proposal_open_contract: { contract_id: 1, status: 'open' } });
        await flush();
        expect(buy).toHaveBeenCalledTimes(2);
    });

    it('keeps the queued recovery until connection recovery is complete', async () => {
        let id = 0;
        const buy = jest.fn(async order => ({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ settings: {}, journal: jest.fn(), round, buy, refreshContract: async () => ({}) });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        runtime.pauseExecution();
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        expect(buy).toHaveBeenCalledTimes(1);
        expect(runtime.queuedSignals()).toBe(1);
        runtime.resumeExecution();
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 7, stake: 52.08 });
    });

    it('does not stop a recovery because an already-settled contract status request later fails', async () => {
        let id = 0;
        let rejectFirstStatus;
        const buy = jest.fn(async order => ({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const refreshContract = contractId => contractId === 1
            ? new Promise((_, reject) => { rejectFirstStatus = reject; }) : Promise.resolve({});
        const runtime = createMirrorRuntime({ settings: {}, journal: jest.fn(), round, buy, refreshContract });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        rejectFirstStatus(new Error('Late status error'));
        await flush();
        expect(runtime.isEnabled()).toBe(true);
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 7, stake: 52.08 });
    });

    it('submits the queued recovery if settlement arrives during purchase confirmation', async () => {
        let id = 0;
        let runtime;
        const buy = jest.fn(async order => ({ buy: { contract_id: ++id, buy_price: order.stake } }));
        runtime = createMirrorRuntime({ settings: {}, journal: jest.fn(), round, buy, refreshContract: async () => ({}),
            onPurchase: confirmation => {
                if (confirmation.contract_id === 1) runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
            } });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 7, stake: 52.08 });
    });
});
