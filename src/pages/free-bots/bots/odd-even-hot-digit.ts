/**
 * Odd/Even Hot-Digit free bot.
 *
 * Configure in Run once at start:
 *   Market_group — "1S" | "STANDARD" | "ALL"
 *   Lookback — tick history window (default 1000)
 *   Min_digit_pct — hot digit threshold (default 10.4)
 *
 * Logic: ≥3 odd (or even) digits at ≥Min_digit_pct → wait for 3 opposite
 * consecutive tips → up to 5 favored trades → if last lost, ×2 recovery then stop.
 */
export const ODD_EVEN_HOT_DIGIT_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="oeh_stake">Stake</variable>
    <variable id="oeh_inarow">InArow</variable>
    <variable id="oeh_maxloss">Max Cons Loss:</variable>
    <variable id="oeh_side">Side</variable>
    <variable id="oeh_profit">Profit Threshold:</variable>
    <variable id="oeh_initstake">Initial_stake</variable>
    <variable id="oeh_duration">Duration</variable>
    <variable id="oeh_lookback">Lookback</variable>
    <variable id="oeh_minpct">Min_digit_pct</variable>
    <variable id="oeh_mktgroup">Market_group</variable>
  </variables>
  <block type="trade_definition" id="oeh_trade_def" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="oeh_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="oeh_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">evenodd</field>
            <next>
              <block type="trade_definition_contracttype" id="oeh_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="oeh_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="oeh_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="oeh_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="oeh_set_stake">
        <field name="VAR" id="oeh_stake">Stake</field>
        <value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value>
        <next>
          <block type="variables_set" id="oeh_set_duration">
            <field name="VAR" id="oeh_duration">Duration</field>
            <value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
            <next>
              <block type="variables_set" id="oeh_set_lookback">
                <field name="VAR" id="oeh_lookback">Lookback</field>
                <value name="VALUE"><block type="math_number"><field name="NUM">1000</field></block></value>
                <next>
                  <block type="variables_set" id="oeh_set_minpct">
                    <field name="VAR" id="oeh_minpct">Min_digit_pct</field>
                    <value name="VALUE"><block type="math_number"><field name="NUM">10.4</field></block></value>
                    <next>
                      <block type="variables_set" id="oeh_set_mktgroup">
                        <field name="VAR" id="oeh_mktgroup">Market_group</field>
                        <value name="VALUE"><block type="text"><field name="TEXT">1S</field></block></value>
                        <next>
                          <block type="variables_set" id="oeh_set_maxloss">
                            <field name="VAR" id="oeh_maxloss">Max Cons Loss:</field>
                            <value name="VALUE"><block type="math_number"><field name="NUM">7</field></block></value>
                            <next>
                              <block type="variables_set" id="oeh_set_profit">
                                <field name="VAR" id="oeh_profit">Profit Threshold:</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">7</field></block></value>
                                <next>
                                  <block type="variables_set" id="oeh_set_init">
                                    <field name="VAR" id="oeh_initstake">Initial_stake</field>
                                    <value name="VALUE"><block type="variables_get"><field name="VAR" id="oeh_stake">Stake</field></block></value>
                                    <next>
                                      <block type="variables_set" id="oeh_set_inarow">
                                        <field name="VAR" id="oeh_inarow">InArow</field>
                                        <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                        <next>
                                          <block type="variables_set" id="oeh_set_side">
                                            <field name="VAR" id="oeh_side">Side</field>
                                            <value name="VALUE"><block type="math_number"><field name="NUM">-1</field></block></value>
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
      <block type="variables_set" id="oeh_set_side_run">
        <field name="VAR" id="oeh_side">Side</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="oeh_call_side">
            <mutation name="Odd Even Hot Side"></mutation>
            <data>oeh_fn_side</data>
          </block>
        </value>
        <next>
          <block type="variables_set" id="oeh_set_stake_run">
            <field name="VAR" id="oeh_initstake">Initial_stake</field>
            <value name="VALUE">
              <block type="math_arithmetic">
                <field name="OP">MULTIPLY</field>
                <value name="A"><block type="variables_get"><field name="VAR" id="oeh_stake">Stake</field></block></value>
                <value name="B"><block type="odd_even_hot_digit_stake_mult" id="oeh_mult"></block></value>
              </block>
            </value>
            <next>
              <block type="controls_if" id="oeh_if_signal">
                <value name="IF0">
                  <block type="logic_compare">
                    <field name="OP">GTE</field>
                    <value name="A"><block type="variables_get"><field name="VAR" id="oeh_side">Side</field></block></value>
                    <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="trade_definition_tradeoptions" id="oeh_tradeopts">
                    <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
                    <field name="DURATIONTYPE_LIST">t</field>
                    <value name="DURATION"><block type="variables_get"><field name="VAR" id="oeh_duration">Duration</field></block></value>
                    <value name="AMOUNT"><block type="variables_get"><field name="VAR" id="oeh_initstake">Initial_stake</field></block></value>
                  </block>
                </statement>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="procedures_defreturn" id="oeh_fn_side" collapsed="true" x="0" y="900">
    <field name="NAME">Odd Even Hot Side</field>
    <value name="RETURN">
      <block type="odd_even_hot_digit_scan" id="oeh_signal">
        <value name="MARKET_GROUP"><block type="variables_get"><field name="VAR" id="oeh_mktgroup">Market_group</field></block></value>
        <value name="LOOKBACK"><block type="variables_get"><field name="VAR" id="oeh_lookback">Lookback</field></block></value>
        <value name="MIN_DIGIT_PCT"><block type="variables_get"><field name="VAR" id="oeh_minpct">Min_digit_pct</field></block></value>
        <value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
      </block>
    </value>
  </block>
  <block type="after_purchase" id="oeh_after" collapsed="true" x="1200" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="oeh_ap_loss">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block></value>
        <statement name="DO0">
          <block type="math_change"><field name="VAR" id="oeh_inarow">InArow</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set"><field name="VAR" id="oeh_inarow">InArow</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value></block>
        </statement>
        <next>
          <block type="controls_if">
            <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
            <value name="IF0"><block type="logic_compare"><field name="OP">LTE</field>
              <value name="A"><block type="variables_get"><field name="VAR" id="oeh_maxloss">Max Cons Loss:</field></block></value>
              <value name="B"><block type="variables_get"><field name="VAR" id="oeh_inarow">InArow</field></block></value>
            </block></value>
            <statement name="DO0"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Max consecutive losses reached.</field></block></value></block></statement>
            <value name="IF1"><block type="logic_compare"><field name="OP">GTE</field>
              <value name="A"><block type="total_profit"></block></value>
              <value name="B"><block type="variables_get"><field name="VAR" id="oeh_profit">Profit Threshold:</field></block></value>
            </block></value>
            <statement name="DO1"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">Profit threshold reached.</field></block></value></block></statement>
            <statement name="ELSE"><block type="trade_again"></block></statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="oeh_before" collapsed="true" deletable="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="oeh_bp_if">
        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="oeh_side">Side</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="oeh_buy_even"><field name="PURCHASE_LIST">DIGITEVEN</field></block>
        </statement>
        <value name="IF1">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="oeh_side">Side</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">1</field></block></value>
          </block>
        </value>
        <statement name="DO1">
          <block type="purchase" id="oeh_buy_odd"><field name="PURCHASE_LIST">DIGITODD</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
