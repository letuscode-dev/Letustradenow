/**
 * Pattern Switch — returns Trade Direction (0/1/4/5) or -1 while watching.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.pattern_switch_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize('pattern switch direction (journal {{ journal }})', {
                journal: '%1',
            }),
            args0: [{ type: 'input_value', name: 'JOURNAL', check: 'Boolean' }],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Returns 0 (Even), 1 (Odd), 4 (Over 4), or 5 (Under 5) when a last-digit pattern matches; otherwise -1.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Pattern Switch scan'),
            description: localize(
                'Last 4 odd → Even; last 4 even → Odd; last 3 ≤ 3 → Over 4; last 3 ≥ 6 → Under 5.'
            ),
            key_words: localize('pattern, even, odd, over, under, digits'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.pattern_switch_scan = block => {
    const journal =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'JOURNAL',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'true';

    const code = `(function () {
        var BinaryBotPrivatePsResult = Bot.evaluatePatternSwitch({
            journal_enabled: ${journal}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivatePsResult && BinaryBotPrivatePsResult.journal_messages;
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
        var BinaryBotPrivateDirection = BinaryBotPrivatePsResult
            ? Number(BinaryBotPrivatePsResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivateDirection) ? BinaryBotPrivateDirection : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
