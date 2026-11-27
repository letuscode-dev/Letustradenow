/**
 * Fast free-bot helpers for current-digit parity strategies.
 *
 * The selector is used in the visible parameter stack. The reader returns the
 * newest cached digit only when it matches that selected parity, so no history
 * fetch or asynchronous interpreter pause is needed for a purchase decision.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colour = () => ({
    colour: window.Blockly.Colours.Base.colour,
    colourSecondary: window.Blockly.Colours.Base.colourSecondary,
    colourTertiary: window.Blockly.Colours.Base.colourTertiary,
});

const PARITY_OPTIONS = [
    [localize('Even'), 'EVEN'],
    [localize('Odd'), 'ODD'],
];

window.Blockly.Blocks.digit_parity_target = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Target {{ parity }}', { parity: '%1' }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PARITY',
                    options: PARITY_OPTIONS,
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize('Choose whether the bot should act on an even or odd current digit.'),
            ...colour(),
        };
    },
    meta() {
        return {
            display_name: localize('Digit parity target'),
            description: localize('A visible Even or Odd target selector for free-bot parameters.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.Blocks.current_digit_for_parity = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Current digit for target {{ parity }}', { parity: '%1' }),
            args0: [
                {
                    type: 'input_value',
                    name: 'TARGET',
                    check: 'Number',
                },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize(
                'Reads only the newest live tick. It returns that digit when it matches the target parity, otherwise -1.'
            ),
            ...colour(),
        };
    },
    meta() {
        return {
            display_name: localize('Current digit for target parity'),
            description: localize('Fast current-tick parity read for the Current Digit Differs free bot.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    getRequiredValueInputs() {
        return {
            TARGET: null,
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_parity_target = block => [
    block.getFieldValue('PARITY') === 'ODD' ? '1' : '0',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.JavaScript.javascriptGenerator.forBlock.current_digit_for_parity = block => {
    const target =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'TARGET',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '0';

    return [
        `Bot.setCurrentDigitDiffersPrediction(${target})`,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
    ];
};
