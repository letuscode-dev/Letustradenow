import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.over_zero_gap_filter = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'Over 0 gap filter (enabled {{ enabled }}, min {{ min_gap }}, max {{ max_gap }}, journal {{ journal }})',
                {
                    enabled: '%1',
                    min_gap: '%2',
                    max_gap: '%3',
                    journal: '%4',
                }
            ),
            args0: [
                {
                    type: 'input_value',
                    name: 'ENABLED',
                    check: 'Boolean',
                },
                {
                    type: 'input_value',
                    name: 'MIN_GAP',
                    check: 'Number',
                },
                {
                    type: 'input_value',
                    name: 'MAX_GAP',
                    check: 'Number',
                },
                {
                    type: 'input_value',
                    name: 'JOURNAL',
                    check: 'Boolean',
                },
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Trade filter for Over 0: only allows a purchase when the gap since the last digit 0 is between min and max (inclusive). When disabled, always allows the trade.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Over 0 gap filter'),
            description: localize(
                'Counts consecutive non-zero last digits since the last 0. Use as a filter before purchasing Over 0. Optionally logs PASSED/FAILED details to the Journal.'
            ),
            key_words: localize('gap, filter, over, zero, digit, journal'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_zero_gap_filter = block => {
    const enabled =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'ENABLED',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'true';
    const min_gap =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'MIN_GAP',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '3';
    const max_gap =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'MAX_GAP',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '10';
    const journal =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'JOURNAL',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'true';

    // Evaluate once per tick path, optionally journal, then return allow/block.
    const code = `(function () {
        var BinaryBotPrivateGapFilterResult = Bot.evaluateOverZeroGapFilter(${enabled}, ${min_gap}, ${max_gap}, ${journal});
        if (BinaryBotPrivateGapFilterResult && BinaryBotPrivateGapFilterResult.journal_enabled) {
            Bot.notify({
                className: BinaryBotPrivateGapFilterResult.allowed ? 'journal__text--success' : 'journal__text--error',
                message: BinaryBotPrivateGapFilterResult.message,
                sound: 'silent',
                block_id: ${JSON.stringify(block.id)},
                variable_name: null
            });
        }
        return !!(BinaryBotPrivateGapFilterResult && BinaryBotPrivateGapFilterResult.allowed);
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
