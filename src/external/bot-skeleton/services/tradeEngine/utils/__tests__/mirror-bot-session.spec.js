import { createMirrorBotSession } from '../mirror-bot-session';
import { createMirrorDerivStream } from '../mirror-deriv-stream';

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
});
