/**
 * Digit Percentage Decrease – Differ free bot.
 *
 * Rolling window (default 1000): when any digit’s occurrence % drops by at least
 * 0.1pp vs the previous window, trade DIGITDIFF on that digit. Martingale 10.5.
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="dpd_set_${id}">
      <field name="VAR" id="${id}">${name}</field>
      <value name="VALUE">${valueXml}</value>
      ${nextXml ? `<next>${nextXml}</next>` : ''}
    </block>`;

const chainSets = (entries, tailXml = '') => {
    let xml = tailXml;
    for (let i = entries.length - 1; i >= 0; i--) {
        const [id, name, valueXml] = entries[i];
        xml = setVar(id, name, valueXml, xml);
    }
    return xml;
};

const tpSlThenTradeAgain = (timeoutId, secondsXml) => `
                  <block type="timeout" id="${timeoutId}">
                    <statement name="TIMEOUTSTACK">
                      <block type="controls_if">
                        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                        <value name="IF0">
                          <block type="logic_compare"><field name="OP">GTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">${varGet('dpd_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="dpd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('dpd_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="dpd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const DIGIT_PERCENTAGE_DECREASE_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="dpd_stake">Stake</variable>
    <variable id="dpd_base_stake">Base Stake</variable>
    <variable id="dpd_martingale">Martingale</variable>
    <variable id="dpd_take_profit">Take Profit</variable>
    <variable id="dpd_stop_loss">Stop Loss</variable>
    <variable id="dpd_window">Analysis Tick Window</variable>
    <variable id="dpd_min_drop">Minimum Percentage Decrease</variable>
    <variable id="dpd_cooldown_signal">Cooldown After Signal</variable>
    <variable id="dpd_cooldown_loss">Cooldown After Loss</variable>
    <variable id="dpd_cooldown_win">Cooldown After Win</variable>
    <variable id="dpd_signal">Entry Signal</variable>
    <variable id="dpd_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="dpd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="dpd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_10</field>
        <next>
          <block type="trade_definition_tradetype" id="dpd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="dpd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="dpd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="dpd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="dpd_restart_err" deletable="false" movable="false">
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
      ${chainSets(
          [
              ['dpd_stake', 'Stake', num(0.5)],
              ['dpd_martingale', 'Martingale', num(10.5)],
              ['dpd_take_profit', 'Take Profit', num(20)],
              ['dpd_stop_loss', 'Stop Loss', num(50)],
              ['dpd_window', 'Analysis Tick Window', num(1000)],
              ['dpd_min_drop', 'Minimum Percentage Decrease', num(0.1)],
          ],
          wrapCollapsedAdvancedInit(
              'dpd',
              chainSets([
                  ['dpd_base_stake', 'Base Stake', num(0.5)],
                  ['dpd_cooldown_signal', 'Cooldown After Signal', num(2)],
                  ['dpd_cooldown_loss', 'Cooldown After Loss', num(5)],
                  ['dpd_cooldown_win', 'Cooldown After Win', num(2)],
                  ['dpd_signal', 'Entry Signal', bool(false)],
                  ['dpd_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="dpd_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('dpd_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="dpd_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="dpd_scan_pred">
                <field name="VAR" id="dpd_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="digit_percentage_decrease_scan" id="dpd_scan_block">
                    <value name="ANALYSIS_WINDOW">${varGet('dpd_window', 'Analysis Tick Window')}</value>
                    <value name="MIN_DECREASE">${varGet('dpd_min_drop', 'Minimum Percentage Decrease')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="dpd_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('dpd_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="dpd_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${varGet('dpd_cooldown_signal', 'Cooldown After Signal')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="dpd_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('dpd_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('dpd_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="dpd_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="dpd_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="dpd_stake">Stake</field>
            <value name="VALUE">${varGet('dpd_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="dpd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="dpd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('dpd_win_cd', varGet('dpd_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="dpd_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('dpd_stake', 'Stake')}</value>
                <value name="B">${varGet('dpd_martingale', 'Martingale')}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="dpd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="dpd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('dpd_loss_cd', varGet('dpd_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="dpd_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="dpd_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
