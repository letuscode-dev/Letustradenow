/**
 * Multi-volatility Triple-digit Martingale free bot.
 *
 * Signal (same as Martingale.xml): last 3 digits equal → Digit Differs on the
 * 4th-from-end digit. Scans only the volatilities the user selected.
 */

export type TripleDigitMartingaleParams = {
    stake?: number;
    size?: number;
    take_profit?: number;
    stop_loss?: number;
};

export const DEFAULT_TRIPLE_DIGIT_MARTINGALE_PARAMS: Required<TripleDigitMartingaleParams> = {
    stake: 2.6,
    size: 10.5,
    take_profit: 100,
    stop_loss: 1000,
};

const escapeXml = value =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const toPositiveNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * @param {string[]} selected_symbols
 * @param {TripleDigitMartingaleParams} [params]
 */
export const buildTripleDigitMartingaleXml = (
    selected_symbols: string[] = [],
    params: TripleDigitMartingaleParams = {}
) => {
    const symbols = selected_symbols.map(item => String(item || '').trim()).filter(Boolean);
    const primary = symbols[0] || '1HZ50V';
    const symbols_csv = escapeXml(symbols.join(','));
    const stake = toPositiveNumber(params.stake, DEFAULT_TRIPLE_DIGIT_MARTINGALE_PARAMS.stake);
    const size = toPositiveNumber(params.size, DEFAULT_TRIPLE_DIGIT_MARTINGALE_PARAMS.size);
    const take_profit = toPositiveNumber(
        params.take_profit,
        DEFAULT_TRIPLE_DIGIT_MARTINGALE_PARAMS.take_profit
    );
    const stop_loss = toPositiveNumber(params.stop_loss, DEFAULT_TRIPLE_DIGIT_MARTINGALE_PARAMS.stop_loss);

    return `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="tdm_stake">Stake</variable>
    <variable id="tdm_base_stake">Base Stake</variable>
    <variable id="tdm_size">Martingale Size</variable>
    <variable id="tdm_take_profit">Take Profit</variable>
    <variable id="tdm_stop_loss">Stop Loss</variable>
    <variable id="tdm_symbols">Selected Symbols</variable>
    <variable id="tdm_signal">Entry Signal</variable>
    <variable id="tdm_prediction">Prediction</variable>
    <variable id="tdm_duration">Trade Duration</variable>
  </variables>
  <block type="trade_definition" id="tdm_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="tdm_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${escapeXml(primary)}</field>
        <next>
          <block type="trade_definition_tradetype" id="tdm_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="tdm_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="tdm_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="tdm_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="tdm_restart_err" deletable="false" movable="false">
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
      <block type="variables_set" id="tdm_init_symbols">
        <field name="VAR" id="tdm_symbols">Selected Symbols</field>
        <value name="VALUE"><block type="text"><field name="TEXT">${symbols_csv}</field></block></value>
        <next>
          <block type="variables_set" id="tdm_init_stake">
            <field name="VAR" id="tdm_stake">Stake</field>
            <value name="VALUE"><block type="math_number"><field name="NUM">${stake}</field></block></value>
            <next>
              <block type="variables_set" id="tdm_init_base">
                <field name="VAR" id="tdm_base_stake">Base Stake</field>
                <value name="VALUE"><block type="variables_get"><field name="VAR" id="tdm_stake">Stake</field></block></value>
                <next>
                  <block type="variables_set" id="tdm_init_size">
                    <field name="VAR" id="tdm_size">Martingale Size</field>
                    <value name="VALUE"><block type="math_number"><field name="NUM">${size}</field></block></value>
                    <next>
                      <block type="variables_set" id="tdm_init_tp">
                        <field name="VAR" id="tdm_take_profit">Take Profit</field>
                        <value name="VALUE"><block type="math_number"><field name="NUM">${take_profit}</field></block></value>
                        <next>
                          <block type="variables_set" id="tdm_init_sl">
                            <field name="VAR" id="tdm_stop_loss">Stop Loss</field>
                            <value name="VALUE"><block type="math_number"><field name="NUM">${stop_loss}</field></block></value>
                            <next>
                              <block type="variables_set" id="tdm_init_duration">
                                <field name="VAR" id="tdm_duration">Trade Duration</field>
                                <value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
                                <next>
                                  <block type="variables_set" id="tdm_init_signal">
                                    <field name="VAR" id="tdm_signal">Entry Signal</field>
                                    <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
                                    <next>
                                      <block type="variables_set" id="tdm_init_prediction">
                                        <field name="VAR" id="tdm_prediction">Prediction</field>
                                        <value name="VALUE"><block type="math_number"><field name="NUM">-1</field></block></value>
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
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="tdm_scan_loop">
        <field name="MODE">UNTIL</field>
        <value name="BOOL"><block type="variables_get"><field name="VAR" id="tdm_signal">Entry Signal</field></block></value>
        <statement name="DO">
          <block type="timeout" id="tdm_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="tdm_scan_prediction">
                <field name="VAR" id="tdm_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="triple_digit_martingale_scan" id="tdm_scan_block">
                    <value name="SYMBOLS"><block type="variables_get"><field name="VAR" id="tdm_symbols">Selected Symbols</field></block></value>
                    <value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="tdm_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A"><block type="variables_get"><field name="VAR" id="tdm_prediction">Prediction</field></block></value>
                        <value name="B"><block type="math_number"><field name="NUM">0</field></block></value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="tdm_signal">Entry Signal</field>
                        <value name="VALUE"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS"><block type="math_number"><field name="NUM">1</field></block></value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="tdm_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION"><block type="variables_get"><field name="VAR" id="tdm_duration">Trade Duration</field></block></value>
            <value name="AMOUNT"><block type="variables_get"><field name="VAR" id="tdm_stake">Stake</field></block></value>
            <value name="PREDICTION"><block type="variables_get"><field name="VAR" id="tdm_prediction">Prediction</field></block></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="tdm_after" collapsed="false" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="tdm_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">
          <block type="variables_set">
            <field name="VAR" id="tdm_stake">Stake</field>
            <value name="VALUE"><block type="variables_get"><field name="VAR" id="tdm_base_stake">Base Stake</field></block></value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="tdm_signal">Entry Signal</field>
                <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="variables_set">
            <field name="VAR" id="tdm_stake">Stake</field>
            <value name="VALUE">
              <block type="math_arithmetic"><field name="OP">MULTIPLY</field>
                <value name="A"><block type="variables_get"><field name="VAR" id="tdm_stake">Stake</field></block></value>
                <value name="B"><block type="variables_get"><field name="VAR" id="tdm_size">Martingale Size</field></block></value>
              </block>
            </value>
            <next>
              <block type="variables_set">
                <field name="VAR" id="tdm_signal">Entry Signal</field>
                <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
              </block>
            </next>
          </block>
        </statement>
        <next>
          <block type="controls_if">
            <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
            <value name="IF0">
              <block type="logic_compare"><field name="OP">GTE</field>
                <value name="A"><block type="total_profit"></block></value>
                <value name="B"><block type="variables_get"><field name="VAR" id="tdm_take_profit">Take Profit</field></block></value>
              </block>
            </value>
            <statement name="DO0">
              <block type="variables_set">
                <field name="VAR" id="tdm_signal">Entry Signal</field>
                <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
              </block>
            </statement>
            <value name="IF1">
              <block type="logic_compare"><field name="OP">LTE</field>
                <value name="A"><block type="total_profit"></block></value>
                <value name="B">
                  <block type="math_single"><field name="OP">NEG</field>
                    <value name="NUM"><block type="variables_get"><field name="VAR" id="tdm_stop_loss">Stop Loss</field></block></value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO1">
              <block type="variables_set">
                <field name="VAR" id="tdm_signal">Entry Signal</field>
                <value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
              </block>
            </statement>
            <statement name="ELSE"><block type="trade_again"></block></statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="tdm_before" deletable="false" collapsed="false" x="0" y="980">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="tdm_buy"><field name="PURCHASE_LIST">DIGITDIFF</field></block>
    </statement>
  </block>
</xml>`;
};

/** Default XML for catalog preview / fallback (original Martingale market). */
export const TRIPLE_DIGIT_MARTINGALE_XML = buildTripleDigitMartingaleXml(
    ['1HZ50V', 'R_10', 'R_25'],
    DEFAULT_TRIPLE_DIGIT_MARTINGALE_PARAMS
);
