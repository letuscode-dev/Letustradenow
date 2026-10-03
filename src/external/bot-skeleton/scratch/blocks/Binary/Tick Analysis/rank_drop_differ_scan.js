/**
 * Rank Drop Differs — returns Differ digit (0–9) or -1.
 * Ranks digits by frequency now and Lookback Ticks ago and Differs the digit with
 * the single biggest rank deterioration.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.rank_drop_differ_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'rank drop differs window %1 lookback ticks %2 minimum rank drop %3 enabled %4 new-tick confirmation %5 journal %6'
            ),
            args0: [
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'MIN_DROP', check: 'Number' },
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'CONFIRM', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Ranks digits 0–9 from highest to lowest frequency over the Analysis Window, now and Lookback Ticks ago. Trades DIFFERS against the digit whose rank dropped the most, if the drop is at least the Minimum Rank Drop. Tied biggest movers mean no trade. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Rank Drop Differs scan'),
            description: localize(
                'Places Digit Differs on the digit with the biggest frequency-rank deterioration (default 1000-tick window, 100-tick lookback, minimum drop 3).'
            ),
            key_words: localize('rank, drop, mover, frequency, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.rank_drop_differ_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateRddResult = Bot.evaluateRankDropDiffer({
            analysis_window: ${read('ANALYSIS_WINDOW') || '1000'},
            lookback_ticks: ${read('LOOKBACK') || '100'},
            min_rank_drop: ${read('MIN_DROP') || '3'},
            enabled: ${read('ENABLED') || 'true'},
            confirmation: ${read('CONFIRM') || 'true'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateRddResult && BinaryBotPrivateRddResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 40 ? 40 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateRddResult
            ? Number(BinaryBotPrivateRddResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0
            ? BinaryBotPrivatePrediction
            : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
