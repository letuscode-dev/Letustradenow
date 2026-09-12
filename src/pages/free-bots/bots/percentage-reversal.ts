/**
 * Percentage Reversal free bot.
 *
 * Multi-market: scans Selected Symbols for digit % dominance → collapse,
 * then trades DIGITDIFF on the strongest match (switching market when needed).
 */

const escapeXml = value =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const text = value => `<block type="text"><field name="TEXT">${escapeXml(value)}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="pr_set_${id}">
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
                            <value name="B">${varGet('pr_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="pr_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('pr_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="pr_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

/**
 * @param {string[]} selected_symbols
 */
export const buildPercentageReversalXml = (selected_symbols: string[] = []) => {
    const symbols = selected_symbols.map(item => String(item || '').trim()).filter(Boolean);
    const primary = symbols[0] || 'R_10';
    const symbols_csv = symbols.join(',');

    return `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="pr_symbols">Selected Symbols</variable>
    <variable id="pr_stake">Stake</variable>
    <variable id="pr_base_stake">Base Stake</variable>
    <variable id="pr_martingale">Martingale</variable>
    <variable id="pr_take_profit">Take Profit</variable>
    <variable id="pr_stop_loss">Stop Loss</variable>
    <variable id="pr_short">Short Window</variable>
    <variable id="pr_medium">Medium Window</variable>
    <variable id="pr_long">Long Window</variable>
    <variable id="pr_dominance">Dominance Min %</variable>
    <variable id="pr_collapse">Collapse Max %</variable>
    <variable id="pr_min_drop">Minimum Drop %</variable>
    <variable id="pr_cooldown_signal">Cooldown After Signal</variable>
    <variable id="pr_cooldown_loss">Cooldown After Loss</variable>
    <variable id="pr_cooldown_win">Cooldown After Win</variable>
    <variable id="pr_signal">Entry Signal</variable>
    <variable id="pr_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="pr_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="pr_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${escapeXml(primary)}</field>
        <next>
          <block type="trade_definition_tradetype" id="pr_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="pr_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="pr_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="pr_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="pr_restart_err" deletable="false" movable="false">
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
          ['pr_symbols', 'Selected Symbols', text(symbols_csv)],
          ['pr_stake', 'Stake', num(0.5)],
          ['pr_base_stake', 'Base Stake', num(0.5)],
          ['pr_martingale', 'Martingale', num(10.5)],
          ['pr_take_profit', 'Take Profit', num(20)],
          ['pr_stop_loss', 'Stop Loss', num(50)],
          ['pr_short', 'Short Window', num(50)],
          ['pr_medium', 'Medium Window', num(100)],
          ['pr_long', 'Long Window', num(200)],
          ['pr_dominance', 'Dominance Min %', num(15)],
          ['pr_collapse', 'Collapse Max %', num(10)],
          ['pr_min_drop', 'Minimum Drop %', num(7)],
          ['pr_cooldown_signal', 'Cooldown After Signal', num(2)],
          ['pr_cooldown_loss', 'Cooldown After Loss', num(5)],
          ['pr_cooldown_win', 'Cooldown After Win', num(2)],
          ['pr_signal', 'Entry Signal', bool(false)],
          ['pr_prediction', 'Prediction', num(-1)],
      ])}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="pr_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('pr_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="pr_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="pr_scan_pred">
                <field name="VAR" id="pr_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="percentage_reversal_scan" id="pr_scan_block">
                    <value name="SYMBOLS">${varGet('pr_symbols', 'Selected Symbols')}</value>
                    <value name="SHORT_WINDOW">${varGet('pr_short', 'Short Window')}</value>
                    <value name="MEDIUM_WINDOW">${varGet('pr_medium', 'Medium Window')}</value>
                    <value name="LONG_WINDOW">${varGet('pr_long', 'Long Window')}</value>
                    <value name="DOMINANCE_MIN">${varGet('pr_dominance', 'Dominance Min %')}</value>
                    <value name="COLLAPSE_MAX">${varGet('pr_collapse', 'Collapse Max %')}</value>
                    <value name="MIN_DROP">${varGet('pr_min_drop', 'Minimum Drop %')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="pr_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('pr_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="pr_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${varGet('pr_cooldown_signal', 'Cooldown After Signal')}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="pr_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('pr_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('pr_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="pr_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="pr_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="pr_stake">Stake</field>
            <value name="VALUE">${varGet('pr_base_stake', 'Base Stake')}</value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="pr_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="pr_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('pr_win_cd', varGet('pr_cooldown_win', 'Cooldown After Win'))}
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="pr_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A">${varGet('pr_stake', 'Stake')}</value>
                <value name="B">${varGet('pr_martingale', 'Martingale')}</value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="pr_prediction">Prediction</field>
                <value name="VALUE">${num(-1)}</value>
                <next>
                  <block type="variables_set">
                    <field name="VAR" id="pr_signal">Entry Signal</field>
                    <value name="VALUE">${bool(false)}</value>
                    <next>
${tpSlThenTradeAgain('pr_loss_cd', varGet('pr_cooldown_loss', 'Cooldown After Loss'))}
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
  <block type="before_purchase" id="pr_before" deletable="false" collapsed="false" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="pr_buy">
        <field name="PURCHASE_LIST">DIGITDIFF</field>
      </block>
    </statement>
  </block>
</xml>`;
};

/** Default XML for Free Bots catalog. */
export const PERCENTAGE_REVERSAL_XML = buildPercentageReversalXml([
    '1HZ50V',
    'R_10',
    'R_25',
]);
