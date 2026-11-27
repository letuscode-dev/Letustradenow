import Purchase from '../Purchase';
import { api_base } from '../../../api/api-base';
import { BEFORE_PURCHASE } from '../state/constants';

jest.mock('../../../api/api-base', () => ({ api_base: { api: { send: jest.fn() } } }));
jest.mock('../../utils/broadcast', () => ({ contractStatus: jest.fn(), info: jest.fn(), log: jest.fn(), notify: jest.fn() }));
jest.mock('../../../../utils/observer', () => ({ observer: { emit: jest.fn() } }));

const engineFor = (amount, prediction) => {
    const engine = new (Purchase(class {}))();
    engine.store = { getState: () => ({ scope: BEFORE_PURCHASE }) };
    engine.options = { timeMachineEnabled: false };
    engine.tradeOptions = { amount, prediction, basis: 'stake', currency: 'USD', duration: 1, duration_unit: 't', symbol: '1HZ75V' };
    engine.$scope = { stopped: false };
    engine.handlePurchaseSuccess = jest.fn();
    return engine;
};

describe('single Over/Under direct purchase', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        api_base.account_info = { loginid: 'account-a' };
    });

    it.each([['DIGITOVER', 1, 2], ['DIGITUNDER', 2, 7]])('sends one %s buy with current stake and prediction', async (type, stake, prediction) => {
        const engine = engineFor(stake, prediction);
        api_base.api.send.mockImplementation(request => request.buy
            ? Promise.resolve({ buy: { contract_id: 42 } })
            : Promise.resolve({ proposal_open_contract: { contract_id: 42 } }));
        await engine.purchaseOverUnderOnce(type);
        expect(api_base.api.send).toHaveBeenNthCalledWith(1, expect.objectContaining({
            buy: '1', price: stake,
            parameters: expect.objectContaining({ contract_type: type, amount: stake, barrier: String(prediction) }),
        }));
        expect(api_base.api.send).toHaveBeenNthCalledWith(2, { proposal_open_contract: 1, contract_id: 42 });
        expect(engine.handlePurchaseSuccess).toHaveBeenCalledTimes(1);
    });

    it('does not retry an unconfirmed buy', async () => {
        const engine = engineFor(1, 2);
        api_base.api.send.mockRejectedValue({ error: { code: 'DisconnectError' } });
        await expect(engine.purchaseOverUnderOnce('DIGITOVER')).rejects.toMatchObject({ error: { code: 'DisconnectError' } });
        expect(api_base.api.send).toHaveBeenCalledTimes(1);
        expect(engine.handlePurchaseSuccess).not.toHaveBeenCalled();
    });

    it('does not send another buy while the first response is pending', async () => {
        const engine = engineFor(1, 2);
        let resolveBuy;
        api_base.api.send.mockImplementation(request => request.buy
            ? new Promise(resolve => { resolveBuy = resolve; })
            : Promise.resolve({}));
        const first = engine.purchaseOverUnderOnce('DIGITOVER');
        await engine.purchaseOverUnderOnce('DIGITOVER');
        expect(api_base.api.send).toHaveBeenCalledTimes(1);
        resolveBuy({ buy: { contract_id: 42 } });
        await first;
        expect(engine.handlePurchaseSuccess).toHaveBeenCalledTimes(1);
    });

    it('does not place an order after the bot is stopped', async () => {
        const engine = engineFor(1, 2);
        engine.$scope.stopped = true;
        await engine.purchaseOverUnderOnce('DIGITOVER');
        expect(api_base.api.send).not.toHaveBeenCalled();
    });

    it('records a buy confirmed after stop without issuing a new request', async () => {
        const engine = engineFor(1, 2);
        let resolveBuy;
        api_base.api.send.mockImplementation(() => new Promise(resolve => { resolveBuy = resolve; }));
        const pending = engine.purchaseOverUnderOnce('DIGITOVER');
        engine.$scope.stopped = true;
        resolveBuy({ buy: { contract_id: 42 } });
        await pending;
        expect(engine.contractId).toBe(42);
        expect(api_base.api.send).toHaveBeenCalledTimes(1);
        expect(engine.handlePurchaseSuccess).not.toHaveBeenCalled();
    });

    it('does not track the old account purchase as a new account trade', async () => {
        const engine = engineFor(1, 2);
        let resolveBuy;
        api_base.api.send.mockImplementation(() => new Promise(resolve => { resolveBuy = resolve; }));
        const pending = engine.purchaseOverUnderOnce('DIGITOVER');
        api_base.account_info = { loginid: 'account-b' };
        resolveBuy({ buy: { contract_id: 42 } });
        await pending;
        expect(engine.contractId).toBe(42);
        expect(api_base.api.send).toHaveBeenCalledTimes(1);
        expect(engine.handlePurchaseSuccess).not.toHaveBeenCalled();
    });

    it('rejects non-stake mode and invalid contract types before sending', async () => {
        const engine = engineFor(1, 2);
        engine.tradeOptions.basis = 'payout';
        await expect(engine.purchaseOverUnderOnce('DIGITOVER')).rejects.toThrow('stake-based');
        await expect(engine.purchaseOverUnderOnce('DIGITDIFF')).rejects.toThrow('Invalid');
        expect(api_base.api.send).not.toHaveBeenCalled();
    });

    it.each([
        ['DIGITOVER', 0, 2], ['DIGITUNDER', Infinity, 7],
        ['DIGITOVER', 1, 9], ['DIGITUNDER', 1, 0], ['DIGITOVER', 1, 2.5],
    ])('rejects invalid current stake or prediction before purchase', async (type, stake, prediction) => {
        const engine = engineFor(stake, prediction);
        await expect(engine.purchaseOverUnderOnce(type)).rejects.toThrow('Current stake or prediction is invalid');
        expect(api_base.api.send).not.toHaveBeenCalled();
    });
});
