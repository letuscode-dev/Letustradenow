/**
 * Hot Digit Differs — single active market, parity-scoped.
 * parity even: tip = hottest even → Differ coldest even
 * parity odd:  tip = hottest odd  → Differ coldest odd
 * Hidden from Blocks Menu; free bots wrap it in a custom function.
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
            message0: localize(
                'hot Differs (parity {{ parity }}, lookback {{ lb }}, journal {{ journal }})',
                {
                    parity: '%1',
                    lb: '%2',
                    journal: '%3',
                }
            ),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PARITY',
                    options: [
                        [localize('even'), 'even'],
                        [localize('odd'), 'odd'],
                        [localize('both'), 'both'],
                    ],
                },
                { type: 'input_value', name: 'LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'On the selected market: even = tip hottest even → Differ coldest even; odd = tip hottest odd → Differ coldest odd. Otherwise -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Hot Digit Differs'),
            description: localize(
                'Single-market Differs scoped by parity: even-only, odd-only, or both.'
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

    const parity = block.getFieldValue('PARITY') || 'both';
    const lookback = read('LOOKBACK') || String(DEFAULT_LOOKBACK);
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateOeResult = Bot.evaluateOddEvenHotDigitScan({
            lookback: ${lookback},
            parity: ${JSON.stringify(parity)},
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
