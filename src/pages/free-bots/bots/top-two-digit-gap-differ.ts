/**
 * Top Two Digit Gap DIFFER free bot.
 *
 * Over the last N ticks (default 1000), when the gap between the most and
 * second-most appearing digits meets the threshold (default 0.5pp) and the
 * current digit is one of them, Differ the other one.
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
    `<block type="variables_set" id="ttg_set_${id}">
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
        protect_id: 'ttg_protect',
        compare_stake_id: 'ttg_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'ttg_martingale',
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
                            <value name="B">${varGet('ttg_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="ttg_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('ttg_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="ttg_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const TOP_TWO_DIGIT_GAP_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="ttg_stake">Stake</variable>
    <variable id="ttg_base_stake">Base Stake</variable>
    <variable id="ttg_martingale">Martingale</variable>
    <variable id="ttg_protect">Martingale Off When Profit > Stake</variable>
    <variable id="ttg_take_profit">Take Profit</variable>
    <variable id="ttg_stop_loss">Stop Loss</variable>
    <variable id="ttg_window">Analysis Tick Window</variable>
    <variable id="ttg_gap">Gap Threshold</variable>
    <variable id="ttg_gap_mode">Gap Mode</variable>
    <variable id="ttg_cooldown_signal">Cooldown After Signal</variable>
    <variable id="ttg_cooldown_loss">Cooldown After Loss</variable>
    <variable id="ttg_cooldown_win">Cooldown After Win</variable>
    <variable id="ttg_signal">Entry Signal</variable>
    <variable id="ttg_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="ttg_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ttg_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="ttg_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="ttg_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ttg_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="ttg_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="ttg_restart_err" deletable="false" movable="false">
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
              ['ttg_stake', 'Stake', num(0.5)],
              ['ttg_martingale', 'Martingale', num(10.5)],
              ['ttg_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['ttg_take_profit', 'Take Profit', num(20)],
              ['ttg_stop_loss', 'Stop Loss', num(50)],
              ['ttg_window', 'Analysis Tick Window', num(1000)],
              ['ttg_gap', 'Gap Threshold', num(0.5)],
              ['ttg_gap_mode', 'Gap Mode', text('max')],
          ],
          wrapCollapsedAdvancedInit(
              'ttg',
              chainSets([
                  ['ttg_base_stake', 'Base Stake', varGet('ttg_stake', 'Stake')],
                  ['ttg_cooldown_signal', 'Cooldown After Signal', num(1)],
                  ['ttg_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['ttg_cooldown_win', 'Cooldown After Win', num(1)],
                  ['ttg_signal', 'Entry Signal', bool(false)],
                  ['ttg_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="ttg_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('ttg_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="ttg_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="ttg_scan_pred">
                <field name="VAR" id="ttg_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="top_two_digit_gap_differ_scan" id="ttg_scan_block">
                    <value name="ANALYSIS_WINDOW">${varGet('ttg_window', 'Analysis Tick Window')}</value>
                    <value name="GAP_THRESHOLD">${varGet('ttg_gap', 'Gap Threshold')}</value>
                    <value name="GAP_MODE">${varGet('ttg_gap_mode', 'Gap Mode')}</value>
                    <value name="COOLDOWN">${varGet('ttg_cooldown_signal', 'Cooldown After Signal')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="ttg_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('ttg_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="ttg_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${varGet('ttg_cooldown_signal', 'Cooldown After Signal')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="ttg_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('ttg_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('ttg_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="ttg_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="ttg_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="ttg_stake">Stake</field>
            <value name="VALUE">${varGet('ttg_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="ttg_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="ttg_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('ttg_win_cd', varGet('ttg_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="ttg_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('ttg_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="ttg_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="ttg_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('ttg_loss_cd', varGet('ttg_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="ttg_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="ttg_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
