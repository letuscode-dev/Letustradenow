/** A collapsed custom function. The body is generated; the user does not configure it. */
export const defineFunction = (name: string, id: string, stack: string) =>
    `<block type="procedures_defnoreturn" id="${id}" collapsed="true" x="720" y="700"><mutation></mutation><field name="NAME">${name}</field><statement name="STACK">${stack}</statement></block>`;

/** Call a custom function. `name` must match the definition. */
export const callFunction = (name: string, id: string, n = '') =>
    `<block type="procedures_callnoreturn" id="${id}"><mutation name="${name}"></mutation>${
        n ? `<next>${n}</next>` : ''
    }</block>`;

/** Small XML builders for free bots made from standard Bot Builder blocks. */
export const blockHelpers = (variables: [string, string][], message_var: string) => {
    const name = (id: string) => variables.find(([vid]) => vid === id)![1];
    const v = (id: string) => `<block type="variables_get"><field name="VAR" id="${id}">${name(id)}</field></block>`;
    const num = (n: number) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
    const text = (s: string) => `<block type="text"><field name="TEXT">${s}</field></block>`;
    const next = (n: string) => (n ? `<next>${n}</next>` : '');

    const set = (id: string, value: string, n = '') =>
        `<block type="variables_set"><field name="VAR" id="${id}">${name(id)}</field><value name="VALUE">${value}</value>${next(
            n
        )}</block>`;

    const chain = (blocks: ((n: string) => string)[]) => blocks.reduceRight((n, block) => block(n), '');

    const arith = (op: string, a: string, b: string) =>
        `<block type="math_arithmetic"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${b}</value></block>`;

    /** round(x × 100) / 100 — Deriv accepts at most 2 decimals. */
    const round2 = (x: string) =>
        arith(
            'DIVIDE',
            `<block type="math_round"><field name="OP">ROUND</field><value name="NUM">${arith(
                'MULTIPLY',
                x,
                num(100)
            )}</value></block>`,
            num(100)
        );

    const compare = (op: string, a: string, b: string) =>
        `<block type="logic_compare"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${b}</value></block>`;

    const and = (a: string, b: string) =>
        `<block type="logic_operation"><field name="OP">AND</field><value name="A">${a}</value><value name="B">${b}</value></block>`;

    const increment = (id: string) => set(id, arith('ADD', v(id), num(1)));

    /** Item `at` counted from the end of list variable `list_id` (1 = latest). */
    const fromEnd = (list_id: string, at: string) =>
        `<block type="lists_getIndex"><mutation statement="false" at="true"></mutation><field name="MODE">GET</field><field name="WHERE">FROM_END</field><value name="VALUE">${v(
            list_id
        )}</value><value name="AT">${at}</value></block>`;

    /** count with `var_id` from 1 to `to` by 1. */
    const countTo = (var_id: string, to: string, body: string, n = '') => `<block type="controls_for">
        <field name="VAR" id="${var_id}">${name(var_id)}</field>
        <value name="FROM">${num(1)}</value>
        <value name="TO">${to}</value>
        <value name="BY">${num(1)}</value>
        <statement name="DO">${body}</statement>
        ${next(n)}
      </block>`;

    /** Joins `parts` with spaces into the message variable, then shows it in the journal. */
    const notify = (type: string, parts: string[], n = '') => {
        const stack = parts.reduceRight(
            (inner, part) =>
                `<block type="text_statement" movable="false"><value name="TEXT">${part}</value>${next(inner)}</block>`,
            ''
        );
        return `<block type="text_join"><field name="VARIABLE" id="${message_var}">${name(
            message_var
        )}</field><statement name="STACK">${stack}</statement><next><block type="notify"><field name="NOTIFICATION_TYPE">${type}</field><field name="NOTIFICATION_SOUND">silent</field><value name="MESSAGE">${v(
            message_var
        )}</value>${next(n)}</block></next></block>`;
    };

    return { name, v, num, text, set, chain, arith, round2, compare, and, increment, fromEnd, countTo, notify };
};
