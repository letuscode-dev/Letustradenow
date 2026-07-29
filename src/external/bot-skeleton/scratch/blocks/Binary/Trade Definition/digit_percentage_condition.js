import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import { DEFAULT_WINDOW, MAX_WINDOW } from '../../../../services/tradeEngine/utils/digit-percentage-condition';

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
                    // Digit barrier 0–9 (Over 5 → digits 6–9, etc.)
                    type: 'input_value',
                    name: 'BARRIER',
                    check: 'Number',
                },
                {
                    // User-configurable sliding window size N (not fixed at 100).
                    type: 'input_value',
                    name: 'WINDOW',
                    check: 'Number',
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize(
                'Returns what percent (0–100) of the last N digits are Over (>) or Under (<) the barrier. N is user-configurable (1–{{ max }}). Sliding window: each new digit drops the oldest.',
                { max: MAX_WINDOW }
            ),
            category: window.Blockly.Categories.Trade_Definition,
        };
    },
    meta() {
        return {
            display_name: localize('% of last digits'),
            description: localize(
                'Returns a number: the percent of the last N digits matching Over or Under the barrier. Set N yourself (default 100, up to {{ max }}). Over 5 → digits 6–9. Under 4 → digits 0–3. Compare with >, <, etc. in Purchase conditions.',
                { max: MAX_WINDOW }
            ),
            key_words: localize('over, under, percentage, digits, barrier, trade parameters, window'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

/**
 * Resolve a numeric Blockly input or legacy field into a code expression.
 */
const readNumberArg = (block, name, fallback) => {
    const from_input = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        name,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );
    if (from_input) {
        return from_input;
    }
    // Legacy workspaces used field_number for BARRIER / WINDOW / THRESHOLD.
    const from_field =
        block.getFieldValue(name) ?? (name === 'BARRIER' ? block.getFieldValue('THRESHOLD') : null);
    if (from_field !== null && from_field !== undefined && from_field !== '') {
        return String(from_field);
    }
    return String(fallback);
};

const generateDigitPercentageCode = block => {
    const direction = block.getFieldValue('DIRECTION') || 'OVER';
    const barrier_code = readNumberArg(block, 'BARRIER', 5);
    const window_code = readNumberArg(block, 'WINDOW', DEFAULT_WINDOW);

    // Clamp at runtime so any user-entered N is honoured up to the live-history cap.
    const code = `Bot.evaluateDigitPercentageCondition(${JSON.stringify(
        direction
    )}, ${barrier_code}, ${window_code})`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

// Single toolbox block. Legacy type names stay registered so older workspaces still load.
const BLOCK_TYPES = ['digit_percentage_condition', 'digit_percentage_over', 'digit_percentage_under'];

BLOCK_TYPES.forEach(type => {
    window.Blockly.Blocks[type] = { ...BLOCK_DEFINITION };
    window.Blockly.JavaScript.javascriptGenerator.forBlock[type] = generateDigitPercentageCode;
});
