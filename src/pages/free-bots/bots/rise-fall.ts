/**
 * Rise Equals / Fall Equals Consecutive Ticks free bot (Volatility 50 (1s)).
 *
 * Trade Side is 0 Both, 1 Rise Equals only, or 2 Fall Equals only. The bot
 * fades the streak: consecutive up ticks buy Fall Equals, and consecutive
 * down ticks buy Rise Equals. A signal is N ticks in a row moving one way
 * (Consecutive Ticks, default 3). Trades per Signal (default 3) counts only
 * losses: the next trade of that signal is armed after a loss, and only while
 * the count is not met. A win is a recovery. The stake returns to the initial
 * amount, the trades left on that signal are set to 0, and the bot waits
 * until that streak breaks before it can enter again. Duration 1 tick.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['rff_stake', 'Initial Stake'],
    ['rff_multiplier', 'Martingale Multiplier'],
    ['rff_duration', 'Duration (ticks)'],
    ['rff_consecutive', 'Consecutive Ticks'],
    ['rff_trades_per_signal', 'Trades per Signal'],
    ['rff_mode', 'Trade Side (0 Both, 1 Rise Equals, 2 Fall Equals)'],
    ['rff_picked', 'Signal Side'],
    ['rff_take_profit', 'Take Profit'],
    ['rff_stop_loss', 'Stop Loss'],
    ['rff_current', 'Current Stake'],
    ['rff_total', 'Total Profit'],
    ['rff_remaining', 'Trades Remaining'],
    ['rff_taken', 'Trades Taken'],
    ['rff_hold', 'Wait For New Streak'],
    ['rff_ticks', 'Ticks'],
    ['rff_i', 'i'],
    ['rff_older', 'Older Tick'],
    ['rff_newer', 'Newer Tick'],
    ['rff_up', 'Ticks Up'],
    ['rff_down', 'Ticks Down'],
    ['rff_profit', 'Last Profit'],
    ['rff_text', 'Journal Text'],
];

const { v, num, text, set, chain, arith, round2, compare, and, increment, fromEnd, countTo, notify } = blockHelpers(
    VARIABLES,
    'rff_text'
);

const or = (a: string, b: string) =>
    `<block type="logic_operation"><field name="OP">OR</field><value name="A">${a}</value><value name="B">${b}</value></block>`;

const not = (a: string) => `<block type="logic_negate"><value name="BOOL">${a}</value></block>`;

const modeIs = (mode: number) => compare('EQ', v('rff_mode'), num(mode));

/** 0 trades both sides. 1 is Rise Equals only. 2 is Fall Equals only. */
const sideAllowed = (only: number) => or(modeIs(0), modeIs(only));

const allMoves = (counter: string) =>
    and(compare('GTE', v('rff_consecutive'), num(1)), compare('EQ', v(counter), v('rff_consecutive')));

const buy = (contract: 'CALLE' | 'PUTE') =>
    `<block type="purchase"><field name="PURCHASE_LIST">${contract}</field></block>`;

/** Remember the side and buy once. Further trades are armed only after a loss. */
const arm = (direction: number, contract: 'CALLE' | 'PUTE', pattern: string) =>
    set(
        'rff_picked',
        num(direction),
        set(
            'rff_taken',
            num(1),
            set(
                'rff_remaining',
                num(0),
                notify(
                    'success',
                    [
                        text(pattern),
                        v('rff_consecutive'),
                        text('ticks | side'),
                        v('rff_picked'),
                        text('| stake'),
                        v('rff_current'),
                    ],
                    buy(contract)
                )
            )
        )
    );

/** A loss already authorised one more trade of the same side. */
const FOLLOW_UP = set(
    'rff_taken',
    arith('ADD', v('rff_taken'), num(1)),
    set(
        'rff_remaining',
        num(0),
        `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${compare('EQ', v('rff_picked'), num(1))}</value>
        <statement name="DO0">${notify(
            'success',
            [
                text('Same signal | side'),
                v('rff_picked'),
                text('| left'),
                v('rff_remaining'),
                text('| stake'),
                v('rff_current'),
            ],
            buy('CALLE')
        )}</statement>
        <value name="IF1">${compare('EQ', v('rff_picked'), num(2))}</value>
        <statement name="DO1">${notify(
            'success',
            [
                text('Same signal | side'),
                v('rff_picked'),
                text('| left'),
                v('rff_remaining'),
                text('| stake'),
                v('rff_current'),
            ],
            buy('PUTE')
        )}</statement>
      </block>`
        )
    );

/** Count how many of the last N steps moved up and how many moved down. */
const countMoves = (next: string) =>
    countTo(
        'rff_i',
        v('rff_consecutive'),
        chain([
            n => set('rff_newer', fromEnd('rff_ticks', v('rff_i')), n),
            n => set('rff_older', fromEnd('rff_ticks', arith('ADD', v('rff_i'), num(1))), n),
            () => `<block type="controls_if">
                <mutation elseif="1"></mutation>
                <value name="IF0">${compare('LT', v('rff_older'), v('rff_newer'))}</value>
                <statement name="DO0">${increment('rff_up')}</statement>
                <value name="IF1">${compare('GT', v('rff_older'), v('rff_newer'))}</value>
                <statement name="DO1">${increment('rff_down')}</statement>
              </block>`,
        ]),
        next
    );

const SIGNAL = `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${and(allMoves('rff_up'), sideAllowed(2))}</value>
        <statement name="DO0">${arm(2, 'PUTE', 'Ticks up → Fall Equals |')}</statement>
        <value name="IF1">${and(allMoves('rff_down'), sideAllowed(1))}</value>
        <statement name="DO1">${arm(1, 'CALLE', 'Ticks down → Rise Equals |')}</statement>
      </block>`;

/** After a win, ignore this streak until it is no longer all up or all down. */
const streakStillThere = or(allMoves('rff_up'), allMoves('rff_down'));

const AFTER_COUNT = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('EQ', v('rff_hold'), num(1))}</value>
        <statement name="DO0">
          <block type="controls_if">
            <value name="IF0">${not(streakStillThere)}</value>
            <statement name="DO0">${set('rff_hold', num(0))}</statement>
          </block>
        </statement>
        <statement name="ELSE">${SIGNAL}</statement>
      </block>`;

const ANALYSE = chain([
    n => set('rff_ticks', `<block type="ticks"></block>`, n),
    n => set('rff_up', num(0), n),
    n => set('rff_down', num(0), n),
    n => countMoves(n),
    () => AFTER_COUNT,
]);

const BEFORE_PURCHASE = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('GT', v('rff_remaining'), num(0))}</value>
        <statement name="DO0">${FOLLOW_UP}</statement>
        <statement name="ELSE">${ANALYSE}</statement>
      </block>`;

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('rff_total'), v('rff_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('rff_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('rff_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('rff_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('rff_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const ON_WIN = set(
    'rff_remaining',
    num(0),
    set(
        'rff_taken',
        num(0),
        set(
            'rff_hold',
            num(1),
            set(
                'rff_current',
                v('rff_stake'),
                notify('success', [
                    text('WIN | side'),
                    v('rff_picked'),
                    text('| stake back to'),
                    v('rff_current'),
                    text('| signal trades left'),
                    v('rff_remaining'),
                    text('| P/L'),
                    v('rff_total'),
                ])
            )
        )
    )
);

const LOSS_NOTE = notify('warn', [
    text('LOSS | side'),
    v('rff_picked'),
    text('| next stake'),
    v('rff_current'),
    text('| same signal left'),
    v('rff_remaining'),
    text('| P/L'),
    v('rff_total'),
]);

const ON_LOSS = set(
    'rff_current',
    round2(arith('MULTIPLY', v('rff_current'), v('rff_multiplier'))),
    `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('LT', v('rff_taken'), v('rff_trades_per_signal'))}</value>
        <statement name="DO0">${set('rff_remaining', num(1))}</statement>
        <statement name="ELSE">${set('rff_remaining', num(0))}</statement>
        <next>${LOSS_NOTE}</next>
      </block>`
);

const AFTER_PURCHASE = chain([
    n => set('rff_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('rff_total', round2(arith('ADD', v('rff_total'), v('rff_profit'))), n),
    () => `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <value name="IF1">${compare('LT', v('rff_profit'), num(0))}</value>
        <statement name="DO1">${ON_LOSS}</statement>
        <next>${LIMITS}</next>
      </block>`,
]);

const INIT = chain([
    n => set('rff_stake', num(1), n),
    n => set('rff_multiplier', num(2), n),
    n => set('rff_duration', num(1), n),
    n => set('rff_consecutive', num(3), n),
    n => set('rff_trades_per_signal', num(3), n),
    n => set('rff_mode', num(0), n),
    n => set('rff_picked', num(0), n),
    n => set('rff_take_profit', num(10), n),
    n => set('rff_stop_loss', num(50), n),
    n => set('rff_current', v('rff_stake'), n),
    n => set('rff_total', num(0), n),
    n => set('rff_remaining', num(0), n),
    n => set('rff_taken', num(0), n),
    () => set('rff_hold', num(0)),
]);

export const RISE_FALL_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="rff_trade_def" deletable="false" collapsed="false" x="0" y="260">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="rff_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="rff_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">callput</field>
            <field name="TRADETYPE_LIST">callputequal</field>
            <next>
              <block type="trade_definition_contracttype" id="rff_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="rff_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rff_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="rff_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="rff_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('rff_duration')}</value>
        <value name="AMOUNT">${v('rff_current')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="rff_before" deletable="false" x="0" y="900">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="rff_after" x="900" y="260">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
