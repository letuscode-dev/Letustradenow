import { digitPercentageIncreaseStrategy as strategy } from '../digit-percentage-increase';
import { createMirrorRuntime } from '../mirror-runtime';

const settings = { minimumIncrease: 0.1, stake: 5, maxLosses: 2, profitThreshold: 10, stopLoss: 50, recoveryMultiplier: 100 / 9.6 };
const round = value => Math.round(value * 100) / 100;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Digit Percentage Increase Differs', () => {
    it('compares two complete rolling 1,000-tick windows and trades the digit that increased', () => {
        const detector = strategy.createDetector();
        const risk = strategy.createRisk(settings);
        for (let index = 0; index < 1000; index++) expect(strategy.evaluate(detector, index % 10, risk)).toBeNull();
        const first = strategy.evaluate(detector, 9, risk);
        expect(first).toMatchObject({ barrier: 9, outgoingDigit: 0, previousPercentage: 10,
            currentPercentage: 10.1, increase: 0.1, entryPassed: true, windowSize: 1000 });
        const unchanged = strategy.evaluate(detector, 1, risk);
        expect(unchanged).toMatchObject({ barrier: 1, outgoingDigit: 1, increase: 0, entryPassed: false });
    });

    it.each([0.001, 0.1])('accepts a minimum increase of %s percentage points', minimumIncrease => {
        const detector = strategy.createDetector();
        const risk = strategy.createRisk({ ...settings, minimumIncrease });
        for (let index = 0; index < 1000; index++) strategy.evaluate(detector, 0, risk);
        expect(strategy.evaluate(detector, 1, risk)).toMatchObject({ entryPassed: true, barrier: 1, increase: 0.1 });
    });

    it('does not trade a 0.1-point change if the configured threshold is higher', () => {
        const detector = strategy.createDetector();
        const risk = strategy.createRisk({ ...settings, minimumIncrease: 0.2 });
        for (let index = 0; index < 1000; index++) strategy.evaluate(detector, 0, risk);
        expect(strategy.evaluate(detector, 1, risk)).toMatchObject({ entryPassed: false, increase: 0.1 });
    });

    it.each([{ minimumIncrease: 0 }, { minimumIncrease: 101 }, { minimumIncrease: '' }, { stopLoss: 0 }, { maxLosses: 1.5 }])(
        'rejects invalid controls %o', overrides => expect(() => strategy.createRisk({ ...settings, ...overrides })).toThrow()
    );

    it('matches independent counts over a long, shifting tick sequence', () => {
        let seed = 1933;
        const digits = Array.from({ length: 3500 }, () => { seed = seed * 48271 % 2147483647; return seed % 10; });
        const detector = strategy.createDetector();
        const risk = strategy.createRisk(settings);
        digits.forEach((digit, index) => {
            const result = strategy.evaluate(detector, digit, risk);
            if (index < 1000) { expect(result).toBeNull(); return; }
            const previous = digits.slice(index - 1000, index).filter(value => value === digit).length;
            const current = digits.slice(index - 999, index + 1).filter(value => value === digit).length;
            expect(result.previousPercentage).toBe(previous / 10);
            expect(result.currentPercentage).toBe(current / 10);
            expect(result.entryPassed).toBe(current > previous);
        });
    });

    it('keeps processing ticks while a contract is open and uses confirmed loss recovery on the next fresh signal', async () => {
        let id = 0;
        const buy = jest.fn(order => Promise.resolve({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ strategy, settings, buy, round, journal: jest.fn(), refreshContract: async () => ({}) });
        for (let index = 0; index < 1000; index++) runtime.tick(0, index, false);
        runtime.tick(1, 1000);
        runtime.tick(2, 1001);
        expect(buy).toHaveBeenCalledTimes(1);
        expect(runtime.signals[1]).toMatchObject({ barrier: 2, status: 'skipped', reason: 'Previous contract is not settled' });
        await flush();
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        runtime.tick(3, 1002);
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 3, stake: 52.08 });
        await flush();
        runtime.settle({ contract_id: 2, status: 'won', sell_price: 57.08, profit: 5 });
        expect(runtime.risk.stake).toBe(5);
        expect(runtime.risk.inARow).toBe(0);
    });

    it.each([
        [{ ...settings, stopLoss: 5 }, { status: 'lost', sell_price: 0, profit: -5 }, 'Stop loss reached'],
        [{ ...settings, profitThreshold: 1 }, { status: 'won', sell_price: 6, profit: 1 }, 'Profit threshold reached'],
        [{ ...settings, maxLosses: 1 }, { status: 'lost', sell_price: 0, profit: -5 }, 'Maximum consecutive losses reached'],
    ])('stops after a confirmed result reaches the configured limit', async (config, outcome, reason) => {
        const onStop = jest.fn();
        const buy = jest.fn(async order => ({ buy: { contract_id: 1, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ strategy, settings: config, buy, round, onStop, journal: jest.fn(), refreshContract: async () => ({}) });
        for (let index = 0; index < 1000; index++) runtime.tick(0, index, false);
        runtime.tick(1, 1000);
        await flush();
        runtime.settle({ contract_id: 1, ...outcome });
        runtime.tick(2, 1001);
        expect(onStop).toHaveBeenCalledWith(reason);
        expect(buy).toHaveBeenCalledTimes(1);
    });
});
