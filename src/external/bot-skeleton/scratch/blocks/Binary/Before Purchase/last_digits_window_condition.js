/**
 * Boolean last-digit window checks used by Pattern Switch free bot.
 *
 * CONDITIONS:
 *   ALL_ODD / ALL_EVEN — every one of the last N digits is odd/even
 *   LESS_OR_EQUAL / GREATER_OR_EQUAL — every one of the last N digits
 *     compares against COMPARE_VALUE
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const CONDITION_OPTIONS = [
    [localize('all odd'), 'ALL_ODD'],
    [localize('all even'), 'ALL_EVEN'],
    [localize('all ≤'), 'LESS_OR_EQUAL'],
    [localize('all ≥'), 'GREATER_OR_EQUAL'],
];

const NEEDS_COMPARE = {
    LESS_OR_EQUAL: true,
    GREATER_OR_EQUAL: true,
};

window.Blockly.Blocks.last_digits_window_condition = {
    init() {
        this.jsonInit(this.definition());
        this.updateShape_();
    },
    definition() {
        return {
            message0: localize('last {{ n }} digits are {{ condition }} {{ compare }}', {
                n: '%1',
                condition: '%2',
                compare: '%3',
            }),
            args0: [
                { type: 'input_value', name: 'N', check: 'Number' },
                {
                    type: 'field_dropdown',
                    name: 'CONDITION',
                    options: CONDITION_OPTIONS,
                },
                { type: 'input_value', name: 'COMPARE_VALUE', check: 'Number' },
            ],
            inputsInline: true,
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'True when every digit in the last N tips matches the selected parity or comparison.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Last digits window condition'),
            description: localize(
                'Checks whether the last N last-digits are all odd, all even, all ≤ a value, or all ≥ a value.'
            ),
            key_words: localize('last digit, odd, even, over, under, window, pattern'),
        };
    },
    onchange(event) {
        if (!this.workspace || this.isInFlyout) {
            return;
        }
        if (
            event.type === window.Blockly.Events.BLOCK_CHANGE &&
            event.blockId === this.id &&
            event.name === 'CONDITION'
        ) {
            this.updateShape_();
        }
    },
    updateShape_() {
        const condition = this.getFieldValue('CONDITION') || 'ALL_ODD';
        const compare_input = this.getInput('COMPARE_VALUE');
        if (!compare_input) {
            return;
        }
        compare_input.setVisible(Boolean(NEEDS_COMPARE[condition]));
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_digits_window_condition = block => {
    const n_code =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'N',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '1';
    const condition = block.getFieldValue('CONDITION') || 'ALL_ODD';
    const compare_code =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'COMPARE_VALUE',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '0';

    const code = `(function () {
        var BinaryBotPrivateN = Math.max(1, Math.floor(Number(${n_code})) || 1);
        var BinaryBotPrivateDigits = Bot.getCachedLastDigitList(BinaryBotPrivateN);
        if (!BinaryBotPrivateDigits || BinaryBotPrivateDigits.length < BinaryBotPrivateN) {
            return false;
        }
        var BinaryBotPrivateWindow = BinaryBotPrivateDigits.slice(-BinaryBotPrivateN);
        var BinaryBotPrivateCompare = Number(${compare_code});
        return BinaryBotPrivateWindow.every(function (BinaryBotPrivateDigit) {
            BinaryBotPrivateDigit = Number(BinaryBotPrivateDigit);
            if (isNaN(BinaryBotPrivateDigit)) {
                return false;
            }
            if (${JSON.stringify(condition)} === 'ALL_ODD') {
                return Math.abs(BinaryBotPrivateDigit % 2) === 1;
            }
            if (${JSON.stringify(condition)} === 'ALL_EVEN') {
                return Math.abs(BinaryBotPrivateDigit % 2) === 0;
            }
            if (${JSON.stringify(condition)} === 'LESS_OR_EQUAL') {
                return BinaryBotPrivateDigit <= BinaryBotPrivateCompare;
            }
            if (${JSON.stringify(condition)} === 'GREATER_OR_EQUAL') {
                return BinaryBotPrivateDigit >= BinaryBotPrivateCompare;
            }
            return false;
        });
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

// Alias so Apollo-exported XML that uses type="last_digits_condition" as a
// boolean value can still load when the CONDITION field is present. The
// statement-form block (same type) remains for toolbox drag-drop; XML load
// with CONDITION field will use this generator only if we register separately.
// Free-bot XML uses last_digits_window_condition explicitly.
