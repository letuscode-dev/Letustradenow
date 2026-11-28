import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['dpi_increase', 'Minimum Increase (percentage points)'],
    ['dpi_stake', 'Stake'],
    ['dpi_losses', 'Maximum Consecutive Losses'],
    ['dpi_target', 'Take Profit'],
    ['dpi_stop_loss', 'Stop Loss'],
    ['dpi_recovery', 'Recovery Multiplier (100 / 9.6)'],
];
const { v, num, set, chain } = blockHelpers(VARIABLES, 'dpi_message');
const INIT = chain([
    n => set('dpi_increase', num(0.1), n),
    n => set('dpi_stake', num(5), n),
    n => set('dpi_losses', num(2), n),
    n => set('dpi_target', num(10), n),
    n => set('dpi_stop_loss', num(50), n),
    () => set('dpi_recovery', num(100 / 9.6)),
]);

/** Loadable builder workspace for the Digit Percentage Increase bot. */
export const DIGIT_PERCENTAGE_INCREASE_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>${VARIABLES.map(([id, label]) => `<variable id="${id}">${label}</variable>`).join('')}</variables>
  <block type="trade_definition" id="dpi_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="dpi_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">1HZ75V</field>
        <next><block type="trade_definition_tradetype" id="dpi_type" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">matchesdiffers</field>
          <next><block type="trade_definition_contracttype" id="dpi_contract" deletable="false" movable="false">
            <field name="TYPE_LIST">DIGITDIFF</field>
            <next><block type="trade_definition_candleinterval" id="dpi_candle" deletable="false" movable="false">
              <field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="dpi_restart" deletable="false" movable="false">
                <field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="dpi_restart_error" deletable="false" movable="false">
                  <field name="RESTARTONERROR">FALSE</field>
                </block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">${INIT}</statement>
    <statement name="SUBMARKET"><block type="trade_definition_tradeoptions" id="dpi_options">
      <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
      <field name="DURATIONTYPE_LIST">t</field><value name="DURATION">${num(1)}</value>
      <value name="AMOUNT">${v('dpi_stake')}</value><value name="PREDICTION">${num(0)}</value>
    </block></statement>
  </block>
  <block type="before_purchase" id="dpi_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK"><block type="digit_percentage_increase_run">
      <value name="INCREASE">${v('dpi_increase')}</value><value name="STAKE">${v('dpi_stake')}</value><value name="LOSSES">${v('dpi_losses')}</value><value name="TARGET">${v('dpi_target')}</value><value name="STOP_LOSS">${v('dpi_stop_loss')}</value><value name="RECOVERY">${v('dpi_recovery')}</value>
    </block></statement>
  </block>
  <block type="after_purchase" id="dpi_after" x="900" y="60"></block>
</xml>`;
