/**
 * Dominant Digit Percentage – Differ scan.
 * Returns Differ prediction (0–9) or -1.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.dominant_digit_percentage_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'dominant digit % window %1 min sample %2 min % %3 gap on %4 gap %5 persist on %6 persist %7 multi on %8 short %9 med %10 long %11 confirm %12 rank %13 tie %14 weak %15 mod %16 strong %17 vstrong %18 journal %19'
            ),
            args0: [
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MIN_SAMPLE', check: 'Number' },
                { type: 'input_value', name: 'MIN_DOMINANT_PERCENT', check: 'Number' },
                { type: 'input_value', name: 'ENABLE_DOMINANCE_GAP', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_DOMINANCE_GAP', check: 'Number' },
                { type: 'input_value', name: 'ENABLE_PERSISTENCE', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_PERSISTENCE', check: 'Number' },
                { type: 'input_value', name: 'ENABLE_MULTI_WINDOW', check: 'Boolean' },
                { type: 'input_value', name: 'SHORT_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MEDIUM_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'LONG_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MIN_CONFIRMING_WINDOWS', check: 'Number' },
                { type: 'input_value', name: 'MAX_TARGET_RANK', check: 'Number' },
                { type: 'input_value', name: 'TIE_HANDLING', check: 'String' },
                { type: 'input_value', name: 'WEAK_MIN', check: 'Number' },
                { type: 'input_value', name: 'MODERATE_MIN', check: 'Number' },
                { type: 'input_value', name: 'STRONG_MIN', check: 'Number' },
                { type: 'input_value', name: 'VERY_STRONG_MIN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Finds the highest-occurrence digit in the analysis window and returns Differ prediction when dominance (and optional gap/persistence/multi-window) filters pass. Otherwise -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Dominant Digit Percentage scan'),
            description: localize(
                'Rolling digit frequency analysis that targets Digit Differs against the dominant digit when configured thresholds and filters pass.'
            ),
            key_words: localize('dominant, percentage, differs, frequency, persistence, consensus'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.dominant_digit_percentage_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateDdpResult = Bot.evaluateDominantDigitPercentage({
            analysis_window: ${read('ANALYSIS_WINDOW') || '200'},
            min_sample: ${read('MIN_SAMPLE') || '50'},
            min_dominant_percent: ${read('MIN_DOMINANT_PERCENT') || '15'},
            enable_dominance_gap: ${read('ENABLE_DOMINANCE_GAP') || 'false'},
            min_dominance_gap: ${read('MIN_DOMINANCE_GAP') || '3'},
            enable_persistence: ${read('ENABLE_PERSISTENCE') || 'false'},
            min_persistence: ${read('MIN_PERSISTENCE') || '3'},
            enable_multi_window: ${read('ENABLE_MULTI_WINDOW') || 'false'},
            short_window: ${read('SHORT_WINDOW') || '50'},
            medium_window: ${read('MEDIUM_WINDOW') || '100'},
            long_window: ${read('LONG_WINDOW') || '200'},
            min_confirming_windows: ${read('MIN_CONFIRMING_WINDOWS') || '2'},
            max_target_rank: ${read('MAX_TARGET_RANK') || '1'},
            tie_handling: ${read('TIE_HANDLING') || '"REJECT_TIE"'},
            weak_min: ${read('WEAK_MIN') || '15'},
            moderate_min: ${read('MODERATE_MIN') || '17'},
            strong_min: ${read('STRONG_MIN') || '20'},
            very_strong_min: ${read('VERY_STRONG_MIN') || '25'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateDdpResult && BinaryBotPrivateDdpResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateDdpResult
            ? Number(BinaryBotPrivateDdpResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
