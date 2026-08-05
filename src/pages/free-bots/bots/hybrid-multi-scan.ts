/**
 * Hybrid Multi-Scan free bot.
 *
 * Combines on the active market:
 *   Odd Pair Over · Even Pair Under · Pattern Probability · Sequential Differs · Hot Digit
 *
 * Purchases via override contract type (DIGITOVER / DIGITUNDER / DIGITDIFF).
 * Recovery stake uses Payout_OU (default 60) or Payout_Differs (default 9.6).
 */

export const HYBRID_MULTI_SCAN_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="hyb_stake">Stake</variable>
    <variable id="hyb_inarow">InArow</variable>
    <variable id="hyb_maxloss">Max Cons Loss:</variable>
    <variable id="hyb_totalloss">Total_loss</variable>
    <variable id="hyb_prediction">Prediction:</variable>
    <variable id="hyb_signal">Signal:</variable>
    <variable id="hyb_ccode">Contract_code</variable>
    <variable id="hyb_profit">Profit Threshold:</variable>
    <variable id="hyb_initstake">Initial_stake</variable>
    <variable id="hyb_payout_ou">Payout_OU%</variable>
    <variable id="hyb_payout_diff">Payout_Differs%</variable>
    <variable id="hyb_duration">Duration</variable>
    <variable id="hyb_oddmax">Digit_min</variable>
    <variable id="hyb_evenmin">Digit_max</variable>
    <variable id="hyb_plb">Pattern_lookback</variable>
    <variable id="hyb_hlb">Hot_lookback</variable>
  </variables>
  <block type="trade_definition" id="hyb_trade_def" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="hyb_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="hyb_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="hyb_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="hyb_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="hyb_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="hyb_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="hyb_set_stake">
        <field name="VAR" id="hyb_stake">Stake</field>
        <value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value>
        <next>
          <block type="variables_set" id="hyb_set_duration">
            <field name="VAR" id="hyb_duration">Duration</field>
            <value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
            <next>
              <block type="variables_set" id="hyb_set_odd">
                <field name="VAR" id="hyb_oddmax">Digit_min</field>
                <value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                <next>
                  <block type="variables_set" id="hyb_set_even">
                    <field name="VAR" id="hyb_evenmin">Digit_max</field>
                    <value name="VALUE"><block type="math_number"><field name="NUM">4</field></block></value>
                    <next>
                      <block type="variables_set" id="hyb_set_plb">
                        <field name="VAR" id="hyb_plb">Pattern_lookback</field>
                        <value name="VALUE"><block type="math_number"><field name="NUM">400</field></block></value>
                        <next>
                          <block type="variables_set" id="hyb_set_hlb">
                            <field name="VAR" id="hyb_hlb">Hot_lookback</field>
                            <value name="VALUE"><block type="math_number"><field name="NUM">1000</field></block></value>
                            <next>
                              <block type="variables_set" id="hyb_set_maxloss">
                                <field name="VAR" id="hyb_maxloss">Max Cons Loss:</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                                <next>
                                  <block type="variables_set" id="hyb_set_profit">
                                    <field name="VAR" id="hyb_profit">Profit Threshold:</field>
                                    <value name="VALUE"><block type="math_number"><field name="NUM">7</field></block></value>
                                    <next>
                                      <block type="variables_set" id="hyb_set_pou">
                                        <field name="VAR" id="hyb_payout_ou">Payout_OU%</field>
                                        <value name="VALUE"><block type="math_number"><field name="NUM">60</field></block></value>
                                        <next>
                                          <block type="variables_set" id="hyb_set_pd">
                                            <field name="VAR" id="hyb_payout_diff">Payout_Differs%</field>
                                            <value name="VALUE"><block type="math_number"><field name="NUM">9.6</field></block></value>
                                            <next>
                                              <block type="variables_set" id="hyb_set_init">
                                                <field name="VAR" id="hyb_initstake">Initial_stake</field>
                                                <value name="VALUE"><block type="variables_get"><field name="VAR" id="hyb_stake">Stake</field></block></value>
                                                <next>
                                                  <block type="variables_set" id="hyb_set_inarow">
                                                    <field name="VAR" id="hyb_inarow">InArow</field>
                                                    <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                                    <next>
                                                      <block type="variables_set" id="hyb_set_totalloss">
                                                        <field name="VAR" id="hyb_totalloss">Total_loss</field>
                                                        <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                                        <next>
                                                          <block type="variables_set" id="hyb_set_ccode0">
                                                            <field name="VAR" id="hyb_ccode">Contract_code</field>
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
      <block type="variables_set" id="hyb_set_pred">
        <field name="VAR" id="hyb_prediction">Prediction:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="hyb_call_barrier">
            <mutation name="Hybrid Multi Scan Barrier"></mutation>
            <data>hyb_fn_barrier</data>
          </block>
        </value>
        <next>
          <block type="variables_set" id="hyb_set_ccode">
            <field name="VAR" id="hyb_ccode">Contract_code</field>
            <value name="VALUE">
              <block type="procedures_callreturn" id="hyb_call_ccode">
                <mutation name="Hybrid Contract Code"></mutation>
                <data>hyb_fn_ccode</data>
              </block>
            </value>
            <next>
              <block type="controls_if" id="hyb_if_signal">
                <value name="IF0">
                  <block type="logic_compare">
                    <field name="OP">GTE</field>
                    <value name="A"><block type="variables_get"><field name="VAR" id="hyb_prediction">Prediction:</field></block></value>
                    <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="trade_definition_tradeoptions" id="hyb_tradeopts">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
                    <field name="DURATIONTYPE_LIST">t</field>
                    <value name="DURATION"><block type="variables_get"><field name="VAR" id="hyb_duration">Duration</field></block></value>
                    <value name="AMOUNT"><block type="variables_get"><field name="VAR" id="hyb_initstake">Initial_stake</field></block></value>
                    <value name="PREDICTION"><block type="variables_get"><field name="VAR" id="hyb_prediction">Prediction:</field></block></value>
                  </block>
                </statement>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="procedures_defreturn" id="hyb_fn_barrier" collapsed="true" x="0" y="900">
    <field name="NAME">Hybrid Multi Scan Barrier</field>
    <value name="RETURN">
      <block type="hybrid_multi_scan" id="hyb_signal_block">
        <value name="ODD_MAX"><block type="variables_get"><field name="VAR" id="hyb_oddmax">Digit_min</field></block></value>
        <value name="EVEN_MIN"><block type="variables_get"><field name="VAR" id="hyb_evenmin">Digit_max</field></block></value>
        <value name="PATTERN_LOOKBACK"><block type="variables_get"><field name="VAR" id="hyb_plb">Pattern_lookback</field></block></value>
        <value name="HOT_LOOKBACK"><block type="variables_get"><field name="VAR" id="hyb_hlb">Hot_lookback</field></block></value>
        <value name="RECOVERING">
          <block type="logic_compare">
            <field name="OP">GT</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="hyb_totalloss">Total_loss</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
          </block>
        </value>
      </block>
    </value>
  </block>
  <block type="procedures_defreturn" id="hyb_fn_ccode" collapsed="true" x="0" y="1100">
    <field name="NAME">Hybrid Contract Code</field>
    <value name="RETURN">
      <block type="hybrid_multi_scan_contract_code" id="hyb_ccode_block"></block>
    </value>
  </block>
  <block type="after_purchase" id="hyb_after" collapsed="true" x="1200" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="hyb_ap_loss">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block></value>
        <statement name="DO0">
          <block type="math_change"><field name="VAR" id="hyb_inarow">InArow</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
            <next>
              <block type="math_change"><field name="VAR" id="hyb_totalloss">Total_loss</field><value name="DELTA"><block type="variables_get"><field name="VAR" id="hyb_initstake">Initial_stake</field></block></value></block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set"><field name="VAR" id="hyb_inarow">InArow</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="math_change"><field name="VAR" id="hyb_totalloss">Total_loss</field>
                <value name="DELTA">
                  <block type="math_single"><field name="OP">NEG</field>
                    <value name="NUM"><block type="read_details"><field name="DETAIL_INDEX">4</field></block></value>
                  </block>
                </value>
                <next>
                  <block type="controls_if">
                    <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="hyb_totalloss">Total_loss</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">0.01</field></block></value>
                    </block></value>
                    <statement name="DO0"><block type="variables_set"><field name="VAR" id="hyb_totalloss">Total_loss</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value></block></statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="controls_if">
            <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
            <value name="IF0"><block type="logic_compare"><field name="OP">GT</field>
              <value name="A"><block type="variables_get"><field name="VAR" id="hyb_totalloss">Total_loss</field></block></value>
              <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
            </block></value>
            <statement name="DO0">
              <block type="controls_if">
                <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
                <value name="IF0"><block type="logic_compare"><field name="OP">EQ</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="hyb_ccode">Contract_code</field></block></value>
                  <value name="B"><block type="math_number"><field name="NUM">3</field></block></value>
                </block></value>
                <statement name="DO0">
                  <block type="variables_set"><field name="VAR" id="hyb_initstake">Initial_stake</field>
                    <value name="VALUE">
                      <block type="math_arithmetic"><field name="OP">DIVIDE</field>
                        <value name="A"><block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                          <value name="A"><block type="variables_get"><field name="VAR" id="hyb_totalloss">Total_loss</field></block></value>
                          <value name="B"><block type="math_number"><field name="NUM">100</field></block></value>
                        </block></value>
                        <value name="B"><block type="variables_get"><field name="VAR" id="hyb_payout_diff">Payout_Differs%</field></block></value>
                      </block>
                    </value>
                  </block>
                </statement>
                <statement name="ELSE">
                  <block type="variables_set"><field name="VAR" id="hyb_initstake">Initial_stake</field>
                    <value name="VALUE">
                      <block type="math_arithmetic"><field name="OP">DIVIDE</field>
                        <value name="A"><block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                          <value name="A"><block type="variables_get"><field name="VAR" id="hyb_totalloss">Total_loss</field></block></value>
                          <value name="B"><block type="math_number"><field name="NUM">100</field></block></value>
                        </block></value>
                        <value name="B"><block type="variables_get"><field name="VAR" id="hyb_payout_ou">Payout_OU%</field></block></value>
                      </block>
                    </value>
                  </block>
                </statement>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="variables_set"><field name="VAR" id="hyb_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="hyb_stake">Stake</field></block></value></block>
            </statement>
            <next>
              <block type="controls_if">
                <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="hyb_initstake">Initial_stake</field></block></value>
                  <value name="B"><block type="variables_get"><field name="VAR" id="hyb_stake">Stake</field></block></value>
                </block></value>
                <statement name="DO0"><block type="variables_set"><field name="VAR" id="hyb_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="hyb_stake">Stake</field></block></value></block></statement>
                <next>
                  <block type="controls_if">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                    <value name="IF0"><block type="logic_compare"><field name="OP">GTE</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="hyb_inarow">InArow</field></block></value>
                      <value name="B"><block type="variables_get"><field name="VAR" id="hyb_maxloss">Max Cons Loss:</field></block></value>
                    </block></value>
                    <statement name="DO0"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Max consecutive losses reached. Stopping (Hybrid Multi-Scan).</field></block></value></block></statement>
                    <value name="IF1"><block type="logic_compare"><field name="OP">GTE</field>
                      <value name="A"><block type="total_profit"></block></value>
                      <value name="B"><block type="variables_get"><field name="VAR" id="hyb_profit">Profit Threshold:</field></block></value>
                    </block></value>
                    <statement name="DO1"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Profit threshold reached. Stopping (Hybrid Multi-Scan).</field></block></value></block></statement>
                    <statement name="ELSE"><block type="trade_again"></block></statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="hyb_before" collapsed="true" deletable="false" x="0" y="1300">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="variables_set" id="hyb_bp_set_signal">
        <field name="VAR" id="hyb_signal">Signal:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="hyb_bp_scan">
            <mutation name="Hybrid Multi Scan Barrier"></mutation>
            <data>hyb_fn_barrier</data>
          </block>
        </value>
        <next>
          <block type="variables_set" id="hyb_bp_set_ccode">
            <field name="VAR" id="hyb_ccode">Contract_code</field>
            <value name="VALUE">
              <block type="procedures_callreturn" id="hyb_bp_ccode">
                <mutation name="Hybrid Contract Code"></mutation>
                <data>hyb_fn_ccode</data>
              </block>
            </value>
            <next>
              <block type="controls_if" id="hyb_bp_if">
                <value name="IF0">
                  <block type="logic_operation">
                    <field name="OP">AND</field>
                    <value name="A">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A"><block type="variables_get"><field name="VAR" id="hyb_signal">Signal:</field></block></value>
                        <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="logic_compare">
                        <field name="OP">EQ</field>
                        <value name="A"><block type="variables_get"><field name="VAR" id="hyb_signal">Signal:</field></block></value>
                        <value name="B"><block type="variables_get"><field name="VAR" id="hyb_prediction">Prediction:</field></block></value>
                      </block>
                    </value>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="controls_if" id="hyb_bp_buy">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="2"></mutation>
                    <value name="IF0"><block type="logic_compare"><field name="OP">EQ</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="hyb_ccode">Contract_code</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">1</field></block></value>
                    </block></value>
                    <statement name="DO0">
                      <block type="override_contract_type_purchase" id="hyb_buy_over"><field name="CONTRACT_TYPE">DIGITOVER</field></block>
                    </statement>
                    <value name="IF1"><block type="logic_compare"><field name="OP">EQ</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="hyb_ccode">Contract_code</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">2</field></block></value>
                    </block></value>
                    <statement name="DO1">
                      <block type="override_contract_type_purchase" id="hyb_buy_under"><field name="CONTRACT_TYPE">DIGITUNDER</field></block>
                    </statement>
                    <value name="IF2"><block type="logic_compare"><field name="OP">EQ</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="hyb_ccode">Contract_code</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">3</field></block></value>
                    </block></value>
                    <statement name="DO2">
                      <block type="override_contract_type_purchase" id="hyb_buy_diff"><field name="CONTRACT_TYPE">DIGITDIFF</field></block>
                    </statement>
                  </block>
                </statement>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;
