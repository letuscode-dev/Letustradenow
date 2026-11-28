import { createMirrorBotSession } from '../mirror-bot-session';
import { leastDigitDecreaseStrategy as strategy } from '../least-digit-decrease';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const digits = () => [...Array(81).fill(0), ...Array(80).fill(1), ...Array.from({ length: 7 }, (_, i) => Array(105).fill(i + 2)).flat(), ...Array(104).fill(9)];

const makeApi = ({ failHistory = false, firstDigit = 9 } = {}) => {
    const listeners = new Set();
    const emit = data => listeners.forEach(listener => listener({ data }));
    const tick = (symbol, epoch, digit) => ({ msg_type: 'tick', subscription: { id: `ticks-${symbol}` },
        tick: { symbol, epoch, quote: 100 + digit / 100, pip_size: 2 } });
    const firstEpoch = symbol => symbol.startsWith('R_') ? 4001 : 2001;
    let contract = 0;
    const api = {
        connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
        onMessage: () => ({ subscribe: listener => { listeners.add(listener); return { unsubscribe: () => listeners.delete(listener) }; } }),
        send: jest.fn(async request => {
            if (request.proposal_open_contract && request.subscribe) return { subscription: { id: 'contracts' } };
            if (request.ticks) {
                const first = tick(request.ticks, firstEpoch(request.ticks), firstDigit);
                emit(first);
                return first;
            }
            if (request.ticks_history) {
                if (failHistory) throw new Error('History unavailable');
                const interval = request.ticks_history.startsWith('R_') ? 2 : 1;
                return { pip_size: 2, history: { times: digits().map((_, index) => firstEpoch(request.ticks_history) - (1000 - index) * interval),
                    prices: digits().map(digit => 100 + digit / 100) } };
            }
            if (request.buy) return { buy: { contract_id: ++contract, buy_price: request.price } };
            return {};
        }),
    };
    return { api, tick, emit, firstEpoch };
};

const makeSession = (live, symbols, journal = jest.fn(), onContract = jest.fn()) => createMirrorBotSession({
    getApi: () => live.api, getAccount: () => 'A', account: 'A', currency: 'USD',
    settings: { stake: 5, maxLosses: 2, profitThreshold: 10, symbols }, strategy, journal, onContract, onStop: jest.fn(),
    round: value => Math.round(value * 100) / 100,
});

it('loads 1,000 ticks per market and buys the falling least digit on the correct market', async () => {
    const live = makeApi();
    const journal = jest.fn();
    const onContract = jest.fn();
    const symbols = ['1HZ10V', 'R_10'];
    const session = makeSession(live, symbols, journal, onContract);
    await session.attach();
    const historyRequests = live.api.send.mock.calls.map(([request]) => request).filter(request => request.ticks_history);
    expect(historyRequests).toEqual(expect.arrayContaining([
        expect.objectContaining({ ticks_history: '1HZ10V', start: 1001, end: '2000', count: 1000 }),
        expect.objectContaining({ ticks_history: 'R_10', start: 2001, end: '3999', count: 1000 }),
    ]));
    await flush();
    const buys = () => live.api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
    expect(buys()).toHaveLength(1);
    expect(buys()[0]).toMatchObject({ price: 5, parameters: { contract_type: 'DIGITDIFF', underlying_symbol: '1HZ10V', barrier: '0' } });
    expect(onContract).toHaveBeenCalledWith(expect.objectContaining({ contract_id: 1, underlying_symbol: '1HZ10V', barrier: 0 }));
    expect(journal).toHaveBeenCalledWith(expect.objectContaining({ type: 'signal', symbol: 'R_10', barrier: 0, status: 'skipped' }));
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'lost', sell_price: 0, profit: -5 } });
    live.emit(live.tick('R_10', 4003, 9));
    await flush();
    expect(buys()[1]).toMatchObject({ price: 52.08, parameters: { underlying_symbol: 'R_10', barrier: '0' } });
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 2, status: 'won', sell_price: 57.08, profit: 5 } });
    expect(session.runtime.risk.stake).toBe(5);
    session.stop();
});

it('waits for 1,000 live ticks when history cannot be loaded', async () => {
    const live = makeApi({ failHistory: true, firstDigit: 0 });
    const journal = jest.fn();
    const session = makeSession(live, ['1HZ10V'], journal);
    await session.attach();
    digits().slice(1).forEach((digit, index) => live.emit(live.tick('1HZ10V', 2002 + index, digit)));
    expect(live.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
    live.emit(live.tick('1HZ10V', 3001, 9));
    await flush();
    const buy = live.api.send.mock.calls.map(([request]) => request).find(request => request.buy);
    expect(buy).toMatchObject({ parameters: { underlying_symbol: '1HZ10V', barrier: '0' } });
    expect(journal).toHaveBeenCalledWith(expect.objectContaining({ type: 'initial_tick_history_unavailable', symbol: '1HZ10V' }));
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'won', sell_price: 5.48, profit: 0.48 } });
    session.stop();
});


it('trades a ready market while another market subscription is still starting', async () => {
    const live = makeApi();
    const send = live.api.send.getMockImplementation();
    let releaseSecond;
    live.api.send.mockImplementation(request => {
        if (request.ticks === 'R_10') return new Promise(resolve => { releaseSecond = () => resolve(send(request)); });
        return send(request);
    });
    const journal = jest.fn();
    const session = makeSession(live, ['1HZ10V', 'R_10'], journal);
    const attaching = session.attach();
    await flush();
    expect(releaseSecond).toBeDefined();
    const buys = live.api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
    expect(buys).toHaveLength(1);
    expect(buys[0]).toMatchObject({ price: 5, parameters: { underlying_symbol: '1HZ10V', barrier: '0' } });
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 1, status: 'won', sell_price: 5.48, profit: 0.48 } });
    releaseSecond();
    await attaching;
    live.emit({ msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 2, status: 'won', sell_price: 5.48, profit: 0.48 } });
    session.stop();
});
