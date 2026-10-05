/**
 * Rise/Fall Hedge blocks.
 *  - rise_fall_hedge_ready (Before Purchase): 1 = fire a hedge now, 0 = wait. Hard risk limits stop the bot.
 *  - rise_fall_hedge_entry_engine (Before Purchase): entry filter settings; decides WHEN the hedge may fire.
 *  - rise_fall_hedge_purchase (Before Purchase): buys Rise and Fall together with the same stake and duration.
 *  - rise_fall_hedge_result (After Purchase): waits for both legs, journals the combined result,
 *    returns 1 to trade again or 0 to stop.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colours = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});

const READY_INPUTS = [
    ['MODE', 'mode', '"MANUAL"', null],
    ['EVERY_N_TICKS', 'every_n_ticks', '10', 'Number'],
    ['COOLDOWN', 'cooldown_seconds', '5', 'Number'],
    ['MAX_DAILY_HEDGES', 'max_daily_hedges', '50', 'Number'],
    ['MAX_STAKE_PER_HEDGE', 'max_stake_per_hedge', '10', 'Number'],
    ['MAX_DAILY_LOSS', 'max_daily_loss', '25', 'Number'],
    ['DAILY_LOSS_LIMIT', 'daily_loss_limit', '20', 'Number'],
    ['DAILY_PROFIT_TARGET', 'daily_profit_target', '20', 'Number'],
    ['MAX_CONSECUTIVE_LOSSES', 'max_consecutive_losses', '5', 'Number'],
    ['MAX_TRADES', 'max_trades', '100', 'Number'],
    ['ASYMMETRIC_MS', 'asymmetric_threshold_ms', '500', 'Number'],
    ['INCOMPLETE_POLICY', 'incomplete_policy', '"CANCEL"', null],
];

window.Blockly.Blocks.rise_fall_hedge_ready = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'rise/fall hedge ready? mode %1 every N ticks %2 cooldown s %3 max daily hedges %4 max stake per hedge %5 max daily loss %6 daily loss limit %7 daily profit target %8 max consecutive losing hedges %9 max trades %10 asymmetric ms %11 incomplete policy %12'
            ),
            args0: READY_INPUTS.map(([name, , , check]) => ({
                type: 'input_value',
                name,
                ...(check ? { check } : {}),
            })),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Returns 1 when a Rise/Fall hedge should be fired now (MANUAL: once per run, AUTO: every N ticks), 0 to wait. Stops the bot when a risk limit is reached.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Rise/Fall hedge ready'),
            description: localize('Trigger and risk checks for the Rise/Fall Hedge.'),
            key_words: localize('hedge, rise, fall, step index'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.rise_fall_hedge_ready = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const fields = READY_INPUTS.map(
        ([name, key, fallback]) => `${key}: ${generator.valueToCode(block, name, generator.ORDER_ATOMIC) || fallback}`
    ).join(',\n            ');
    return [`Bot.readyRiseFallHedge({\n            ${fields}\n        })`, generator.ORDER_ATOMIC];
};

const ENTRY_INPUTS = [
    ['ENABLED', 'enabled', 'true', 'Boolean'],
    ['MODE', 'mode', '"MULTI-CONFIRMATION"', null],
    ['MIN_SCORE', 'min_score', '5', 'Number'],
    ['MIN_BIAS', 'min_bias', '60', 'Number'],
    ['LOOKBACK', 'lookback', '50', 'Number'],
    ['SHORT_WINDOW', 'short_window', '10', 'Number'],
    ['MEDIUM_WINDOW', 'medium_window', '20', 'Number'],
    ['LONG_WINDOW', 'long_window', '50', 'Number'],
    ['ACCELERATION', 'acceleration_threshold', '15', 'Number'],
    ['STRENGTH_RATIO', 'strength_ratio', '1.2', 'Number'],
    ['PATTERN_LENGTH', 'pattern_length', '4', 'Number'],
    ['PATTERN_HISTORY', 'pattern_history', '1000', 'Number'],
    ['MIN_PATTERN_SAMPLES', 'min_pattern_samples', '10', 'Number'],
    ['PATTERN_THRESHOLD', 'pattern_threshold', '58', 'Number'],
    ['EXHAUSTION_RUN', 'exhaustion_run', '4', 'Number'],
    ['MIN_PAYOUT', 'min_payout', '0', 'Number'],
    ['MAX_SIMULTANEOUS', 'max_simultaneous', '1', 'Number'],
    ['LOG_NO_TRADE', 'log_no_trade', 'true', 'Boolean'],
];

window.Blockly.Blocks.rise_fall_hedge_entry_engine = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(false);
    },
    definition() {
        return {
            message0: localize(
                'Rise/Fall hedge entry engine: enabled %1 entry mode %2 minimum entry score %3 minimum directional bias percent %4 lookback ticks %5 short window %6 medium window %7 long window %8 acceleration threshold pts %9 strength ratio %10 pattern length %11 pattern history ticks %12 minimum pattern samples %13 pattern continuation percent %14 exhaustion run %15 minimum payout %16 max simultaneous hedges %17 log no-trade entries %18'
            ),
            args0: ENTRY_INPUTS.map(([name, , , check]) => ({
                type: 'input_value',
                name,
                ...(check ? { check } : {}),
            })),
            previousStatement: null,
            nextStatement: null,
            ...colours(),
            tooltip: localize(
                'Decides WHEN the hedge may fire from an entry score (0–13). Never picks a side: an approved entry buys Rise and Fall together. Modes: MOMENTUM, ACCELERATION, PATTERN, REVERSAL, MULTI-CONFIRMATION, ADAPTIVE (or A–F).'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Rise/Fall hedge entry engine'),
            description: localize('Entry filter for the Rise/Fall Hedge: momentum, acceleration, patterns, strength, reversal and multi-window confirmation.'),
            key_words: localize('hedge, entry, score, momentum, pattern'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.rise_fall_hedge_entry_engine = block => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const fields = ENTRY_INPUTS.map(
        ([name, key, fallback]) => `${key}: ${generator.valueToCode(block, name, generator.ORDER_ATOMIC) || fallback}`
    ).join(',\n        ');
    return `Bot.configureRiseFallHedgeEntry({\n        ${fields}\n    });\n`;
};

window.Blockly.Blocks.rise_fall_hedge_purchase = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Purchase Rise + Fall hedge'),
            previousStatement: null,
            ...colours(),
            tooltip: localize(
                'Buys a Rise and a Fall contract at the same time with the stake and duration from Trade options. Neither order waits for the other.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Purchase Rise + Fall hedge'),
            description: localize('Buys Rise and Fall together as one hedge position.'),
            key_words: localize('hedge, buy, rise, fall'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.rise_fall_hedge_purchase = () => 'Bot.purchaseRiseFallHedge();\n';

window.Blockly.Blocks.rise_fall_hedge_result = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Rise/Fall hedge result (1 = trade again)'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Waits until both legs have settled, journals the combined P/L from the actual Deriv payouts and statistics, and returns 1 to trade again or 0 to stop.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Rise/Fall hedge result'),
            description: localize('Combined result of the Rise/Fall hedge.'),
            key_words: localize('hedge, result'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.rise_fall_hedge_result = () => [
    'Bot.settleRiseFallHedge()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];
