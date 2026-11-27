import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.triple_hit_concentration_run = {
    init() { this.jsonInit(this.definition()); this.setNextStatement(false); },
    definition() {
        return {
            message0: localize('run Triple-Hit Concentration stake %1 maximum consecutive losses %2 profit threshold %3 recovery multiplier %4'),
            args0: ['STAKE', 'LOSSES', 'TARGET', 'RECOVERY'].map(name => ({ type: 'input_value', name, check: 'Number' })),
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            category: window.Blockly.Categories.Before_Purchase,
            tooltip: localize('Trades one-tick Digit Differs when the latest digit is the unique leader in the last 10 ticks.'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.triple_hit_concentration_run = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const args = ['STAKE', 'LOSSES', 'TARGET', 'RECOVERY'].map(
        name => generator.valueToCode(block, name, generator.ORDER_NONE) || 'null'
    );
    return `Bot.runTripleHitConcentrationBot(${args.join(', ')});\n`;
};
