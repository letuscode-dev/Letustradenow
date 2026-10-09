/**
 * 1 when the digit two ticks ago is exactly 2 above the latest digit.
 * Also stores the middle digit as the Differs barrier for the purchase that follows.
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
            message0: localize('digit two ticks ago is 2 above the last digit'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                '1 when previous_2 − previous_1 = 2. The Differs barrier is the digit between them. 0 otherwise.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Middle digit Differs'),
            description: localize('Differs on the digit between two ticks that differ by 2.'),
            key_words: localize('differs, middle, digit'),
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
