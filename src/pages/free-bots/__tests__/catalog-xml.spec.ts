import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships Over 2, Jump 10 Differs, Seconds Differs, and Over/Under Entry', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual([
            'over-two-v1',
            'jump-differs-v1',
            'middle-gap-differs-v1',
            'over-under-entry-v1',
        ]);
    });

    describe('Over 2 Digit Filter', () => {
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

        it('Volatility 75 (1s) Digit Over 2, 2 ticks', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('overunder');
            expect(field('TYPE_LIST')).toBe('DIGITOVER');
            expect(setValue('ovr_duration')).toEqual(['2']);
            expect(setValue('ovr_prediction')).toEqual(['2']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('true');
            expect(options?.querySelector('value[name="PREDICTION"] field')?.getAttribute('id')).toBe('ovr_prediction');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('ovr_current');
        });

        it('Digits to Check defaults to 4 and Trades per Signal to 1', () => {
            expect(setValue('ovr_digits_to_check')).toEqual(['4']);
            expect(setValue('ovr_trades_per_signal')).toEqual(['1']);
            expect(setValue('ovr_payout')).toEqual(['40']);
            expect(setValue('ovr_lost')).toEqual(['0']);
            expect(doc.querySelector('variable[id="ovr_multiplier"]')).toBeNull();
            expect(doc.querySelector('variable[id="ovr_multiplier_base"]')).toBeNull();
            expect(doc.querySelector('variable[id="ovr_loss_streak"]')).toBeNull();
        });

        it('buys DIGITOVER only when every checked last digit is over the prediction', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            expect(before?.querySelector('block[type="lastDigitList"]')).not.toBeNull();
            const loop = before?.querySelector('block[type="controls_for"]');
            expect(loop?.querySelector(':scope > value[name="TO"] field')?.getAttribute('id')).toBe('ovr_digits_to_check');
            const check = loop?.querySelector('block[type="logic_compare"]');
            expect(check?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('GT');
            expect(check?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('ovr_prediction');

            const buy = loop?.querySelector(':scope > next > block[type="controls_if"]');
            const conditions = [...(buy?.querySelectorAll(':scope > value[name="IF0"] block[type="logic_compare"]') || [])];
            expect(conditions.map(c => c.querySelector(':scope > value[name="A"] field')?.getAttribute('id'))).toEqual([
                'ovr_digits_to_check',
                'ovr_over',
            ]);
            expect(buy?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITOVER');
        });

        it('buys the remaining Trades per Signal before analysing again', () => {
            expect(setValue('ovr_trades_per_signal')).toEqual(['1']);
            expect(setValue('ovr_remaining')).toEqual(['0']);
            const gate = doc.querySelector('statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.getAttribute('type')).toBe('controls_if');
            expect(gate?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'ovr_remaining'
            );
            const series = gate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(series)).toBe('ovr_remaining');
            expect(series?.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITOVER');
            expect(series?.querySelector('block[type="controls_for"]')).toBeNull();
            expect(gate?.querySelector(':scope > statement[name="ELSE"] block[type="controls_for"]')).not.toBeNull();

            const signal = [...(gate?.querySelectorAll('statement[name="ELSE"] block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ovr_remaining'
            );
            expect(signal?.querySelector(':scope > value[name="VALUE"] field[name="OP"]')?.textContent).toBe('MINUS');
            expect(
                signal?.querySelector(':scope > value[name="VALUE"] value[name="A"] field')?.getAttribute('id')
            ).toBe('ovr_trades_per_signal');
        });

        it('a win returns to the set stake, a loss recovers at payout percent only, then trades again', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('ovr_lost');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
            const stake = [...(win?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ovr_current'
            );
            expect(stake?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ovr_stake');
            expect(after?.textContent).not.toContain('0.05');
            expect(after?.querySelector('field[id="ovr_multiplier"]')).toBeNull();

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('ovr_lost');
            const absolute = loss?.querySelector('block[type="math_single"]');
            expect(absolute?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('ABS');
            expect(absolute?.querySelector(':scope > value[name="NUM"] field')?.getAttribute('id')).toBe('ovr_profit');
            const recovery = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b =>
                    b.querySelector(':scope > field[name="OP"]')?.textContent === 'DIVIDE' &&
                    b.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'ovr_lost'
            );
            expect(recovery?.querySelector(':scope > value[name="B"] field[name="OP"]')?.textContent).toBe('DIVIDE');
            expect(recovery?.querySelector(':scope > value[name="B"] value[name="A"] field')?.getAttribute('id')).toBe(
                'ovr_payout'
            );
            expect(recovery?.querySelector(':scope > value[name="B"] value[name="B"] field')?.textContent).toBe('100');
            const recovery_set = [...(loss?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ovr_current' && b.querySelector(':scope > value block[type="math_round"]')
            );
            expect(recovery_set?.querySelector('block[type="math_round"] > field[name="OP"]')?.textContent).toBe(
                'ROUNDUP'
            );
            const payout_guard = [...(loss?.querySelectorAll('block[type="controls_if"]') || [])].find(
                b =>
                    b.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent === 'LTE' &&
                    b.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id') ===
                        'ovr_payout'
            );
            expect(
                payout_guard?.querySelector(':scope > statement[name="DO0"] value[name="VALUE"] field')?.getAttribute(
                    'id'
                )
            ).toBe('ovr_stake');
            const floor = [...(loss?.querySelectorAll('block[type="controls_if"]') || [])].find(
                b =>
                    b.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent === 'LT' &&
                    b.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id') ===
                        'ovr_current'
            );
            expect(
                floor?.querySelector(':scope > statement[name="DO0"] value[name="VALUE"] field')?.getAttribute('id')
            ).toBe('ovr_stake');
            expect(after?.querySelector('block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Jump 10 Differs', () => {
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

        it('Jump 10 Differs, stake 2, martingale 10.5, 1 tick', () => {
            expect(field('MARKET_LIST')).toBe('synthetic_index');
            expect(field('SUBMARKET_LIST')).toBe('jump_index');
            expect(field('SYMBOL_LIST')).toBe('JD10');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
            expect(field('TYPE_LIST')).toBe('DIGITDIFF');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('jdf_stake')).toEqual(['2']);
            expect(setValue('jdf_martingale')).toEqual(['10.5']);
            expect(setValue('jdf_amount')).toEqual(['Stake']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('true');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('jdf_amount');
        });

        it('differs from the last digit plus 1, or minus 1 when that would reach 9', () => {
            const prediction = doc.querySelector('value[name="PREDICTION"] > block');
            expect(prediction?.getAttribute('type')).toBe('logic_ternary');
            const condition = prediction?.querySelector(':scope > value[name="IF"] > block');
            expect(condition?.getAttribute('type')).toBe('logic_compare');
            expect(condition?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('LT');
            expect(condition?.querySelector(':scope > value[name="A"] > block > field[name="OP"]')?.textContent).toBe(
                'ADD'
            );
            expect(condition?.querySelector(':scope > value[name="B"] field[name="NUM"]')?.textContent).toBe('9');
            expect(prediction?.querySelector(':scope > value[name="THEN"] > block > field[name="OP"]')?.textContent).toBe(
                'ADD'
            );
            expect(prediction?.querySelector(':scope > value[name="ELSE"] > block > field[name="OP"]')?.textContent).toBe(
                'MINUS'
            );
            expect(prediction?.querySelectorAll('block[type="last_digit"]')).toHaveLength(3);
            const before = doc.querySelector('statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(before?.getAttribute('type')).toBe('purchase');
            expect(before?.querySelector(':scope > field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITDIFF');
            expect(before?.querySelector('block[type="controls_if"]')).toBeNull();
        });

        it('a win returns to the stake, a loss uses the stake times 10.5, then trades again', () => {
            const after = doc.querySelector('statement[name="AFTERPURCHASE_STACK"] > block');
            expect(after?.getAttribute('type')).toBe('controls_if');
            expect(after?.querySelector(':scope > value[name="IF0"] field[name="CHECK_RESULT"]')?.textContent).toBe(
                'win'
            );
            const win = after?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('jdf_amount');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('jdf_stake');
            const loss = after?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('jdf_amount');
            const multiply = loss?.querySelector(':scope > value[name="VALUE"] > block');
            expect(multiply?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('MULTIPLY');
            expect(multiply?.querySelector(':scope > value[name="A"] field')?.getAttribute('id')).toBe('jdf_stake');
            expect(multiply?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('jdf_martingale');
            expect(after?.querySelector(':scope > next > block')?.getAttribute('type')).toBe('trade_again');
            expect(after?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(after?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).toBeNull();
        });
    });

    describe('Seconds Differs', () => {
        const doc = parse(FREE_BOTS[2].xml);
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

        it('Volatility 75 (1s), payout 9.6%, one recovery run, 1 tick', () => {
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
            expect(field('TYPE_LIST')).toBe('DIGITDIFF');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(field('TIME_MACHINE_ENABLED')).toBe('FALSE');
            expect(field('RESTARTONERROR')).toBe('TRUE');
            expect(setValue('mgd_stake')).toEqual(['2']);
            expect(setValue('mgd_payout')).toEqual(['9.6']);
            expect(setValue('mgd_runs')).toEqual(['1']);
            expect(setValue('mgd_take_profit')).toEqual(['5']);
            expect(setValue('mgd_max_losses')).toEqual(['5']);
            expect(setValue('mgd_total')).toEqual(['0']);
            expect(setValue('mgd_losses')).toEqual(['0']);
            expect(doc.querySelector('variable[id="mgd_martingale"]')).toBeNull();
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
            expect(options?.querySelector(':scope > value[name="AMOUNT"] > block')?.getAttribute('type')).toBe(
                'recovery_stake'
            );
            const setup = doc.querySelector('statement[name="INITIALIZATION"] block[type="recovery_configure"]');
            expect(setup?.querySelector(':scope > value[name="STAKE"] field')?.getAttribute('id')).toBe('mgd_stake');
            expect(setup?.querySelector(':scope > value[name="PAYOUT"] field')?.getAttribute('id')).toBe('mgd_payout');
            expect(setup?.querySelector(':scope > value[name="SPLITS"] field')?.getAttribute('id')).toBe('mgd_runs');
        });

        it('buys Differs on the current seconds digit', () => {
            const gate = doc.querySelector('statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.getAttribute('type')).toBe('controls_if');
            expect(gate?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('EQ');
            expect(gate?.querySelector('block[type="middle_gap_differ"]')).not.toBeNull();
            expect(gate?.querySelector(':scope > value[name="IF0"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                '1'
            );
            const purchase = gate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(purchase?.getAttribute('type')).toBe('purchase');
            expect(purchase?.querySelector(':scope > field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITDIFF');
            expect(gate?.querySelector(':scope > statement[name="ELSE"]')).toBeNull();
        });

        it('recovers from the result, then stops at take profit or consecutive losses', () => {
            const profit = doc.querySelector('statement[name="AFTERPURCHASE_STACK"] > block');
            expect(varId(profit)).toBe('mgd_profit');
            expect(profit?.querySelector(':scope > value[name="VALUE"] field[name="DETAIL_INDEX"]')?.textContent).toBe(
                '4'
            );
            const total = profit?.querySelector(':scope > next > block');
            expect(varId(total)).toBe('mgd_total');
            const setup = total?.querySelector(':scope > next > block');
            expect(setup?.getAttribute('type')).toBe('recovery_configure');
            expect(setup?.querySelector(':scope > value[name="PAYOUT"] field')?.getAttribute('id')).toBe('mgd_payout');
            expect(setup?.querySelector(':scope > value[name="SPLITS"] field')?.getAttribute('id')).toBe('mgd_runs');
            const apply = setup?.querySelector(':scope > next > block');
            expect(apply?.getAttribute('type')).toBe('recovery_apply_result');
            expect(apply?.querySelector(':scope > value[name="PROFIT"] field')?.getAttribute('id')).toBe('mgd_profit');
            const streak = apply?.querySelector(':scope > next > block');
            expect(streak?.getAttribute('type')).toBe('controls_if');
            expect(streak?.querySelector(':scope > statement[name="DO0"] field')?.getAttribute('id')).toBe('mgd_losses');
            expect(streak?.querySelector(':scope > statement[name="DO0"] field[name="NUM"]')?.textContent).toBe('0');
            expect(streak?.querySelector(':scope > statement[name="ELSE"] field[name="OP"]')?.textContent).toBe('ADD');
            const limits = streak?.querySelector(':scope > next > block');
            expect(limits?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('AND');
            expect(limits?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="DO1"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
            expect(
                limits?.querySelector(':scope > value[name="IF1"] > block > value[name="A"] field')?.getAttribute('id')
            ).toBe('mgd_losses');
            expect(
                limits?.querySelector(
                    ':scope > value[name="IF1"] > block > value[name="B"] > block > value[name="THEN"] field[name="NUM"]'
                )?.textContent
            ).toBe('5');
        });
    });

    describe('Over/Under Entry', () => {
        const doc = parse(FREE_BOTS[3].xml);
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
            expect(setValue('oud_payout')).toEqual(['40']);
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
            const consume = first?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(consume)).toBe('oud_entered');
            expect(consume?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent).toBe('1');

            const expectSide = (side: Element | null | undefined) => {
                expect(side?.getAttribute('type')).toBe('controls_if');
                expect(side?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('GTE');
                expect(side?.querySelector(':scope > value[name="IF0"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                    '5'
                );
                expect(side?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                    'DIGITUNDER'
                );
                expect(side?.querySelector(':scope > value[name="IF1"] field[name="OP"]')?.textContent).toBe('LTE');
                expect(side?.querySelector(':scope > value[name="IF1"] value[name="B"] field[name="NUM"]')?.textContent).toBe(
                    '4'
                );
                expect(side?.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                    'DIGITOVER'
                );
            };

            expectSide(consume?.querySelector(':scope > next > block') ?? null);
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
            const recoveryPlusStake = recovery?.parentElement?.parentElement;
            expect(recoveryPlusStake?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('ADD');
            expect(recoveryPlusStake?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe(
                'oud_initial'
            );
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
});
