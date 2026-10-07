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
            message0: localize('Purchase Over 5 + Under 4 hedge'),
            previousStatement: null,
            ...colours(),
            tooltip: localize(
                'Buys Over 5 and Under 4 at the same time. Each side uses the stake and duration from Trade options.'
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

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_hedge_purchase = () => 'Bot.purchaseDigitHedge();\n';

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
