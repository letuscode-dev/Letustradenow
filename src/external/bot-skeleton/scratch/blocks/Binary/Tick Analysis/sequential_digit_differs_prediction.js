/**
 * Sequential Digit Differs prediction — scans configured volatility symbols
 * for ascending/descending consecutive last-3 digit runs, returns Differs barrier.
 * Hidden from Blocks Menu; free bot wraps it in a custom function.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
    DEFAULT_IMMEDIATE_LOSS_RETRY,
    DEFAULT_MARKET_GROUP,
    MARKET_GROUP_1S,
    MARKET_GROUP_ALL,
    MARKET_GROUP_STANDARD,
} from '../../../../services/tradeEngine/utils/sequential-digit-differs';

const MARKET_GROUP_OPTIONS = [
    [localize('1s Volatility'), MARKET_GROUP_1S],
    [localize('Standard Volatility'), MARKET_GROUP_STANDARD],
    [localize('All Volatility'), MARKET_GROUP_ALL],
];

window.Blockly.Blocks.sequential_digit_differs_prediction = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'sequential Differs scan ({{ group }}, loss retry {{ retry }}, journal {{ journal }})',
                {
                    group: '%1',
                    retry: '%2',
                    journal: '%3',
                }
            ),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'MARKET_GROUP',
                    options: MARKET_GROUP_OPTIONS,
                },
                { type: 'input_value', name: 'IMMEDIATE_LOSS_RETRY', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans 1s or standard volatility symbols. Ascending (1→2→3) Differs 4; descending (8→7→6) Differs 5. Optional: after a loss, Differ the same digit once with no analysis, then resume scanning.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Sequential Digit Differs scan'),
            description: localize(
                'Scans configured volatility markets for consecutive ascending or descending last-3 digit runs. Optional one-shot same-digit Differs after a loss, then back to analysis.'
            ),
            key_words: localize('sequential, ascending, descending, differs, scan, recovery, loss retry'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.sequential_digit_differs_prediction = block => {
    const market_group = block.getFieldValue('MARKET_GROUP') || DEFAULT_MARKET_GROUP;
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const journal = read('JOURNAL') || 'true';
    const immediate_loss_retry =
        read('IMMEDIATE_LOSS_RETRY') || (DEFAULT_IMMEDIATE_LOSS_RETRY ? 'true' : 'false');

    const code = `(function () {
        var BinaryBotPrivateSeqResult = Bot.evaluateSequentialDigitDiffersScan({
            market_group: ${JSON.stringify(market_group)},
            journal_enabled: ${journal},
            immediate_loss_retry: ${immediate_loss_retry},
            switch_symbol: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateSeqResult && BinaryBotPrivateSeqResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 3 ? 3 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateSeqResult
            ? Number(BinaryBotPrivateSeqResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
