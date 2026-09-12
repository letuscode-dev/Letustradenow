/**
 * Shared Free Bot risk helper:
 * When "Martingale Off When Profit > Stake" is true and session total profit
 * exceeds Stake, loss recovery uses multiplier 1 instead of Martingale.
 */

export const PROTECT_PROFIT_VAR_NAME = 'Martingale Off When Profit > Stake';

/** Ternary multiplier: protect && total_profit > stake ? 1 : martingale */
export const protectedMartingaleMultiplierXml = ({
    protect_id,
    protect_name = PROTECT_PROFIT_VAR_NAME,
    stake_id,
    stake_name = 'Stake',
    martingale_id,
    martingale_name,
}: {
    protect_id: string;
    protect_name?: string;
    stake_id: string;
    stake_name?: string;
    martingale_id: string;
    martingale_name: string;
}) => `<block type="logic_ternary">
  <value name="IF">
    <block type="logic_operation"><field name="OP">AND</field>
      <value name="A"><block type="variables_get"><field name="VAR" id="${protect_id}">${protect_name}</field></block></value>
      <value name="B">
        <block type="logic_compare"><field name="OP">GT</field>
          <value name="A"><block type="total_profit"></block></value>
          <value name="B"><block type="variables_get"><field name="VAR" id="${stake_id}">${stake_name}</field></block></value>
        </block>
      </value>
    </block>
  </value>
  <value name="THEN"><block type="math_number"><field name="NUM">1</field></block></value>
  <value name="ELSE"><block type="variables_get"><field name="VAR" id="${martingale_id}">${martingale_name}</field></block></value>
</block>`;
