/**
 * Recurring Pattern Over 2 Consistency free bot.
 *
 * OVER 2 only. Fires when a recurring digit pattern has high Over 2 rate
 * AND high consistency (rolling / blocks / recent / streaks).
 * Journal shows WHY NO TRADE. Martingale 10.5 with optional protect.
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
    `<block type="variables_set" id="rpo_set_${id}">
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
        protect_id: 'rpo_protect',
        compare_stake_id: 'rpo_base_stake',
        compare_stake_name: 'Base Stake',
        martingale_id: 'rpo_martingale',
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
                            <value name="B">${varGet('rpo_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="rpo_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('rpo_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="rpo_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const RECURRING_PATTERN_OVER2_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="rpo_stake">Stake</variable>
    <variable id="rpo_base_stake">Base Stake</variable>
    <variable id="rpo_martingale">Martingale</variable>
    <variable id="rpo_protect">Martingale Off When Profit > Stake</variable>
    <variable id="rpo_take_profit">Take Profit</variable>
    <variable id="rpo_stop_loss">Stop Loss</variable>
    <variable id="rpo_len">Pattern Length</variable>
    <variable id="rpo_window">Analysis Tick Window</variable>
    <variable id="rpo_min_occ">Minimum Pattern Occurrences</variable>
    <variable id="rpo_min_rate">Minimum Over 2 Rate</variable>
    <variable id="rpo_min_edge">Minimum Edge</variable>
    <variable id="rpo_min_cons">Minimum Consistency Score</variable>
    <variable id="rpo_mode">Signal Mode</variable>
    <variable id="rpo_cooldown_signal">Cooldown After Signal</variable>
    <variable id="rpo_cooldown_loss">Cooldown After Loss</variable>
    <variable id="rpo_cooldown_win">Cooldown After Win</variable>
    <variable id="rpo_signal">Entry Signal</variable>
    <variable id="rpo_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="rpo_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="rpo_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="rpo_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="rpo_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="rpo_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rpo_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="rpo_restart_err" deletable="false" movable="false">
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
              ['rpo_stake', 'Stake', num(0.5)],
              ['rpo_martingale', 'Martingale', num(10.5)],
              ['rpo_protect', 'Martingale Off When Profit > Stake', bool(false)],
              ['rpo_take_profit', 'Take Profit', num(20)],
              ['rpo_stop_loss', 'Stop Loss', num(50)],
              ['rpo_len', 'Pattern Length', num(3)],
              ['rpo_window', 'Analysis Tick Window', num(1000)],
              ['rpo_min_occ', 'Minimum Pattern Occurrences', num(10)],
              ['rpo_min_rate', 'Minimum Over 2 Rate', num(75)],
              ['rpo_min_edge', 'Minimum Edge', num(5)],
              ['rpo_min_cons', 'Minimum Consistency Score', num(70)],
              ['rpo_mode', 'Signal Mode', text('active')],
          ],
          wrapCollapsedAdvancedInit(
              'rpo',
              chainSets([
                  ['rpo_base_stake', 'Base Stake', varGet('rpo_stake', 'Stake')],
                  ['rpo_cooldown_signal', 'Cooldown After Signal', num(1)],
                  ['rpo_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['rpo_cooldown_win', 'Cooldown After Win', num(1)],
                  ['rpo_signal', 'Entry Signal', bool(false)],
                  ['rpo_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="rpo_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('rpo_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="rpo_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="rpo_scan_pred">
                <field name="VAR" id="rpo_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="recurring_pattern_over2_scan" id="rpo_scan_block">
                    <value name="PATTERN_LENGTH">${varGet('rpo_len', 'Pattern Length')}</value>
                    <value name="ANALYSIS_WINDOW">${varGet('rpo_window', 'Analysis Tick Window')}</value>
                    <value name="MIN_OCCURRENCES">${varGet('rpo_min_occ', 'Minimum Pattern Occurrences')}</value>
                    <value name="MIN_OVER2_RATE">${varGet('rpo_min_rate', 'Minimum Over 2 Rate')}</value>
                    <value name="MIN_EDGE">${varGet('rpo_min_edge', 'Minimum Edge')}</value>
                    <value name="MIN_CONSISTENCY">${varGet('rpo_min_cons', 'Minimum Consistency Score')}</value>
                    <value name="MODE">${varGet('rpo_mode', 'Signal Mode')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="rpo_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('rpo_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="rpo_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${varGet('rpo_cooldown_signal', 'Cooldown After Signal')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="rpo_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('rpo_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('rpo_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="rpo_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="rpo_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="rpo_stake">Stake</field>
            <value name="VALUE">${varGet('rpo_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="rpo_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="rpo_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('rpo_win_cd', varGet('rpo_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="rpo_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('rpo_stake', 'Stake')}</value>
                <value name="B">${lossMultiplier()}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="rpo_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="rpo_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('rpo_loss_cd', varGet('rpo_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="rpo_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="rpo_buy">
        <field name="PURCHASE_LIST">DIGITOVER</field>
      </block>
    </statement>
  </block>
</xml>`;
