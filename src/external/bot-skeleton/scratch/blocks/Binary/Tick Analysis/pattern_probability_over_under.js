import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import {
    DEFAULT_LOOKBACK,
    DEFAULT_MIN_CONFIDENCE,
    DEFAULT_MIN_OCCURRENCES,
    DEFAULT_PATTERN_LENGTH,
} from '../../../../services/tradeEngine/utils/pattern-probability-over-under';

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
 * Main signal block — returns the best Over/Under barrier, or -1 when filters reject.
 * Journal lines explain pattern, frequencies, and the trade / no-trade reason.
 */
window.Blockly.Blocks.pattern_probability_over_under = {
    init() {
        this.jsonInit(this.definition());
        this.setInputsInline(true);
    },
    definition() {
        return {
            message0: localize(
                'pattern OU barrier (lookback {{ lookback }}, length {{ length }}, min occ {{ occ }}, min % {{ conf }}, journal {{ journal }})',
                {
                    lookback: '%1',
                    length: '%2',
                    occ: '%3',
                    conf: '%4',
                    journal: '%5',
                }
            ),
            args0: [
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
                'Statistical Over/Under: find historical matches of the current digit pattern, score Over 1–5 and Under 8–4, return the best barrier (or -1). Only trades with enough matches, confidence, and edge vs theory.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Pattern probability Over/Under'),
            description: localize(
                'Looks up every past occurrence of the current 1–5 digit pattern in the lookback window, builds a 0–9 frequency table of what followed, and picks the Over/Under market with the highest historical probability — only when filters pass.'
            ),
            key_words: localize('pattern, probability, over, under, frequency, statistics, digits'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.pattern_probability_over_under = block => {
    const lookback = readArg(block, 'LOOKBACK', DEFAULT_LOOKBACK);
    const pattern_length = readArg(block, 'PATTERN_LENGTH', DEFAULT_PATTERN_LENGTH);
    const min_occurrences = readArg(block, 'MIN_OCCURRENCES', DEFAULT_MIN_OCCURRENCES);
    const min_confidence = readArg(block, 'MIN_CONFIDENCE', DEFAULT_MIN_CONFIDENCE);
    const journal = readArg(block, 'JOURNAL', 'true');

    const code = `(function () {
        var BinaryBotPrivatePatternOu = Bot.evaluatePatternProbabilityOverUnder({
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

/**
 * True when the last pattern-OU evaluation selected an Over market.
 * Call after the barrier block so both share the tip snapshot.
 */
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

/**
 * Confidence score (0–100) from the last pattern-OU evaluation.
 */
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
