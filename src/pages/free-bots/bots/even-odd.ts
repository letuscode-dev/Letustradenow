/**
 * Even/Odd entry free bot (Volatility 75 (1s) Index).
 *
 * Entry Point is checked once. The first trade waits until the last digit
 * equals it, and that entry is marked used only when a contract is bought.
 * An even entry (0, 2, 4, 6, 8) buys Even. An odd entry (1, 3, 5, 7, 9) buys
 * Odd. Every later trade buys that same side and does not wait for the digit.
 *
 * A loss multiplies Amount by Martingale (default 1.5) and rounds to the nearest
 * cent. A win returns Amount to Stake. Duration is 1 tick. The run stops at
 * Take Profit or Stop Loss.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['evo_entry', 'Entry Point'],
    ['evo_entered', 'Entry Used'],
    ['evo_stake', 'Stake'],
    ['evo_amount', 'Amount'],
    ['evo_martingale', 'Martingale'],
    ['evo_take_profit', 'Take Profit'],
    ['evo_stop_loss', 'Stop Loss'],
    ['evo_total', 'Total Profit'],
    ['evo_profit', 'Last Profit'],
    ['evo_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, and, notify } = blockHelpers(VARIABLES, 'evo_msg');

const lastDigit = () => `<block type="last_digit"></block>`;

const mod2 = (x: string) =>
    `<block type="math_modulo"><value name="DIVIDEND">${x}</value><value name="DIVISOR">${num(2)}</value></block>`;

const rounded = (x: string) =>
    `<block type="math_round"><field name="OP">ROUND</field><value name="NUM">${x}</value></block>`;

/** Whole number inside the inclusive bounds. */
const inRange = (low: number, high: number) =>
    and(
        compare('EQ', v('evo_entry'), rounded(v('evo_entry'))),
        and(compare('GTE', v('evo_entry'), num(low)), compare('LTE', v('evo_entry'), num(high)))
    );

const INIT = chain([
    n => set('evo_entry', num(0), n),
    n => set('evo_entered', num(0), n),
    n => set('evo_stake', num(1), n),
    n => set('evo_amount', v('evo_stake'), n),
    n => set('evo_martingale', num(1.5), n),
    n => set('evo_take_profit', num(10), n),
    n => set('evo_stop_loss', num(50), n),
    n => set('evo_total', num(0), n),
]);

const BUY_EVEN = `<block type="purchase"><field name="PURCHASE_LIST">DIGITEVEN</field></block>`;
const BUY_ODD = `<block type="purchase"><field name="PURCHASE_LIST">DIGITODD</field></block>`;

const buy = (sideName: string, purchase: string) =>
    set(
        'evo_entered',
        num(1),
        notify(
            'info',
            [text(sideName), text('| entry'), v('evo_entry'), text('| stake'), v('evo_amount')],
            purchase
        )
    );

/** 0, 2, 4, 6, 8 are Even. 1, 3, 5, 7, 9 are Odd. */
const side = () => `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${and(inRange(0, 8), compare('EQ', mod2(v('evo_entry')), num(0)))}</value>
        <statement name="DO0">${buy('EVEN', BUY_EVEN)}</statement>
        <value name="IF1">${and(inRange(1, 9), compare('NEQ', mod2(v('evo_entry')), num(0)))}</value>
        <statement name="DO1">${buy('ODD', BUY_ODD)}</statement>
      </block>`;

/** First trade waits for Entry Point. Later trades buy the same side. */
const BEFORE_PURCHASE = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('EQ', v('evo_entered'), num(0))}</value>
        <statement name="DO0"><block type="controls_if">
            <value name="IF0">${compare('EQ', lastDigit(), v('evo_entry'))}</value>
            <statement name="DO0">${side()}</statement>
          </block></statement>
        <statement name="ELSE">${side()}</statement>
      </block>`;

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
</xml>`;
