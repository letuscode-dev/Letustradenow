import { fixedDigitDiffersStrategy } from '../fixed-digit-differs';
import { createMirrorRuntime } from '../mirror-runtime';

const settings = { prediction: 9, stake: 1, takeProfit: 10, stopLoss: 50 };
const round = value => Math.round(value * 100) / 100;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('fixed prediction Digit Differs', () => {
    it.each([0, 9])('accepts digit %i', prediction => {
        expect(fixedDigitDiffersStrategy.createRisk({ ...settings, prediction }).prediction).toBe(prediction);
    });

    it.each([
        { prediction: -1 }, { prediction: 10 }, { prediction: 1.5 }, { prediction: '' },
        { stake: 0 }, { takeProfit: 0 }, { stopLoss: -1 },
    ])('rejects invalid settings %o', overrides => {
        expect(() => fixedDigitDiffersStrategy.createRisk({ ...settings, ...overrides })).toThrow();
    });

    it('records every received tick and uses the fixed digit and recovery on the next purchase', async () => {
        let id = 0;
        const buy = jest.fn(async order => ({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ strategy: fixedDigitDiffersStrategy, settings, journal: jest.fn(),
            buy, round, refreshContract: async () => ({}) });
        [4, 7, 2].forEach((digit, index) => runtime.tick(digit, index));
        expect(runtime.signals.map(signal => signal.digit)).toEqual([4, 7, 2]);
        expect(runtime.queuedSignals()).toBe(2);
        await flush();
        expect(buy).toHaveBeenCalledTimes(1);
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -1 });
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 9, stake: 10.42 });
        await flush();
        runtime.settle({ contract_id: 2, status: 'won', sell_price: 11.42, profit: 1 });
        expect(buy.mock.calls[2][0]).toEqual({ barrier: 9, stake: 1 });
    });

    it.each([
        [{ ...settings, takeProfit: 0.1 }, { status: 'won', sell_price: 1.1, profit: 0.1 }, 'Profit threshold reached'],
        [{ ...settings, stopLoss: 1 }, { status: 'lost', sell_price: 0, profit: -1 }, 'Stop loss reached'],
    ])('stops and cancels waiting signals at the configured limit', async (config, outcome, reason) => {
        const onStop = jest.fn();
        const buy = jest.fn(async () => ({ buy: { contract_id: 1, buy_price: 1 } }));
        const runtime = createMirrorRuntime({ strategy: fixedDigitDiffersStrategy, settings: config, journal: jest.fn(),
            buy, round, onStop, refreshContract: async () => ({}) });
        runtime.tick(1, 1);
        runtime.tick(2, 2);
        await flush();
        runtime.settle({ contract_id: 1, ...outcome });
        expect(onStop).toHaveBeenCalledWith(reason);
        expect(runtime.queuedSignals()).toBe(0);
        expect(buy).toHaveBeenCalledTimes(1);
    });

    it('handles a contract settling before the buy confirmation arrives', async () => {
        let confirm;
        const buy = jest.fn(() => new Promise(resolve => { confirm = resolve; }));
        const runtime = createMirrorRuntime({ strategy: fixedDigitDiffersStrategy, settings, journal: jest.fn(),
            buy, round, refreshContract: async () => ({}) });
        runtime.tick(1, 1);
        runtime.tick(2, 2);
        runtime.settle({ contract_id: 11, status: 'lost', sell_price: 0, profit: -1 });
        runtime.settle({ contract_id: 11, status: 'lost' });
        confirm({ buy: { contract_id: 11, buy_price: 1 } });
        await flush();
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 9, stake: 10.42 });
    });

    it('does not buy on recovered historical ticks', () => {
        const buy = jest.fn();
        const runtime = createMirrorRuntime({ strategy: fixedDigitDiffersStrategy, settings, journal: jest.fn(),
            buy, round, refreshContract: async () => ({}) });
        runtime.tick(4, 1, false);
        expect(buy).not.toHaveBeenCalled();
        expect(runtime.signals[0]).toMatchObject({ barrier: 9, status: 'restricted' });
    });
});
