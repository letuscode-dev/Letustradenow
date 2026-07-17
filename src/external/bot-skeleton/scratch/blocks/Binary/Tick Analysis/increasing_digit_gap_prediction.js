import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.increasing_digit_gap_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'increasing gap Differs (on {{ enabled }}, min gap {{ min_gap }}, max gap {{ max_gap }}, min diff {{ min_diff }}, max diff {{ max_diff }}, gaps {{ gaps_required }}, cancel early {{ cancel_early }}, cooldown {{ cooldown }}, max trades {{ max_trades }}, 1/cycle {{ one_cycle }}, 1 active {{ one_active }}, journal {{ journal }})',
                {
                    enabled: '%1',
                    min_gap: '%2',
                    max_gap: '%3',
                    min_diff: '%4',
                    max_diff: '%5',
                    gaps_required: '%6',
                    cancel_early: '%7',
                    cooldown: '%8',
                    max_trades: '%9',
                    one_cycle: '%10',
                    one_active: '%11',
                    journal: '%12',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_GAP', check: 'Number' },
                { type: 'input_value', name: 'MAX_GAP', check: 'Number' },
                { type: 'input_value', name: 'MIN_COMMON_DIFF', check: 'Number' },
                { type: 'input_value', name: 'MAX_COMMON_DIFF', check: 'Number' },
                { type: 'input_value', name: 'GAPS_REQUIRED', check: 'Number' },
                { type: 'input_value', name: 'CANCEL_EARLY', check: 'Boolean' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'MAX_TRADES', check: 'Number' },
                { type: 'input_value', name: 'ONE_CYCLE', check: 'Boolean' },
                { type: 'input_value', name: 'ONE_ACTIVE', check: 'Boolean' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Tracks each digit 0–9. When recent gaps form an arithmetic progression, waits the predicted next gap and returns the digit for Differs one tick before the target.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Increasing gap prediction'),
            description: localize(
                'Detects consistently increasing gaps between digit appearances (e.g. 2→3→4 predicts 5). Waits the predicted gap, then Differs that digit. Cancels if the digit appears early (optional).'
            ),
            key_words: localize('increasing, gap, arithmetic, digit, differs, progression'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.increasing_digit_gap_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const enabled = read('ENABLED') || 'true';
    const min_gap = read('MIN_GAP') || '1';
    const max_gap = read('MAX_GAP') || '20';
    const min_common_diff = read('MIN_COMMON_DIFF') || '1';
    const max_common_diff = read('MAX_COMMON_DIFF') || '5';
    const gaps_required = read('GAPS_REQUIRED') || '3';
    const cancel_early = read('CANCEL_EARLY') || 'true';
    const cooldown = read('COOLDOWN') || '0';
    const max_trades = read('MAX_TRADES') || '0';
    const one_cycle = read('ONE_CYCLE') || 'true';
    const one_active = read('ONE_ACTIVE') || 'true';
    const journal = read('JOURNAL') || 'true';

    const code = `(function () {
        var BinaryBotPrivateIgResult = Bot.evaluateIncreasingDigitGap({
            enabled: ${enabled},
            min_gap: ${min_gap},
            max_gap: ${max_gap},
            min_common_diff: ${min_common_diff},
            max_common_diff: ${max_common_diff},
            gaps_required: ${gaps_required},
            cancel_early_appearance: ${cancel_early},
            cooldown_after_trade: ${cooldown},
            max_trades_per_session: ${max_trades},
            one_trade_per_cycle: ${one_cycle},
            one_active_trade_only: ${one_active},
            journal_enabled: ${journal}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateIgResult && BinaryBotPrivateIgResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 5 ? 5 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateIgResult
            ? Number(BinaryBotPrivateIgResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
