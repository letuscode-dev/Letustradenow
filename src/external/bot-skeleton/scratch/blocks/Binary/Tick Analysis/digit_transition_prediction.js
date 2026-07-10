import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_transition_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('digit transition prediction over {{ tick_window }} ticks, threshold {{ threshold }}', {
                tick_window: '%1',
                threshold: '%2',
            }),
            args0: [
                {
                    type: 'input_value',
                    name: 'TICK_WINDOW',
                    check: 'Number',
                },
                {
                    type: 'input_value',
                    name: 'THRESHOLD',
                    check: 'Number',
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Analyzes last-digit transitions in the tick window. Returns the starting digit of the strongest pattern when its count meets the threshold, otherwise -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit transition prediction'),
            description: localize(
                'Counts digit-pair transitions (0→0 … 9→9) over the selected tick window. When the current last digit is the destination of a strong pattern (e.g. current is 3 after many 0→3 transitions), returns the starter digit (0) so Differs can be placed on it. Returns -1 when no pattern qualifies.'
            ),
            key_words: localize('digit, transition, pattern, differs, ticks, threshold'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_transition_prediction = block => {
    const tick_window =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'TICK_WINDOW',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '120';
    const threshold =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'THRESHOLD',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '5';

    const code = `Bot.getDigitTransitionPrediction(${tick_window}, ${threshold})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL];
};
