import { createMirrorBotSession } from '../mirror-bot-session';
import { tripleHitConcentrationStrategy } from '../triple-hit-concentration';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

it('buys the dominant digit on a live signal and tracks the confirmed result', async () => {
    let listener;
    const tick = (epoch, digit) => ({ msg_type: 'tick', subscription: { id: 'ticks' },
        tick: { symbol: '1HZ75V', epoch, quote: 100 + digit / 100, pip_size: 2 } });
    const api = {
        connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
        onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
        send: jest.fn(request => {
            if (request.ticks) { const first = tick(1, 4); listener({ data: first }); return Promise.resolve(first); }
            if (request.proposal_open_contract && !request.contract_id) return Promise.resolve({ subscription: { id: 'all-contracts' } });
            if (request.buy) return Promise.resolve({ buy: { contract_id: 11, buy_price: request.price, start_time: 10 } });
            return Promise.resolve({});
        }),
    };
    const onContract = jest.fn();
    const journal = jest.fn();
    const session = createMirrorBotSession({ getApi: () => api, getAccount: () => 'A', account: 'A', currency: 'USD',
        settings: { stake: 5, maxLosses: 2, profitThreshold: 10, recoveryMultiplier: 100 / 9.6 },
        strategy: tripleHitConcentrationStrategy, journal, onStop: jest.fn(), onContract,
        round: value => Math.round(value * 100) / 100 });
    await session.attach();
    [7, 4, 2, 4, 9, 1, 4, 6, 4].forEach((digit, index) => listener({ data: tick(index + 2, digit) }));
    const order = api.send.mock.calls.map(([request]) => request).find(request => request.buy);
    expect(order).toMatchObject({ buy: '1', price: 5, parameters: { contract_type: 'DIGITDIFF', underlying_symbol: '1HZ75V',
        barrier: '4', duration: 1, duration_unit: 't' } });
    await flush();
    listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
        contract_id: 11, status: 'won', sell_price: 5.48, profit: 0.48,
    } } });
    expect(onContract).toHaveBeenCalledWith(expect.objectContaining({ contract_id: 11, status: 'won', profit: 0.48 }));
    expect(journal.mock.calls.map(([event]) => event).find(event => event.type === 'purchase')).toMatchObject({
        contractId: 11, entryTimestamp: 10, barrier: 4, stake: 5, duration: 1, confirmed: true });
    expect(session.runtime.risk.stats.wins).toBe(1);
    session.stop();
});

it('keeps evaluating ticks during a pending buy and applies an early loss to the next fresh signal', async () => {
    let listener;
    let confirmFirst;
    const tick = (epoch, digit) => ({ msg_type: 'tick', subscription: { id: 'ticks' },
        tick: { symbol: '1HZ75V', epoch, quote: 100 + digit / 100, pip_size: 2 } });
    const api = {
        connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
        onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
        send: jest.fn(request => {
            if (request.ticks) { const first = tick(1, 4); listener({ data: first }); return Promise.resolve(first); }
            if (request.proposal_open_contract && !request.contract_id) return Promise.resolve({ subscription: { id: 'all-contracts' } });
            if (request.buy && request.price === 5) return new Promise(resolve => { confirmFirst = resolve; });
            if (request.buy) return Promise.resolve({ buy: { contract_id: 12, buy_price: request.price } });
            return Promise.resolve({});
        }),
    };
    const onStop = jest.fn();
    const journal = jest.fn();
    const session = createMirrorBotSession({ getApi: () => api, getAccount: () => 'A', account: 'A', currency: 'USD',
        settings: { stake: 5, maxLosses: 2, profitThreshold: 10, recoveryMultiplier: 100 / 9.6 },
        strategy: tripleHitConcentrationStrategy, journal, onStop, round: value => Math.round(value * 100) / 100 });
    await session.attach();
    [7, 4, 2, 4, 9, 1, 4, 6, 4].forEach((digit, index) => listener({ data: tick(index + 2, digit) }));
    listener({ data: tick(11, 4) });
    listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
        contract_id: 11, status: 'lost', sell_price: 0, profit: -5,
    } } });
    expect(session.runtime.signals.at(-1)).toMatchObject({ latestDigit: 4, status: 'skipped', entryPassed: true });
    expect(api.send.mock.calls.filter(([request]) => request.buy)).toHaveLength(1);
    confirmFirst({ buy: { contract_id: 11, buy_price: 5 } });
    await flush();
    const firstEvents = journal.mock.calls.map(([event]) => event);
    const purchase = firstEvents.findIndex(event => event.type === 'purchase' && event.contractId === 11);
    const settlement = firstEvents.findIndex(event => event.type === 'settlement' && event.contract_id === 11);
    expect(purchase).toBeGreaterThanOrEqual(0);
    expect(settlement).toBeGreaterThan(purchase);
    expect(firstEvents[purchase].statistics).toMatchObject({ executedTrades: 1, losses: 0 });
    expect(session.runtime.risk.stake).toBe(52.08);
    listener({ data: tick(12, 4) });
    expect(api.send.mock.calls.filter(([request]) => request.buy).map(([request]) => request.price)).toEqual([5, 52.08]);
    await flush();
    listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
        contract_id: 12, status: 'lost', sell_price: 0, profit: -52.08,
    } } });
    expect(onStop).toHaveBeenCalledWith('Maximum consecutive losses reached');
    expect(session.runtime.risk.stats).toMatchObject({ executedTrades: 2, losses: 2, maxConsecutiveLosses: 2 });
    expect(journal.mock.calls.map(([event]) => event).filter(event => event.type === 'settlement')).toHaveLength(2);
});
