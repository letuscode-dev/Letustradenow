import { blockHelpers } from './blocks';

const VARIABLES: [string, string][] = [
    ['mirror_stake', 'Stake'],
    ['mirror_losses', 'Maximum Consecutive Losses'],
    ['mirror_target', 'Profit Threshold'],
    ['mirror_markets', 'Markets (ALL or comma-separated symbols)'],
];
const { v, num, text, set, chain } = blockHelpers(VARIABLES, 'mirror_message');
const INIT = chain([
    n => set('mirror_stake', num(5), n),
    n => set('mirror_losses', num(2), n),
    n => set('mirror_target', num(10), n),
    () => set('mirror_markets', text('ALL')),
]);

/** Runtime processes live ticks and manages all confirmed contracts independently. */
export const THREE_DIGIT_MIRROR_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>${VARIABLES.map(([id, label]) => `<variable id="${id}">${label}</variable>`).join('')}</variables>
  <block type="trade_definition" id="mirror_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="mirror_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">1HZ75V</field>
        <next><block type="trade_definition_tradetype" id="mirror_type" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">matchesdiffers</field>
          <next><block type="trade_definition_contracttype" id="mirror_contract" deletable="false" movable="false">
            <field name="TYPE_LIST">DIGITDIFF</field>
            <next><block type="trade_definition_candleinterval" id="mirror_candle" deletable="false" movable="false">
              <field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="mirror_restart" deletable="false" movable="false">
                <field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="mirror_restart_error" deletable="false" movable="false">
                  <field name="RESTARTONERROR">FALSE</field>
                </block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">${INIT}</statement>
    <statement name="SUBMARKET"><block type="trade_definition_tradeoptions" id="mirror_options">
      <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
      <field name="DURATIONTYPE_LIST">t</field><value name="DURATION">${num(1)}</value>
      <value name="AMOUNT">${v('mirror_stake')}</value><value name="PREDICTION">${num(0)}</value>
    </block></statement>
  </block>
  <block type="before_purchase" id="mirror_before" deletable="false" x="0" y="700">
    <statement name="BEFOREPURCHASE_STACK"><block type="mirror_bot_run">
      <value name="STAKE">${v('mirror_stake')}</value><value name="LOSSES">${v('mirror_losses')}</value><value name="TARGET">${v('mirror_target')}</value>
      <value name="MARKETS">${v('mirror_markets')}</value>
    </block></statement>
  </block>
  <block type="after_purchase" id="mirror_after" x="900" y="60"></block>
</xml>`;
