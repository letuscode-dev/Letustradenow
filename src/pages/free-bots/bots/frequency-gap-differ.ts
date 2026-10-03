/**
 * Frequency Gap Differs free bot.
 *
 * Over the single Analysis Window (min 50, default 1000 ticks) finds the unique
 * dominant (highest %) and unique weakest (lowest %) digit and Differs the dominant
 * digit when dominant % − weakest % ≥ Minimum Frequency Gap (default 4%).
 * Optional new-tick confirmation. Ties → no trade.
 * Risk: same Differs stake / take profit / stop loss / cooldown / Martingale as High-Low Tie Differs.
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';
import { protectedMartingaleMultiplierXml } from './protected-martingale';

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="fgd_set_${id}">
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
        protect_id: 'fgd_protect',
        compare_stake_id: 'fgd_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'fgd_martingale',
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
                            <value name="B">${varGet('fgd_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="fgd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('fgd_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="fgd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const FREQUENCY_GAP_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="fgd_stake">Stake</variable>
    <variable id="fgd_base_stake">Base Stake</variable>
    <variable id="fgd_martingale">Martingale</variable>
    <variable id="fgd_protect">Martingale Off When Profit > Stake</variable>
    <variable id="fgd_take_profit">Take Profit</variable>
    <variable id="fgd_stop_loss">Stop Loss</variable>
    <variable id="fgd_window">Analysis Window</variable>
    <variable id="fgd_min_gap">Minimum Frequency Gap %</variable>
    <variable id="fgd_enabled">Strategy Enabled</variable>
    <variable id="fgd_confirm">New-Tick Confirmation</variable>
    <variable id="fgd_cooldown_loss">Cooldown After Loss</variable>
    <variable id="fgd_cooldown_win">Cooldown After Win</variable>
    <variable id="fgd_signal">Entry Signal</variable>
    <variable id="fgd_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="fgd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="fgd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="fgd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="fgd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="fgd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="fgd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="fgd_restart_err" deletable="false" movable="false">
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
              ['fgd_stake', 'Stake', num(0.5)],
              ['fgd_martingale', 'Martingale', num(1)],
              ['fgd_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['fgd_take_profit', 'Take Profit', num(20)],
              ['fgd_stop_loss', 'Stop Loss', num(50)],
              ['fgd_window', 'Analysis Window', num(1000)],
              ['fgd_min_gap', 'Minimum Frequency Gap %', num(4)],
              ['fgd_enabled', 'Strategy Enabled', bool(true)],
              ['fgd_confirm', 'New-Tick Confirmation', bool(true)],
          ],
          wrapCollapsedAdvancedInit(
              'fgd',
              chainSets([
                  ['fgd_base_stake', 'Base Stake', varGet('fgd_stake', 'Stake')],
                  ['fgd_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['fgd_cooldown_win', 'Cooldown After Win', num(1)],
                  ['fgd_signal', 'Entry Signal', bool(false)],
                  ['fgd_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="fgd_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('fgd_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="fgd_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="fgd_scan_pred">
                <field name="VAR" id="fgd_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="frequency_gap_differ_scan" id="fgd_scan_block">
                    <value name="ANALYSIS_WINDOW">${varGet('fgd_window', 'Analysis Window')}</value>
                    <value name="MIN_GAP">${varGet('fgd_min_gap', 'Minimum Frequency Gap %')}</value>
                    <value name="ENABLED">${varGet('fgd_enabled', 'Strategy Enabled')}</value>
                    <value name="CONFIRM">${varGet('fgd_confirm', 'New-Tick Confirmation')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="fgd_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('fgd_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="fgd_signal">Entry Signal</field>
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
          <block type="trade_definition_tradeoptions" id="fgd_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('fgd_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('fgd_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="fgd_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="fgd_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="fgd_stake">Stake</field>
            <value name="VALUE">${varGet('fgd_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="fgd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="fgd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('fgd_win_cd', varGet('fgd_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="fgd_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('fgd_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="fgd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="fgd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('fgd_loss_cd', varGet('fgd_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="fgd_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="fgd_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
