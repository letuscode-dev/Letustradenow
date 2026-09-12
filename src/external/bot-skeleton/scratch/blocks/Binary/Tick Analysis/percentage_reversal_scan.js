/**
 * Percentage Reversal — returns Differ prediction (0–9) or -1.
 * Scans Selected Symbols for dominance → short-window percentage collapse.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.percentage_reversal_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'percentage reversal symbols %1 short %2 med %3 long %4 dominance %5 collapse %6 min drop %7 journal %8'
            ),
            args0: [
                { type: 'input_value', name: 'SYMBOLS', check: 'String' },
                { type: 'input_value', name: 'SHORT_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MEDIUM_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'LONG_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'DOMINANCE_MIN', check: 'Number' },
                { type: 'input_value', name: 'COLLAPSE_MAX', check: 'Number' },
                { type: 'input_value', name: 'MIN_DROP', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans selected volatilities. Detects a digit that was dominant in longer windows then collapsed in the short window. Returns Differ prediction 0–9 or -1 and switches to that market.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Percentage Reversal scan'),
            description: localize(
                'Multi-market Digit Differs when a digit’s percentage collapses from dominance into underrepresentation across Short/Medium/Long windows.'
            ),
            key_words: localize('percentage, reversal, differs, dominance, collapse, multi-market'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.percentage_reversal_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivatePrResult = Bot.evaluatePercentageReversal({
            symbols: ${read('SYMBOLS') || '""'},
            short_window: ${read('SHORT_WINDOW') || '50'},
            medium_window: ${read('MEDIUM_WINDOW') || '100'},
            long_window: ${read('LONG_WINDOW') || '200'},
            dominance_min: ${read('DOMINANCE_MIN') || '15'},
            collapse_max: ${read('COLLAPSE_MAX') || '10'},
            min_drop: ${read('MIN_DROP') || '7'},
            journal_enabled: ${read('JOURNAL') || 'true'},
            switch_symbol: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivatePrResult && BinaryBotPrivatePrResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 4 ? 4 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivatePrResult
            ? Number(BinaryBotPrivatePrResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
