import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships Over/Under Entry, Even/Odd Frequency, and Over/Under Frequency', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual([
            'over-under-entry-v1',
            'even-odd-entry-v1',
            'over-under-frequency-v1',
        ]);
        expect(FREE_BOTS[1].title).toBe('Even/Odd Frequency');
        expect(FREE_BOTS[2].title).toBe('Over/Under Frequency');
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
        const doc = parse(FREE_BOTS[2].xml);
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
});
