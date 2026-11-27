import getBotInterface from '../BotInterface';
import { api_base } from '../../../api/api-base';
import { pollUntilSettled } from '../../utils/rise-fall-hedge-runtime';

jest.mock('../../../api/api-base', () => ({ api_base: { digitHedgeLocks: new Set() } }));
jest.mock('../../utils/rise-fall-hedge-runtime', () => ({
    notifyHedge: jest.fn(),
    pollUntilSettled: jest.fn(),
    settleCurrentHedge: jest.fn(),
}));
jest.mock('../../utils/broadcast', () => ({ contract: jest.fn() }));

const settled = (id, profit) => ({ contract_id: id, is_sold: true, date_start: 100, profit, buy_price: 1, sell_price: 0 });

describe('digit hedge settlement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        api_base.digitHedgeLocks = new Set(['account']);
    });

    it('releases the account lock only after both results are available and calculates each next stake', async () => {
        const engine = {
            data: { contract: settled(11, -2) },
            digitHedge: { account: 'account', over_contract_id: 11, under_contract_id: 22, under_bought: true, over_stake: 2, under_stake: 3 },
            digitHedgeLive: true,
            updateTotals: jest.fn(),
        };
        pollUntilSettled.mockResolvedValue(settled(22, -3));
        const bot = getBotInterface(engine);
        await expect(bot.settleDigitHedge()).resolves.toBe(-5);
        expect(api_base.digitHedgeLocks.has('account')).toBe(false);
        expect(bot.digitHedgeNextStake(2, 1, 2, 'over')).toBe(4);
        expect(bot.digitHedgeNextStake(3, 1, 2, 'under')).toBe(6);
        expect(bot.digitHedgeContinues()).toBe(true);
    });

    it('keeps the lock when a settled leg has no usable profit or prices', async () => {
        const engine = {
            data: { contract: settled(11, -2) },
            digitHedge: { account: 'account', over_contract_id: 11, under_contract_id: 22, under_bought: true },
            digitHedgeLive: true,
        };
        pollUntilSettled.mockResolvedValue({ contract_id: 22, is_sold: true, date_start: 100, profit: null });
        const bot = getBotInterface(engine);
        await bot.settleDigitHedge();
        expect(bot.digitHedgeDecision()).toBe(0);
        expect(api_base.digitHedgeLocks.has('account')).toBe(true);
    });
});
