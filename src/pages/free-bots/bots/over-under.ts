/**
 * Over/Under entry free bot (Volatility 75 (1s) Index).
 *
 * The user chooses both predictions. The active one is the barrier: 5 or higher
 * buys Under, 4 or lower buys Over. Prediction before loss is used until a loss.
 * Prediction after loss is used while recovering.
 *
 * Entry Point is checked once. The first trade waits until the last digit equals
 * it, and that entry is marked used only when a contract is actually bought.
 * A prediction that is neither 5 or higher nor 4 or lower does not burn it.
 * Every later trade skips that digit and buys from the active prediction.
 *
 * Every tick (1) analyses the tick already on screen, so that digit is not
 * skipped. Normal speed (0) waits for the next tick before analysing again.
 *
 * The next stake after a loss is only the accumulated loss divided by the
 * payout percent (default 40), rounded up to the next cent. One win's profit
 * pays back all the money lost and is not short by a fraction of a cent.
 * At 40% a $1 loss becomes $2.50, and $2.50 × 40% = $1. A win clears the
 * loss, returns Stake to Initial Stake, and restores the before-loss
 * prediction. Duration is 1 tick. The run stops at Take Profit or Stop Loss.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['oud_pred_before', 'Prediction before loss'],
    ['oud_pred_after', 'Prediction after loss'],
    ['oud_initial', 'Initial Stake'],
    ['oud_stake', 'Stake'],
    ['oud_entry', 'Entry Point'],
    ['oud_entered', 'Entry Used'],
    ['oud_speed', 'Every tick (1 = yes, 0 = normal)'],
    ['oud_payout', 'Payout %'],
    ['oud_take_profit', 'Take Profit'],
    ['oud_stop_loss', 'Stop Loss'],
    ['oud_prediction', 'Active Prediction'],
    ['oud_lost', 'Amount Lost'],
    ['oud_total', 'Total Profit'],
    ['oud_profit', 'Last Profit'],
    ['oud_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, notify } = blockHelpers(VARIABLES, 'oud_msg');

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
 * Amount lost ÷ (payout% / 100). The profit of this stake is the lost amount.
 * 40% → lost / 0.40. A $1 loss becomes $2.50, and $2.50 × 40% = $1.
 */
const recoveryBase = roundUp2(
    arith('DIVIDE', v('oud_lost'), arith('DIVIDE', v('oud_payout'), num(100)))
);

const lastDigit = () => `<block type="last_digit"></block>`;

/** 1 catches the current tick. 0 is normal speed. */
const setSpeed = (n = '') => `<block type="set_catch_every_tick">
        <value name="ENABLED">${v('oud_speed')}</value>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

const INIT = chain([
    n => set('oud_pred_before', num(2), n),
    n => set('oud_pred_after', num(7), n),
    n => set('oud_initial', num(1), n),
    n => set('oud_stake', v('oud_initial'), n),
    n => set('oud_entry', num(0), n),
    n => set('oud_entered', num(0), n),
    n => set('oud_speed', num(1), n),
    n => setSpeed(n),
    n => set('oud_payout', num(40), n),
    n => set('oud_take_profit', num(10), n),
    n => set('oud_stop_loss', num(50), n),
    n => set('oud_prediction', v('oud_pred_before'), n),
    n => set('oud_lost', num(0), n),
    n => set('oud_total', num(0), n),
]);

const BUY_UNDER = `<block type="purchase"><field name="PURCHASE_LIST">DIGITUNDER</field></block>`;
const BUY_OVER = `<block type="purchase"><field name="PURCHASE_LIST">DIGITOVER</field></block>`;

const sideMessage = (side: string) => [
    text(side),
    v('oud_prediction'),
    text('| stake'),
    v('oud_stake'),
];

/** Mark the one-time entry only on the purchase that uses it. */
const buy = (sideName: string, purchase: string) =>
    set('oud_entered', num(1), notify('info', sideMessage(sideName), purchase));

/** 5+ is Under. 4 or lower is Over. The prediction is the barrier the user set. */
const side = () => `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${compare('GTE', v('oud_prediction'), num(5))}</value>
        <statement name="DO0">${buy('UNDER', BUY_UNDER)}</statement>
        <value name="IF1">${compare('LTE', v('oud_prediction'), num(4))}</value>
        <statement name="DO1">${buy('OVER', BUY_OVER)}</statement>
      </block>`;

/** First trade waits for Entry Point. Later trades follow the prediction. */
const BEFORE_PURCHASE = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('EQ', v('oud_entered'), num(0))}</value>
        <statement name="DO0"><block type="controls_if">
            <value name="IF0">${compare('EQ', lastDigit(), v('oud_entry'))}</value>
            <statement name="DO0">${side()}</statement>
          </block></statement>
        <statement name="ELSE">${side()}</statement>
      </block>`;

const ON_WIN = set(
    'oud_lost',
    num(0),
    set(
        'oud_stake',
        v('oud_initial'),
        set(
            'oud_prediction',
            v('oud_pred_before'),
            notify('success', [
                text('WIN | profit'),
                v('oud_profit'),
                text('| next stake'),
                v('oud_stake'),
                text('| prediction'),
                v('oud_prediction'),
                text('| P/L'),
                v('oud_total'),
            ])
        )
    )
);

const lossNotify = notify('warn', [
    text('LOSS | lost'),
    v('oud_lost'),
    text('| payout'),
    v('oud_payout'),
    text('% | next stake'),
    v('oud_stake'),
    text('| prediction'),
    v('oud_prediction'),
    text('| P/L'),
    v('oud_total'),
]);

/** Next stake is only the loss divided by the payout percent. An invalid payout or a stake below the initial stake stays at the initial stake. */
const ON_LOSS = set(
    'oud_lost',
    round2(arith('ADD', v('oud_lost'), abs(v('oud_profit')))),
    set(
        'oud_stake',
        recoveryBase,
        set(
            'oud_prediction',
            v('oud_pred_after'),
            `<block type="controls_if">
            <value name="IF0">${compare('LTE', v('oud_payout'), num(0))}</value>
            <statement name="DO0">${set('oud_stake', v('oud_initial'))}</statement>
            <next>
              <block type="controls_if">
                <value name="IF0">${compare('LT', v('oud_stake'), v('oud_initial'))}</value>
                <statement name="DO0">${set('oud_stake', v('oud_initial'))}</statement>
                <next>${lossNotify}</next>
              </block>
            </next>
          </block>`
        )
    )
);

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('oud_total'), v('oud_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('oud_total')])}</statement>
        <value name="IF1">${compare(
            'LTE',
            v('oud_total'),
            `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${v('oud_stop_loss')}</value></block>`
        )}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | P/L'), v('oud_total')])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('oud_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('oud_total', round2(arith('ADD', v('oud_total'), v('oud_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => LIMITS,
]);

export const OVER_UNDER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="oud_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="oud_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="oud_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="oud_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="oud_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="oud_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="oud_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="oud_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('oud_stake')}</value>
        <value name="PREDICTION">${v('oud_prediction')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="oud_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="oud_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
