/**
 * Last-Tick Price Digit Differ blocks.
 *  - last_tick_digit_barrier: digit immediately before the decimal point of the latest tick.
 *  - last_tick_digit_differ_analyze (Before Purchase): analyses each new tick, journals it and
 *    returns the barrier (0–9) when the entry conditions pass, otherwise -1.
 *  - last_tick_digit_differ_purchase (Before Purchase): buys DIGITDIFF with that automatic barrier.
 *  - last_tick_digit_differ_result (After Purchase): journals the result; 1 = trade again, 0 = stop.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colours = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});

const ANALYZE_INPUTS = [
    ['AUTO_TRADING', 'auto_trading', 'true', 'Boolean'],
    ['CONFIRMATION_TICKS', 'confirmation_ticks', '2', 'Number'],
    ['COOLDOWN', 'cooldown_seconds', '2', 'Number'],
    ['MAX_TRADES', 'max_trades', '50', 'Number'],
    ['MAX_CONSECUTIVE_LOSSES', 'max_consecutive_losses', '3', 'Number'],
    ['STOP_LOSS', 'stop_loss', '20', 'Number'],
    ['TAKE_PROFIT', 'take_profit', '10', 'Number'],
    ['STALE_SECONDS', 'stale_seconds', '5', 'Number'],
    ['STATUS_EVERY', 'status_every', '10', 'Number'],
];

window.Blockly.Blocks.last_tick_digit_barrier = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Last-tick digit before decimal (barrier)'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize('The digit immediately to the left of the decimal point of the latest tick (4681.35 → 1).'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Last-tick digit before decimal'),
            description: localize('Automatic Differs barrier from the latest tick price.'),
            key_words: localize('digit, decimal, barrier, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_tick_digit_barrier = () => [
    'Bot.getLastTickDigitBarrier()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.last_tick_digit_differ_analyze = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'Last-tick digit Differ signal: auto trading %1 confirmation ticks %2 cooldown seconds %3 maximum trades %4 maximum consecutive losses %5 stop loss %6 take profit %7 no-tick warning seconds %8 status every N ticks %9'
            ),
            args0: ANALYZE_INPUTS.map(([name, , , check]) => ({ type: 'input_value', name, check })),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Analyses every new tick: barrier = digit before the decimal point. Returns the barrier (0–9) when all entry conditions pass, otherwise -1. Writes every decision to the Journal.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Last-tick digit Differ signal'),
            description: localize('Tick-by-tick analysis for the Last-Tick Price Digit Differ.'),
            key_words: localize('digit, decimal, differs, signal'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_tick_digit_differ_analyze = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const fields = ANALYZE_INPUTS.map(
        ([name, key, fallback]) => `${key}: ${generator.valueToCode(block, name, generator.ORDER_ATOMIC) || fallback}`
    ).join(',\n            ');
    return [`Bot.analyzeLastTickDigit({\n            ${fields}\n        })`, generator.ORDER_ATOMIC];
};

window.Blockly.Blocks.last_tick_digit_differ_purchase = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Purchase Differs with the last-tick digit barrier'),
            previousStatement: null,
            ...colours(),
            tooltip: localize('Buys DIGITDIFF with the barrier approved on this tick (never entered manually).'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Purchase last-tick digit Differs'),
            description: localize('Buys Differs with the automatic barrier.'),
            key_words: localize('purchase, differs, digit'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_tick_digit_differ_purchase = () =>
    'Bot.purchaseLastTickDigitDiffer();\n';

window.Blockly.Blocks.last_tick_digit_differ_result = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Last-tick digit Differ result (1 = trade again)'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Journals the contract result, profit, balance and win/loss streaks. Returns 1 to trade again or 0 when a limit stops the bot.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Last-tick digit Differ result'),
            description: localize('Result handling for the Last-Tick Price Digit Differ.'),
            key_words: localize('result, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_tick_digit_differ_result = () => [
    'Bot.lastTickDigitResult()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];
