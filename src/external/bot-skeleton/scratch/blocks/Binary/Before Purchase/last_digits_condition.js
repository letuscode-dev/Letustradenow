import { localize } from '@deriv-com/translations';
import {
    MAX_TICK_COUNT,
    MIN_TICK_COUNT,
    createLastDigitsConditionBlock,
    createTickCountField,
    getLastDigitsConditionNotifyCode,
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

const OPERATOR_LABEL = {
    GT: '>',
    GTE: '\u2265',
    LT: '<',
    LTE: '\u2264',
    EQ: '=',
    NEQ: '\u2260',
};

const createOperatorField = () => new window.Blockly.FieldDropdown(OPERATOR_OPTIONS);
const createDigitField = () => new window.Blockly.FieldDropdown(DIGIT_OPTIONS);

const getConditionCode = (block, index) => {
    const tick_count = getTickCount(block, index);
    const operator_key = block.getFieldValue(`OPERATOR${index}`) || 'EQ';
    const operator = OPERATOR_CODE[operator_key] || OPERATOR_CODE.EQ;
    const operator_label = OPERATOR_LABEL[operator_key] || OPERATOR_LABEL.EQ;
    const digit = Number(block.getFieldValue(`DIGIT${index}`));
    const notify_code = getLastDigitsConditionNotifyCode({
        block_id: block.id,
        matched_var: 'BinaryBotPrivateMatched',
        message_var: 'BinaryBotPrivateMessage',
    });

    return `(function () {
            var BinaryBotPrivateTickCount = ${tick_count};
            var BinaryBotPrivateLastDigits = Bot.getCachedLastDigitList(BinaryBotPrivateTickCount);
            var BinaryBotPrivateTargetDigit = ${digit};
            var BinaryBotPrivateOperatorLabel = ${JSON.stringify(operator_label)};
            var BinaryBotPrivateMatched = false;
            var BinaryBotPrivateDigitsWindow = [];
            var BinaryBotPrivateMessage = '';

            if (!BinaryBotPrivateLastDigits || BinaryBotPrivateLastDigits.length < BinaryBotPrivateTickCount) {
                BinaryBotPrivateMessage =
                    'Last digit condition not met: need ' +
                    BinaryBotPrivateTickCount +
                    ' digit(s), got ' +
                    (BinaryBotPrivateLastDigits ? BinaryBotPrivateLastDigits.length : 0);
                ${notify_code}
                return false;
            }

            BinaryBotPrivateDigitsWindow = BinaryBotPrivateLastDigits.slice(-BinaryBotPrivateTickCount);
            BinaryBotPrivateMatched = BinaryBotPrivateDigitsWindow.every(function (BinaryBotPrivateDigit) {
                BinaryBotPrivateDigit = Number(BinaryBotPrivateDigit);
                return !isNaN(BinaryBotPrivateDigit) && BinaryBotPrivateDigit ${operator} BinaryBotPrivateTargetDigit;
            });
            BinaryBotPrivateMessage =
                (BinaryBotPrivateMatched
                    ? 'Last digit condition met: last '
                    : 'Last digit condition not met: last ') +
                BinaryBotPrivateTickCount +
                ' digit(s) [' +
                BinaryBotPrivateDigitsWindow.join(', ') +
                ']' +
                (BinaryBotPrivateMatched ? ' are all ' : ' are not all ') +
                BinaryBotPrivateOperatorLabel +
                ' ' +
                BinaryBotPrivateTargetDigit;
            ${notify_code}
            return BinaryBotPrivateMatched;
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
