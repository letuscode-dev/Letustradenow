/**
 * Triple-digit Martingale scan — multi-volatility Differs signal.
 * Last 3 digits equal → Differ the 4th-from-end digit.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.triple_digit_martingale_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'triple-digit martingale Differs (symbols {{ symbols }}, journal {{ journal }})',
                {
                    symbols: '%1',
                    journal: '%2',
                }
            ),
            args0: [
                { type: 'input_value', name: 'SYMBOLS', check: 'String' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans selected volatilities. When the last 3 digits match, returns Differs prediction = 4th digit from end and switches to that market.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Triple-digit Martingale scan'),
            description: localize(
                'Multi-market Digit Differs when three identical last digits appear. Prediction is the digit immediately before that run.'
            ),
            key_words: localize('martingale, triple, differs, multi-market, volatility'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.triple_digit_martingale_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const symbols = read('SYMBOLS') || '""';
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateTdmResult = Bot.evaluateTripleDigitMartingaleScan({
            symbols: ${symbols},
            journal_enabled: ${journal},
            switch_symbol: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateTdmResult && BinaryBotPrivateTdmResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateTdmResult
            ? Number(BinaryBotPrivateTdmResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
