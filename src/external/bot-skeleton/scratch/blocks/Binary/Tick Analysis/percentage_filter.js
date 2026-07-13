import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.percentage_filter = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'Percentage filter Over 2 (enabled {{ enabled }}, threshold {{ threshold }}%, journal {{ journal }})',
                {
                    enabled: '%1',
                    threshold: '%2',
                    journal: '%3',
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
                    name: 'THRESHOLD',
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
                'Trade filter for Over 2: analyses the last 100 ticks and only allows a purchase when digits 3–9 meet or exceed the percentage threshold. When disabled, always allows the trade.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Percentage filter (Over 2)'),
            description: localize(
                'Counts how often digits 3–9 appear in the last 100 ticks and compares that Over 2 percentage to your threshold. Optionally logs collecting / passed / failed messages to the Journal.'
            ),
            key_words: localize('percentage, filter, over, digit, threshold, journal'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.percentage_filter = block => {
    const enabled =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'ENABLED',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'true';
    const threshold =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'THRESHOLD',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '75';
    const journal =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'JOURNAL',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'true';

    const code = `(function () {
        var BinaryBotPrivatePercentageFilterResult = Bot.evaluatePercentageFilter(${enabled}, ${threshold}, ${journal});
        if (BinaryBotPrivatePercentageFilterResult && BinaryBotPrivatePercentageFilterResult.journal_enabled) {
            var BinaryBotPrivatePercentageFilterClass = 'journal__text';
            if (BinaryBotPrivatePercentageFilterResult.status === 'passed') {
                BinaryBotPrivatePercentageFilterClass = 'journal__text--success';
            } else if (BinaryBotPrivatePercentageFilterResult.status === 'failed') {
                BinaryBotPrivatePercentageFilterClass = 'journal__text--error';
            } else if (BinaryBotPrivatePercentageFilterResult.status === 'collecting') {
                BinaryBotPrivatePercentageFilterClass = 'journal__text';
            }
            Bot.notify({
                className: BinaryBotPrivatePercentageFilterClass,
                message: BinaryBotPrivatePercentageFilterResult.message,
                sound: 'silent',
                block_id: ${JSON.stringify(block.id)},
                variable_name: null
            });
        }
        return !!(BinaryBotPrivatePercentageFilterResult && BinaryBotPrivatePercentageFilterResult.allowed);
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
