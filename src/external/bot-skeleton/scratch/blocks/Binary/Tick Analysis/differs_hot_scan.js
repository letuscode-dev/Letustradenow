/**
 * Hot-digit Differs scan. Not listed as a separate strategy block.
 * Counts the last N digits and returns 1 when the most frequent digit
 * is missing from the newest gap ticks.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colour = () => ({
    colour: window.Blockly.Colours.Base.colour,
    colourSecondary: window.Blockly.Colours.Base.colourSecondary,
    colourTertiary: window.Blockly.Colours.Base.colourTertiary,
    category: window.Blockly.Categories.Tick_Analysis,
});

window.Blockly.Blocks.differs_hot_scan = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Differs scan of last {{ n }} ticks, absent {{ gap }}', { n: '%1', gap: '%2' }),
            args0: [
                { type: 'input_value', name: 'N', check: 'Number' },
                { type: 'input_value', name: 'GAP', check: 'Number' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize(
                'Requests the last N ticks when they are not already loaded, then updates the digit counts as new ticks arrive. Returns 1 when the most frequent digit is missing from the newest gap ticks.'
            ),
            ...colour(),
        };
    },
    meta() {
        return {
            display_name: localize('Hot digit Differs scan'),
            description: localize(
                'Finds the most frequent digit in the last N ticks and signals when that digit has not appeared in the newest ticks.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.Blocks.differs_hot_digit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Hot digit for Differs'),
            args0: [],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize('Most frequent digit from the last Differs scan. -1 when that digit is not ready to trade.'),
            ...colour(),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

const call = code => [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL];

window.Blockly.JavaScript.javascriptGenerator.forBlock.differs_hot_scan = block => {
    const n =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'N',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '1000';
    const gap =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'GAP',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '2';
    return call(`Bot.scanDiffersHotAbsence(${n}, ${gap})`);
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.differs_hot_digit = () => call('Bot.differsHotDigit()');
