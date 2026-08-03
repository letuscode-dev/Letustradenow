/**
 * Odd/Even Hot Digit Differs — single active market.
 * Tip equals hottest odd/even → Differ coldest digit.
 * Hidden from Blocks Menu; free bot wraps it in a custom function.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import { DEFAULT_LOOKBACK } from '../../../../services/tradeEngine/utils/odd-even-hot-digit';

window.Blockly.Blocks.odd_even_hot_digit_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize('odd/even hot Differs (lookback {{ lb }}, journal {{ journal }})', {
                lb: '%1',
                journal: '%2',
            }),
            args0: [
                { type: 'input_value', name: 'LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'On the selected market: tip = hottest even → Differ coldest even; tip = hottest odd → Differ coldest odd. Otherwise -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Odd/Even Hot Digit Differs'),
            description: localize(
                'Single-market Differs: tip matches hottest odd → Differ coldest odd; hottest even → Differ coldest even.'
            ),
            key_words: localize('odd, even, hot, cold, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.odd_even_hot_digit_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const lookback = read('LOOKBACK') || String(DEFAULT_LOOKBACK);
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateOeResult = Bot.evaluateOddEvenHotDigitScan({
            lookback: ${lookback},
            journal_enabled: ${journal},
            switch_symbol: false
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateOeResult && BinaryBotPrivateOeResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 3 ? 3 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateOeResult
            ? Number(BinaryBotPrivateOeResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
