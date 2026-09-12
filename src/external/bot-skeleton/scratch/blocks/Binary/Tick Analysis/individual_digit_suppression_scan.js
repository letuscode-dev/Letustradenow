/**
 * Individual Digit Suppression — returns best Over barrier (1/2/3) or -1.
 * Ranks Over 1 / Over 2 / Over 3 from multi-window digit suppression.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.individual_digit_suppression_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'digit suppression Over short %1 med %2 long %3 min% %4 mod %5 high %6 vhigh %7 wins %8 score %9 persist %10 trend %11 O1 %12 O2 %13 O3 %14 journal %15'
            ),
            args0: [
                { type: 'input_value', name: 'SHORT_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MEDIUM_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'LONG_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MIN_SUPPRESSION', check: 'Number' },
                { type: 'input_value', name: 'MODERATE_THRESHOLD', check: 'Number' },
                { type: 'input_value', name: 'HIGH_THRESHOLD', check: 'Number' },
                { type: 'input_value', name: 'VERY_HIGH_THRESHOLD', check: 'Number' },
                { type: 'input_value', name: 'MIN_CONFIRM_WINDOWS', check: 'Number' },
                { type: 'input_value', name: 'MIN_SIGNAL_SCORE', check: 'Number' },
                { type: 'input_value', name: 'REQUIRE_PERSISTENCE', check: 'Boolean' },
                { type: 'input_value', name: 'REQUIRE_TREND', check: 'Boolean' },
                { type: 'input_value', name: 'ENABLE_OVER_1', check: 'Boolean' },
                { type: 'input_value', name: 'ENABLE_OVER_2', check: 'Boolean' },
                { type: 'input_value', name: 'ENABLE_OVER_3', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Ranks Over 1 / Over 2 / Over 3 from suppressed losing digits across Short/Medium/Long windows. Returns best barrier 1–3 or -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Individual Digit Suppression scan'),
            description: localize(
                'Finds digits under the 10% baseline across configurable tick windows and ranks Over 1 / Over 2 / Over 3 confirmations.'
            ),
            key_words: localize('suppression, digit, over, frequency, persistence, dashboard'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.individual_digit_suppression_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateIdsResult = Bot.evaluateIndividualDigitSuppression({
            short_window: ${read('SHORT_WINDOW') || '50'},
            medium_window: ${read('MEDIUM_WINDOW') || '100'},
            long_window: ${read('LONG_WINDOW') || '200'},
            min_suppression: ${read('MIN_SUPPRESSION') || '0'},
            moderate_threshold: ${read('MODERATE_THRESHOLD') || '3'},
            high_threshold: ${read('HIGH_THRESHOLD') || '5'},
            very_high_threshold: ${read('VERY_HIGH_THRESHOLD') || '7'},
            min_confirm_windows: ${read('MIN_CONFIRM_WINDOWS') || '2'},
            min_signal_score: ${read('MIN_SIGNAL_SCORE') || '6'},
            require_persistence: ${read('REQUIRE_PERSISTENCE') || 'true'},
            require_trend: ${read('REQUIRE_TREND') || 'false'},
            enable_over_1: ${read('ENABLE_OVER_1') || 'true'},
            enable_over_2: ${read('ENABLE_OVER_2') || 'true'},
            enable_over_3: ${read('ENABLE_OVER_3') || 'true'},
            trade_as: '',
            max_simultaneous_signals: 1,
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateIdsResult && BinaryBotPrivateIdsResult.journal_messages;
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
        var BinaryBotPrivateBarrier = BinaryBotPrivateIdsResult
            ? Number(BinaryBotPrivateIdsResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivateBarrier) ? BinaryBotPrivateBarrier : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
