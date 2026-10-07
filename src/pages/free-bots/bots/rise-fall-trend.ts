/**
 * Rise/Fall Tick Trend free bot (Step Index 500).
 *
 * N consecutive up ticks → RISE; N consecutive down ticks → FALL; otherwise wait for the
 * next tick. N is the "Consecutive Ticks" setting (default 3). Stake × Martingale Multiplier
 * (default 1.25) after a loss, back to the initial stake after a win. Duration 2 ticks.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['rfs_stake', 'Initial Stake'],
    ['rfs_multiplier', 'Martingale Multiplier'],
    ['rfs_duration', 'Duration (ticks)'],
    ['rfs_take_profit', 'Take Profit'],
    ['rfs_stop_loss', 'Stop Loss'],
    ['rfs_side', 'Side'],
    ['rfs_current', 'Current Stake'],
    ['rfs_total', 'Total Profit'],
    ['rfs_profit', 'Last Profit'],
    ['rfs_msg', 'Journal Message'],
    ['rfs_consecutive', 'Consecutive Ticks'],
    ['rfs_ticks', 'Tick List'],
    ['rfs_i', 'i'],
    ['rfs_newer', 'Newer Tick'],
    ['rfs_older', 'Older Tick'],
    ['rfs_up', 'Up Moves'],
    ['rfs_down', 'Down Moves'],
];

const { v, num, text, set, chain, arith, round2, compare, and, increment, fromEnd, countTo, notify } = blockHelpers(
    VARIABLES,
    'rfs_msg'
);

const INIT = chain([
    n => set('rfs_stake', num(2), n),
    n => set('rfs_multiplier', num(1.25), n),
    n => set('rfs_duration', num(2), n),
    n => set('rfs_consecutive', num(3), n),
    n => set('rfs_take_profit', num(10), n),
    n => set('rfs_stop_loss', num(50), n),
    n => set('rfs_current', v('rfs_stake'), n),
    n => set('rfs_total', num(0), n),
]);

const enter = (side: string, contract: string, pattern: string) =>
    set(
        'rfs_side',
        text(side),
        notify(
            'info',
            [v('rfs_consecutive'), text(`${pattern} →`), v('rfs_side'), text('| stake'), v('rfs_current')],
            `<block type="purchase"><field name="PURCHASE_LIST">${contract}</field></block>`
        )
    );

const countMoves = (next: string) =>
    countTo(
        'rfs_i',
        v('rfs_consecutive'),
        chain([
            n => set('rfs_newer', fromEnd('rfs_ticks', v('rfs_i')), n),
            n => set('rfs_older', fromEnd('rfs_ticks', arith('ADD', v('rfs_i'), num(1))), n),
            () => `<block type="controls_if">
                <mutation elseif="1"></mutation>
                <value name="IF0">${compare('LT', v('rfs_older'), v('rfs_newer'))}</value>
                <statement name="DO0">${increment('rfs_up')}</statement>
                <value name="IF1">${compare('GT', v('rfs_older'), v('rfs_newer'))}</value>
                <statement name="DO1">${increment('rfs_down')}</statement>
              </block>`,
        ]),
        next
    );

const allMoves = (counter: string) =>
    and(compare('GTE', v('rfs_consecutive'), num(1)), compare('EQ', v(counter), v('rfs_consecutive')));

const BEFORE_PURCHASE = chain([
    n => set('rfs_ticks', `<block type="ticks"></block>`, n),
    n => set('rfs_up', num(0), n),
    n => set('rfs_down', num(0), n),
    countMoves,
    () => `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${allMoves('rfs_up')}</value>
        <statement name="DO0">${enter('RISE', 'CALL', 'ticks up')}</statement>
        <value name="IF1">${allMoves('rfs_down')}</value>
        <statement name="DO1">${enter('FALL', 'PUT', 'ticks down')}</statement>
      </block>`,
]);

const ON_WIN = set(
    'rfs_current',
    v('rfs_stake'),
    notify('success', [
        text('WIN on'),
        v('rfs_side'),
        text('| profit'),
        v('rfs_profit'),
        text('| next stake'),
        v('rfs_current'),
        text('| P/L'),
        v('rfs_total'),
    ])
);

const ON_LOSS = set(
    'rfs_current',
    round2(arith('MULTIPLY', v('rfs_current'), v('rfs_multiplier'))),
    notify('warn', [
        text('LOSS on'),
        v('rfs_side'),
        text('| next stake'),
        v('rfs_current'),
        text('| P/L'),
        v('rfs_total'),
    ])
);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('rfs_total'), v('rfs_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('rfs_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('rfs_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('rfs_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('rfs_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('rfs_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('rfs_total', round2(arith('ADD', v('rfs_total'), v('rfs_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => LIMITS,
]);

export const RISE_FALL_TREND_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="rfs_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="rfs_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">step_index</field>
        <field name="SYMBOL_LIST">stpRNG5</field>
        <next>
          <block type="trade_definition_tradetype" id="rfs_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">callput</field>
            <field name="TRADETYPE_LIST">callput</field>
            <next>
              <block type="trade_definition_contracttype" id="rfs_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="rfs_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rfs_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="rfs_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="rfs_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('rfs_duration')}</value>
        <value name="AMOUNT">${v('rfs_current')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="rfs_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="rfs_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
