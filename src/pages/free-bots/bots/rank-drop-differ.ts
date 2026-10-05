/**
 * Rank Drop Differs free bot.
 *
 * Ranks digits from highest to lowest frequency over the Analysis Window (default
 * 1000 ticks) as it was Lookback Ticks ago (default 100) and as it is now, and
 * Differs the digit with the single biggest rank deterioration when the drop is at
 * least the Minimum Rank Drop (default 3, e.g. #1 → #4).
 * Optional new-tick confirmation. Tied biggest movers → no trade.
 * Risk: Differs stake / take profit / stop loss / cooldown; Martingale 1 (flat stake).
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';
import { protectedMartingaleMultiplierXml } from './protected-martingale';

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="rdd_set_${id}">
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
        protect_id: 'rdd_protect',
        compare_stake_id: 'rdd_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'rdd_martingale',
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
                            <value name="B">${varGet('rdd_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="rdd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('rdd_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="rdd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const RANK_DROP_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="rdd_stake">Stake</variable>
    <variable id="rdd_base_stake">Base Stake</variable>
    <variable id="rdd_martingale">Martingale</variable>
    <variable id="rdd_protect">Martingale Off When Profit > Stake</variable>
    <variable id="rdd_take_profit">Take Profit</variable>
    <variable id="rdd_stop_loss">Stop Loss</variable>
    <variable id="rdd_window">Analysis Window</variable>
    <variable id="rdd_lookback">Lookback Ticks</variable>
    <variable id="rdd_min_drop">Minimum Rank Drop</variable>
    <variable id="rdd_enabled">Strategy Enabled</variable>
    <variable id="rdd_confirm">New-Tick Confirmation</variable>
    <variable id="rdd_cooldown_loss">Cooldown After Loss</variable>
    <variable id="rdd_cooldown_win">Cooldown After Win</variable>
    <variable id="rdd_signal">Entry Signal</variable>
    <variable id="rdd_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="rdd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="rdd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_75</field>
        <next>
          <block type="trade_definition_tradetype" id="rdd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="rdd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="rdd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rdd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="rdd_restart_err" deletable="false" movable="false">
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
              ['rdd_stake', 'Stake', num(0.5)],
              ['rdd_martingale', 'Martingale', num(1)],
              ['rdd_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['rdd_take_profit', 'Take Profit', num(20)],
              ['rdd_stop_loss', 'Stop Loss', num(50)],
              ['rdd_window', 'Analysis Window', num(1000)],
              ['rdd_lookback', 'Lookback Ticks', num(100)],
              ['rdd_min_drop', 'Minimum Rank Drop', num(3)],
              ['rdd_enabled', 'Strategy Enabled', bool(true)],
              ['rdd_confirm', 'New-Tick Confirmation', bool(true)],
          ],
          wrapCollapsedAdvancedInit(
              'rdd',
              chainSets([
                  ['rdd_base_stake', 'Base Stake', varGet('rdd_stake', 'Stake')],
                  ['rdd_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['rdd_cooldown_win', 'Cooldown After Win', num(1)],
                  ['rdd_signal', 'Entry Signal', bool(false)],
                  ['rdd_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="rdd_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('rdd_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="rdd_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="rdd_scan_pred">
                <field name="VAR" id="rdd_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="rank_drop_differ_scan" id="rdd_scan_block">
                    <value name="ANALYSIS_WINDOW">${varGet('rdd_window', 'Analysis Window')}</value>
                    <value name="LOOKBACK">${varGet('rdd_lookback', 'Lookback Ticks')}</value>
                    <value name="MIN_DROP">${varGet('rdd_min_drop', 'Minimum Rank Drop')}</value>
                    <value name="ENABLED">${varGet('rdd_enabled', 'Strategy Enabled')}</value>
                    <value name="CONFIRM">${varGet('rdd_confirm', 'New-Tick Confirmation')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="rdd_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('rdd_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="rdd_signal">Entry Signal</field>
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
          <block type="trade_definition_tradeoptions" id="rdd_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('rdd_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('rdd_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="rdd_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="rdd_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="rdd_stake">Stake</field>
            <value name="VALUE">${varGet('rdd_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="rdd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="rdd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('rdd_win_cd', varGet('rdd_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="rdd_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('rdd_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="rdd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="rdd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('rdd_loss_cd', varGet('rdd_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="rdd_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="rdd_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
