import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.cold_digit_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'cold digit Differs (on {{ enabled }}, ticks {{ ticks }}, runs {{ runs }}, journal {{ journal }})',
                {
                    enabled: '%1',
                    ticks: '%2',
                    runs: '%3',
                    journal: '%4',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'TICK_SAMPLE', check: 'Number' },
                { type: 'input_value', name: 'RUNS_PER_SIGNAL', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Analysis-style cold digit: counts last N ticks, Differs the least frequent digit. Confidence stays 62–72%. Reuses the digit for the configured runs per signal.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Cold digit prediction'),
            description: localize(
                'Finds the least frequent last digit in your tick sample (same idea as the Analysis tool) and returns it for Digit Differs. Returns -1 while collecting ticks.'
            ),
            key_words: localize('cold, digit, differs, analysis, frequency, confidence'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.cold_digit_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const enabled = read('ENABLED') || 'true';
    const ticks = read('TICK_SAMPLE') || '100';
    const runs = read('RUNS_PER_SIGNAL') || '1';
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateColdResult = Bot.evaluateColdDigit({
            enabled: ${enabled},
            tick_sample_size: ${ticks},
            runs_per_signal: ${runs},
            journal_enabled: ${journal}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateColdResult && BinaryBotPrivateColdResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 2 ? 2 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateColdResult
            ? Number(BinaryBotPrivateColdResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.cold_digit_consume = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Consume cold digit run'),
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            previousStatement: null,
            nextStatement: null,
            tooltip: localize('After a settled trade, use one run from the active cold-digit signal.'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Consume cold digit run'),
            description: localize('Decrements remaining runs for the sticky cold-digit Differs signal.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.cold_digit_consume = () =>
    'Bot.consumeColdDigitSignal();\n';
