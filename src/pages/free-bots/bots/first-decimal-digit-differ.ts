/**
 * First Decimal Digit Differ + 10.5 Recovery free bot.
 *
 * On every new tick the FIRST digit after the decimal point of the price is the Differs
 * barrier (4681.35 → 3). The barrier is automatic — never entered by the user. After a
 * loss the next stake is previous stake × Recovery Multiplier (default 10.5); a win
 * resets to the base stake. Maximum Recovery Level / Stake pause trading.
 */

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = b => `<block type="logic_boolean"><field name="BOOL">${b ? 'TRUE' : 'FALSE'}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="fdd_set_${id}">
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
    ['fdd_stake', 'Stake', num(2)],
    ['fdd_duration', 'Duration', num(2)],
    ['fdd_recovery', 'Recovery Enabled', bool(true)],
    ['fdd_multiplier', 'Recovery Multiplier', num(10.5)],
    ['fdd_max_level', 'Maximum Recovery Level', num(2)],
    ['fdd_max_recovery_stake', 'Maximum Recovery Stake', num(250)],
    ['fdd_max_losses', 'Maximum Consecutive Losses', num(3)],
    ['fdd_stop_loss', 'Stop Loss', num(250)],
    ['fdd_take_profit', 'Take Profit', num(20)],
    ['fdd_max_trades', 'Maximum Trades', num(100)],
    ['fdd_cooldown', 'Cooldown Between Trades (seconds)', num(2)],
    ['fdd_auto', 'Auto Trading ON', bool(true)],
    ['fdd_confirm', 'Minimum Confirmation Ticks', num(1)],
    ['fdd_stale', 'No-Tick Warning (seconds)', num(5)],
    ['fdd_status_every', 'Status Panel Every N Ticks', num(10)],
    ['fdd_barrier', 'Current Barrier (automatic)', '<block type="first_decimal_digit_barrier"></block>'],
];

const VARIABLES = [...SETTINGS.map(([id, name]) => [id, name]), ['fdd_signal', 'Entry Signal']];

const v = id => {
    const entry = VARIABLES.find(([vid]) => vid === id);
    return varGet(entry[0], entry[1]);
};

const ANALYZE_INPUTS = [
    ['BASE_STAKE', 'fdd_stake'],
    ['AUTO_TRADING', 'fdd_auto'],
    ['CONFIRMATION_TICKS', 'fdd_confirm'],
    ['RECOVERY_ENABLED', 'fdd_recovery'],
    ['RECOVERY_MULTIPLIER', 'fdd_multiplier'],
    ['MAX_RECOVERY_LEVEL', 'fdd_max_level'],
    ['MAX_RECOVERY_STAKE', 'fdd_max_recovery_stake'],
    ['MAX_CONSECUTIVE_LOSSES', 'fdd_max_losses'],
    ['STOP_LOSS', 'fdd_stop_loss'],
    ['TAKE_PROFIT', 'fdd_take_profit'],
    ['MAX_TRADES', 'fdd_max_trades'],
    ['COOLDOWN', 'fdd_cooldown'],
    ['STALE_SECONDS', 'fdd_stale'],
    ['STATUS_EVERY', 'fdd_status_every'],
];

export const FIRST_DECIMAL_DIGIT_DIFFER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${VARIABLES.map(([id, name]) => `    <variable id="${id}">${name}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="fdd_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="fdd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
        <next>
          <block type="trade_definition_tradetype" id="fdd_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">matchesdiffers</field>
            <next>
              <block type="trade_definition_contracttype" id="fdd_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITDIFF</field>
                <next>
                  <block type="trade_definition_candleinterval" id="fdd_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="fdd_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="fdd_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="fdd_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('fdd_duration')}</value>
        <value name="AMOUNT">${v('fdd_stake')}</value>
        <value name="PREDICTION">${v('fdd_barrier')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="fdd_before" deletable="false" x="0" y="1000">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="variables_set" id="fdd_set_signal">
        <field name="VAR" id="fdd_signal">Entry Signal</field>
        <value name="VALUE">
          <block type="first_decimal_digit_differ_analyze" id="fdd_analyze">
${ANALYZE_INPUTS.map(([input, id]) => `            <value name="${input}">${v(id)}</value>`).join('\n')}
          </block>
        </value>
        <next>
          <block type="controls_if" id="fdd_if_ready">
            <value name="IF0">
              <block type="logic_compare">
                <field name="OP">GTE</field>
                <value name="A">${v('fdd_signal')}</value>
                <value name="B">${num(0)}</value>
              </block>
            </value>
            <statement name="DO0">
              <block type="variables_set" id="fdd_set_barrier_live">
                <field name="VAR" id="fdd_barrier">Current Barrier (automatic)</field>
                <value name="VALUE">${v('fdd_signal')}</value>
                <next>
                  <block type="first_decimal_digit_differ_purchase" id="fdd_buy"></block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="fdd_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="fdd_if_again">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A"><block type="first_decimal_digit_differ_result" id="fdd_result"></block></value>
            <value name="B">${num(1)}</value>
          </block>
        </value>
        <statement name="DO0">
          <block type="trade_again" id="fdd_trade_again"></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
