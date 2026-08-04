/**
 * Hot Digit Differs free bots — Digit Differs on the selected market only.
 *
 * Even: tip = hottest even → Differ coldest odd
 * Odd:  tip = hottest odd  → Differ coldest even
 *
 * Configure in Run once at start: Lookback, Multiplier (default 10.5), Max Cons Loss, Profit Threshold.
 * Recovery: classic martingale — on loss Initial_stake × Multiplier; on win reset to Stake.
 * Stops on Max Cons Loss or Profit Threshold (no trade_again).
 */

type HotDigitParity = 'even' | 'odd';

const buildHotDigitDiffersXml = (parity: HotDigitParity): string => {
    const prefix = parity === 'even' ? 'ehd' : 'ohd';
    const title =
        parity === 'even' ? 'Even Hot Differs Barrier' : 'Odd Hot Differs Barrier';
    const stop_max =
        parity === 'even'
            ? 'Max consecutive losses reached. Stopping (Even Hot).'
            : 'Max consecutive losses reached. Stopping (Odd Hot).';
    const stop_tp =
        parity === 'even'
            ? 'Profit threshold reached. Stopping (Even Hot).'
            : 'Profit threshold reached. Stopping (Odd Hot).';

    return `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="${prefix}_stake">Stake</variable>
    <variable id="${prefix}_multiplier">Multiplier</variable>
    <variable id="${prefix}_inarow">InArow</variable>
    <variable id="${prefix}_maxloss">Max Cons Loss:</variable>
    <variable id="${prefix}_prediction">Prediction:</variable>
    <variable id="${prefix}_profit">Profit Threshold:</variable>
    <variable id="${prefix}_initstake">Initial_stake</variable>
    <variable id="${prefix}_duration">Duration</variable>
    <variable id="${prefix}_lookback">Lookback</variable>
  </variables>
  <block type="trade_definition" id="${prefix}_trade_def" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="${prefix}_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="${prefix}_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="${prefix}_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="${prefix}_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="${prefix}_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="${prefix}_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="${prefix}_set_stake">
        <field name="VAR" id="${prefix}_stake">Stake</field>
        <value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value>
        <next>
          <block type="variables_set" id="${prefix}_set_duration">
            <field name="VAR" id="${prefix}_duration">Duration</field>
            <value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
            <next>
              <block type="variables_set" id="${prefix}_set_lookback">
                <field name="VAR" id="${prefix}_lookback">Lookback</field>
                <value name="VALUE"><block type="math_number"><field name="NUM">1000</field></block></value>
                <next>
                  <block type="variables_set" id="${prefix}_set_maxloss">
                    <field name="VAR" id="${prefix}_maxloss">Max Cons Loss:</field>
                    <value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                    <next>
                      <block type="variables_set" id="${prefix}_set_profit">
                        <field name="VAR" id="${prefix}_profit">Profit Threshold:</field>
                        <value name="VALUE"><block type="math_number"><field name="NUM">7</field></block></value>
                        <next>
                          <block type="variables_set" id="${prefix}_set_mult">
                            <field name="VAR" id="${prefix}_multiplier">Multiplier</field>
                            <value name="VALUE"><block type="math_number"><field name="NUM">10.5</field></block></value>
                            <next>
                              <block type="variables_set" id="${prefix}_set_init">
                                <field name="VAR" id="${prefix}_initstake">Initial_stake</field>
                                <value name="VALUE"><block type="variables_get"><field name="VAR" id="${prefix}_stake">Stake</field></block></value>
                                <next>
                                  <block type="variables_set" id="${prefix}_set_inarow">
                                    <field name="VAR" id="${prefix}_inarow">InArow</field>
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
      <block type="variables_set" id="${prefix}_set_pred">
        <field name="VAR" id="${prefix}_prediction">Prediction:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="${prefix}_call_barrier">
            <mutation name="${title}"></mutation>
            <data>${prefix}_fn_barrier</data>
          </block>
        </value>
        <next>
          <block type="controls_if" id="${prefix}_if_signal">
            <value name="IF0">
              <block type="logic_compare">
                <field name="OP">GTE</field>
                <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_prediction">Prediction:</field></block></value>
                <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
              </block>
            </value>
            <statement name="DO0">
              <block type="trade_definition_tradeoptions" id="${prefix}_tradeopts">
                <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
                <field name="DURATIONTYPE_LIST">t</field>
                <value name="DURATION"><block type="variables_get"><field name="VAR" id="${prefix}_duration">Duration</field></block></value>
                <value name="AMOUNT"><block type="variables_get"><field name="VAR" id="${prefix}_initstake">Initial_stake</field></block></value>
                <value name="PREDICTION"><block type="variables_get"><field name="VAR" id="${prefix}_prediction">Prediction:</field></block></value>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="procedures_defreturn" id="${prefix}_fn_barrier" collapsed="true" x="0" y="900">
    <field name="NAME">${title}</field>
    <value name="RETURN">
      <block type="odd_even_hot_digit_scan" id="${prefix}_signal">
        <field name="PARITY">${parity}</field>
        <value name="LOOKBACK"><block type="variables_get"><field name="VAR" id="${prefix}_lookback">Lookback</field></block></value>
        <value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
      </block>
    </value>
  </block>
  <block type="after_purchase" id="${prefix}_after" collapsed="true" x="1200" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="${prefix}_ap_loss">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block></value>
        <statement name="DO0">
          <block type="math_change"><field name="VAR" id="${prefix}_inarow">InArow</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
            <next>
              <block type="variables_set" id="${prefix}_set_martingale">
                <field name="VAR" id="${prefix}_initstake">Initial_stake</field>
                <value name="VALUE">
                  <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                    <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_initstake">Initial_stake</field></block></value>
                    <value name="B"><block type="variables_get"><field name="VAR" id="${prefix}_multiplier">Multiplier</field></block></value>
                  </block>
                </value>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set"><field name="VAR" id="${prefix}_inarow">InArow</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="variables_set"><field name="VAR" id="${prefix}_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="${prefix}_stake">Stake</field></block></value></block>
            </next>
          </block>
        </statement>
        <next>
          <block type="controls_if">
            <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
              <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_initstake">Initial_stake</field></block></value>
              <value name="B"><block type="math_number"><field name="NUM">0.35</field></block></value>
            </block></value>
            <statement name="DO0"><block type="variables_set"><field name="VAR" id="${prefix}_initstake">Initial_stake</field><value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value></block></statement>
            <next>
              <block type="controls_if">
                <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                <value name="IF0"><block type="logic_compare"><field name="OP">GTE</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_inarow">InArow</field></block></value>
                  <value name="B"><block type="variables_get"><field name="VAR" id="${prefix}_maxloss">Max Cons Loss:</field></block></value>
                </block></value>
                <statement name="DO0"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">${stop_max}</field></block></value></block></statement>
                <value name="IF1"><block type="logic_compare"><field name="OP">GTE</field>
                  <value name="A"><block type="total_profit"></block></value>
                  <value name="B"><block type="variables_get"><field name="VAR" id="${prefix}_profit">Profit Threshold:</field></block></value>
                </block></value>
                <statement name="DO1"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow><block type="text"><field name="TEXT">${stop_tp}</field></block></value></block></statement>
                <statement name="ELSE"><block type="trade_again"></block></statement>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="${prefix}_before" collapsed="true" deletable="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="${prefix}_bp_if">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">GTE</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_prediction">Prediction:</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="purchase" id="${prefix}_buy"><field name="PURCHASE_LIST">DIGITDIFF</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
};

export const EVEN_HOT_DIGIT_XML = buildHotDigitDiffersXml('even');
export const ODD_HOT_DIGIT_XML = buildHotDigitDiffersXml('odd');
