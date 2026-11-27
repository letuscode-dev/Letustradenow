/**
 * Start with Over. After any loss use Under and multiply the stake; after any
 * win reset the stake and return to Over. Take profit uses cumulative P/L.
 * Trade options are rebuilt after each result, before the next purchase.
 */
import { blockHelpers, callFunction, defineFunction } from './blocks';

const VARIABLES: [string, string][] = [
    ['ous_over', 'Over Prediction'],
    ['ous_under', 'Under Prediction'],
    ['ous_initial', 'Stake'],
    ['ous_multiplier', 'Martingale'],
    ['ous_target', 'Take Profit'],
    ['ous_amount', 'Current Stake'],
    ['ous_prediction', 'Active Prediction'],
    ['ous_is_under', 'Trade Under'],
    ['ous_profit', 'Last Profit'],
    ['ous_total', 'Total Profit'],
    ['ous_message', 'Journal Message'],
];

const { v, num, text, set, chain, arith, compare, notify } = blockHelpers(VARIABLES, 'ous_message');
const roundCurrency = (value: string) => `<block type="over_under_switch_round"><value name="VALUE">${value}</value></block>`;

const RESET_NAME = 'Reset Over Under Loss Switch';
const RESET = defineFunction(
    RESET_NAME,
    'ous_reset',
    chain([
        n => `<block type="set_catch_every_tick"><value name="ENABLED">${num(1)}</value><next>${n}</next></block>`,
        n => set('ous_amount', v('ous_initial'), n),
        n => set('ous_prediction', v('ous_over'), n),
        n => set('ous_is_under', num(0), n),
        n => set('ous_profit', num(0), n),
        () => set('ous_total', num(0)),
    ])
);

const INIT = chain([
    n => set('ous_over', num(2), n),
    n => set('ous_under', num(7), n),
    n => set('ous_initial', num(1), n),
    n => set('ous_multiplier', num(2), n),
    n => set('ous_target', num(10), n),
    () => callFunction(RESET_NAME, 'ous_reset_call'),
]);

const validateSettings = `<block type="over_under_switch_validate">
        <value name="OVER">${v('ous_over')}</value>
        <value name="UNDER">${v('ous_under')}</value>
        <value name="STAKE">${v('ous_initial')}</value>
        <value name="MULTIPLIER">${v('ous_multiplier')}</value>
        <value name="TARGET">${v('ous_target')}</value>
      </block>`;

const BEFORE_PURCHASE = `<block type="controls_if">
        <value name="IF0">${validateSettings}</value>
        <statement name="DO0"><block type="controls_if">
            <mutation else="1"></mutation>
            <value name="IF0">${compare('EQ', v('ous_is_under'), num(1))}</value>
            <statement name="DO0"><block type="over_under_switch_purchase"><field name="SIDE">DIGITUNDER</field></block></statement>
            <statement name="ELSE"><block type="over_under_switch_purchase"><field name="SIDE">DIGITOVER</field></block></statement>
          </block></statement>
      </block>`;

const ON_WIN = chain([
    n => set('ous_amount', v('ous_initial'), n),
    n => set('ous_prediction', v('ous_over'), n),
    () => set('ous_is_under', num(0)),
]);

const ON_LOSS = chain([
    n => set('ous_amount', roundCurrency(arith('MULTIPLY', '<block type="read_details"><field name="DETAIL_INDEX">2</field></block>', v('ous_multiplier'))), n),
    n => set('ous_prediction', v('ous_under'), n),
    () => set('ous_is_under', num(1)),
]);

const AFTER_PURCHASE = chain([
    n => set('ous_profit', '<block type="read_details"><field name="DETAIL_INDEX">4</field></block>', n),
    n => set('ous_total', roundCurrency(arith('ADD', v('ous_total'), v('ous_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        <next>${n}</next>
      </block>`,
    () => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('GTE', v('ous_total'), v('ous_target'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('ous_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`,
]);

export const OVER_UNDER_LOSS_SWITCH_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="ous_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ous_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next><block type="trade_definition_tradetype" id="ous_tradetype" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">digits</field>
          <field name="TRADETYPE_LIST">overunder</field>
          <next><block type="trade_definition_contracttype" id="ous_contract" deletable="false" movable="false">
            <field name="TYPE_LIST">both</field>
            <next><block type="trade_definition_candleinterval" id="ous_candle" deletable="false" movable="false">
              <field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="ous_restart" deletable="false" movable="false">
                <field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="ous_restart_err" deletable="false" movable="false">
                  <field name="RESTARTONERROR">FALSE</field>
                </block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">${INIT}</statement>
    <statement name="SUBMARKET"><block type="trade_definition_tradeoptions" id="ous_options">
      <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
      <field name="DURATIONTYPE_LIST">t</field>
      <value name="DURATION">${num(1)}</value>
      <value name="AMOUNT">${v('ous_amount')}</value>
      <value name="PREDICTION">${v('ous_prediction')}</value>
    </block></statement>
  </block>
  <block type="before_purchase" id="ous_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">${BEFORE_PURCHASE}</statement>
  </block>
  <block type="after_purchase" id="ous_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">${AFTER_PURCHASE}</statement>
  </block>
  ${RESET}
</xml>`;
