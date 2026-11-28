import getBotInterface from '../BotInterface';
import { api_base } from '../../../api/api-base';
import { createMirrorBotSession } from '../../utils/mirror-bot-session';

jest.mock('../../../api/api-base', () => ({ api_base: {} }));
jest.mock('../../utils/mirror-bot-session', () => ({ createMirrorBotSession: jest.fn() }));

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};

beforeEach(() => {
    jest.clearAllMocks();
    api_base.account_info = { loginid: 'A', currency: 'USD' };
    api_base.account_id = 'A';
});

it('does not start a session when the user stops during market discovery', async () => {
    const pending = deferred();
    api_base.api = { send: jest.fn(() => pending.promise) };
    const engine = { $scope: { stopped: false } };
    const starting = getBotInterface(engine).runMirrorBot(5, 2, 10, 'ALL');
    engine.$scope.stopped = true;
    pending.resolve({ active_symbols: [{ symbol: '1HZ10V' }] });
    await starting;
    expect(createMirrorBotSession).not.toHaveBeenCalled();
});

it('does not start on a different account or connection after discovery', async () => {
    const pending = deferred();
    api_base.api = { send: jest.fn(() => pending.promise) };
    const starting = getBotInterface({ $scope: { stopped: false } }).runMirrorBot(5, 2, 10, 'ALL');
    api_base.account_info = { loginid: 'B', currency: 'USD' };
    pending.resolve({ active_symbols: [{ symbol: '1HZ10V' }] });
    await expect(starting).rejects.toThrow('account or connection changed');
    expect(createMirrorBotSession).not.toHaveBeenCalled();
});
