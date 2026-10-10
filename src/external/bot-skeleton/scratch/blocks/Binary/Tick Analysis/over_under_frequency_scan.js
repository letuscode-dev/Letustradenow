/**
 * Over/Under frequency scan — hottest digit picks Over or Under,
 * and the coldest digit in that same even or odd group is the entry.
 * Hidden from the Blocks menu; the Over/Under frequency free bot calls it.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colour = () => ({
    colour: window.Blockly.Colours.Base.colour,
    colourSecondary: window.Blockly.Colours.Base.colourSecondary,
    colourTertiary: window.Blockly.Colours.Base.colourTertiary,
    category: window.Blockly.Categories.Tick_Analysis,
});

window.Blockly.Blocks.over_under_frequency_scan = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Over/Under scan of last {{ n }} ticks', { n: '%1' }),
            args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize(
                'Counts the last N digits. Returns 1 when the window is full. An even hottest digit trades Over. An odd hottest digit trades Under. The entry is the least frequent digit in that same group.'
            ),
            ...colour(),
        };
    },
    meta() {
        return {
            display_name: localize('Over/Under frequency scan'),
            description: localize(
                'Scans last-digit frequency and prepares an Over or Under signal with an entry digit.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.Blocks.over_under_frequency_entry = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Over/Under entry digit'),
            args0: [],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize(
                'Least frequent digit in the same even or odd group as the hottest digit. -1 before a scan.'
            ),
            ...colour(),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.Blocks.over_under_frequency_dominant = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Over/Under hottest digit'),
            args0: [],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize('Most frequent digit from the last Over/Under scan. -1 before a scan is ready.'),
            ...colour(),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

/**
 * Re-reads stake and prediction into the current trade. The purchase uses the
 * options captured at the start of the cycle, so a new signal must refresh
 * them before it buys.
 */
window.Blockly.Blocks.refresh_trade_options = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Refresh trade options'),
            previousStatement: null,
            nextStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize('Applies the current stake and prediction to the trade about to be bought.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

const call = code => [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL];

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_frequency_scan = block => {
    const n =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'N',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '1000';
    return call(`Bot.scanOverUnderFrequency(${n})`);
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_frequency_entry = () =>
    call('Bot.overUnderFrequencyEntry()');

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_frequency_dominant = () =>
    call('Bot.overUnderFrequencyDominant()');

window.Blockly.JavaScript.javascriptGenerator.forBlock.refresh_trade_options = () => 'BinaryBotPrivateStart();\n';
