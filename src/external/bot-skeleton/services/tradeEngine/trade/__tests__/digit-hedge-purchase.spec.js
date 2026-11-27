import Purchase from '../Purchase';
import { api_base } from '../../../api/api-base';
import { observer } from '../../../../utils/observer';
import { BEFORE_PURCHASE } from '../state/constants';

jest.mock('../../../api/api-base', () => ({ api_base: { api: { send: jest.fn() }, account_info: { currency: 'USD' } } }));
jest.mock('../../utils/broadcast', () => ({ contractStatus: jest.fn(), info: jest.fn(), log: jest.fn(), notify: jest.fn() }));
jest.mock('../../../../utils/observer', () => ({ observer: { emit: jest.fn() } }));

const createEngine = () => {
    const engine = new (Purchase(class {}))();
    engine.store = { getState: () => ({ scope: BEFORE_PURCHASE }) };
    engine.tradeOptions = { amount: 1, basis: 'stake', currency: 'USD', duration: 1, duration_unit: 't', symbol: '1HZ75V' };
    engine.digitHedgeOverStake = 2;
    engine.digitHedgeUnderStake = 3;
    engine.getBalance = () => 100;
    engine.handlePurchaseSuccess = jest.fn();
    return engine;
};

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('paired digit hedge purchases', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sends both quotes and both buys concurrently with independent stakes', async () => {
        const engine = createEngine();
        const quotes = [deferred(), deferred()];
        const buys = [deferred(), deferred()];
        api_base.api.send.mockImplementation(request => {
            if (request.proposal) return quotes[request.contract_type === 'DIGITOVER' ? 0 : 1].promise;
            if (request.buy) return buys[request.buy === 'over' ? 0 : 1].promise;
            return Promise.resolve({});
        });

        const pending = engine.purchaseDigitHedge();
        await flush();
        expect(api_base.api.send).toHaveBeenCalledTimes(2);
        expect(api_base.api.send.mock.calls[0][0]).toMatchObject({ contract_type: 'DIGITOVER', amount: 2 });
        expect(api_base.api.send.mock.calls[1][0]).toMatchObject({ contract_type: 'DIGITUNDER', amount: 3 });
        quotes[0].resolve({ proposal: { id: 'over', ask_price: 2, date_start: 100 } });
        quotes[1].resolve({ proposal: { id: 'under', ask_price: 3, date_start: 100 } });
        await flush();
        expect(api_base.api.send).toHaveBeenCalledWith({ buy: 'over', price: 2 });
        expect(api_base.api.send).toHaveBeenCalledWith({ buy: 'under', price: 3 });
        buys[0].resolve({ buy: { contract_id: 11, buy_price: 2, start_time: 100 } });
        buys[1].resolve({ buy: { contract_id: 22, buy_price: 3, start_time: 100 } });
        await pending;
        expect(engine.digitHedge).toMatchObject({ over_contract_id: 11, under_contract_id: 22, over_stake: 2, under_stake: 3 });
        expect(engine.handlePurchaseSuccess).toHaveBeenCalledTimes(1);
    });

    it('closes a single fill and halts further pairs', async () => {
        const engine = createEngine();
        api_base.api.send.mockImplementation(request => {
            if (request.proposal) return Promise.resolve({ proposal: { id: request.contract_type, ask_price: request.amount, date_start: 100 } });
            if (request.buy === 'DIGITOVER') return Promise.resolve({ buy: { contract_id: 11, start_time: 100 } });
            if (request.buy === 'DIGITUNDER') return Promise.reject(new Error('rejected'));
            if (request.sell) return Promise.resolve({ sell: { sold_for: 1 } });
            return Promise.resolve({});
        });

        await engine.purchaseDigitHedge();
        expect(api_base.api.send).toHaveBeenCalledWith({ sell: 11, price: 0 });
        expect(engine.digitHedgeHalt).toBe(true);
        expect(observer.emit).toHaveBeenCalledWith('bot.stop_button_click');
        expect(engine.handlePurchaseSuccess).not.toHaveBeenCalled();
        const calls = api_base.api.send.mock.calls.length;
        await engine.purchaseDigitHedge();
        expect(api_base.api.send).toHaveBeenCalledTimes(calls);
    });

    it('halts when neither buy is confirmed because the account state is unknown', async () => {
        const engine = createEngine();
        api_base.api.send.mockImplementation(request => {
            if (request.proposal) return Promise.resolve({ proposal: { id: request.contract_type, ask_price: request.amount, date_start: 100 } });
            return Promise.reject(new Error('connection lost'));
        });

        await engine.purchaseDigitHedge();
        expect(engine.digitHedgeHalt).toBe(true);
        expect(observer.emit).toHaveBeenCalledWith('bot.stop_button_click');
        expect(engine.handlePurchaseSuccess).not.toHaveBeenCalled();
    });
});
