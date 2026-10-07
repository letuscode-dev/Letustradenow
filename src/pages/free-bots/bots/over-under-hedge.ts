/**
 * Over 5 / Under 4 hedge free bot (Volatility 75 (1s) Index).
 *
 * Buys Over 5 and Under 4 together when 4 and 5 dominate the last 5 ticks:
 * those two digits appear more often than every other digit combined. A tie
 * does not trade. A combined loss where both sides lose sets the next stake to
 * the stake that was bought, times the recovery multiplier. If one side wins,
 * the stake returns to the initial amount. A one-sided buy is not kept. An
 * unfinished hedge stops instead of betting again. Duration 1 tick.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['ouh_stake', 'Initial Stake'],
    ['ouh_multiplier', 'Recovery Multiplier'],
    ['ouh_duration', 'Duration (ticks)'],
    ['ouh_prediction', 'Over Barrier'],
    ['ouh_take_profit', 'Take Profit'],
    ['ouh_stop_loss', 'Stop Loss'],
    ['ouh_current', 'Current Stake'],
    ['ouh_total', 'Total Profit'],
    ['ouh_profit', 'Last Profit'],
    ['ouh_digits', 'Last Digits'],
    ['ouh_window', 'Ticks to Check'],
    ['ouh_i', 'i'],
    ['ouh_dead', '4 or 5 Count'],
    ['ouh_text', 'Journal Text'],
];

const { v, num, text, set, chain, arith, round2, compare, and, increment, fromEnd, countTo, notify } = blockHelpers(
    VARIABLES,
    'ouh_text'
);

const or = (a: string, b: string) =>
    `<block type="logic_operation"><field name="OP">OR</field><value name="A">${a}</value><value name="B">${b}</value></block>`;

/** 4 and 5 lose both sides of the hedge. */
const isDead = (digit: string) => or(compare('EQ', digit, num(4)), compare('EQ', digit, num(5)));

const listLength = `<block type="lists_length"><value name="VALUE">${v('ouh_digits')}</value></block>`;

const others = arith('MINUS', v('ouh_window'), v('ouh_dead'));

const countDead = (next: string) =>
    countTo(
        'ouh_i',
        v('ouh_window'),
        `<block type="controls_if">
            <value name="IF0">${isDead(fromEnd('ouh_digits', v('ouh_i')))}</value>
            <statement name="DO0">${increment('ouh_dead')}</statement>
          </block>`,
        next
    );

const BUY = `<block type="digit_hedge_purchase"></block>`;

const ANALYSE = chain([
    n => set('ouh_digits', `<block type="lastDigitList"></block>`, n),
    n => set('ouh_dead', num(0), n),
    countDead,
    () => `<block type="controls_if">
        <value name="IF0">${and(
            and(compare('GTE', v('ouh_window'), num(1)), compare('GTE', listLength, v('ouh_window'))),
            compare('GT', v('ouh_dead'), others)
        )}</value>
        <statement name="DO0">${notify(
            'success',
            [
                text('Hedge | last'),
                v('ouh_window'),
                text('| 4 or 5 x'),
                v('ouh_dead'),
                text('| stake'),
                v('ouh_current'),
            ],
            BUY
        )}</statement>
      </block>`,
]);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('ouh_total'), v('ouh_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('ouh_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('ouh_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('ouh_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('ouh_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const NOTE_WIN = notify('success', [
    text('WIN | net'),
    v('ouh_profit'),
    text('| stake back to'),
    v('ouh_current'),
    text('| P/L'),
    v('ouh_total'),
]);

const NOTE_LOSS = notify('warn', [
    text('LOSS | net'),
    v('ouh_profit'),
    text('| next stake'),
    v('ouh_current'),
    text('| P/L'),
    v('ouh_total'),
]);

const NEXT_STAKE = `<block type="digit_hedge_next_stake">
    <value name="CURRENT">${v('ouh_current')}</value>
    <value name="INITIAL">${v('ouh_stake')}</value>
    <value name="MULTIPLIER">${v('ouh_multiplier')}</value>
  </block>`;

const CONTINUES = `<block type="digit_hedge_continues"></block>`;
const DECISION = `<block type="digit_hedge_decision"></block>`;

const STOP = notify('error', [
    text('Hedge did not finish on both sides — stopped so the stake is not changed'),
]);

const AFTER_PURCHASE = chain([
    n => set('ouh_profit', `<block type="digit_hedge_result"></block>`, n),
    n => set('ouh_total', round2(arith('ADD', v('ouh_total'), v('ouh_profit'))), n),
    n => set('ouh_current', NEXT_STAKE, n),
    () => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${CONTINUES}</value>
        <statement name="DO0">
          <block type="controls_if">
            <mutation else="1"></mutation>
            <value name="IF0">${compare('EQ', DECISION, num(1))}</value>
            <statement name="DO0">${NOTE_WIN}</statement>
            <statement name="ELSE">${NOTE_LOSS}</statement>
            <next>${LIMITS}</next>
          </block>
        </statement>
        <statement name="ELSE">${STOP}</statement>
      </block>`,
]);

const INIT = chain([
    n => set('ouh_stake', num(1), n),
    n => set('ouh_multiplier', num(2), n),
    n => set('ouh_duration', num(1), n),
    n => set('ouh_window', num(5), n),
    n => set('ouh_prediction', num(5), n),
    n => set('ouh_take_profit', num(10), n),
    n => set('ouh_stop_loss', num(50), n),
    n => set('ouh_current', v('ouh_stake'), n),
    n => set('ouh_total', num(0), n),
    () => set('ouh_profit', num(0)),
]);

export const OVER_UNDER_HEDGE_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="ouh_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ouh_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="ouh_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="ouh_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITOVER</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ouh_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="ouh_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="ouh_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="ouh_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('ouh_duration')}</value>
        <value name="AMOUNT">${v('ouh_current')}</value>
        <value name="PREDICTION">${v('ouh_prediction')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="ouh_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${ANALYSE}
    </statement>
  </block>
  <block type="after_purchase" id="ouh_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
