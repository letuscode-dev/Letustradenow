/**
 * Low-High Flip UNDER 8 free bot.
 *
 * On the last four digits: previous_3 < 4, previous_2 < 4, previous_1 > 5 and
 * current > 5 → enter DIGITUNDER. Both thresholds are user-configurable.
 * Multi-market scanner (on by default): checks every market in the Market Group
 * (1S / STANDARD / ALL) or the Custom Symbols list and switches to the market
 * that fires.
 * Risk: Under 8 normally; after a loss, recover with Under 7 until a win resets
 * to Under 8 at Base Stake. The recovery stake is sized so one Under 7 win pays
 * back every unrecovered loss: Recovery Loss ÷ Recovery Profit Rate (rounded up
 * to the cent). The rate starts at 0.36 and is re-measured from each Under 7 win;
 * any shortfall a win leaves is carried into the next recovery.
 * Stop Loss is checked against the next stake, so no trade can take the session
 * past it.
 */

import { wrapCollapsedAdvancedInit } from './collapsed-advanced-init';

const varGet = (id, name) =>
    `<block type="variables_get"><field name="VAR" id="${id}">${name}</field></block>`;

const num = n => `<block type="math_number"><field name="NUM">${n}</field></block>`;

const bool = v =>
    `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;

const text = value => `<block type="text"><field name="TEXT">${value}</field></block>`;

const setVar = (id, name, valueXml, nextXml = '') =>
    `<block type="variables_set" id="lhf_set_${id}">
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

const readDetail = index =>
    `<block type="read_details"><field name="DETAIL_INDEX">${index}</field></block>`;
const PURCHASE_PRICE = readDetail(2);
const PROFIT = readDetail(4);

const arithmetic = (op, aXml, bXml) =>
    `<block type="math_arithmetic"><field name="OP">${op}</field>
      <value name="A">${aXml}</value>
      <value name="B">${bXml}</value>
    </block>`;

const compare = (op, aXml, bXml) =>
    `<block type="logic_compare"><field name="OP">${op}</field>
      <value name="A">${aXml}</value>
      <value name="B">${bXml}</value>
    </block>`;

/** Statement blocks as { open, close } so they can be chained with <next>. */
const assign = (id, name, valueXml) => ({
    open: `<block type="variables_set">
      <field name="VAR" id="${id}">${name}</field>
      <value name="VALUE">${valueXml}</value>`,
    close: '</block>',
});

const ifElse = (conditionXml, thenXml, elseXml = '') => ({
    open: `<block type="controls_if">
      ${elseXml ? '<mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>' : ''}
      <value name="IF0">${conditionXml}</value>
      <statement name="DO0">${thenXml}</statement>
      ${elseXml ? `<statement name="ELSE">${elseXml}</statement>` : ''}`,
    close: '</block>',
});

const chain = (statements, tailXml = '') =>
    statements.reduceRight((next, s) => `${s.open}${next ? `<next>${next}</next>` : ''}${s.close}`, tailXml);

const STAKE = ['lhf_stake', 'Stake'];
const BASE_STAKE = ['lhf_base_stake', 'Base Stake'];
const BARRIER = ['lhf_barrier', 'Barrier'];
const RECOVERY_LOSS = ['lhf_recovery_loss', 'Recovery Loss'];
const RECOVERY_RATE = ['lhf_recovery_rate', 'Recovery Profit Rate'];
const get = ([id, name]) => varGet(id, name);
const set = ([id, name], valueXml) => assign(id, name, valueXml);

/** Stake that makes one Under-7 win repay Recovery Loss: ceil(loss / rate × 100) / 100. */
const recoveryStakeXml = () =>
    arithmetic(
        'DIVIDE',
        `<block type="math_round"><field name="OP">ROUNDUP</field>
          <value name="NUM">${arithmetic(
              'MULTIPLY',
              arithmetic('DIVIDE', get(RECOVERY_LOSS), get(RECOVERY_RATE)),
              num(100)
          )}</value>
        </block>`,
        num(100)
    );

const protectActiveXml = () =>
    `<block type="logic_operation"><field name="OP">AND</field>
      <value name="A">${varGet('lhf_protect', 'Recovery Off When Profit > Stake')}</value>
      <value name="B">${compare('GT', '<block type="total_profit"></block>', get(BASE_STAKE))}</value>
    </block>`;

const endOfTrade = () => [set(['lhf_prediction', 'Prediction'], num(-1)), set(['lhf_signal', 'Entry Signal'], bool(false))];

const entryStakeAndBarrier = () => [
    set(STAKE, get(BASE_STAKE)),
    set(BARRIER, varGet('lhf_entry_barrier', 'Entry Under Barrier')),
];

const backToEntry = () => [set(RECOVERY_LOSS, num(0)), ...entryStakeAndBarrier()];

/** Recovery Loss after a win: whatever the profit did not cover (never below 0). */
const remainingLossXml = () => {
    const remaining = arithmetic('MINUS', get(RECOVERY_LOSS), PROFIT);
    return `<block type="logic_ternary">
      <value name="IF">${compare('GT', remaining, num(0))}</value>
      <value name="THEN">${remaining}</value>
      <value name="ELSE">${num(0)}</value>
    </block>`;
};

const afterPurchaseXml = () => {
    const onWin = chain(
        [
            // Learn the real Under-7 profit rate from Deriv's payout.
            ifElse(
                compare('EQ', get(BARRIER), varGet('lhf_recovery_barrier', 'Recovery Under Barrier')),
                chain([set(RECOVERY_RATE, arithmetic('DIVIDE', PROFIT, PURCHASE_PRICE))])
            ),
            // Any shortfall (e.g. before the real rate was known) carries into the next recovery.
            set(RECOVERY_LOSS, remainingLossXml()),
            ...entryStakeAndBarrier(),
            ...endOfTrade(),
        ],
        tpSlThenTradeAgain('lhf_win_cd', varGet('lhf_cooldown_win', 'Cooldown After Win'))
    );

    const onLoss = chain(
        [
            set(RECOVERY_LOSS, arithmetic('ADD', get(RECOVERY_LOSS), PURCHASE_PRICE)),
            ifElse(
                protectActiveXml(),
                chain(backToEntry()),
                chain([
                    set(STAKE, recoveryStakeXml()),
                    set(BARRIER, varGet('lhf_recovery_barrier', 'Recovery Under Barrier')),
                ])
            ),
            ...endOfTrade(),
        ],
        tpSlThenTradeAgain('lhf_loss_cd', varGet('lhf_cooldown_loss', 'Cooldown After Loss'))
    );

    return `  <block type="after_purchase" id="lhf_after" collapsed="true" x="900" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="lhf_ap_win">
        <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
        <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
        <statement name="DO0">${onWin}</statement>
        <statement name="ELSE">${onLoss}</statement>
      </block>
    </statement>
  </block>`;
};

const tpSlThenTradeAgain = (timeoutId, secondsXml) => `
                  <block type="timeout" id="${timeoutId}">
                    <statement name="TIMEOUTSTACK">
                      <block type="controls_if">
                        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
                        <value name="IF0">
                          <block type="logic_compare"><field name="OP">GTE</field>
                            <value name="A"><block type="total_profit"></block></value>
                            <value name="B">${varGet('lhf_take_profit', 'Take Profit')}</value>
                          </block>
                        </value>
                        <statement name="DO0">
                          <block type="variables_set">
                            <field name="VAR" id="lhf_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <value name="IF1">
                          <block type="logic_compare"><field name="OP">LT</field>
                            <value name="A">${arithmetic('MINUS', '<block type="total_profit"></block>', varGet('lhf_stake', 'Stake'))}</value>
                            <value name="B">
                              <block type="math_single"><field name="OP">NEG</field>
                                <value name="NUM">${varGet('lhf_stop_loss', 'Stop Loss')}</value>
                              </block>
                            </value>
                          </block>
                        </value>
                        <statement name="DO1">
                          <block type="variables_set">
                            <field name="VAR" id="lhf_signal">Entry Signal</field>
                            <value name="VALUE">${bool(false)}</value>
                          </block>
                        </statement>
                        <statement name="ELSE"><block type="trade_again"></block></statement>
                      </block>
                    </statement>
                    <value name="SECONDS">${secondsXml}</value>
                  </block>`;

export const LOW_HIGH_FLIP_UNDER_XML = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="lhf_stake">Stake</variable>
    <variable id="lhf_base_stake">Base Stake</variable>
    <variable id="lhf_recovery_rate">Recovery Profit Rate</variable>
    <variable id="lhf_recovery_loss">Recovery Loss</variable>
    <variable id="lhf_protect">Recovery Off When Profit > Stake</variable>
    <variable id="lhf_take_profit">Take Profit</variable>
    <variable id="lhf_stop_loss">Stop Loss</variable>
    <variable id="lhf_low_below">Low Digits Below</variable>
    <variable id="lhf_high_above">High Digits Above</variable>
    <variable id="lhf_scan_markets">Scan Multiple Markets</variable>
    <variable id="lhf_market_group">Market Group (1S / STANDARD / ALL)</variable>
    <variable id="lhf_symbols">Custom Symbols</variable>
    <variable id="lhf_entry_barrier">Entry Under Barrier</variable>
    <variable id="lhf_recovery_barrier">Recovery Under Barrier</variable>
    <variable id="lhf_barrier">Barrier</variable>
    <variable id="lhf_cooldown_signal">Cooldown After Signal</variable>
    <variable id="lhf_cooldown_loss">Cooldown After Loss</variable>
    <variable id="lhf_cooldown_win">Cooldown After Win</variable>
    <variable id="lhf_signal">Entry Signal</variable>
    <variable id="lhf_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="lhf_trade_def" deletable="false" collapsed="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="lhf_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ50V</field>
        <next>
          <block type="trade_definition_tradetype" id="lhf_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">overunder</field>
            <next>
              <block type="trade_definition_contracttype" id="lhf_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="lhf_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="lhf_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="lhf_restart_err" deletable="false" movable="false">
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
              ['lhf_stake', 'Stake', num(0.5)],
              ['lhf_recovery_rate', 'Recovery Profit Rate', num(0.36)],
              ['lhf_protect', 'Recovery Off When Profit > Stake', bool(false)],
              ['lhf_take_profit', 'Take Profit', num(20)],
              ['lhf_stop_loss', 'Stop Loss', num(50)],
              ['lhf_low_below', 'Low Digits Below', num(4)],
              ['lhf_high_above', 'High Digits Above', num(5)],
              ['lhf_scan_markets', 'Scan Multiple Markets', bool(true)],
              ['lhf_market_group', 'Market Group (1S / STANDARD / ALL)', text('1S')],
              ['lhf_symbols', 'Custom Symbols', text('')],
              ['lhf_entry_barrier', 'Entry Under Barrier', num(8)],
              ['lhf_recovery_barrier', 'Recovery Under Barrier', num(7)],
          ],
          wrapCollapsedAdvancedInit(
              'lhf',
              chainSets([
                  ['lhf_base_stake', 'Base Stake', varGet('lhf_stake', 'Stake')],
                  ['lhf_barrier', 'Barrier', varGet('lhf_entry_barrier', 'Entry Under Barrier')],
                  ['lhf_recovery_loss', 'Recovery Loss', num(0)],
                  ['lhf_cooldown_signal', 'Cooldown After Signal', num(1)],
                  ['lhf_cooldown_loss', 'Cooldown After Loss', num(2)],
                  ['lhf_cooldown_win', 'Cooldown After Win', num(1)],
                  ['lhf_signal', 'Entry Signal', bool(false)],
                  ['lhf_prediction', 'Prediction', num(-1)],
              ])
          )
      )}
    </statement>
    <statement name="SUBMARKET">
      <block type="controls_whileUntil" id="lhf_scan_loop" collapsed="true">
        <field name="MODE">UNTIL</field>
        <value name="BOOL">${varGet('lhf_signal', 'Entry Signal')}</value>
        <statement name="DO">
          <block type="timeout" id="lhf_scan_delay">
            <statement name="TIMEOUTSTACK">
              <block type="variables_set" id="lhf_scan_pred">
                <field name="VAR" id="lhf_prediction">Prediction</field>
                <value name="VALUE">
                  <block type="low_high_flip_under_scan" id="lhf_scan_block">
                    <value name="LOW_BELOW">${varGet('lhf_low_below', 'Low Digits Below')}</value>
                    <value name="HIGH_ABOVE">${varGet('lhf_high_above', 'High Digits Above')}</value>
                    <value name="BARRIER">${varGet('lhf_barrier', 'Barrier')}</value>
                    <value name="COOLDOWN">${varGet('lhf_cooldown_signal', 'Cooldown After Signal')}</value>
                    <value name="JOURNAL">${bool(true)}</value>
                    <value name="SCAN_MARKETS">${varGet('lhf_scan_markets', 'Scan Multiple Markets')}</value>
                    <value name="MARKET_GROUP">${varGet('lhf_market_group', 'Market Group (1S / STANDARD / ALL)')}</value>
                    <value name="SYMBOLS">${varGet('lhf_symbols', 'Custom Symbols')}</value>
                  </block>
                </value>
                <next>
                  <block type="controls_if" id="lhf_if_hit">
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GTE</field>
                        <value name="A">${varGet('lhf_prediction', 'Prediction')}</value>
                        <value name="B">${num(0)}</value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="variables_set">
                        <field name="VAR" id="lhf_signal">Entry Signal</field>
                        <value name="VALUE">${bool(true)}</value>
                      </block>
                    </statement>
                  </block>
                </next>
              </block>
            </statement>
            <value name="SECONDS">${num(0.5)}</value>
          </block>
        </statement>
        <next>
          <block type="trade_definition_tradeoptions" id="lhf_tradeopts">
            <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation>
            <field name="DURATIONTYPE_LIST">t</field>
            <value name="DURATION">${num(1)}</value>
            <value name="AMOUNT">${varGet('lhf_stake', 'Stake')}</value>
            <value name="PREDICTION">${varGet('lhf_prediction', 'Prediction')}</value>
          </block>
        </next>
      </block>
    </statement>
  </block>
${afterPurchaseXml()}
  <block type="before_purchase" id="lhf_before" deletable="false" collapsed="true" x="0" y="1100">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="lhf_buy">
        <field name="PURCHASE_LIST">DIGITUNDER</field>
      </block>
    </statement>
  </block>
</xml>`;
