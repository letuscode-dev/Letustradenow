import { localize } from '@deriv-com/translations';
import {
    MAX_TICK_COUNT,
    MIN_TICK_COUNT,
    createLastDigitsConditionBlock,
    createTickCountField,
    getTickCount,
} from './last_digits_condition_base';

const DIGIT_OPTIONS = Array.from({ length: 10 }, (_, digit) => [String(digit), String(digit)]);

const OPERATOR_OPTIONS = [
    ['>', 'GT'],
    ['\u2265', 'GTE'],
    ['<', 'LT'],
    ['\u2264', 'LTE'],
    ['=', 'EQ'],
    ['\u2260', 'NEQ'],
];

const OPERATOR_CODE = {
    GT: '>',
    GTE: '>=',
    LT: '<',
    LTE: '<=',
    EQ: '===',
    NEQ: '!==',
};

const createOperatorField = () => new window.Blockly.FieldDropdown(OPERATOR_OPTIONS);
const createDigitField = () => new window.Blockly.FieldDropdown(DIGIT_OPTIONS);

const getConditionCode = (block, index) => {
    const tick_count = getTickCount(block, index);
    const operator = OPERATOR_CODE[block.getFieldValue(`OPERATOR${index}`)] || OPERATOR_CODE.EQ;
    const digit = Number(block.getFieldValue(`DIGIT${index}`));

    return `(function () {
            var BinaryBotPrivateTickCount = ${tick_count};
            var BinaryBotPrivateLastDigits = Bot.getCachedLastDigitList(BinaryBotPrivateTickCount);
            var BinaryBotPrivateTargetDigit = ${digit};
            if (!BinaryBotPrivateLastDigits || BinaryBotPrivateLastDigits.length < BinaryBotPrivateTickCount) {
                return false;
            }
            return BinaryBotPrivateLastDigits.slice(-BinaryBotPrivateTickCount).every(function (BinaryBotPrivateDigit) {
                BinaryBotPrivateDigit = Number(BinaryBotPrivateDigit);
                return !isNaN(BinaryBotPrivateDigit) && BinaryBotPrivateDigit ${operator} BinaryBotPrivateTargetDigit;
            });
        })()`;
};

createLastDigitsConditionBlock({
    type: 'last_digits_condition',
    definition: () => ({
        message0: localize('if last {{ tick_count }} digit(s) are {{ operator }} {{ digit }} then', {
            tick_count: '%1',
            operator: '%2',
            digit: '%3',
        }),
        message1: '%1',
        message2: '%1',
        args0: [
            {
                type: 'field_number',
                name: 'TICK_COUNT0',
                value: MIN_TICK_COUNT,
                min: MIN_TICK_COUNT,
                max: MAX_TICK_COUNT,
                precision: 1,
            },
            {
                type: 'field_dropdown',
                name: 'OPERATOR0',
                options: OPERATOR_OPTIONS,
            },
            {
                type: 'field_dropdown',
                name: 'DIGIT0',
                options: DIGIT_OPTIONS,
            },
        ],
        args1: [
            {
                type: 'field_image',
                src: ' ',
                width: 150,
                height: 1,
            },
        ],
        args2: [
            {
                type: 'input_statement',
                name: 'DO0',
            },
        ],
        inputsInline: true,
        colour: window.Blockly.Colours.Special1.colour,
        colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
        colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
        previousStatement: null,
        nextStatement: null,
        tooltip: localize('Runs the branch when every one of the last selected tick digits matches the comparison.'),
        category: window.Blockly.Categories.Before_Purchase,
    }),
    appendConditionFields: (input, index) => {
        input.appendField(localize('else if last'))
            .appendField(createTickCountField(), `TICK_COUNT${index}`)
            .appendField(localize('digit(s) are'))
            .appendField(createOperatorField(), `OPERATOR${index}`)
            .appendField(createDigitField(), `DIGIT${index}`)
            .appendField(localize('then'));
    },
    getConditionCode,
    getConditionValue: (block, index) => ({
        tick_count: block.getFieldValue(`TICK_COUNT${index}`),
        operator: block.getFieldValue(`OPERATOR${index}`),
        digit: block.getFieldValue(`DIGIT${index}`),
    }),
    restoreConditionValue: (block, index, condition) => {
        block.setFieldValue(condition.tick_count || String(MIN_TICK_COUNT), `TICK_COUNT${index}`);
        block.setFieldValue(condition.operator || 'GT', `OPERATOR${index}`);
        block.setFieldValue(condition.digit || '0', `DIGIT${index}`);
    },
    meta: () => ({
        display_name: localize('Last digit condition'),
        description: localize(
            'Use this block to check every live tick and run a branch when all of the last n tick digits are greater than, greater than or equal to, less than, less than or equal to, equal to, or not equal to a selected digit. It cannot be used in Run once at start.'
        ),
        key_words: localize('last digit, digits, tick, comparison, over, under, matches, differs'),
    }),
});
