/**
 * Jump 10 Differs free bot.
 *
 * Buys Differs on Jump 10 (JD10), 1 tick. The barrier is the last digit plus 1
 * when that sum is still below 9 (last digit 0–7). Last digit 8 or 9 uses the
 * last digit minus 1. A win returns the stake to 2. A loss sets the next stake
 * to the base stake times 10.5, and does not multiply the raised stake again.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['jdf_stake', 'Stake'],
    ['jdf_amount', 'Amount'],
    ['jdf_martingale', 'Martingale'],
];

const { v, num, set, chain, arith, compare } = blockHelpers(VARIABLES, 'jdf_amount');

const lastDigit = () => `<block type="last_digit"></block>`;

/** Last digit + 1 while that is below 9; otherwise last digit − 1. */
const PREDICTION = `<block type="logic_ternary">
        <value name="IF">${compare('LT', arith('ADD', lastDigit(), num(1)), num(9))}</value>
        <value name="THEN">${arith('ADD', lastDigit(), num(1))}</value>
        <value name="ELSE">${arith('MINUS', lastDigit(), num(1))}</value>
      </block>`;

const INIT = chain([
    n => set('jdf_stake', num(2), n),
    n => set('jdf_martingale', num(10.5), n),
    n => set('jdf_amount', v('jdf_stake'), n),
]);

const BEFORE_PURCHASE = `<block type="purchase"><field name="PURCHASE_LIST">DIGITDIFF</field></block>`;

const AFTER_PURCHASE = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${set('jdf_amount', v('jdf_stake'))}</statement>
        <statement name="ELSE">${set('jdf_amount', arith('MULTIPLY', v('jdf_stake'), v('jdf_martingale')))}</statement>
        <next><block type="trade_again"></block></next>
      </block>`;

export const JUMP_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="jdf_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="jdf_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">jump_index</field>
        <field name="SYMBOL_LIST">JD10</field>
        <next>
          <block type="trade_definition_tradetype" id="jdf_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="jdf_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="jdf_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="jdf_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="jdf_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="jdf_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${num(1)}</value>
        <value name="AMOUNT">${v('jdf_amount')}</value>
        <value name="PREDICTION">${PREDICTION}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="jdf_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK">
      ${BEFORE_PURCHASE}
    </statement>
  </block>
  <block type="after_purchase" id="jdf_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      ${AFTER_PURCHASE}
    </statement>
  </block>
</xml>`;
