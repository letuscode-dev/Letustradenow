/**
 * Last-Tick Price Digit Differ free bot.
 *
 * On every new tick the digit immediately before the decimal point of the price is the
 * Differs barrier (4681.35 → 1). The barrier is automatic — never entered by the user.
 * Entry conditions (confirmation, cooldown, limits) decide when a DIGITDIFF trade is
 * placed; every tick, decision and result is written to the Journal. Flat stake.
 */

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = b => `<block type="logic_boolean"><field name="BOOL">${b ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="ltd_set_${id}">
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

const SETTINGS = [
    ['ltd_stake', 'Stake', num(2)],
    ['ltd_duration', 'Duration', num(2)],
    ['ltd_auto', 'Auto Trading ON', bool(true)],
    ['ltd_confirm', 'Minimum Confirmation Ticks', num(2)],
    ['ltd_cooldown', 'Cooldown Between Trades (seconds)', num(2)],
    ['ltd_max_trades', 'Maximum Trades', num(50)],
    ['ltd_max_losses', 'Maximum Consecutive Losses', num(3)],
    ['ltd_stop_loss', 'Stop Loss', num(20)],
    ['ltd_take_profit', 'Take Profit', num(10)],
    ['ltd_stale', 'No-Tick Warning (seconds)', num(5)],
    ['ltd_status_every', 'Status Panel Every N Ticks', num(10)],
    ['ltd_barrier', 'Current Barrier (automatic)', '<block type="last_tick_digit_barrier"></block>'],
];

const VARIABLES = [...SETTINGS.map(([id, name]) => [id, name]), ['ltd_signal', 'Entry Signal']];

const v = id => {
    const entry = VARIABLES.find(([vid]) => vid === id);
    return varGet(entry[0], entry[1]);
};

const ANALYZE_INPUTS = [
    ['AUTO_TRADING', 'ltd_auto'],
    ['CONFIRMATION_TICKS', 'ltd_confirm'],
    ['COOLDOWN', 'ltd_cooldown'],
    ['MAX_TRADES', 'ltd_max_trades'],
    ['MAX_CONSECUTIVE_LOSSES', 'ltd_max_losses'],
    ['STOP_LOSS', 'ltd_stop_loss'],
    ['TAKE_PROFIT', 'ltd_take_profit'],
    ['STALE_SECONDS', 'ltd_stale'],
    ['STATUS_EVERY', 'ltd_status_every'],
];

export const LAST_TICK_PRICE_DIGIT_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, name]) => `    <variable id="${id}">${name}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="ltd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ltd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_75</field>
        <next>
          <block type="trade_definition_tradetype" id="ltd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="ltd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="ltd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="ltd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="ltd_restart_err" deletable="false" movable="false">
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
      ${chainSets(SETTINGS)}
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="ltd_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('ltd_duration')}</value>
        <value name="AMOUNT">${v('ltd_stake')}</value>
        <value name="PREDICTION">${v('ltd_barrier')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="ltd_before" deletable="false" x="0" y="900">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="variables_set" id="ltd_set_signal">
        <field name="VAR" id="ltd_signal">Entry Signal</field>
        <value name="VALUE">
          <block type="last_tick_digit_differ_analyze" id="ltd_analyze">
${ANALYZE_INPUTS.map(([input, id]) => `            <value name="${input}">${v(id)}</value>`).join('\n')}
          </block>
        </value>
        <next>
          <block type="controls_if" id="ltd_if_ready">
            <value name="IF0">
              <block type="logic_compare">
                <field name="OP">GTE</field>
                <value name="A">${v('ltd_signal')}</value>
                <value name="B">${num(0)}</value>
              </block>
            </value>
            <statement name="DO0">
              <block type="variables_set" id="ltd_set_barrier_live">
                <field name="VAR" id="ltd_barrier">Current Barrier (automatic)</field>
                <value name="VALUE">${v('ltd_signal')}</value>
                <next>
                  <block type="last_tick_digit_differ_purchase" id="ltd_buy"></block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="ltd_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="ltd_if_again">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A"><block type="last_tick_digit_differ_result" id="ltd_result"></block></value>
            <value name="B">${num(1)}</value>
          </block>
        </value>
        <statement name="DO0">
          <block type="trade_again" id="ltd_trade_again"></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
