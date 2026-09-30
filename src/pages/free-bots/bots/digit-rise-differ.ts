/**
 * Digit Rise DIFFER free bot.
 *
 * Tracks the appearance % of the user's Target Digits (comma-separated, at most
 * 9, default "0") over the last N ticks (default 120). When any target %
 * increases on a new tick, Differ the current digit.
 * Risk: martingale 10.5 with optional Martingale Off When Profit > Stake + cooldown.
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';
import { protectedMartingaleMultiplierXml } from './protected-martingale';

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const text = value =>
    `<block type="text"><field name="TEXT">${String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="drd_set_${id}">
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

const lossMultiplier = () =>
    protectedMartingaleMultiplierXml({
        protect_id: 'drd_protect',
        compare_stake_id: 'drd_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'drd_martingale',
        martingale_name: 'Martingale',
    });

const tpSlThenTradeAgain = (timeoutId, secondsXml) => `
                  <block type="timeout" id="${timeoutId}">
                    <statement name="TIMEOUTSTACK">
                      <block type="controls_if">
                        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                        <value name="IF0">
                          <block type="logic_compare"><field name="OP">GTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">${varGet('drd_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="drd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('drd_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="drd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const DIGIT_RISE_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="drd_stake">Stake</variable>
    <variable id="drd_base_stake">Base Stake</variable>
    <variable id="drd_martingale">Martingale</variable>
    <variable id="drd_protect">Martingale Off When Profit > Stake</variable>
    <variable id="drd_take_profit">Take Profit</variable>
    <variable id="drd_stop_loss">Stop Loss</variable>
    <variable id="drd_targets">Target Digits</variable>
    <variable id="drd_window">Analysis Tick Window</variable>
    <variable id="drd_lookback">Compare Lookback Ticks</variable>
    <variable id="drd_cooldown_signal">Cooldown After Signal</variable>
    <variable id="drd_cooldown_loss">Cooldown After Loss</variable>
    <variable id="drd_cooldown_win">Cooldown After Win</variable>
    <variable id="drd_signal">Entry Signal</variable>
    <variable id="drd_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="drd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="drd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="drd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="drd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="drd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="drd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="drd_restart_err" deletable="false" movable="false">
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
              ['drd_stake', 'Stake', num(0.5)],
              ['drd_martingale', 'Martingale', num(10.5)],
              ['drd_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['drd_take_profit', 'Take Profit', num(20)],
              ['drd_stop_loss', 'Stop Loss', num(50)],
              ['drd_targets', 'Target Digits', text('0')],
              ['drd_window', 'Analysis Tick Window', num(120)],
              ['drd_lookback', 'Compare Lookback Ticks', num(1)],
          ],
          wrapCollapsedAdvancedInit(
              'drd',
              chainSets([
                  ['drd_base_stake', 'Base Stake', varGet('drd_stake', 'Stake')],
                  ['drd_cooldown_signal', 'Cooldown After Signal', num(1)],
                  ['drd_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['drd_cooldown_win', 'Cooldown After Win', num(1)],
                  ['drd_signal', 'Entry Signal', bool(false)],
                  ['drd_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="drd_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('drd_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="drd_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="drd_scan_pred">
                <field name="VAR" id="drd_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="digit_rise_differ_scan" id="drd_scan_block">
                    <value name="TARGET_DIGITS">${varGet('drd_targets', 'Target Digits')}</value>
                    <value name="ANALYSIS_WINDOW">${varGet('drd_window', 'Analysis Tick Window')}</value>
                    <value name="COMPARE_LOOKBACK">${varGet('drd_lookback', 'Compare Lookback Ticks')}</value>
                    <value name="COOLDOWN">${varGet('drd_cooldown_signal', 'Cooldown After Signal')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="drd_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('drd_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="drd_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${num(0.5)}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="drd_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('drd_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('drd_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="drd_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="drd_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="drd_stake">Stake</field>
            <value name="VALUE">${varGet('drd_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="drd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="drd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('drd_win_cd', varGet('drd_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="drd_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('drd_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="drd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="drd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('drd_loss_cd', varGet('drd_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="drd_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="drd_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
