import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.adaptive_digit_gap_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'adaptive digit gap Differs (on {{ enabled }}, min {{ min_gap }}, max {{ max_gap }}, mode {{ mode }}, cooldown {{ cooldown }}, max trades {{ max_trades }}, 1/cycle {{ one_cycle }}, 1 active {{ one_active }}, journal {{ journal }}, dashboard {{ dashboard }})',
                {
                    enabled: '%1',
                    min_gap: '%2',
                    max_gap: '%3',
                    mode: '%4',
                    cooldown: '%5',
                    max_trades: '%6',
                    one_cycle: '%7',
                    one_active: '%8',
                    journal: '%9',
                    dashboard: '%10',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_GAP', check: 'Number' },
                { type: 'input_value', name: 'MAX_GAP', check: 'Number' },
                { type: 'input_value', name: 'SELECTION_MODE', check: 'Number' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'MAX_TRADES', check: 'Number' },
                { type: 'input_value', name: 'ONE_CYCLE', check: 'Boolean' },
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
                'Tracks an adaptive gap per digit 0–9. Returns the digit to Differs when its current gap reaches its last completed gap, or -1 when none qualify. With one-active on, waits until the open Differs settles before signaling again.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Adaptive digit gap prediction'),
            description: localize(
                'Independently tracks gaps for digits 0–9. Each digit’s latest completed gap becomes its next Differs trigger. One-active waits for the current Differs to complete. Optional journal and live dashboard logging.'
            ),
            key_words: localize('adaptive, gap, digit, differs, journal, dashboard'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.adaptive_digit_gap_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const enabled = read('ENABLED') || 'true';
    const min_gap = read('MIN_GAP') || '3';
    const max_gap = read('MAX_GAP') || '20';
    const mode = read('SELECTION_MODE') || '0';
    const cooldown = read('COOLDOWN') || '0';
    const max_trades = read('MAX_TRADES') || '0';
    const one_cycle = read('ONE_CYCLE') || 'true';
    const one_active = read('ONE_ACTIVE') || 'true';
    const journal = read('JOURNAL') || 'true';
    const dashboard = read('DASHBOARD') || 'false';

    const code = `(function () {
        var BinaryBotPrivateAdaptiveGapResult = Bot.evaluateAdaptiveDigitGap({
            enabled: ${enabled},
            min_adaptive_gap: ${min_gap},
            max_adaptive_gap: ${max_gap},
            selection_mode: ${mode},
            cooldown_after_trade: ${cooldown},
            max_trades_per_session: ${max_trades},
            one_trade_per_cycle: ${one_cycle},
            one_active_trade_only: ${one_active},
            journal_enabled: ${journal},
            dashboard_enabled: ${dashboard}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateAdaptiveGapResult && BinaryBotPrivateAdaptiveGapResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            for (BinaryBotPrivateMsgIndex = 0; BinaryBotPrivateMsgIndex < BinaryBotPrivateMsgs.length; BinaryBotPrivateMsgIndex++) {
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
        if (BinaryBotPrivateAdaptiveGapResult && BinaryBotPrivateAdaptiveGapResult.dashboard) {
            Bot.notify({
                className: 'journal__text',
                message: BinaryBotPrivateAdaptiveGapResult.dashboard,
                sound: 'silent',
                block_id: ${JSON.stringify(block.id)},
                variable_name: null
            });
        }
        var BinaryBotPrivatePrediction = BinaryBotPrivateAdaptiveGapResult
            ? Number(BinaryBotPrivateAdaptiveGapResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
