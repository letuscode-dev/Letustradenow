/**
 * Digit Percentage Decrease — returns Differ prediction (0–9) or -1.
 * Detects ≥ min_decrease pp drop for any digit across a rolling analysis window.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_percentage_decrease_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'digit % decrease symbols %1 window %2 min drop %3 journal %4'
            ),
            args0: [
                { type: 'input_value', name: 'SYMBOLS', check: 'String' },
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MIN_DECREASE', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans selected volatilities. On each new tick, recomputes digit percentages and returns Differ prediction for the digit whose share fell by at least the minimum drop, switching to that market.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit Percentage Decrease scan'),
            description: localize(
                'Multi-market Digit Differs when a digit’s occurrence percentage decreases by the configured amount versus the previous tip.'
            ),
            key_words: localize('percentage, decrease, differs, rolling window, multi-market'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_percentage_decrease_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateDpdResult = Bot.evaluateDigitPercentageDecrease({
            symbols: ${read('SYMBOLS') || '""'},
            analysis_window: ${read('ANALYSIS_WINDOW') || '1000'},
            min_decrease: ${read('MIN_DECREASE') || '0.1'},
            journal_enabled: ${read('JOURNAL') || 'true'},
            switch_symbol: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateDpdResult && BinaryBotPrivateDpdResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 8 ? 8 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateDpdResult
            ? Number(BinaryBotPrivateDpdResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
