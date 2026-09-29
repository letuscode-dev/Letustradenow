/**
 * Zero/One Rise OVER 1 free bot.
 *
 * Tracks the appearance % of digits 0 and 1 over the last N ticks (default 1000).
 * When either % increases on a new tick, enter DIGITOVER.
 * Risk: Over 1 normally; after a loss, recover with Over 2 and stake × 2.5
 * (Martingale) until a win resets to Over 1 at Base Stake.
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';
import { protectedMartingaleMultiplierXml } from './protected-martingale';

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="zor_set_${id}">
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
        protect_id: 'zor_protect',
        compare_stake_id: 'zor_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'zor_martingale',
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
                            <value name="B">${varGet('zor_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="zor_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('zor_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="zor_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const ZERO_ONE_RISE_OVER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="zor_stake">Stake</variable>
    <variable id="zor_base_stake">Base Stake</variable>
    <variable id="zor_martingale">Martingale</variable>
    <variable id="zor_protect">Martingale Off When Profit > Stake</variable>
    <variable id="zor_take_profit">Take Profit</variable>
    <variable id="zor_stop_loss">Stop Loss</variable>
    <variable id="zor_window">Analysis Tick Window</variable>
    <variable id="zor_lookback">Compare Lookback Ticks</variable>
    <variable id="zor_entry_barrier">Entry Over Barrier</variable>
    <variable id="zor_recovery_barrier">Recovery Over Barrier</variable>
    <variable id="zor_barrier">Barrier</variable>
    <variable id="zor_cooldown_signal">Cooldown After Signal</variable>
    <variable id="zor_cooldown_loss">Cooldown After Loss</variable>
    <variable id="zor_cooldown_win">Cooldown After Win</variable>
    <variable id="zor_signal">Entry Signal</variable>
    <variable id="zor_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="zor_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="zor_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="zor_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="zor_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="zor_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="zor_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="zor_restart_err" deletable="false" movable="false">
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
              ['zor_stake', 'Stake', num(0.5)],
              ['zor_martingale', 'Martingale', num(2.5)],
              ['zor_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['zor_take_profit', 'Take Profit', num(20)],
              ['zor_stop_loss', 'Stop Loss', num(50)],
              ['zor_window', 'Analysis Tick Window', num(1000)],
              ['zor_lookback', 'Compare Lookback Ticks', num(1)],
              ['zor_entry_barrier', 'Entry Over Barrier', num(1)],
              ['zor_recovery_barrier', 'Recovery Over Barrier', num(2)],
          ],
          wrapCollapsedAdvancedInit(
              'zor',
              chainSets([
                  ['zor_base_stake', 'Base Stake', varGet('zor_stake', 'Stake')],
                  ['zor_barrier', 'Barrier', varGet('zor_entry_barrier', 'Entry Over Barrier')],
                  ['zor_cooldown_signal', 'Cooldown After Signal', num(1)],
                  ['zor_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['zor_cooldown_win', 'Cooldown After Win', num(1)],
                  ['zor_signal', 'Entry Signal', bool(false)],
                  ['zor_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="zor_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('zor_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="zor_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="zor_scan_pred">
                <field name="VAR" id="zor_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="zero_one_rise_over_scan" id="zor_scan_block">
                    <value name="ANALYSIS_WINDOW">${varGet('zor_window', 'Analysis Tick Window')}</value>
                    <value name="COMPARE_LOOKBACK">${varGet('zor_lookback', 'Compare Lookback Ticks')}</value>
                    <value name="BARRIER">${varGet('zor_barrier', 'Barrier')}</value>
                    <value name="COOLDOWN">${varGet('zor_cooldown_signal', 'Cooldown After Signal')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="zor_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('zor_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="zor_signal">Entry Signal</field>
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
          <block type="trade_definition_tradeoptions" id="zor_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('zor_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('zor_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="zor_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="zor_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="zor_stake">Stake</field>
            <value name="VALUE">${varGet('zor_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="zor_barrier">Barrier</field>
                <value name="VALUE">${varGet('zor_entry_barrier', 'Entry Over Barrier')}</value>
                <next>
              <block type="variables_set">
                <field name="VAR" id="zor_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="zor_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('zor_win_cd', varGet('zor_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="zor_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('zor_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="zor_barrier">Barrier</field>
                <value name="VALUE">${varGet('zor_recovery_barrier', 'Recovery Over Barrier')}</value>
                <next>
              <block type="variables_set">
                <field name="VAR" id="zor_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="zor_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('zor_loss_cd', varGet('zor_cooldown_loss', 'Cooldown After Loss'))}
                    </next>
                  </block>
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
  <block type="before_purchase" id="zor_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="zor_buy">
        <field name="PURCHASE_LIST">DIGITOVER</field>
      </block>
    </statement>
  </block>
</xml>`;
