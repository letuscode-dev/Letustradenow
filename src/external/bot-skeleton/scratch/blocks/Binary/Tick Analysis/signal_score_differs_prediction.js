import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.signal_score_differs_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'signal score Differs (on {{ enabled }}, min score {{ min_score }}, freq window {{ freq_window }}, recent window {{ recent_window }}, absence {{ absence }}, spike {{ spike_recent }}/{{ spike_hist }}, gaps {{ min_gap }}-{{ max_gap }}, journal {{ journal }}, dashboard {{ dashboard }})',
                {
                    enabled: '%1',
                    min_score: '%2',
                    freq_window: '%3',
                    recent_window: '%4',
                    absence: '%5',
                    spike_recent: '%6',
                    spike_hist: '%7',
                    min_gap: '%8',
                    max_gap: '%9',
                    journal: '%10',
                    dashboard: '%11',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_SCORE', check: 'Number' },
                { type: 'input_value', name: 'FREQ_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'RECENT_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'ABSENCE_THRESHOLD', check: 'Number' },
                { type: 'input_value', name: 'SPIKE_RECENT', check: 'Number' },
                { type: 'input_value', name: 'SPIKE_HIST', check: 'Number' },
                { type: 'input_value', name: 'MIN_GAP', check: 'Number' },
                { type: 'input_value', name: 'MAX_GAP', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
                { type: 'input_value', name: 'DASHBOARD', check: 'Boolean' },
            ],
            message1: localize(
                'scores MF {{ mf_score }} RG {{ rg_score }} RD {{ rd_score }} FS {{ fs_score }} LA {{ la_score }} | toggles MF {{ mf_on }} RG {{ rg_on }} RD {{ rd_on }} FS {{ fs_on }} LA {{ la_on }} | cooldown {{ cooldown }} max {{ max_trades }} 1 active {{ one_active }}',
                {
                    mf_score: '%1',
                    rg_score: '%2',
                    rd_score: '%3',
                    fs_score: '%4',
                    la_score: '%5',
                    mf_on: '%6',
                    rg_on: '%7',
                    rd_on: '%8',
                    fs_on: '%9',
                    la_on: '%10',
                    cooldown: '%11',
                    max_trades: '%12',
                    one_active: '%13',
                }
            ),
            args1: [
                { type: 'input_value', name: 'MF_SCORE', check: 'Number' },
                { type: 'input_value', name: 'RG_SCORE', check: 'Number' },
                { type: 'input_value', name: 'RD_SCORE', check: 'Number' },
                { type: 'input_value', name: 'FS_SCORE', check: 'Number' },
                { type: 'input_value', name: 'LA_SCORE', check: 'Number' },
                { type: 'input_value', name: 'MF_ON', check: 'Boolean' },
                { type: 'input_value', name: 'RG_ON', check: 'Boolean' },
                { type: 'input_value', name: 'RD_ON', check: 'Boolean' },
                { type: 'input_value', name: 'FS_ON', check: 'Boolean' },
                { type: 'input_value', name: 'LA_ON', check: 'Boolean' },
                { type: 'input_value', name: 'COOLDOWN', check: 'Number' },
                { type: 'input_value', name: 'MAX_TRADES', check: 'Number' },
                { type: 'input_value', name: 'ONE_ACTIVE', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Scores each digit 0–9 from modular conditions. Returns the digit for Differs when total score meets your minimum.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Signal score prediction'),
            description: localize(
                'Combines Most Frequent, Repeated Gap, Recent Double, Frequency Spike, and Long Absence scores per digit. Trades the highest scorer at or above your minimum.'
            ),
            key_words: localize('signal, score, differs, digit, modular, frequency, gap'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.signal_score_differs_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateSsResult = Bot.evaluateSignalScoreDiffers({
            enabled: ${read('ENABLED') || 'true'},
            min_signal_score: ${read('MIN_SCORE') || '6'},
            frequency_window: ${read('FREQ_WINDOW') || '30'},
            recent_appearance_window: ${read('RECENT_WINDOW') || '5'},
            long_absence_threshold: ${read('ABSENCE_THRESHOLD') || '30'},
            spike_recent_window: ${read('SPIKE_RECENT') || '10'},
            spike_historical_window: ${read('SPIKE_HIST') || '50'},
            min_gap: ${read('MIN_GAP') || '1'},
            max_gap: ${read('MAX_GAP') || '20'},
            most_frequent_score: ${read('MF_SCORE') || '2'},
            repeated_gap_score: ${read('RG_SCORE') || '3'},
            recent_double_score: ${read('RD_SCORE') || '2'},
            frequency_spike_score: ${read('FS_SCORE') || '2'},
            long_absence_score: ${read('LA_SCORE') || '-1'},
            most_frequent_enabled: ${read('MF_ON') || 'true'},
            repeated_gap_enabled: ${read('RG_ON') || 'true'},
            recent_double_enabled: ${read('RD_ON') || 'true'},
            frequency_spike_enabled: ${read('FS_ON') || 'true'},
            long_absence_enabled: ${read('LA_ON') || 'true'},
            cooldown_after_trade: ${read('COOLDOWN') || '0'},
            max_trades_per_session: ${read('MAX_TRADES') || '0'},
            one_active_trade_only: ${read('ONE_ACTIVE') || 'true'},
            journal_enabled: ${read('JOURNAL') || 'true'},
            dashboard_enabled: ${read('DASHBOARD') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateSsResult && BinaryBotPrivateSsResult.journal_messages;
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
        if (BinaryBotPrivateSsResult && BinaryBotPrivateSsResult.dashboard) {
            Bot.notify({
                className: 'journal__text',
                message: BinaryBotPrivateSsResult.dashboard,
                sound: 'silent',
                block_id: ${JSON.stringify(block.id)},
                variable_name: null
            });
        }
        var BinaryBotPrivatePrediction = BinaryBotPrivateSsResult
            ? Number(BinaryBotPrivateSsResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
