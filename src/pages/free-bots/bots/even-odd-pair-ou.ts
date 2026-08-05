/**
 * Free bots — Even-pair Over 2 and Odd-pair Under 7.
 *
 * Over: last 2 digits even and < Even_max (default 5) → DIGITOVER 2.
 *       On loss: stake = Total_loss * 100 / Payout% (default 60), barrier 3 until recovered.
 *
 * Under: last 2 digits odd and > Odd_min (default 4) → DIGITUNDER 7.
 *        On loss: stake = Total_loss * 100 / Payout% (default 60), barrier 6 until recovered.
 */

type PairSide = 'OVER' | 'UNDER';

const buildEvenOddPairXml = (side: PairSide): string => {
    const is_over = side === 'OVER';
    const prefix = is_over ? 'epo' : 'opu';
    const type_list = is_over ? 'DIGITOVER' : 'DIGITUNDER';
    const purchase = is_over ? 'DIGITOVER' : 'DIGITUNDER';
    const market_side = is_over ? 'OVER' : 'UNDER';
    const threshold_var = is_over ? 'Even_max' : 'Odd_min';
    const threshold_id = `${prefix}_threshold`;
    const threshold_default = is_over ? '5' : '4';
    const fn_name = is_over ? 'Even Pair Over Barrier' : 'Odd Pair Under Barrier';
    const stop_max = is_over
        ? 'Max consecutive losses reached. Stopping (Even-pair Over).'
        : 'Max consecutive losses reached. Stopping (Odd-pair Under).';
    const stop_tp = is_over
        ? 'Profit threshold reached. Stopping (Even-pair Over).'
        : 'Profit threshold reached. Stopping (Odd-pair Under).';

    return `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="${prefix}_stake">Stake</variable>
    <variable id="${prefix}_inarow">InArow</variable>
    <variable id="${prefix}_maxloss">Max Cons Loss:</variable>
    <variable id="${prefix}_totalloss">Total_loss</variable>
    <variable id="${prefix}_prediction">Prediction:</variable>
    <variable id="${prefix}_profit">Profit Threshold:</variable>
    <variable id="${prefix}_initstake">Initial_stake</variable>
    <variable id="${prefix}_payout">Payout%</variable>
    <variable id="${prefix}_duration">Duration</variable>
    <variable id="${threshold_id}">${threshold_var}</variable>
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
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="${prefix}_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">${type_list}</field>
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
              <block type="variables_set" id="${prefix}_set_threshold">
                <field name="VAR" id="${threshold_id}">${threshold_var}</field>
                <value name="VALUE"><block type="math_number"><field name="NUM">${threshold_default}</field></block></value>
                <next>
                  <block type="variables_set" id="${prefix}_set_maxloss">
                    <field name="VAR" id="${prefix}_maxloss">Max Cons Loss:</field>
                    <value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                    <next>
                      <block type="variables_set" id="${prefix}_set_profit">
                        <field name="VAR" id="${prefix}_profit">Profit Threshold:</field>
                        <value name="VALUE"><block type="math_number"><field name="NUM">7</field></block></value>
                        <next>
                          <block type="variables_set" id="${prefix}_set_payout">
                            <field name="VAR" id="${prefix}_payout">Payout%</field>
                            <value name="VALUE"><block type="math_number"><field name="NUM">60</field></block></value>
                            <next>
                              <block type="variables_set" id="${prefix}_set_init">
                                <field name="VAR" id="${prefix}_initstake">Initial_stake</field>
                                <value name="VALUE"><block type="variables_get"><field name="VAR" id="${prefix}_stake">Stake</field></block></value>
                                <next>
                                  <block type="variables_set" id="${prefix}_set_inarow">
                                    <field name="VAR" id="${prefix}_inarow">InArow</field>
                                    <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                    <next>
                                      <block type="variables_set" id="${prefix}_set_totalloss">
                                        <field name="VAR" id="${prefix}_totalloss">Total_loss</field>
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
      <block type="variables_set" id="${prefix}_set_pred">
        <field name="VAR" id="${prefix}_prediction">Prediction:</field>
        <value name="VALUE">
          <block type="procedures_callreturn" id="${prefix}_call_barrier">
            <mutation name="${fn_name}"></mutation>
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
    <field name="NAME">${fn_name}</field>
    <value name="RETURN">
      <block type="even_odd_pair_over_under" id="${prefix}_signal">
        <field name="MARKET_SIDE">${market_side}</field>
        <value name="THRESHOLD"><block type="variables_get"><field name="VAR" id="${threshold_id}">${threshold_var}</field></block></value>
        <value name="RECOVERING">
          <block type="logic_compare">
            <field name="OP">GT</field>
            <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_totalloss">Total_loss</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
          </block>
        </value>
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
              <block type="math_change"><field name="VAR" id="${prefix}_totalloss">Total_loss</field><value name="DELTA"><block type="variables_get"><field name="VAR" id="${prefix}_initstake">Initial_stake</field></block></value></block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set"><field name="VAR" id="${prefix}_inarow">InArow</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
            <next>
              <block type="math_change"><field name="VAR" id="${prefix}_totalloss">Total_loss</field>
                <value name="DELTA">
                  <block type="math_single"><field name="OP">NEG</field>
                    <value name="NUM"><block type="read_details"><field name="DETAIL_INDEX">4</field></block></value>
                  </block>
                </value>
                <next>
                  <block type="controls_if">
                    <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                      <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_totalloss">Total_loss</field></block></value>
                      <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                    </block></value>
                    <statement name="DO0"><block type="variables_set"><field name="VAR" id="${prefix}_totalloss">Total_loss</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value></block></statement>
                    <next>
                      <block type="controls_if">
                        <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                          <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_totalloss">Total_loss</field></block></value>
                          <value name="B"><block type="math_number"><field name="NUM">0.01</field></block></value>
                        </block></value>
                        <statement name="DO0"><block type="variables_set"><field name="VAR" id="${prefix}_totalloss">Total_loss</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value></block></statement>
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
              <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_totalloss">Total_loss</field></block></value>
              <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
            </block></value>
            <statement name="DO0">
              <block type="controls_if">
                <value name="IF0"><block type="logic_compare"><field name="OP">LTE</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_payout">Payout%</field></block></value>
                  <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                </block></value>
                <statement name="DO0"><block type="variables_set"><field name="VAR" id="${prefix}_payout">Payout%</field><value name="VALUE"><block type="math_number"><field name="NUM">60</field></block></value></block></statement>
                <next>
                  <block type="variables_set"><field name="VAR" id="${prefix}_initstake">Initial_stake</field>
                    <value name="VALUE">
                      <block type="math_arithmetic"><field name="OP">DIVIDE</field>
                        <value name="A"><block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                          <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_totalloss">Total_loss</field></block></value>
                          <value name="B"><block type="math_number"><field name="NUM">100</field></block></value>
                        </block></value>
                        <value name="B"><block type="variables_get"><field name="VAR" id="${prefix}_payout">Payout%</field></block></value>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="variables_set"><field name="VAR" id="${prefix}_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="${prefix}_stake">Stake</field></block></value></block>
            </statement>
            <next>
              <block type="controls_if">
                <value name="IF0"><block type="logic_compare"><field name="OP">LT</field>
                  <value name="A"><block type="variables_get"><field name="VAR" id="${prefix}_initstake">Initial_stake</field></block></value>
                  <value name="B"><block type="variables_get"><field name="VAR" id="${prefix}_stake">Stake</field></block></value>
                </block></value>
                <statement name="DO0"><block type="variables_set"><field name="VAR" id="${prefix}_initstake">Initial_stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="${prefix}_stake">Stake</field></block></value></block></statement>
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
          <block type="purchase" id="${prefix}_buy"><field name="PURCHASE_LIST">${purchase}</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
};

export const EVEN_PAIR_OVER_XML = buildEvenOddPairXml('OVER');
export const ODD_PAIR_UNDER_XML = buildEvenOddPairXml('UNDER');
