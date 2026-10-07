/**
 * Over 2 Digit Filter free bot (Volatility 75 (1s) Index).
 *
 * Buys Digit Over 2 when each of the last N last digits is greater than 2; otherwise waits
 * for the next tick. N is the "Digits to Check" setting (default 4). Each signal buys
 * "Trades per Signal" contracts in a row (default 1) before analysing again. The run does not
 * end after that batch: it keeps analysing and trading until Take Profit, Stop Loss, or the
 * user stops the bot. After a loss the next stake is the accumulated loss divided by the
 * payout percent (default 40), rounded up to the next cent, so one win covers the full
 * amount lost. Two losses in a row add 0.05 to the Martingale Multiplier (default 2.5) and
 * that higher multiplier scales the recovery stake; a win restores the multiplier, clears
 * the loss, and returns the stake to the initial amount. Duration 1 tick.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['ovr_stake', 'Initial Stake'],
    ['ovr_multiplier', 'Martingale Multiplier'],
    ['ovr_multiplier_base', 'Base Multiplier'],
    ['ovr_loss_streak', 'Loss Streak'],
    ['ovr_payout', 'Payout %'],
    ['ovr_lost', 'Amount Lost'],
    ['ovr_duration', 'Duration (ticks)'],
    ['ovr_prediction', 'Prediction (Over)'],
    ['ovr_digits_to_check', 'Digits to Check'],
    ['ovr_trades_per_signal', 'Trades per Signal'],
    ['ovr_take_profit', 'Take Profit'],
    ['ovr_stop_loss', 'Stop Loss'],
    ['ovr_current', 'Current Stake'],
    ['ovr_total', 'Total Profit'],
    ['ovr_profit', 'Last Profit'],
    ['ovr_msg', 'Journal Message'],
    ['ovr_digits', 'Last Digits'],
    ['ovr_i', 'i'],
    ['ovr_over', 'Digits Over'],
    ['ovr_remaining', 'Signal Trades Left'],
];

const { v, num, text, set, chain, arith, round2, compare, and, increment, fromEnd, countTo, notify } = blockHelpers(
    VARIABLES,
    'ovr_msg'
);

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

/** Amount lost ÷ (payout% / 100), before the live multiplier is applied. */
const recoveryBase = roundUp2(arith('DIVIDE', v('ovr_lost'), arith('DIVIDE', v('ovr_payout'), num(100))));

const INIT = chain([
    n => set('ovr_stake', num(1), n),
    n => set('ovr_multiplier', num(2.5), n),
    n => set('ovr_multiplier_base', v('ovr_multiplier'), n),
    n => set('ovr_loss_streak', num(0), n),
    n => set('ovr_payout', num(40), n),
    n => set('ovr_lost', num(0), n),
    n => set('ovr_duration', num(1), n),
    n => set('ovr_prediction', num(2), n),
    n => set('ovr_digits_to_check', num(4), n),
    n => set('ovr_trades_per_signal', num(1), n),
    n => set('ovr_take_profit', num(10), n),
    n => set('ovr_stop_loss', num(50), n),
    n => set('ovr_current', v('ovr_stake'), n),
    n => set('ovr_total', num(0), n),
    n => set('ovr_remaining', num(0), n),
]);

const countOver = (next: string) =>
    countTo(
        'ovr_i',
        v('ovr_digits_to_check'),
        `<block type="controls_if">
            <value name="IF0">${compare('GT', fromEnd('ovr_digits', v('ovr_i')), v('ovr_prediction'))}</value>
            <statement name="DO0">${increment('ovr_over')}</statement>
          </block>`,
        next
    );

const BUY = `<block type="purchase"><field name="PURCHASE_LIST">DIGITOVER</field></block>`;

const ANALYSE = chain([
    n => set('ovr_digits', `<block type="lastDigitList"></block>`, n),
    n => set('ovr_over', num(0), n),
    countOver,
    () => `<block type="controls_if">
        <value name="IF0">${and(
            compare('GTE', v('ovr_digits_to_check'), num(1)),
            compare('EQ', v('ovr_over'), v('ovr_digits_to_check'))
        )}</value>
        <statement name="DO0">${set(
            'ovr_remaining',
            arith('MINUS', v('ovr_trades_per_signal'), num(1)),
            notify(
                'info',
                [
                    text('Last'),
                    v('ovr_digits_to_check'),
                    text('digits over'),
                    v('ovr_prediction'),
                    text('→ OVER | stake'),
                    v('ovr_current'),
                    text('| left'),
                    v('ovr_remaining'),
                ],
                BUY
            )
        )}</statement>
      </block>`,
]);

/** Trades left from the last signal are bought without re-analysing. */
const BEFORE_PURCHASE = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('GT', v('ovr_remaining'), num(0))}</value>
        <statement name="DO0">${set(
            'ovr_remaining',
            arith('MINUS', v('ovr_remaining'), num(1)),
            notify('info', [text('Signal trade → OVER | stake'), v('ovr_current'), text('| left'), v('ovr_remaining')], BUY)
        )}</statement>
        <statement name="ELSE">${ANALYSE}</statement>
      </block>`;

const ON_WIN = set(
    'ovr_loss_streak',
    num(0),
    set(
        'ovr_multiplier',
        v('ovr_multiplier_base'),
        set(
            'ovr_lost',
            num(0),
            set(
            'ovr_current',
            v('ovr_stake'),
            notify('success', [
                text('WIN | profit'),
                v('ovr_profit'),
                text('| next stake'),
                v('ovr_current'),
                text('| multiplier'),
                v('ovr_multiplier'),
                text('| P/L'),
                v('ovr_total'),
            ])
            )
        )
    )
);

const lossNotify = notify('warn', [
    text('LOSS | lost'),
    v('ovr_lost'),
    text('| payout'),
    v('ovr_payout'),
    text('% | multiplier'),
    v('ovr_multiplier'),
    text('| next stake'),
    v('ovr_current'),
    text('| streak'),
    v('ovr_loss_streak'),
    text('| P/L'),
    v('ovr_total'),
]);

const applyLossStake = set(
    'ovr_lost',
    round2(arith('ADD', v('ovr_lost'), abs(v('ovr_profit')))),
    set(
        'ovr_current',
        recoveryBase,
        `<block type="controls_if">
            <mutation elseif="1"></mutation>
            <value name="IF0">${compare('LTE', v('ovr_payout'), num(0))}</value>
            <statement name="DO0">${set('ovr_current', v('ovr_stake'))}</statement>
            <value name="IF1">${compare('GT', v('ovr_multiplier_base'), num(0))}</value>
            <statement name="DO1">${set(
                'ovr_current',
                roundUp2(
                    arith(
                        'MULTIPLY',
                        v('ovr_current'),
                        arith('DIVIDE', v('ovr_multiplier'), v('ovr_multiplier_base'))
                    )
                )
            )}</statement>
            <next>
              <block type="controls_if">
                <value name="IF0">${compare('LT', v('ovr_current'), v('ovr_stake'))}</value>
                <statement name="DO0">${set('ovr_current', v('ovr_stake'))}</statement>
                <next>${lossNotify}</next>
              </block>
            </next>
          </block>`
    )
);

/** Second loss in a row bumps the multiplier; later losses keep that value until a win. */
const ON_LOSS = set(
    'ovr_loss_streak',
    arith('ADD', v('ovr_loss_streak'), num(1)),
    `<block type="controls_if">
        <value name="IF0">${compare('EQ', v('ovr_loss_streak'), num(2))}</value>
        <statement name="DO0">${set(
            'ovr_multiplier',
            round2(arith('ADD', v('ovr_multiplier'), num(0.05)))
        )}</statement>
        <next>${applyLossStake}</next>
      </block>`
);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('ovr_total'), v('ovr_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('ovr_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('ovr_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('ovr_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('ovr_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('ovr_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('ovr_total', round2(arith('ADD', v('ovr_total'), v('ovr_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => LIMITS,
]);

export const OVER_TWO_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="ovr_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ovr_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="ovr_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="ovr_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITOVER</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ovr_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="ovr_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="ovr_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="ovr_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('ovr_duration')}</value>
        <value name="AMOUNT">${v('ovr_current')}</value>
        <value name="PREDICTION">${v('ovr_prediction')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="ovr_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="ovr_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
