import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.mirror_bot_run = {
    init() { this.jsonInit(this.definition()); this.setNextStatement(false); },
    definition() {
        return {
            message0: localize('run mirror A-B-A-B bot stake %1 max consecutive losses %2 take profit %3 markets %4'),
            args0: [...['STAKE', 'LOSSES', 'TARGET'].map(name => ({ type: 'input_value', name, check: 'Number' })),
                { type: 'input_value', name: 'MARKETS', check: 'String' }],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            category: window.Blockly.Categories.Before_Purchase,
            tooltip: localize('Trades one-tick Digit Differs on B when four ticks form A-B-A-B. Use ALL or enter comma-separated Volatility symbols.'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.mirror_bot_run = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const args = ['STAKE', 'LOSSES', 'TARGET', 'MARKETS'].map(name => generator.valueToCode(block, name, generator.ORDER_NONE) || 'null');
    return `Bot.runMirrorBot(${args.join(', ')});\n`;
};
