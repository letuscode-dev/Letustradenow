import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.fixed_digit_differs_run = {
    init() { this.jsonInit(this.definition()); this.setNextStatement(false); },
    definition() {
        return {
            message0: localize('run Digit Differs prediction %1 stake %2 take profit %3 stop loss %4'),
            args0: ['PREDICTION', 'STAKE', 'TAKE_PROFIT', 'STOP_LOSS'].map(name => ({ type: 'input_value', name, check: 'Number' })),
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            category: window.Blockly.Categories.Before_Purchase,
            tooltip: localize('Trades Digit Differs on the configured digit, with payout-based recovery and profit and loss limits.'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.fixed_digit_differs_run = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const args = ['PREDICTION', 'STAKE', 'TAKE_PROFIT', 'STOP_LOSS'].map(
        name => generator.valueToCode(block, name, generator.ORDER_NONE) || 'null'
    );
    return `Bot.runFixedDigitDiffersBot(${args.join(', ')});\n`;
};
