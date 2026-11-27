/**
 * Simultaneous Over/Under hedge (Volatility 75 (1s) Index).
 *
 * Every available tick can start one pair: Over 3 and Under 3 by default. The runtime
 * quotes and buys both legs in parallel, then keeps the pair only when both
 * fills use the same entry tick. A partial or mismatched fill is cancelled and
 * the bot stops rather than leaving a one-sided position open.
 *
 * The two stakes are independent. When both legs lose, each amount is
 * multiplied by Martingale; when either leg wins, both return to their base
 * stake. Take Profit and Stop Loss use the combined profit of settled pairs.
 * Duration is in ticks. The current-tick runner rechecks immediately
 * when a completed pair hands control back to Before Purchase.
 */

import { blockHelpers, callFunction, defineFunction } from './blocks';

const VARIABLES: [string, string][] = [
    ['sou_over_stake', 'Over Stake'],
    ['sou_under_stake', 'Under Stake'],
    ['sou_over_prediction', 'Over Prediction'],
    ['sou_under_prediction', 'Under Prediction'],
    ['sou_martingale', 'Martingale'],
    ['sou_duration', 'Duration (ticks)'],
    ['sou_take_profit', 'Take Profit'],
    ['sou_stop_loss', 'Stop Loss'],
    ['sou_over_amount', 'Current Over Stake'],
    ['sou_under_amount', 'Current Under Stake'],
    ['sou_result', 'Last Hedge Result'],
    ['sou_total', 'Total Hedge Profit'],
    ['sou_msg', 'Journal Message'],
];

const { v, num, text, set, chain, compare, notify } = blockHelpers(VARIABLES, 'sou_msg');

const RESET_NAME = 'Reset Simultaneous Over Under';

const setEveryTick = (n = '') => `<block type="set_catch_every_tick">
        <value name="ENABLED">${num(1)}</value>
        ${n ? `<next>${n}</next>` : ''}
      </block>`;

const RESET = defineFunction(
    RESET_NAME,
    'sou_reset_fn',
    chain([
        n => setEveryTick(n),
        n => set('sou_over_amount', v('sou_over_stake'), n),
        n => set('sou_under_amount', v('sou_under_stake'), n),
        n => set('sou_result', num(0), n),
        () => set('sou_total', num(0)),
    ])
);

const INIT = chain([
    n => set('sou_over_stake', num(1), n),
    n => set('sou_under_stake', num(1), n),
    n => set('sou_over_prediction', num(3), n),
    n => set('sou_under_prediction', num(3), n),
    n => set('sou_martingale', num(2), n),
    n => set('sou_duration', num(1), n),
    n => set('sou_take_profit', num(10), n),
    n => set('sou_stop_loss', num(50), n),
    () => callFunction(RESET_NAME, 'sou_reset_call'),
]);

const purchasePair = `<block type="digit_hedge_purchase">
        <value name="OVER">${v('sou_over_prediction')}</value>
        <value name="UNDER">${v('sou_under_prediction')}</value>
        <value name="OVER_STAKE">${v('sou_over_amount')}</value>
        <value name="UNDER_STAKE">${v('sou_under_amount')}</value>
        <value name="TAKE_PROFIT">${v('sou_take_profit')}</value>
        <value name="STOP_LOSS">${v('sou_stop_loss')}</value>
      </block>`;

const nextStake = (leg: 'over' | 'under', amount: 'sou_over_amount' | 'sou_under_amount', initial: 'sou_over_stake' | 'sou_under_stake') =>
    `<block type="digit_hedge_next_stake">
        <field name="LEG">${leg}</field>
        <value name="CURRENT">${v(amount)}</value>
        <value name="INITIAL">${v(initial)}</value>
        <value name="MULTIPLIER">${v('sou_martingale')}</value>
      </block>`;

const CONTINUE_AFTER_LIMITS = chain([
    n => set('sou_over_amount', nextStake('over', 'sou_over_amount', 'sou_over_stake'), n),
    n => set('sou_under_amount', nextStake('under', 'sou_under_amount', 'sou_under_stake'), n),
    () => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="digit_hedge_continues"></block></value>
        <statement name="DO0">${notify(
            'info',
            [
                text('PAIR SETTLED | net'),
                v('sou_result'),
                text('| total'),
                v('sou_total'),
                text('| next Over'),
                v('sou_over_amount'),
                text('| next Under'),
                v('sou_under_amount'),
            ],
            '<block type="trade_again"></block>'
        )}</statement>
        <statement name="ELSE">${notify('error', [
            text('PAIR STOPPED | both legs must settle; Martingale must be greater than 1 after a double loss.'),
        ])}</statement>
      </block>`,
]);

const bookProfit = `<block type="digit_hedge_book_profit">
        <value name="TOTAL">${v('sou_total')}</value>
        <value name="PROFIT">${v('sou_result')}</value>
        <value name="TAKE_PROFIT">${v('sou_take_profit')}</value>
        <value name="STOP_LOSS">${v('sou_stop_loss')}</value>
      </block>`;

const checkLimits = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${compare('EQ', '<block type="digit_hedge_limit"></block>', num(1))}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | total'), v('sou_total')])}</statement>
        <value name="IF1">${compare('EQ', '<block type="digit_hedge_limit"></block>', num(-1))}</value>
        <statement name="DO1">${notify('error', [text('Stop loss reached | total'), v('sou_total')])}</statement>
        <statement name="ELSE">${CONTINUE_AFTER_LIMITS}</statement>
      </block>`;

const AFTER_PURCHASE = set(
    'sou_result',
    '<block type="digit_hedge_result"></block>',
    `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">${compare('NEQ', '<block type="digit_hedge_decision"></block>', num(0))}</value>
        <statement name="DO0">${set('sou_total', bookProfit, checkLimits)}</statement>
        <statement name="ELSE">${notify('error', [text('PAIR STOPPED | both results must be confirmed.')])}</statement>
      </block>`
);

export const SIMULTANEOUS_OVER_UNDER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="sou_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="sou_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="sou_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="sou_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="sou_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="sou_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="sou_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="sou_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('sou_duration')}</value>
        <value name="AMOUNT">${v('sou_over_amount')}</value>
        <value name="PREDICTION">${v('sou_over_prediction')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="sou_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${purchasePair}
    </statement>
  </block>
  <block type="after_purchase" id="sou_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
  ${RESET}
</xml>`;
