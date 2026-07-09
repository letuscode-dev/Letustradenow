import { localize } from '@deriv-com/translations';
import {
    MAX_TICK_COUNT,
    MIN_TICK_COUNT,
    createLastDigitsConditionBlock,
    createTickCountField,
    getTickCount,
} from './last_digits_condition_base';

const PARITY_OPTIONS = [
    [localize('Odd'), 'ODD'],
    [localize('Even'), 'EVEN'],
];

const createParityField = () => new window.Blockly.FieldDropdown(PARITY_OPTIONS);

const getConditionCode = (block, index) => {
    const tick_count = getTickCount(block, index);
    const parity = block.getFieldValue(`PARITY${index}`) === 'EVEN' ? 'EVEN' : 'ODD';
    const remainder = parity === 'EVEN' ? 0 : 1;

    return `(function () {
            var BinaryBotPrivateLastDigits = Bot.getLastDigitList();
            var BinaryBotPrivateTickCount = ${tick_count};
            if (!BinaryBotPrivateLastDigits || BinaryBotPrivateLastDigits.length < BinaryBotPrivateTickCount) {
                return false;
            }
            return BinaryBotPrivateLastDigits.slice(-BinaryBotPrivateTickCount).every(function (BinaryBotPrivateDigit) {
                BinaryBotPrivateDigit = Number(BinaryBotPrivateDigit);
                return !isNaN(BinaryBotPrivateDigit) && Math.abs(BinaryBotPrivateDigit % 2) === ${remainder};
            });
        })()`;
};

createLastDigitsConditionBlock({
    type: 'last_digits_odd_even_condition',
    definition: () => ({
        message0: localize('if last {{ tick_count }} digit(s) are {{ odd_even }} then', {
            tick_count: '%1',
            odd_even: '%2',
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
                name: 'PARITY0',
                options: PARITY_OPTIONS,
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
        tooltip: localize('Runs the branch when every one of the last selected tick digits is odd or even.'),
        category: window.Blockly.Categories.Before_Purchase,
    }),
    appendConditionFields: (input, index) => {
        input.appendField(localize('else if last'))
            .appendField(createTickCountField(), `TICK_COUNT${index}`)
            .appendField(localize('digit(s) are'))
            .appendField(createParityField(), `PARITY${index}`)
            .appendField(localize('then'));
    },
    getConditionCode,
    getConditionValue: (block, index) => ({
        tick_count: block.getFieldValue(`TICK_COUNT${index}`),
        parity: block.getFieldValue(`PARITY${index}`),
    }),
    restoreConditionValue: (block, index, condition) => {
        block.setFieldValue(condition.tick_count || String(MIN_TICK_COUNT), `TICK_COUNT${index}`);
        block.setFieldValue(condition.parity || 'ODD', `PARITY${index}`);
    },
    meta: () => ({
        display_name: localize('Last digit odd/even condition'),
        description: localize(
            'Use this Purchase conditions block to check whether every last digit in the selected tick window is odd or even. It requires at least n ticks in history and supports else and else if branches.'
        ),
        key_words: localize('last digit, digits, tick, odd, even'),
    }),
});
