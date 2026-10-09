/**
 * Seconds Differs.
 *
 * Buys Differs on the last digit of the current seconds (09:54:01 → 1, 09:54:15 → 5).
 * Bull Market Index. Payout 9.6% and 1 recovery run size the next stake.
 * Stops at $5 total profit, or after 5 losses in a row. A win clears that streak.
 */

import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['mgd_stake', 'Stake'],
    ['mgd_payout', 'Payout %'],
    ['mgd_runs', 'Recovery runs'],
    ['mgd_take_profit', 'Take Profit'],
    ['mgd_max_losses', 'Stop Loss (losses in a row)'],
    ['mgd_total', 'Total Profit'],
    ['mgd_profit', 'Last Profit'],
    ['mgd_losses', 'Losses in a row'],
    ['mgd_msg', 'Journal Message'],
];

const { v, num, text, set, chain, arith, round2, compare, and, notify } = blockHelpers(VARIABLES, 'mgd_msg');

const configure = (next = '') => `<block type="recovery_configure">
        <value name="STAKE">${v('mgd_stake')}</value>
        <value name="PAYOUT">${v('mgd_payout')}</value>
        <value name="SPLITS">${v('mgd_runs')}</value>
        ${next ? `<next>${next}</next>` : ''}
      </block>`;

const INIT = chain([
    n => set('mgd_stake', num(2), n),
    n => set('mgd_payout', num(9.6), n),
    n => set('mgd_runs', num(1), n),
    n => set('mgd_take_profit', num(5), n),
    n => set('mgd_max_losses', num(5), n),
    n => set('mgd_total', num(0), n),
    n => set('mgd_losses', num(0), n),
    () => configure(),
]);

const BEFORE_PURCHASE = `<block type="controls_if">
        <value name="IF0">${compare('EQ', '<block type="middle_gap_differ"></block>', num(1))}</value>
        <statement name="DO0"><block type="purchase"><field name="PURCHASE_LIST">DIGITDIFF</field></block></statement>
      </block>`;

/** A blank or invalid loss cap stops after 5 losses. Take profit of 0 does not stop. */
const stopAfter = `<block type="logic_ternary">
        <value name="IF">${compare('LT', v('mgd_max_losses'), num(1))}</value>
        <value name="THEN">${num(5)}</value>
        <value name="ELSE">${v('mgd_max_losses')}</value>
      </block>`;

const LIMITS = `<block type="controls_if">
        <mutation elseif="1" else="1"></mutation>
        <value name="IF0">${and(
            compare('GT', v('mgd_take_profit'), num(0)),
            compare('GTE', v('mgd_total'), v('mgd_take_profit'))
        )}</value>
        <statement name="DO0">${notify('success', [text('Take profit reached | P/L'), v('mgd_total')])}</statement>
        <value name="IF1">${compare('GTE', v('mgd_losses'), stopAfter)}</value>
        <statement name="DO1">${notify('error', [
            text('Stop loss reached |'),
            v('mgd_losses'),
            text('losses in a row | P/L'),
            v('mgd_total'),
        ])}</statement>
        <statement name="ELSE"><block type="trade_again"></block></statement>
      </block>`;

const STREAK = `<block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${set('mgd_losses', num(0))}</statement>
        <statement name="ELSE">${set('mgd_losses', arith('ADD', v('mgd_losses'), num(1)))}</statement>
        <next>${LIMITS}</next>
      </block>`;

const AFTER_PURCHASE = chain([
    n => set('mgd_profit', `<block type="read_details"><field name="DETAIL_INDEX">4</field></block>`, n),
    n => set('mgd_total', round2(arith('ADD', v('mgd_total'), v('mgd_profit'))), n),
    () =>
        configure(`<block type="recovery_apply_result">
        <value name="IS_WIN"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <value name="PROFIT">${v('mgd_profit')}</value>
        <next>${STREAK}</next>
      </block>`),
]);

export const MIDDLE_GAP_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, label]) => `    <variable id="${id}">${label}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="mgd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="mgd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_daily</field>
        <field name="SYMBOL_LIST">RDBULL</field>
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
        <value name="AMOUNT"><block type="recovery_stake"></block></value>
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
