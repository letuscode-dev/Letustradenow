/**
 * Apollo-style purchase with optional digit prediction (Over/Under barrier).
 * Acts as a purchase substitute inside before_purchase.
 */
import { localize } from '@deriv-com/translations';
import { config } from '../../../../constants/config';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

const getPurchaseOptions = () => {
    const contract_types = new Set();
    const options = [];

    Object.values(config().opposites).forEach(contract_group => {
        contract_group.forEach(contract_type_config => {
            const [contract_type, label] = Object.entries(contract_type_config)[0];
            if (!contract_types.has(contract_type)) {
                contract_types.add(contract_type);
                options.push([localize(label), contract_type]);
            }
        });
    });

    return options;
};

const NEEDS_PREDICTION = new Set(['DIGITOVER', 'DIGITUNDER', 'DIGITDIFF', 'DIGITMATCH']);

window.Blockly.Blocks.apollo_purchase2 = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
        this.updateShape_();
    },
    definition() {
        return {
            message0: localize('Buy {{ contract_type }} {{ prediction }}', {
                contract_type: '%1',
                prediction: '%2',
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PURCHASE_LIST',
                    options: getPurchaseOptions(),
                },
                {
                    type: 'input_value',
                    name: 'PREDICTION',
                    check: 'Number',
                },
            ],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize(
                'Purchases the selected contract type. For Over/Under/Differs/Matches, provide a digit prediction.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Buy (with prediction)'),
            description: localize(
                'Purchase substitute that can buy Even/Odd/Over/Under/etc. Optional digit prediction for barrier contracts.'
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
    },
    updateShape_() {
        const contract_type = this.getFieldValue('PURCHASE_LIST');
        const prediction_input = this.getInput('PREDICTION');
        if (!prediction_input) {
            return;
        }
        prediction_input.setVisible(NEEDS_PREDICTION.has(contract_type));
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
