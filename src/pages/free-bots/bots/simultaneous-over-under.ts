/**
 * Simultaneous Over/Under hedge (Volatility 75 (1s) Index).
 *
 * Every available tick can start one pair: Over 5 and Under 4. The runtime
 * quotes and buys both legs in parallel, then keeps the pair only when both
 * fills use the same entry tick. A partial or mismatched fill is cancelled and
 * the bot stops rather than leaving a one-sided position open.
 *
 * The two stakes are independent. When both legs lose, each amount is
 * multiplied by Martingale; when either leg wins, both return to their base
 * stake. Duration is in ticks. The current-tick runner rechecks immediately
 * when a completed pair hands control back to Before Purchase.
 */

import { blockHelpers, callFunction, defineFunction } from './blocks';

const VARIABLES: [string, string][] = [
    ['sou_over_stake', 'Over Stake'],
    ['sou_under_stake', 'Under Stake'],
    ['sou_martingale', 'Martingale'],
    ['sou_duration', 'Duration (ticks)'],
    ['sou_over_amount', 'Current Over Stake'],
    ['sou_under_amount', 'Current Under Stake'],
    ['sou_result', 'Last Hedge Result'],
    ['sou_msg', 'Journal Message'],
];

const { v, num, text, set, chain, notify } = blockHelpers(VARIABLES, 'sou_msg');

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
        () => set('sou_result', num(0)),
    ])
);

const INIT = chain([
    n => set('sou_over_stake', num(1), n),
    n => set('sou_under_stake', num(1), n),
    n => set('sou_martingale', num(2), n),
    n => set('sou_duration', num(1), n),
    () => callFunction(RESET_NAME, 'sou_reset_call'),
]);

const purchasePair = `<block type="digit_hedge_purchase">
        <value name="OVER">${num(5)}</value>
        <value name="UNDER">${num(4)}</value>
        <value name="OVER_STAKE">${v('sou_over_amount')}</value>
        <value name="UNDER_STAKE">${v('sou_under_amount')}</value>
      </block>`;

const nextStake = (leg: 'over' | 'under', amount: 'sou_over_amount' | 'sou_under_amount', initial: 'sou_over_stake' | 'sou_under_stake') =>
    `<block type="digit_hedge_next_stake">
        <field name="LEG">${leg}</field>
        <value name="CURRENT">${v(amount)}</value>
        <value name="INITIAL">${v(initial)}</value>
        <value name="MULTIPLIER">${v('sou_martingale')}</value>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('sou_result', `<block type="digit_hedge_result"></block>`, n),
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
        <value name="PREDICTION">${num(5)}</value>
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
