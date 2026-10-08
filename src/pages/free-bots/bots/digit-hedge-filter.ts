/**
 * Selective Over 5 + Under 4 hedge (Volatility 75 (1s) Index).
 *
 * Enters only when the last 100 ticks keep 4 and 5 quiet, 0–3 and 6–9 are
 * both at least 40%, the latest 20 ticks are not gaining 4s and 5s, and no
 * repeated 3-digit sequence points at 4 or 5. Both contracts use the same
 * stake and duration. The stake stays put after a win or a loss. A hedge that
 * does not finish on both sides stops.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['dhf_stake', 'Stake'],
    ['dhf_duration', 'Duration (ticks)'],
    ['dhf_window', 'Main Window'],
    ['dhf_recent', 'Recent Window'],
    ['dhf_max_gap', 'Maximum Gap %'],
    ['dhf_min_low', 'Minimum Low Group %'],
    ['dhf_min_high', 'Minimum High Group %'],
    ['dhf_max_4', 'Maximum Digit 4 %'],
    ['dhf_max_5', 'Maximum Digit 5 %'],
    ['dhf_pattern', 'Pattern Repetition'],
    ['dhf_profit', 'Last Profit'],
];

const { v, num, set, chain, compare } = blockHelpers(VARIABLES, 'dhf_profit');

const FILTER = `<block type="digit_hedge_filter">
        <value name="WINDOW">${v('dhf_window')}</value>
        <value name="RECENT">${v('dhf_recent')}</value>
        <value name="MAX_GAP">${v('dhf_max_gap')}</value>
        <value name="MIN_LOW">${v('dhf_min_low')}</value>
        <value name="MIN_HIGH">${v('dhf_min_high')}</value>
        <value name="MAX_4">${v('dhf_max_4')}</value>
        <value name="MAX_5">${v('dhf_max_5')}</value>
        <value name="PATTERN">${v('dhf_pattern')}</value>
      </block>`;

const BUY = `<block type="digit_hedge_purchase"><value name="OVER">${num(5)}</value><value name="UNDER">${num(4)}</value></block>`;

const ANALYSE = `<block type="controls_if">
        <value name="IF0">${compare('EQ', FILTER, num(1))}</value>
        <statement name="DO0">${BUY}</statement>
      </block>`;

const DECISION = `<block type="digit_hedge_decision"></block>`;

const AFTER_PURCHASE = chain([
    n => set('dhf_profit', `<block type="digit_hedge_result"></block>`, n),
    () => `<block type="controls_if">
        <value name="IF0">${compare('NEQ', DECISION, num(0))}</value>
        <statement name="DO0"><block type="trade_again"></block></statement>
      </block>`,
]);

const INIT = chain([
    n => set('dhf_stake', num(1), n),
    n => set('dhf_duration', num(1), n),
    n => set('dhf_window', num(100), n),
    n => set('dhf_recent', num(20), n),
    n => set('dhf_max_gap', num(10), n),
    n => set('dhf_min_low', num(40), n),
    n => set('dhf_min_high', num(40), n),
    n => set('dhf_max_4', num(7), n),
    n => set('dhf_max_5', num(7), n),
    n => set('dhf_pattern', num(3), n),
    () => set('dhf_profit', num(0)),
]);

export const DIGIT_HEDGE_FILTER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="dhf_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="dhf_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="dhf_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="dhf_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITOVER</field>
                <next>
                  <block type="trade_definition_candleinterval" id="dhf_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="dhf_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="dhf_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="dhf_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('dhf_duration')}</value>
        <value name="AMOUNT">${v('dhf_stake')}</value>
        <value name="PREDICTION">${num(5)}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="dhf_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${ANALYSE}
    </statement>
  </block>
  <block type="after_purchase" id="dhf_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
