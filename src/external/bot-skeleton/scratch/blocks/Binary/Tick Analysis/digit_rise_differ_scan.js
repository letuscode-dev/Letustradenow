/**
 * Digit Rise DIFFER — returns the current digit to Differ on a signal, or -1.
 * Signals when the appearance % of any target digit (comma-separated, max 9) increases.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_rise_differ_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize('digit rise differ targets %1 window %2 lookback %3 cooldown %4 journal %5'),
            args0: [
                { type: 'input_value', name: 'TARGET_DIGITS' },
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'COMPARE_LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Returns the current digit to Differ when the appearance % of any target digit (e.g. "0,1,5", max 9) increases on a new tick, otherwise -1. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit Rise DIFFER scan'),
            description: localize(
                'Places Digit Differs on the current digit when any target digit gains in appearance % over the analysis window (default 120 ticks).'
            ),
            key_words: localize('digit, target, rise, percentage, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_rise_differ_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateDrdResult = Bot.evaluateDigitRiseDiffer({
            target_digits: String(${read('TARGET_DIGITS') || '"0"'}),
            analysis_window: ${read('ANALYSIS_WINDOW') || '120'},
            compare_lookback: ${read('COMPARE_LOOKBACK') || '1'},
            signal_cooldown_tips: ${read('COOLDOWN') || '1'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateDrdResult && BinaryBotPrivateDrdResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 12 ? 12 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateDrdResult
            ? Number(BinaryBotPrivateDrdResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0
            ? BinaryBotPrivatePrediction
            : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
