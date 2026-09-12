/**
 * Individual Digit Suppression Strategy free bot.
 *
 * Multi-window digit frequency → suppression vs 10% baseline → Over 1 only
 * (losing digits 0–1). Locked to Over 1 so a future recovery layer can stay
 * on a single contract type. Thresholds remain Bot Builder variables.
 */

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="ids_set_${id}">
      <field name="VAR" id="${id}">${name}</field>
      <value name="VALUE">${valueXml}</value>
      ${nextXml ? `<next>${nextXml}</next>` : ''}
    </block>`;

/** Nest variables_set chain (first = outermost). */
const chainSets = entries => {
    let xml = '';
    for (let i = entries.length - 1; i >= 0; i--) {
        const [id, name, valueXml] = entries[i];
        xml = setVar(id, name, valueXml, xml);
    }
    return xml;
};

export const INDIVIDUAL_DIGIT_SUPPRESSION_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="ids_stake">Stake</variable>
    <variable id="ids_base_stake">Base Stake</variable>
    <variable id="ids_take_profit">Take Profit</variable>
    <variable id="ids_stop_loss">Stop Loss</variable>
    <variable id="ids_short">Short Window</variable>
    <variable id="ids_medium">Medium Window</variable>
    <variable id="ids_long">Long Window</variable>
    <variable id="ids_min_supp">Minimum Suppression %</variable>
    <variable id="ids_mod">Moderate Threshold</variable>
    <variable id="ids_high">High Suppression Threshold</variable>
    <variable id="ids_vhigh">Very High Suppression Threshold</variable>
    <variable id="ids_min_windows">Minimum Confirmation Windows</variable>
    <variable id="ids_min_score">Minimum Signal Score</variable>
    <variable id="ids_persist">Require Persistence</variable>
    <variable id="ids_trend">Require Trend Confirmation</variable>
    <variable id="ids_cooldown_signal">Cooldown After Signal</variable>
    <variable id="ids_cooldown_loss">Cooldown After Loss</variable>
    <variable id="ids_cooldown_win">Cooldown After Win</variable>
    <variable id="ids_signal">Entry Signal</variable>
    <variable id="ids_prediction">Prediction</variable>
    <variable id="ids_duration">Trade Duration</variable>
  </variables>
  <block type="trade_definition" id="ids_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ids_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_10</field>
        <next>
          <block type="trade_definition_tradetype" id="ids_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="ids_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ids_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="ids_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="ids_restart_err" deletable="false" movable="false">
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
      ${chainSets([
          ['ids_stake', 'Stake', num(0.5)],
          ['ids_base_stake', 'Base Stake', num(0.5)],
          ['ids_take_profit', 'Take Profit', num(20)],
          ['ids_stop_loss', 'Stop Loss', num(50)],
          ['ids_short', 'Short Window', num(50)],
          ['ids_medium', 'Medium Window', num(100)],
          ['ids_long', 'Long Window', num(200)],
          ['ids_min_supp', 'Minimum Suppression %', num(0)],
          ['ids_mod', 'Moderate Threshold', num(3)],
          ['ids_high', 'High Suppression Threshold', num(5)],
          ['ids_vhigh', 'Very High Suppression Threshold', num(7)],
          ['ids_min_windows', 'Minimum Confirmation Windows', num(2)],
          ['ids_min_score', 'Minimum Signal Score', num(6)],
          ['ids_persist', 'Require Persistence', bool(true)],
          ['ids_trend', 'Require Trend Confirmation', bool(false)],
          ['ids_cooldown_signal', 'Cooldown After Signal', num(2)],
          ['ids_cooldown_loss', 'Cooldown After Loss', num(5)],
          ['ids_cooldown_win', 'Cooldown After Win', num(2)],
          ['ids_duration', 'Trade Duration', num(1)],
          ['ids_signal', 'Entry Signal', bool(false)],
          ['ids_prediction', 'Prediction', num(-1)],
      ])}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="ids_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('ids_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="ids_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="ids_scan_pred">
                <field name="VAR" id="ids_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="individual_digit_suppression_scan" id="ids_scan_block">
                    <value name="SHORT_WINDOW">${varGet('ids_short', 'Short Window')}</value>
                    <value name="MEDIUM_WINDOW">${varGet('ids_medium', 'Medium Window')}</value>
                    <value name="LONG_WINDOW">${varGet('ids_long', 'Long Window')}</value>
                    <value name="MIN_SUPPRESSION">${varGet('ids_min_supp', 'Minimum Suppression %')}</value>
                    <value name="MODERATE_THRESHOLD">${varGet('ids_mod', 'Moderate Threshold')}</value>
                    <value name="HIGH_THRESHOLD">${varGet('ids_high', 'High Suppression Threshold')}</value>
                    <value name="VERY_HIGH_THRESHOLD">${varGet('ids_vhigh', 'Very High Suppression Threshold')}</value>
                    <value name="MIN_CONFIRM_WINDOWS">${varGet('ids_min_windows', 'Minimum Confirmation Windows')}</value>
                    <value name="MIN_SIGNAL_SCORE">${varGet('ids_min_score', 'Minimum Signal Score')}</value>
                    <value name="REQUIRE_PERSISTENCE">${varGet('ids_persist', 'Require Persistence')}</value>
                    <value name="REQUIRE_TREND">${varGet('ids_trend', 'Require Trend Confirmation')}</value>
                    <value name="ENABLE_OVER_1">${bool(true)}</value>
                    <value name="ENABLE_OVER_2">${bool(false)}</value>
                    <value name="ENABLE_OVER_3">${bool(false)}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="ids_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">EQ</field>
                        <value name="A">${varGet('ids_prediction', 'Prediction')}</value>
                        <value name="B">${num(1)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="ids_prediction">Prediction</field>
                        <value name="VALUE">${num(1)}</value>
                        <next>
                          <block type="variables_set">
                            <field name="VAR" id="ids_signal">Entry Signal</field>
                            <value name="VALUE">${bool(true)}</value>
                          </block>
                        </next>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${varGet('ids_cooldown_signal', 'Cooldown After Signal')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="ids_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${varGet('ids_duration', 'Trade Duration')}</value>
            <value name="AMOUNT">${varGet('ids_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('ids_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="ids_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="ids_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="ids_stake">Stake</field>
            <value name="VALUE">${varGet('ids_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="ids_signal">Entry Signal</field>
                <value name="VALUE">${bool(false)}</value>
                <next>
                  <block type="timeout" id="ids_win_cd">
                    <statement name="TIMEOUTSTACK">
                      <block type="controls_if">
                        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                        <value name="IF0">
                          <block type="logic_compare"><field name="OP">GTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">${varGet('ids_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="ids_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('ids_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="ids_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${varGet('ids_cooldown_win', 'Cooldown After Win')}</value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="ids_signal">Entry Signal</field>
            <value name="VALUE">${bool(false)}</value>
            <next>
              <block type="timeout" id="ids_loss_cd">
                <statement name="TIMEOUTSTACK">
                  <block type="controls_if">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                    <value name="IF0">
                      <block type="logic_compare"><field name="OP">GTE</field>
                        <value name="A"><block type="total_profit"></block></value>
                        <value name="B">${varGet('ids_take_profit', 'Take Profit')}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="ids_signal">Entry Signal</field>
                        <value name="VALUE">${bool(false)}</value>
                      </block>
                    </statement>
                    <value name="IF1">
                      <block type="logic_compare"><field name="OP">LTE</field>
                        <value name="A"><block type="total_profit"></block></value>
                        <value name="B">
                          <block type="math_single"><field name="OP">NEG</field>
                            <value name="NUM">${varGet('ids_stop_loss', 'Stop Loss')}</value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO1">
                      <block type="variables_set">
                        <field name="VAR" id="ids_signal">Entry Signal</field>
                        <value name="VALUE">${bool(false)}</value>
                      </block>
                    </statement>
                    <statement name="ELSE"><block type="trade_again"></block></statement>
                  </block>
                </statement>
                <value name="SECONDS">${varGet('ids_cooldown_loss', 'Cooldown After Loss')}</value>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="ids_before" deletable="false" collapsed="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="override_contract_type_purchase" id="ids_buy_over">
        <field name="CONTRACT_TYPE">DIGITOVER</field>
      </block>
    </statement>
  </block>
</xml>`;
