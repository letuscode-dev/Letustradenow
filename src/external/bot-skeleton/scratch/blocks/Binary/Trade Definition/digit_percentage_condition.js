import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const DIRECTION_OPTIONS = [
    [localize('Over'), 'OVER'],
    [localize('Under'), 'UNDER'],
];

const createDigitPercentageConditionBlock = ({ type, default_direction, default_barrier, display_name }) => {
    window.Blockly.Blocks[type] = {
        init() {
            this.jsonInit(this.definition());
            this.setInputsInline(true);
        },
        definition() {
            return {
                message0: localize('{{ direction }} {{ barrier }} % of last {{ window }} digits', {
                    direction: '%1',
                    barrier: '%2',
                    window: '%3',
                }),
                args0: [
                    {
                        type: 'field_dropdown',
                        name: 'DIRECTION',
                        options: DIRECTION_OPTIONS,
                    },
                    {
                        type: 'field_number',
                        name: 'BARRIER',
                        value: default_barrier,
                        min: 0,
                        max: 9,
                        precision: 1,
                    },
                    {
                        type: 'field_number',
                        name: 'WINDOW',
                        value: 100,
                        min: 1,
                        max: 5000,
                        precision: 1,
                    },
                ],
                output: 'Number',
                outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
                colour: window.Blockly.Colours.Special1.colour,
                colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
                colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
                tooltip: localize(
                    'Returns what percent of the last N digits are Over (strictly greater than) or Under (strictly less than) the barrier digit. Use with comparison blocks (>, <, …).'
                ),
                category: window.Blockly.Categories.Trade_Definition,
            };
        },
        meta() {
            return {
                display_name,
                description: localize(
                    'Example: Over 5 % of last 100 digits returns how often digits 6–9 appeared. Under 4 % of last 100 digits returns how often digits 0–3 appeared. Plug into math comparisons in Purchase conditions.'
                ),
                key_words: localize('over, under, percentage, digits, barrier, trade parameters'),
            };
        },
        customContextMenu(menu) {
            modifyContextMenu(menu);
        },
    };

    window.Blockly.JavaScript.javascriptGenerator.forBlock[type] = block => {
        const direction = block.getFieldValue('DIRECTION') || default_direction;
        // Prefer BARRIER; keep THRESHOLD as a fallback for workspaces saved before the rename.
        const barrier_raw = block.getFieldValue('BARRIER') ?? block.getFieldValue('THRESHOLD');
        const barrier = Number(barrier_raw);
        const sample_size = Number(block.getFieldValue('WINDOW'));
        const safe_barrier = Number.isFinite(barrier) ? barrier : default_barrier;
        const safe_window = Number.isFinite(sample_size) && sample_size >= 1 ? sample_size : 100;

        const code = `(function () {
            var BinaryBotPrivateDigitPctResult = Bot.evaluateDigitPercentageCondition(${JSON.stringify(
                direction
            )}, ${safe_barrier}, ${safe_window});
            if (!BinaryBotPrivateDigitPctResult) {
                return 0;
            }
            return Number(BinaryBotPrivateDigitPctResult.percentage) || 0;
        })()`;

        return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
    };
};

createDigitPercentageConditionBlock({
    type: 'digit_percentage_over',
    default_direction: 'OVER',
    default_barrier: 5,
    display_name: localize('Over % of last digits'),
});

createDigitPercentageConditionBlock({
    type: 'digit_percentage_under',
    default_direction: 'UNDER',
    default_barrier: 4,
    display_name: localize('Under % of last digits'),
});
