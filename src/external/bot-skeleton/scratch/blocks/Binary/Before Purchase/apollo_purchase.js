/**
 * Apollo purchase — purchase substitute for prediction-based contracts.
 * Prediction comes from trade options set in SUBMARKET.
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

window.Blockly.Blocks.apollo_purchase = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Purchase {{ contract_type }}', { contract_type: '%1' }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PURCHASE_LIST',
                    options: PURCHASE_OPTIONS,
                },
            ],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize('Purchases the selected digit contract (Apollo compatibility).'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Purchase (Apollo)'),
            description: localize('Compatibility purchase block for imported Apollo strategies.'),
            key_words: localize('purchase, buy, over, under, even, odd'),
        };
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.apollo_purchase = block => {
    const contract_type = block.getFieldValue('PURCHASE_LIST') || 'DIGITOVER';
    return `Bot.purchaseOverrideContractType('${contract_type}');\n`;
};
