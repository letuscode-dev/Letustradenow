import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

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


window.Blockly.JavaScript.javascriptGenerator.forBlock.refresh_trade_options = () => 'BinaryBotPrivateStart();\n';
