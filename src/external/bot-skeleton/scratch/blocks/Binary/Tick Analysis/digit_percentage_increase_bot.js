import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_percentage_increase_run = {
    init() { this.jsonInit(this.definition()); this.setNextStatement(false); },
    definition() {
        return {
            message0: localize('run Digit Percentage Increase minimum increase %1 stake %2 maximum consecutive losses %3 take profit %4 stop loss %5 recovery multiplier %6'),
            args0: ['INCREASE', 'STAKE', 'LOSSES', 'TARGET', 'STOP_LOSS', 'RECOVERY'].map(name => ({ type: 'input_value', name, check: 'Number' })),
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            category: window.Blockly.Categories.Before_Purchase,
            tooltip: localize('Trades Digit Differs when a digit increases by the configured percentage points between consecutive 1,000-tick windows.'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_percentage_increase_run = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const args = ['INCREASE', 'STAKE', 'LOSSES', 'TARGET', 'STOP_LOSS', 'RECOVERY'].map(
        name => generator.valueToCode(block, name, generator.ORDER_NONE) || 'null'
    );
    return `Bot.runDigitPercentageIncreaseBot(${args.join(', ')});\n`;
};
