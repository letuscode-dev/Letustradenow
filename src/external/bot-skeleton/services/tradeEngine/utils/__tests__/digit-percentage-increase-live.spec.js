import { createMirrorBotSession } from '../mirror-bot-session';
import { digitPercentageIncreaseStrategy as strategy } from '../digit-percentage-increase';

const settings = { minimumIncrease: 0.1, stake: 5, maxLosses: 2, profitThreshold: 10, stopLoss: 50, recoveryMultiplier: 100 / 9.6 };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const makeApi = history => {
    let listener;
    let close;
    const tick = (epoch, digit) => ({ msg_type: 'tick', subscription: { id: 'ticks' },
        tick: { symbol: '1HZ75V', epoch, quote: 100 + digit / 100, pip_size: 2 } });
    const api = {
        connection: { readyState: 1, addEventListener: (_name, callback) => { close = callback; }, removeEventListener: jest.fn() },
        onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
        send: jest.fn(request => {
            if (request.proposal_open_contract && !request.contract_id) return Promise.resolve({ subscription: { id: 'all' } });
            if (request.ticks) { const first = tick(1001, 9); listener({ data: first }); return Promise.resolve(first); }
            if (request.ticks_history) return history(request);
            if (request.buy) return Promise.resolve({ buy: { contract_id: 11, buy_price: request.price } });
            return Promise.resolve({});
        }),
    };
    return { api, tick, emit: data => listener({ data }), disconnect: () => close() };
};

const sessionFor = (api, journal = jest.fn()) => createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A',
    currency: 'USD', settings, strategy, journal, onStop: jest.fn(), round: value => Math.round(value * 100) / 100 });

it('loads a complete history and buys the increasing digit on the first fresh live tick', async () => {
    const live = makeApi(() => Promise.resolve({ pip_size: 2, history: {
        times: Array.from({ length: 1000 }, (_, index) => index + 1),
        prices: Array.from({ length: 1000 }, (_, index) => 100 + (index % 10) / 100),
    } }));
    const journal = jest.fn();
    const session = sessionFor(live.api, journal);
    await session.attach();
    const requests = live.api.send.mock.calls.map(([request]) => request);
    expect(requests.find(request => request.ticks_history)).toMatchObject({ start: 1, end: '1000', count: 1000, style: 'ticks' });
    expect(requests.find(request => request.buy)).toMatchObject({ buy: '1', price: 5, parameters: {
        contract_type: 'DIGITDIFF', underlying_symbol: '1HZ75V', barrier: '9', duration: 1, duration_unit: 't' } });
    expect(journal).toHaveBeenCalledWith(expect.objectContaining({ type: 'initial_history_ready', count: 1000 }));
    await flush();
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 11, status: 'won', sell_price: 5.48, profit: 0.48 } });
    expect(session.runtime.risk.stats.wins).toBe(1);
    session.stop();
});

it('continues collecting live ticks when initial history is unavailable', async () => {
    const live = makeApi(() => Promise.reject(new Error('History unavailable')));
    const journal = jest.fn();
    const session = sessionFor(live.api, journal);
    await session.attach();
    for (let epoch = 1002; epoch <= 2000; epoch++) live.emit(live.tick(epoch, 9));
    expect(live.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
    live.emit(live.tick(2001, 3));
    expect(live.api.send.mock.calls.map(([request]) => request).find(request => request.buy))
        .toMatchObject({ price: 5, parameters: { barrier: '3' } });
    expect(journal).toHaveBeenCalledWith(expect.objectContaining({ type: 'initial_tick_history_unavailable',
        reason: expect.stringContaining('collecting live ticks instead') }));
    await flush();
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 11, status: 'won', sell_price: 5.48, profit: 0.48 } });
    session.stop();
});

it('analyzes buffered ticks in order and does not buy on an outdated signal', async () => {
    let resolveHistory;
    const live = makeApi(() => new Promise(resolve => { resolveHistory = resolve; }));
    const journal = jest.fn();
    const session = sessionFor(live.api, journal);
    const attaching = session.attach();
    await flush();
    live.emit(live.tick(1002, 8));
    resolveHistory({ pip_size: 2, history: { times: Array.from({ length: 1000 }, (_, index) => index + 1),
        prices: Array.from({ length: 1000 }, (_, index) => 100 + (index % 10) / 100) } });
    await attaching;
    const signals = journal.mock.calls.map(([event]) => event).filter(event => event.type === 'signal');
    expect(signals[0]).toMatchObject({ barrier: 9, status: 'restricted', reason: 'Recovered or buffered historical tick' });
    expect(live.api.send.mock.calls.map(([request]) => request).filter(request => request.buy))
        .toMatchObject([{ price: 5, parameters: { barrier: '8' } }]);
    await flush();
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 11, status: 'won', sell_price: 5.48, profit: 0.48 } });
    session.stop();
});

it('stops promptly if initial history never returns', async () => {
    const live = makeApi(() => new Promise(() => {}));
    const session = sessionFor(live.api);
    const attaching = session.attach();
    await flush();
    session.stop();
    await attaching;
    expect(session.isCleaned()).toBe(true);
    expect(live.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
});

it('does not buy an old last buffered tick when history is delayed', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(10000);
    let resolveHistory;
    const live = makeApi(() => new Promise(resolve => { resolveHistory = resolve; }));
    const journal = jest.fn();
    const session = sessionFor(live.api, journal);
    try {
        const attaching = session.attach();
        await flush();
        clock.mockReturnValue(11000);
        resolveHistory({ pip_size: 2, history: { times: Array.from({ length: 1000 }, (_, index) => index + 1),
            prices: Array.from({ length: 1000 }, (_, index) => 100 + (index % 10) / 100) } });
        await attaching;
        expect(live.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
        expect(journal).toHaveBeenCalledWith(expect.objectContaining({ type: 'signal', barrier: 9,
            status: 'restricted', reason: 'Recovered or buffered historical tick' }));
        live.emit(live.tick(1002, 8));
        expect(live.api.send.mock.calls.some(([request]) => request.buy)).toBe(true);
    } finally {
        session.stop();
        clock.mockRestore();
    }
});
