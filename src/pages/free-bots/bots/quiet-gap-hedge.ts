/**
 * Over 5 + Under 4 quiet-gap hedge (Volatility 75 (1s) Index).
 *
 * Buys Over 5 and Under 4 together when the newest ticks contain no 4 and no
 * 5. The range defaults to 3, and the latest digit is part of that range.
 * Immediate Loss Hedge is an option: 1 buys the next hedge as soon as both
 * sides lose, without another digit check. 0 waits for a clear range again.
 * A combined loss doubles the stake that was bought. One winning side returns
 * to the initial stake. Both sides must share one tick. Take profit and stop
 * loss use the combined profit. Duration 1 tick.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['qgh_stake', 'Initial Stake'],
    ['qgh_multiplier', 'Recovery Multiplier'],
    ['qgh_duration', 'Duration (ticks)'],
    ['qgh_range', 'Clear Range'],
    ['qgh_immediate', 'Immediate Loss Hedge'],
    ['qgh_take_profit', 'Take Profit'],
    ['qgh_stop_loss', 'Stop Loss'],
    ['qgh_current', 'Current Stake'],
    ['qgh_total', 'Total Profit'],
    ['qgh_profit', 'Last Profit'],
    ['qgh_text', 'Journal Text'],
];

const { v, num, text, set, chain, compare, notify } = blockHelpers(VARIABLES, 'qgh_text');

const BUY = `<block type="digit_hedge_purchase"><value name="OVER">${num(5)}</value><value name="UNDER">${num(4)}</value></block>`;

const RECOVERY_BUY = notify(
    'warn',
    [text('Loss hedge | no analysis | Over 5 + Under 4 | stake'), v('qgh_current')],
    BUY
);

const SIGNAL_BUY = notify(
    'success',
    [text('Quiet gap | last'), v('qgh_range'), text('| no 4 or 5 | Over 5 + Under 4 | stake'), v('qgh_current')],
    BUY
);

const SKIP = `<block type="digit_hedge_skip_analysis"></block>`;
const SIGNAL = `<block type="digit_hedge_quiet"><value name="RANGE">${v('qgh_range')}</value></block>`;

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
    v('qgh_profit'),
    text('| stake back to'),
    v('qgh_current'),
    text('| P/L'),
    v('qgh_total'),
]);

const NOTE_LOSS = notify('warn', [
    text('LOSS | net'),
    v('qgh_profit'),
    text('| next stake'),
    v('qgh_current'),
    text('| P/L'),
    v('qgh_total'),
]);

const NEXT_STAKE = `<block type="digit_hedge_next_stake">
    <value name="CURRENT">${v('qgh_current')}</value>
    <value name="INITIAL">${v('qgh_stake')}</value>
    <value name="MULTIPLIER">${v('qgh_multiplier')}</value>
  </block>`;

const CONTINUES = `<block type="digit_hedge_continues"></block>`;
const DECISION = `<block type="digit_hedge_decision"></block>`;
const LIMIT = `<block type="digit_hedge_limit"></block>`;

const BOOK = `<block type="digit_hedge_book_profit">
    <value name="TOTAL">${v('qgh_total')}</value>
    <value name="PROFIT">${v('qgh_profit')}</value>
    <value name="TAKE_PROFIT">${v('qgh_take_profit')}</value>
    <value name="STOP_LOSS">${v('qgh_stop_loss')}</value>
  </block>`;

const TAKE_PROFIT = notify('success', [text('Take profit reached | P/L'), v('qgh_total')]);
const STOP_LOSS_NOTE = notify('error', [text('Stop loss reached | P/L'), v('qgh_total')]);

const STOP = notify('error', [text('Hedge did not finish on both sides — stopped so the stake is not changed')]);

const NOTES_AND_AGAIN = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('EQ', DECISION, num(1))}</value>
        <statement name="DO0">${NOTE_WIN}</statement>
        <statement name="ELSE">${NOTE_LOSS}</statement>
        <next><block type="trade_again"></block></next>
      </block>`;

const ARM = `<block type="digit_hedge_arm_recovery">
        <value name="ENABLED">${v('qgh_immediate')}</value>
        <next>${NOTES_AND_AGAIN}</next>
      </block>`;

const AFTER_LIMIT = set(
    'qgh_current',
    NEXT_STAKE,
    `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${CONTINUES}</value>
        <statement name="DO0">${ARM}</statement>
        <statement name="ELSE">${STOP}</statement>
      </block>`
);

const AFTER_PURCHASE = chain([
    n => set('qgh_profit', `<block type="digit_hedge_result"></block>`, n),
    n => set('qgh_total', BOOK, n),
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
    n => set('qgh_stake', num(1), n),
    n => set('qgh_multiplier', num(2), n),
    n => set('qgh_duration', num(1), n),
    n => set('qgh_range', num(3), n),
    n => set('qgh_immediate', num(1), n),
    n => set('qgh_take_profit', num(10), n),
    n => set('qgh_stop_loss', num(50), n),
    n => set('qgh_current', v('qgh_stake'), n),
    n => set('qgh_total', num(0), n),
    () => set('qgh_profit', num(0)),
]);

export const QUIET_GAP_HEDGE_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="qgh_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="qgh_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="qgh_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="qgh_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITOVER</field>
                <next>
                  <block type="trade_definition_candleinterval" id="qgh_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="qgh_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="qgh_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="qgh_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('qgh_duration')}</value>
        <value name="AMOUNT">${v('qgh_current')}</value>
        <value name="PREDICTION">${num(5)}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="qgh_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${ANALYSE}
    </statement>
  </block>
  <block type="after_purchase" id="qgh_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
