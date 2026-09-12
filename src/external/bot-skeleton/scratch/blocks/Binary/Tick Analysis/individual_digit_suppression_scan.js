/**
 * Individual Digit Suppression — returns Over 1 barrier (1) or -1.
 * Strategy thresholds are baked into the generator; users only wire tick windows.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.individual_digit_suppression_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize('digit suppression Over 1 (short %1 med %2 long %3 journal %4)', {
                short: '%1',
                med: '%2',
                long: '%3',
                journal: '%4',
            }),
            args0: [
                { type: 'input_value', name: 'SHORT_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MEDIUM_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'LONG_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Uses Over 1 / Over 2 suppression scores to drive Over 1 trades. Returns barrier 1 or -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Individual Digit Suppression scan'),
            description: localize(
                'Over 1 / Over 2 digit-suppression analysis drives Over 1 entries across Short/Medium/Long windows.'
            ),
            key_words: localize('suppression, digit, over, frequency, persistence'),
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
            min_suppression: 0,
            moderate_threshold: 3,
            high_threshold: 5,
            very_high_threshold: 7,
            min_confirm_windows: 2,
            min_signal_score: 6,
            require_persistence: true,
            require_trend: false,
            enable_over_1: true,
            enable_over_2: true,
            enable_over_3: false,
            trade_as: 'OVER_1',
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
