/**
 * Dominant Digit Percentage – Differ free bot.
 *
 * Finds the highest-occurrence digit in a rolling analysis window and trades
 * DIGITDIFF when dominance (and optional filters) pass. Default martingale 10.5.
 */

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
    `<block type="variables_set" id="ddp_set_${id}">
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

const tpSlThenTradeAgain = (timeoutId, secondsXml) => `
                  <block type="timeout" id="${timeoutId}">
                    <statement name="TIMEOUTSTACK">
                      <block type="controls_if">
                        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                        <value name="IF0">
                          <block type="logic_compare"><field name="OP">GTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">${varGet('ddp_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="ddp_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('ddp_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="ddp_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const DOMINANT_DIGIT_PERCENTAGE_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="ddp_stake">Stake</variable>
    <variable id="ddp_base_stake">Base Stake</variable>
    <variable id="ddp_martingale">Martingale</variable>
    <variable id="ddp_take_profit">Take Profit</variable>
    <variable id="ddp_stop_loss">Stop Loss</variable>
    <variable id="ddp_window">Analysis Tick Window</variable>
    <variable id="ddp_min_sample">Minimum Tick Sample</variable>
    <variable id="ddp_min_pct">Minimum Dominant Digit Percentage</variable>
    <variable id="ddp_gap_on">Require Minimum Dominance Gap</variable>
    <variable id="ddp_gap">Minimum Dominance Gap</variable>
    <variable id="ddp_persist_on">Enable Persistence Filter</variable>
    <variable id="ddp_persist">Minimum Dominance Persistence</variable>
    <variable id="ddp_multi_on">Enable Multi-Window Confirmation</variable>
    <variable id="ddp_short">Short Window</variable>
    <variable id="ddp_medium">Medium Window</variable>
    <variable id="ddp_long">Long Window</variable>
    <variable id="ddp_confirm">Minimum Confirming Windows</variable>
    <variable id="ddp_rank">Maximum Target Rank</variable>
    <variable id="ddp_tie">Tie Handling Method</variable>
    <variable id="ddp_weak">Weak Min %</variable>
    <variable id="ddp_moderate">Moderate Min %</variable>
    <variable id="ddp_strong">Strong Min %</variable>
    <variable id="ddp_vstrong">Very Strong Min %</variable>
    <variable id="ddp_cooldown_signal">Cooldown After Signal</variable>
    <variable id="ddp_cooldown_loss">Cooldown After Loss</variable>
    <variable id="ddp_cooldown_win">Cooldown After Win</variable>
    <variable id="ddp_signal">Entry Signal</variable>
    <variable id="ddp_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="ddp_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ddp_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_10</field>
        <next>
          <block type="trade_definition_tradetype" id="ddp_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="ddp_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ddp_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="ddp_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="ddp_restart_err" deletable="false" movable="false">
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
          ['ddp_stake', 'Stake', num(0.5)],
          ['ddp_base_stake', 'Base Stake', num(0.5)],
          ['ddp_martingale', 'Martingale', num(10.5)],
          ['ddp_take_profit', 'Take Profit', num(20)],
          ['ddp_stop_loss', 'Stop Loss', num(50)],
          ['ddp_window', 'Analysis Tick Window', num(200)],
          ['ddp_min_sample', 'Minimum Tick Sample', num(50)],
          ['ddp_min_pct', 'Minimum Dominant Digit Percentage', num(15)],
          ['ddp_gap_on', 'Require Minimum Dominance Gap', bool(false)],
          ['ddp_gap', 'Minimum Dominance Gap', num(3)],
          ['ddp_persist_on', 'Enable Persistence Filter', bool(false)],
          ['ddp_persist', 'Minimum Dominance Persistence', num(3)],
          ['ddp_multi_on', 'Enable Multi-Window Confirmation', bool(false)],
          ['ddp_short', 'Short Window', num(50)],
          ['ddp_medium', 'Medium Window', num(100)],
          ['ddp_long', 'Long Window', num(200)],
          ['ddp_confirm', 'Minimum Confirming Windows', num(2)],
          ['ddp_rank', 'Maximum Target Rank', num(1)],
          ['ddp_tie', 'Tie Handling Method', text('REJECT_TIE')],
          ['ddp_weak', 'Weak Min %', num(15)],
          ['ddp_moderate', 'Moderate Min %', num(17)],
          ['ddp_strong', 'Strong Min %', num(20)],
          ['ddp_vstrong', 'Very Strong Min %', num(25)],
          ['ddp_cooldown_signal', 'Cooldown After Signal', num(2)],
          ['ddp_cooldown_loss', 'Cooldown After Loss', num(5)],
          ['ddp_cooldown_win', 'Cooldown After Win', num(2)],
          ['ddp_signal', 'Entry Signal', bool(false)],
          ['ddp_prediction', 'Prediction', num(-1)],
      ])}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="ddp_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('ddp_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="ddp_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="ddp_scan_pred">
                <field name="VAR" id="ddp_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="dominant_digit_percentage_scan" id="ddp_scan_block">
                    <value name="ANALYSIS_WINDOW">${varGet('ddp_window', 'Analysis Tick Window')}</value>
                    <value name="MIN_SAMPLE">${varGet('ddp_min_sample', 'Minimum Tick Sample')}</value>
                    <value name="MIN_DOMINANT_PERCENT">${varGet('ddp_min_pct', 'Minimum Dominant Digit Percentage')}</value>
                    <value name="ENABLE_DOMINANCE_GAP">${varGet('ddp_gap_on', 'Require Minimum Dominance Gap')}</value>
                    <value name="MIN_DOMINANCE_GAP">${varGet('ddp_gap', 'Minimum Dominance Gap')}</value>
                    <value name="ENABLE_PERSISTENCE">${varGet('ddp_persist_on', 'Enable Persistence Filter')}</value>
                    <value name="MIN_PERSISTENCE">${varGet('ddp_persist', 'Minimum Dominance Persistence')}</value>
                    <value name="ENABLE_MULTI_WINDOW">${varGet('ddp_multi_on', 'Enable Multi-Window Confirmation')}</value>
                    <value name="SHORT_WINDOW">${varGet('ddp_short', 'Short Window')}</value>
                    <value name="MEDIUM_WINDOW">${varGet('ddp_medium', 'Medium Window')}</value>
                    <value name="LONG_WINDOW">${varGet('ddp_long', 'Long Window')}</value>
                    <value name="MIN_CONFIRMING_WINDOWS">${varGet('ddp_confirm', 'Minimum Confirming Windows')}</value>
                    <value name="MAX_TARGET_RANK">${varGet('ddp_rank', 'Maximum Target Rank')}</value>
                    <value name="TIE_HANDLING">${varGet('ddp_tie', 'Tie Handling Method')}</value>
                    <value name="WEAK_MIN">${varGet('ddp_weak', 'Weak Min %')}</value>
                    <value name="MODERATE_MIN">${varGet('ddp_moderate', 'Moderate Min %')}</value>
                    <value name="STRONG_MIN">${varGet('ddp_strong', 'Strong Min %')}</value>
                    <value name="VERY_STRONG_MIN">${varGet('ddp_vstrong', 'Very Strong Min %')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="ddp_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('ddp_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="ddp_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${varGet('ddp_cooldown_signal', 'Cooldown After Signal')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="ddp_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('ddp_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('ddp_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="ddp_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="ddp_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="ddp_stake">Stake</field>
            <value name="VALUE">${varGet('ddp_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="ddp_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="ddp_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('ddp_win_cd', varGet('ddp_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="ddp_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('ddp_stake', 'Stake')}</value>
                <value name="B">${varGet('ddp_martingale', 'Martingale')}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="ddp_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="ddp_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('ddp_loss_cd', varGet('ddp_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="ddp_before" deletable="false" collapsed="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="ddp_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
