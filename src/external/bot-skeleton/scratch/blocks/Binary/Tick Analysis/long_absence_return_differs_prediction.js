import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.long_absence_return_differs_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'long absence return Differs (on {{ enabled }}, min absence {{ min_absence }}, max absence {{ max_absence }}, delay {{ return_delay }}, cancel early {{ cancel_early }}, confirmations {{ confirmations }}, window {{ confirmation_window }}, signal age {{ signal_age }}, cooldown {{ cooldown }}, max trades {{ max_trades }}, 1 active {{ one_active }}, journal {{ journal }}, dashboard {{ dashboard }})',
                {
                    enabled: '%1',
                    min_absence: '%2',
                    max_absence: '%3',
                    return_delay: '%4',
                    cancel_early: '%5',
                    confirmations: '%6',
                    confirmation_window: '%7',
                    signal_age: '%8',
                    cooldown: '%9',
                    max_trades: '%10',
                    one_active: '%11',
                    journal: '%12',
                    dashboard: '%13',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_ABSENCE', check: 'Number' },
                { type: 'input_value', name: 'MAX_ABSENCE', check: 'Number' },
                { type: 'input_value', name: 'RETURN_DELAY', check: 'Number' },
                { type: 'input_value', name: 'CANCEL_EARLY', check: 'Boolean' },
                { type: 'input_value', name: 'CONFIRMATIONS', check: 'Number' },
                { type: 'input_value', name: 'CONFIRMATION_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'SIGNAL_AGE', check: 'Number' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'MAX_TRADES', check: 'Number' },
                { type: 'input_value', name: 'ONE_ACTIVE', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
                { type: 'input_value', name: 'DASHBOARD', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Tracks absence per digit. After a long absence and return, waits your delay then Differs that digit.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Long absence return prediction'),
            description: localize(
                'Detects when a digit returns after a long absence, waits a configurable delay, then Differs that digit. Optional confirmation mode and early-reappearance cancellation.'
            ),
            key_words: localize('long, absence, return, digit, differs, delay'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.long_absence_return_differs_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateLarResult = Bot.evaluateLongAbsenceReturnDiffers({
            enabled: ${read('ENABLED') || 'true'},
            min_absence_threshold: ${read('MIN_ABSENCE') || '20'},
            max_absence_threshold: ${read('MAX_ABSENCE') || '0'},
            return_delay: ${read('RETURN_DELAY') || '2'},
            cancel_on_early_reappearance: ${read('CANCEL_EARLY') || 'true'},
            required_return_confirmations: ${read('CONFIRMATIONS') || '1'},
            confirmation_window: ${read('CONFIRMATION_WINDOW') || '5'},
            max_signal_age: ${read('SIGNAL_AGE') || '0'},
            cooldown_after_trade: ${read('COOLDOWN') || '0'},
            max_trades_per_session: ${read('MAX_TRADES') || '0'},
            one_active_trade_only: ${read('ONE_ACTIVE') || 'true'},
            journal_enabled: ${read('JOURNAL') || 'true'},
            dashboard_enabled: ${read('DASHBOARD') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateLarResult && BinaryBotPrivateLarResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 8 ? 8 : BinaryBotPrivateMsgs.length;
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
        if (BinaryBotPrivateLarResult && BinaryBotPrivateLarResult.dashboard) {
            Bot.notify({
                className: 'journal__text',
                message: BinaryBotPrivateLarResult.dashboard,
                sound: 'silent',
                block_id: ${JSON.stringify(block.id)},
                variable_name: null
            });
        }
        var BinaryBotPrivatePrediction = BinaryBotPrivateLarResult
            ? Number(BinaryBotPrivateLarResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
