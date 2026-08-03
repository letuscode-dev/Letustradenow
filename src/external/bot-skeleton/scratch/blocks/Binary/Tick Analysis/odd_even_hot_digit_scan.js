/**
 * Hot Odd/Even Differs scan — tip equals hottest odd/even → Differ coldest digit.
 * Hidden from Blocks Menu; free bot wraps it in a custom function.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import { DEFAULT_LOOKBACK } from '../../../../services/tradeEngine/utils/odd-even-hot-digit';
import { DEFAULT_MARKET_GROUP } from '../../../../services/tradeEngine/utils/sequential-digit-differs';

window.Blockly.Blocks.odd_even_hot_digit_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'hot odd/even Differs (group {{ group }}, lookback {{ lb }}, journal {{ journal }})',
                {
                    group: '%1',
                    lb: '%2',
                    journal: '%3',
                }
            ),
            args0: [
                { type: 'input_value', name: 'MARKET_GROUP', check: 'String' },
                { type: 'input_value', name: 'LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans markets. If the tip digit is the hottest odd or hottest even in lookback, returns the coldest digit to Differ. Otherwise -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Hot Odd/Even Differs scan'),
            description: localize(
                'When tip matches hottest odd or even digit, Differ the least-appearing digit on that market.'
            ),
            key_words: localize('odd, even, hot, cold, differs, scan'),
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

    const market_group = read('MARKET_GROUP') || JSON.stringify(DEFAULT_MARKET_GROUP);
    const lookback = read('LOOKBACK') || String(DEFAULT_LOOKBACK);
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateOeResult = Bot.evaluateOddEvenHotDigitScan({
            market_group: ${market_group},
            lookback: ${lookback},
            journal_enabled: ${journal},
            switch_symbol: true
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
