/**
 * Over 5 / Under 4 hedge blocks.
 *  - digit_hedge_purchase (Before Purchase): buys Over 5 and Under 4 together.
 *  - digit_hedge_result (After Purchase): waits for both legs and returns the combined profit.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colours = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});

window.Blockly.Blocks.digit_hedge_purchase = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Purchase Over %1 + Under %2 hedge'),
            args0: [
                { type: 'input_value', name: 'OVER', check: 'Number' },
                { type: 'input_value', name: 'UNDER', check: 'Number' },
            ],
            previousStatement: null,
            ...colours(),
            tooltip: localize(
                'Buys the Over barrier and the Under barrier at the same time. Each barrier is a digit from 0 to 9. Defaults are Over 5 and Under 4. Each side uses the stake and duration from Trade options.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Purchase Over 5 + Under 4 hedge'),
            description: localize('Buys Over 5 and Under 4 together as one hedge.'),
            key_words: localize('hedge, over, under'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_purchase = block => {
    const over =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'OVER',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || '5';
    const under =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'UNDER',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || '4';
    return `Bot.purchaseDigitHedge(${over}, ${under});\n`;
};

window.Blockly.Blocks.digit_hedge_result = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Over/Under hedge profit'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize('Waits until Over 5 and Under 4 have both settled, then returns their combined profit.'),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Over/Under hedge profit'),
            description: localize('Combined profit of the Over 5 and Under 4 hedge.'),
            key_words: localize('hedge, profit'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_result = () => [
    'Bot.settleDigitHedge()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.digit_hedge_decision = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Over/Under hedge stake decision'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                '1 means one side won, so use the set stake. -1 means both sides lost, so multiply the stake. 0 means stop.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Over/Under hedge stake decision'),
            description: localize('Whether the next hedge stake resets, multiplies, or the bot stops.'),
            key_words: localize('hedge, stake'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_decision = () => [
    'Bot.digitHedgeDecision()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.digit_hedge_next_stake = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('next hedge stake from bought %1 set %2 × %3'),
            args0: [
                { type: 'input_value', name: 'CURRENT', check: 'Number' },
                { type: 'input_value', name: 'INITIAL', check: 'Number' },
                { type: 'input_value', name: 'MULTIPLIER', check: 'Number' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'After both sides lose, this is the bought stake times the multiplier, rounded to the cent. After one side wins, this is the set stake.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Next Over/Under hedge stake'),
            description: localize('Doubles the bought stake only when both sides lose, otherwise returns the set stake.'),
            key_words: localize('hedge, stake, martingale'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_next_stake = block => {
    const current =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'CURRENT',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || '0';
    const initial =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'INITIAL',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || '0';
    const multiplier =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'MULTIPLIER',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || '0';
    return [
        `Bot.digitHedgeNextStake(${current}, ${initial}, ${multiplier})`,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
    ];
};

window.Blockly.Blocks.digit_hedge_continues = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('hedge finished with a valid next stake'),
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
            ...colours(),
            tooltip: localize(
                'True when both sides finished and the next stake is the set stake, or the bought stake times the multiplier.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Hedge may trade again'),
            description: localize('False when a side is missing or the next stake was not doubled on a both-sides loss.'),
            key_words: localize('hedge, stake'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_continues = () => [
    'Bot.digitHedgeContinues()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.digit_hedge_book_profit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('hedge total %1 + profit %2, take profit %3, stop loss %4'),
            args0: [
                { type: 'input_value', name: 'TOTAL', check: 'Number' },
                { type: 'input_value', name: 'PROFIT', check: 'Number' },
                { type: 'input_value', name: 'TAKE_PROFIT', check: 'Number' },
                { type: 'input_value', name: 'STOP_LOSS', check: 'Number' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                'Adds the combined Over 5 and Under 4 profit to the running total. Take profit stops the bot when that total reaches the target.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Book Over/Under hedge profit'),
            description: localize('Updates total profit from both hedge legs and records take profit or stop loss.'),
            key_words: localize('hedge, profit, take profit'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_book_profit = block => {
    const value = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || '0';
    return [
        `Bot.digitHedgeBookProfit(${value('TOTAL')}, ${value('PROFIT')}, ${value('TAKE_PROFIT')}, ${value('STOP_LOSS')})`,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
    ];
};

window.Blockly.Blocks.digit_hedge_limit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('hedge take-profit or stop-loss result'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize('1 when take profit is reached, -1 when stop loss is reached, 0 otherwise.'),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Hedge limit result'),
            description: localize('Whether the combined hedge profit has reached take profit or stop loss.'),
            key_words: localize('hedge, take profit, stop loss'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_limit = () => [
    'Bot.digitHedgeLimit()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.digit_hedge_signal = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('digits from Under %1 through Over %2 dominate the last %3 ticks'),
            args0: [
                { type: 'input_value', name: 'UNDER', check: 'Number' },
                { type: 'input_value', name: 'OVER', check: 'Number' },
                { type: 'input_value', name: 'WINDOW', check: 'Number' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                '1 when the digits that lose both sides appear more often than the other digits. Over 5 and Under 4 lose on 4 and 5. 0 otherwise.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Over/Under hedge signal'),
            description: localize('Fast check of the latest ticks already in memory.'),
            key_words: localize('hedge, digit, fast'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_signal = block => {
    const order = window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE;
    const value = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(block, name, order);
    const window_size = value('WINDOW') || '5';
    const over = value('OVER') || '5';
    const under = value('UNDER') || '4';
    return [
        `Bot.digitHedgeSignal(${window_size}, ${over}, ${under})`,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
    ];
};

window.Blockly.Blocks.digit_hedge_dead_count = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('4 or 5 count from the last hedge check'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize('How many of the checked ticks were 4 or 5.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('4 or 5 count'),
            description: localize('Count from the last fast hedge check.'),
            key_words: localize('hedge, digit'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_dead_count = () => [
    'Bot.digitHedgeDeadCount()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.digit_hedge_skip_analysis = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('loss hedge is waiting'),
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
            ...colours(),
            tooltip: localize('True when both sides lost and the immediate-loss option is on.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Skip hedge analysis'),
            description: localize('Buy Over 5 and Under 4 again without checking digits.'),
            key_words: localize('hedge, loss, immediate'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_skip_analysis = () => [
    'Bot.digitHedgeSkipAnalysis()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.digit_hedge_arm_recovery = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('arm immediate loss hedge if option %1 is on'),
            args0: [{ type: 'input_value', name: 'ENABLED', check: 'Number' }],
            previousStatement: null,
            nextStatement: null,
            ...colours(),
            tooltip: localize(
                'After both sides lose, and when the option is greater than 0, the next Over 5 and Under 4 hedge is sent without a digit check.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Arm immediate loss hedge'),
            description: localize('Option on: a both-sides loss buys again immediately. Option 0: wait for the digit check.'),
            key_words: localize('hedge, loss, immediate'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_arm_recovery = block => {
    const enabled =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'ENABLED',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
        ) || '0';
    return `Bot.digitHedgeArmRecovery(${enabled});\n`;
};
