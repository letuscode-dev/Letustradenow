import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['thc_stake', 'Stake'],
    ['thc_losses', 'Maximum Consecutive Losses'],
    ['thc_target', 'Profit Threshold'],
    ['thc_recovery', 'Recovery Multiplier (100 / 9.6)'],
];
const { v, num, set, chain } = blockHelpers(VARIABLES, 'thc_message');
const INIT = chain([
    n => set('thc_stake', num(5), n),
    n => set('thc_losses', num(2), n),
    n => set('thc_target', num(10), n),
    () => set('thc_recovery', num(100 / 9.6)),
]);

/** Loadable builder workspace for the Triple-Hit Concentration bot. */
export const TRIPLE_HIT_CONCENTRATION_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>${VARIABLES.map(([id, label]) => `<variable id="${id}">${label}</variable>`).join('')}</variables>
  <block type="trade_definition" id="thc_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="thc_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">1HZ75V</field>
        <next><block type="trade_definition_tradetype" id="thc_type" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">matchesdiffers</field>
          <next><block type="trade_definition_contracttype" id="thc_contract" deletable="false" movable="false">
            <field name="TYPE_LIST">DIGITDIFF</field>
            <next><block type="trade_definition_candleinterval" id="thc_candle" deletable="false" movable="false">
              <field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="thc_restart" deletable="false" movable="false">
                <field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="thc_restart_error" deletable="false" movable="false">
                  <field name="RESTARTONERROR">FALSE</field>
                </block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">${INIT}</statement>
    <statement name="SUBMARKET"><block type="trade_definition_tradeoptions" id="thc_options">
      <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
      <field name="DURATIONTYPE_LIST">t</field><value name="DURATION">${num(1)}</value>
      <value name="AMOUNT">${v('thc_stake')}</value><value name="PREDICTION">${num(0)}</value>
    </block></statement>
  </block>
  <block type="before_purchase" id="thc_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK"><block type="triple_hit_concentration_run">
      <value name="STAKE">${v('thc_stake')}</value><value name="LOSSES">${v('thc_losses')}</value><value name="TARGET">${v('thc_target')}</value><value name="RECOVERY">${v('thc_recovery')}</value>
    </block></statement>
  </block>
  <block type="after_purchase" id="thc_after" x="900" y="60"></block>
</xml>`;
