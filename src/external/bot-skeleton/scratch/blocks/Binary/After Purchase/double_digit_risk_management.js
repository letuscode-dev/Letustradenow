import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.double_digit_risk_management = {
    init() {
        this.jsonInit({
            message0: localize('Double Digit risk management'),
            args0: [],
            previousStatement: null,
            nextStatement: null,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Applies take profit, consecutive-loss stop loss, one-step 10.5x recovery, and base-stake reset.'),
            category: window.Blockly.Categories.After_Purchase,
        });
    },
    meta() {
        return {
            display_name: localize('Double Digit risk management'),
            description: localize('One recovery trade at 10.5 times base stake after a loss, then reset to base stake.'),
            key_words: localize('take profit, stop loss, consecutive losses, recovery, stake'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.double_digit_risk_management = () => {
    const variable = id => window.Blockly.JavaScript.variableDB_.getName(
        id,
        window.Blockly.Variables.CATEGORY_NAME
    );
    const stake = variable('dd_stake');
    const base_stake = variable('dd_base_stake');
    const losses = variable('dd_losses');
    const recovery_pending = variable('dd_recovery');
    const recovery_multiplier = variable('dd_recovery_multiplier');
    const trades = variable('dd_trades');
    const take_profit = variable('dd_take_profit');
    const stop_loss = variable('dd_stop_loss');
    const max_trades = variable('dd_max_trades');
    const stop = variable('dd_stop');
    const signal = variable('dd_signal');

    return `
    var BinaryBotPrivateDdrWon = Bot.isResult('win');
    if (BinaryBotPrivateDdrWon) {
        ${stake} = Number(${base_stake});
        ${losses} = 0;
        ${recovery_pending} = false;
    } else {
        ${losses} = Number(${losses}) + 1;
        if (${recovery_pending}) {
            ${stake} = Number(${base_stake});
            ${recovery_pending} = false;
        } else {
            ${stake} = Number(${base_stake}) * Number(${recovery_multiplier});
            ${recovery_pending} = true;
        }
    }
    ${trades} = Number(${trades}) + 1;
    var BinaryBotPrivateDdrTakeProfit = Number(${take_profit});
    var BinaryBotPrivateDdrStopLoss = Number(${stop_loss});
    var BinaryBotPrivateDdrProfit = Number(Bot.getSessionProfit(false));
    if ((BinaryBotPrivateDdrTakeProfit > 0 && BinaryBotPrivateDdrProfit >= BinaryBotPrivateDdrTakeProfit) ||
        (BinaryBotPrivateDdrStopLoss > 0 && Number(${losses}) >= BinaryBotPrivateDdrStopLoss) ||
        Number(${trades}) >= Number(${max_trades})) {
        ${stop} = true;
    } else {
        ${signal} = false;
        Bot.isTradeAgain(true);
        return true;
    }
`;
};
