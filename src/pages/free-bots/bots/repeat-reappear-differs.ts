/**
 * Repeat-Reappear Differs free bot (single market).
 *
 * When previous_digit === current_digit (repeat streak ≥ 2):
 *   wait for the streak to break, then Differ that digit when it reappears.
 * After a streak of 3 or 4, skip the next tip before accepting reappearance.
 *
 * A tick_analysis block advances the scan on every tip (live journal).
 * Trade options arm only when a Differs barrier is ready.
 *
 * Recovery: stake = Total_loss * 100 / Payout% (default 9.6).
 */

export const REPEAT_REAPPEAR_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="rrd_stake">Stake</variable>
    <variable id="rrd_inarow">InArow</variable>
    <variable id="rrd_maxloss">Max Cons Loss:</variable>
    <variable id="rrd_totalloss">Total_loss</variable>
    <variable id="rrd_prediction">Prediction:</variable>
    <variable id="rrd_signal">Signal:</variable>
    <variable id="rrd_profit">Profit Threshold:</variable>
    <variable id="rrd_initstake">Initial_stake</variable>
    <variable id="rrd_payout">Payout%</variable>
    <variable id="rrd_duration">Duration</variable>
  </variables>
  <block type="trade_definition" id="rrd_trade_def" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="rrd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="rrd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="rrd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="rrd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rrd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="rrd_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="rrd_set_stake">
        <field name="VAR" id="rrd_stake">Stake</field>
        <value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value>
        <next>
          <block type="variables_set" id="rrd_set_duration">
            <field name="VAR" id="rrd_duration">Duration</field>
            <value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
            <next>
              <block type="variables_set" id="rrd_set_maxloss">
                <field name="VAR" id="rrd_maxloss">Max Cons Loss:</field>
                <value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                <next>
                  <block type="variables_set" id="rrd_set_profit">
                    <field name="VAR" id="rrd_profit">Profit Threshold:</field>
                    <value name="VALUE"><block type="math_number"><field name="NUM">7</field></block></value>
                    <next>
                      <block type="variables_set" id="rrd_set_payout">
                        <field name="VAR" id="rrd_payout">Payout%</field>
                        <value name="VALUE"><block type="math_number"><field name="NUM">9.6</field></block></value>
                        <next>
                          <block type="variables_set" id="rrd_set_init">
                            <field name="VAR" id="rrd_initstake">Initial_stake</field>
                            <value name="VALUE"><block type="variables_get"><field name="VAR" id="rrd_stake">Stake</field></block></value>
                            <next>
                              <block type="variables_set" id="rrd_set_inarow">
                                <field name="VAR" id="rrd_inarow">InArow</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                <next>
                                  <block type="variables_set" id="rrd_set_totalloss">
                                    <field name="VAR" id="rrd_totalloss">Total_loss</field>
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
    </statement>
    <statement name="SUBMARKET">
      <block type="variables_set" id="rrd_set_pred">
        <field name="VAR" id="rrd_prediction">Prediction:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="rrd_call_barrier">
            <mutation name="Repeat Reappear Differs Barrier"></mutation>
            <data>rrd_fn_barrier</data>
          </block>
        </value>
        <next>
          <block type="controls_if" id="rrd_if_signal">
            <value name="IF0">
              <block type="logic_compare">
                <field name="OP">GTE</field>
                <value name="A"><block type="variables_get"><field name="VAR" id="rrd_prediction">Prediction:</field></block></value>
                <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
              </block>
            </value>
            <statement name="DO0">
              <block type="trade_definition_tradeoptions" id="rrd_tradeopts">
                <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
                <field name="DURATIONTYPE_LIST">t</field>
                <value name="DURATION"><block type="variables_get"><field name="VAR" id="rrd_duration">Duration</field></block></value>
                <value name="AMOUNT"><block type="variables_get"><field name="VAR" id="rrd_initstake">Initial_stake</field></block></value>
                <value name="PREDICTION"><block type="variables_get"><field name="VAR" id="rrd_prediction">Prediction:</field></block></value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="procedures_defreturn" id="rrd_fn_barrier" collapsed="true" x="0" y="900">
    <field name="NAME">Repeat Reappear Differs Barrier</field>
    <value name="RETURN">
      <block type="repeat_reappear_differs_prediction" id="rrd_signal">
        <value name="ENABLED"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
        <value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
      </block>
    </value>
  </block>
  <block type="after_purchase" id="rrd_after" collapsed="true" x="1200" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="rrd_ap_loss">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block></value>
        <statement name="DO0">
          <block type="math_change"><field name="VAR" id="rrd_inarow">InArow</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
            <next>
              <block type="math_change"><field name="VAR" id="rrd_totalloss">Total_loss</field><value name="DELTA"><block type="variables_get"><field name="VAR" id="rrd_initstake">Initial_stake</field></block></value></block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set"><field name="VAR" id="rrd_inarow">InArow</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="math_change"><field name="VAR" id="rrd_totalloss">Total_loss</field>
                <value name="DELTA">
                  <block type="math_single"><field name="OP">NEG</field>
                    <value name="NUM"><block type="read_details"><field name="DETAIL_INDEX">4</field></block></value>
                  </block>
                </value>
                <next>
                  <block type="controls_if">
                    <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="rrd_totalloss">Total_loss</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                    </block></value>
                    <statement name="DO0"><block type="variables_set"><field name="VAR" id="rrd_totalloss">Total_loss</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value></block></statement>
                    <next>
                      <block type="controls_if">
                        <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                          <value name="A"><block type="variables_get"><field name="VAR" id="rrd_totalloss">Total_loss</field></block></value>
                          <value name="B"><block type="math_number"><field name="NUM">0.01</field></block></value>
                        </block></value>
                        <statement name="DO0"><block type="variables_set"><field name="VAR" id="rrd_totalloss">Total_loss</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value></block></statement>
                      </block>
                    </next>
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
              <value name="A"><block type="variables_get"><field name="VAR" id="rrd_totalloss">Total_loss</field></block></value>
              <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
            </block></value>
            <statement name="DO0">
              <block type="controls_if">
                <value name="IF0"><block type="logic_compare"><field name="OP">LTE</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="rrd_payout">Payout%</field></block></value>
                  <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                </block></value>
                <statement name="DO0"><block type="variables_set"><field name="VAR" id="rrd_payout">Payout%</field><value name="VALUE"><block type="math_number"><field name="NUM">9.6</field></block></value></block></statement>
                <next>
                  <block type="variables_set"><field name="VAR" id="rrd_initstake">Initial_stake</field>
                    <value name="VALUE">
                      <block type="math_arithmetic"><field name="OP">DIVIDE</field>
                        <value name="A"><block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                          <value name="A"><block type="variables_get"><field name="VAR" id="rrd_totalloss">Total_loss</field></block></value>
                          <value name="B"><block type="math_number"><field name="NUM">100</field></block></value>
                        </block></value>
                        <value name="B"><block type="variables_get"><field name="VAR" id="rrd_payout">Payout%</field></block></value>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="variables_set"><field name="VAR" id="rrd_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="rrd_stake">Stake</field></block></value></block>
            </statement>
            <next>
              <block type="controls_if">
                <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="rrd_initstake">Initial_stake</field></block></value>
                  <value name="B"><block type="variables_get"><field name="VAR" id="rrd_stake">Stake</field></block></value>
                </block></value>
                <statement name="DO0"><block type="variables_set"><field name="VAR" id="rrd_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="rrd_stake">Stake</field></block></value></block></statement>
                <next>
                  <block type="controls_if">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                    <value name="IF0"><block type="logic_compare"><field name="OP">GTE</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="rrd_inarow">InArow</field></block></value>
                      <value name="B"><block type="variables_get"><field name="VAR" id="rrd_maxloss">Max Cons Loss:</field></block></value>
                    </block></value>
                    <statement name="DO0"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Max consecutive losses reached. Stopping (Repeat-reappear Differs).</field></block></value></block></statement>
                    <value name="IF1"><block type="logic_compare"><field name="OP">GTE</field>
                      <value name="A"><block type="total_profit"></block></value>
                      <value name="B"><block type="variables_get"><field name="VAR" id="rrd_profit">Profit Threshold:</field></block></value>
                    </block></value>
                    <statement name="DO1"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Profit threshold reached. Stopping (Repeat-reappear Differs).</field></block></value></block></statement>
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
  <block type="before_purchase" id="rrd_before" collapsed="true" deletable="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="variables_set" id="rrd_bp_set_signal">
        <field name="VAR" id="rrd_signal">Signal:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="rrd_bp_scan">
            <mutation name="Repeat Reappear Differs Barrier"></mutation>
            <data>rrd_fn_barrier</data>
          </block>
        </value>
        <next>
          <block type="controls_if" id="rrd_bp_if">
            <value name="IF0">
              <block type="logic_operation">
                <field name="OP">AND</field>
                <value name="A">
                  <block type="logic_compare">
                    <field name="OP">GTE</field>
                    <value name="A"><block type="variables_get"><field name="VAR" id="rrd_signal">Signal:</field></block></value>
                    <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                  </block>
                </value>
                <value name="B">
                  <block type="logic_compare">
                    <field name="OP">EQ</field>
                    <value name="A"><block type="variables_get"><field name="VAR" id="rrd_signal">Signal:</field></block></value>
                    <value name="B"><block type="variables_get"><field name="VAR" id="rrd_prediction">Prediction:</field></block></value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="rrd_buy"><field name="PURCHASE_LIST">DIGITDIFF</field></block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="tick_analysis" id="rrd_tick_analysis" collapsed="false" x="0" y="1280">
    <statement name="TICKANALYSIS_STACK">
      <block type="variables_set" id="rrd_ta_scan">
        <field name="VAR" id="rrd_prediction">Prediction:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="rrd_ta_call">
            <mutation name="Repeat Reappear Differs Barrier"></mutation>
            <data>rrd_fn_barrier</data>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>`;
