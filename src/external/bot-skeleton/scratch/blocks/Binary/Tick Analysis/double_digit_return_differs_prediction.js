import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.double_digit_return_differs_prediction = {
    init() {
        this.jsonInit({
            message0: localize('Double Digit → Return Differs (window {{ window }}, auto {{ auto }}, journal {{ journal }})', {
                window: '%1', auto: '%2', journal: '%3',
            }),
            args0: [
                { type: 'input_value', name: 'WINDOW', check: 'Number' },
                { type: 'input_value', name: 'AUTO', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Tracks X → X → Y independently for all ten digits and returns Y only on confirmation.'),
            category: window.Blockly.Categories.Tick_Analysis,
        });
    },
    meta() {
        return {
            display_name: localize('Double Digit → Return Differs'),
            description: localize('Stores a target after X → X → Y, then signals Digit Differs Y only when the same pattern returns.'),
            key_words: localize('double digit, return, differs, digit, confirmation'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.double_digit_return_differs_prediction = block => {
    const read = name => window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block, name, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );
    const code = `(function () {
        var BinaryBotPrivateDdrResult = Bot.evaluateDoubleDigitReturnDiffers({
            tick_window: ${read('WINDOW') || '120'},
            auto_trading: ${read('AUTO') || 'true'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateDdrMsgs = BinaryBotPrivateDdrResult && BinaryBotPrivateDdrResult.journal_messages;
        if (BinaryBotPrivateDdrMsgs && BinaryBotPrivateDdrMsgs.length) {
            for (var BinaryBotPrivateDdrIndex = 0; BinaryBotPrivateDdrIndex < BinaryBotPrivateDdrMsgs.length && BinaryBotPrivateDdrIndex < 10; BinaryBotPrivateDdrIndex++) {
                var BinaryBotPrivateDdrMsg = BinaryBotPrivateDdrMsgs[BinaryBotPrivateDdrIndex];
                Bot.notify({ className: BinaryBotPrivateDdrMsg.className, message: BinaryBotPrivateDdrMsg.message, sound: 'silent', block_id: ${JSON.stringify(block.id)}, variable_name: null });
            }
        }
        if (BinaryBotPrivateDdrResult && BinaryBotPrivateDdrResult.state_summary) {
            Bot.notify({ className: 'journal__text', message: 'Double Digit states: ' + BinaryBotPrivateDdrResult.state_summary, sound: 'silent', block_id: ${JSON.stringify(block.id)}, variable_name: null });
        }
        return BinaryBotPrivateDdrResult && BinaryBotPrivateDdrResult.allowed && ${read('AUTO') || 'true'}
            ? Number(BinaryBotPrivateDdrResult.prediction) : -1;
    })()`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
