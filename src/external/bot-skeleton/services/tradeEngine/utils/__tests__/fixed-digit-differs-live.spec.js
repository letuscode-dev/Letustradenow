import { createMirrorBotSession } from '../mirror-bot-session';
import { fixedDigitDiffersStrategy } from '../fixed-digit-differs';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('fixed Digit Differs Deriv session', () => {
    it('captures early settlement and recovers on the next queued tick with one shared status stream', async () => {
        let listener;
        let confirmFirst;
        let nextId = 10;
        const tick = (epoch, digit) => ({ msg_type: 'tick', subscription: { id: 'ticks' },
            tick: { symbol: '1HZ75V', epoch, quote: 100 + digit / 100, pip_size: 2 } });
        const api = {
            connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(request => {
                if (request.ticks) { const first = tick(1, 4); listener({ data: first }); return Promise.resolve(first); }
                if (request.proposal_open_contract && !request.contract_id) return Promise.resolve({ subscription: { id: 'all-contracts' } });
                if (request.buy) {
                    const id = ++nextId;
                    if (id === 11) return new Promise(resolve => { confirmFirst = () => resolve({ buy: { contract_id: id, buy_price: request.price } }); });
                    return Promise.resolve({ buy: { contract_id: id, buy_price: request.price } });
                }
                return Promise.resolve({});
            }),
        };
        const onContract = jest.fn();
        const session = createMirrorBotSession({ getApi: () => api, getAccount: () => 'A', account: 'A', currency: 'USD',
            settings: { prediction: 7, stake: 1, takeProfit: 10, stopLoss: 50 }, strategy: fixedDigitDiffersStrategy,
            journal: jest.fn(), onStop: jest.fn(), onContract, round: value => Math.round(value * 100) / 100 });
        await session.attach();
        listener({ data: tick(2, 2) });
        listener({ data: tick(3, 7) });
        expect(session.runtime.queuedSignals()).toBe(2);
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
            contract_id: 11, status: 'lost', sell_price: 0, profit: -1,
        } } });
        confirmFirst();
        await flush();
        let buys = api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
        expect(buys).toHaveLength(2);
        expect(buys[0]).toMatchObject({ price: 1, parameters: { barrier: '7', duration: 1 } });
        expect(buys[1]).toMatchObject({ price: 10.42, parameters: { barrier: '7', duration: 1 } });
        expect(onContract).toHaveBeenCalledWith(expect.objectContaining({ contract_id: 11, status: 'lost', profit: -1 }));
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
            contract_id: 12, status: 'won', sell_price: 11.42, profit: 1,
        } } });
        await flush();
        buys = api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
        expect(buys[2]).toMatchObject({ price: 1, parameters: { barrier: '7' } });
        expect(api.send.mock.calls.filter(([request]) => request.proposal_open_contract)).toHaveLength(1);
        session.stop();
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
            contract_id: 13, status: 'won', sell_price: 1.1, profit: 0.1,
        } } });
        await flush();
    });
});
