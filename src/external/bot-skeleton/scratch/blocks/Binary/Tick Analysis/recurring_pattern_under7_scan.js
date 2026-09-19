/**
 * Recurring Pattern Under 7 Consistency — returns barrier 7 on valid signal, else -1.
 * ACTIVE defaults: length 3, min occ 10, Under 7 ≥75%, edge ≥5pp, consistency ≥70.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.recurring_pattern_under7_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'recurring pattern under7 len %1 window %2 minOcc %3 minRate %4 minEdge %5 minCons %6 mode %7 journal %8'
            ),
            args0: [
                { type: 'input_value', name: 'PATTERN_LENGTH', check: 'Number' },
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MIN_OCCURRENCES', check: 'Number' },
                { type: 'input_value', name: 'MIN_UNDER7_RATE', check: 'Number' },
                { type: 'input_value', name: 'MIN_EDGE', check: 'Number' },
                { type: 'input_value', name: 'MIN_CONSISTENCY', check: 'Number' },
                { type: 'input_value', name: 'MODE', check: 'String' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'UNDER 7 only: when a recurring digit pattern shows high Under 7 rate AND high consistency, return barrier 7. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Recurring Pattern Under 7 scan'),
            description: localize(
                'Trades Digit Under 7 when a recurring pattern has a high and consistent historical Under 7 rate (ACTIVE defaults).'
            ),
            key_words: localize('pattern, over 2, consistency, recurring, active'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.recurring_pattern_under7_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateRpuLen = ${read('PATTERN_LENGTH') || '3'};
        var BinaryBotPrivateRpuMode = ${read('MODE') || '"active"'};
        var BinaryBotPrivateRpuStrict = String(BinaryBotPrivateRpuMode).toLowerCase() === 'strict';
        var BinaryBotPrivateRpuResult = Bot.evaluateRecurringPatternUnder7({
            pattern_length: BinaryBotPrivateRpuLen,
            analysis_window: ${read('ANALYSIS_WINDOW') || '1000'},
            min_occurrences: ${read('MIN_OCCURRENCES') || 'NaN'},
            min_under7_rate: ${read('MIN_UNDER7_RATE') || 'NaN'},
            min_edge: ${read('MIN_EDGE') || 'NaN'},
            min_consistency_score: ${read('MIN_CONSISTENCY') || 'NaN'},
            min_recent_rate: BinaryBotPrivateRpuStrict ? 75 : 70,
            max_rolling_range: BinaryBotPrivateRpuStrict ? 20 : 30,
            max_losing_streak: BinaryBotPrivateRpuStrict ? 3 : 5,
            recent_window: 10,
            rolling_window: 10,
            block_size: 5,
            mode: BinaryBotPrivateRpuMode,
            min_signal_score: 0,
            signal_cooldown_tips: 1,
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateRpuResult && BinaryBotPrivateRpuResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 14 ? 14 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateRpuResult
            ? Number(BinaryBotPrivateRpuResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0 ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
