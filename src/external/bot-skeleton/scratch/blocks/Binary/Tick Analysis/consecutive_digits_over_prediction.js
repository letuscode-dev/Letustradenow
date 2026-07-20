import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.consecutive_digits_over_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'consecutive digits Over (on {{ enabled }}, count {{ count }}, min {{ min }}, base {{ base }}, recovery {{ recovery }}, journal {{ journal }})',
                {
                    enabled: '%1',
                    count: '%2',
                    min: '%3',
                    base: '%4',
                    recovery: '%5',
                    journal: '%6',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'COUNT', check: 'Number' },
                { type: 'input_value', name: 'MIN_DIGIT', check: 'Number' },
                { type: 'input_value', name: 'BASE_PREDICTION', check: 'Number' },
                { type: 'input_value', name: 'RECOVERY_PREDICTION', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'When the last N digits are all >= min, returns Over barrier 2 (or 3 while recovering). Returns -1 when there is no signal.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Consecutive digits Over prediction'),
            description: localize(
                'Trades Over 2 when the last 3 digits are all >= 3. After a loss, the same signal places Over 3 using payout-based recovery stake.'
            ),
            key_words: localize('consecutive, digits, over, recovery, over 2, over 3'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.consecutive_digits_over_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateCdoResult = Bot.evaluateConsecutiveDigitsOver({
            enabled: ${read('ENABLED') || 'true'},
            digit_count: ${read('COUNT') || '3'},
            min_digit: ${read('MIN_DIGIT') || '3'},
            base_prediction: ${read('BASE_PREDICTION') || '2'},
            recovery_prediction: ${read('RECOVERY_PREDICTION') || '3'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateCdoResult && BinaryBotPrivateCdoResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateCdoResult
            ? Number(BinaryBotPrivateCdoResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
