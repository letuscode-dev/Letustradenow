/**
 * Double Digit → Return Differs free bot.
 *
 * The custom scan block maintains ten independent X → X → Y state machines.
 */
export const DOUBLE_DIGIT_RETURN_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="dd_stake">Stake</variable>
    <variable id="dd_window">Analysis Window</variable>
    <variable id="dd_duration">Trade Duration</variable>
    <variable id="dd_max_trades">Maximum Trades</variable>
    <variable id="dd_cooldown">Cooldown</variable>
    <variable id="dd_simultaneous">Maximum simultaneous trades</variable>
    <variable id="dd_auto">Auto-trading</variable>
    <variable id="dd_trades">Trades</variable>
    <variable id="dd_signal">Signal</variable>
    <variable id="dd_prediction">Target Differ</variable>
    <variable id="dd_stop">Stop</variable>
  </variables>
  <block type="trade_definition" id="dd_trade_definition" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="dd_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_10</field>
        <next><block type="trade_definition_tradetype" id="dd_type" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">matchesdiffers</field>
          <next><block type="trade_definition_contracttype" id="dd_contract" deletable="false" movable="false"><field name="TYPE_LIST">both</field>
            <next><block type="trade_definition_candleinterval" id="dd_candle" deletable="false" movable="false"><field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="dd_restart" deletable="false" movable="false"><field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="dd_restart_error" deletable="false" movable="false"><field name="RESTARTONERROR">TRUE</field></block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="dd_init_window"><field name="VAR" id="dd_window">Analysis Window</field><value name="VALUE"><block type="math_number"><field name="NUM">120</field></block></value>
        <next><block type="variables_set" id="dd_init_stake"><field name="VAR" id="dd_stake">Stake</field><value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value>
          <next><block type="variables_set" id="dd_init_duration"><field name="VAR" id="dd_duration">Trade Duration</field><value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
            <next><block type="variables_set" id="dd_init_auto"><field name="VAR" id="dd_auto">Auto-trading</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value></block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="dd_scan_loop"><field name="MODE">UNTIL</field><value name="BOOL"><block type="variables_get"><field name="VAR" id="dd_signal">Signal</field></block></value>
        <statement name="DO"><block type="timeout" id="dd_scan_timeout"><statement name="TIMEOUTSTACK"><block type="variables_set" id="dd_scan_prediction"><field name="VAR" id="dd_prediction">Target Differ</field><value name="VALUE"><block type="double_digit_return_differs_prediction"><value name="WINDOW"><block type="variables_get"><field name="VAR" id="dd_window">Analysis Window</field></block></value><value name="AUTO"><block type="variables_get"><field name="VAR" id="dd_auto">Auto-trading</field></block></value><value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value></block></value>
          <next><block type="controls_if" id="dd_signal_if"><value name="IF0"><block type="logic_compare"><field name="OP">GTE</field><value name="A"><block type="variables_get"><field name="VAR" id="dd_prediction">Target Differ</field></block></value><value name="B"><block type="math_number"><field name="NUM">0</field></block></value></block></value><statement name="DO0"><block type="variables_set"><field name="VAR" id="dd_signal">Signal</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value></block></statement></block></next>
        </block></statement><value name="SECONDS"><block type="math_number"><field name="NUM">5</field></block></value></block></statement>
        <next><block type="trade_definition_tradeoptions" id="dd_options"><mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation><field name="DURATIONTYPE_LIST">t</field><value name="DURATION"><block type="variables_get"><field name="VAR" id="dd_duration">Trade Duration</field></block></value><value name="AMOUNT"><block type="variables_get"><field name="VAR" id="dd_stake">Stake</field></block></value><value name="PREDICTION"><block type="variables_get"><field name="VAR" id="dd_prediction">Target Differ</field></block></value></block></next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="dd_after_purchase" x="900" y="60"><statement name="AFTERPURCHASE_STACK"><block type="math_change"><field name="VAR" id="dd_trades">Trades</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value><next><block type="variables_set"><field name="VAR" id="dd_signal">Signal</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value><next><block type="trade_again" id="dd_trade_again"></block></next></block></next></block></statement></block>
  <block type="before_purchase" id="dd_before_purchase" deletable="false" x="0" y="900"><statement name="BEFOREPURCHASE_STACK"><block type="apollo_purchase"><field name="PURCHASE_LIST">DIGITDIFF</field></block></statement></block>
</xml>`;
