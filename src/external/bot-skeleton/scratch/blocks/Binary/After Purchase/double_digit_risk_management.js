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
            tooltip: localize(
                'Applies take profit, consecutive-loss stop loss, recovery multiplier (or 1x when Martingale Off When Profit > Stake is on and session profit exceeds stake), and base-stake reset.'
            ),
            category: window.Blockly.Categories.After_Purchase,
        });
    },
    meta() {
        return {
            display_name: localize('Double Digit risk management'),
            description: localize(
                'One recovery trade after a loss using Recovery Multiplier, unless Protect Profit is enabled and session profit exceeds stake (then multiplier is 1).'
            ),
            key_words: localize('take profit, stop loss, consecutive losses, recovery, stake, protect'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.double_digit_risk_management = () => {
    const variable = id =>
        window.Blockly.JavaScript.variableDB_.getName(id, window.Blockly.Variables.CATEGORY_NAME);
    const stake = variable('dd_stake');
    const base_stake = variable('dd_base_stake');
    const losses = variable('dd_losses');
    const recovery_pending = variable('dd_recovery');
    const recovery_multiplier = variable('dd_recovery_multiplier');
    const protect_profit = variable('dd_protect');
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
        var BinaryBotPrivateDdrSessionProfit = Number(Bot.getSessionProfit(false));
        var BinaryBotPrivateDdrProtect = ${protect_profit} === true || ${protect_profit} === 1 || ${protect_profit} === 'TRUE' || ${protect_profit} === 'true';
        var BinaryBotPrivateDdrMg = Number(${recovery_multiplier});
        if (BinaryBotPrivateDdrProtect && BinaryBotPrivateDdrSessionProfit > Number(${base_stake})) {
            BinaryBotPrivateDdrMg = 1;
        }
        if (${recovery_pending}) {
            ${stake} = Number(${base_stake});
            ${recovery_pending} = false;
        } else {
            ${stake} = Number(${base_stake}) * BinaryBotPrivateDdrMg;
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
        ${signal} = false;
    } else {
        ${signal} = false;
        Bot.isTradeAgain(true);
        return true;
    }
`;
};
