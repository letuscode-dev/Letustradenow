/**
 * Ascending Rank Next Digit DIFFER — returns Differ digit (0–9) or -1.
 * Ranks digits by % ascending and Differs the digit ranked just above the current digit.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.ascending_rank_next_differ_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize('ascending rank next differ window %1 cooldown %2 journal %3'),
            args0: [
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Ranks digits 0–9 by appearance % (ascending) and Differs the digit ranked just above the current digit. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Ascending Rank Next Digit DIFFER scan'),
            description: localize(
                'Places Digit Differs on the next stronger digit above the current digit in the ascending % ranking (default 1000 ticks).'
            ),
            key_words: localize('ascending, rank, percentage, next, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.ascending_rank_next_differ_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateArnResult = Bot.evaluateAscendingRankNext({
            analysis_window: ${read('ANALYSIS_WINDOW') || '1000'},
            signal_cooldown_tips: ${read('COOLDOWN') || '1'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateArnResult && BinaryBotPrivateArnResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateArnResult
            ? Number(BinaryBotPrivateArnResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0
            ? BinaryBotPrivatePrediction
            : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
