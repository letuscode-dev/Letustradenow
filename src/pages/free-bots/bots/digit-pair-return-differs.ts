/**
 * Digit Pair → Return Differs free bot.
 *
 * When last digits form A → B → C → D, Differs D.
 * Risk management matches Double Digit → Return Differs.
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';

export const DIGIT_PAIR_RETURN_DIFFERS_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="dpr_stake">Stake</variable>
    <variable id="dpr_base_stake">Base Stake</variable>
    <variable id="dpr_stop_loss">Consecutive Loss Stop</variable>
    <variable id="dpr_take_profit">Take Profit</variable>
    <variable id="dpr_protect">Martingale Off When Profit > Stake</variable>
    <variable id="dpr_losses">Consecutive Losses</variable>
    <variable id="dpr_recovery">Recovery Pending</variable>
    <variable id="dpr_recovery_multiplier">Recovery Multiplier</variable>
    <variable id="dpr_window">Analysis Window</variable>
    <variable id="dpr_duration">Trade Duration</variable>
    <variable id="dpr_max_trades">Maximum Trades</variable>
    <variable id="dpr_cooldown">Cooldown</variable>
    <variable id="dpr_simultaneous">Maximum simultaneous trades</variable>
    <variable id="dpr_auto">Auto-trading</variable>
    <variable id="dpr_trades">Trades</variable>
    <variable id="dpr_signal">Signal</variable>
    <variable id="dpr_prediction">Target Differ</variable>
    <variable id="dpr_stop">Stop</variable>
  </variables>
  <block type="trade_definition" id="dpr_trade_definition" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="dpr_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_10</field>
        <next><block type="trade_definition_tradetype" id="dpr_type" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">matchesdiffers</field>
          <next><block type="trade_definition_contracttype" id="dpr_contract" deletable="false" movable="false"><field name="TYPE_LIST">both</field>
            <next><block type="trade_definition_candleinterval" id="dpr_candle" deletable="false" movable="false"><field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="dpr_restart" deletable="false" movable="false"><field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="dpr_restart_error" deletable="false" movable="false"><field name="RESTARTONERROR">TRUE</field></block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="dpr_init_stake"><field name="VAR" id="dpr_stake">Stake</field><value name="VALUE"><block type="math_number"><field name="NUM">0.35</field></block></value>
        <next><block type="variables_set" id="dpr_init_recovery_multiplier"><field name="VAR" id="dpr_recovery_multiplier">Recovery Multiplier</field><value name="VALUE"><block type="math_number"><field name="NUM">10.5</field></block></value>
          <next><block type="variables_set" id="dpr_init_protect"><field name="VAR" id="dpr_protect">Martingale Off When Profit > Stake</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
          <next><block type="variables_set" id="dpr_init_take_profit"><field name="VAR" id="dpr_take_profit">Take Profit</field><value name="VALUE"><block type="math_number"><field name="NUM">10</field></block></value>
            <next><block type="variables_set" id="dpr_init_stop_loss"><field name="VAR" id="dpr_stop_loss">Consecutive Loss Stop</field><value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
              <next><block type="variables_set" id="dpr_init_window"><field name="VAR" id="dpr_window">Analysis Window</field><value name="VALUE"><block type="math_number"><field name="NUM">120</field></block></value>
                <next>${wrapCollapsedAdvancedInit(
                    'dpr',
                    `<block type="variables_set" id="dpr_init_base_stake"><field name="VAR" id="dpr_base_stake">Base Stake</field><value name="VALUE"><block type="variables_get"><field name="VAR" id="dpr_stake">Stake</field></block></value>
                      <next><block type="variables_set" id="dpr_init_duration"><field name="VAR" id="dpr_duration">Trade Duration</field><value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
                        <next><block type="variables_set" id="dpr_init_max"><field name="VAR" id="dpr_max_trades">Maximum Trades</field><value name="VALUE"><block type="math_number"><field name="NUM">100</field></block></value>
                          <next><block type="variables_set" id="dpr_init_cooldown"><field name="VAR" id="dpr_cooldown">Cooldown</field><value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value>
                            <next><block type="variables_set" id="dpr_init_simultaneous"><field name="VAR" id="dpr_simultaneous">Maximum simultaneous trades</field><value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
                              <next><block type="variables_set" id="dpr_init_auto"><field name="VAR" id="dpr_auto">Auto-trading</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value>
                                <next><block type="variables_set" id="dpr_init_trades"><field name="VAR" id="dpr_trades">Trades</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                  <next><block type="variables_set" id="dpr_init_losses"><field name="VAR" id="dpr_losses">Consecutive Losses</field><value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
                                    <next><block type="variables_set" id="dpr_init_recovery"><field name="VAR" id="dpr_recovery">Recovery Pending</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
                                      <next><block type="variables_set" id="dpr_init_signal"><field name="VAR" id="dpr_signal">Signal</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value>
                                        <next><block type="variables_set" id="dpr_init_prediction"><field name="VAR" id="dpr_prediction">Target Differ</field><value name="VALUE"><block type="math_number"><field name="NUM">-1</field></block></value>
                                          <next><block type="variables_set" id="dpr_init_stop"><field name="VAR" id="dpr_stop">Stop</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">FALSE</field></block></value></block></next>
                                        </block></next>
                                      </block></next>
                                    </block></next>
                                  </block></next>
                                </block></next>
                              </block></next>
                            </block></next>
                          </block></next>
                        </block></next>
                      </block></next>
                    </block>`
                )}</next>
              </block></next>
            </block></next>
          </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="dpr_scan_loop" collapsed="true"><field name="MODE">UNTIL</field><value name="BOOL"><block type="logic_operation"><field name="OP">OR</field><value name="A"><block type="variables_get"><field name="VAR" id="dpr_signal">Signal</field></block></value><value name="B"><block type="variables_get"><field name="VAR" id="dpr_stop">Stop</field></block></value></block></value>
        <statement name="DO"><block type="timeout" id="dpr_scan_timeout"><statement name="TIMEOUTSTACK"><block type="controls_if" id="dpr_stop_guard"><value name="IF0"><block type="logic_negate"><value name="BOOL"><block type="variables_get"><field name="VAR" id="dpr_stop">Stop</field></block></value></block></value><statement name="DO0"><block type="variables_set" id="dpr_scan_prediction"><field name="VAR" id="dpr_prediction">Target Differ</field><value name="VALUE"><block type="digit_pair_return_differs_prediction"><value name="WINDOW"><block type="variables_get"><field name="VAR" id="dpr_window">Analysis Window</field></block></value><value name="AUTO"><block type="variables_get"><field name="VAR" id="dpr_auto">Auto-trading</field></block></value><value name="JOURNAL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value></block></value>
          <next><block type="controls_if" id="dpr_signal_if"><value name="IF0"><block type="logic_compare"><field name="OP">GTE</field><value name="A"><block type="variables_get"><field name="VAR" id="dpr_prediction">Target Differ</field></block></value><value name="B"><block type="math_number"><field name="NUM">0</field></block></value></block></value><statement name="DO0"><block type="variables_set"><field name="VAR" id="dpr_signal">Signal</field><value name="VALUE"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value></block></statement></block></next>
        </block></statement></block></statement><value name="SECONDS"><block type="variables_get"><field name="VAR" id="dpr_cooldown">Cooldown</field></block></value></block></statement>
        <next><block type="controls_if" id="dpr_trade_guard"><value name="IF0"><block type="logic_operation"><field name="OP">AND</field><value name="A"><block type="variables_get"><field name="VAR" id="dpr_signal">Signal</field></block></value><value name="B"><block type="logic_negate"><value name="BOOL"><block type="variables_get"><field name="VAR" id="dpr_stop">Stop</field></block></value></block></value></block></value><statement name="DO0"><block type="trade_definition_tradeoptions" id="dpr_options"><mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation><field name="DURATIONTYPE_LIST">t</field><value name="DURATION"><block type="variables_get"><field name="VAR" id="dpr_duration">Trade Duration</field></block></value><value name="AMOUNT"><block type="variables_get"><field name="VAR" id="dpr_stake">Stake</field></block></value><value name="PREDICTION"><block type="variables_get"><field name="VAR" id="dpr_prediction">Target Differ</field></block></value></block></statement></block></next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="dpr_after_purchase" collapsed="true" x="900" y="60"><statement name="AFTERPURCHASE_STACK"><block type="digit_pair_return_risk_management" id="dpr_risk_management"></block></statement></block>
  <block type="before_purchase" id="dpr_before_purchase" deletable="false" collapsed="true" x="0" y="900"><statement name="BEFOREPURCHASE_STACK"><block type="purchase" id="dpr_buy"><field name="PURCHASE_LIST">DIGITDIFF</field></block></statement></block>
</xml>`;
