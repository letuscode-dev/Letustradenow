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
} from '../../../../services/tradeEngine/utils/sequential-digit-differs';

window.Blockly.Blocks.sequential_digit_differs_prediction = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'sequential Differs scan (group {{ group }}, loss retry {{ retry }}, journal {{ journal }})',
                {
                    group: '%1',
                    retry: '%2',
                    journal: '%3',
                }
            ),
            args0: [
                { type: 'input_value', name: 'MARKET_GROUP', check: 'String' },
                { type: 'input_value', name: 'IMMEDIATE_LOSS_RETRY', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans volatility symbols by Market_group: 1S (1-second), STANDARD, or ALL. On ascending (1→2→3) or descending (8→7→6) runs, Differs previous_digit_2 (1 or 8). Optional same-digit Differs after a loss.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Sequential Digit Differs scan'),
            description: localize(
                'Scans configured volatility markets for consecutive ascending or descending last-3 digit runs. Set Market_group in Run once at start to 1S, STANDARD, or ALL. Optional one-shot same-digit Differs after a loss.'
            ),
            key_words: localize('sequential, ascending, descending, differs, scan, recovery, loss retry'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.sequential_digit_differs_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const market_group = read('MARKET_GROUP') || JSON.stringify(DEFAULT_MARKET_GROUP);
    const journal = read('JOURNAL') || 'true';
    const immediate_loss_retry =
        read('IMMEDIATE_LOSS_RETRY') || (DEFAULT_IMMEDIATE_LOSS_RETRY ? 'true' : 'false');

    const code = `(function () {
        var BinaryBotPrivateSeqResult = Bot.evaluateSequentialDigitDiffersScan({
            market_group: ${market_group},
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
