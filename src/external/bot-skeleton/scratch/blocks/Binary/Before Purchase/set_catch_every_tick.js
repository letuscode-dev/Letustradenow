/**
 * Free-bot tick speed. Not listed in the Blocks menu.
 * 1 analyses the tick already on screen. 0 waits for the next tick.
 */
import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.set_catch_every_tick = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Tick speed {{ mode }}', { mode: '%1' }),
            args0: [
                {
                    type: 'input_value',
                    name: 'ENABLED',
                    check: 'Number',
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('1 does not miss the current tick. 0 is normal speed and waits for the next tick.'),
        };
    },
    meta() {
        return {
            display_name: localize('Tick speed'),
            description: localize(
                '1 analyses every tick that is already on screen. 0 is normal speed and waits for the next tick before analysing again.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    getRequiredValueInputs() {
        return {
            ENABLED: null,
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.set_catch_every_tick = block => {
    const enabled =
        window.Blockly.JavaScript.javascriptGenerator.valueToCode(
            block,
            'ENABLED',
            window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
        ) || '0';

    return `Bot.setCatchEveryTick(${enabled});\n`;
};
