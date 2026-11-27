import { FREE_BOTS } from '../catalog';
import { CURRENT_DIGIT_PARITY_DIFFERS_XML } from '../bots/current-digit-parity-differs';
import { DIFFERS_HOT_XML } from '../bots/differs-hot';
import { EVEN_ODD_XML } from '../bots/even-odd';
import { EVEN_ONLY_XML } from '../bots/even-only';
import { OVER_UNDER_FREQUENCY_XML } from '../bots/over-under-frequency';
import { OVER_UNDER_XML } from '../bots/over-under';
import { SIMULTANEOUS_OVER_UNDER_XML } from '../bots/simultaneous-over-under';
import { OVER_UNDER_LOSS_SWITCH_XML } from '../bots/over-under-loss-switch';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('lists the fixed prediction, mirror and both Over/Under bots', () => {
        expect(FREE_BOTS).toHaveLength(4);
        expect(FREE_BOTS.find(bot => bot.id === 'fixed-digit-differs-v1')).toMatchObject({ title: 'Digit Differs — Fixed Prediction' });
        expect(FREE_BOTS.find(bot => bot.id === 'simultaneous-over-under-v1')).toMatchObject({
            id: 'simultaneous-over-under-v1',
            title: 'Simultaneous Over/Under',
            xml: SIMULTANEOUS_OVER_UNDER_XML,
        });
        expect(FREE_BOTS.find(bot => bot.id === 'over-under-loss-switch-v1')).toMatchObject({
            id: 'over-under-loss-switch-v1',
            title: 'Over to Under on Loss',
            xml: OVER_UNDER_LOSS_SWITCH_XML,
        });
        expect(FREE_BOTS.find(bot => bot.id === 'three-digit-mirror-v1')).toMatchObject({ title: 'Three-Digit Mirror Differs' });
    });

    describe('Over/Under Entry', () => {
        const doc = parse(OVER_UNDER_XML);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        const varId = (block: Element | null | undefined) =>
            block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');
        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
                .filter(b => varId(b) === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        it('is well-formed', () => {
            expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        });

        it('Volatility 75 (1s) Over/Under both, 1 tick, payout 40', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('overunder');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('oud_pred_before')).toEqual(['2']);
            expect(setValue('oud_pred_after')).toEqual(['7']);
            expect(setValue('oud_initial')).toEqual(['1']);
            expect(setValue('oud_entry')).toEqual(['0']);
            expect(setValue('oud_speed')).toEqual(['1']);
            expect(setValue('oud_payout')).toEqual(['40']);
            expect(setValue('oud_take_profit')).toEqual(['10']);
            expect(setValue('oud_stop_loss')).toEqual(['50']);
            expect(setValue('oud_stake')).toEqual([]);
            expect(setValue('oud_entered')).toEqual([]);
            expect(setValue('oud_prediction')).toEqual([]);
            expect(setValue('oud_lost')).toEqual([]);
            const reset = doc.querySelector('block[id="oud_reset_fn"]');
            expect(reset?.getAttribute('collapsed')).toBe('true');
            expect(reset?.querySelector(':scope > field[name="NAME"]')?.textContent).toBe('Reset Over Under Entry');
            const hidden = (var_id: string) =>
                [...(reset?.querySelectorAll('statement[name="STACK"] block[type="variables_set"]') || [])]
                    .filter(b => varId(b) === var_id)
                    .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
            expect(hidden('oud_stake')).toEqual(['Initial Stake']);
            expect(hidden('oud_entered')).toEqual(['0']);
            expect(hidden('oud_prediction')).toEqual(['Prediction before loss']);
            expect(hidden('oud_lost')).toEqual(['0']);
            expect(hidden('oud_total')).toEqual(['0']);
            const speed = reset?.querySelector('block[type="set_catch_every_tick"]');
            expect(speed?.querySelector('value[name="ENABLED"] field')?.getAttribute('id')).toBe('oud_speed');
            expect(doc.querySelector('statement[name="INITIALIZATION"] block[type="set_catch_every_tick"]')).toBeNull();
            expect(
                doc.querySelector('statement[name="INITIALIZATION"] block[type="procedures_callnoreturn"] mutation')
                    ?.getAttribute('name')
            ).toBe('Reset Over Under Entry');
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('true');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('oud_stake');
            expect(options?.querySelector(':scope > value[name="PREDICTION"] field')?.getAttribute('id')).toBe(
                'oud_prediction'
            );
        });

        it('uses the entry digit once, then buys Under at 5+ and Over at 4 or lower', () => {
            const gate = doc.querySelector('statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.getAttribute('type')).toBe('controls_if');
            expect(gate?.querySelector(':scope > mutation')?.getAttribute('else')).toBe('1');
            const waiting = gate?.querySelector(':scope > value[name="IF0"] > block');
            expect(waiting?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('EQ');
            expect(waiting?.querySelector(':scope > value[name="A"] field')?.getAttribute('id')).toBe('oud_entered');
            expect(waiting?.querySelector(':scope > value[name="B"] field[name="NUM"]')?.textContent).toBe('0');

            const first = gate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(first?.getAttribute('type')).toBe('controls_if');
            const entry = first?.querySelector(':scope > value[name="IF0"] > block');
            expect(entry?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('EQ');
            expect(entry?.querySelector(':scope > value[name="A"] > block')?.getAttribute('type')).toBe('last_digit');
            expect(entry?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('oud_entry');
            const firstSide = first?.querySelector(':scope > statement[name="DO0"] > block');
            expect(firstSide?.getAttribute('type')).toBe('controls_if');

            const expectSide = (side: Element | null | undefined) => {
                expect(side?.getAttribute('type')).toBe('controls_if');
                expect(side?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('GTE');
                expect(side?.querySelector(':scope > value[name="IF0"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                    '5'
                );
                const under = side?.querySelector(':scope > statement[name="DO0"] > block');
                expect(varId(under)).toBe('oud_entered');
                expect(under?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent).toBe('1');
                expect(under?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITUNDER');
                expect(side?.querySelector(':scope > value[name="IF1"] field[name="OP"]')?.textContent).toBe('LTE');
                expect(side?.querySelector(':scope > value[name="IF1"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                    '4'
                );
                const over = side?.querySelector(':scope > statement[name="DO1"] > block');
                expect(varId(over)).toBe('oud_entered');
                expect(over?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITOVER');
            };

            expectSide(firstSide ?? null);
            const later = gate?.querySelector(':scope > statement[name="ELSE"] > block');
            expectSide(later ?? null);
            expect(later?.querySelector('block[type="last_digit"]')).toBeNull();
        });

        it('a win restores the before-loss prediction and initial stake, a loss recovers at payout percent', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('oud_lost');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
            const winStake = [...(win?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'oud_stake'
            );
            expect(winStake?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'oud_initial'
            );
            const winPrediction = [...(win?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'oud_prediction'
            );
            expect(winPrediction?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'oud_pred_before'
            );

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('oud_lost');
            const absolute = loss?.querySelector('block[type="math_single"]');
            expect(absolute?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('ABS');
            expect(absolute?.querySelector(':scope > value[name="NUM"] field')?.getAttribute('id')).toBe('oud_profit');
            const recovery = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b =>
                    b.querySelector(':scope > field[name="OP"]')?.textContent === 'DIVIDE' &&
                    b.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'oud_lost'
            );
            expect(recovery?.querySelector(':scope > value[name="B"] field[name="OP"]')?.textContent).toBe('DIVIDE');
            expect(recovery?.querySelector(':scope > value[name="B"] value[name="A"] field')?.getAttribute('id')).toBe(
                'oud_payout'
            );
            expect(recovery?.querySelector(':scope > value[name="B"] value[name="B"] field')?.textContent).toBe('100');
            const recoveryTimes = recovery?.parentElement?.parentElement;
            expect(recoveryTimes?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('MULTIPLY');
            expect(
                [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].some(
                    b =>
                        b.querySelector(':scope > field[name="OP"]')?.textContent === 'ADD' &&
                        b.querySelector(':scope > value[name="B"] field')?.getAttribute('id') === 'oud_initial'
                )
            ).toBe(false);
            const recoverySet = [...(loss?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'oud_stake' && b.querySelector(':scope > value block[type="math_round"]')
            );
            expect(recoverySet?.querySelector('block[type="math_round"] > field[name="OP"]')?.textContent).toBe(
                'ROUNDUP'
            );
            const lossPrediction = [...(loss?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'oud_prediction'
            );
            expect(lossPrediction?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'oud_pred_after'
            );
            expect(
                [...(after?.querySelectorAll('block[type="variables_set"]') || [])].some(b => varId(b) === 'oud_entered')
            ).toBe(false);
            const payoutGuard = [...(loss?.querySelectorAll('block[type="controls_if"]') || [])].find(
                b =>
                    b.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent === 'LTE' &&
                    b.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id') ===
                        'oud_payout'
            );
            expect(
                payoutGuard?.querySelector(':scope > statement[name="DO0"] value[name="VALUE"] field')?.getAttribute(
                    'id'
                )
            ).toBe('oud_initial');
            const floor = [...(loss?.querySelectorAll('block[type="controls_if"]') || [])].find(
                b =>
                    b.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent === 'LT' &&
                    b.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id') ===
                        'oud_stake'
            );
            expect(
                floor?.querySelector(':scope > statement[name="DO0"] value[name="VALUE"] field')?.getAttribute('id')
            ).toBe('oud_initial');

            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')
            );
            expect(limits?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('GTE');
            expect(limits?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'oud_total'
            );
            expect(limits?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.getAttribute('id')).toBe(
                'oud_take_profit'
            );
            expect(limits?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="DO1"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > value[name="IF1"] > block > field[name="OP"]')?.textContent).toBe(
                'LTE'
            );
            expect(
                limits?.querySelector(':scope > value[name="IF1"] block[type="math_single"] > field[name="OP"]')
                    ?.textContent
            ).toBe('NEG');
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Even/Odd Frequency', () => {
        const doc = parse(EVEN_ODD_XML);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        const varId = (block: Element | null | undefined) =>
            block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');
        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
                .filter(b => varId(b) === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        it('is well-formed', () => {
            expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        });

        it('Volatility 75 (1s) Even/Odd both, 1 tick, 1000 ticks, 5 runs, martingale 1.5', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('evenodd');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('evo_ticks')).toEqual(['1000']);
            expect(setValue('evo_runs')).toEqual(['5']);
            expect(setValue('evo_stake')).toEqual(['1']);
            expect(setValue('evo_martingale')).toEqual(['1.5']);
            expect(setValue('evo_take_profit')).toEqual(['10']);
            expect(setValue('evo_stop_loss')).toEqual(['50']);
            expect(setValue('evo_left')).toEqual([]);
            expect(setValue('evo_dominant')).toEqual([]);
            expect(setValue('evo_entry')).toEqual([]);
            expect(setValue('evo_entered')).toEqual([]);
            expect(setValue('evo_side')).toEqual([]);
            expect(setValue('evo_amount')).toEqual([]);
            expect(setValue('evo_total')).toEqual([]);
            const reset = doc.querySelector('block[id="evo_reset_fn"]');
            expect(reset?.getAttribute('collapsed')).toBe('true');
            expect(reset?.querySelector(':scope > field[name="NAME"]')?.textContent).toBe('Reset Even Odd');
            const hidden = (var_id: string) =>
                [...(reset?.querySelectorAll('statement[name="STACK"] block[type="variables_set"]') || [])]
                    .filter(b => varId(b) === var_id)
                    .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
            expect(hidden('evo_left')).toEqual(['0']);
            expect(hidden('evo_dominant')).toEqual(['-1']);
            expect(hidden('evo_entry')).toEqual(['-1']);
            expect(hidden('evo_entered')).toEqual(['0']);
            expect(hidden('evo_side')).toEqual(['-1']);
            expect(hidden('evo_amount')).toEqual(['Stake']);
            expect(hidden('evo_total')).toEqual(['0']);
            expect(reset?.querySelector('block[type="set_catch_every_tick"] value[name="ENABLED"] field[name="NUM"]')?.textContent).toBe(
                '1'
            );
            expect(doc.querySelector('statement[name="INITIALIZATION"] block[type="set_catch_every_tick"]')).toBeNull();
            expect(
                doc.querySelector('statement[name="INITIALIZATION"] block[type="procedures_callnoreturn"] mutation')
                    ?.getAttribute('name')
            ).toBe('Reset Even Odd');
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('false');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('evo_amount');
            expect(options?.querySelector('value[name="PREDICTION"]')).toBeNull();
        });

        it('scans when the signal is spent, then waits once for the entry digit', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const scanGate = before?.querySelector(':scope > statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(scanGate?.getAttribute('type')).toBe('controls_if');
            expect(scanGate?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('LTE');
            expect(scanGate?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'evo_left'
            );
            const scan = scanGate?.querySelector('block[type="even_odd_parity_scan"]');
            expect(scan?.querySelector('value[name="N"] field')?.getAttribute('id')).toBe('evo_ticks');
            const assignments = [...(scanGate?.querySelectorAll('block[type="variables_set"]') || [])];
            const assigned = (id: string) => assignments.find(b => varId(b) === id);
            expect(assigned('evo_dominant')?.querySelector('block[type="even_odd_parity_dominant"]')).not.toBeNull();
            expect(assigned('evo_entry')?.querySelector('block[type="even_odd_parity_entry"]')).not.toBeNull();
            expect(assigned('evo_side')?.querySelector('block[type="even_odd_parity_side"]')).not.toBeNull();
            expect(assigned('evo_entered')?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent).toBe(
                '0'
            );
            expect(assigned('evo_left')?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'evo_runs'
            );

            const tradeGate = scanGate?.querySelector(':scope > next > block');
            expect(tradeGate?.getAttribute('type')).toBe('controls_if');
            expect(tradeGate?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('GT');
            const waiting = tradeGate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(waiting?.querySelector(':scope > mutation')?.getAttribute('else')).toBe('1');
            expect(waiting?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'evo_entered'
            );
            const entry = waiting?.querySelector(':scope > statement[name="DO0"] block[type="logic_compare"]');
            expect(entry?.querySelector(':scope > value[name="A"] > block')?.getAttribute('type')).toBe('last_digit');
            expect(entry?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('evo_entry');
            const mark = waiting?.querySelector(':scope > statement[name="DO0"] block[type="variables_set"]');
            expect(varId(mark)).toBe('evo_entered');
            expect(mark?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent).toBe('1');

            const purchases = [...(before?.querySelectorAll('block[type="purchase"]') || [])];
            const contract = (block: Element) => block.querySelector('field[name="PURCHASE_LIST"]')?.textContent;
            expect(purchases.filter(b => contract(b) === 'DIGITODD')).toHaveLength(2);
            expect(purchases.filter(b => contract(b) === 'DIGITEVEN')).toHaveLength(2);
            const sides = [...(before?.querySelectorAll('block[type="controls_if"]') || [])].filter(
                b =>
                    b.querySelector(':scope > statement[name="DO0"] block[type="purchase"]') &&
                    b.querySelector(':scope > statement[name="DO1"] block[type="purchase"]')
            );
            expect(sides).toHaveLength(2);
            sides.forEach(side => {
                expect(side.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                    'evo_side'
                );
                expect(side.querySelector(':scope > value[name="IF0"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                    '1'
                );
                expect(side.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                    'DIGITODD'
                );
                expect(side.querySelector(':scope > value[name="IF1"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                    '0'
                );
                expect(side.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                    'DIGITEVEN'
                );
            });
            expect(before?.querySelector('block[type="math_modulo"]')).toBeNull();
        });

        it('a win returns to the stake and a loss multiplies the amount by the martingale', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('evo_amount');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('evo_stake');

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('evo_amount');
            expect(loss?.querySelector(':scope > value block[type="math_round"] > field[name="OP"]')?.textContent).toBe(
                'ROUND'
            );
            const multiply = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b =>
                    b.querySelector(':scope > field[name="OP"]')?.textContent === 'MULTIPLY' &&
                    b.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'evo_amount'
            );
            expect(multiply?.querySelector(':scope > value[name="A"] field')?.getAttribute('id')).toBe('evo_amount');
            expect(multiply?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('evo_martingale');
            const guard = [...(loss?.querySelectorAll('block[type="controls_if"]') || [])].find(
                b => b.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent === 'LTE'
            );
            expect(guard?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'evo_martingale'
            );
            expect(guard?.querySelector(':scope > statement[name="DO0"] value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'evo_stake'
            );
            expect(
                [...(after?.querySelectorAll('block[type="variables_set"]') || [])].some(b => varId(b) === 'evo_entered')
            ).toBe(false);
            const spent = [...(after?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'evo_left'
            );
            expect(spent?.querySelector('block[type="math_arithmetic"] > field[name="OP"]')?.textContent).toBe('MINUS');
            expect(spent?.querySelector('value[name="A"] field')?.getAttribute('id')).toBe('evo_left');

            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')
            );
            expect(limits?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'evo_total'
            );
            expect(limits?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.getAttribute('id')).toBe(
                'evo_take_profit'
            );
            expect(limits?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="DO1"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > value[name="IF1"] block[type="math_single"] > field[name="OP"]')?.textContent).toBe(
                'NEG'
            );
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Over/Under Frequency', () => {
        const doc = parse(OVER_UNDER_FREQUENCY_XML);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        const varId = (block: Element | null | undefined) =>
            block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');
        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
                .filter(b => varId(b) === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        const numbersIn = (root: Element | null | undefined) =>
            [
                ...(root?.querySelectorAll(
                    'block[type="variables_set"] > value[name="VALUE"] > block[type="math_number"] > field[name="NUM"]'
                ) || []),
            ].map(field => field.textContent);

        it('is well-formed', () => {
            expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        });

        it('Volatility 75 (1s) Over/Under both, 1 tick, 1000 ticks, 5 runs, payout 60', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('overunder');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('ouf_ticks')).toEqual(['1000']);
            expect(setValue('ouf_runs')).toEqual(['5']);
            expect(setValue('ouf_initial')).toEqual(['1']);
            expect(setValue('ouf_payout')).toEqual(['60']);
            expect(setValue('ouf_take_profit')).toEqual(['10']);
            expect(setValue('ouf_stop_loss')).toEqual(['50']);
            expect(setValue('ouf_left')).toEqual([]);
            expect(setValue('ouf_entry')).toEqual([]);
            expect(setValue('ouf_entered')).toEqual([]);
            expect(setValue('ouf_pred_before')).toEqual([]);
            expect(setValue('ouf_pred_after')).toEqual([]);
            expect(setValue('ouf_prediction')).toEqual([]);
            expect(setValue('ouf_stake')).toEqual([]);
            expect(setValue('ouf_lost')).toEqual([]);
            const reset = doc.querySelector('block[id="ouf_reset_fn"]');
            expect(reset?.getAttribute('collapsed')).toBe('true');
            expect(reset?.querySelector(':scope > field[name="NAME"]')?.textContent).toBe('Reset Over Under Frequency');
            const hidden = (var_id: string) =>
                [...(reset?.querySelectorAll('statement[name="STACK"] block[type="variables_set"]') || [])]
                    .filter(b => varId(b) === var_id)
                    .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
            expect(hidden('ouf_left')).toEqual(['0']);
            expect(hidden('ouf_entry')).toEqual(['-1']);
            expect(hidden('ouf_entered')).toEqual(['0']);
            expect(hidden('ouf_pred_before')).toEqual(['2']);
            expect(hidden('ouf_pred_after')).toEqual(['3']);
            expect(hidden('ouf_prediction')).toEqual(['Prediction before loss']);
            expect(hidden('ouf_stake')).toEqual(['Initial Stake']);
            expect(hidden('ouf_lost')).toEqual(['0']);
            expect(hidden('ouf_total')).toEqual(['0']);
            expect(reset?.querySelector('block[type="set_catch_every_tick"] value[name="ENABLED"] field[name="NUM"]')?.textContent).toBe(
                '1'
            );
            expect(doc.querySelector('statement[name="INITIALIZATION"] block[type="set_catch_every_tick"]')).toBeNull();
            expect(
                doc.querySelector('statement[name="INITIALIZATION"] block[type="procedures_callnoreturn"] mutation')
                    ?.getAttribute('name')
            ).toBe('Reset Over Under Frequency');
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('true');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('ouf_stake');
            expect(options?.querySelector(':scope > value[name="PREDICTION"] field')?.getAttribute('id')).toBe(
                'ouf_prediction'
            );
        });

        it('scans when the signal is spent, then Over 2 or Under 7 from the hottest digit', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const scanGate = before?.querySelector(':scope > statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(scanGate?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('LTE');
            expect(scanGate?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'ouf_left'
            );
            const scan = scanGate?.querySelector('block[type="over_under_frequency_scan"]');
            expect(scan?.querySelector('value[name="N"] field')?.getAttribute('id')).toBe('ouf_ticks');
            const assignments = [...(scanGate?.querySelectorAll('block[type="variables_set"]') || [])];
            const assigned = (id: string) => assignments.find(b => varId(b) === id);
            expect(assigned('ouf_dominant')?.querySelector('block[type="over_under_frequency_dominant"]')).not.toBeNull();
            expect(assigned('ouf_entry')?.querySelector('block[type="over_under_frequency_entry"]')).not.toBeNull();
            expect(assigned('ouf_entered')?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent).toBe(
                '0'
            );
            expect(assigned('ouf_left')?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'ouf_runs'
            );

            const evenBranch = [...(scanGate?.querySelectorAll('block[type="controls_if"]') || [])].find(b => {
                const modulo = b.querySelector(':scope > value[name="IF0"] block[type="math_modulo"]');
                return modulo?.querySelector('value[name="DIVIDEND"] field')?.getAttribute('id') === 'ouf_dominant';
            });
            expect(evenBranch?.querySelector(':scope > mutation')?.getAttribute('else')).toBe('1');
            const evenSets = evenBranch?.querySelector(':scope > statement[name="DO0"]');
            const oddSets = evenBranch?.querySelector(':scope > statement[name="ELSE"]');
            expect(numbersIn(evenSets)).toEqual(['2', '3']);
            expect(numbersIn(oddSets)).toEqual(['7', '6']);
            expect(evenSets?.querySelector('block[type="variables_set"] field[id="ouf_prediction"]')).not.toBeNull();
            expect(scanGate?.querySelector('block[type="refresh_trade_options"]')).not.toBeNull();

            const tradeGate = scanGate?.querySelector(':scope > next > block');
            expect(tradeGate?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('GT');
            const waiting = tradeGate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(waiting?.querySelector(':scope > mutation')?.getAttribute('else')).toBe('1');
            const entry = waiting?.querySelector(':scope > statement[name="DO0"] block[type="logic_compare"]');
            expect(entry?.querySelector(':scope > value[name="A"] > block')?.getAttribute('type')).toBe('last_digit');
            expect(entry?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('ouf_entry');

            const sides = [...(before?.querySelectorAll('block[type="controls_if"]') || [])].filter(
                b =>
                    b.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent === 'GTE' &&
                    b.querySelector(':scope > value[name="IF0"] value[name="B"] field[name="NUM"]')?.textContent === '5'
            );
            expect(sides).toHaveLength(2);
            sides.forEach(side => {
                expect(side.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                    'DIGITUNDER'
                );
                expect(side.querySelector(':scope > value[name="IF1"] field[name="OP"]')?.textContent).toBe('LTE');
                expect(side.querySelector(':scope > value[name="IF1"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                    '4'
                );
                expect(side.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                    'DIGITOVER'
                );
            });
        });

        it('a win restores the before-loss barrier and a loss recovers at 60 percent', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('ouf_lost');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
            const winStake = [...(win?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ouf_stake'
            );
            expect(winStake?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ouf_initial');
            const winPrediction = [...(win?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ouf_prediction'
            );
            expect(winPrediction?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'ouf_pred_before'
            );

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('ouf_lost');
            const recovery = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b =>
                    b.querySelector(':scope > field[name="OP"]')?.textContent === 'DIVIDE' &&
                    b.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'ouf_lost'
            );
            expect(recovery?.querySelector(':scope > value[name="B"] value[name="A"] field')?.getAttribute('id')).toBe(
                'ouf_payout'
            );
            expect(recovery?.querySelector(':scope > value[name="B"] value[name="B"] field')?.textContent).toBe('100');
            expect(
                [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].some(
                    b =>
                        b.querySelector(':scope > field[name="OP"]')?.textContent === 'ADD' &&
                        b.querySelector(':scope > value[name="B"] field')?.getAttribute('id') === 'ouf_initial'
                )
            ).toBe(false);
            const recoverySet = [...(loss?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ouf_stake' && b.querySelector(':scope > value block[type="math_round"]')
            );
            expect(recoverySet?.querySelector('block[type="math_round"] > field[name="OP"]')?.textContent).toBe(
                'ROUNDUP'
            );
            const lossPrediction = [...(loss?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ouf_prediction'
            );
            expect(lossPrediction?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'ouf_pred_after'
            );
            expect(
                [...(after?.querySelectorAll('block[type="variables_set"]') || [])].some(b => varId(b) === 'ouf_entered')
            ).toBe(false);
            const spent = [...(after?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ouf_left'
            );
            expect(spent?.querySelector('block[type="math_arithmetic"] > field[name="OP"]')?.textContent).toBe('MINUS');

            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')
            );
            expect(limits?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.getAttribute('id')).toBe(
                'ouf_take_profit'
            );
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Odd Only', () => {
        const doc = parse(EVEN_ONLY_XML);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        const varId = (block: Element | null | undefined) =>
            block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');
        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
                .filter(b => varId(b) === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        it('is well-formed', () => {
            expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        });

        it('Volatility 75 (1s) Odd only, 1 tick, candle interval 2 hours, martingale 2, every Deriv tick', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('evenodd');
            expect(field('TYPE_LIST')).toBe('DIGITODD');
            expect(field('CANDLEINTERVAL_LIST')).toBe('7200');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('eve_stake')).toEqual(['1']);
            expect(setValue('eve_martingale')).toEqual(['2']);
            expect(setValue('eve_take_profit')).toEqual(['10']);
            expect(setValue('eve_stop_loss')).toEqual(['50']);
            expect(setValue('eve_amount')).toEqual([]);
            expect(setValue('eve_total')).toEqual([]);
            const reset = doc.querySelector('block[id="eve_reset_fn"]');
            expect(reset?.getAttribute('collapsed')).toBe('true');
            expect(reset?.querySelector(':scope > field[name="NAME"]')?.textContent).toBe('Reset Odd Only');
            const hidden = (var_id: string) =>
                [...(reset?.querySelectorAll('statement[name="STACK"] block[type="variables_set"]') || [])]
                    .filter(b => varId(b) === var_id)
                    .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
            expect(hidden('eve_amount')).toEqual(['Stake']);
            expect(hidden('eve_total')).toEqual(['0']);
            expect(reset?.querySelector('block[type="set_catch_every_tick"] value[name="ENABLED"] field[name="NUM"]')?.textContent).toBe(
                '1'
            );
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('false');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('eve_amount');
        });

        it('buys Odd when the last 2 digits are odd, from those two ticks only', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const gate = before?.querySelector(':scope > statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.getAttribute('type')).toBe('controls_if');
            expect(before?.querySelector('block[type="last_digits_odd_even_condition"]')).toBeNull();
            const tail = gate?.querySelector('block[type="tail_digits_all_odd"]');
            expect(tail?.querySelector(':scope > field[name="TICK_COUNT"]')?.textContent).toBe('2');
            expect(gate?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('EQ');
            expect(gate?.querySelector(':scope > value[name="IF0"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                '1'
            );
            const purchases = [...(before?.querySelectorAll('block[type="purchase"]') || [])];
            expect(purchases).toHaveLength(1);
            expect(purchases[0]?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITODD');
            expect(before?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).not.toBe('DIGITEVEN');
            expect(gate?.querySelector(':scope > statement[name="DO0"] > block')?.getAttribute('type')).toBe('purchase');
        });

        it('a win returns to the stake and a loss multiplies the amount by 2', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('eve_amount');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('eve_stake');
            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('eve_amount');
            const multiply = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b =>
                    b.querySelector(':scope > field[name="OP"]')?.textContent === 'MULTIPLY' &&
                    b.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'eve_amount'
            );
            expect(multiply?.querySelector(':scope > value[name="A"] field')?.getAttribute('id')).toBe('eve_amount');
            expect(multiply?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('eve_martingale');
            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')
            );
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Hot Digit Differs', () => {
        const doc = parse(DIFFERS_HOT_XML);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        const varId = (block: Element | null | undefined) =>
            block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');
        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
                .filter(b => varId(b) === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        it('is well-formed', () => {
            expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        });

        it('Volatility 75 (1s) Differs, 1000 ticks, absent 2, payout 9.6, one recovery run', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
            expect(field('TYPE_LIST')).toBe('DIGITDIFF');
            expect(field('CANDLEINTERVAL_LIST')).toBe('60');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('dif_ticks')).toEqual(['1000']);
            expect(setValue('dif_absent')).toEqual(['2']);
            expect(setValue('dif_stake')).toEqual(['1']);
            expect(setValue('dif_payout')).toEqual(['9.6']);
            expect(setValue('dif_runs')).toEqual(['1']);
            expect(setValue('dif_take_profit')).toEqual(['10']);
            expect(setValue('dif_stop_loss')).toEqual(['50']);
            expect(setValue('dif_amount')).toEqual([]);
            expect(setValue('dif_lost')).toEqual([]);
            expect(setValue('dif_splits')).toEqual([]);
            expect(setValue('dif_prediction')).toEqual([]);
            expect(setValue('dif_total')).toEqual([]);
            const reset = doc.querySelector('block[id="dif_reset_fn"]');
            expect(reset?.getAttribute('collapsed')).toBe('true');
            expect(reset?.querySelector(':scope > field[name="NAME"]')?.textContent).toBe('Reset Hot Digit Differs');
            const hidden = (var_id: string) =>
                [...(reset?.querySelectorAll('statement[name="STACK"] block[type="variables_set"]') || [])]
                    .filter(b => varId(b) === var_id)
                    .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
            expect(hidden('dif_amount')).toEqual(['Stake']);
            expect(hidden('dif_lost')).toEqual(['0']);
            expect(hidden('dif_splits')).toEqual(['0']);
            expect(hidden('dif_total')).toEqual(['0']);
            expect(reset?.querySelector('block[type="set_catch_every_tick"] value[name="ENABLED"] field[name="NUM"]')?.textContent).toBe(
                '1'
            );
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('true');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('dif_amount');
            expect(options?.querySelector(':scope > value[name="PREDICTION"] field')?.getAttribute('id')).toBe(
                'dif_prediction'
            );
        });

        it('buys Differs on the hot digit when that digit missed the newest ticks', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const gate = before?.querySelector(':scope > statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.getAttribute('type')).toBe('controls_if');
            const scan = gate?.querySelector('block[type="differs_hot_scan"]');
            expect(scan?.querySelector('value[name="N"] field')?.getAttribute('id')).toBe('dif_ticks');
            expect(scan?.querySelector('value[name="GAP"] field')?.getAttribute('id')).toBe('dif_absent');
            expect(gate?.querySelector('block[type="differs_hot_digit"]')).not.toBeNull();
            expect(gate?.querySelector('block[type="refresh_trade_options"]')).toBeNull();
            expect(gate?.querySelector(':scope > statement[name="DO0"] block[type="purchase"]')).not.toBeNull();
            const purchases = [...(before?.querySelectorAll('block[type="purchase"]') || [])];
            expect(purchases).toHaveLength(1);
            expect(purchases[0]?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITDIFF');
            expect(before?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).not.toBe('DIGITMATCH');
        });

        it('a loss recovers the lost amount across the configured runs', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('dif_lost');
            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('dif_lost');
            const roundUp = [...(loss?.querySelectorAll('block[type="math_round"]') || [])].find(
                b => b.querySelector(':scope > field[name="OP"]')?.textContent === 'ROUNDUP'
            );
            expect(roundUp).toBeTruthy();
            expect(loss?.querySelector('field[id="dif_runs"]')).not.toBeNull();
            expect(loss?.querySelector('field[id="dif_payout"]')).not.toBeNull();
            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')
            );
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Current Digit Differs', () => {
        const doc = parse(CURRENT_DIGIT_PARITY_DIFFERS_XML);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        const varId = (block: Element | null | undefined) =>
            block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');
        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
                .filter(b => varId(b) === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        it('is well-formed and uses a one-tick Digit Differs contract', () => {
            expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
            expect(field('TYPE_LIST')).toBe('DIGITDIFF');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');

            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('true');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('pdd_amount');
            expect(options?.querySelector(':scope > value[name="PREDICTION"] field')?.getAttribute('id')).toBe(
                'pdd_prediction'
            );
        });

        it('exposes the requested defaults and catches the current tick', () => {
            expect(setValue('pdd_stake')).toEqual(['1']);
            expect(setValue('pdd_target')).toEqual(['EVEN']);
            expect(setValue('pdd_martingale')).toEqual(['10.5']);
            expect(setValue('pdd_take_profit')).toEqual(['10']);
            expect(setValue('pdd_loss_limit')).toEqual(['2']);

            const reset = doc.querySelector('block[id="pdd_reset_fn"]');
            expect(reset?.querySelector('block[type="set_catch_every_tick"] value[name="ENABLED"] field[name="NUM"]')?.textContent).toBe(
                '1'
            );
            expect(doc.querySelector('statement[name="INITIALIZATION"] block[type="set_catch_every_tick"]')).toBeNull();
            expect(reset?.querySelector('block[type="variables_set"] field[id="pdd_amount"]')).not.toBeNull();
            expect(reset?.querySelector('block[type="variables_set"] field[id="pdd_losses"]')).not.toBeNull();
        });

        it('uses a parity dropdown and sends Differs only for a matching current digit', () => {
            const target = [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')].find(
                block => varId(block) === 'pdd_target'
            );
            expect(target?.querySelector('block[type="digit_parity_target"] field[name="PARITY"]')?.textContent).toBe('EVEN');

            const before = doc.querySelector('block[type="before_purchase"]');
            const setPrediction = before?.querySelector(':scope > statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(varId(setPrediction)).toBe('pdd_prediction');
            expect(setPrediction?.querySelector('block[type="current_digit_for_parity"] value[name="TARGET"] field')?.getAttribute('id')).toBe(
                'pdd_target'
            );
            expect(setPrediction?.querySelector('block[type="last_digit"]')).toBeNull();
            expect(setPrediction?.querySelector('block[type="refresh_trade_options"]')).toBeNull();

            const gate = setPrediction?.querySelector(':scope > next > block');
            expect(gate?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('GTE');
            expect(gate?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'pdd_prediction'
            );
            expect(gate?.querySelector(':scope > value[name="IF0"] value[name="B"] field[name="NUM"]')?.textContent).toBe('0');
            expect(gate?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITDIFF');
        });

        it('resets after a win and stops after the configured consecutive-loss count', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
                block.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('pdd_losses');
            expect(win?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent).toBe('0');
            expect(win?.querySelector('block[type="variables_set"] field[id="pdd_amount"]')).not.toBeNull();

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('pdd_losses');
            const martingale = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                block =>
                    block.querySelector(':scope > field[name="OP"]')?.textContent === 'MULTIPLY' &&
                    block.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'pdd_amount'
            );
            expect(martingale?.querySelector(':scope > value[name="A"] field')?.getAttribute('id')).toBe('pdd_amount');
            expect(martingale?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('pdd_martingale');

            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
                block.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')
            );
            expect(limits?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.getAttribute('id')).toBe(
                'pdd_take_profit'
            );
            expect(limits?.querySelector(':scope > value[name="IF1"] block[type="logic_operation"]')).not.toBeNull();
            expect(limits?.querySelector(':scope > value[name="IF1"] field[id="pdd_loss_limit"]')).not.toBeNull();
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
        });
    });
});
