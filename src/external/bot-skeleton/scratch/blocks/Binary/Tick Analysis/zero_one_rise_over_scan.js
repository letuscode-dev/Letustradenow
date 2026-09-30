/**
 * Digit Rise OVER — returns the Over barrier on a signal, or -1.
 * Signals when the appearance % of any target digit (comma-separated, max 9) increases.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.zero_one_rise_over_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'digit rise over targets %1 window %2 lookback %3 barrier %4 cooldown %5 journal %6'
            ),
            args0: [
                { type: 'input_value', name: 'TARGET_DIGITS' },
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'COMPARE_LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'BARRIER', check: 'Number' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Returns the Over barrier when the appearance % of any target digit (e.g. "0,1,5", max 9) increases on a new tick, otherwise -1. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit Rise OVER scan'),
            description: localize(
                'Signals Digit Over when any target digit gains in appearance % over the analysis window (default 120 ticks).'
            ),
            key_words: localize('digit, target, rise, percentage, over'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.zero_one_rise_over_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateZorResult = Bot.evaluateZeroOneRise({
            target_digits: String(${read('TARGET_DIGITS') || '"0"'}),
            analysis_window: ${read('ANALYSIS_WINDOW') || '120'},
            compare_lookback: ${read('COMPARE_LOOKBACK') || '1'},
            barrier: ${read('BARRIER') || '1'},
            signal_cooldown_tips: ${read('COOLDOWN') || '1'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateZorResult && BinaryBotPrivateZorResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateZorResult
            ? Number(BinaryBotPrivateZorResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0
            ? BinaryBotPrivatePrediction
            : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
