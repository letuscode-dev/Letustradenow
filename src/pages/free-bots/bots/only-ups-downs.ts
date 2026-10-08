/**
 * Only Ups / Only Downs (Volatility 75 (1s)).
 *
 * The latest four last digits decide the trade. All of them below 5 buy Only
 * Ups. All of them above 4 buy Only Downs. A mix does nothing. The same tick
 * cannot open a second trade. After a trade, the next entry waits for a new
 * four-digit window. A loss multiplies the stake by exactly 1.5. A win returns
 * to the base stake. Only Ups and Only Downs need 2 ticks.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['oud_stake', 'Base Stake'],
    ['oud_duration', 'Duration (ticks)'],
    ['oud_current', 'Current Stake'],
    ['oud_level', 'Martingale Level'],
    ['oud_previous', 'Previous Stake'],
    ['oud_signal', 'Signal'],
    ['oud_text', 'Journal Text'],
];

const { v, num, set, chain, arith, compare } = blockHelpers(VARIABLES, 'oud_text');

const buy = (contract: 'RUNHIGH' | 'RUNLOW') =>
    `<block type="purchase"><field name="PURCHASE_LIST">${contract}</field></block>`;

const SIGNAL = `<block type="only_ups_downs_signal"><value name="STAKE">${v('oud_current')}</value><value name="LEVEL">${v('oud_level')}</value></block>`;

const RESULT = (won: number) => `<block type="only_ups_downs_result">
        <value name="WON">${num(won)}</value>
        <value name="PREVIOUS">${v('oud_previous')}</value>
        <value name="NEXT">${v('oud_current')}</value>
      </block>`;

const BEFORE_PURCHASE = set(
    'oud_signal',
    SIGNAL,
    `<block type="controls_if">
        <mutation elseif="1"></mutation>
        <value name="IF0">${compare('EQ', v('oud_signal'), num(1))}</value>
        <statement name="DO0">${buy('RUNHIGH')}</statement>
        <value name="IF1">${compare('EQ', v('oud_signal'), num(-1))}</value>
        <statement name="DO1">${buy('RUNLOW')}</statement>
      </block>`
);

const WIN = set('oud_current', v('oud_stake'), set('oud_level', num(0), RESULT(1)));

const LOSS = set(
    'oud_current',
    arith('MULTIPLY', v('oud_current'), num(1.5)),
    set('oud_level', arith('ADD', v('oud_level'), num(1)), RESULT(0))
);

const AFTER_PURCHASE = chain([
    n => set('oud_previous', v('oud_current'), n),
    () => `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${WIN}</statement>
        <statement name="ELSE">${LOSS}</statement>
        <next><block type="trade_again"></block></next>
      </block>`,
]);

const INIT = chain([
    n => set('oud_stake', num(1), n),
    n => set('oud_duration', num(2), n),
    n => set('oud_current', v('oud_stake'), n),
    n => set('oud_level', num(0), n),
    () => set('oud_previous', num(0)),
]);

export const ONLY_UPS_DOWNS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
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
            <field name="TRADETYPECAT_LIST">runs</field>
            <field name="TRADETYPE_LIST">runs</field>
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
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('oud_duration')}</value>
        <value name="AMOUNT">${v('oud_current')}</value>
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
