import { localize } from '@deriv-com/translations';
import { config } from '../../../../constants/config';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

const getOverrideContractTypeOptions = () => {
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

window.Blockly.Blocks.override_contract_type_purchase = {
    init() {
        this.jsonInit(this.definition());

        // This is a branch-ending purchase substitute, just like the normal Purchase block.
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Override contract type: {{ contract_type }}', { contract_type: '%1' }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'CONTRACT_TYPE',
                    options: getOverrideContractTypeOptions(),
                },
            ],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize('Purchases the selected contract type from inside Purchase conditions.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Override contract type'),
            description: localize(
                'Use this block inside Purchase conditions to buy a specific contract type directly. It works as a Purchase substitute on that branch, so you do not need a separate Purchase block after it.'
            ),
            key_words: localize('purchase, buy, override, contract type, force'),
        };
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.override_contract_type_purchase = block => {
    const contract_type = block.getFieldValue('CONTRACT_TYPE');

    return `Bot.purchaseOverrideContractType('${contract_type}');\n`;
};
