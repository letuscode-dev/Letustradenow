jest.mock('@deriv-com/translations', () => ({ localize: text => text }));
jest.mock('../../../../utils', () => ({ modifyContextMenu: jest.fn() }));

describe('Over/Under switch validation block', () => {
    let originalBlockly;
    let generator;
    beforeAll(() => {
        originalBlockly = window.Blockly;
        generator = {
            forBlock: {}, ORDER_NONE: 0, ORDER_FUNCTION_CALL: 2,
            valueToCode: (_block, name) => ({ OVER: 'over', UNDER: 'under', STAKE: 'stake', MULTIPLIER: 'factor', TARGET: 'target', VALUE: 'amount' }[name]),
        };
        window.Blockly = { Blocks: {}, JavaScript: { javascriptGenerator: generator } };
        jest.isolateModules(() => require('../over_under_switch_validate'));
    });
    afterAll(() => { window.Blockly = originalBlockly; });

    it('sends the five user inputs to synchronous validation', () => {
        expect(generator.forBlock.over_under_switch_validate({})).toEqual([
            'Bot.validateOverUnderSwitchSettings(over, under, stake, factor, target)', 2,
        ]);
    });

    it('generates one direct purchase for the selected side', () => {
        expect(generator.forBlock.over_under_switch_purchase({ getFieldValue: () => 'DIGITOVER' })).toBe(
            "Bot.purchaseOverUnderOnce('DIGITOVER');\n"
        );
        expect(generator.forBlock.over_under_switch_purchase({ getFieldValue: () => 'DIGITUNDER' })).toBe(
            "Bot.purchaseOverUnderOnce('DIGITUNDER');\n"
        );
    });

    it('rounds values using the active account currency', () => {
        expect(generator.forBlock.over_under_switch_round({})).toEqual(['Bot.roundOverUnderSwitchValue(amount)', 2]);
    });
});
