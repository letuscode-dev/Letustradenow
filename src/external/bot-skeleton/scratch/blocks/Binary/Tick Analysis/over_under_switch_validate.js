import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.over_under_switch_validate = {
    init() { this.jsonInit(this.definition()); },
    definition() {
        return {
            message0: localize('validate Over %1 Under %2 stake %3 Martingale %4 take profit %5'),
            args0: ['OVER', 'UNDER', 'STAKE', 'MULTIPLIER', 'TARGET'].map(name => ({
                type: 'input_value', name, check: 'Number',
            })),
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            category: window.Blockly.Categories.Before_Purchase,
            tooltip: localize('Checks the two digit predictions and positive stake, Martingale, and take profit before trading.'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_switch_validate = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const args = ['OVER', 'UNDER', 'STAKE', 'MULTIPLIER', 'TARGET'].map(
        name => generator.valueToCode(block, name, generator.ORDER_NONE) || 'null'
    );
    return [`Bot.validateOverUnderSwitchSettings(${args.join(', ')})`, generator.ORDER_FUNCTION_CALL];
};

window.Blockly.Blocks.over_under_switch_round = {
    init() { this.jsonInit(this.definition()); },
    definition() {
        return {
            message0: localize('round %1 to account currency precision'),
            args0: [{ type: 'input_value', name: 'VALUE', check: 'Number' }],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            category: window.Blockly.Categories.After_Purchase,
            tooltip: localize('Rounds a stake or profit to the account currency precision.'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_switch_round = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const value = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '0';
    return [`Bot.roundOverUnderSwitchValue(${value})`, generator.ORDER_FUNCTION_CALL];
};

window.Blockly.Blocks.over_under_switch_purchase = {
    init() { this.jsonInit(this.definition()); this.setNextStatement(false); },
    definition() {
        return {
            message0: localize('Purchase %1 once'),
            args0: [{ type: 'field_dropdown', name: 'SIDE', options: [[localize('Over'), 'DIGITOVER'], [localize('Under'), 'DIGITUNDER']] }],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            category: window.Blockly.Categories.Before_Purchase,
            tooltip: localize('Sends one stake-based purchase immediately and does not retry an unconfirmed buy.'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_switch_purchase = block => {
    const side = block.getFieldValue('SIDE') === 'DIGITUNDER' ? 'DIGITUNDER' : 'DIGITOVER';
    return `Bot.purchaseOverUnderOnce('${side}');\n`;
};
