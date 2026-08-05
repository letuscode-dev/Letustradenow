/**
 * Hybrid multi-scan — returns barrier/prediction; companion returns contract code.
 * Hidden from Blocks Menu; free bot wraps it in a custom function.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
    DEFAULT_EVEN_MIN,
    DEFAULT_ODD_MAX,
} from '../../../../services/tradeEngine/utils/even-odd-pair-over-under';
import {
    DEFAULT_HOT_LOOKBACK,
    DEFAULT_PATTERN_LOOKBACK,
} from '../../../../services/tradeEngine/utils/hybrid-multi-scan';

const read = (block, name) =>
    window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        name,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );

window.Blockly.Blocks.hybrid_multi_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'hybrid multi-scan (odd_max {{ odd }}, even_min {{ even }}, pattern {{ plb }}, hot {{ hlb }}, recovering {{ rec }})',
                {
                    odd: '%1',
                    even: '%2',
                    plb: '%3',
                    hlb: '%4',
                    rec: '%5',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ODD_MAX', check: 'Number' },
                { type: 'input_value', name: 'EVEN_MIN', check: 'Number' },
                { type: 'input_value', name: 'PATTERN_LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'HOT_LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'RECOVERING', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Runs Odd Pair Over, Even Pair Under, Pattern Probability, Sequential Differs, and Hot Digit. Returns barrier/prediction or -1. Contract type via Hybrid Contract Code.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Hybrid multi-scan'),
            description: localize(
                'Combines all free-bot scan families and picks the first matching tip (pair → pattern → sequential → hot).'
            ),
            key_words: localize('hybrid, multi-scan, pair, pattern, sequential, hot, over, under, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.hybrid_multi_scan = block => {
    const odd_max = read(block, 'ODD_MAX') || String(DEFAULT_ODD_MAX);
    const even_min = read(block, 'EVEN_MIN') || String(DEFAULT_EVEN_MIN);
    const pattern_lookback = read(block, 'PATTERN_LOOKBACK') || String(DEFAULT_PATTERN_LOOKBACK);
    const hot_lookback = read(block, 'HOT_LOOKBACK') || String(DEFAULT_HOT_LOOKBACK);
    const recovering = read(block, 'RECOVERING') || 'false';

    const code = `(function () {
        var BinaryBotPrivateHybrid = Bot.evaluateHybridMultiScan({
            odd_max: ${odd_max},
            even_min: ${even_min},
            pattern_lookback: ${pattern_lookback},
            hot_lookback: ${hot_lookback},
            recovering: ${recovering},
            journal_enabled: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateHybrid && BinaryBotPrivateHybrid.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateHybrid
            ? Number(BinaryBotPrivateHybrid.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.hybrid_multi_scan_contract_code = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('hybrid contract code'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Contract code from the last hybrid scan: 0=none, 1=DIGITOVER, 2=DIGITUNDER, 3=DIGITDIFF.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Hybrid contract code'),
            description: localize('Reads the contract type code from the latest hybrid multi-scan result.'),
            key_words: localize('hybrid, contract, over, under, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.hybrid_multi_scan_contract_code = () => {
    const code = `(function () {
        var BinaryBotPrivateCode = Bot.getHybridMultiScanContractCode();
        var n = Number(BinaryBotPrivateCode);
        return !isNaN(n) ? n : 0;
    })()`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
