/**
 * 1 on every tick. The Differs barrier is the last digit of the current seconds.
 * 09:54:01 differs on 1. 09:54:15 differs on 5.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colours = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});

window.Blockly.Blocks.middle_gap_differ = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('differ on the last digit of the current seconds'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Buys Differs on the last digit of the current seconds. 09:54:01 differs on 1, and the barrier changes as the clock changes.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Seconds digit Differs'),
            description: localize('Differs on the last digit of the current seconds.'),
            key_words: localize('differs, seconds, digit'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.middle_gap_differ = () => [
    'Bot.middleGapDifferSignal()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
];
