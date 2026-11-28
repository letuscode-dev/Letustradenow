import { createMirrorBotSession } from '../mirror-bot-session';
import { fourDigitMirrorStrategy } from '../four-digit-mirror';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const createApi = (initialTicks = {}, options = {}) => {
    const listeners = new Set();
    const closeListeners = new Set();
    const emit = data => listeners.forEach(listener => listener({ data }));
    const tick = (symbol, epoch, digit) => ({ msg_type: 'tick', subscription: { id: `ticks-${symbol}` },
        tick: { symbol, epoch, quote: 100 + digit / 100, pip_size: 2 } });
    let nextContract = 1;
    const api = {
        connection: { readyState: 1, addEventListener: (_name, fn) => closeListeners.add(fn),
            removeEventListener: (_name, fn) => closeListeners.delete(fn) },
        onMessage: () => ({ subscribe: fn => { listeners.add(fn); return { unsubscribe: () => listeners.delete(fn) }; } }),
        send: jest.fn(async request => {
            if (request.ticks) {
                const [epoch, digit] = initialTicks[request.ticks] || [1, 9];
                const first = tick(request.ticks, epoch, digit);
                emit(first);
                return first;
            }
            if (request.buy) return options.buy ? options.buy(request) : { buy: { contract_id: nextContract++, buy_price: request.price } };
            if (request.proposal_open_contract && request.subscribe) return { subscription: { id: 'contracts' } };
            if (request.proposal_open_contract) return { proposal_open_contract: { contract_id: request.contract_id, status: 'open' } };
            return {};
        }),
    };
    return { api, emit, tick, disconnect: () => { api.connection.readyState = 3; [...closeListeners].forEach(fn => fn()); } };
};

it('buys B on the market that produced the pattern, skips busy signals, and applies confirmed recovery', async () => {
    const live = createApi();
    const journal = jest.fn();
    const display = jest.fn();
    const session = createMirrorBotSession({ getApi: () => live.api, getAccount: () => 'A', account: 'A', currency: 'USD',
        settings: { stake: 5, maxLosses: 2, profitThreshold: 10, symbols: ['1HZ10V', '1HZ75V'] }, strategy: fourDigitMirrorStrategy,
        journal, onContract: display, onStop: jest.fn(), round: value => Math.round(value * 100) / 100 });
    await session.attach();
    const a = '1HZ10V'; const b = '1HZ75V';
    [1, 2, 1, 2].forEach((digit, index) => live.emit(live.tick(a, index + 2, digit)));
    [7, 8, 7, 8].forEach((digit, index) => live.emit(live.tick(b, index + 2, digit)));
    await flush();
    const buys = () => live.api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
    expect(buys()).toHaveLength(1);
    expect(buys()[0]).toMatchObject({ price: 5, parameters: { underlying_symbol: a, barrier: '2', contract_type: 'DIGITDIFF' } });
    expect(display).toHaveBeenCalledWith(expect.objectContaining({ contract_id: 1, underlying_symbol: a, barrier: 2 }));
    expect(journal).toHaveBeenCalledWith(expect.objectContaining({ type: 'signal', symbol: b, pattern: '7-8-7-8', status: 'skipped' }));
    display.mockClear();
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'open' } });
    expect(display).toHaveBeenCalledTimes(1);
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'lost', sell_price: 0, profit: -5 } });
    live.emit(live.tick(b, 6, 7));
    await flush();
    expect(buys()).toHaveLength(2);
    expect(buys()[1]).toMatchObject({ price: 52.08, parameters: { underlying_symbol: b, barrier: '7' } });
    expect(display).toHaveBeenCalledWith(expect.objectContaining({ contract_id: 2, underlying_symbol: b, barrier: 7 }));
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 2, status: 'won', sell_price: 57.08, profit: 5 } });
    expect(session.runtime.risk.stake).toBe(5);
    session.stop();
    expect(session.isCleaned()).toBe(true);
});

it('applies a settlement received before its buy response before accepting the next market signal', async () => {
    let confirmBuy;
    let requests = 0;
    const journal = jest.fn();
    const live = createApi({}, { buy: request => ++requests === 1
        ? new Promise(resolve => { confirmBuy = () => resolve({ buy: { contract_id: 1, buy_price: request.price } }); })
        : Promise.resolve({ buy: { contract_id: 2, buy_price: request.price } }) });
    const session = createMirrorBotSession({ getApi: () => live.api, getAccount: () => 'A', account: 'A', currency: 'USD',
        settings: { stake: 5, maxLosses: 2, profitThreshold: 10, symbols: ['1HZ10V', '1HZ75V'] }, strategy: fourDigitMirrorStrategy,
        journal, onStop: jest.fn(), round: value => Math.round(value * 100) / 100 });
    await session.attach();
    [1, 2, 1, 2].forEach((digit, index) => live.emit(live.tick('1HZ10V', index + 2, digit)));
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'lost', sell_price: 0, profit: -5 } });
    [7, 8, 7, 8].forEach((digit, index) => live.emit(live.tick('1HZ75V', index + 2, digit)));
    expect(requests).toBe(1);
    confirmBuy();
    await flush();
    expect(session.runtime.risk.stake).toBe(52.08);
    const events = journal.mock.calls.map(([event]) => event.type);
    expect(events).toContain('purchase');
    expect(events).toContain('settlement');
    expect(events.indexOf('purchase')).toBeLessThan(events.indexOf('settlement'));
    live.emit(live.tick('1HZ75V', 6, 7));
    await flush();
    const buys = live.api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
    expect(buys[1]).toMatchObject({ price: 52.08, parameters: { underlying_symbol: '1HZ75V', barrier: '7' } });
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 2, status: 'won', sell_price: 57.08, profit: 5 } });
    session.stop();
});

it('detects a four-tick pattern on a standard two-second market', async () => {
    const live = createApi();
    const session = createMirrorBotSession({ getApi: () => live.api, getAccount: () => 'A', account: 'A', currency: 'USD',
        settings: { stake: 5, maxLosses: 2, profitThreshold: 10, symbols: ['R_10'] }, strategy: fourDigitMirrorStrategy,
        journal: jest.fn(), onStop: jest.fn(), round: value => Math.round(value * 100) / 100 });
    await session.attach();
    [3, 9, 3].forEach((digit, index) => live.emit(live.tick('R_10', 3 + index * 2, digit)));
    await flush();
    const buy = live.api.send.mock.calls.map(([request]) => request).find(request => request.buy);
    expect(buy).toMatchObject({ parameters: { underlying_symbol: 'R_10', barrier: '3' } });
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'won', sell_price: 5.48, profit: 0.48 } });
    session.stop();
});

it('resumes multiple markets after reconnect without replaying their subscription snapshots', async () => {
    let live = createApi();
    const session = createMirrorBotSession({ getApi: () => live.api, getAccount: () => 'A', account: 'A', currency: 'USD',
        settings: { stake: 5, maxLosses: 2, profitThreshold: 10, symbols: ['1HZ10V', '1HZ75V'] }, strategy: fourDigitMirrorStrategy,
        journal: jest.fn(), onStop: jest.fn(), round: value => Math.round(value * 100) / 100 });
    await session.attach();
    [1, 2, 1].forEach((digit, index) => live.emit(live.tick('1HZ10V', index + 2, digit)));
    [5, 6, 5].forEach((digit, index) => live.emit(live.tick('1HZ75V', index + 2, digit)));
    live.disconnect();
    live = createApi({ '1HZ10V': [4, 1], '1HZ75V': [4, 5] });
    await session.attach();
    expect(live.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
    live.emit(live.tick('1HZ75V', 5, 6));
    await flush();
    const buy = live.api.send.mock.calls.map(([request]) => request).find(request => request.buy);
    expect(buy).toMatchObject({ parameters: { underlying_symbol: '1HZ75V', barrier: '6' } });
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'won', sell_price: 5.48, profit: 0.48 } });
    session.stop();
});
