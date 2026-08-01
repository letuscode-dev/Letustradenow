/**
 * Pattern Probability Over/Under free bot — Blockly XML.
 * Uses pattern_probability_over_under (+ is_over / confidence) blocks.
 */
export const PATTERN_PROBABILITY_OU_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="pp_stake">Stake</variable>
    <variable id="pp_text">text</variable>
    <variable id="pp_split">Split_size</variable>
    <variable id="pp_inarow">InArow</variable>
    <variable id="pp_maxloss">Max Cons Loss:</variable>
    <variable id="pp_losscount">Loss_count</variable>
    <variable id="pp_totalloss">Total_loss</variable>
    <variable id="pp_prediction">Prediction:</variable>
    <variable id="pp_profit">Profit Threshold:</variable>
    <variable id="pp_initstake">Initial_stake</variable>
    <variable id="pp_payout">Payout%</variable>
    <variable id="pp_lookback">Lookback</variable>
    <variable id="pp_plen">Pattern_length</variable>
    <variable id="pp_minocc">Min_occurrences</variable>
    <variable id="pp_minconf">Min_confidence</variable>
    <variable id="pp_duration">Duration</variable>
  </variables>
  <block type="trade_definition" id="pp_trade_def" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="pp_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="pp_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="pp_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="pp_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="pp_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="pp_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="pp_set_stake">
        <field name="VAR" id="pp_stake">Stake</field>
        <value name="VALUE">
          <block type="math_number" id="pp_stake_n">
            <field name="NUM">0.35</field>
          </block>
        </value>
        <next>
              <block type="variables_set" id="pp_set_lookback">
            <field name="VAR" id="pp_lookback">Lookback</field>
            <value name="VALUE">
              <block type="math_number" id="pp_lookback_n">
                <field name="NUM">1000</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="pp_set_plen">
                <field name="VAR" id="pp_plen">Pattern_length</field>
                <value name="VALUE">
                  <block type="math_number" id="pp_plen_n">
                    <field name="NUM">2</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="pp_set_minocc">
                    <field name="VAR" id="pp_minocc">Min_occurrences</field>
                    <value name="VALUE">
                      <block type="math_number" id="pp_minocc_n">
                        <field name="NUM">5</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="pp_set_minconf">
                        <field name="VAR" id="pp_minconf">Min_confidence</field>
                        <value name="VALUE">
                          <block type="math_number" id="pp_minconf_n">
                            <field name="NUM">70</field>
                          </block>
                        </value>
                        <next>
                          <block type="variables_set" id="pp_set_duration">
                            <field name="VAR" id="pp_duration">Duration</field>
                            <value name="VALUE">
                              <block type="math_number" id="pp_duration_n">
                                <field name="NUM">1</field>
                              </block>
                            </value>
                            <next>
                              <block type="variables_set" id="pp_set_maxloss">
                                <field name="VAR" id="pp_maxloss">Max Cons Loss:</field>
                                <value name="VALUE">
                                  <block type="math_number" id="pp_maxloss_n">
                                    <field name="NUM">5</field>
                                  </block>
                                </value>
                                <next>
                                  <block type="variables_set" id="pp_set_profit">
                                    <field name="VAR" id="pp_profit">Profit Threshold:</field>
                                    <value name="VALUE">
                                      <block type="math_number" id="pp_profit_n">
                                        <field name="NUM">7</field>
                                      </block>
                                    </value>
                                    <next>
                                      <block type="variables_set" id="pp_set_split">
                                        <field name="VAR" id="pp_split">Split_size</field>
                                        <value name="VALUE">
                                          <block type="math_number" id="pp_split_n">
                                            <field name="NUM">1</field>
                                          </block>
                                        </value>
                                        <next>
                                          <block type="variables_set" id="pp_set_init">
                                            <field name="VAR" id="pp_initstake">Initial_stake</field>
                                            <value name="VALUE">
                                              <block type="variables_get" id="pp_get_stake">
                                                <field name="VAR" id="pp_stake">Stake</field>
                                              </block>
                                            </value>
                                            <next>
                                              <block type="variables_set" id="pp_set_payout">
                                                <field name="VAR" id="pp_payout">Payout%</field>
                                                <value name="VALUE">
                                                  <block type="math_arithmetic" id="pp_payout_div">
                                                    <field name="OP">DIVIDE</field>
                                                    <value name="A">
                                                      <shadow type="math_number">
                                                        <field name="NUM">100</field>
                                                      </shadow>
                                                      <block type="math_number" id="pp_payout_a">
                                                        <field name="NUM">100</field>
                                                      </block>
                                                    </value>
                                                    <value name="B">
                                                      <shadow type="math_number">
                                                        <field name="NUM">40</field>
                                                      </shadow>
                                                      <block type="math_number" id="pp_payout_b">
                                                        <field name="NUM">40</field>
                                                      </block>
                                                    </value>
                                                  </block>
                                                </value>
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
      <block type="variables_set" id="pp_set_pred">
        <field name="VAR" id="pp_prediction">Prediction:</field>
        <value name="VALUE">
          <block type="pattern_probability_over_under" id="pp_signal">
            <value name="LOOKBACK">
              <block type="variables_get" id="pp_get_lb">
                <field name="VAR" id="pp_lookback">Lookback</field>
              </block>
            </value>
            <value name="PATTERN_LENGTH">
              <block type="variables_get" id="pp_get_pl">
                <field name="VAR" id="pp_plen">Pattern_length</field>
              </block>
            </value>
            <value name="MIN_OCCURRENCES">
              <block type="variables_get" id="pp_get_mo">
                <field name="VAR" id="pp_minocc">Min_occurrences</field>
              </block>
            </value>
            <value name="MIN_CONFIDENCE">
              <block type="variables_get" id="pp_get_mc">
                <field name="VAR" id="pp_minconf">Min_confidence</field>
              </block>
            </value>
            <value name="JOURNAL">
              <block type="logic_boolean" id="pp_journal">
                <field name="BOOL">TRUE</field>
              </block>
            </value>
          </block>
        </value>
        <next>
          <block type="controls_if" id="pp_if_signal">
            <value name="IF0">
              <block type="logic_compare" id="pp_pred_ok">
                <field name="OP">GTE</field>
                <value name="A">
                  <block type="variables_get" id="pp_get_pred">
                    <field name="VAR" id="pp_prediction">Prediction:</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="pp_zero">
                    <field name="NUM">0</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="trade_definition_tradeoptions" id="pp_tradeopts">
                <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
                <field name="DURATIONTYPE_LIST">t</field>
                <value name="DURATION">
                  <shadow type="math_number_positive">
                    <field name="NUM">1</field>
                  </shadow>
                  <block type="variables_get" id="pp_get_dur">
                    <field name="VAR" id="pp_duration">Duration</field>
                  </block>
                </value>
                <value name="AMOUNT">
                  <shadow type="math_number_positive">
                    <field name="NUM">0.35</field>
                  </shadow>
                  <block type="variables_get" id="pp_get_amt">
                    <field name="VAR" id="pp_initstake">Initial_stake</field>
                  </block>
                </value>
                <value name="PREDICTION">
                  <shadow type="math_number_positive" inline="true">
                    <field name="NUM">5</field>
                  </shadow>
                  <block type="variables_get" id="pp_get_pred2">
                    <field name="VAR" id="pp_prediction">Prediction:</field>
                  </block>
                </value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="pp_after" collapsed="true" x="1200" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="pp_ap_loss">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0">
          <block type="contract_check_result" id="pp_is_loss">
            <field name="CHECK_RESULT">loss</field>
          </block>
        </value>
        <statement name="DO0">
          <block type="math_change" id="pp_inarow_inc">
            <field name="VAR" id="pp_inarow">InArow</field>
            <value name="DELTA">
              <shadow type="math_number">
                <field name="NUM">1</field>
              </shadow>
            </value>
            <next>
              <block type="variables_set" id="pp_reset_lc">
                <field name="VAR" id="pp_losscount">Loss_count</field>
                <value name="VALUE">
                  <block type="math_number">
                    <field name="NUM">0</field>
                  </block>
                </value>
                <next>
                  <block type="math_change" id="pp_tl_add">
                    <field name="VAR" id="pp_totalloss">Total_loss</field>
                    <value name="DELTA">
                      <shadow type="math_number">
                        <field name="NUM">1</field>
                      </shadow>
                      <block type="variables_get">
                        <field name="VAR" id="pp_initstake">Initial_stake</field>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set" id="pp_inarow_reset">
            <field name="VAR" id="pp_inarow">InArow</field>
            <value name="VALUE">
              <block type="math_number">
                <field name="NUM">0</field>
              </block>
            </value>
            <next>
              <block type="math_change" id="pp_tl_sub">
                <field name="VAR" id="pp_totalloss">Total_loss</field>
                <value name="DELTA">
                  <shadow type="math_number">
                    <field name="NUM">1</field>
                  </shadow>
                  <block type="math_single">
                    <field name="OP">NEG</field>
                    <value name="NUM">
                      <shadow type="math_number">
                        <field name="NUM">9</field>
                      </shadow>
                      <block type="read_details">
                        <field name="DETAIL_INDEX">4</field>
                      </block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="pp_tl_floor">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">LT</field>
                        <value name="A">
                          <block type="variables_get">
                            <field name="VAR" id="pp_totalloss">Total_loss</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number">
                            <field name="NUM">0</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="pp_totalloss">Total_loss</field>
                        <value name="VALUE">
                          <block type="math_number">
                            <field name="NUM">0</field>
                          </block>
                        </value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="controls_if" id="pp_martingale">
            <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
            <value name="IF0">
              <block type="logic_compare">
                <field name="OP">GT</field>
                <value name="A">
                  <block type="variables_get">
                    <field name="VAR" id="pp_totalloss">Total_loss</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number">
                    <field name="NUM">0</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="math_change">
                <field name="VAR" id="pp_losscount">Loss_count</field>
                <value name="DELTA">
                  <shadow type="math_number">
                    <field name="NUM">1</field>
                  </shadow>
                </value>
                <next>
                  <block type="controls_if">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">EQ</field>
                        <value name="A">
                          <block type="variables_get">
                            <field name="VAR" id="pp_losscount">Loss_count</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number">
                            <field name="NUM">1</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="pp_initstake">Initial_stake</field>
                        <value name="VALUE">
                          <block type="math_arithmetic">
                            <field name="OP">DIVIDE</field>
                            <value name="A">
                              <shadow type="math_number">
                                <field name="NUM">1</field>
                              </shadow>
                              <block type="math_arithmetic">
                                <field name="OP">MULTIPLY</field>
                                <value name="A">
                                  <shadow type="math_number">
                                    <field name="NUM">1</field>
                                  </shadow>
                                  <block type="variables_get">
                                    <field name="VAR" id="pp_totalloss">Total_loss</field>
                                  </block>
                                </value>
                                <value name="B">
                                  <shadow type="math_number">
                                    <field name="NUM">1</field>
                                  </shadow>
                                  <block type="variables_get">
                                    <field name="VAR" id="pp_payout">Payout%</field>
                                  </block>
                                </value>
                              </block>
                            </value>
                            <value name="B">
                              <shadow type="math_number">
                                <field name="NUM">1</field>
                              </shadow>
                              <block type="variables_get">
                                <field name="VAR" id="pp_split">Split_size</field>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="variables_set">
                <field name="VAR" id="pp_losscount">Loss_count</field>
                <value name="VALUE">
                  <block type="math_number">
                    <field name="NUM">0</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="pp_initstake">Initial_stake</field>
                    <value name="VALUE">
                      <block type="variables_get">
                        <field name="VAR" id="pp_stake">Stake</field>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
            <next>
              <block type="controls_if" id="pp_stake_floor">
                <value name="IF0">
                  <block type="logic_compare">
                    <field name="OP">LT</field>
                    <value name="A">
                      <block type="variables_get">
                        <field name="VAR" id="pp_initstake">Initial_stake</field>
                      </block>
                    </value>
                    <value name="B">
                      <block type="math_number">
                        <field name="NUM">0</field>
                      </block>
                    </value>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="variables_set">
                    <field name="VAR" id="pp_initstake">Initial_stake</field>
                    <value name="VALUE">
                      <block type="variables_get">
                        <field name="VAR" id="pp_stake">Stake</field>
                      </block>
                    </value>
                  </block>
                </statement>
                <next>
                  <block type="controls_if" id="pp_stops">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">EQ</field>
                        <value name="A">
                          <block type="variables_get">
                            <field name="VAR" id="pp_maxloss">Max Cons Loss:</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="variables_get">
                            <field name="VAR" id="pp_inarow">InArow</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="text_print">
                        <value name="TEXT">
                          <shadow type="text">
                            <field name="TEXT">Max consecutive losses reached. Stopping.</field>
                          </shadow>
                        </value>
                      </block>
                    </statement>
                    <value name="IF1">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">
                          <block type="total_profit"></block>
                        </value>
                        <value name="B">
                          <block type="variables_get">
                            <field name="VAR" id="pp_profit">Profit Threshold:</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO1">
                      <block type="text_print">
                        <value name="TEXT">
                          <shadow type="text">
                            <field name="TEXT">Profit threshold reached. Enjoy.</field>
                          </shadow>
                        </value>
                      </block>
                    </statement>
                    <statement name="ELSE">
                      <block type="trade_again" id="pp_trade_again"></block>
                    </statement>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="pp_before" collapsed="true" deletable="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="pp_buy_gate">
        <value name="IF0">
          <block type="logic_compare" id="pp_pred_ready">
            <field name="OP">GTE</field>
            <value name="A">
              <block type="variables_get" id="pp_pred_bp">
                <field name="VAR" id="pp_prediction">Prediction:</field>
              </block>
            </value>
            <value name="B">
              <block type="math_number" id="pp_bp_zero">
                <field name="NUM">0</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="controls_if" id="pp_buy_side">
            <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
            <value name="IF0">
              <block type="pattern_probability_is_over" id="pp_is_over"></block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="pp_buy_over">
                <field name="PURCHASE_LIST">DIGITOVER</field>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="purchase" id="pp_buy_under">
                <field name="PURCHASE_LIST">DIGITUNDER</field>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
