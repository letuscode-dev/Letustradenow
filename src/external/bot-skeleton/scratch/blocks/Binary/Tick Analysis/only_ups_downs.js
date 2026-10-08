/**
 * Only Ups / Only Downs from the latest four last digits.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colours = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});

window.Blockly.Blocks.only_ups_downs_signal = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Only Ups / Only Downs from the last 4 digits | stake %1 level %2'),
            args0: [
                { type: 'input_value', name: 'STAKE' },
                { type: 'input_value', name: 'LEVEL' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...colours(),
            tooltip: localize(
                '1 when the latest four digits are all below 5 (Only Ups). -1 when they are all above 4 (Only Downs). 0 when they are mixed, fewer than four, or this same tick already traded.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Only Ups / Only Downs signal'),
            description: localize('Last four digits choose Only Ups, Only Downs, or no trade.'),
            key_words: localize('only ups, only downs, digits'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.only_ups_downs_signal = block => {
    const order = window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC;
    const value = name => window.Blockly.JavaScript.javascriptGenerator.valueToCode(block, name, order);
    const stake = value('STAKE') || '1';
    const level = value('LEVEL') || '0';
    return [
        `Bot.analyzeOnlyUpsDowns(${stake}, ${level})`,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
    ];
};

window.Blockly.Blocks.only_ups_downs_result = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('journal Only Ups / Only Downs result | win %1 previous %2 next %3'),
            args0: [
                { type: 'input_value', name: 'WON' },
                { type: 'input_value', name: 'PREVIOUS' },
                { type: 'input_value', name: 'NEXT' },
            ],
            previousStatement: null,
            nextStatement: null,
            ...colours(),
            tooltip: localize('Writes the win or loss, the stake just used, and the next stake. The multiplier is 1.5.'),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Only Ups / Only Downs result'),
            description: localize('Journal the trade result and the 1.5 martingale stake.'),
            key_words: localize('only ups, result, martingale'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.only_ups_downs_result = block => {
    const order = window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC;
    const value = name => window.Blockly.JavaScript.javascriptGenerator.valueToCode(block, name, order);
    const won = value('WON') || '0';
    const previous = value('PREVIOUS') || '0';
    const next = value('NEXT') || '0';
    return `Bot.journalOnlyUpsDownsResult(${won}, ${previous}, ${next});\n`;
};
