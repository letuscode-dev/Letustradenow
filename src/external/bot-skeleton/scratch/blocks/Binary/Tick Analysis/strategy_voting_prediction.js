import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

/** Keep in sync with strategy-voting-meta.js */
const STRATEGY_VOTING_META = [
    { id: 'digit_successor', label: 'Successor', default_weight: 1.5 },
    { id: 'complement_digit', label: 'Complement', default_weight: 1.2 },
    { id: 'digit_transition', label: 'Transition', default_weight: 1.0 },
    { id: 'cold_digit', label: 'Cold', default_weight: 2.0 },
    { id: 'least_frequent', label: 'Least freq', default_weight: 1.4 },
    { id: 'most_frequent', label: 'Most freq', default_weight: 1.0 },
    { id: 'streak_breaker', label: 'Streak', default_weight: 1.8 },
    { id: 'last_repeat', label: 'Repeat', default_weight: 1.3 },
    { id: 'absent_digit', label: 'Absent', default_weight: 1.6 },
    { id: 'second_last', label: '2nd last', default_weight: 0.9 },
    { id: 'parity_fade', label: 'Parity', default_weight: 1.1 },
    { id: 'edge_fade', label: 'Edge', default_weight: 1.0 },
    { id: 'oscillation', label: 'Oscillation', default_weight: 1.3 },
    { id: 'mid_range', label: 'Mid', default_weight: 1.0 },
    { id: 'rising_run', label: 'Rising', default_weight: 1.2 },
    { id: 'falling_run', label: 'Falling', default_weight: 1.2 },
    { id: 'unique_tail', label: 'Unique tail', default_weight: 1.1 },
    { id: 'modal_neighbor', label: 'Modal nbr', default_weight: 1.0 },
];

window.Blockly.Blocks.strategy_voting_prediction = {
    init() {
        this.jsonInit(this.definition());
        // Append strategy enable/weight inputs after the main row so jsonInit
        // is not overloaded with 45 message args (which breaks registration).
        STRATEGY_VOTING_META.forEach(meta => {
            this.appendValueInput(`EN_${meta.id}`)
                .setCheck('Boolean')
                .setAlign(window.Blockly.ALIGN_RIGHT)
                .appendField(`${meta.label} on`);
            this.appendValueInput(`WT_${meta.id}`)
                .setCheck('Number')
                .setAlign(window.Blockly.ALIGN_RIGHT)
                .appendField('wt');
        });
    },
    definition() {
        return {
            message0: localize(
                'strategy voting (on {{ enabled }}, window {{ window }}, conf {{ conf }}, minVoters {{ minVoters }}, maxAbstain {{ maxAbstain }}, journal {{ journal }}, summary {{ summary }}, tieReject {{ tieReject }}, debug {{ debug }})',
                {
                    enabled: '%1',
                    window: '%2',
                    conf: '%3',
                    minVoters: '%4',
                    maxAbstain: '%5',
                    journal: '%6',
                    summary: '%7',
                    tieReject: '%8',
                    debug: '%9',
                }
            ),
            args0: [
                { type: 'input_value', name: 'ENABLED', check: 'Boolean' },
                { type: 'input_value', name: 'TICK_WINDOW', check: 'Number' },
                { type: 'input_value', name: 'CONFIDENCE', check: 'Number' },
                { type: 'input_value', name: 'MIN_VOTERS', check: 'Number' },
                { type: 'input_value', name: 'MAX_ABSTAIN', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
                { type: 'input_value', name: 'VOTE_SUMMARY', check: 'Boolean' },
                { type: 'input_value', name: 'TIE_REJECTION', check: 'Boolean' },
                { type: 'input_value', name: 'DEBUG', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Runs independent Digit Differs strategies, aggregates weighted votes, and returns the winning digit when confidence clears the threshold.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
            inputsInline: false,
        };
    },
    meta() {
        return {
            display_name: localize('Strategy voting Differs prediction'),
            description: localize(
                'Evaluates many Digit Differs strategies each tick, weights their votes, and Differs the highest-confidence digit when thresholds are met.'
            ),
            key_words: localize('voting, strategy, differs, confidence, recovery'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.strategy_voting_prediction = block => {
    const read = name =>
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            name,
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        );

    const strategy_lines = STRATEGY_VOTING_META.map(meta => {
        const en = read(`EN_${meta.id}`) || 'true';
        const wt = read(`WT_${meta.id}`) || String(meta.default_weight);
        return `            ${JSON.stringify(meta.id)}: { enabled: ${en}, weight: ${wt} }`;
    }).join(',\n');

    const code = `(function () {
        var BinaryBotPrivateSvResult = Bot.evaluateStrategyVoting({
            enabled: ${read('ENABLED') || 'true'},
            tick_window: ${read('TICK_WINDOW') || '50'},
            confidence_threshold: ${read('CONFIDENCE') || '70'},
            min_voting_strategies: ${read('MIN_VOTERS') || '3'},
            max_abstaining_strategies: ${read('MAX_ABSTAIN') || '15'},
            journal_enabled: ${read('JOURNAL') || 'true'},
            vote_summary: ${read('VOTE_SUMMARY') || 'true'},
            confidence_display: true,
            tie_rejection: ${read('TIE_REJECTION') || 'true'},
            debug_mode: ${read('DEBUG') || 'false'},
            strategies: {
${strategy_lines}
            }
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivateSvResult && BinaryBotPrivateSvResult.journal_messages;
        if (BinaryBotPrivateMsgs && BinaryBotPrivateMsgs.length) {
            var BinaryBotPrivateMsgIndex;
            var BinaryBotPrivateMsgLimit = BinaryBotPrivateMsgs.length > 2 ? 2 : BinaryBotPrivateMsgs.length;
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
        var BinaryBotPrivatePrediction = BinaryBotPrivateSvResult
            ? Number(BinaryBotPrivateSvResult.prediction)
            : NaN;
        return !isNaN(BinaryBotPrivatePrediction) ? BinaryBotPrivatePrediction : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
