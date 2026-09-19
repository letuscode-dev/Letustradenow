/**
 * Recurring Pattern Differ — returns Differ prediction (0–9) or -1.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.recurring_pattern_differ_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'recurring pattern differ minL %1 maxL %2 window %3 minOcc %4 min%% %5 minAdv %6 minGap %7 prefer %8 journal %9'
            ),
            args0: [
                { type: 'input_value', name: 'MIN_LENGTH', check: 'Number' },
                { type: 'input_value', name: 'MAX_LENGTH', check: 'Number' },
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MIN_OCCURRENCES', check: 'Number' },
                { type: 'input_value', name: 'MIN_TARGET_PCT', check: 'Number' },
                { type: 'input_value', name: 'MIN_ADVANTAGE', check: 'Number' },
                { type: 'input_value', name: 'MIN_TARGET_GAP', check: 'Number' },
                { type: 'input_value', name: 'CONFLICT_PREFERENCE', check: 'String' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'When a recurring digit pattern completes, returns Digit Differs on the historically most frequent next digit if sample size, percentage, advantage, and gap filters pass.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Recurring Pattern Differ scan'),
            description: localize(
                'Trades Digit Differs against the historically most frequent next digit after a recurring pattern.'
            ),
            key_words: localize('pattern, recurrence, conditional probability, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.recurring_pattern_differ_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateRpdResult = Bot.evaluateRecurringPatternDiffer({
            min_pattern_length: ${read('MIN_LENGTH') || '2'},
            max_pattern_length: ${read('MAX_LENGTH') || '6'},
            analysis_window: ${read('ANALYSIS_WINDOW') || '1000'},
            min_occurrences: ${read('MIN_OCCURRENCES') || '50'},
            min_target_pct: ${read('MIN_TARGET_PCT') || '15'},
            min_advantage: ${read('MIN_ADVANTAGE') || '4'},
            min_target_gap: ${read('MIN_TARGET_GAP') || '3'},
            conflict_preference: ${read('CONFLICT_PREFERENCE') || '"longest"'},
            journal_enabled: ${read('JOURNAL') || 'true'},
            multi_window: true,
            recency_weighting: false
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateRpdResult && BinaryBotPrivateRpdResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 10 ? 10 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateRpdResult
            ? Number(BinaryBotPrivateRpdResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
