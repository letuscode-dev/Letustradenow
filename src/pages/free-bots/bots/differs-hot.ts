/**
 * Hot-digit Differs free bot (Volatility 75 (1s) Index).
 *
 * Percentages use the last Ticks (default 1,000). That window is requested at
 * once when it is not already loaded, then each new tick updates the counts.
 * The most frequent digit is the Differs barrier when it is missing from the
 * newest Absent Ticks (default 2). Ties keep the lower digit. Every tick
 * already on screen is analysed. A loss sets the next stake so the profit at
 * the payout percent, split across Recovery Runs wins (default 1), pays back
 * the money still lost. At 9.6% a $1 loss recovered in 1 run becomes $10.42.
 * Duration is 1 tick.
 */

import { blockHelpers, callFunction, defineFunction } from './blocks';

const VARIABLES: [string, string][] = [
    ['dif_ticks', 'Ticks'],
    ['dif_absent', 'Absent Ticks'],
    ['dif_stake', 'Stake'],
    ['dif_payout', 'Payout %'],
    ['dif_runs', 'Recovery Runs'],
    ['dif_amount', 'Amount'],
    ['dif_lost', 'Lost'],
    ['dif_splits', 'Splits Left'],
    ['dif_prediction', 'Prediction'],
    ['dif_take_profit', 'Take Profit'],
    ['dif_stop_loss', 'Stop Loss'],
    ['dif_total', 'Total Profit'],
    ['dif_profit', 'Last Profit'],
    ['dif_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, notify } = blockHelpers(VARIABLES, 'dif_msg');

const abs = (x: string) =>
    `<block type="math_single"><field name="OP">ABS</field><value name="NUM">${x}</value></block>`;

/** ceil(x × 100) / 100 — a nearest-cent round can leave the win short of the loss. */
const roundUp2 = (x: string) =>
    arith(
        'DIVIDE',
        `<block type="math_round"><field name="OP">ROUNDUP</field><value name="NUM">${arith(
            'MULTIPLY',
            x,
            num(100)
        )}</value></block>`,
        num(100)
    );

/**
 * (lost / splits) / (payout% / 100). One run at 9.6% turns a $1 loss into $10.42.
 */
const recoveryStake = roundUp2(
    arith('DIVIDE', arith('DIVIDE', v('dif_lost'), v('dif_splits')), arith('DIVIDE', v('dif_payout'), num(100)))
);

const scan = () => `<block type="differs_hot_scan">
        <value name="N">${v('dif_ticks')}</value>
        <value name="GAP">${v('dif_absent')}</value>
      </block>`;

const hotDigit = () => `<block type="differs_hot_digit"></block>`;

/** 1 analyses the tick already on screen instead of waiting for the next one. */
const setSpeed = (n = '') => `<block type="set_catch_every_tick">
        <value name="ENABLED">${num(1)}</value>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

const RESET_NAME = 'Reset Hot Digit Differs';

/** Live stake, loss, and the digit the scan chooses. The user does not set these. */
const RESET = defineFunction(
    RESET_NAME,
    'dif_reset_fn',
    chain([
        n => setSpeed(n),
        n => set('dif_amount', v('dif_stake'), n),
        n => set('dif_lost', num(0), n),
        n => set('dif_splits', num(0), n),
        n => set('dif_prediction', num(0), n),
        () => set('dif_total', num(0)),
    ])
);

const INIT = chain([
    n => set('dif_ticks', num(1000), n),
    n => set('dif_absent', num(2), n),
    n => set('dif_stake', num(1), n),
    n => set('dif_payout', num(9.6), n),
    n => set('dif_runs', num(1), n),
    n => set('dif_take_profit', num(10), n),
    n => set('dif_stop_loss', num(50), n),
    () => callFunction(RESET_NAME, 'dif_reset_call'),
]);

const floorStake = (n = '') => `<block type="controls_if">
        <value name="IF0">${compare('LTE', v('dif_payout'), num(0))}</value>
        <statement name="DO0">${set('dif_amount', v('dif_stake'))}</statement>
        <next>
          <block type="controls_if">
            <value name="IF0">${compare('LT', v('dif_amount'), v('dif_stake'))}</value>
            <statement name="DO0">${set('dif_amount', v('dif_stake'))}</statement>
            ${n ? `<next>${n}</next>` : ''}
          </block>
        </next>
      </block>`;

const applyRecoveryStake = (n = '') => set('dif_amount', recoveryStake, floorStake(n));

/**
 * The scan writes the barrier onto the trade that is already open for this
 * tick, then the purchase is sent. Trade setup is not started again.
 */
const BEFORE_PURCHASE = `<block type="controls_if" id="dif_gate">
        <value name="IF0">${compare('EQ', scan(), num(1))}</value>
        <statement name="DO0">${set(
            'dif_prediction',
            hotDigit(),
            `<block type="purchase"><field name="PURCHASE_LIST">DIGITDIFF</field></block>`
        )}</statement>
      </block>`;

const winNotify = notify('success', [
    text('WIN | digit'),
    v('dif_prediction'),
    text('| profit'),
    v('dif_profit'),
    text('| next stake'),
    v('dif_amount'),
    text('| lost left'),
    v('dif_lost'),
    text('| P/L'),
    v('dif_total'),
]);

const lossNotify = notify('warn', [
    text('LOSS | lost'),
    v('dif_lost'),
    text('| payout'),
    v('dif_payout'),
    text('% | runs'),
    v('dif_splits'),
    text('| next stake'),
    v('dif_amount'),
    text('| P/L'),
    v('dif_total'),
]);

/** A win that covers the lost amount returns to Stake. A short win keeps the remainder. */
const ON_WIN = set(
    'dif_lost',
    round2(arith('MINUS', v('dif_lost'), v('dif_profit'))),
    `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('LTE', v('dif_lost'), num(0))}</value>
        <statement name="DO0">${set('dif_lost', num(0), set('dif_splits', num(0), set('dif_amount', v('dif_stake'))))}</statement>
        <statement name="ELSE">${set(
            'dif_splits',
            arith('MINUS', v('dif_splits'), num(1)),
            `<block type="controls_if">
                <value name="IF0">${compare('LT', v('dif_splits'), num(1))}</value>
                <statement name="DO0">${set('dif_splits', num(1))}</statement>
                <next>${applyRecoveryStake()}</next>
              </block>`
        )}</statement>
        <next>${winNotify}</next>
      </block>`
);

/** Next stake recovers the lost amount across Recovery Runs wins. */
const ON_LOSS = set(
    'dif_lost',
    round2(arith('ADD', v('dif_lost'), abs(v('dif_profit')))),
    set(
        'dif_splits',
        v('dif_runs'),
        `<block type="controls_if">
            <value name="IF0">${compare('LT', v('dif_splits'), num(1))}</value>
            <statement name="DO0">${set('dif_splits', num(1))}</statement>
            <next>${applyRecoveryStake(lossNotify)}</next>
          </block>`
    )
);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('dif_total'), v('dif_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('dif_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('dif_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('dif_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('dif_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('dif_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('dif_total', round2(arith('ADD', v('dif_total'), v('dif_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => LIMITS,
]);

export const DIFFERS_HOT_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="dif_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="dif_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="dif_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="dif_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="dif_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="dif_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="dif_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="dif_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('dif_amount')}</value>
        <value name="PREDICTION">${v('dif_prediction')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="dif_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="dif_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
  ${RESET}
</xml>`;
