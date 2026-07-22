import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.window_index_differs_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'window index Differs (on {{ enabled }}, window {{ window }}, journal {{ journal }})',
                {
                    enabled: '%1',
                    window: '%2',
                    journal: '%3',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'TICK_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Collects n digits as a reference window. In the next window, Differs each index against the digit that was at the same index previously. Returns -1 while collecting or waiting.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Window index Differs prediction'),
            description: localize(
                'Uses a rolling n-tick reference window. For each index 1..n in the next window, places Digit Differs on the digit from the same index in the previous window, then rolls forward.'
            ),
            key_words: localize('window, index, differs, recovery, barrier'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.window_index_differs_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateWidResult = Bot.evaluateWindowIndexDiffers({
            enabled: ${read('ENABLED') || 'true'},
            tick_window: ${read('TICK_WINDOW') || '5'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateWidResult && BinaryBotPrivateWidResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateWidResult
            ? Number(BinaryBotPrivateWidResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
