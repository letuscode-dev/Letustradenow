import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.complement_digit_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('complement digit Differs (on {{ enabled }}, journal {{ journal }})', {
                enabled: '%1',
                journal: '%2',
            }),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'When the previous and current last digits are complements (0↔9, 1↔8, 2↔7, 3↔6, 4↔5), returns the previous digit for Differs; otherwise -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Complement digit prediction'),
            description: localize(
                'Watches the last two digits. If they form a complement pair that sums to 9, returns the previous digit so Differs can be placed on it. Returns -1 when there is no complement pair.'
            ),
            key_words: localize('complement, mirror, digit, differs, 0-9, 1-8'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.complement_digit_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const enabled = read('ENABLED') || 'true';
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateComplementResult = Bot.evaluateComplementDigit({
            enabled: ${enabled},
            journal_enabled: ${journal}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateComplementResult && BinaryBotPrivateComplementResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 2 ? 2 : BinaryBotPrivateMsgs.length;
            for (BinaryBotPrivateMsgIndex = 0; BinaryBotPrivateMsgIndex < BinaryBotPrivateMsgLimit; BinaryBotPrivateMsgIndex++) {
                var BinaryBotPrivateMsg = BinaryBotPrivateMsgs[BinaryBotPrivateMsgIndex];
                Bot.notify({
                    className: BinaryBotPrivateMsg.className,
                    message: BinaryBotPrivateMsg.message,
                    sound: 'silent',
                    block_id: ${JSON.stringify(block.id)},
                    variable_name: null
                });
            }
        }
        var BinaryBotPrivatePrediction = BinaryBotPrivateComplementResult
            ? Number(BinaryBotPrivateComplementResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
