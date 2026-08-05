/**
 * Parity-run Differs — last N all-even or all-odd → Differ the oldest of those N.
 * Multi-market scan (1S / STANDARD / ALL). Hidden from Blocks Menu.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
    MARKET_GROUP_ALL,
    DEFAULT_RUN_LENGTH,
} from '../../../../services/tradeEngine/utils/parity-run-differs';

window.Blockly.Blocks.parity_run_differs_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'parity-run Differs (group {{ group }}, length {{ len }}, journal {{ journal }})',
                {
                    group: '%1',
                    len: '%2',
                    journal: '%3',
                }
            ),
            args0: [
                { type: 'input_value', name: 'MARKET_GROUP', check: 'String' },
                { type: 'input_value', name: 'RUN_LENGTH', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans 1S / STANDARD / ALL volatilities. If the last N digits are all even or all odd, Differs the oldest of those N (the Nth back). Default N=6, group ALL.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Parity-run Differs scan'),
            description: localize(
                'Multi-market Differs when the last run of digits shares parity (even or odd). Trades Differ on the oldest digit of that run.'
            ),
            key_words: localize('parity, even, odd, run, differs, multi-market, volatility'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.parity_run_differs_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const market_group = read('MARKET_GROUP') || JSON.stringify(MARKET_GROUP_ALL);
    const run_length = read('RUN_LENGTH') || String(DEFAULT_RUN_LENGTH);
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateParityResult = Bot.evaluateParityRunDiffersScan({
            market_group: ${market_group},
            run_length: ${run_length},
            journal_enabled: ${journal},
            switch_symbol: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateParityResult && BinaryBotPrivateParityResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateParityResult
            ? Number(BinaryBotPrivateParityResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
