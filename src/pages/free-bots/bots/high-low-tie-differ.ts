/**
 * High-Low Tie Differs free bot.
 *
 * Over the last N ticks (min 100, default 200) finds digits tied at the highest
 * (HIGH TIE) or lowest (LOW TIE) occurrence %, picks one with deterministic
 * tie-breakers (recent → micro → repetition → recency) and Differs it after
 * next-tick confirmation. Mode HIGH / LOW / AUTO.
 * Risk: Differs stake / take profit / stop loss / cooldown; Martingale 1 (flat stake).
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';
import { protectedMartingaleMultiplierXml } from './protected-martingale';

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const text = value => `<block type="text"><field name="TEXT">${value}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="hlt_set_${id}">
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
        protect_id: 'hlt_protect',
        compare_stake_id: 'hlt_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'hlt_martingale',
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
                            <value name="B">${varGet('hlt_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="hlt_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('hlt_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="hlt_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const HIGH_LOW_TIE_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="hlt_stake">Stake</variable>
    <variable id="hlt_base_stake">Base Stake</variable>
    <variable id="hlt_martingale">Martingale</variable>
    <variable id="hlt_protect">Martingale Off When Profit > Stake</variable>
    <variable id="hlt_take_profit">Take Profit</variable>
    <variable id="hlt_stop_loss">Stop Loss</variable>
    <variable id="hlt_mode">Mode (HIGH / LOW / AUTO)</variable>
    <variable id="hlt_window">Analysis Window</variable>
    <variable id="hlt_recent">Recent Window</variable>
    <variable id="hlt_micro">Micro Window</variable>
    <variable id="hlt_tolerance">Tie Tolerance %</variable>
    <variable id="hlt_cooldown_signal">Cooldown Ticks</variable>
    <variable id="hlt_cooldown_loss">Cooldown After Loss</variable>
    <variable id="hlt_cooldown_win">Cooldown After Win</variable>
    <variable id="hlt_signal">Entry Signal</variable>
    <variable id="hlt_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="hlt_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="hlt_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="hlt_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="hlt_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="hlt_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="hlt_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="hlt_restart_err" deletable="false" movable="false">
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
              ['hlt_stake', 'Stake', num(0.5)],
              ['hlt_martingale', 'Martingale', num(1)],
              ['hlt_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['hlt_take_profit', 'Take Profit', num(20)],
              ['hlt_stop_loss', 'Stop Loss', num(50)],
              ['hlt_mode', 'Mode (HIGH / LOW / AUTO)', text('AUTO')],
              ['hlt_window', 'Analysis Window', num(200)],
              ['hlt_recent', 'Recent Window', num(20)],
              ['hlt_micro', 'Micro Window', num(10)],
              ['hlt_tolerance', 'Tie Tolerance %', num(0)],
              ['hlt_cooldown_signal', 'Cooldown Ticks', num(1)],
          ],
          wrapCollapsedAdvancedInit(
              'hlt',
              chainSets([
                  ['hlt_base_stake', 'Base Stake', varGet('hlt_stake', 'Stake')],
                  ['hlt_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['hlt_cooldown_win', 'Cooldown After Win', num(1)],
                  ['hlt_signal', 'Entry Signal', bool(false)],
                  ['hlt_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="hlt_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('hlt_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="hlt_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="hlt_scan_pred">
                <field name="VAR" id="hlt_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="high_low_tie_differ_scan" id="hlt_scan_block">
                    <value name="ANALYSIS_WINDOW">${varGet('hlt_window', 'Analysis Window')}</value>
                    <value name="RECENT_WINDOW">${varGet('hlt_recent', 'Recent Window')}</value>
                    <value name="MICRO_WINDOW">${varGet('hlt_micro', 'Micro Window')}</value>
                    <value name="TIE_TOLERANCE">${varGet('hlt_tolerance', 'Tie Tolerance %')}</value>
                    <value name="MODE">${varGet('hlt_mode', 'Mode (HIGH / LOW / AUTO)')}</value>
                    <value name="COOLDOWN">${varGet('hlt_cooldown_signal', 'Cooldown Ticks')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="hlt_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('hlt_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="hlt_signal">Entry Signal</field>
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
          <block type="trade_definition_tradeoptions" id="hlt_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('hlt_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('hlt_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="hlt_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="hlt_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="hlt_stake">Stake</field>
            <value name="VALUE">${varGet('hlt_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="hlt_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="hlt_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('hlt_win_cd', varGet('hlt_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="hlt_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('hlt_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="hlt_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="hlt_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('hlt_loss_cd', varGet('hlt_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="hlt_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="hlt_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
