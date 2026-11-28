import { createMirrorBotSession as createSharedSession } from '../mirror-bot-session';
import { createMirrorDerivStream } from '../mirror-deriv-stream';
import { createTestSignalStrategy } from '../../../../../../test-utils/trade-signal-strategy';

const createMirrorBotSession = options => createSharedSession({ strategy: createTestSignalStrategy(), ...options });

jest.mock('../mirror-deriv-stream', () => ({
    createMirrorDerivStream: jest.fn(),
}));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('mirror Deriv session', () => {
    it('submits direct one-tick differs buys and tracks the confirmed contract', async () => {
        const stream = { attach: jest.fn().mockResolvedValue(), detach: jest.fn() };
        createMirrorDerivStream.mockReturnValue(stream);
        const api = { send: jest.fn(async body => body.buy
            ? { buy: { contract_id: 11, buy_price: 5 } }
            : { proposal_open_contract: { contract_id: 11, status: 'open' } }) };
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A',
            currency: 'USD', settings: {}, journal: jest.fn(), round: x => x, onStop: jest.fn() });
        await session.attach();
        [7, 4, 7].forEach((digit, index) => session.runtime.tick(digit, index));
        await flush();
        expect(api.send.mock.calls[0][0]).toEqual({ buy: '1', price: 5, parameters: {
            amount: 5, basis: 'stake', contract_type: 'DIGITDIFF', currency: 'USD',
            duration: 1, duration_unit: 't', underlying_symbol: '1HZ75V', barrier: '4',
        } });
        expect(session.runtime.tracker.active.has('11')).toBe(true);
        session.stop();
        expect(stream.detach).not.toHaveBeenCalled();
        session.runtime.settle({ contract_id: 11, status: 'won', sell_price: 5.48, profit: 0.48 });
        expect(stream.detach).toHaveBeenCalled();
    });

    it('stops rather than buy on a different account', async () => {
        const stream = { attach: jest.fn().mockResolvedValue(), detach: jest.fn() };
        createMirrorDerivStream.mockReturnValue(stream);
        const api = { send: jest.fn() };
        const onStop = jest.fn();
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'B',
            currency: 'USD', settings: {}, journal: jest.fn(), round: x => x, onStop });
        await session.attach();
        expect(onStop).toHaveBeenCalledWith('The active account changed');
        expect(api.send).not.toHaveBeenCalled();
    });

    it('reconciles a confirmed contract after its status request is interrupted', async () => {
        let rejectStatus;
        let disconnect;
        const stream = { attach: jest.fn().mockResolvedValue(), detach: jest.fn() };
        createMirrorDerivStream.mockImplementation(options => { disconnect = options.onDisconnect; return stream; });
        let api = { connection: { readyState: 1 }, send: jest.fn(body => body.buy
            ? Promise.resolve({ buy: { contract_id: 11, buy_price: 5 } })
            : new Promise((_, reject) => { rejectStatus = reject; })) };
        const onStop = jest.fn();
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A',
            currency: 'USD', settings: {}, journal: jest.fn(), round: x => x, onStop });
        await session.attach();
        [7, 4, 7].forEach((digit, index) => session.runtime.tick(digit, index));
        await flush();
        api.connection.readyState = 3;
        disconnect();
        rejectStatus(new Error('Connection closed'));
        await flush();
        expect(onStop).not.toHaveBeenCalled();
        api = { connection: { readyState: 1 }, send: jest.fn(async () => ({
            proposal_open_contract: { contract_id: 11, status: 'won', sell_price: 5.48, profit: 0.48 },
        })) };
        await session.attach();
        expect(session.runtime.risk.totalProfit).toBe(0.48);
        expect(session.runtime.tracker.active.size).toBe(0);
    });

    it('does not buy a queued recovery until reconnection finishes', async () => {
        let disconnect;
        let finishReconnect;
        const stream = { attach: jest.fn().mockResolvedValueOnce().mockImplementationOnce(
            () => new Promise(resolve => { finishReconnect = resolve; })
        ), detach: jest.fn() };
        createMirrorDerivStream.mockImplementation(options => { disconnect = options.onDisconnect; return stream; });
        let api = { connection: { readyState: 1 }, send: jest.fn(async request => request.buy
            ? { buy: { contract_id: 1, buy_price: request.price } }
            : { proposal_open_contract: { contract_id: 1, status: 'open' } }) };
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A', currency: 'USD',
            settings: {}, journal: jest.fn(), round: value => Math.round(value * 100) / 100, onStop: jest.fn() });
        await session.attach();
        [7, 4, 7, 4].forEach(digit => session.runtime.tick(digit, 1));
        await flush();
        expect(session.runtime.queuedSignals()).toBe(1);
        api.connection.readyState = 3;
        disconnect();
        api = { connection: { readyState: 1 }, send: jest.fn(async request => request.buy
            ? { buy: { contract_id: 2, buy_price: request.price } }
            : { proposal_open_contract: { contract_id: 1, status: 'lost', sell_price: 0, profit: -5 } }) };
        const reconnect = session.attach();
        await flush();
        expect(api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
        finishReconnect();
        await reconnect;
        const buy = api.send.mock.calls.map(([request]) => request).find(request => request.buy);
        expect(buy).toMatchObject({ price: 52.08, parameters: { barrier: '7' } });
    });

    it('waits for tick-history recovery before submitting a queued recovery', async () => {
        let disconnect;
        let finishHistory;
        const stream = { attach: jest.fn().mockResolvedValue(), detach: jest.fn(),
            whenReady: jest.fn().mockResolvedValueOnce().mockImplementationOnce(
                () => new Promise(resolve => { finishHistory = resolve; })
            ) };
        createMirrorDerivStream.mockImplementation(options => { disconnect = options.onDisconnect; return stream; });
        let api = { connection: { readyState: 1 }, send: jest.fn(async request => request.buy
            ? { buy: { contract_id: 1, buy_price: request.price } }
            : { proposal_open_contract: { contract_id: 1, status: 'open' } }) };
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A', currency: 'USD',
            settings: {}, journal: jest.fn(), round: value => Math.round(value * 100) / 100, onStop: jest.fn() });
        await session.attach();
        [7, 4, 7, 4].forEach(digit => session.runtime.tick(digit, 1));
        await flush();
        api.connection.readyState = 3;
        disconnect();
        api = { connection: { readyState: 1 }, send: jest.fn(async request => request.buy
            ? { buy: { contract_id: 2, buy_price: request.price } }
            : { proposal_open_contract: { contract_id: 1, status: 'lost', sell_price: 0, profit: -5 } }) };
        const reconnect = session.attach();
        await flush();
        expect(api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
        finishHistory();
        await reconnect;
        expect(api.send.mock.calls.map(([request]) => request).find(request => request.buy))
            .toMatchObject({ price: 52.08, parameters: { barrier: '7' } });
    });
});
