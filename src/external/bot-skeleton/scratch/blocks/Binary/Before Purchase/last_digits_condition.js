import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';
import { minusIconDark, plusIconDark } from '../../images';

const MIN_TICK_COUNT = 1;
const MAX_TICK_COUNT = 1000;

const DIGIT_OPTIONS = Array.from({ length: 10 }, (_, digit) => [String(digit), String(digit)]);

const OPERATOR_OPTIONS = [
    ['>', 'GT'],
    ['\u2265', 'GTE'],
    ['<', 'LT'],
    ['\u2264', 'LTE'],
    ['=', 'EQ'],
    ['\u2260', 'NEQ'],
];

const OPERATOR_CODE = {
    GT: '>',
    GTE: '>=',
    LT: '<',
    LTE: '<=',
    EQ: '===',
    NEQ: '!==',
};

const createTickCountField = () => new window.Blockly.FieldNumber(1, MIN_TICK_COUNT, MAX_TICK_COUNT, 1);
const createOperatorField = () => new window.Blockly.FieldDropdown(OPERATOR_OPTIONS);
const createDigitField = () => new window.Blockly.FieldDropdown(DIGIT_OPTIONS);

const getTickCount = (block, index) => {
    const value = Math.floor(Number(block.getFieldValue(`TICK_COUNT${index}`)));

    if (!Number.isFinite(value)) {
        return MIN_TICK_COUNT;
    }

    return Math.min(MAX_TICK_COUNT, Math.max(MIN_TICK_COUNT, value));
};

const getConditionCode = (block, index) => {
    const tick_count = getTickCount(block, index);
    const operator = OPERATOR_CODE[block.getFieldValue(`OPERATOR${index}`)] || OPERATOR_CODE.EQ;
    const digit = Number(block.getFieldValue(`DIGIT${index}`));

    return `(function () {
            var BinaryBotPrivateLastDigits = Bot.getLastDigitList();
            var BinaryBotPrivateTickCount = ${tick_count};
            var BinaryBotPrivateTargetDigit = ${digit};
            if (!BinaryBotPrivateLastDigits || BinaryBotPrivateLastDigits.length < BinaryBotPrivateTickCount) {
                return false;
            }
            return BinaryBotPrivateLastDigits.slice(-BinaryBotPrivateTickCount).every(function (BinaryBotPrivateDigit) {
                BinaryBotPrivateDigit = Number(BinaryBotPrivateDigit);
                return BinaryBotPrivateDigit ${operator} BinaryBotPrivateTargetDigit;
            });
        })()`;
};

window.Blockly.Blocks.last_digits_condition = {
    init() {
        this.statement_connections = [null];
        this.else_statement_connection = null;
        this.condition_values = [];
        this.else_if_count = 0;
        this.else_count = 0;
        this.jsonInit(this.definition());
        this.updateShape();
    },
    definition() {
        return {
            message0: localize('if last {{ tick_count }} digit(s) are {{ operator }} {{ digit }} then', {
                tick_count: '%1',
                operator: '%2',
                digit: '%3',
            }),
            message1: '%1',
            message2: '%1',
            args0: [
                {
                    type: 'field_number',
                    name: 'TICK_COUNT0',
                    value: 1,
                    min: MIN_TICK_COUNT,
                    max: MAX_TICK_COUNT,
                    precision: 1,
                },
                {
                    type: 'field_dropdown',
                    name: 'OPERATOR0',
                    options: OPERATOR_OPTIONS,
                },
                {
                    type: 'field_dropdown',
                    name: 'DIGIT0',
                    options: DIGIT_OPTIONS,
                },
            ],
            args1: [
                {
                    type: 'field_image',
                    src: ' ',
                    width: 150,
                    height: 1,
                },
            ],
            args2: [
                {
                    type: 'input_statement',
                    name: 'DO0',
                },
            ],
            inputsInline: true,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            previousStatement: null,
            nextStatement: null,
            tooltip: localize(
                'Runs the branch when every one of the last selected tick digits matches the comparison.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Last digit condition'),
            description: localize(
                'Use this Purchase conditions block to check whether all of the last n tick digits are greater than, greater than or equal to, less than, less than or equal to, equal to, or not equal to a selected digit. It updates on each new tick and cannot be used in Run once at start.'
            ),
            key_words: localize('last digit, digits, tick, comparison, over, under, matches, differs'),
        };
    },
    mutationToDom() {
        const container = document.createElement('mutation');

        if (this.else_if_count) {
            container.setAttribute('elseif', this.else_if_count);
        }

        if (this.else_count) {
            container.setAttribute('else', 1);
        }

        return container;
    },
    domToMutation(xmlElement) {
        this.else_if_count = parseInt(xmlElement.getAttribute('elseif')) || 0;
        this.else_count = parseInt(xmlElement.getAttribute('else')) || 0;
        this.rebuildShape();
    },
    rebuildShape() {
        const statement_connections = [null];
        const else_statement_connection = this.getInput('ELSE')?.connection?.targetConnection || null;
        const condition_values = this.getConditionValues();

        let i = 1;
        while (this.getInput(this.getIfInputNames(i).DO)) {
            const input_names = this.getIfInputNames(i);
            const do_input = this.getInput(input_names.DO);

            statement_connections.push(do_input.connection.targetConnection);
            i++;
        }

        this.updateShape();
        this.restoreConditionValues(condition_values);
        this.reconnectChildBlocks(statement_connections, else_statement_connection);
    },
    update(updateFn) {
        window.Blockly.Events.setGroup(true);

        const old_mutation_dom = this.mutationToDom();
        const old_mutation = old_mutation_dom && window.Blockly.Xml.domToText(old_mutation_dom);
        const is_rendered = this.rendered;

        this.rendered = false;

        if (updateFn) {
            updateFn.call(this);
        }

        this.updateShape();
        this.restoreConditionValues();
        this.rendered = is_rendered;
        this.initSvg();

        const group = window.Blockly.Events.getGroup();
        const new_mutation_dom = this.mutationToDom();
        const new_mutation = new_mutation_dom && window.Blockly.Xml.domToText(new_mutation_dom);

        if (old_mutation !== new_mutation) {
            const change_event = new window.Blockly.Events.BlockChange(
                this,
                'mutation',
                null,
                old_mutation,
                new_mutation
            );
            window.Blockly.Events.fire(change_event);

            setTimeout(() => {
                window.Blockly.Events.setGroup(group);
                this.bumpNeighbours();
                window.Blockly.Events.setGroup(false);
            }, window.Blockly.BUMP_DELAY);
        }

        if (this.rendered) {
            this.renderEfficiently();
        }

        window.Blockly.Events.setGroup(false);
    },
    updateShape() {
        if (this.getInput('ELSE')) {
            this.removeInput('ELSE');
            this.removeInput('ELSE_LABEL');
            this.removeInput('DELETE_ELSE');
        }

        let i = 1;
        while (this.getInput(this.getIfInputNames(i).DO)) {
            const input_names = this.getIfInputNames(i);

            this.removeInput(input_names.IF);
            this.removeInput(input_names.DELETE_ICON);
            this.removeInput(input_names.DO);
            i++;
        }

        if (this.getInput('MUTATOR')) {
            this.removeInput('MUTATOR');
        }

        for (let j = 1; j <= this.else_if_count; j++) {
            const input_names = this.getIfInputNames(j);
            const removeElseIf = () => this.modifyElseIf(false, j);

            this.appendDummyInput(input_names.IF)
                .appendField(localize('else if last'))
                .appendField(createTickCountField(), `TICK_COUNT${j}`)
                .appendField(localize('digit(s) are'))
                .appendField(createOperatorField(), `OPERATOR${j}`)
                .appendField(createDigitField(), `DIGIT${j}`)
                .appendField(localize('then'));
            this.appendDummyInput(input_names.DELETE_ICON).appendField(
                new window.Blockly.FieldImage(minusIconDark, 24, 24, '-', removeElseIf)
            );
            this.appendStatementInput(input_names.DO);
        }

        if (this.else_count > 0) {
            const removeElse = () => this.modifyElse(false);
            this.appendDummyInput('ELSE_LABEL').appendField(localize('else'));
            this.appendDummyInput('DELETE_ELSE').appendField(
                new window.Blockly.FieldImage(minusIconDark, 24, 24, '-', removeElse, false)
            );
            this.appendStatementInput('ELSE');
        }

        const addElseIf = () => {
            if (this.else_count === 0) {
                this.modifyElse(true);
            } else {
                this.modifyElseIf(true);
            }
        };

        this.appendDummyInput('MUTATOR').appendField(
            new window.Blockly.FieldImage(plusIconDark, 24, 24, '+', addElseIf, false)
        );

        this.initSvg();
        this.queueRender();
    },
    getConditionValue(index) {
        return {
            tick_count: this.getFieldValue(`TICK_COUNT${index}`),
            operator: this.getFieldValue(`OPERATOR${index}`),
            digit: this.getFieldValue(`DIGIT${index}`),
        };
    },
    getConditionValues(arg = 0) {
        const condition_values = [];

        for (let i = 1; i <= this.else_if_count; i++) {
            if (arg !== i && this.getField(`TICK_COUNT${i}`)) {
                condition_values.push(this.getConditionValue(i));
            }
        }

        return condition_values;
    },
    restoreConditionValues(opt_condition_values) {
        const condition_values = opt_condition_values || this.condition_values || [];

        condition_values.forEach((condition, index) => {
            const field_index = index + 1;

            if (condition && this.getField(`TICK_COUNT${field_index}`)) {
                this.setFieldValue(condition.tick_count || String(MIN_TICK_COUNT), `TICK_COUNT${field_index}`);
                this.setFieldValue(condition.operator || 'GT', `OPERATOR${field_index}`);
                this.setFieldValue(condition.digit || '0', `DIGIT${field_index}`);
            }
        });
    },
    storeConnections(arg = 0) {
        this.statement_connections = [null];
        this.else_statement_connection = null;
        this.condition_values = this.getConditionValues(arg);

        for (let i = 1; i <= this.else_if_count; i++) {
            if (arg !== i) {
                const input_names = this.getIfInputNames(i);
                const do_input = this.getInput(input_names.DO);

                this.statement_connections.push(do_input.connection.targetConnection);
            }
        }

        const else_input = this.getInput('ELSE');

        if (else_input) {
            this.else_statement_connection = else_input.connection.targetConnection;
        }
    },
    reconnectChildBlocks(opt_statement_conns, opt_else_statement_conns) {
        const statement_connections = opt_statement_conns ?? this.statement_connections;
        const else_statement_connection = opt_else_statement_conns ?? this.else_statement_connection;

        for (let i = 1; i <= this.else_if_count; i++) {
            const input_names = this.getIfInputNames(i);
            const statement_connection = statement_connections[i];
            const do_input = this.getInput(input_names.DO);

            if (statement_connection && do_input) {
                do_input.connection.disconnect();
                do_input.connection.connect(statement_connection);
            }
        }

        const else_input = this.getInput('ELSE');
        if (else_statement_connection && else_input) {
            else_input.connection.disconnect();
            else_input.connection.connect(else_statement_connection);
        }
    },
    modifyElse(is_add) {
        const update = () => {
            this.else_count += is_add ? 1 : -1;
        };

        this.storeConnections();
        this.update(update);
        this.reconnectChildBlocks();
    },
    modifyElseIf(is_add, opt_idx) {
        this.storeConnections(opt_idx);

        const update = () => {
            this.else_if_count += is_add ? 1 : -1;
        };

        this.update(update);
        this.reconnectChildBlocks();
    },
    getIfInputNames: idx => ({
        IF: `IF${idx}`,
        DELETE_ICON: `DELETE_ICON${idx}`,
        DO: `DO${idx}`,
    }),
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_digits_condition = block => {
    let n = 0;
    let code = '';

    do {
        const condition = getConditionCode(block, n);
        const keyword = n > 0 ? 'else if' : 'if';
        code += `
        ${keyword} (${condition}) {
            ${window.Blockly.JavaScript.javascriptGenerator.statementToCode(block, `DO${n}`)}
        }`;
        n++;
    } while (block.getInput(`DO${n}`));

    if (block.getInput('ELSE')) {
        code += `
        else {
            ${window.Blockly.JavaScript.javascriptGenerator.statementToCode(block, 'ELSE')}
        }`;
    }

    return `${code}\n`;
};
