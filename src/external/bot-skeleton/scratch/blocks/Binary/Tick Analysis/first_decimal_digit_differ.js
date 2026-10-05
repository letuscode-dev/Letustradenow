/**
 * Double Decimal Digit Differ + 10.5 Recovery blocks.
 *  - first_decimal_digit_barrier: repeated last-two-decimals digit of the latest tick (4681.33 → 3).
 *  - first_decimal_digit_differ_analyze (Before Purchase): analyses each new tick, journals it and
 *    returns the barrier (0–9) when entry, risk and recovery checks pass, otherwise -1.
 *  - first_decimal_digit_differ_purchase (Before Purchase): buys DIGITDIFF with that barrier and the recovery stake.
 *  - first_decimal_digit_differ_result (After Purchase): applies recovery; 1 = trade again, 0 = stop.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colours = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});

const ANALYZE_INPUTS = [
    ['BASE_STAKE', 'base_stake', '2', 'Number'],
    ['AUTO_TRADING', 'auto_trading', 'true', 'Boolean'],
    ['CONFIRMATION_TICKS', 'confirmation_ticks', '1', 'Number'],
    ['RECOVERY_ENABLED', 'recovery_enabled', 'true', 'Boolean'],
    ['RECOVERY_MULTIPLIER', 'recovery_multiplier', '10.5', 'Number'],
    ['MAX_RECOVERY_LEVEL', 'max_recovery_level', '2', 'Number'],
    ['MAX_RECOVERY_STAKE', 'max_recovery_stake', '250', 'Number'],
    ['MAX_CONSECUTIVE_LOSSES', 'max_consecutive_losses', '3', 'Number'],
    ['STOP_LOSS', 'stop_loss', '250', 'Number'],
    ['TAKE_PROFIT', 'take_profit', '20', 'Number'],
    ['MAX_TRADES', 'max_trades', '100', 'Number'],
    ['COOLDOWN', 'cooldown_seconds', '2', 'Number'],
    ['STALE_SECONDS', 'stale_seconds', '5', 'Number'],
    ['STATUS_EVERY', 'status_every', '10', 'Number'],
];

const LABELS = [
    'base stake',
    'auto trading',
    'confirmation ticks',
    'recovery enabled',
    'recovery multiplier',
    'maximum recovery level',
    'maximum recovery stake',
    'maximum consecutive losses',
    'stop loss',
    'take profit',
    'maximum trades',
    'cooldown seconds',
    'no-tick warning seconds',
    'status every N ticks',
];

window.Blockly.Blocks.first_decimal_digit_barrier = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Repeated last-two-decimals digit (barrier)'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize('When the last two decimals of the latest tick are the same (4681.33) this is that digit (3); otherwise the last decimal.'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Repeated decimal digit barrier'),
            description: localize('Automatic Differs barrier from the latest tick price.'),
            key_words: localize('digit, decimal, barrier, differs'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.first_decimal_digit_barrier = () => [
    'Bot.getFirstDecimalDigitBarrier()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.first_decimal_digit_differ_analyze = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: `${localize('Double decimal digit Differ + recovery signal:')} ${LABELS.map(
                (label, i) => `${label} %${i + 1}`
            ).join(' ')}`,
            args0: ANALYZE_INPUTS.map(([name, , , check]) => ({ type: 'input_value', name, check })),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Analyses every new tick: trades only when the last two decimals are the same (4681.33 → DIFFER 3). Returns the barrier (0–9) when entry conditions, risk limits and recovery status pass, otherwise -1. Writes every decision to the Journal.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Double decimal digit Differ signal'),
            description: localize('Tick-by-tick analysis for Double Decimal Digit Differ + 10.5 Recovery.'),
            key_words: localize('digit, decimal, differs, recovery, signal'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.first_decimal_digit_differ_analyze = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const fields = ANALYZE_INPUTS.map(
        ([name, key, fallback]) => `${key}: ${generator.valueToCode(block, name, generator.ORDER_ATOMIC) || fallback}`
    ).join(',\n            ');
    return [`Bot.analyzeFirstDecimalDigit({\n            ${fields}\n        })`, generator.ORDER_ATOMIC];
};

window.Blockly.Blocks.first_decimal_digit_differ_purchase = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Purchase Differs with the repeated decimal digit barrier'),
            previousStatement: null,
            ...colours(),
            tooltip: localize(
                'Buys DIGITDIFF with the barrier approved on this tick (never entered manually) and the current recovery stake.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Purchase double decimal digit Differs'),
            description: localize('Buys Differs with the automatic barrier and recovery stake.'),
            key_words: localize('purchase, differs, digit, recovery'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.first_decimal_digit_differ_purchase = () =>
    'Bot.purchaseFirstDecimalDigitDiffer();\n';

window.Blockly.Blocks.first_decimal_digit_differ_result = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Double decimal digit Differ result (1 = trade again)'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Journals the contract result and applies the recovery multiplier (or resets to the base stake on a win). Returns 1 to trade again or 0 when a limit stops the bot.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Double decimal digit Differ result'),
            description: localize('Result and recovery handling for Double Decimal Digit Differ + 10.5 Recovery.'),
            key_words: localize('result, differs, recovery'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.first_decimal_digit_differ_result = () => [
    'Bot.firstDecimalDigitResult()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];
