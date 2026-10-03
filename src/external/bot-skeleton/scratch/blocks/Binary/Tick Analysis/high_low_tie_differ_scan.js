/**
 * High-Low Tie Differs — returns Differ digit (0–9) or -1.
 * Picks one digit from the HIGH or LOW occurrence tie with deterministic tie-breakers.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.high_low_tie_differ_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'high-low tie differs window %1 recent %2 micro %3 tolerance % %4 mode %5 cooldown %6 journal %7'
            ),
            args0: [
                { type: 'input_value', name: 'ANALYSIS_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'RECENT_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MICRO_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'TIE_TOLERANCE', check: 'Number' },
                { type: 'input_value', name: 'MODE' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Finds digits tied at the highest or lowest occurrence % and picks one by recent, micro, repetition and recency tie-breakers. Confirms on the next tick before trading. Journal shows WHY NO TRADE.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('High-Low Tie Differs scan'),
            description: localize(
                'Places Digit Differs on the digit selected from a HIGH or LOW occurrence tie (default 200-tick window, mode HIGH / LOW / AUTO).'
            ),
            key_words: localize('tie, high, low, percentage, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.high_low_tie_differ_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateHltResult = Bot.evaluateHighLowTieDiffer({
            analysis_window: ${read('ANALYSIS_WINDOW') || '200'},
            recent_window: ${read('RECENT_WINDOW') || '20'},
            micro_window: ${read('MICRO_WINDOW') || '10'},
            tie_tolerance: ${read('TIE_TOLERANCE') || '0'},
            mode: String(${read('MODE') || '"AUTO"'}),
            signal_cooldown_tips: ${read('COOLDOWN') || '1'},
            journal_enabled: ${read('JOURNAL') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateHltResult && BinaryBotPrivateHltResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 30 ? 30 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateHltResult
            ? Number(BinaryBotPrivateHltResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) && BinaryBotPrivatePrediction >= 0
            ? BinaryBotPrivatePrediction
            : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
