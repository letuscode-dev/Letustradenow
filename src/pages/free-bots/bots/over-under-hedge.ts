/**
 * Over 5 / Under 4 hedge free bot (Volatility 75 (1s) Index).
 *
 * Buys an Over barrier and an Under barrier together. Both are digits from
 * 0 to 9. They default to Over 5 and Under 4, which lose together on 4 and 5.
 * The hedge enters when those losing digits dominate the last 5 ticks.
 * The check uses the ticks already in memory. Immediate Loss Hedge is an
 * option: 1 buys the next Over 5 and Under 4 hedge as soon as both sides lose,
 * without another digit check. 0 waits for the digit check again. A combined
 * loss sets the next stake to the stake that was bought, times the recovery
 * multiplier. If one side wins, the stake returns to the initial amount. A
 * one-sided buy is not kept. The two sides are kept only when they share the
 * same entry tick and the same exit tick. An unfinished hedge stops instead of betting
 * again. Take profit and stop loss use the combined profit of both sides, and
 * a reached limit sends no further trade. Duration 1 tick.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['ouh_stake', 'Initial Stake'],
    ['ouh_multiplier', 'Recovery Multiplier'],
    ['ouh_duration', 'Duration (ticks)'],
    ['ouh_prediction', 'Over Barrier'],
    ['ouh_under', 'Under Barrier'],
    ['ouh_take_profit', 'Take Profit'],
    ['ouh_stop_loss', 'Stop Loss'],
    ['ouh_current', 'Current Stake'],
    ['ouh_total', 'Total Profit'],
    ['ouh_profit', 'Last Profit'],
    ['ouh_window', 'Ticks to Check'],
    ['ouh_immediate', 'Immediate Loss Hedge'],
    ['ouh_text', 'Journal Text'],
];

const { v, num, text, set, chain, compare, notify } = blockHelpers(VARIABLES, 'ouh_text');

const BUY = `<block type="digit_hedge_purchase"><value name="OVER">${v('ouh_prediction')}</value><value name="UNDER">${v('ouh_under')}</value></block>`;

const RECOVERY_BUY = notify(
    'warn',
    [text('Loss hedge | no analysis | Over'), v('ouh_prediction'), text('+ Under'), v('ouh_under'), text('| stake'), v('ouh_current')],
    BUY
);

const SIGNAL_BUY = notify(
    'success',
    [
        text('Hedge | last'),
        v('ouh_window'),
        text('| Under'),
        v('ouh_under'),
        text('through Over'),
        v('ouh_prediction'),
        text('x'),
        `<block type="digit_hedge_dead_count"></block>`,
        text('| stake'),
        v('ouh_current'),
    ],
    BUY
);

const SKIP = `<block type="digit_hedge_skip_analysis"></block>`;
const SIGNAL = `<block type="digit_hedge_signal"><value name="UNDER">${v('ouh_under')}</value><value name="OVER">${v('ouh_prediction')}</value><value name="WINDOW">${v('ouh_window')}</value></block>`;

const ANALYSE = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('EQ', SKIP, num(1))}</value>
        <statement name="DO0">${RECOVERY_BUY}</statement>
        <statement name="ELSE">
          <block type="controls_if">
            <value name="IF0">${compare('EQ', SIGNAL, num(1))}</value>
            <statement name="DO0">${SIGNAL_BUY}</statement>
          </block>
        </statement>
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
const LIMIT = `<block type="digit_hedge_limit"></block>`;

const BOOK = `<block type="digit_hedge_book_profit">
    <value name="TOTAL">${v('ouh_total')}</value>
    <value name="PROFIT">${v('ouh_profit')}</value>
    <value name="TAKE_PROFIT">${v('ouh_take_profit')}</value>
    <value name="STOP_LOSS">${v('ouh_stop_loss')}</value>
  </block>`;

const TAKE_PROFIT = notify('success', [text('Take profit reached | P/L'), v('ouh_total')]);
const STOP_LOSS_NOTE = notify('error', [text('Stop loss reached | P/L'), v('ouh_total')]);

const STOP = notify('error', [
    text('Hedge did not finish on both sides — stopped so the stake is not changed'),
]);

/** Next stake must be stored before "may trade again" is read. */
const NOTES_AND_AGAIN = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('EQ', DECISION, num(1))}</value>
        <statement name="DO0">${NOTE_WIN}</statement>
        <statement name="ELSE">${NOTE_LOSS}</statement>
        <next><block type="trade_again"></block></next>
      </block>`;

const ARM = `<block type="digit_hedge_arm_recovery">
        <value name="ENABLED">${v('ouh_immediate')}</value>
        <next>${NOTES_AND_AGAIN}</next>
      </block>`;

const AFTER_LIMIT = set(
    'ouh_current',
    NEXT_STAKE,
    `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${CONTINUES}</value>
        <statement name="DO0">${ARM}</statement>
        <statement name="ELSE">${STOP}</statement>
      </block>`
);

const AFTER_PURCHASE = chain([
    n => set('ouh_profit', `<block type="digit_hedge_result"></block>`, n),
    n => set('ouh_total', BOOK, n),
    () => `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('EQ', LIMIT, num(1))}</value>
        <statement name="DO0">${TAKE_PROFIT}</statement>
        <value name="IF1">${compare('EQ', LIMIT, num(-1))}</value>
        <statement name="DO1">${STOP_LOSS_NOTE}</statement>
        <statement name="ELSE">${AFTER_LIMIT}</statement>
      </block>`,
]);

const INIT = chain([
    n => set('ouh_stake', num(1), n),
    n => set('ouh_multiplier', num(2), n),
    n => set('ouh_duration', num(1), n),
    n => set('ouh_window', num(5), n),
    n => set('ouh_immediate', num(1), n),
    n => set('ouh_prediction', num(5), n),
    n => set('ouh_under', num(4), n),
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
