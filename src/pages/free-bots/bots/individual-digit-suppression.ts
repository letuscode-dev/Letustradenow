/**
 * Individual Digit Suppression Strategy free bot.
 *
 * Over 2 / Over 3 suppression analysis drives Under 8 entries.
 * On loss: martingale recovery trades Under 6 at Base Stake × Martingale.
 * User variables: stake, risk, windows, cooldown, martingale multiplier.
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

const chainSets = entries => {
    let xml = '';
    for (let i = entries.length - 1; i >= 0; i--) {
        const [id, name, valueXml] = entries[i];
        xml = setVar(id, name, valueXml, xml);
    }
    return xml;
};

/** TP / SL gate then trade_again (shared by win + loss paths). */
const tpSlThenTradeAgain = (timeoutId, secondsXml) => `
                  <block type="timeout" id="${timeoutId}">
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
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const INDIVIDUAL_DIGIT_SUPPRESSION_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="ids_stake">Stake</variable>
    <variable id="ids_base_stake">Base Stake</variable>
    <variable id="ids_martingale">Martingale</variable>
    <variable id="ids_take_profit">Take Profit</variable>
    <variable id="ids_stop_loss">Stop Loss</variable>
    <variable id="ids_short">Short Window</variable>
    <variable id="ids_medium">Medium Window</variable>
    <variable id="ids_long">Long Window</variable>
    <variable id="ids_cooldown">Cooldown</variable>
    <variable id="ids_signal">Entry Signal</variable>
    <variable id="ids_prediction">Prediction</variable>
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
          ['ids_martingale', 'Martingale', num(2.1)],
          ['ids_take_profit', 'Take Profit', num(20)],
          ['ids_stop_loss', 'Stop Loss', num(50)],
          ['ids_short', 'Short Window', num(50)],
          ['ids_medium', 'Medium Window', num(100)],
          ['ids_long', 'Long Window', num(200)],
          ['ids_cooldown', 'Cooldown', num(2)],
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
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="ids_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">EQ</field>
                        <value name="A">${varGet('ids_prediction', 'Prediction')}</value>
                        <value name="B">${num(8)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="ids_prediction">Prediction</field>
                        <value name="VALUE">${num(8)}</value>
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
            <value name="SECONDS">${varGet('ids_cooldown', 'Cooldown')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="ids_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
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
                <field name="VAR" id="ids_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="ids_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('ids_win_cd', varGet('ids_cooldown', 'Cooldown'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="ids_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('ids_base_stake', 'Base Stake')}</value>
                <value name="B">${varGet('ids_martingale', 'Martingale')}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="ids_prediction">Prediction</field>
                <value name="VALUE">${num(6)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="ids_signal">Entry Signal</field>
                    <value name="VALUE">${bool(true)}</value>
                    <next>
${tpSlThenTradeAgain('ids_loss_cd', varGet('ids_cooldown', 'Cooldown'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="ids_before" deletable="false" collapsed="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="override_contract_type_purchase" id="ids_buy_under">
        <field name="CONTRACT_TYPE">DIGITUNDER</field>
      </block>
    </statement>
  </block>
</xml>`;
