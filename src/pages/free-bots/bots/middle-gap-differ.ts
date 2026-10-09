/**
 * Jump 10 Middle Differs.
 *
 * Buys Differs only when the digit two ticks ago minus the latest digit is 2.
 * The barrier is the digit between them (8 then 6 → differ 7). Stake rules match
 * Jump 10 Differs: a win returns to 2, a loss sets the stake times 10.5 once.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['mgd_stake', 'Stake'],
    ['mgd_amount', 'Amount'],
    ['mgd_martingale', 'Martingale'],
];

const { v, num, set, chain, arith, compare } = blockHelpers(VARIABLES, 'mgd_amount');

const INIT = chain([
    n => set('mgd_stake', num(2), n),
    n => set('mgd_martingale', num(10.5), n),
    n => set('mgd_amount', v('mgd_stake'), n),
]);

const BEFORE_PURCHASE = `<block type="controls_if">
        <value name="IF0">${compare('EQ', '<block type="middle_gap_differ"></block>', num(1))}</value>
        <statement name="DO0"><block type="purchase"><field name="PURCHASE_LIST">DIGITDIFF</field></block></statement>
      </block>`;

const AFTER_PURCHASE = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${set('mgd_amount', v('mgd_stake'))}</statement>
        <statement name="ELSE">${set('mgd_amount', arith('MULTIPLY', v('mgd_stake'), v('mgd_martingale')))}</statement>
        <next><block type="trade_again"></block></next>
      </block>`;

export const MIDDLE_GAP_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="mgd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="mgd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">jump_index</field>
        <field name="SYMBOL_LIST">JD10</field>
        <next>
          <block type="trade_definition_tradetype" id="mgd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="mgd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="mgd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="mgd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="mgd_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="mgd_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('mgd_amount')}</value>
        <value name="PREDICTION">${num(0)}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="mgd_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="mgd_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
