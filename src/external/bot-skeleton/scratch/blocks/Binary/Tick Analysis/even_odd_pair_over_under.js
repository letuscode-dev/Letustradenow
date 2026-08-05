/**
 * Odd-pair Over / Even-pair Under — last-2 digit scanner.
 * Hidden from Blocks Menu; free bots wrap it in a custom function.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
    DEFAULT_DIGIT_MIN,
    DEFAULT_DIGIT_MAX,
} from '../../../../services/tradeEngine/utils/even-odd-pair-over-under';

window.Blockly.Blocks.even_odd_pair_over_under = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'even/odd pair {{ side }} (threshold {{ th }}, recovering {{ rec }}, journal {{ journal }})',
                {
                    side: '%1',
                    th: '%2',
                    rec: '%3',
                    journal: '%4',
                }
            ),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'MARKET_SIDE',
                    options: [
                        [localize('Over'), 'OVER'],
                        [localize('Under'), 'UNDER'],
                    ],
                },
                { type: 'input_value', name: 'THRESHOLD', check: 'Number' },
                { type: 'input_value', name: 'RECOVERING', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Over: last 2 odd and last 3 ≥ threshold → Over 2 (recovery Over 3). Under: last 2 even and last 3 ≤ threshold → Under 7 (recovery Under 6).'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Even/Odd Pair Over Under'),
            description: localize(
                'Over: odd last-2 plus last-3 ≥ Digit_min. Under: even last-2 plus last-3 ≤ Digit_max, with recovery barriers.'
            ),
            key_words: localize('even, odd, pair, over, under, recovery'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.even_odd_pair_over_under = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const side = block.getFieldValue('MARKET_SIDE') || 'OVER';
    const default_th = side === 'UNDER' ? DEFAULT_DIGIT_MAX : DEFAULT_DIGIT_MIN;
    const threshold = read('THRESHOLD') || String(default_th);
    const recovering = read('RECOVERING') || 'false';
    const code = `(function () {
        var BinaryBotPrivatePairResult = Bot.evaluateEvenOddPairOverUnder({
            side: ${JSON.stringify(side)},
            threshold: ${threshold},
            recovering: ${recovering},
            journal_enabled: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivatePairResult && BinaryBotPrivatePairResult.journal_messages;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivatePairResult
            ? Number(BinaryBotPrivatePairResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
