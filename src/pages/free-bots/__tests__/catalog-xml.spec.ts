import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships the Over 2, Rise/Fall, and Over/Under hedge bots', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['over-two-v1', 'rise-fall-v1', 'over-under-hedge-v1']);
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

    describe('Rise/Fall Consecutive Ticks', () => {
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

        it('Volatility 50 (1s) Rise/Fall, both sides, 1 tick', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ50V');
            expect(field('TRADETYPECAT_LIST')).toBe('callput');
            expect(field('TRADETYPE_LIST')).toBe('callput');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(setValue('rff_duration')).toEqual(['1']);
            expect(setValue('rff_stake')).toEqual(['1']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('false');
            expect(options?.querySelector('value[name="DURATION"] field')?.getAttribute('id')).toBe('rff_duration');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('rff_current');
        });

        it('defaults to both sides, 3 consecutive ticks, 3 trades per signal, multiplier 2', () => {
            expect(setValue('rff_mode')).toEqual(['0']);
            expect(setValue('rff_consecutive')).toEqual(['3']);
            expect(setValue('rff_trades_per_signal')).toEqual(['3']);
            expect(setValue('rff_multiplier')).toEqual(['2']);
            expect(setValue('rff_remaining')).toEqual(['0']);
            expect(setValue('rff_take_profit')).toEqual(['10']);
            expect(setValue('rff_stop_loss')).toEqual(['50']);
        });

        it('fades the streak: rising ticks buy Fall, falling ticks buy Rise, and only the chosen side', () => {
            const gate = doc.querySelector('statement[name="BEFOREPURCHASE_STACK"] > block');
            const analyse = gate?.querySelector(':scope > statement[name="ELSE"]');
            expect(analyse?.querySelector('block[type="ticks"]')).not.toBeNull();
            const loop = analyse?.querySelector('block[type="controls_for"]');
            expect(loop?.querySelector(':scope > value[name="TO"] field')?.getAttribute('id')).toBe('rff_consecutive');
            const directions = [...(loop?.querySelectorAll(':scope > statement[name="DO"] block[type="logic_compare"]') || [])];
            expect(directions.map(c => c.querySelector(':scope > field[name="OP"]')?.textContent)).toEqual(['LT', 'GT']);

            const signal = loop?.querySelector(':scope > next > block[type="controls_if"]');
            const rising = signal?.querySelector(':scope > value[name="IF0"]');
            expect(rising?.querySelector('field[id="rff_up"]')).not.toBeNull();
            expect(
                [...(rising?.querySelectorAll('block[type="logic_compare"]') || [])].map(
                    c => c.querySelector(':scope > value[name="B"] field')?.textContent
                )
            ).toEqual(expect.arrayContaining(['0', '2']));
            expect(signal?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'PUT'
            );

            const falling = signal?.querySelector(':scope > value[name="IF1"]');
            expect(falling?.querySelector('field[id="rff_down"]')).not.toBeNull();
            expect(
                [...(falling?.querySelectorAll('block[type="logic_compare"]') || [])].map(
                    c => c.querySelector(':scope > value[name="B"] field')?.textContent
                )
            ).toEqual(expect.arrayContaining(['0', '1']));
            expect(signal?.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'CALL'
            );
        });

        it('takes the remaining trades of the same side before analysing again', () => {
            const gate = doc.querySelector('statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'rff_remaining'
            );
            const follow = gate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(follow)).toBe('rff_remaining');
            expect(follow?.querySelector('block[type="controls_for"]')).toBeNull();
            const same = follow?.querySelector('block[type="controls_if"]');
            expect(same?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'rff_picked'
            );
            expect(same?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.textContent).toBe('1');
            expect(same?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'CALL'
            );
            expect(same?.querySelector(':scope > value[name="IF1"] value[name="B"] field')?.textContent).toBe('2');
            expect(same?.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'PUT'
            );

            const queued = [...(gate?.querySelectorAll('statement[name="ELSE"] block[type="variables_set"]') || [])].find(
                b => varId(b) === 'rff_remaining'
            );
            expect(queued?.querySelector(':scope > value[name="VALUE"] field[name="OP"]')?.textContent).toBe('MINUS');
            expect(
                queued?.querySelector(':scope > value[name="VALUE"] value[name="A"] field')?.getAttribute('id')
            ).toBe('rff_trades_per_signal');
        });

        it('a win returns to the initial stake and a loss multiplies by 2, then trades again', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('rff_current');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('rff_stake');

            const loss = result?.querySelector(':scope > statement[name="DO1"] > block');
            expect(varId(loss)).toBe('rff_current');
            expect(result?.querySelector(':scope > value[name="IF1"] field[id="rff_profit"]')).not.toBeNull();
            const scaled = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b =>
                    b.querySelector(':scope > field[name="OP"]')?.textContent === 'MULTIPLY' &&
                    b.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'rff_current' &&
                    b.querySelector(':scope > value[name="B"] field')?.getAttribute('id') === 'rff_multiplier'
            );
            expect(scaled).toBeTruthy();
            expect(after?.querySelector('block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Over 5 / Under 4 Hedge', () => {
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

        it('Volatility 75 (1s) Over 5, 1 tick, stake from the current stake', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPE_LIST')).toBe('overunder');
            expect(field('TYPE_LIST')).toBe('DIGITOVER');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(setValue('ouh_duration')).toEqual(['1']);
            expect(setValue('ouh_prediction')).toEqual(['5']);
            expect(setValue('ouh_stake')).toEqual(['1']);
            expect(setValue('ouh_multiplier')).toEqual(['2']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector('value[name="PREDICTION"] field')?.getAttribute('id')).toBe('ouh_prediction');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('ouh_current');
        });

        it('hedges when 4 and 5 dominate the last 5 ticks', () => {
            expect(setValue('ouh_window')).toEqual(['5']);
            const before = doc.querySelector('block[type="before_purchase"]');
            expect(before?.querySelector('block[type="lastDigitList"]')).not.toBeNull();
            expect(before?.querySelector('block[type="lists_length"]')).not.toBeNull();
            const loop = before?.querySelector('block[type="controls_for"]');
            expect(loop?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id')).toBe('ouh_i');
            expect(loop?.querySelector(':scope > value[name="TO"] field')?.getAttribute('id')).toBe('ouh_window');
            expect(loop?.querySelector('field[id="ouh_dead"]')).not.toBeNull();
            const barriers = [...(loop?.querySelectorAll('block[type="logic_compare"]') || [])]
                .filter(block => block.querySelector(':scope > field[name="OP"]')?.textContent === 'EQ')
                .map(block => block.querySelector(':scope > value[name="B"] field')?.textContent);
            expect(barriers).toEqual(expect.arrayContaining(['4', '5']));
            const signal = [...(before?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
                block.querySelector(':scope > statement[name="DO0"] block[type="digit_hedge_purchase"]')
            );
            const dominates = [...(signal?.querySelectorAll(':scope > value[name="IF0"] block[type="logic_compare"]') || [])].find(
                block =>
                    block.querySelector(':scope > field[name="OP"]')?.textContent === 'GT' &&
                    block.querySelector(':scope > value[name="A"] field')?.getAttribute('id') === 'ouh_dead'
            );
            expect(dominates).toBeTruthy();
            expect(dominates?.querySelector('block[type="math_arithmetic"] field[name="OP"]')?.textContent).toBe('MINUS');
        });

        it('sets the next stake from the bought stake and trades again only when that stake is valid', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            expect(after?.querySelector('block[type="digit_hedge_result"]')).not.toBeNull();
            const stake = [...(after?.querySelectorAll('block[type="variables_set"]') || [])].find(
                block => varId(block) === 'ouh_current'
            );
            const next = stake?.querySelector(':scope > value[name="VALUE"] > block[type="digit_hedge_next_stake"]');
            expect(next?.querySelector(':scope > value[name="CURRENT"] field')?.getAttribute('id')).toBe('ouh_current');
            expect(next?.querySelector(':scope > value[name="INITIAL"] field')?.getAttribute('id')).toBe('ouh_stake');
            expect(next?.querySelector(':scope > value[name="MULTIPLIER"] field')?.getAttribute('id')).toBe(
                'ouh_multiplier'
            );
            const gate = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
                block.querySelector(':scope > value[name="IF0"] > block[type="digit_hedge_continues"]')
            );
            expect(gate?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).not.toBeNull();
            expect(gate?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).toBeNull();
            expect(gate?.querySelector(':scope > statement[name="DO0"] block[type="digit_hedge_decision"]')).not.toBeNull();
        });
    });
});
