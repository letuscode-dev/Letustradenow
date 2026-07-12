import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.range_momentum_over_one = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'range momentum Over 1 (on {{ enabled }}, cooldown {{ cooldown }}, lookback {{ lookback }}, journal {{ journal }}, notify {{ notify }})',
                {
                    enabled: '%1',
                    cooldown: '%2',
                    lookback: '%3',
                    journal: '%4',
                    notify: '%5',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
                { type: 'input_value', name: 'NOTIFY', check: 'Boolean' },
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Allows Over 1 when last digits show Lower(2-5)→Higher(6-9) momentum and no Losing(0-1) digits in the lookback window.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Range momentum Over 1'),
            description: localize(
                'Detects upward momentum from last-digit range 2–5 into 6–9, filters recent losing digits (0–1), and optionally cools down after each trade. Use before purchasing Over 1.'
            ),
            key_words: localize('range, momentum, over, digit, lower, higher, losing'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.range_momentum_over_one = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const enabled = read('ENABLED') || 'true';
    const cooldown = read('COOLDOWN') || '0';
    const lookback = read('LOOKBACK') || '2';
    const journal = read('JOURNAL') || 'true';
    const notify = read('NOTIFY') || 'true';

    const code = `(function () {
        var BinaryBotPrivateRmResult = Bot.evaluateRangeMomentumOverOne({
            enabled: ${enabled},
            cooldown_after_trade: ${cooldown},
            losing_lookback: ${lookback},
            journal_enabled: ${journal},
            notify_enabled: ${notify}
        });
        var BinaryBotPrivateMsgs = [];
        if (BinaryBotPrivateRmResult && BinaryBotPrivateRmResult.journal_messages) {
            BinaryBotPrivateMsgs = BinaryBotPrivateMsgs.concat(BinaryBotPrivateRmResult.journal_messages);
        }
        if (BinaryBotPrivateRmResult && BinaryBotPrivateRmResult.notify_messages) {
            BinaryBotPrivateMsgs = BinaryBotPrivateMsgs.concat(BinaryBotPrivateRmResult.notify_messages);
        }
        if (BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 3 ? 3 : BinaryBotPrivateMsgs.length;
            for (BinaryBotPrivateMsgIndex = 0; BinaryBotPrivateMsgIndex < BinaryBotPrivateMsgLimit; BinaryBotPrivateMsgIndex++) {
                var BinaryBotPrivateMsg = BinaryBotPrivateMsgs[BinaryBotPrivateMsgIndex];
                Bot.notify({
                    className: BinaryBotPrivateMsg.className,
                    message: BinaryBotPrivateMsg.message,
                    sound: 'silent',
                    block_id: ${JSON.stringify(block.id)},
                    variable_name: null
                });
            }
        }
        return !!(BinaryBotPrivateRmResult && BinaryBotPrivateRmResult.allowed);
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
