/**
 * Repeated Digit Recurrence DIFFER — returns Differ digit (0–9) or -1.
 * When digit × N recurs after prior occurrence(s), Differ that digit.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.repeated_digit_recurrence_differ_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'repeated digit recurrence differ N %1 digits %2 minPrev %3 histFilter %4 minHist%% %5 cooldown %6 journal %7'
            ),
            args0: [
                { type: 'input_value', name: 'REPETITION_COUNT', check: 'Number' },
                { type: 'input_value', name: 'TARGET_DIGITS', check: 'String' },
                { type: 'input_value', name: 'MIN_PREVIOUS', check: 'Number' },
                { type: 'input_value', name: 'HIST_FILTER', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_HIST_PCT', check: 'Number' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'When a digit repeats N times again after prior occurrence(s), Differ that digit. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Repeated Digit Recurrence DIFFER scan'),
            description: localize(
                'Trades Digit Differs against a digit when its exact consecutive repetition pattern recurs.'
            ),
            key_words: localize('repeat, recurrence, differs, consecutive digits'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.repeated_digit_recurrence_differ_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateRdrResult = Bot.evaluateRepeatedDigitRecurrence({
            repetition_count: ${read('REPETITION_COUNT') || '3'},
            target_digits: ${read('TARGET_DIGITS') || '"ALL"'},
            min_previous_occurrences: ${read('MIN_PREVIOUS') || '1'},
            exact_run_matching: true,
            allow_entry_during_run: false,
            historical_differ_filter: ${read('HIST_FILTER') || 'false'},
            min_historical_differ_pct: ${read('MIN_HIST_PCT') || '70'},
            recent_filter: false,
            recent_window: 10,
            min_recent_differ_pct: 70,
            max_losing_streak: 5,
            signal_cooldown_tips: ${read('COOLDOWN') || '1'},
            min_signal_score: 0,
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateRdrResult && BinaryBotPrivateRdrResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateRdrResult
            ? Number(BinaryBotPrivateRdrResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0
            ? BinaryBotPrivatePrediction
            : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
