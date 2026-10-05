/**
 * Rise/Fall Hedge free bot (Deriv Step Indices, default Step Index 100).
 *
 * Buys Rise and Fall at the same time with the same stake and duration and treats
 * them as one hedge. Combined P/L is computed from the actual Deriv payouts and
 * journaled with per-leg details, execution gap and session statistics.
 * Mode MANUAL fires one hedge per Run; AUTO fires every N ticks within the risk limits.
 * Flat stake: no martingale, no stake increase after losses.
 */

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const text = t => `<block type="text"><field name="TEXT">${t}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="rfh_set_${id}">
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
    ['rfh_stake', 'Stake', num(2)],
    ['rfh_duration', 'Duration Ticks', num(2)],
    ['rfh_mode', 'Mode (MANUAL or AUTO)', text('MANUAL')],
    ['rfh_every_n', 'AUTO Every N Ticks', num(10)],
    ['rfh_cooldown', 'AUTO Cooldown Seconds', num(10)],
    ['rfh_max_daily_hedges', 'Max Daily Hedges', num(50)],
    ['rfh_max_stake', 'Max Total Stake Per Hedge', num(10)],
    ['rfh_max_daily_loss', 'Max Daily Loss', num(25)],
    ['rfh_daily_loss_limit', 'Daily Loss Limit Stop', num(20)],
    ['rfh_daily_profit', 'Daily Profit Target Stop', num(20)],
    ['rfh_max_consec', 'Max Consecutive Losing Hedges', num(5)],
    ['rfh_max_trades', 'Max Number Of Hedges', num(100)],
    ['rfh_asym_ms', 'Asymmetric Execution ms', num(500)],
    ['rfh_policy', 'Incomplete Hedge Policy (CANCEL or RUN)', text('CANCEL')],
];

const v = id => {
    const entry = SETTINGS.find(([sid]) => sid === id);
    return varGet(entry[0], entry[1]);
};

export const RISE_FALL_HEDGE_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
${SETTINGS.map(([id, name]) => `    <variable id="${id}">${name}</variable>`).join('\n')}
  </variables>
  <block type="trade_definition" id="rfh_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="rfh_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">step_index</field>
        <field name="SYMBOL_LIST">stpRNG</field>
        <next>
          <block type="trade_definition_tradetype" id="rfh_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">callput</field>
            <field name="TRADETYPE_LIST">risefall</field>
            <next>
              <block type="trade_definition_contracttype" id="rfh_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="rfh_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="rfh_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="rfh_restart_err" deletable="false" movable="false">
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
      <block type="trade_definition_tradeoptions" id="rfh_tradeopts">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">${v('rfh_duration')}</value>
        <value name="AMOUNT">${v('rfh_stake')}</value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="rfh_before" deletable="false" x="0" y="900">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="controls_if" id="rfh_if_ready">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A">
              <block type="rise_fall_hedge_ready" id="rfh_ready">
                <value name="MODE">${v('rfh_mode')}</value>
                <value name="EVERY_N_TICKS">${v('rfh_every_n')}</value>
                <value name="COOLDOWN">${v('rfh_cooldown')}</value>
                <value name="MAX_DAILY_HEDGES">${v('rfh_max_daily_hedges')}</value>
                <value name="MAX_STAKE_PER_HEDGE">${v('rfh_max_stake')}</value>
                <value name="MAX_DAILY_LOSS">${v('rfh_max_daily_loss')}</value>
                <value name="DAILY_LOSS_LIMIT">${v('rfh_daily_loss_limit')}</value>
                <value name="DAILY_PROFIT_TARGET">${v('rfh_daily_profit')}</value>
                <value name="MAX_CONSECUTIVE_LOSSES">${v('rfh_max_consec')}</value>
                <value name="MAX_TRADES">${v('rfh_max_trades')}</value>
                <value name="ASYMMETRIC_MS">${v('rfh_asym_ms')}</value>
                <value name="INCOMPLETE_POLICY">${v('rfh_policy')}</value>
              </block>
            </value>
            <value name="B">${num(1)}</value>
          </block>
        </value>
        <statement name="DO0">
          <block type="rise_fall_hedge_purchase" id="rfh_buy"></block>
        </statement>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="rfh_after" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="rfh_if_again">
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">EQ</field>
            <value name="A"><block type="rise_fall_hedge_result" id="rfh_result"></block></value>
            <value name="B">${num(1)}</value>
          </block>
        </value>
        <statement name="DO0">
          <block type="trade_again" id="rfh_trade_again"></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`;
