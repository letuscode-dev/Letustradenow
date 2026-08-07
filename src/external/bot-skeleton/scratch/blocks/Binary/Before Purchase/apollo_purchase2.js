/**
 * Purchase with optional digit prediction (Over/Under barrier).
 * Matches Deriv "Purchase Even/Odd/Over/Under" look used in Pattern Switch.
 */
import { localize } from '@deriv-com/translations';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

const PURCHASE_OPTIONS = [
    [localize('Even'), 'DIGITEVEN'],
    [localize('Odd'), 'DIGITODD'],
    [localize('Over'), 'DIGITOVER'],
    [localize('Under'), 'DIGITUNDER'],
    [localize('Matches'), 'DIGITMATCH'],
    [localize('Differs'), 'DIGITDIFF'],
];

const NEEDS_PREDICTION = new Set(['DIGITOVER', 'DIGITUNDER', 'DIGITDIFF', 'DIGITMATCH']);

window.Blockly.Blocks.apollo_purchase2 = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
        this.updateShape_();
    },
    definition() {
        return {
            message0: localize('Purchase {{ contract_type }}', { contract_type: '%1' }),
            message1: localize('Prediction: {{ prediction }}', { prediction: '%1' }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PURCHASE_LIST',
                    options: PURCHASE_OPTIONS,
                },
            ],
            args1: [
                {
                    type: 'input_value',
                    name: 'PREDICTION',
                    check: 'Number',
                },
            ],
            inputsInline: true,
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize(
                'Purchases Even, Odd, Over, or Under. Over/Under/Matches/Differs need a digit prediction.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Purchase (with prediction)'),
            description: localize(
                'Purchase substitute for Even/Odd/Over/Under. Optional digit prediction for barrier contracts.'
            ),
            key_words: localize('purchase, buy, over, under, even, odd, prediction'),
        };
    },
    onchange(event) {
        if (!this.workspace || this.isInFlyout) {
            return;
        }
        if (
            event.type === window.Blockly.Events.BLOCK_CHANGE &&
            event.blockId === this.id &&
            event.name === 'PURCHASE_LIST'
        ) {
            this.updateShape_();
        }
        if (event.type === window.Blockly.Events.BLOCK_CREATE && event.ids?.includes(this.id)) {
            this.updateShape_();
        }
    },
    updateShape_() {
        const contract_type = this.getFieldValue('PURCHASE_LIST');
        const needs_prediction = NEEDS_PREDICTION.has(contract_type);
        const prediction_input = this.getInput('PREDICTION');
        if (prediction_input) {
            prediction_input.setVisible(needs_prediction);
        }
        // Keep inline layout readable after show/hide.
        if (typeof this.render === 'function') {
            this.render();
        }
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.apollo_purchase2 = block => {
    const contract_type = block.getFieldValue('PURCHASE_LIST') || 'DIGITEVEN';
    const prediction =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'PREDICTION',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'null';

    if (NEEDS_PREDICTION.has(contract_type)) {
        return `Bot.purchaseOverrideContractType('${contract_type}', ${prediction});\n`;
    }
    return `Bot.purchaseOverrideContractType('${contract_type}');\n`;
};
