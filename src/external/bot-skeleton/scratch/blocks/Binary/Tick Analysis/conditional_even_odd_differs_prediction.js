import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.conditional_even_odd_differs_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'conditional even/odd Differs (on {{ enabled }}, filter {{ filter_on }}, window {{ window }}, mode {{ mode }}, threshold {{ threshold_type }}, count {{ count }}, percent {{ percent }}, confirmations {{ confirmations }}, age {{ age }}, source {{ source }}, journal {{ journal }}, dashboard {{ dashboard }})',
                {
                    enabled: '%1',
                    filter_on: '%2',
                    window: '%3',
                    mode: '%4',
                    threshold_type: '%5',
                    count: '%6',
                    percent: '%7',
                    confirmations: '%8',
                    age: '%9',
                    source: '%10',
                    journal: '%11',
                    dashboard: '%12',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'FILTER_ON', check: 'Boolean' },
                { type: 'input_value', name: 'WINDOW', check: 'Number' },
                { type: 'input_value', name: 'MODE', check: 'Number' },
                { type: 'input_value', name: 'THRESHOLD_TYPE', check: 'Number' },
                { type: 'input_value', name: 'COUNT', check: 'Number' },
                { type: 'input_value', name: 'PERCENT', check: 'Number' },
                { type: 'input_value', name: 'CONFIRMATIONS', check: 'Number' },
                { type: 'input_value', name: 'MAX_AGE', check: 'Number' },
                { type: 'input_value', name: 'PRIMARY_SOURCE', check: 'String' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
                { type: 'input_value', name: 'DASHBOARD', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Combines a primary Digit Differs signal with an even/odd parity confirmation filter before trading.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Conditional even/odd prediction'),
            description: localize(
                'Requires both a primary digit signal and a passing even/odd distribution filter before returning a Differs digit.'
            ),
            key_words: localize('conditional, even, odd, parity, filter, differs, digit'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.conditional_even_odd_differs_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateCeResult = Bot.evaluateConditionalEvenOddDiffers({
            enabled: ${read('ENABLED') || 'true'},
            filter_enabled: ${read('FILTER_ON') || 'true'},
            parity_window: ${read('WINDOW') || '10'},
            filter_mode: ${read('MODE') || '0'},
            threshold_type: ${read('THRESHOLD_TYPE') || '0'},
            matching_parity_count: ${read('COUNT') || '7'},
            matching_parity_percent: ${read('PERCENT') || '70'},
            required_confirmations: ${read('CONFIRMATIONS') || '1'},
            max_signal_age: ${read('MAX_AGE') || '2'},
            primary_signal_source: ${read('PRIMARY_SOURCE') || "'signal_score'"},
            min_signal_score: 6,
            journal_enabled: ${read('JOURNAL') || 'true'},
            dashboard_enabled: ${read('DASHBOARD') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateCeResult && BinaryBotPrivateCeResult.journal_messages;
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
        if (BinaryBotPrivateCeResult && BinaryBotPrivateCeResult.dashboard) {
            Bot.notify({
                className: 'journal__text',
                message: BinaryBotPrivateCeResult.dashboard,
                sound: 'silent',
                block_id: ${JSON.stringify(block.id)},
                variable_name: null
            });
        }
        var BinaryBotPrivatePrediction = BinaryBotPrivateCeResult
            ? Number(BinaryBotPrivateCeResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
