/**
 * Digit frequency analysis — returns the least or most frequent last digit
 * in the last N ticks (Apollo XML compatibility).
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_frequency_analysis = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('{{ analysis_type }} digit of last {{ n }}', {
                analysis_type: '%1',
                n: '%2',
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'ANALYSIS_TYPE',
                    options: [
                        [localize('Least frequent'), 'LEAST_FREQUENT'],
                        [localize('Most frequent'), 'MOST_FREQUENT'],
                    ],
                },
                {
                    type: 'input_value',
                    name: 'N',
                    check: 'Number',
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Counts last digits in the last N ticks and returns the least or most frequent digit (0–9). Returns -1 until N ticks are available.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit frequency analysis'),
            description: localize(
                'Analyses digit frequency over the last N ticks and returns the coldest or hottest digit for Differs / Matches strategies.'
            ),
            key_words: localize('digit, frequency, least, most, cold, hot, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_frequency_analysis = block => {
    const analysis_type = block.getFieldValue('ANALYSIS_TYPE') || 'LEAST_FREQUENT';
    const n =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'N',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '25';

    const code = `Bot.getDigitFrequencyAnalysis('${analysis_type}', ${n})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL];
};
