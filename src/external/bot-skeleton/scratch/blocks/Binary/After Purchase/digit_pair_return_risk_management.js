import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_pair_return_risk_management = {
    init() {
        this.jsonInit({
            message0: localize('Digit Pair risk management'),
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
            display_name: localize('Digit Pair risk management'),
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

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_pair_return_risk_management = () => {
    const variable = id =>
        window.Blockly.JavaScript.variableDB_.getName(id, window.Blockly.Variables.CATEGORY_NAME);
    const stake = variable('dpr_stake');
    const base_stake = variable('dpr_base_stake');
    const losses = variable('dpr_losses');
    const recovery_pending = variable('dpr_recovery');
    const recovery_multiplier = variable('dpr_recovery_multiplier');
    const protect_profit = variable('dpr_protect');
    const trades = variable('dpr_trades');
    const take_profit = variable('dpr_take_profit');
    const stop_loss = variable('dpr_stop_loss');
    const max_trades = variable('dpr_max_trades');
    const stop = variable('dpr_stop');
    const signal = variable('dpr_signal');

    return `
    var BinaryBotPrivateDprWon = Bot.isResult('win');
    if (BinaryBotPrivateDprWon) {
        ${stake} = Number(${base_stake});
        ${losses} = 0;
        ${recovery_pending} = false;
    } else {
        ${losses} = Number(${losses}) + 1;
        var BinaryBotPrivateDprSessionProfit = Number(Bot.getSessionProfit(false));
        var BinaryBotPrivateDprProtect = ${protect_profit} === true || ${protect_profit} === 1 || ${protect_profit} === 'TRUE' || ${protect_profit} === 'true';
        var BinaryBotPrivateDprMg = Number(${recovery_multiplier});
        if (BinaryBotPrivateDprProtect && BinaryBotPrivateDprSessionProfit > Number(${base_stake})) {
            BinaryBotPrivateDprMg = 1;
        }
        if (${recovery_pending}) {
            ${stake} = Number(${base_stake});
            ${recovery_pending} = false;
        } else {
            ${stake} = Number(${base_stake}) * BinaryBotPrivateDprMg;
            ${recovery_pending} = true;
        }
    }
    ${trades} = Number(${trades}) + 1;
    var BinaryBotPrivateDprTakeProfit = Number(${take_profit});
    var BinaryBotPrivateDprStopLoss = Number(${stop_loss});
    var BinaryBotPrivateDprProfit = Number(Bot.getSessionProfit(false));
    if ((BinaryBotPrivateDprTakeProfit > 0 && BinaryBotPrivateDprProfit >= BinaryBotPrivateDprTakeProfit) ||
        (BinaryBotPrivateDprStopLoss > 0 && Number(${losses}) >= BinaryBotPrivateDprStopLoss) ||
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
