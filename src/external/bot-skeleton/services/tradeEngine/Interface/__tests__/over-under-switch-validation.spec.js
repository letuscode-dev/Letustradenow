import getBotInterface from '../BotInterface';
import { observer } from '../../../../utils/observer';
import { notifyHedge } from '../../utils/rise-fall-hedge-runtime';

jest.mock('../../../../utils/observer', () => ({ observer: { emit: jest.fn() } }));
jest.mock('../../utils/rise-fall-hedge-runtime', () => ({ notifyHedge: jest.fn(), pollUntilSettled: jest.fn(), settleCurrentHedge: jest.fn() }));

describe('Over/Under switch validation interface', () => {
    beforeEach(() => jest.clearAllMocks());

    it('allows valid user inputs and stops on invalid inputs', () => {
        const bot = getBotInterface({});
        expect(bot.validateOverUnderSwitchSettings(2, 7, 1, 2, 10)).toBe(true);
        expect(observer.emit).not.toHaveBeenCalled();
        expect(bot.validateOverUnderSwitchSettings(2, 0, 1, 2, 10)).toBe(false);
        expect(notifyHedge).toHaveBeenCalled();
        expect(observer.emit).toHaveBeenCalledWith('bot.stop_button_click');
    });

    it('rounds stake and profit at the active currency precision', () => {
        const engine = { tradeOptions: { currency: 'USD' } };
        const bot = getBotInterface(engine);
        expect(bot.roundOverUnderSwitchValue(1.2345)).toBe(1.23);
        engine.tradeOptions.currency = 'BTC';
        expect(bot.roundOverUnderSwitchValue(0.000001234)).toBe(0.00000123);
    });
});
