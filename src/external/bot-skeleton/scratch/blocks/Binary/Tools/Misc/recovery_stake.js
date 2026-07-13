import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.recovery_configure = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'Configure recovery (stake {{ stake }}, payout {{ payout }}%, splits {{ splits }})',
                { stake: '%1', payout: '%2', splits: '%3' }
            ),
            args0: [
                { type: 'input_value', name: 'STAKE', check: 'Number' },
                { type: 'input_value', name: 'PAYOUT', check: 'Number' },
                { type: 'input_value', name: 'SPLITS', check: 'Number' },
            ],
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            previousStatement: null,
            nextStatement: null,
            tooltip: localize(
                'Sets initial stake, contract payout percent, and how many winning runs should fully recover a loss.'
            ),
            category: window.Blockly.Categories.Miscellaneous,
        };
    },
    meta() {
        return {
            display_name: localize('Configure recovery'),
            description: localize(
                'Stores payout % and recovery split count used to size stakes after losses.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.recovery_configure = block => {
    const stake =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'STAKE',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '1';
    const payout =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'PAYOUT',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '95';
    const splits =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'SPLITS',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '1';

    return `Bot.configureRecovery(${stake}, ${payout}, ${splits});\n`;
};

window.Blockly.Blocks.recovery_stake = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Recovery stake'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Stake sized to recover accumulated loss over the remaining recovery splits using the configured payout percent.'
            ),
            category: window.Blockly.Categories.Miscellaneous,
        };
    },
    meta() {
        return {
            display_name: localize('Recovery stake'),
            description: localize(
                'Returns the next trade stake for payout-based recovery. When flat, returns the initial stake.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.recovery_stake = () => [
    'Bot.getRecoveryStake()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

window.Blockly.Blocks.recovery_apply_result = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Update recovery (win {{ win }}, profit {{ profit }})', {
                win: '%1',
                profit: '%2',
            }),
            args0: [
                { type: 'input_value', name: 'IS_WIN', check: 'Boolean' },
                { type: 'input_value', name: 'PROFIT', check: 'Number' },
            ],
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            previousStatement: null,
            nextStatement: null,
            tooltip: localize(
                'On loss, add the lost amount and plan recovery over N wins. On win, reduce remaining loss for the next recovery stake.'
            ),
            category: window.Blockly.Categories.Miscellaneous,
        };
    },
    meta() {
        return {
            display_name: localize('Update recovery'),
            description: localize('Applies the last contract result to the payout-based recovery tracker.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.recovery_apply_result = block => {
    const is_win =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'IS_WIN',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || 'false';
    const profit =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'PROFIT',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '0';

    return `Bot.applyRecoveryResult(${is_win}, ${profit});\n`;
};
