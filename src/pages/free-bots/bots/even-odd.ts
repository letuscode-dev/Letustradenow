/**
 * Even/Odd frequency free bot (Volatility 75 (1s) Index).
 *
 * Each signal scans the last Ticks (default 1,000). The most frequent digit
 * chooses the opposite contract: even trades Odd, odd trades Even. The entry
 * digit is the least frequent digit in that same even or odd group. Ties keep
 * the lower digit. The first trade of the signal waits for that entry digit.
 * Later trades in the signal buy immediately. After Runs trades the bot scans
 * again. Every tick already on screen is analysed. A loss multiplies Amount by
 * Martingale (default 1.5). A win returns Amount to Stake. Duration is 1 tick.
 */

import { blockHelpers, callFunction, defineFunction } from './blocks';

const VARIABLES: [string, string][] = [
    ['evo_ticks', 'Ticks'],
    ['evo_runs', 'Runs'],
    ['evo_left', 'Runs Left'],
    ['evo_dominant', 'Most Frequent'],
    ['evo_entry', 'Entry Point'],
    ['evo_entered', 'Entry Used'],
    ['evo_side', 'Trade Odd'],
    ['evo_stake', 'Stake'],
    ['evo_amount', 'Amount'],
    ['evo_martingale', 'Martingale'],
    ['evo_take_profit', 'Take Profit'],
    ['evo_stop_loss', 'Stop Loss'],
    ['evo_total', 'Total Profit'],
    ['evo_profit', 'Last Profit'],
    ['evo_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, notify } = blockHelpers(VARIABLES, 'evo_msg');

const lastDigit = () => `<block type="last_digit"></block>`;
const scan = () => `<block type="even_odd_parity_scan"><value name="N">${v('evo_ticks')}</value></block>`;
const parityEntry = () => `<block type="even_odd_parity_entry"></block>`;
const paritySide = () => `<block type="even_odd_parity_side"></block>`;
const parityDominant = () => `<block type="even_odd_parity_dominant"></block>`;

/** 1 analyses the tick already on screen instead of waiting for the next one. */
const setSpeed = (n = '') => `<block type="set_catch_every_tick">
        <value name="ENABLED">${num(1)}</value>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

const RESET_NAME = 'Reset Even Odd';

/** Scan counters, the computed entry, and the live stake. The user does not set these. */
const RESET = defineFunction(
    RESET_NAME,
    'evo_reset_fn',
    chain([
        n => setSpeed(n),
        n => set('evo_left', num(0), n),
        n => set('evo_dominant', num(-1), n),
        n => set('evo_entry', num(-1), n),
        n => set('evo_entered', num(0), n),
        n => set('evo_side', num(-1), n),
        n => set('evo_amount', v('evo_stake'), n),
        () => set('evo_total', num(0)),
    ])
);

const INIT = chain([
    n => set('evo_ticks', num(1000), n),
    n => set('evo_runs', num(5), n),
    n => set('evo_stake', num(1), n),
    n => set('evo_martingale', num(1.5), n),
    n => set('evo_take_profit', num(10), n),
    n => set('evo_stop_loss', num(50), n),
    () => callFunction(RESET_NAME, 'evo_reset_call'),
]);

const purchase = (contract: string) =>
    `<block type="purchase"><field name="PURCHASE_LIST">${contract}</field></block>`;

/** Trade Odd is 1 for Odd and 0 for Even. */
const buySide = () => `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${compare('EQ', v('evo_side'), num(1))}</value>
        <statement name="DO0">${notify(
            'info',
            [text('Odd'), text('| stake'), v('evo_amount')],
            purchase('DIGITODD')
        )}</statement>
        <value name="IF1">${compare('EQ', v('evo_side'), num(0))}</value>
        <statement name="DO1">${notify(
            'info',
            [text('Even'), text('| stake'), v('evo_amount')],
            purchase('DIGITEVEN')
        )}</statement>
      </block>`;

const scanNotify = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('EQ', v('evo_side'), num(1))}</value>
        <statement name="DO0">${notify('info', [
            text('Scan | most'),
            v('evo_dominant'),
            text('| entry'),
            v('evo_entry'),
            text('| trade Odd | runs'),
            v('evo_left'),
        ])}</statement>
        <statement name="ELSE">${notify('info', [
            text('Scan | most'),
            v('evo_dominant'),
            text('| entry'),
            v('evo_entry'),
            text('| trade Even | runs'),
            v('evo_left'),
        ])}</statement>
      </block>`;

/** A non-positive Runs value still places one trade so the signal is not stuck. */
const applySignal = set(
    'evo_dominant',
    parityDominant(),
    set(
        'evo_entry',
        parityEntry(),
        set(
            'evo_side',
            paritySide(),
            set(
                'evo_entered',
                num(0),
                set(
                    'evo_left',
                    v('evo_runs'),
                    `<block type="controls_if">
        <value name="IF0">${compare('LT', v('evo_left'), num(1))}</value>
        <statement name="DO0">${set('evo_left', num(1))}</statement>
        <next>${scanNotify}</next>
      </block>`
                )
            )
        )
    )
);

/**
 * Runs Left is 0 until a scan is ready, then it counts the trades still owed
 * by that signal. The entry digit is required only for the first of those trades.
 */
const BEFORE_PURCHASE = chain([
    n => `<block type="controls_if">
        <value name="IF0">${compare('LTE', v('evo_left'), num(0))}</value>
        <statement name="DO0"><block type="controls_if">
            <value name="IF0">${compare('EQ', scan(), num(1))}</value>
            <statement name="DO0">${applySignal}</statement>
          </block></statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => `<block type="controls_if">
        <value name="IF0">${compare('GT', v('evo_left'), num(0))}</value>
        <statement name="DO0"><block type="controls_if">
            <mutation else="1"></mutation>
            <value name="IF0">${compare('EQ', v('evo_entered'), num(0))}</value>
            <statement name="DO0"><block type="controls_if">
                <value name="IF0">${compare('EQ', lastDigit(), v('evo_entry'))}</value>
                <statement name="DO0">${set('evo_entered', num(1), buySide())}</statement>
              </block></statement>
            <statement name="ELSE">${buySide()}</statement>
          </block></statement>
      </block>`,
]);

const ON_WIN = set(
    'evo_amount',
    v('evo_stake'),
    notify('success', [
        text('WIN | profit'),
        v('evo_profit'),
        text('| next stake'),
        v('evo_amount'),
        text('| P/L'),
        v('evo_total'),
    ])
);

const lossNotify = notify('warn', [
    text('LOSS | martingale'),
    v('evo_martingale'),
    text('| next stake'),
    v('evo_amount'),
    text('| P/L'),
    v('evo_total'),
]);

/** Next amount is the current amount times the martingale. A non-positive martingale stays at Stake. */
const ON_LOSS = set(
    'evo_amount',
    round2(arith('MULTIPLY', v('evo_amount'), v('evo_martingale'))),
    `<block type="controls_if">
        <value name="IF0">${compare('LTE', v('evo_martingale'), num(0))}</value>
        <statement name="DO0">${set('evo_amount', v('evo_stake'))}</statement>
        <next>${lossNotify}</next>
      </block>`
);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('evo_total'), v('evo_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('evo_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('evo_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('evo_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('evo_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('evo_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('evo_total', round2(arith('ADD', v('evo_total'), v('evo_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    n => set('evo_left', arith('MINUS', v('evo_left'), num(1)), n),
    () => LIMITS,
]);

export const EVEN_ODD_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="evo_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="evo_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="evo_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">evenodd</field>
            <next>
              <block type="trade_definition_contracttype" id="evo_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="evo_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="evo_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="evo_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="evo_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('evo_amount')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="evo_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="evo_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
  ${RESET}
</xml>`;
