/**
 * Wrap non-essential Free Bot init settings in a collapsed Blockly stack.
 * Code still runs; users can expand if they need advanced knobs.
 */
export const wrapCollapsedAdvancedInit = (id: string, innerXml: string) =>
    `<block type="controls_if" id="${id}_advanced_init" collapsed="true">
      <value name="IF0"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
      <statement name="DO0">
${innerXml}
      </statement>
    </block>`;
