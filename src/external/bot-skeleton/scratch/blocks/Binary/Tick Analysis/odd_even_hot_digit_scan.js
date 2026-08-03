/**
 * Odd/Even Hot-Digit scan — multi-market digit-% scanner for Even/Odd trades.
 * Hidden from Blocks Menu; free bot wraps it in a custom function.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
    DEFAULT_LOOKBACK,
    DEFAULT_MARTINGALE_MULTIPLIER,
    DEFAULT_MAX_TRADES,
    DEFAULT_MIN_DIGIT_PCT,
    DEFAULT_MIN_HOT_DIGITS,
    DEFAULT_OPPOSITE_STREAK,
} from '../../../../services/tradeEngine/utils/odd-even-hot-digit';
import { DEFAULT_MARKET_GROUP } from '../../../../services/tradeEngine/utils/sequential-digit-differs';

window.Blockly.Blocks.odd_even_hot_digit_scan = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'odd/even hot scan (group {{ group }}, lookback {{ lb }}, min% {{ pct }}, journal {{ journal }})',
                {
                    group: '%1',
                    lb: '%2',
                    pct: '%3',
                    journal: '%4',
                }
            ),
            args0: [
                { type: 'input_value', name: 'MARKET_GROUP', check: 'String' },
                { type: 'input_value', name: 'LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'MIN_DIGIT_PCT', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scans markets for ≥3 odd or even digits at ≥min%. Waits for an opposite streak, takes up to 5 favored Even/Odd trades, then one ×2 recovery if the last lost. Returns -1 wait, 0 Even, 1 Odd.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Odd/Even Hot-Digit scan'),
            description: localize(
                'Multi-market Odd/Even bot driver. Configure Market_group, Lookback, and Min_digit_pct in Run once at start.'
            ),
            key_words: localize('odd, even, hot digit, percentage, scan, martingale'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.odd_even_hot_digit_scan = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const market_group = read('MARKET_GROUP') || JSON.stringify(DEFAULT_MARKET_GROUP);
    const lookback = read('LOOKBACK') || String(DEFAULT_LOOKBACK);
    const min_digit_pct = read('MIN_DIGIT_PCT') || String(DEFAULT_MIN_DIGIT_PCT);
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateOeResult = Bot.evaluateOddEvenHotDigitScan({
            market_group: ${market_group},
            lookback: ${lookback},
            min_digit_pct: ${min_digit_pct},
            min_hot_digits: ${DEFAULT_MIN_HOT_DIGITS},
            opposite_streak: ${DEFAULT_OPPOSITE_STREAK},
            max_trades: ${DEFAULT_MAX_TRADES},
            martingale_multiplier: ${DEFAULT_MARTINGALE_MULTIPLIER},
            journal_enabled: ${journal},
            switch_symbol: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateOeResult && BinaryBotPrivateOeResult.journal_messages;
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
        var BinaryBotPrivateSide = BinaryBotPrivateOeResult
            ? Number(BinaryBotPrivateOeResult.side_code)
            : NaN;
        return !isNaN(BinaryBotPrivateSide) ? BinaryBotPrivateSide : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.odd_even_hot_digit_stake_mult = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('odd/even hot stake multiplier'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Stake multiplier for the current Odd/Even Hot cycle (1 normally, 2 on recovery).'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Odd/Even Hot stake multiplier'),
            description: localize('Returns 1 for normal trades and the martingale multiplier during recovery.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.odd_even_hot_digit_stake_mult = () => [
    '(Bot.getOddEvenHotDigitStakeMultiplier ? Bot.getOddEvenHotDigitStakeMultiplier() : 1)',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];
