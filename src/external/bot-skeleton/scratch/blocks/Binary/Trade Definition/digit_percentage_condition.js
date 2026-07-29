import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const DIRECTION_OPTIONS = [
    [localize('Over'), 'OVER'],
    [localize('Under'), 'UNDER'],
];

const BLOCK_DEFINITION = {
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
                    value: 5,
                    min: 0,
                    max: 9,
                    precision: 1,
                },
                {
                    type: 'field_number',
                    name: 'WINDOW',
                    value: 100,
                    min: 1,
                    max: 1000,
                    precision: 1,
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize(
                'Returns what percent (0–100) of the last N digits are Over (>) or Under (<) the barrier. Uses a sliding window: each new digit drops the oldest. Example: Over 5 → share of digits 6–9.'
            ),
            category: window.Blockly.Categories.Trade_Definition,
        };
    },
    meta() {
        return {
            display_name: localize('% of last digits'),
            description: localize(
                'Returns a number: the percent of the last N digits matching Over or Under the barrier. Over 5 → digits 6–9. Under 4 → digits 0–3. The value refreshes on every new live tick while the bot runs. Choose Over/Under from the dropdown, then compare with >, <, etc. in Purchase conditions.'
            ),
            key_words: localize('over, under, percentage, digits, barrier, trade parameters'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

/**
 * Generate a direct async number call.
 * Returning a bare number (not an object property) is required so js-interpreter
 * comparisons like `Over% > Under%` receive real numeric operands.
 */
const generateDigitPercentageCode = block => {
    const direction = block.getFieldValue('DIRECTION') || 'OVER';
    const barrier_raw = block.getFieldValue('BARRIER') ?? block.getFieldValue('THRESHOLD');
    const barrier = Number(barrier_raw);
    const sample_size = Number(block.getFieldValue('WINDOW'));
    const safe_barrier = Number.isFinite(barrier) ? Math.min(9, Math.max(0, Math.floor(barrier))) : 5;
    const safe_window = Number.isFinite(sample_size) && sample_size >= 1 ? Math.min(1000, Math.floor(sample_size)) : 100;

    const code = `Bot.evaluateDigitPercentageCondition(${JSON.stringify(
        direction
    )}, ${safe_barrier}, ${safe_window})`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

// Single toolbox block. Legacy type names stay registered so older workspaces still load.
const BLOCK_TYPES = ['digit_percentage_condition', 'digit_percentage_over', 'digit_percentage_under'];

BLOCK_TYPES.forEach(type => {
    window.Blockly.Blocks[type] = { ...BLOCK_DEFINITION };
    window.Blockly.JavaScript.javascriptGenerator.forBlock[type] = generateDigitPercentageCode;
});
