/**
 * Over/Under frequency free bot (Volatility 75 (1s) Index).
 *
 * Each signal scans the last Ticks (default 1,000). The most frequent digit
 * chooses the contract. Even trades Over 2, and a loss switches that signal to
 * Over 3. Odd trades Under 7, and a loss switches that signal to Under 6.
 * The entry digit is the least frequent digit in the same even or odd group.
 * Ties keep the lower digit. The first trade of the signal waits for that
 * entry digit. Later trades buy immediately. After Runs trades the bot scans
 * again.
 *
 * The purchase reads the stake and barrier captured when the cycle starts, so
 * a new signal refreshes those options before it buys. Every tick already on
 * screen is analysed. The next stake after a loss is the accumulated loss
 * divided by the payout percent (default 60), rounded up to the next cent.
 * At 60% a $1 loss becomes $1.67. A win clears the loss, returns Stake to
 * Initial Stake, and restores that signal's before-loss barrier. Duration is
 * 1 tick. The run stops at Take Profit or Stop Loss.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['ouf_ticks', 'Ticks'],
    ['ouf_runs', 'Runs'],
    ['ouf_left', 'Runs Left'],
    ['ouf_dominant', 'Most Frequent'],
    ['ouf_entry', 'Entry Point'],
    ['ouf_entered', 'Entry Used'],
    ['ouf_pred_before', 'Prediction before loss'],
    ['ouf_pred_after', 'Prediction after loss'],
    ['ouf_prediction', 'Active Prediction'],
    ['ouf_initial', 'Initial Stake'],
    ['ouf_stake', 'Stake'],
    ['ouf_lost', 'Amount Lost'],
    ['ouf_payout', 'Payout %'],
    ['ouf_take_profit', 'Take Profit'],
    ['ouf_stop_loss', 'Stop Loss'],
    ['ouf_total', 'Total Profit'],
    ['ouf_profit', 'Last Profit'],
    ['ouf_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, notify } = blockHelpers(VARIABLES, 'ouf_msg');

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

/** Amount lost ÷ (payout% / 100). At 60% a $1 loss becomes $1.67. */
const recoveryBase = roundUp2(arith('DIVIDE', v('ouf_lost'), arith('DIVIDE', v('ouf_payout'), num(100))));

const lastDigit = () => `<block type="last_digit"></block>`;
const scan = () => `<block type="over_under_frequency_scan"><value name="N">${v('ouf_ticks')}</value></block>`;
const parityEntry = () => `<block type="over_under_frequency_entry"></block>`;
const parityDominant = () => `<block type="over_under_frequency_dominant"></block>`;
const modulo = (dividend: string, divisor: string) =>
    `<block type="math_modulo"><value name="DIVIDEND">${dividend}</value><value name="DIVISOR">${divisor}</value></block>`;
const dominantIsEven = () => compare('EQ', modulo(v('ouf_dominant'), num(2)), num(0));

/** 1 analyses the tick already on screen instead of waiting for the next one. */
const setSpeed = (n = '') => `<block type="set_catch_every_tick">
        <value name="ENABLED">${num(1)}</value>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

const INIT = chain([
    n => setSpeed(n),
    n => set('ouf_ticks', num(1000), n),
    n => set('ouf_runs', num(5), n),
    n => set('ouf_left', num(0), n),
    n => set('ouf_dominant', num(-1), n),
    n => set('ouf_entry', num(-1), n),
    n => set('ouf_entered', num(0), n),
    n => set('ouf_pred_before', num(2), n),
    n => set('ouf_pred_after', num(3), n),
    n => set('ouf_prediction', v('ouf_pred_before'), n),
    n => set('ouf_initial', num(1), n),
    n => set('ouf_stake', v('ouf_initial'), n),
    n => set('ouf_lost', num(0), n),
    n => set('ouf_payout', num(60), n),
    n => set('ouf_take_profit', num(10), n),
    n => set('ouf_stop_loss', num(50), n),
    n => set('ouf_total', num(0), n),
]);

const BUY_UNDER = `<block type="purchase"><field name="PURCHASE_LIST">DIGITUNDER</field></block>`;
const BUY_OVER = `<block type="purchase"><field name="PURCHASE_LIST">DIGITOVER</field></block>`;

const sideMessage = (side: string) => [text(side), v('ouf_prediction'), text('| stake'), v('ouf_stake')];

/** Mark the one-time entry only on the purchase that uses it. */
const buy = (sideName: string, purchase: string) =>
    set('ouf_entered', num(1), notify('info', sideMessage(sideName), purchase));

/** 5 or higher is Under. 4 or lower is Over. */
const side = () => `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${compare('GTE', v('ouf_prediction'), num(5))}</value>
        <statement name="DO0">${buy('UNDER', BUY_UNDER)}</statement>
        <value name="IF1">${compare('LTE', v('ouf_prediction'), num(4))}</value>
        <statement name="DO1">${buy('OVER', BUY_OVER)}</statement>
      </block>`;

const barriers = (before: number, after: number) =>
    set(
        'ouf_pred_before',
        num(before),
        set('ouf_pred_after', num(after), set('ouf_prediction', v('ouf_pred_before')))
    );

const scanNotify = (n = '') => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${dominantIsEven()}</value>
        <statement name="DO0">${notify('info', [
            text('Scan | most'),
            v('ouf_dominant'),
            text('| entry'),
            v('ouf_entry'),
            text('| Over'),
            v('ouf_pred_before'),
            text('| runs'),
            v('ouf_left'),
        ])}</statement>
        <statement name="ELSE">${notify('info', [
            text('Scan | most'),
            v('ouf_dominant'),
            text('| entry'),
            v('ouf_entry'),
            text('| Under'),
            v('ouf_pred_before'),
            text('| runs'),
            v('ouf_left'),
        ])}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

/** Even → Over 2, then Over 3 after a loss. Odd → Under 7, then Under 6 after a loss. */
const chooseBarriers = (n = '') => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${dominantIsEven()}</value>
        <statement name="DO0">${barriers(2, 3)}</statement>
        <statement name="ELSE">${barriers(7, 6)}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

/** A non-positive Runs value still places one trade so the signal is not stuck. */
const applySignal = (n = '') =>
    set(
        'ouf_dominant',
        parityDominant(),
        set(
            'ouf_entry',
            parityEntry(),
            set(
                'ouf_entered',
                num(0),
                set(
                    'ouf_left',
                    v('ouf_runs'),
                    `<block type="controls_if">
        <value name="IF0">${compare('LT', v('ouf_left'), num(1))}</value>
        <statement name="DO0">${set('ouf_left', num(1))}</statement>
        <next>${chooseBarriers(scanNotify(n))}</next>
      </block>`
                )
            )
        )
    );

const REFRESH = `<block type="refresh_trade_options"></block>`;

/**
 * Runs Left is 0 until a scan is ready. The entry digit is required only for
 * the first trade of that signal. Refresh runs after the new barrier is stored
 * so the purchase uses Over 2 / Under 7 (or the recovery barrier) rather than
 * the previous cycle's barrier.
 */
const BEFORE_PURCHASE = chain([
    n => `<block type="controls_if">
        <value name="IF0">${compare('LTE', v('ouf_left'), num(0))}</value>
        <statement name="DO0"><block type="controls_if">
            <value name="IF0">${compare('EQ', scan(), num(1))}</value>
            <statement name="DO0">${applySignal(REFRESH)}</statement>
          </block></statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => `<block type="controls_if">
        <value name="IF0">${compare('GT', v('ouf_left'), num(0))}</value>
        <statement name="DO0"><block type="controls_if">
            <mutation else="1"></mutation>
            <value name="IF0">${compare('EQ', v('ouf_entered'), num(0))}</value>
            <statement name="DO0"><block type="controls_if">
                <value name="IF0">${compare('EQ', lastDigit(), v('ouf_entry'))}</value>
                <statement name="DO0">${side()}</statement>
              </block></statement>
            <statement name="ELSE">${side()}</statement>
          </block></statement>
      </block>`,
]);

const ON_WIN = set(
    'ouf_lost',
    num(0),
    set(
        'ouf_stake',
        v('ouf_initial'),
        set(
            'ouf_prediction',
            v('ouf_pred_before'),
            notify('success', [
                text('WIN | profit'),
                v('ouf_profit'),
                text('| next stake'),
                v('ouf_stake'),
                text('| prediction'),
                v('ouf_prediction'),
                text('| P/L'),
                v('ouf_total'),
            ])
        )
    )
);

const lossNotify = notify('warn', [
    text('LOSS | lost'),
    v('ouf_lost'),
    text('| payout'),
    v('ouf_payout'),
    text('% | next stake'),
    v('ouf_stake'),
    text('| prediction'),
    v('ouf_prediction'),
    text('| P/L'),
    v('ouf_total'),
]);

/** Next stake is only the loss divided by the payout percent. An invalid payout or a stake below the initial stake stays at the initial stake. */
const ON_LOSS = set(
    'ouf_lost',
    round2(arith('ADD', v('ouf_lost'), abs(v('ouf_profit')))),
    set(
        'ouf_stake',
        recoveryBase,
        set(
            'ouf_prediction',
            v('ouf_pred_after'),
            `<block type="controls_if">
            <value name="IF0">${compare('LTE', v('ouf_payout'), num(0))}</value>
            <statement name="DO0">${set('ouf_stake', v('ouf_initial'))}</statement>
            <next>
              <block type="controls_if">
                <value name="IF0">${compare('LT', v('ouf_stake'), v('ouf_initial'))}</value>
                <statement name="DO0">${set('ouf_stake', v('ouf_initial'))}</statement>
                <next>${lossNotify}</next>
              </block>
            </next>
          </block>`
        )
    )
);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('ouf_total'), v('ouf_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('ouf_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('ouf_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('ouf_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('ouf_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('ouf_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('ouf_total', round2(arith('ADD', v('ouf_total'), v('ouf_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    n => set('ouf_left', arith('MINUS', v('ouf_left'), num(1)), n),
    () => LIMITS,
]);

export const OVER_UNDER_FREQUENCY_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="ouf_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ouf_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="ouf_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="ouf_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ouf_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="ouf_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="ouf_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="ouf_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('ouf_stake')}</value>
        <value name="PREDICTION">${v('ouf_prediction')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="ouf_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="ouf_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
