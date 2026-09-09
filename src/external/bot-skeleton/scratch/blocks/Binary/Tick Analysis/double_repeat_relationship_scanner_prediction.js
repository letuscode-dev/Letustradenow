import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.double_repeat_relationship_scanner_prediction = {
    init() {
        this.jsonInit({
            message0: localize('Double-Repeat Relationship Scanner (window {{ window }}, confirmations {{ confirmations }}, reliability {{ reliability }}%, mode {{ mode }}, auto {{ auto }}, secondary {{ secondary }})'),
            args0: [
                { type: 'input_value', name: 'WINDOW', check: 'Number' },
                { type: 'input_value', name: 'CONFIRMATIONS', check: 'Number' },
                { type: 'input_value', name: 'RELIABILITY', check: 'Number' },
                { type: 'input_value', name: 'MODE' },
                { type: 'input_value', name: 'AUTO', check: 'Boolean' },
                { type: 'input_value', name: 'SECONDARY', check: 'Boolean' },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Tracks X → X → Y relationships independently, ranks reliable targets, and returns the selected Digit Differ prediction.'),
            category: window.Blockly.Categories.Tick_Analysis,
        });
    },
    meta() {
        return {
            display_name: localize('Double-Repeat Relationship Scanner'),
            description: localize('Learns, scores, and ranks independent double-repeat digit relationships.'),
            key_words: localize('double repeat, relationship, reliability, ranking, differs'),
        };
    },
    customContextMenu(menu) { modifyContextMenu(menu); },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.double_repeat_relationship_scanner_prediction = block => {
    const read = name => window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block, name, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );
    const code = `(function () {
        var BinaryBotPrivateDrrsResult = Bot.evaluateDoubleRepeatRelationshipScanner({
            tick_window: ${read('WINDOW') || '120'},
            minimum_confirmations: ${read('CONFIRMATIONS') || '2'},
            minimum_reliability: ${read('RELIABILITY') || '70'},
            signal_mode: ${read('MODE') || "'STRONGEST'"},
            secondary_analysis: ${read('SECONDARY') || 'false'}
        });
        var BinaryBotPrivateDrrsMsgs = BinaryBotPrivateDrrsResult && BinaryBotPrivateDrrsResult.journal_messages;
        if (BinaryBotPrivateDrrsMsgs && BinaryBotPrivateDrrsMsgs.length) {
            for (var BinaryBotPrivateDrrsIndex = 0; BinaryBotPrivateDrrsIndex < BinaryBotPrivateDrrsMsgs.length; BinaryBotPrivateDrrsIndex++) {
                var BinaryBotPrivateDrrsMsg = BinaryBotPrivateDrrsMsgs[BinaryBotPrivateDrrsIndex];
                Bot.notify({ className: BinaryBotPrivateDrrsMsg.className, message: BinaryBotPrivateDrrsMsg.message, sound: 'silent', block_id: ${JSON.stringify(block.id)}, variable_name: null });
            }
        }
        return BinaryBotPrivateDrrsResult && BinaryBotPrivateDrrsResult.allowed && ${read('AUTO') || 'true'}
            ? Number(BinaryBotPrivateDrrsResult.prediction) : -1;
    })()`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
