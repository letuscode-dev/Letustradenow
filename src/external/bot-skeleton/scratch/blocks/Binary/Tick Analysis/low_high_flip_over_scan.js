/**
 * Low-High Flip OVER — returns the Over barrier on a signal, or -1.
 * Signals when previous_2 < prev2 below, previous_1 < prev1 below and current > current above.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.low_high_flip_over_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'low-high flip over previous_2 below %1 previous_1 below %2 current above %3 barrier %4 cooldown %5 journal %6 scan markets %7 market group %8 custom symbols %9'
            ),
            args0: [
                { type: 'input_value', name: 'PREV2_BELOW', check: 'Number' },
                { type: 'input_value', name: 'PREV1_BELOW', check: 'Number' },
                { type: 'input_value', name: 'CURRENT_ABOVE', check: 'Number' },
                { type: 'input_value', name: 'BARRIER', check: 'Number' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
                { type: 'input_value', name: 'SCAN_MARKETS', check: 'Boolean' },
                { type: 'input_value', name: 'MARKET_GROUP' },
                { type: 'input_value', name: 'SYMBOLS' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Returns the Over barrier when previous_2 < "previous_2 below", previous_1 < "previous_1 below" and the current digit > "current above", otherwise -1. With scan markets on, checks every market in the group (1S / STANDARD / ALL) or the custom symbol list and switches to the market that fires. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Low-High Flip OVER scan'),
            description: localize(
                'Signals Digit Over when previous_2 < 4, previous_1 < 5 and the current digit > 5.'
            ),
            key_words: localize('digit, over, low, high, pattern'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.low_high_flip_over_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateLhfResult = Bot.evaluateLowHighFlipOver({
            prev2_below: ${read('PREV2_BELOW') || '4'},
            prev1_below: ${read('PREV1_BELOW') || '5'},
            current_above: ${read('CURRENT_ABOVE') || '5'},
            barrier: ${read('BARRIER') || '1'},
            signal_cooldown_tips: ${read('COOLDOWN') || '1'},
            journal_enabled: ${read('JOURNAL') || 'true'},
            scan_markets: ${read('SCAN_MARKETS') || 'false'},
            market_group: String(${read('MARKET_GROUP') || '"1S"'}),
            symbols: String(${read('SYMBOLS') || '""'})
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateLhfResult && BinaryBotPrivateLhfResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateLhfResult
            ? Number(BinaryBotPrivateLhfResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0
            ? BinaryBotPrivatePrediction
            : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
