/**
 * Even/Odd frequency scan — hottest digit picks the opposite contract,
 * and the coldest digit in that same even or odd group is the entry.
 * Hidden from the Blocks menu; the Even/Odd free bot calls it.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const colour = () => ({
    colour: window.Blockly.Colours.Base.colour,
    colourSecondary: window.Blockly.Colours.Base.colourSecondary,
    colourTertiary: window.Blockly.Colours.Base.colourTertiary,
    category: window.Blockly.Categories.Tick_Analysis,
});

window.Blockly.Blocks.even_odd_parity_scan = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Even/Odd scan of last {{ n }} ticks', { n: '%1' }),
            args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize(
                'Counts the last N digits. Returns 1 when the window is full. An even hottest digit means trade Odd; an odd hottest digit means trade Even. The entry is the least frequent digit in that same group.'
            ),
            ...colour(),
        };
    },
    meta() {
        return {
            display_name: localize('Even/Odd frequency scan'),
            description: localize(
                'Scans last-digit frequency and prepares an Even or Odd signal with an entry digit.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.Blocks.even_odd_parity_entry = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Even/Odd entry digit'),
            args0: [],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize('Least frequent digit in the same even or odd group as the hottest digit. -1 before a scan.'),
            ...colour(),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.Blocks.even_odd_parity_side = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Even/Odd side'),
            args0: [],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize('0 trades Even and 1 trades Odd. -1 before a scan is ready.'),
            ...colour(),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.Blocks.even_odd_parity_dominant = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Even/Odd hottest digit'),
            args0: [],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            tooltip: localize('Most frequent digit from the last Even/Odd scan. -1 before a scan is ready.'),
            ...colour(),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

const call = code => [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL];

window.Blockly.JavaScript.javascriptGenerator.forBlock.even_odd_parity_scan = block => {
    const n =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'N',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '1000';
    return call(`Bot.scanEvenOddParity(${n})`);
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.even_odd_parity_entry = () => call('Bot.evenOddParityEntry()');

window.Blockly.JavaScript.javascriptGenerator.forBlock.even_odd_parity_side = () => call('Bot.evenOddParitySide()');

window.Blockly.JavaScript.javascriptGenerator.forBlock.even_odd_parity_dominant = () =>
    call('Bot.evenOddParityDominant()');
