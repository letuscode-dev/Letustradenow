import { tripleHitConcentrationStrategy as strategy } from '../triple-hit-concentration';
import { createMirrorRuntime } from '../mirror-runtime';
import { createMirrorStream } from '../mirror-stream';

const settings = { stake: 5, maxLosses: 2, profitThreshold: 10, recoveryMultiplier: 100 / 9.6 };
const round = value => Math.round(value * 100) / 100;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const analyze = digits => {
    const detector = strategy.createDetector();
    return digits.map(digit => strategy.evaluate(detector, digit));
};

describe('Triple-Hit Concentration', () => {
    it('requires 10 ticks and selects the unique most frequent latest digit', () => {
        const results = analyze([4, 7, 4, 2, 4, 9, 1, 4, 6, 4]);
        expect(results.slice(0, 9).every(result => !result.entryPassed)).toBe(true);
        expect(results[9]).toMatchObject({ entryPassed: true, barrier: 4, dominantDigit: 4, dominantCount: 5,
            latestDigit: 4, frequencies: [0, 1, 1, 0, 5, 0, 1, 1, 0, 1] });
    });

    it.each([
        [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'No digit occurs at least three times'],
        [[4, 4, 4, 1, 1, 1, 2, 3, 5, 4], null],
        [[4, 4, 4, 1, 1, 2, 3, 5, 6, 1], 'Highest frequency is tied'],
        [[4, 4, 4, 1, 2, 3, 5, 6, 7, 1], 'Latest digit does not match the dominant digit'],
    ])('applies only the stated entry conditions', (digits, reason) => {
        const result = analyze(digits).pop();
        expect(result.reason).toBe(reason);
        expect(result.entryPassed).toBe(reason === null);
    });

    it('keeps exactly the latest 10 digits and updates every frequency', () => {
        const digits = [0, 0, 0, 1, 2, 3, 4, 5, 6, 0, 9, 9, 9, 9];
        const results = analyze(digits);
        results.forEach((result, index) => {
            const window = digits.slice(Math.max(0, index - 9), index + 1);
            expect(result.digits).toEqual(window);
            expect(result.frequencies).toEqual(Array.from({ length: 10 }, (_, digit) => window.filter(d => d === digit).length));
        });
        expect(results.at(-1)).toMatchObject({ entryPassed: true, barrier: 9 });
    });

    it('matches an independent frequency calculation across a long rolling sequence', () => {
        let seed = 1234567;
        const digits = Array.from({ length: 2000 }, () => {
            seed = (seed * 48271) % 2147483647;
            return seed % 10;
        });
        const results = analyze(digits);
        results.forEach((result, index) => {
            const window = digits.slice(Math.max(0, index - 9), index + 1);
            const counts = Array.from({ length: 10 }, (_, digit) => window.filter(value => value === digit).length);
            const maximum = Math.max(...counts);
            const leaders = counts.filter(count => count === maximum).length;
            expect(result.frequencies).toEqual(counts);
            expect(result.entryPassed).toBe(window.length === 10 && maximum >= 3 && leaders === 1 && counts[digits[index]] === maximum);
        });
    });

    it.each([{ stake: 0 }, { maxLosses: 1.5 }, { profitThreshold: 0 }, { recoveryMultiplier: '' }, { recoveryMultiplier: -1 }])(
        'rejects invalid controls %o', overrides => expect(() => strategy.createRisk({ ...settings, ...overrides })).toThrow()
    );

    it('continues analysis while busy, skips stale signals, and applies confirmed recovery immediately', async () => {
        let id = 0;
        const buy = jest.fn(order => Promise.resolve({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const journal = jest.fn();
        const runtime = createMirrorRuntime({ strategy, settings, journal, buy, round, refreshContract: async () => ({}) });
        [4, 7, 4, 2, 4, 9, 1, 4, 6, 4, 4].forEach((digit, index) => runtime.tick(digit, index + 1));
        await flush();
        expect(buy).toHaveBeenCalledTimes(1);
        expect(runtime.signals[10]).toMatchObject({ entryPassed: true, status: 'skipped', reason: 'Previous contract is not settled' });
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        runtime.tick(4, 12);
        expect(buy.mock.calls[1][0]).toEqual({ barrier: 4, stake: 52.08 });
        await flush();
        runtime.settle({ contract_id: 2, status: 'won', sell_price: 57.08, profit: 5 });
        expect(runtime.risk.stake).toBe(5);
        expect(strategy.statistics(runtime.risk)).toMatchObject({ totalSignals: 12, executedTrades: 2, skippedSignals: 10,
            wins: 1, losses: 1, winRate: 50, totalProfit: 0, maxConsecutiveLosses: 1 });
        expect(journal.mock.calls.map(([event]) => event).find(event => event.type === 'settlement')).toMatchObject({
            nextStake: 52.08, inARow: 1, statistics: expect.objectContaining({ losses: 1 }) });
    });

    it('enforces the loss limit and configured recovery multiplier', async () => {
        let id = 0;
        const onStop = jest.fn();
        const buy = jest.fn(order => Promise.resolve({ buy: { contract_id: ++id, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ strategy, settings: { ...settings, recoveryMultiplier: 2 }, journal: jest.fn(),
            buy, round, onStop, refreshContract: async () => ({}) });
        [4, 7, 4, 2, 4, 9, 1, 4, 6, 4].forEach((digit, index) => runtime.tick(digit, index));
        await flush();
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        runtime.tick(4, 11);
        expect(buy.mock.calls[1][0].stake).toBe(10);
        await flush();
        runtime.settle({ contract_id: 2, status: 'lost', sell_price: 0, profit: -10 });
        runtime.tick(4, 12);
        expect(buy).toHaveBeenCalledTimes(2);
        expect(onStop).toHaveBeenCalledWith('Maximum consecutive losses reached');
    });

    it('stops trading when confirmed profit reaches the target', async () => {
        const onStop = jest.fn();
        const buy = jest.fn(order => Promise.resolve({ buy: { contract_id: 1, buy_price: order.stake } }));
        const runtime = createMirrorRuntime({ strategy, settings: { ...settings, profitThreshold: 1 }, journal: jest.fn(),
            buy, round, onStop, refreshContract: async () => ({}) });
        [4, 7, 4, 2, 4, 9, 1, 4, 6, 4].forEach((digit, index) => runtime.tick(digit, index));
        await flush();
        runtime.settle({ contract_id: 1, status: 'won', sell_price: 6, profit: 1 });
        runtime.tick(4, 11);
        expect(onStop).toHaveBeenCalledWith('Profit threshold reached');
        expect(buy).toHaveBeenCalledTimes(1);
    });

    it('reports a confirmed purchase before an early settlement and stop', async () => {
        let confirm;
        const events = [];
        const onPurchase = jest.fn();
        const runtime = createMirrorRuntime({ strategy, settings: { ...settings, maxLosses: 1 },
            journal: event => events.push(event), onPurchase, onStop: jest.fn(), round,
            buy: () => new Promise(resolve => { confirm = resolve; }), refreshContract: async () => ({}) });
        [4, 7, 4, 2, 4, 9, 1, 4, 6, 4].forEach((digit, index) => runtime.tick(digit, index));
        runtime.settle({ contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        confirm({ buy: { contract_id: 1, buy_price: 5 } });
        await flush();
        const types = events.map(event => event.type);
        expect(types.indexOf('purchase')).toBeLessThan(types.indexOf('settlement'));
        expect(types.indexOf('settlement')).toBeLessThan(types.indexOf('stop'));
        expect(events.find(event => event.type === 'purchase').statistics).toMatchObject({ executedTrades: 1, losses: 0 });
        expect(onPurchase).toHaveBeenCalledTimes(1);
    });

    it('stops on an unconfirmed purchase without assuming it did not execute', async () => {
        const onStop = jest.fn();
        const runtime = createMirrorRuntime({ strategy, settings, journal: jest.fn(), onStop,
            buy: () => Promise.reject(new Error('Connection lost')), round, refreshContract: async () => ({}) });
        [4, 7, 4, 2, 4, 9, 1, 4, 6, 4].forEach((digit, index) => runtime.tick(digit, index));
        await flush();
        expect(onStop).toHaveBeenCalledWith('Purchase was rejected or not confirmed; check account before restarting');
        expect(runtime.risk.stats).toMatchObject({ executedTrades: 0, skippedSignals: 9, unconfirmedPurchases: 1 });
    });

    it('analyzes recovered and buffered ticks in order without executing stale signals', async () => {
        let finishHistory;
        const seen = [];
        const runtime = { staleBufferedAnalysisOnly: true, tick: (digit, epoch, live) => seen.push([digit, epoch, live]),
            resetWindow: jest.fn(), stop: jest.fn() };
        const stream = createMirrorStream({ runtime, journal: jest.fn(), history: () => new Promise(resolve => { finishHistory = resolve; }) });
        stream.ingest({ epoch: 1, digit: 1 });
        stream.ingest({ epoch: 3, digit: 3 });
        await Promise.resolve();
        stream.ingest({ epoch: 4, digit: 4 });
        finishHistory([{ epoch: 2, digit: 2 }]);
        await flush();
        expect(seen).toEqual([[1, 1, true], [2, 2, false], [3, 3, false], [4, 4, true]]);
    });
});
