/**
 * Current-digit parity Differs free bot (Volatility 75 (1s) Index).
 *
 * On every available tick, this bot reads only the newest cached last digit.
 * When that digit matches the user-selected target parity (Even or Odd), it
 * buys Digit Differs with that same digit as the prediction. There is no
 * history request, scan, or per-tick notification in the hot path.
 *
 * A loss multiplies the next stake by Martingale (default 10.5). A win resets
 * the stake and the consecutive-loss counter. The bot stops on Take Profit or
 * after the configured number of consecutive losses (default 2).
 */

import { blockHelpers, callFunction, defineFunction } from './blocks';

const VARIABLES: [string, string][] = [
    ['pdd_stake', 'Stake'],
    ['pdd_target', 'Target parity'],
    ['pdd_martingale', 'Martingale'],
    ['pdd_take_profit', 'Take Profit'],
    ['pdd_loss_limit', 'Stop loss (consecutive)'],
    ['pdd_amount', 'Amount'],
    ['pdd_prediction', 'Prediction'],
    ['pdd_losses', 'Consecutive losses'],
    ['pdd_total', 'Total Profit'],
    ['pdd_profit', 'Last Profit'],
    ['pdd_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, and, notify } = blockHelpers(VARIABLES, 'pdd_msg');

/** A visible dropdown: Even = 0, Odd = 1. */
const targetParity = () => `<block type="digit_parity_target"><field name="PARITY">EVEN</field></block>`;

/**
 * Returns the current digit when it has the requested parity, otherwise -1.
 * The block also writes a matching digit directly to the active trade options
 * so the following purchase uses this tick's prediction without a restart.
 */
const currentTargetDigit = () => `<block type="current_digit_for_parity"><value name="TARGET">${v(
    'pdd_target'
)}</value></block>`;

/** 1 makes the before-purchase watcher analyse the tick already on screen. */
const setSpeed = (n = '') => `<block type="set_catch_every_tick">
        <value name="ENABLED">${num(1)}</value>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

const RESET_NAME = 'Reset Current Digit Differs';

/** Live values reset for each run; user parameters remain visible above. */
const RESET = defineFunction(
    RESET_NAME,
    'pdd_reset_fn',
    chain([
        n => setSpeed(n),
        n => set('pdd_amount', v('pdd_stake'), n),
        n => set('pdd_prediction', num(0), n),
        n => set('pdd_losses', num(0), n),
        () => set('pdd_total', num(0)),
    ])
);

const INIT = chain([
    n => set('pdd_stake', num(1), n),
    n => set('pdd_target', targetParity(), n),
    n => set('pdd_martingale', num(10.5), n),
    n => set('pdd_take_profit', num(10), n),
    n => set('pdd_loss_limit', num(2), n),
    () => callFunction(RESET_NAME, 'pdd_reset_call'),
]);

/**
 * `current_digit_for_parity` is synchronous and reads only the tick that
 * caused this purchase pass. A matching digit is written to the active trade
 * options before the purchase call, avoiding a slower trade-options restart.
 */
const BEFORE_PURCHASE = set(
    'pdd_prediction',
    currentTargetDigit(),
    `<block type="controls_if" id="pdd_gate">
        <value name="IF0">${compare('GTE', v('pdd_prediction'), num(0))}</value>
        <statement name="DO0"><block type="purchase"><field name="PURCHASE_LIST">DIGITDIFF</field></block></statement>
      </block>`
);

const ON_WIN = set(
    'pdd_losses',
    num(0),
    set(
        'pdd_amount',
        v('pdd_stake'),
        notify('success', [
            text('WIN | digit'),
            v('pdd_prediction'),
            text('| profit'),
            v('pdd_profit'),
            text('| next stake'),
            v('pdd_amount'),
            text('| P/L'),
            v('pdd_total'),
        ])
    )
);

const lossNotify = notify('warn', [
    text('LOSS | consecutive'),
    v('pdd_losses'),
    text('| next stake'),
    v('pdd_amount'),
    text('| P/L'),
    v('pdd_total'),
]);

/** A non-positive multiplier resets to Stake instead of producing an invalid amount. */
const ON_LOSS = set(
    'pdd_losses',
    arith('ADD', v('pdd_losses'), num(1)),
    set(
        'pdd_amount',
        round2(arith('MULTIPLY', v('pdd_amount'), v('pdd_martingale'))),
        `<block type="controls_if">
            <value name="IF0">${compare('LTE', v('pdd_martingale'), num(0))}</value>
            <statement name="DO0">${set('pdd_amount', v('pdd_stake'))}</statement>
            <next>${lossNotify}</next>
          </block>`
    )
);

/** Stop loss is a count of losses in a row, not a currency P/L threshold. */
const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('GTE', v('pdd_total'), v('pdd_take_profit'))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('pdd_total')])}</statement>
        <value name="IF1">${and(
            compare('GTE', v('pdd_loss_limit'), num(1)),
            compare('GTE', v('pdd_losses'), v('pdd_loss_limit'))
        )}</value>
        <statement name="DO1">${notify('error', [
            text('Consecutive loss limit reached | losses'),
            v('pdd_losses'),
        ])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('pdd_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('pdd_total', round2(arith('ADD', v('pdd_total'), v('pdd_profit'))), n),
    n => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${ON_WIN}</statement>
        <statement name="ELSE">${ON_LOSS}</statement>
        ${n ? `<next>${n}</next>` : ''}
      </block>`,
    () => LIMITS,
]);

export const CURRENT_DIGIT_PARITY_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="pdd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="pdd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="pdd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="pdd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="pdd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="pdd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="pdd_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="pdd_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('pdd_amount')}</value>
        <value name="PREDICTION">${v('pdd_prediction')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="pdd_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="pdd_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
  ${RESET}
</xml>`;
