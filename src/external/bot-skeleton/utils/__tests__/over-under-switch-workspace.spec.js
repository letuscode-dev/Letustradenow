import { hasAllRequiredBlocks } from '../workspace';

jest.mock('../../constants/config', () => ({
    config: () => ({ mandatoryMainBlocks: ['trade_definition', 'before_purchase', 'purchase'] }),
}));

describe('Over/Under switch workspace', () => {
    const originalBlockly = window.Blockly;
    afterEach(() => { window.Blockly = originalBlockly; });

    it('recognizes the custom purchase inside purchase conditions', () => {
        const blocks = [
            { type: 'trade_definition_tradeoptions' },
            { type: 'trade_definition' },
            { type: 'before_purchase' },
            { type: 'over_under_switch_purchase', isDescendantOf: type => type === 'before_purchase' },
        ];
        window.Blockly = { derivWorkspace: { getAllBlocks: () => blocks } };
        expect(hasAllRequiredBlocks()).toBe(true);
    });
});
