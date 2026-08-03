/**
 * Sequential Digit Differs prediction — scans configured volatility symbols
 * for ascending/descending consecutive last-3 digit runs, returns Differs barrier.
 * Hidden from Blocks Menu; free bot wraps it in a custom function.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
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
                'sequential Differs scan ({{ group }}, journal {{ journal }})',
                {
                    group: '%1',
                    journal: '%2',
                }
            ),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'MARKET_GROUP',
                    options: MARKET_GROUP_OPTIONS,
                },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans 1s or standard volatility symbols. If last 3 digits ascend (1→2→3) Differs 4; if they descend (8→7→6) Differs 5. Switches market when the signal is on another symbol. Returns -1 when none match.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Sequential Digit Differs scan'),
            description: localize(
                'Scans configured volatility markets for consecutive ascending or descending last-3 digit runs and returns the next digit as a Digit Differs barrier.'
            ),
            key_words: localize('sequential, ascending, descending, differs, scan, volatility, barrier'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.sequential_digit_differs_prediction = block => {
    const market_group = block.getFieldValue('MARKET_GROUP') || DEFAULT_MARKET_GROUP;
    const journal =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'JOURNAL',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'true';

    const code = `(function () {
        var BinaryBotPrivateSeqResult = Bot.evaluateSequentialDigitDiffersScan({
            market_group: ${JSON.stringify(market_group)},
            journal_enabled: ${journal},
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
