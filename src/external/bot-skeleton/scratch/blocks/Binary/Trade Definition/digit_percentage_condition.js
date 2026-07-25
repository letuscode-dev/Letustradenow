import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const DIRECTION_OPTIONS = [
    [localize('Over'), 'OVER'],
    [localize('Under'), 'UNDER'],
];

const createDigitPercentageConditionBlock = ({ type, default_direction, default_threshold, display_name }) => {
    window.Blockly.Blocks[type] = {
        init() {
            this.jsonInit(this.definition());
            this.setInputsInline(true);
        },
        definition() {
            return {
                message0: localize('{{ direction }} {{ threshold }} % of last {{ window }} digits', {
                    direction: '%1',
                    threshold: '%2',
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
                        name: 'THRESHOLD',
                        value: default_threshold,
                        min: 0,
                        max: 100,
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
                output: 'Boolean',
                outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
                colour: window.Blockly.Colours.Special1.colour,
                colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
                colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
                tooltip: localize(
                    'True when the selected Over (5–9) or Under (0–4) digit group makes up at least the given percent of the last N digits. Over, Under, percent, and window are all configurable.'
                ),
                category: window.Blockly.Categories.Trade_Definition,
            };
        },
        meta() {
            return {
                display_name,
                description: localize(
                    'Checks whether Over digits (5–9) or Under digits (0–4) meet your percentage threshold across the last N ticks. Use inside Purchase conditions (for example with an if block) before buying.'
                ),
                key_words: localize('over, under, percentage, digits, trade parameters, filter'),
            };
        },
        customContextMenu(menu) {
            modifyContextMenu(menu);
        },
    };

    window.Blockly.JavaScript.javascriptGenerator.forBlock[type] = block => {
        const direction = block.getFieldValue('DIRECTION') || default_direction;
        const threshold = Number(block.getFieldValue('THRESHOLD'));
        const sample_size = Number(block.getFieldValue('WINDOW'));
        const safe_threshold = Number.isFinite(threshold) ? threshold : default_threshold;
        const safe_window = Number.isFinite(sample_size) && sample_size >= 1 ? sample_size : 100;

        const code = `(function () {
            var BinaryBotPrivateDigitPctResult = Bot.evaluateDigitPercentageCondition(${JSON.stringify(
                direction
            )}, ${safe_threshold}, ${safe_window});
            if (BinaryBotPrivateDigitPctResult && BinaryBotPrivateDigitPctResult.journal_enabled) {
                var BinaryBotPrivateDigitPctClass = 'journal__text';
                if (BinaryBotPrivateDigitPctResult.status === 'passed') {
                    BinaryBotPrivateDigitPctClass = 'journal__text--success';
                } else if (BinaryBotPrivateDigitPctResult.status === 'failed') {
                    BinaryBotPrivateDigitPctClass = 'journal__text--error';
                }
                Bot.notify({
                    className: BinaryBotPrivateDigitPctClass,
                    message: BinaryBotPrivateDigitPctResult.message,
                    sound: 'silent',
                    block_id: ${JSON.stringify(block.id)},
                    variable_name: null
                });
            }
            return !!(BinaryBotPrivateDigitPctResult && BinaryBotPrivateDigitPctResult.allowed);
        })()`;

        return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
    };
};

createDigitPercentageConditionBlock({
    type: 'digit_percentage_over',
    default_direction: 'OVER',
    default_threshold: 5,
    display_name: localize('Over % of last digits'),
});

createDigitPercentageConditionBlock({
    type: 'digit_percentage_under',
    default_direction: 'UNDER',
    default_threshold: 4,
    display_name: localize('Under % of last digits'),
});
