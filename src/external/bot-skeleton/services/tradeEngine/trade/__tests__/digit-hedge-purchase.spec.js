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
    engine.$scope = { stopped: false };
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
    beforeEach(() => {
        jest.clearAllMocks();
        api_base.digitHedgeLocks = new Set();
        api_base.account_info = { currency: 'USD', loginid: 'account-a' };
    });

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

    it.each(['digitHedgeInvalidBarriers', 'digitHedgeInvalidLimits'])('stops before requesting quotes when %s is set', async field => {
        const engine = createEngine();
        engine[field] = true;
        await engine.purchaseDigitHedge();
        expect(api_base.api.send).not.toHaveBeenCalled();
        expect(engine.digitHedgeHalt).toBe(true);
    });

    it.each([[3, 3], [2, 7]])('sends the configured Over %s and Under %s predictions in the quotes', async (over, under) => {
        const engine = createEngine();
        engine.digitHedgeOverBarrier = over;
        engine.digitHedgeUnderBarrier = under;
        api_base.api.send.mockImplementation(request => Promise.resolve({
            proposal: { id: request.contract_type, ask_price: request.amount, date_start: request.contract_type === 'DIGITOVER' ? 100 : 101 },
        }));
        await engine.purchaseDigitHedge();
        expect(api_base.api.send).toHaveBeenCalledWith(expect.objectContaining({ contract_type: 'DIGITOVER', barrier: String(over) }));
        expect(api_base.api.send).toHaveBeenCalledWith(expect.objectContaining({ contract_type: 'DIGITUNDER', barrier: String(under) }));
        expect(api_base.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
    });

    it('does not buy if the bot is stopped while quotes are in flight', async () => {
        const engine = createEngine();
        const quotes = [deferred(), deferred()];
        api_base.api.send.mockImplementation(request => quotes[request.contract_type === 'DIGITOVER' ? 0 : 1].promise);
        const pending = engine.purchaseDigitHedge();
        await flush();
        engine.$scope.stopped = true;
        quotes[0].resolve({ proposal: { id: 'over', ask_price: 2, date_start: 100 } });
        quotes[1].resolve({ proposal: { id: 'under', ask_price: 3, date_start: 100 } });
        await pending;
        expect(api_base.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
        expect(engine.digitHedgeLive).toBe(false);
    });

    it('does not buy when quotes report different spot ticks', async () => {
        const engine = createEngine();
        api_base.api.send.mockImplementation(request => Promise.resolve({
            proposal: { id: request.contract_type, ask_price: request.amount, date_start: 100, spot_time: request.contract_type === 'DIGITOVER' ? 99 : 100 },
        }));
        await engine.purchaseDigitHedge();
        expect(api_base.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
    });

    it.each(['overpriced', 'missing'])('does not buy either side when one quote is %s', async reason => {
        const engine = createEngine();
        api_base.api.send.mockImplementation(request => {
            const proposal = { id: request.contract_type, date_start: 100, ask_price: request.amount };
            if (request.contract_type === 'DIGITUNDER') {
                if (reason === 'overpriced') proposal.ask_price = request.amount + 1;
                else delete proposal.ask_price;
            }
            return Promise.resolve({ proposal });
        });
        await engine.purchaseDigitHedge();
        expect(api_base.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
        expect(engine.handlePurchaseSuccess).not.toHaveBeenCalled();
    });

    it('does not buy a second pair when another engine acquires the account lock during quoting', async () => {
        const engine = createEngine();
        const quotes = [deferred(), deferred()];
        api_base.api.send.mockImplementation(request => quotes[request.contract_type === 'DIGITOVER' ? 0 : 1].promise);
        const pending = engine.purchaseDigitHedge();
        await flush();
        api_base.digitHedgeLocks.add('account-a');
        quotes[0].resolve({ proposal: { id: 'over', ask_price: 2, date_start: 100 } });
        quotes[1].resolve({ proposal: { id: 'under', ask_price: 3, date_start: 100 } });
        await pending;
        expect(api_base.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
    });

    it('does not buy when the active account changes during quoting', async () => {
        const engine = createEngine();
        const quotes = [deferred(), deferred()];
        api_base.api.send.mockImplementation(request => quotes[request.contract_type === 'DIGITOVER' ? 0 : 1].promise);
        const pending = engine.purchaseDigitHedge();
        await flush();
        api_base.account_info = { currency: 'USD', loginid: 'account-b' };
        quotes[0].resolve({ proposal: { id: 'over', ask_price: 2, date_start: 100 } });
        quotes[1].resolve({ proposal: { id: 'under', ask_price: 3, date_start: 100 } });
        await pending;
        expect(api_base.api.send.mock.calls.some(([request]) => request.buy)).toBe(false);
        expect(engine.digitHedgeHalt).toBe(true);
    });

    it('preserves original-account contract IDs and does not sell on the new account', async () => {
        const engine = createEngine();
        const buys = [deferred(), deferred()];
        api_base.api.send.mockImplementation(request => {
            if (request.proposal) return Promise.resolve({ proposal: { id: request.contract_type, ask_price: request.amount, date_start: 100 } });
            return buys[request.buy === 'DIGITOVER' ? 0 : 1].promise;
        });
        const pending = engine.purchaseDigitHedge();
        await flush();
        api_base.account_info = { currency: 'USD', loginid: 'account-b' };
        buys[0].resolve({ buy: { contract_id: 11, buy_price: 2, start_time: 100 } });
        buys[1].resolve({ buy: { contract_id: 22, buy_price: 3, start_time: 100 } });
        await pending;
        expect(engine.digitHedge).toMatchObject({ account: 'account-a', over_contract_id: 11, under_contract_id: 22 });
        expect(engine.digitHedgeHalt).toBe(true);
        expect(api_base.digitHedgeLocks.has('account-a')).toBe(true);
        expect(api_base.api.send.mock.calls.some(([request]) => request.sell)).toBe(false);
    });

    it('preserves an under-only fill when its sale is not confirmed and blocks a restart', async () => {
        const engine = createEngine();
        api_base.api.send.mockImplementation(request => {
            if (request.proposal) return Promise.resolve({ proposal: { id: request.contract_type, ask_price: request.amount, date_start: 100 } });
            if (request.buy === 'DIGITOVER') return Promise.reject(new Error('connection lost'));
            if (request.buy === 'DIGITUNDER') return Promise.resolve({ buy: { contract_id: 22, start_time: 100 } });
            return Promise.resolve({});
        });
        await engine.purchaseDigitHedge();
        expect(engine.digitHedge).toMatchObject({ over_contract_id: null, under_contract_id: 22, under_bought: true });
        expect(engine.digitHedgeHalt).toBe(true);
        const new_engine = createEngine(); // DBot replaces the engine on stop.
        const calls = api_base.api.send.mock.calls.length;
        await new_engine.purchaseDigitHedge();
        expect(api_base.api.send).toHaveBeenCalledTimes(calls);
        expect(api_base.digitHedgeLocks.size).toBe(1);
    });

    it('preserves both confirmed IDs if stop happens after the buys are sent', async () => {
        const engine = createEngine();
        const buys = [deferred(), deferred()];
        api_base.api.send.mockImplementation(request => {
            if (request.proposal) return Promise.resolve({ proposal: { id: request.contract_type, ask_price: request.amount, date_start: 100 } });
            return buys[request.buy === 'DIGITOVER' ? 0 : 1].promise;
        });
        const pending = engine.purchaseDigitHedge();
        await flush();
        engine.$scope.stopped = true;
        const calls = api_base.api.send.mock.calls.length;
        await createEngine().purchaseDigitHedge();
        expect(api_base.api.send).toHaveBeenCalledTimes(calls);
        buys[0].resolve({ buy: { contract_id: 11, buy_price: 2, start_time: 100 } });
        buys[1].resolve({ buy: { contract_id: 22, buy_price: 3, start_time: 100 } });
        await pending;
        expect(engine.digitHedge).toMatchObject({ over_contract_id: 11, under_contract_id: 22 });
        expect(engine.digitHedgeLive).toBe(true);
        expect(engine.handlePurchaseSuccess).not.toHaveBeenCalled();
    });
});
