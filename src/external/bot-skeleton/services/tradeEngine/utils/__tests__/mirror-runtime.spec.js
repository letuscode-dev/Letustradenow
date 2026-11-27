import { createMirrorRuntime } from '../mirror-runtime';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('mirror runtime', () => {
    it('submits overlapping patterns while earlier buys are still pending', async () => {
        const requests = [];
        const journal = jest.fn();
        const buy = jest.fn(order => new Promise(resolve => requests.push({ order, resolve })));
        const runtime = createMirrorRuntime({ buy, journal, refreshContract: async () => ({}), settings: {} });
        [7, 4, 7, 4, 7].forEach((digit, index) => runtime.tick(digit, index));
        expect(buy.mock.calls.map(([order]) => order.barrier)).toEqual([4, 7, 4]);
        expect(runtime.pendingBuys()).toBe(3);
        requests.forEach((request, index) => request.resolve({ buy: { contract_id: index + 1, buy_price: 5 } }));
        await flush();
        expect(runtime.tracker.active.size).toBe(3);
        expect(journal.mock.calls.filter(([event]) => event.type === 'purchase')).toHaveLength(3);
        runtime.settle({ contract_id: 2, status: 'lost', sell_price: 0, profit: -5 });
        expect(runtime.risk.stake).toBe(5);
        runtime.settle({ contract_id: 1, status: 'won', sell_price: 5.48, profit: 0.48 });
        expect(runtime.risk.stake).toBeCloseTo(52.0833333);
        runtime.settle({ contract_id: 3, status: 'won', sell_price: 5.48, profit: 0.48 });
        expect(runtime.risk.stake).toBe(5);
    });

    it('records recovered signals without buying them', () => {
        const buy = jest.fn();
        const journal = jest.fn();
        const runtime = createMirrorRuntime({ buy, journal, refreshContract: jest.fn(), settings: {} });
        [7, 4, 7].forEach(digit => runtime.tick(digit, 0, false));
        expect(buy).not.toHaveBeenCalled();
        expect(runtime.signals[0]).toMatchObject({ status: 'restricted', reason: 'Recovered historical tick' });
    });

    it('halts after an unconfirmed purchase without retrying', async () => {
        const buy = jest.fn().mockRejectedValue(new Error('disconnected'));
        const onStop = jest.fn();
        const runtime = createMirrorRuntime({ buy, onStop, journal: jest.fn(), refreshContract: jest.fn(), settings: {} });
        [7, 4, 7].forEach(digit => runtime.tick(digit, 0));
        await flush();
        expect(runtime.isEnabled()).toBe(false);
        expect(onStop).toHaveBeenCalledTimes(1);
        [4, 7, 4].forEach(digit => runtime.tick(digit, 0));
        expect(buy).toHaveBeenCalledTimes(1);
    });

    it('keeps the contract id visible when a purchase response is incomplete', async () => {
        const journal = jest.fn();
        const runtime = createMirrorRuntime({ settings: {}, journal,
            buy: async () => ({ buy: { contract_id: 91 } }), refreshContract: jest.fn() });
        [7, 4, 7].forEach(digit => runtime.tick(digit, 1));
        await flush();
        const event = journal.mock.calls.map(([item]) => item).find(item => item.type === 'purchase_error');
        expect(event.signal.contractId).toBe(91);
        expect(runtime.isEnabled()).toBe(false);
    });

    it('does not count a confirmed purchase as unconfirmed while its status request is pending', async () => {
        let resolveStatus;
        const runtime = createMirrorRuntime({ settings: {}, journal: jest.fn(),
            buy: async () => ({ buy: { contract_id: 9, buy_price: 5 } }),
            refreshContract: () => new Promise(resolve => { resolveStatus = resolve; }) });
        [7, 4, 7].forEach(digit => runtime.tick(digit, 1));
        await Promise.resolve();
        expect(runtime.tracker.active.has('9')).toBe(true);
        expect(runtime.pendingBuys()).toBe(0);
        resolveStatus({ proposal_open_contract: { contract_id: 9, status: 'open' } });
        await flush();
    });

    it('records confirmed settlements after a preceding purchase was rejected', async () => {
        let rejectFirst;
        const journal = jest.fn();
        let index = 0;
        const runtime = createMirrorRuntime({ settings: {}, journal,
            buy: () => ++index === 1 ? new Promise((_, reject) => { rejectFirst = reject; }) :
                Promise.resolve({ buy: { contract_id: 2, buy_price: 5 } }),
            refreshContract: async () => ({}) });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        runtime.settle({ contract_id: 2, status: 'lost', sell_price: 0, profit: -5 });
        rejectFirst(new Error('Purchase rejected'));
        await flush();
        expect(journal.mock.calls.some(([event]) => event.type === 'settlement' && event.contract_id === 2)).toBe(true);
    });

    it('journals a later settlement immediately while an earlier purchase is still unresolved', async () => {
        let index = 0;
        const journal = jest.fn();
        const runtime = createMirrorRuntime({ settings: {}, journal,
            buy: () => ++index === 1 ? new Promise(() => {}) : Promise.resolve({ buy: { contract_id: 2, buy_price: 5 } }),
            refreshContract: async () => ({}) });
        [7, 4, 7, 4].forEach(digit => runtime.tick(digit, 1));
        await flush();
        runtime.settle({ contract_id: 2, status: 'lost', sell_price: 0, profit: -5 });
        expect(journal.mock.calls.some(([event]) => event.type === 'settlement_pending_order' && event.contract_id === 2)).toBe(true);
        expect(runtime.risk.totalProfit).toBe(0);
    });

    it('applies consecutive-loss limits in signal order even when results arrive out of order', async () => {
        let id = 0;
        const onStop = jest.fn();
        const runtime = createMirrorRuntime({ settings: {}, journal: jest.fn(), onStop,
            buy: async () => ({ buy: { contract_id: ++id, buy_price: 5 } }), refreshContract: async () => ({}) });
        [7, 4, 7, 4, 7].forEach((digit, index) => runtime.tick(digit, index));
        await flush();
        runtime.settle({ contract_id: 2, status: 'lost', sell_price: 0, profit: -5 });
        runtime.settle({ contract_id: 3, status: 'lost', sell_price: 0, profit: -5 });
        expect(runtime.isEnabled()).toBe(true);
        runtime.settle({ contract_id: 1, status: 'won', sell_price: 5.48, profit: 0.48 });
        expect(runtime.isEnabled()).toBe(false);
        expect(onStop).toHaveBeenCalledWith('Maximum consecutive losses reached');
    });

    it('stops submitting new orders when confirmed total profit reaches the target', async () => {
        const buy = jest.fn(async () => ({ buy: { contract_id: 1, buy_price: 5 } }));
        const onStop = jest.fn();
        const runtime = createMirrorRuntime({ settings: { profitThreshold: 10 }, journal: jest.fn(), onStop,
            buy, refreshContract: async () => ({}) });
        [7, 4, 7].forEach(digit => runtime.tick(digit, 1));
        await flush();
        runtime.settle({ contract_id: 1, status: 'won', sell_price: 15, profit: 10 });
        [4, 7, 4].forEach(digit => runtime.tick(digit, 2));
        expect(onStop).toHaveBeenCalledWith('Profit threshold reached');
        expect(buy).toHaveBeenCalledTimes(1);
    });
});
