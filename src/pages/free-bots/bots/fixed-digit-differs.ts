import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['fdd_prediction', 'Prediction'],
    ['fdd_stake', 'Stake'],
    ['fdd_take_profit', 'Take Profit'],
    ['fdd_stop_loss', 'Stop Loss'],
];
const { v, num, set, chain } = blockHelpers(VARIABLES, 'fdd_message');
const INIT = chain([
    n => set('fdd_prediction', num(2), n),
    n => set('fdd_stake', num(1), n),
    n => set('fdd_take_profit', num(10), n),
    () => set('fdd_stop_loss', num(50)),
]);

export const FIXED_DIGIT_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>${VARIABLES.map(([id, label]) => `<variable id="${id}">${label}</variable>`).join('')}</variables>
  <block type="trade_definition" id="fixed_differs_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="fixed_differs_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">1HZ75V</field>
        <next><block type="trade_definition_tradetype" id="fixed_differs_type" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">matchesdiffers</field>
          <next><block type="trade_definition_contracttype" id="fixed_differs_contract" deletable="false" movable="false">
            <field name="TYPE_LIST">DIGITDIFF</field>
            <next><block type="trade_definition_candleinterval" id="fixed_differs_candle" deletable="false" movable="false">
              <field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="fixed_differs_restart" deletable="false" movable="false">
                <field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="fixed_differs_restart_error" deletable="false" movable="false">
                  <field name="RESTARTONERROR">FALSE</field>
                </block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">${INIT}</statement>
    <statement name="SUBMARKET"><block type="trade_definition_tradeoptions" id="fixed_differs_options">
      <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
      <field name="DURATIONTYPE_LIST">t</field><value name="DURATION">${num(1)}</value>
      <value name="AMOUNT">${v('fdd_stake')}</value><value name="PREDICTION">${v('fdd_prediction')}</value>
    </block></statement>
  </block>
  <block type="before_purchase" id="fixed_differs_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK"><block type="fixed_digit_differs_run">
      <value name="PREDICTION">${v('fdd_prediction')}</value><value name="STAKE">${v('fdd_stake')}</value>
      <value name="TAKE_PROFIT">${v('fdd_take_profit')}</value><value name="STOP_LOSS">${v('fdd_stop_loss')}</value>
    </block></statement>
  </block>
  <block type="after_purchase" id="fixed_differs_after" x="900" y="60"></block>
</xml>`;
