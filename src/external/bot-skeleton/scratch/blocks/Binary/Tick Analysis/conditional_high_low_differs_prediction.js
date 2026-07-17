import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.conditional_high_low_differs_prediction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize(
                'conditional high/low Differs (on {{ enabled }}, filter {{ filter_on }}, window {{ window }}, mode {{ mode }}, threshold {{ threshold_type }}, count {{ count }}, percent {{ percent }}, most_freq {{ most_freq }}, min_app {{ min_app }}, share {{ share }}, confirmations {{ confirmations }}, age {{ age }}, source {{ source }}, journal {{ journal }}, dashboard {{ dashboard }})',
                {
                    enabled: '%1',
                    filter_on: '%2',
                    window: '%3',
                    mode: '%4',
                    threshold_type: '%5',
                    count: '%6',
                    percent: '%7',
                    most_freq: '%8',
                    min_app: '%9',
                    share: '%10',
                    confirmations: '%11',
                    age: '%12',
                    source: '%13',
                    journal: '%14',
                    dashboard: '%15',
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
                { type: 'input_value', name: 'MOST_FREQ', check: 'Boolean' },
                { type: 'input_value', name: 'MIN_APPEARANCES', check: 'Number' },
                { type: 'input_value', name: 'MIN_SHARE', check: 'Number' },
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
                'Combines a primary Digit Differs signal with a High/Low group confirmation filter before trading.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Conditional high/low prediction'),
            description: localize(
                'Requires both a primary digit signal and a passing High/Low distribution filter before returning a Differs digit.'
            ),
            key_words: localize('conditional, high, low, filter, differs, digit'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.conditional_high_low_differs_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const code = `(function () {
        var BinaryBotPrivateHlResult = Bot.evaluateConditionalHighLowDiffers({
            enabled: ${read('ENABLED') || 'true'},
            filter_enabled: ${read('FILTER_ON') || 'true'},
            analysis_window: ${read('WINDOW') || '10'},
            filter_mode: ${read('MODE') || '3'},
            threshold_type: ${read('THRESHOLD_TYPE') || '0'},
            dominant_group_count: ${read('COUNT') || '7'},
            dominance_percent: ${read('PERCENT') || '70'},
            require_most_frequent: ${read('MOST_FREQ') || 'true'},
            min_target_appearances: ${read('MIN_APPEARANCES') || '2'},
            min_target_group_share: ${read('MIN_SHARE') || '25'},
            required_confirmations: ${read('CONFIRMATIONS') || '1'},
            max_signal_age: ${read('MAX_AGE') || '2'},
            primary_signal_source: ${read('PRIMARY_SOURCE') || "'most_frequent'"},
            min_signal_score: 6,
            journal_enabled: ${read('JOURNAL') || 'true'},
            dashboard_enabled: ${read('DASHBOARD') || 'true'}
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateHlResult && BinaryBotPrivateHlResult.journal_messages;
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
        if (BinaryBotPrivateHlResult && BinaryBotPrivateHlResult.dashboard) {
            Bot.notify({
                className: 'journal__text',
                message: BinaryBotPrivateHlResult.dashboard,
                sound: 'silent',
                block_id: ${JSON.stringify(block.id)},
                variable_name: null
            });
        }
        var BinaryBotPrivatePrediction = BinaryBotPrivateHlResult
            ? Number(BinaryBotPrivateHlResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
