/**
 * Pattern Switch free bot.
 *
 * Signals (first match):
 *   last 4 all odd  → Purchase Even
 *   last 4 all even → Purchase Odd
 *   last 3 all ≤ 3  → Override Over (prediction 4)
 *   last 3 all ≥ 6  → Override Under (prediction 5)
 *
 * Martingale on loss; re-analyse after N wins; take-profit / stop-loss.
 *
 * Uses only supported workspace blocks (pattern_switch_scan + purchase/override).
 */

export const PATTERN_SWITCH_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="kp_stake">Stake</variable>
    <variable id="kp_martingale">Martingale</variable>
    <variable id="kp_signal">Entry Signal</variable>
    <variable id="kp_take_profit">Take Profit</variable>
    <variable id="kp_base_stake">Stake []</variable>
    <variable id="kp_runs">Runs</variable>
    <variable id="kp_direction">Trade Direction</variable>
    <variable id="kp_stop_loss">Stop Loss</variable>
    <variable id="kp_reanalyse">Re Analyse After</variable>
    <variable id="kp_prediction">Prediction:</variable>
  </variables>
  <block type="trade_definition" id="kp_trade_def" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="kp_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_25</field>
        <next>
          <block type="trade_definition_tradetype" id="kp_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="kp_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="kp_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="kp_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="kp_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="kp_set_stake">
        <field name="VAR" id="kp_stake">Stake</field>
        <value name="VALUE"><block type="math_number"><field name="NUM">0.5</field></block></value>
        <next>
          <block type="variables_set" id="kp_set_mart">
            <field name="VAR" id="kp_martingale">Martingale</field>
            <value name="VALUE"><block type="math_number"><field name="NUM">2</field></block></value>
            <next>
              <block type="variables_set" id="kp_set_tp">
                <field name="VAR" id="kp_take_profit">Take Profit</field>
                <value name="VALUE"><block type="math_number"><field name="NUM">10</field></block></value>
                <next>
                  <block type="variables_set" id="kp_set_sl">
                    <field name="VAR" id="kp_stop_loss">Stop Loss</field>
                    <value name="VALUE"><block type="math_number"><field name="NUM">50</field></block></value>
                    <next>
                      <block type="variables_set" id="kp_set_re">
                        <field name="VAR" id="kp_reanalyse">Re Analyse After</field>
                        <value name="VALUE"><block type="math_number"><field name="NUM">3</field></block></value>
                        <next>
                          <block type="variables_set" id="kp_set_sig">
                            <field name="VAR" id="kp_signal">Entry Signal</field>
                            <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
                            <next>
                              <block type="variables_set" id="kp_set_base">
                                <field name="VAR" id="kp_base_stake">Stake []</field>
                                <value name="VALUE"><block type="variables_get"><field name="VAR" id="kp_stake">Stake</field></block></value>
                                <next>
                                  <block type="variables_set" id="kp_set_runs">
                                    <field name="VAR" id="kp_runs">Runs</field>
                                    <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                    <next>
                                      <block type="variables_set" id="kp_set_pred0">
                                        <field name="VAR" id="kp_prediction">Prediction:</field>
                                        <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
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
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="kp_scan_loop">
        <field name="MODE">UNTIL</field>
        <value name="BOOL"><block type="variables_get"><field name="VAR" id="kp_signal">Entry Signal</field></block></value>
        <statement name="DO">
          <block type="timeout" id="kp_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="kp_scan_dir">
                <field name="VAR" id="kp_direction">Trade Direction</field>
                <value name="VALUE">
                  <block type="pattern_switch_scan" id="kp_scan_block">
                    <value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="kp_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A"><block type="variables_get"><field name="VAR" id="kp_direction">Trade Direction</field></block></value>
                        <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set" id="kp_arm_signal">
                        <field name="VAR" id="kp_signal">Entry Signal</field>
                        <value name="VALUE"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
                        <next>
                          <block type="controls_if" id="kp_set_barrier">
                            <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                            <value name="IF0">
                              <block type="logic_compare"><field name="OP">EQ</field>
                                <value name="A"><block type="variables_get"><field name="VAR" id="kp_direction">Trade Direction</field></block></value>
                                <value name="B"><block type="math_number"><field name="NUM">4</field></block></value>
                              </block>
                            </value>
                            <statement name="DO0">
                              <block type="variables_set"><field name="VAR" id="kp_prediction">Prediction:</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">4</field></block></value>
                              </block>
                            </statement>
                            <value name="IF1">
                              <block type="logic_compare"><field name="OP">EQ</field>
                                <value name="A"><block type="variables_get"><field name="VAR" id="kp_direction">Trade Direction</field></block></value>
                                <value name="B"><block type="math_number"><field name="NUM">5</field></block></value>
                              </block>
                            </value>
                            <statement name="DO1">
                              <block type="variables_set"><field name="VAR" id="kp_prediction">Prediction:</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                              </block>
                            </statement>
                            <statement name="ELSE">
                              <block type="variables_set"><field name="VAR" id="kp_prediction">Prediction:</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                              </block>
                            </statement>
                          </block>
                        </next>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS"><block type="math_number"><field name="NUM">1</field></block></value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="kp_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION"><shadow type="math_number_positive"><field name="NUM">1</field></shadow></value>
            <value name="AMOUNT"><block type="variables_get"><field name="VAR" id="kp_stake">Stake</field></block></value>
            <value name="PREDICTION"><block type="variables_get"><field name="VAR" id="kp_prediction">Prediction:</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="kp_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="kp_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set"><field name="VAR" id="kp_stake">Stake</field>
            <value name="VALUE"><block type="variables_get"><field name="VAR" id="kp_base_stake">Stake []</field></block></value>
            <next>
              <block type="math_change"><field name="VAR" id="kp_runs">Runs</field>
                <value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
                <next>
                  <block type="controls_if">
                    <value name="IF0">
                      <block type="logic_compare"><field name="OP">GTE</field>
                        <value name="A"><block type="variables_get"><field name="VAR" id="kp_runs">Runs</field></block></value>
                        <value name="B"><block type="variables_get"><field name="VAR" id="kp_reanalyse">Re Analyse After</field></block></value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set"><field name="VAR" id="kp_signal">Entry Signal</field>
                        <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
                        <next>
                          <block type="variables_set"><field name="VAR" id="kp_runs">Runs</field>
                            <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                            <next>
                              <block type="variables_set"><field name="VAR" id="kp_stake">Stake</field>
                                <value name="VALUE"><block type="variables_get"><field name="VAR" id="kp_base_stake">Stake []</field></block></value>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set"><field name="VAR" id="kp_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A"><block type="variables_get"><field name="VAR" id="kp_stake">Stake</field></block></value>
                <value name="B"><block type="variables_get"><field name="VAR" id="kp_martingale">Martingale</field></block></value>
              </block>
            </value>
          </block>
        </statement>
        <next>
          <block type="controls_if">
            <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
            <value name="IF0">
              <block type="logic_compare"><field name="OP">GTE</field>
                <value name="A"><block type="total_profit"></block></value>
                <value name="B"><block type="variables_get"><field name="VAR" id="kp_take_profit">Take Profit</field></block></value>
              </block>
            </value>
            <statement name="DO0">
              <block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">Take Profit reached</field></shadow></value></block>
            </statement>
            <value name="IF1">
              <block type="logic_compare"><field name="OP">LTE</field>
                <value name="A"><block type="total_profit"></block></value>
                <value name="B">
                  <block type="math_single"><field name="OP">NEG</field>
                    <value name="NUM"><block type="variables_get"><field name="VAR" id="kp_stop_loss">Stop Loss</field></block></value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO1">
              <block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">Stop Loss reached</field></shadow></value></block>
            </statement>
            <statement name="ELSE"><block type="trade_again"></block></statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="kp_before" deletable="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="kp_buy_if">
        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="3"></mutation>
        <value name="IF0">
          <block type="logic_compare"><field name="OP">EQ</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="kp_direction">Trade Direction</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="override_contract_type_purchase" id="kp_buy_even"><field name="CONTRACT_TYPE">DIGITEVEN</field></block>
        </statement>
        <value name="IF1">
          <block type="logic_compare"><field name="OP">EQ</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="kp_direction">Trade Direction</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">1</field></block></value>
          </block>
        </value>
        <statement name="DO1">
          <block type="override_contract_type_purchase" id="kp_buy_odd"><field name="CONTRACT_TYPE">DIGITODD</field></block>
        </statement>
        <value name="IF2">
          <block type="logic_compare"><field name="OP">EQ</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="kp_direction">Trade Direction</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">4</field></block></value>
          </block>
        </value>
        <statement name="DO2">
          <block type="override_contract_type_purchase" id="kp_buy_over"><field name="CONTRACT_TYPE">DIGITOVER</field></block>
        </statement>
        <value name="IF3">
          <block type="logic_compare"><field name="OP">EQ</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="kp_direction">Trade Direction</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">5</field></block></value>
          </block>
        </value>
        <statement name="DO3">
          <block type="override_contract_type_purchase" id="kp_buy_under"><field name="CONTRACT_TYPE">DIGITUNDER</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
