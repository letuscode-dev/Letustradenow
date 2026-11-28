import { createMirrorBotSession } from '../mirror-bot-session';
import { applyMirrorSettlement, createMirrorRiskState } from '../mirror-risk';
import { createMirrorDerivStream } from '../mirror-deriv-stream';

jest.mock('../mirror-deriv-stream', () => ({ createMirrorDerivStream: jest.fn() }));

const settings = { stake: 1, maxLosses: 1, profitThreshold: 10 };
const testStrategy = {
    monitorAllContracts: true,
    createRisk: createMirrorRiskState,
    createDetector: () => ({ tickIndex: 0 }),
    evaluate: detector => ({ tickIndex: ++detector.tickIndex, barrier: 2 }),
    reset() {},
    applySettlement: applyMirrorSettlement,
};

describe('contract status monitoring', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        createMirrorDerivStream.mockReturnValue({ attach: jest.fn().mockResolvedValue(), detach: jest.fn() });
    });
    afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

    it('reuses one account-wide status subscription across bot runs', async () => {
        const api = { connection: { readyState: 1 }, send: jest.fn(async request => {
            if (request.proposal_open_contract && request.subscribe) return { subscription: { id: 'all' } };
            return {};
        }) };
        const options = { getApi: () => api, account: 'A', getAccount: () => 'A', currency: 'USD', settings,
            strategy: testStrategy, journal: jest.fn(), round: value => value, onStop: jest.fn() };
        const first = createMirrorBotSession(options);
        const second = createMirrorBotSession(options);
        await Promise.all([first.attach(), second.attach()]);
        first.stop();
        expect(api.send.mock.calls.filter(([request]) => request.proposal_open_contract)).toHaveLength(1);
        expect(api.send.mock.calls.some(([request]) => request.forget === 'all')).toBe(false);
        second.stop();
    });

    it('checks a delayed result and applies the loss limit without retrying a buy', async () => {
        const api = { connection: { readyState: 1 }, send: jest.fn(async request => {
            if (request.proposal_open_contract && request.subscribe) return { subscription: { id: 'all' } };
            if (request.buy) return { buy: { contract_id: 1, buy_price: 1 } };
            if (request.proposal_open_contract) return { proposal_open_contract: { contract_id: 1, status: 'lost', sell_price: 0, profit: -1 } };
            return {};
        }) };
        const onStop = jest.fn();
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A', currency: 'USD',
            settings, strategy: testStrategy, journal: jest.fn(), round: value => value, onStop });
        await session.attach();
        session.runtime.tick(3, 1);
        session.runtime.tick(4, 2);
        await jest.advanceTimersByTimeAsync(5000);
        expect(onStop).toHaveBeenCalledWith('Maximum consecutive losses reached');
        expect(api.send.mock.calls.filter(([request]) => request.buy)).toHaveLength(1);
        expect(api.send.mock.calls.filter(([request]) => request.proposal_open_contract && request.contract_id)).toHaveLength(1);
        expect(session.runtime.queuedSignals()).toBe(0);
    });

    it('reuses an existing account-wide subscription reported by Deriv', async () => {
        const api = { connection: { readyState: 1 }, send: jest.fn(async request => {
            if (request.proposal_open_contract && request.subscribe) throw { error: { code: 'AlreadySubscribed' } };
            if (request.buy) return { buy: { contract_id: 1, buy_price: 1 } };
            return {};
        }) };
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A', currency: 'USD',
            settings, strategy: testStrategy, journal: jest.fn(), round: value => value, onStop: jest.fn() });
        await session.attach();
        session.runtime.tick(3, 1);
        await jest.advanceTimersByTimeAsync(0);
        expect(api.send.mock.calls.filter(([request]) => request.buy)).toHaveLength(1);
        session.stop();
        session.runtime.settle({ contract_id: 1, status: 'won', sell_price: 1.1, profit: 0.1 });
        await jest.advanceTimersByTimeAsync(0);
    });

    it('does not buy if the status stream cannot be established', async () => {
        const api = { connection: { readyState: 1 }, send: jest.fn(async request => {
            if (request.proposal_open_contract) return { error: { code: 'RateLimit', message: 'Rate limited' } };
            return {};
        }) };
        const onStop = jest.fn();
        const session = createMirrorBotSession({ getApi: () => api, account: 'A', getAccount: () => 'A', currency: 'USD',
            settings, strategy: testStrategy, journal: jest.fn(), round: value => value, onStop });
        session.runtime.tick(3, 1);
        await session.attach();
        expect(onStop).toHaveBeenCalledWith('Unable to restore the Deriv stream: Rate limited');
        expect(api.send.mock.calls.filter(([request]) => request.buy)).toHaveLength(0);
        expect(session.runtime.queuedSignals()).toBe(0);
    });

    it('rechecks an app-owned subscription on a later run', async () => {
        let attempts = 0;
        const api = { connection: { readyState: 1 }, send: jest.fn(async request => {
            if (request.proposal_open_contract && request.subscribe) {
                if (++attempts === 1) throw { error: { code: 'AlreadySubscribed' } };
                return { subscription: { id: 'replacement' } };
            }
            return {};
        }) };
        const options = { getApi: () => api, account: 'A', getAccount: () => 'A', currency: 'USD', settings,
            strategy: testStrategy, journal: jest.fn(), round: value => value, onStop: jest.fn() };
        const first = createMirrorBotSession(options);
        await first.attach();
        first.stop();
        const second = createMirrorBotSession(options);
        await second.attach();
        expect(api.send.mock.calls.filter(([request]) => request.proposal_open_contract && request.subscribe)).toHaveLength(2);
        second.stop();
    });
});
