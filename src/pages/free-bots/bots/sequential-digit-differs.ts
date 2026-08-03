/**
 * Sequential Digit Differs free bot — scans configured volatility symbols
 * for ascending/descending consecutive last-3 digit runs.
 *
 * Configure in Run once at start:
 *   Market_group — "1S" | "STANDARD" | "ALL"
 *   Immediate_loss_retry — FALSE by default
 */
export const SEQUENTIAL_DIGIT_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="sqd_stake">Stake</variable>
    <variable id="sqd_split">Split_size</variable>
    <variable id="sqd_inarow">InArow</variable>
    <variable id="sqd_maxloss">Max Cons Loss:</variable>
    <variable id="sqd_losscount">Loss_count</variable>
    <variable id="sqd_totalloss">Total_loss</variable>
    <variable id="sqd_prediction">Prediction:</variable>
    <variable id="sqd_profit">Profit Threshold:</variable>
    <variable id="sqd_initstake">Initial_stake</variable>
    <variable id="sqd_payout">Payout%</variable>
    <variable id="sqd_duration">Duration</variable>
    <variable id="sqd_lossretry">Immediate_loss_retry</variable>
    <variable id="sqd_mktgroup">Market_group</variable>
  </variables>
  <block type="trade_definition" id="sqd_trade_def" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="sqd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="sqd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="sqd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="sqd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="sqd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="sqd_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="sqd_set_stake">
        <field name="VAR" id="sqd_stake">Stake</field>
        <value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value>
        <next>
          <block type="variables_set" id="sqd_set_duration">
            <field name="VAR" id="sqd_duration">Duration</field>
            <value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
            <next>
              <block type="variables_set" id="sqd_set_lossretry">
                <field name="VAR" id="sqd_lossretry">Immediate_loss_retry</field>
                <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
                <next>
                  <block type="variables_set" id="sqd_set_mktgroup">
                    <field name="VAR" id="sqd_mktgroup">Market_group</field>
                    <value name="VALUE"><block type="text"><field name="TEXT">1S</field></block></value>
                    <next>
                      <block type="variables_set" id="sqd_set_maxloss">
                        <field name="VAR" id="sqd_maxloss">Max Cons Loss:</field>
                        <value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                        <next>
                          <block type="variables_set" id="sqd_set_profit">
                            <field name="VAR" id="sqd_profit">Profit Threshold:</field>
                            <value name="VALUE"><block type="math_number"><field name="NUM">7</field></block></value>
                            <next>
                              <block type="variables_set" id="sqd_set_split">
                                <field name="VAR" id="sqd_split">Split_size</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
                                <next>
                                  <block type="variables_set" id="sqd_set_init">
                                    <field name="VAR" id="sqd_initstake">Initial_stake</field>
                                    <value name="VALUE"><block type="variables_get"><field name="VAR" id="sqd_stake">Stake</field></block></value>
                                    <next>
                                      <block type="variables_set" id="sqd_set_payout">
                                        <field name="VAR" id="sqd_payout">Payout%</field>
                                        <value name="VALUE"><block type="math_number"><field name="NUM">9.6</field></block></value>
                                        <next>
                                          <block type="variables_set" id="sqd_set_inarow">
                                            <field name="VAR" id="sqd_inarow">InArow</field>
                                            <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                            <next>
                                              <block type="variables_set" id="sqd_set_losscount">
                                                <field name="VAR" id="sqd_losscount">Loss_count</field>
                                                <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                                <next>
                                                  <block type="variables_set" id="sqd_set_totalloss">
                                                    <field name="VAR" id="sqd_totalloss">Total_loss</field>
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
    </statement>
    <statement name="SUBMARKET">
      <block type="variables_set" id="sqd_set_pred">
        <field name="VAR" id="sqd_prediction">Prediction:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="sqd_call_barrier">
            <mutation name="Sequential Differs Barrier"></mutation>
            <data>sqd_fn_barrier</data>
          </block>
        </value>
        <next>
          <block type="controls_if" id="sqd_if_signal">
            <value name="IF0">
              <block type="logic_compare">
                <field name="OP">GTE</field>
                <value name="A"><block type="variables_get"><field name="VAR" id="sqd_prediction">Prediction:</field></block></value>
                <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
              </block>
            </value>
            <statement name="DO0">
              <block type="trade_definition_tradeoptions" id="sqd_tradeopts">
                <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
                <field name="DURATIONTYPE_LIST">t</field>
                <value name="DURATION"><block type="variables_get"><field name="VAR" id="sqd_duration">Duration</field></block></value>
                <value name="AMOUNT"><block type="variables_get"><field name="VAR" id="sqd_initstake">Initial_stake</field></block></value>
                <value name="PREDICTION"><block type="variables_get"><field name="VAR" id="sqd_prediction">Prediction:</field></block></value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="procedures_defreturn" id="sqd_fn_barrier" collapsed="true" x="0" y="900">
    <field name="NAME">Sequential Differs Barrier</field>
    <value name="RETURN">
      <block type="sequential_digit_differs_prediction" id="sqd_signal">
        <value name="MARKET_GROUP"><block type="variables_get"><field name="VAR" id="sqd_mktgroup">Market_group</field></block></value>
        <value name="IMMEDIATE_LOSS_RETRY"><block type="variables_get"><field name="VAR" id="sqd_lossretry">Immediate_loss_retry</field></block></value>
        <value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
      </block>
    </value>
  </block>
  <block type="after_purchase" id="sqd_after" collapsed="true" x="1200" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="sqd_ap_loss">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block></value>
        <statement name="DO0">
          <block type="math_change"><field name="VAR" id="sqd_inarow">InArow</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
            <next>
              <block type="variables_set"><field name="VAR" id="sqd_losscount">Loss_count</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                <next>
                  <block type="math_change"><field name="VAR" id="sqd_totalloss">Total_loss</field><value name="DELTA"><block type="variables_get"><field name="VAR" id="sqd_initstake">Initial_stake</field></block></value></block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set"><field name="VAR" id="sqd_inarow">InArow</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="math_change"><field name="VAR" id="sqd_totalloss">Total_loss</field>
                <value name="DELTA">
                  <block type="math_single"><field name="OP">NEG</field>
                    <value name="NUM"><block type="read_details"><field name="DETAIL_INDEX">4</field></block></value>
                  </block>
                </value>
                <next>
                  <block type="controls_if">
                    <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="sqd_totalloss">Total_loss</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                    </block></value>
                    <statement name="DO0"><block type="variables_set"><field name="VAR" id="sqd_totalloss">Total_loss</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value></block></statement>
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
              <value name="A"><block type="variables_get"><field name="VAR" id="sqd_totalloss">Total_loss</field></block></value>
              <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
            </block></value>
            <statement name="DO0">
              <block type="math_change"><field name="VAR" id="sqd_losscount">Loss_count</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
                <next>
                  <block type="controls_if">
                    <value name="IF0"><block type="logic_compare"><field name="OP">EQ</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="sqd_losscount">Loss_count</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">1</field></block></value>
                    </block></value>
                    <statement name="DO0">
                      <block type="variables_set"><field name="VAR" id="sqd_initstake">Initial_stake</field>
                        <value name="VALUE">
                          <block type="math_arithmetic"><field name="OP">DIVIDE</field>
                            <value name="A"><block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                              <value name="A"><block type="variables_get"><field name="VAR" id="sqd_totalloss">Total_loss</field></block></value>
                              <value name="B"><block type="variables_get"><field name="VAR" id="sqd_payout">Payout%</field></block></value>
                            </block></value>
                            <value name="B"><block type="variables_get"><field name="VAR" id="sqd_split">Split_size</field></block></value>
                          </block>
                        </value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="variables_set"><field name="VAR" id="sqd_losscount">Loss_count</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                <next>
                  <block type="variables_set"><field name="VAR" id="sqd_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="sqd_stake">Stake</field></block></value></block>
                </next>
              </block>
            </statement>
            <next>
              <block type="controls_if">
                <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="sqd_initstake">Initial_stake</field></block></value>
                  <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                </block></value>
                <statement name="DO0"><block type="variables_set"><field name="VAR" id="sqd_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="sqd_stake">Stake</field></block></value></block></statement>
                <next>
                  <block type="controls_if">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                    <value name="IF0"><block type="logic_compare"><field name="OP">GTE</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="sqd_inarow">InArow</field></block></value>
                      <value name="B"><block type="variables_get"><field name="VAR" id="sqd_maxloss">Max Cons Loss:</field></block></value>
                    </block></value>
                    <statement name="DO0"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Max consecutive losses reached. Stopping.</field></block></value></block></statement>
                    <value name="IF1"><block type="logic_compare"><field name="OP">GTE</field>
                      <value name="A"><block type="total_profit"></block></value>
                      <value name="B"><block type="variables_get"><field name="VAR" id="sqd_profit">Profit Threshold:</field></block></value>
                    </block></value>
                    <statement name="DO1"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Profit threshold reached. Stopping.</field></block></value></block></statement>
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
  <block type="before_purchase" id="sqd_before" collapsed="true" deletable="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="sqd_bp_if">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">GTE</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="sqd_prediction">Prediction:</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="sqd_buy"><field name="PURCHASE_LIST">DIGITDIFF</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
