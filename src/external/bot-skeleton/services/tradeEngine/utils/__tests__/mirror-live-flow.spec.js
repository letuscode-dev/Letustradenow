import { createMirrorBotSession } from '../mirror-bot-session';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('mirror bot event flow', () => {
    it('trades on the first live tick when two preceding cached ticks complete a mirror', async () => {
        let listener;
        const api = {
            connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async request => {
                if (request.ticks) {
                    const first = { msg_type: 'tick', subscription: { id: 'ticks' },
                        tick: { symbol: '1HZ75V', epoch: 3, quote: 100.07, pip_size: 2 } };
                    listener({ data: first });
                    return first;
                }
                if (request.buy) return { buy: { contract_id: 1, buy_price: request.price } };
                return { proposal_open_contract: { contract_id: 1, status: 'open' } };
            }),
        };
        const session = createMirrorBotSession({ getApi: () => api, getAccount: () => 'A', account: 'A', currency: 'USD',
            settings: {}, journal: jest.fn(), onStop: jest.fn(), round: value => value,
            getInitialTicks: () => [{ epoch: 1, quote: 100.07 }, { epoch: 2, quote: 100.04 }] });
        await session.attach();
        const buy = api.send.mock.calls.map(([request]) => request).find(request => request.buy);
        expect(buy).toMatchObject({ parameters: { barrier: '4', contract_type: 'DIGITDIFF' } });
    });

    it('trades the middle digit, applies confirmed recovery, and stops after two losses', async () => {
        let listener;
        let nextId = 0;
        const journal = jest.fn();
        const onStop = jest.fn();
        const tick = (epoch, digit) => ({ msg_type: 'tick', subscription: { id: 'ticks' },
            tick: { symbol: '1HZ75V', epoch, quote: 100 + digit / 100, pip_size: 2 } });
        const api = {
            connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async request => {
                if (request.ticks) { const first = tick(1, 7); listener({ data: first }); return first; }
                if (request.buy) return { buy: { contract_id: ++nextId, buy_price: request.price } };
                if (request.proposal_open_contract) return { proposal_open_contract: { contract_id: request.contract_id, status: 'open' },
                    subscription: { id: `contract-${request.contract_id}` } };
                return {};
            }),
        };
        const session = createMirrorBotSession({ getApi: () => api, getAccount: () => 'A', account: 'A', currency: 'USD',
            settings: {}, journal, onStop, round: value => Math.round(value * 100) / 100 });
        await session.attach();
        listener({ data: tick(2, 4) });
        listener({ data: tick(3, 7) });
        await flush();
        let buys = api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
        expect(buys).toHaveLength(1);
        expect(buys[0]).toMatchObject({ price: 5, parameters: { contract_type: 'DIGITDIFF', barrier: '4', duration: 1 } });
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
            contract_id: 1, status: 'lost', sell_price: 0, profit: -5,
        } } });
        expect(session.runtime.risk.stake).toBe(52.08);
        listener({ data: tick(4, 1) });
        listener({ data: tick(5, 4) });
        listener({ data: tick(6, 1) });
        await flush();
        buys = api.send.mock.calls.map(([request]) => request).filter(request => request.buy);
        expect(buys).toHaveLength(2);
        expect(buys[1]).toMatchObject({ price: 52.08, parameters: { barrier: '4' } });
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
            contract_id: 2, status: 'lost', sell_price: 0, profit: -52.08,
        } } });
        expect(onStop).toHaveBeenCalledWith('Maximum consecutive losses reached');
        expect(session.runtime.isEnabled()).toBe(false);
        expect(journal.mock.calls.filter(([event]) => event.type === 'settlement')).toHaveLength(2);
    });
});
