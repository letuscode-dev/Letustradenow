import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.double_repeat_relationship_risk_management = {
    init() {
        this.jsonInit({
            message0: localize('Double-Repeat risk management'),
            args0: [],
            previousStatement: 'TradeAgain',
            nextStatement: 'TradeAgain',
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Applies take profit, daily loss, consecutive-loss, trade-count, and one-step recovery limits.'),
            category: window.Blockly.Categories.After_Purchase,
        });
    },
    meta() {
        return {
            display_name: localize('Double-Repeat risk management'),
            description: localize('Uses the configured base stake and recovery multiplier after losses.'),
            key_words: localize('take profit, daily loss, consecutive losses, recovery'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.double_repeat_relationship_risk_management = () => {
    const variable = id => window.Blockly.JavaScript.variableDB_.getName(id, window.Blockly.Variables.CATEGORY_NAME);
    const stake = variable('drrs_stake');
    const base_stake = variable('drrs_base_stake');
    const losses = variable('drrs_losses');
    const recovery_pending = variable('drrs_recovery');
    const trades = variable('drrs_trades');
    const stop = variable('drrs_stop');
    const take_profit = variable('drrs_take_profit');
    const daily_loss = variable('drrs_daily_loss');
    const stop_loss = variable('drrs_stop_loss');
    const max_trades = variable('drrs_max_trades');
    return `
    ${losses} = Number(${losses}) || 0;
    ${trades} = Number(${trades}) || 0;
    ${recovery_pending} = Boolean(${recovery_pending});
    if (Bot.isResult('win')) {
        ${stake} = Number(${base_stake});
        ${losses} = 0;
        ${recovery_pending} = false;
    } else {
        ${losses} = Number(${losses}) + 1;
        if (${recovery_pending}) {
            ${stake} = Number(${base_stake});
            ${recovery_pending} = false;
        } else {
            ${stake} = Number(${base_stake}) * 10.5;
            ${recovery_pending} = true;
        }
    }
    ${trades} = Number(${trades}) + 1;
    var BinaryBotPrivateDrrsProfit = Number(Bot.getSessionProfit(false));
    if ((Number(${take_profit}) > 0 && BinaryBotPrivateDrrsProfit >= Number(${take_profit})) ||
        (Number(${daily_loss}) > 0 && BinaryBotPrivateDrrsProfit <= -Number(${daily_loss})) ||
        (Number(${stop_loss}) > 0 && Number(${losses}) >= Number(${stop_loss})) ||
        (Number(${max_trades}) > 0 && Number(${trades}) >= Number(${max_trades}))) {
        ${stop} = true;
    } else {
        Bot.isTradeAgain(true);
        return true;
    }
`;
};
