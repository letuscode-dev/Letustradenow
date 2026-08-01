import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
    DEFAULT_LOOKBACK,
    DEFAULT_MIN_CONFIDENCE,
    DEFAULT_MIN_OCCURRENCES,
    DEFAULT_PATTERN_LENGTH,
} from '../../../../services/tradeEngine/utils/pattern-probability-over-under';

const SIDE_OPTIONS = [
    [localize('Over'), 'OVER'],
    [localize('Under'), 'UNDER'],
    [localize('Both'), 'BOTH'],
];

const readArg = (block, name, fallback) => {
    const from_input = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        name,
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );
    if (from_input) {
        return from_input;
    }
    const from_field = block.getFieldValue(name);
    if (from_field !== null && from_field !== undefined && from_field !== '') {
        return String(from_field);
    }
    return String(fallback);
};

/**
 * Main signal block — returns the best Over and/or Under barrier, or -1 when filters reject.
 */
window.Blockly.Blocks.pattern_probability_over_under = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'pattern {{ side }} barrier (lookback {{ lookback }}, length {{ length }}, min occ {{ occ }}, min % {{ conf }}, journal {{ journal }})',
                {
                    side: '%1',
                    lookback: '%2',
                    length: '%3',
                    occ: '%4',
                    conf: '%5',
                    journal: '%6',
                }
            ),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'MARKET_SIDE',
                    options: SIDE_OPTIONS,
                },
                { type: 'input_value', name: 'LOOKBACK', check: 'Number' },
                { type: 'input_value', name: 'PATTERN_LENGTH', check: 'Number' },
                { type: 'input_value', name: 'MIN_OCCURRENCES', check: 'Number' },
                { type: 'input_value', name: 'MIN_CONFIDENCE', check: 'Number' },
                { type: 'input_value', name: 'JOURNAL', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Statistical pattern bot: score Over 1–5 and/or Under 8–4 from historical pattern matches. Choose Over, Under, or Both. Returns the best barrier (or -1). After a loss, Over 1 and Under 8 are skipped (low payout).'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Pattern probability Over/Under'),
            description: localize(
                'Looks up every past occurrence of the current digit pattern, builds a 0–9 frequency table, and picks the highest-probability Over and/or Under market — only when filters pass.'
            ),
            key_words: localize('pattern, probability, over, under, frequency, statistics, digits'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.pattern_probability_over_under = block => {
    const market_side = block.getFieldValue('MARKET_SIDE') || 'BOTH';
    const lookback = readArg(block, 'LOOKBACK', DEFAULT_LOOKBACK);
    const pattern_length = readArg(block, 'PATTERN_LENGTH', DEFAULT_PATTERN_LENGTH);
    const min_occurrences = readArg(block, 'MIN_OCCURRENCES', DEFAULT_MIN_OCCURRENCES);
    const min_confidence = readArg(block, 'MIN_CONFIDENCE', DEFAULT_MIN_CONFIDENCE);
    const journal = readArg(block, 'JOURNAL', 'true');

    const code = `(function () {
        var BinaryBotPrivatePatternOu = Bot.evaluatePatternProbabilityOverUnder({
            market_side: ${JSON.stringify(market_side)},
            lookback: ${lookback},
            pattern_length: ${pattern_length},
            min_occurrences: ${min_occurrences},
            min_confidence: ${min_confidence},
            journal_enabled: ${journal},
            multi_length_consensus: true
        });
        var BinaryBotPrivateMsgs = BinaryBotPrivatePatternOu && BinaryBotPrivatePatternOu.journal_messages;
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
        var BinaryBotPrivateBarrier = BinaryBotPrivatePatternOu
            ? Number(BinaryBotPrivatePatternOu.barrier)
            : NaN;
        return !isNaN(BinaryBotPrivateBarrier) ? BinaryBotPrivateBarrier : -1;
    })()`;

    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};

window.Blockly.Blocks.pattern_probability_is_over = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('pattern OU is Over'),
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Returns true when the latest pattern-probability signal is an Over contract. Use after the barrier block.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Pattern OU is Over'),
            description: localize('Reads the side from the last pattern-probability Over/Under evaluation.'),
            key_words: localize('pattern, over, under, side'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.pattern_probability_is_over = () => [
    'Bot.getPatternProbabilityIsOver()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
];

window.Blockly.Blocks.pattern_probability_confidence = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('pattern OU confidence'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Confidence score (0–100) from the latest pattern-probability evaluation.'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Pattern OU confidence'),
            description: localize('Returns the adaptive confidence score for the latest signal.'),
            key_words: localize('pattern, confidence, probability'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.pattern_probability_confidence = () => [
    'Bot.getPatternProbabilityConfidence()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL,
];
