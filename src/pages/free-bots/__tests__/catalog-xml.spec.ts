import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships Over/Under Entry and Even/Odd Entry', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['over-under-entry-v1', 'even-odd-entry-v1']);
    });

    describe('Over/Under Entry', () => {
        const doc = parse(FREE_BOTS[0].xml);
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
            expect(setValue('oud_stake')).toEqual(['Initial Stake']);
            expect(setValue('oud_entry')).toEqual(['0']);
            expect(setValue('oud_entered')).toEqual(['0']);
            expect(setValue('oud_speed')).toEqual(['1']);
            expect(setValue('oud_payout')).toEqual(['40']);
            const speed = [...doc.querySelectorAll('block[type="set_catch_every_tick"]')];
            expect(speed).toHaveLength(1);
            expect(speed[0]?.querySelector('value[name="ENABLED"] field')?.getAttribute('id')).toBe('oud_speed');
            expect(setValue('oud_take_profit')).toEqual(['10']);
            expect(setValue('oud_stop_loss')).toEqual(['50']);
            expect(setValue('oud_prediction')).toEqual(['Prediction before loss']);
            expect(setValue('oud_lost')).toEqual(['0']);
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

    describe('Even/Odd Entry', () => {
        const doc = parse(FREE_BOTS[1].xml);
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

        it('Volatility 75 (1s) Even/Odd both, 1 tick, martingale 1.5', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('evenodd');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('evo_entry')).toEqual(['0']);
            expect(setValue('evo_entered')).toEqual(['0']);
            expect(setValue('evo_stake')).toEqual(['1']);
            expect(setValue('evo_amount')).toEqual(['Stake']);
            expect(setValue('evo_martingale')).toEqual(['1.5']);
            expect(setValue('evo_take_profit')).toEqual(['10']);
            expect(setValue('evo_stop_loss')).toEqual(['50']);
            expect(setValue('evo_total')).toEqual(['0']);
            const speed = [...doc.querySelectorAll('block[type="set_catch_every_tick"]')];
            expect(speed).toHaveLength(1);
            expect(speed[0]?.querySelector('value[name="ENABLED"] field[name="NUM"]')?.textContent).toBe('1');
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('false');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('evo_amount');
            expect(options?.querySelector('value[name="PREDICTION"]')).toBeNull();
        });

        it('waits for the entry digit once, then buys the contract the user selected', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const gate = before?.querySelector(':scope > statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.getAttribute('type')).toBe('controls_if');
            expect(gate?.querySelector(':scope > mutation')).toBeNull();
            const condition = gate?.querySelector(':scope > value[name="IF0"] > block');
            expect(condition?.getAttribute('type')).toBe('logic_operation');
            expect(condition?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('OR');

            const compares = [...(condition?.querySelectorAll(':scope > value > block[type="logic_compare"]') || [])];
            const alreadyIn = compares.find(
                b => b.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'evo_entered'
            );
            expect(alreadyIn?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('EQ');
            expect(alreadyIn?.querySelector(':scope > value[name="B"] field[name="NUM"]')?.textContent).toBe('1');
            const entry = compares.find(
                b => b.querySelector(':scope > value[name="A"] > block')?.getAttribute('type') === 'last_digit'
            );
            expect(entry?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('EQ');
            expect(entry?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('evo_entry');

            const purchases = [...(before?.querySelectorAll('block[type="purchase"]') || [])];
            expect(purchases).toHaveLength(1);
            expect(purchases[0]?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITEVEN');
            expect(before?.querySelector('block[type="math_modulo"]')).toBeNull();
            const mark = gate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(mark)).toBe('evo_entered');
            expect(mark?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent).toBe('1');
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
                b => b.querySelector(':scope > field[name="OP"]')?.textContent === 'MULTIPLY'
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
});
