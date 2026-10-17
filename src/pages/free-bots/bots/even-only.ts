/**
 * Odd-only free bot (Volatility 75 (1s) Index).
 *
 * Buys Odd only when the last 2 digits are both odd. Tick speed is 1, so every
 * Deriv tick already on screen is analysed and none is skipped. A loss
 * multiplies Amount by Martingale (default 2). A win returns Amount to Stake.
 * The candle interval is 2 hours. Duration is 1 tick. The run stops at Take
 * Profit or Stop Loss.
 */

import { blockHelpers, callFunction, defineFunction } from './blocks';

const VARIABLES: [string, string][] = [
    ['eve_stake', 'Stake'],
    ['eve_amount', 'Amount'],
    ['eve_martingale', 'Martingale'],
    ['eve_take_profit', 'Take Profit'],
    ['eve_stop_loss', 'Stop Loss'],
    ['eve_total', 'Total Profit'],
    ['eve_profit', 'Last Profit'],
    ['eve_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, notify } = blockHelpers(VARIABLES, 'eve_msg');

/** 1 analyses the tick already on screen instead of waiting for the next one. */
const setSpeed = (n = '') => `<block type="set_catch_every_tick">
        <value name="ENABLED">${num(1)}</value>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

const RESET_NAME = 'Reset Odd Only';

/** Live stake and profit total. The user does not set these. */
const RESET = defineFunction(
    RESET_NAME,
    'eve_reset_fn',
    chain([
        n => setSpeed(n),
        n => set('eve_amount', v('eve_stake'), n),
        () => set('eve_total', num(0)),
    ])
);

const INIT = chain([
    n => set('eve_stake', num(1), n),
    n => set('eve_martingale', num(2), n),
    n => set('eve_take_profit', num(10), n),
    n => set('eve_stop_loss', num(50), n),
    () => callFunction(RESET_NAME, 'eve_reset_call'),
]);

const buyOdd = notify(
    'info',
    [text('Odd'), text('| stake'), v('eve_amount')],
    `<block type="purchase"><field name="PURCHASE_LIST">DIGITODD</field></block>`
);

/** Both of the last 2 digits are odd. */
const BEFORE_PURCHASE = `<block type="last_digits_odd_even_condition" id="eve_gate">
        <field name="TICK_COUNT0">2</field>
        <field name="PARITY0">ODD</field>
        <statement name="DO0">${buyOdd}</statement>
      </block>`;

const ON_WIN = set(
    'eve_amount',
    v('eve_stake'),
    notify('success', [
        text('WIN | profit'),
        v('eve_profit'),
        text('| next stake'),
        v('eve_amount'),
        text('| P/L'),
        v('eve_total'),
    ])
);

const lossNotify = notify('warn', [
    text('LOSS | martingale'),
    v('eve_martingale'),
    text('| next stake'),
    v('eve_amount'),
    text('| P/L'),
    v('eve_total'),
]);

/** Next amount is the current amount times the martingale. A non-positive martingale stays at Stake. */
const ON_LOSS = set(
    'eve_amount',
    round2(arith('MULTIPLY', v('eve_amount'), v('eve_martingale'))),
    `<block type="controls_if">
        <value name="IF0">${compare('LTE', v('eve_martingale'), num(0))}</value>
        <statement name="DO0">${set('eve_amount', v('eve_stake'))}</statement>
        <next>${lossNotify}</next>
      </block>`
);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('eve_total'), v('eve_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('eve_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('eve_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('eve_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('eve_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('eve_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('eve_total', round2(arith('ADD', v('eve_total'), v('eve_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => LIMITS,
]);

export const EVEN_ONLY_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="eve_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="eve_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="eve_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">evenodd</field>
            <next>
              <block type="trade_definition_contracttype" id="eve_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITODD</field>
                <next>
                  <block type="trade_definition_candleinterval" id="eve_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">7200</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="eve_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="eve_restart_err" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      ${INIT}
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="eve_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('eve_amount')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="eve_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="eve_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
  ${RESET}
</xml>`;
