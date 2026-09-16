import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_pair_return_differs_prediction = {
    init() {
        this.jsonInit({
            message0: localize(
                'Digit Pair → Return Differs (window {{ window }}, auto {{ auto }}, journal {{ journal }})',
                {
                    window: '%1',
                    auto: '%2',
                    journal: '%3',
                }
            ),
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
            tooltip: localize(
                'Learns A → B → C → D → E → F for every digit pattern, then returns stored F when A → B → C → D → E reappear as the previous five digits.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        });
    },
    meta() {
        return {
            display_name: localize('Digit Pair → Return Differs'),
            description: localize(
                'Stores the follower after A → B → C → D → E → F, then signals Digit Differs F when A → B → C → D → E appear again as the previous five digits before a new tip.'
            ),
            key_words: localize('digit pair, sextet, return, differs, pattern, confirmation'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_pair_return_differs_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );
    const code = `(function () {
        var BinaryBotPrivateDprResult = Bot.evaluateDigitPairReturnDiffers({
            tick_window: ${read('WINDOW') || '120'},
            auto_trading: ${read('AUTO') || 'true'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateDprMsgs = BinaryBotPrivateDprResult && BinaryBotPrivateDprResult.journal_messages;
        if (BinaryBotPrivateDprMsgs && BinaryBotPrivateDprMsgs.length) {
            for (var BinaryBotPrivateDprIndex = 0; BinaryBotPrivateDprIndex < BinaryBotPrivateDprMsgs.length && BinaryBotPrivateDprIndex < 10; BinaryBotPrivateDprIndex++) {
                var BinaryBotPrivateDprMsg = BinaryBotPrivateDprMsgs[BinaryBotPrivateDprIndex];
                Bot.notify({ className: BinaryBotPrivateDprMsg.className, message: BinaryBotPrivateDprMsg.message, sound: 'silent', block_id: ${JSON.stringify(block.id)}, variable_name: null });
            }
            if (BinaryBotPrivateDprResult && BinaryBotPrivateDprResult.state_summary) {
                Bot.notify({ className: 'journal__text', message: 'Digit Pair states: ' + BinaryBotPrivateDprResult.state_summary, sound: 'silent', block_id: ${JSON.stringify(block.id)}, variable_name: null });
            }
        }
        return BinaryBotPrivateDprResult && BinaryBotPrivateDprResult.allowed && ${read('AUTO') || 'true'}
            ? Number(BinaryBotPrivateDprResult.prediction) : -1;
    })()`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
