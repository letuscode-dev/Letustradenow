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

    it.each([
        [9, 1, 10, 50, 10, 1],
        [-49, -1, 10, 50, -50, -1],
        [4, -1, 10, 50, 3, 0],
    ])('books the combined result once and applies profit/loss limits', async (total, over, target, stop, expected, code) => {
        const engine = {
            data: { contract: settled(11, over) },
            digitHedge: { account: 'account', over_contract_id: 11, under_contract_id: 22, under_bought: true },
            digitHedgeLive: true,
        };
        pollUntilSettled.mockResolvedValue(settled(22, 0));
        const bot = getBotInterface(engine);
        const profit = await bot.settleDigitHedge();
        expect(bot.digitHedgeBookProfit(total, profit, target, stop)).toBe(expected);
        expect(bot.digitHedgeBookProfit(expected, profit, target, stop)).toBe(expected);
        expect(bot.digitHedgeLimit()).toBe(code);
        expect(Boolean(engine.digitHedgeHalt)).toBe(code !== 0);
    });

    it('keeps user-selected barriers and rejects invalid predictions and limits', () => {
        const engine = {};
        const bot = getBotInterface(engine);
        bot.digitHedgeSetBarriers(3, 3);
        expect(engine).toMatchObject({ digitHedgeOverBarrier: 3, digitHedgeUnderBarrier: 3, digitHedgeInvalidBarriers: false });
        bot.digitHedgeSetBarriers(2, 7);
        expect(engine).toMatchObject({ digitHedgeOverBarrier: 2, digitHedgeUnderBarrier: 7, digitHedgeInvalidBarriers: false });
        bot.digitHedgeSetBarriers(3.5, 3);
        expect(engine.digitHedgeInvalidBarriers).toBe(true);
        expect(bot.digitHedgeSetLimits(10, 50)).toBe(1);
        expect(bot.digitHedgeSetLimits(10, 0)).toBe(0);
    });
});
