/**
 * Free-bot digit read. Not listed in the Blocks menu.
 * Returns 1 when every one of the last N digits is odd, otherwise 0.
 * The read is synchronous and looks only at those ticks.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.tail_digits_all_odd = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Last {{ count }} digits are all odd', { count: '%1' }),
            args0: [
                {
                    type: 'field_number',
                    name: 'TICK_COUNT',
                    value: 2,
                    min: 1,
                    max: 1000,
                    precision: 1,
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                '1 when every one of the last ticks is odd. Reads only those ticks already on screen.'
            ),
        };
    },
    meta() {
        return {
            display_name: localize('Last digits all odd'),
            description: localize(
                'Reads only the newest ticks and returns 1 when each of them is odd. It does not wait for another tick.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.tail_digits_all_odd = block => {
    const requested = Math.floor(Number(block.getFieldValue('TICK_COUNT')));
    const count = Number.isFinite(requested) ? Math.min(1000, Math.max(1, requested)) : 2;

    return [`Bot.lastDigitsAllOdd(${count})`, window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL];
};
