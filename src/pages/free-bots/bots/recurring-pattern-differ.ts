/**
 * Recurring Pattern Differ free bot.
 *
 * When a recurring digit sequence completes, Differ the historically most
 * frequent next digit if sample / percentage / advantage / gap filters pass.
 * Risk management matches Digit Percentage Decrease – Differ (martingale 10.5).
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
    `<block type="variables_set" id="rpd_set_${id}">
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
        protect_id: 'rpd_protect',
        compare_stake_id: 'rpd_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'rpd_martingale',
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
                            <value name="B">${varGet('rpd_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="rpd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('rpd_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="rpd_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const RECURRING_PATTERN_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="rpd_stake">Stake</variable>
    <variable id="rpd_base_stake">Base Stake</variable>
    <variable id="rpd_martingale">Martingale</variable>
    <variable id="rpd_protect">Martingale Off When Profit > Stake</variable>
    <variable id="rpd_take_profit">Take Profit</variable>
    <variable id="rpd_stop_loss">Stop Loss</variable>
    <variable id="rpd_min_len">Pattern Minimum Length</variable>
    <variable id="rpd_max_len">Pattern Maximum Length</variable>
    <variable id="rpd_window">Analysis Tick Window</variable>
    <variable id="rpd_min_occ">Minimum Pattern Occurrences</variable>
    <variable id="rpd_min_pct">Minimum Target Digit Percentage</variable>
    <variable id="rpd_min_adv">Minimum Target Advantage</variable>
    <variable id="rpd_min_gap">Minimum Target Gap</variable>
    <variable id="rpd_prefer">Conflict Preference</variable>
    <variable id="rpd_cooldown_signal">Cooldown After Signal</variable>
    <variable id="rpd_cooldown_loss">Cooldown After Loss</variable>
    <variable id="rpd_cooldown_win">Cooldown After Win</variable>
    <variable id="rpd_signal">Entry Signal</variable>
    <variable id="rpd_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="rpd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="rpd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="rpd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="rpd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="rpd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rpd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="rpd_restart_err" deletable="false" movable="false">
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
              ['rpd_stake', 'Stake', num(0.5)],
              ['rpd_martingale', 'Martingale', num(10.5)],
              ['rpd_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['rpd_take_profit', 'Take Profit', num(20)],
              ['rpd_stop_loss', 'Stop Loss', num(50)],
              ['rpd_min_len', 'Pattern Minimum Length', num(2)],
              ['rpd_max_len', 'Pattern Maximum Length', num(6)],
              ['rpd_window', 'Analysis Tick Window', num(1000)],
              ['rpd_min_occ', 'Minimum Pattern Occurrences', num(50)],
              ['rpd_min_pct', 'Minimum Target Digit Percentage', num(15)],
              ['rpd_min_adv', 'Minimum Target Advantage', num(4)],
              ['rpd_min_gap', 'Minimum Target Gap', num(3)],
              ['rpd_prefer', 'Conflict Preference', text('longest')],
          ],
          wrapCollapsedAdvancedInit(
              'rpd',
              chainSets([
                  ['rpd_base_stake', 'Base Stake', varGet('rpd_stake', 'Stake')],
                  ['rpd_cooldown_signal', 'Cooldown After Signal', num(2)],
                  ['rpd_cooldown_loss', 'Cooldown After Loss', num(5)],
                  ['rpd_cooldown_win', 'Cooldown After Win', num(2)],
                  ['rpd_signal', 'Entry Signal', bool(false)],
                  ['rpd_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="rpd_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('rpd_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="rpd_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="rpd_scan_pred">
                <field name="VAR" id="rpd_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="recurring_pattern_differ_scan" id="rpd_scan_block">
                    <value name="MIN_LENGTH">${varGet('rpd_min_len', 'Pattern Minimum Length')}</value>
                    <value name="MAX_LENGTH">${varGet('rpd_max_len', 'Pattern Maximum Length')}</value>
                    <value name="ANALYSIS_WINDOW">${varGet('rpd_window', 'Analysis Tick Window')}</value>
                    <value name="MIN_OCCURRENCES">${varGet('rpd_min_occ', 'Minimum Pattern Occurrences')}</value>
                    <value name="MIN_TARGET_PCT">${varGet('rpd_min_pct', 'Minimum Target Digit Percentage')}</value>
                    <value name="MIN_ADVANTAGE">${varGet('rpd_min_adv', 'Minimum Target Advantage')}</value>
                    <value name="MIN_TARGET_GAP">${varGet('rpd_min_gap', 'Minimum Target Gap')}</value>
                    <value name="CONFLICT_PREFERENCE">${varGet('rpd_prefer', 'Conflict Preference')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="rpd_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('rpd_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="rpd_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${varGet('rpd_cooldown_signal', 'Cooldown After Signal')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="rpd_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('rpd_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('rpd_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="rpd_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="rpd_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="rpd_stake">Stake</field>
            <value name="VALUE">${varGet('rpd_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="rpd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="rpd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('rpd_win_cd', varGet('rpd_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="rpd_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('rpd_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="rpd_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="rpd_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('rpd_loss_cd', varGet('rpd_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="rpd_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="rpd_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
