import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships the Over 2, Rise/Fall, and both Over/Under hedge bots', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual([
            'over-two-v1',
            'rise-fall-v1',
            'over-under-hedge-v1',
            'quiet-gap-hedge-v1',
            'only-ups-downs-v1',
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

        it('Volatility 50 (1s) Rise Equals and Fall Equals, both sides, 1 tick', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ50V');
            expect(field('TRADETYPECAT_LIST')).toBe('callput');
            expect(field('TRADETYPE_LIST')).toBe('callputequal');
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
            expect(setValue('rff_taken')).toEqual(['0']);
            expect(setValue('rff_hold')).toEqual(['0']);
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

            const hold = loop?.querySelector(':scope > next > block[type="controls_if"]');
            expect(hold?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'rff_hold'
            );
            expect(hold?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')).toBeNull();
            expect(hold?.querySelector(':scope > statement[name="DO0"] block[type="logic_negate"]')).not.toBeNull();
            const signal = hold?.querySelector(':scope > statement[name="ELSE"] > block[type="controls_if"]');
            const rising = signal?.querySelector(':scope > value[name="IF0"]');
            expect(rising?.querySelector('field[id="rff_up"]')).not.toBeNull();
            expect(
                [...(rising?.querySelectorAll('block[type="logic_compare"]') || [])].map(
                    c => c.querySelector(':scope > value[name="B"] field')?.textContent
                )
            ).toEqual(expect.arrayContaining(['0', '2']));
            expect(signal?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'PUTE'
            );

            const falling = signal?.querySelector(':scope > value[name="IF1"]');
            expect(falling?.querySelector('field[id="rff_down"]')).not.toBeNull();
            expect(
                [...(falling?.querySelectorAll('block[type="logic_compare"]') || [])].map(
                    c => c.querySelector(':scope > value[name="B"] field')?.textContent
                )
            ).toEqual(expect.arrayContaining(['0', '1']));
            expect(signal?.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'CALLE'
            );
        });

        it('buys one trade on a signal, and a later trade of that signal only after a loss', () => {
            const gate = doc.querySelector('statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(gate?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'rff_remaining'
            );
            const follow = gate?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(follow)).toBe('rff_taken');
            expect(follow?.querySelector(':scope > value[name="VALUE"] field[name="OP"]')?.textContent).toBe('ADD');
            const cleared = follow?.querySelector('block[type="variables_set"]');
            expect(varId(cleared)).toBe('rff_remaining');
            expect(cleared?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
            expect(follow?.querySelector('block[type="controls_for"]')).toBeNull();
            const same = follow?.querySelector('block[type="controls_if"]');
            expect(same?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'rff_picked'
            );
            expect(same?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.textContent).toBe('1');
            expect(same?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'CALLE'
            );
            expect(same?.querySelector(':scope > value[name="IF1"] value[name="B"] field')?.textContent).toBe('2');
            expect(same?.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'PUTE'
            );

            const opened = [...(gate?.querySelectorAll('statement[name="ELSE"] block[type="variables_set"]') || [])].find(
                b => varId(b) === 'rff_taken' && b.querySelector(':scope > value[name="VALUE"] field')?.textContent === '1'
            );
            const idle = opened?.querySelector('block[type="variables_set"]');
            expect(varId(idle)).toBe('rff_remaining');
            expect(idle?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
        });

        it('a win clears the signal and returns to the initial stake, and a loss multiplies by 2', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('rff_remaining');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
            const taken = win?.querySelector(':scope > next > block[type="variables_set"]');
            expect(varId(taken)).toBe('rff_taken');
            expect(taken?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
            const hold = taken?.querySelector(':scope > next > block[type="variables_set"]');
            expect(varId(hold)).toBe('rff_hold');
            expect(hold?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('1');
            const stake = hold?.querySelector('block[type="variables_set"]');
            expect(varId(stake)).toBe('rff_current');
            expect(stake?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('rff_stake');

            const loss = result?.querySelector(':scope > statement[name="DO1"] > block');
            expect(varId(loss)).toBe('rff_current');
            expect(loss?.querySelector('[id="rff_hold"]')).toBeNull();
            const again = loss?.querySelector('block[type="controls_if"]');
            expect(again?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'rff_taken'
            );
            expect(again?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.getAttribute('id')).toBe(
                'rff_trades_per_signal'
            );
            expect(varId(again?.querySelector(':scope > statement[name="DO0"] > block'))).toBe('rff_remaining');
            expect(again?.querySelector(':scope > statement[name="DO0"] field[name="NUM"]')?.textContent).toBe('1');
            expect(again?.querySelector(':scope > statement[name="ELSE"] field[name="NUM"]')?.textContent).toBe('0');
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
            expect(setValue('ouh_under')).toEqual(['4']);
            expect(setValue('ouh_stake')).toEqual(['1']);
            expect(setValue('ouh_multiplier')).toEqual(['2']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector('value[name="PREDICTION"] field')?.getAttribute('id')).toBe('ouh_prediction');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('ouh_current');
        });

        it('checks 4 and 5 in memory, and can buy the next hedge immediately after a loss', () => {
            expect(setValue('ouh_window')).toEqual(['5']);
            expect(setValue('ouh_immediate')).toEqual(['1']);
            const before = doc.querySelector('block[type="before_purchase"]');
            expect(before?.querySelector('block[type="lastDigitList"]')).toBeNull();
            expect(before?.querySelector('block[type="controls_for"]')).toBeNull();
            expect(before?.querySelector('block[type="digit_hedge_skip_analysis"]')).not.toBeNull();
            const signal = before?.querySelector('block[type="digit_hedge_signal"]');
            expect(signal?.querySelector(':scope > value[name="WINDOW"] field')?.getAttribute('id')).toBe('ouh_window');
            expect(signal?.querySelector(':scope > value[name="OVER"] field')?.getAttribute('id')).toBe('ouh_prediction');
            expect(signal?.querySelector(':scope > value[name="UNDER"] field')?.getAttribute('id')).toBe('ouh_under');
            const purchases = before?.querySelectorAll('block[type="digit_hedge_purchase"]') || [];
            expect(purchases).toHaveLength(2);
            purchases.forEach(purchase => {
                expect(purchase.querySelector(':scope > value[name="OVER"] field')?.getAttribute('id')).toBe(
                    'ouh_prediction'
                );
                expect(purchase.querySelector(':scope > value[name="UNDER"] field')?.getAttribute('id')).toBe(
                    'ouh_under'
                );
            });
            const recovery = [...(before?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
                block.querySelector(':scope > value[name="IF0"] block[type="digit_hedge_skip_analysis"]')
            );
            expect(recovery?.querySelector(':scope > value[name="IF0"] field[name="NUM"]')?.textContent).toBe('1');
            expect(recovery?.querySelector(':scope > statement[name="DO0"] block[type="digit_hedge_purchase"]')).not.toBeNull();
            expect(recovery?.querySelector(':scope > statement[name="ELSE"] block[type="digit_hedge_purchase"]')).not.toBeNull();
            const after = doc.querySelector('block[type="after_purchase"]');
            const arm = after?.querySelector('block[type="digit_hedge_arm_recovery"]');
            expect(arm?.querySelector(':scope > value[name="ENABLED"] field')?.getAttribute('id')).toBe('ouh_immediate');
            expect(arm?.querySelector(':scope > next block[type="trade_again"]')).not.toBeNull();
        });

        it('books both legs into total profit and does not trade again after take profit', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            expect(after?.querySelector('block[type="digit_hedge_result"]')).not.toBeNull();
            const total = [...(after?.querySelectorAll('block[type="variables_set"]') || [])].find(
                block => varId(block) === 'ouh_total'
            );
            const book = total?.querySelector(':scope > value[name="VALUE"] > block[type="digit_hedge_book_profit"]');
            expect(book?.querySelector(':scope > value[name="TOTAL"] field')?.getAttribute('id')).toBe('ouh_total');
            expect(book?.querySelector(':scope > value[name="PROFIT"] field')?.getAttribute('id')).toBe('ouh_profit');
            expect(book?.querySelector(':scope > value[name="TAKE_PROFIT"] field')?.getAttribute('id')).toBe(
                'ouh_take_profit'
            );
            expect(book?.querySelector(':scope > value[name="STOP_LOSS"] field')?.getAttribute('id')).toBe('ouh_stop_loss');
            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(
                block => block.querySelector(':scope > value[name="IF0"] block[type="digit_hedge_limit"]')
            );
            expect(limits?.querySelector(':scope > value[name="IF0"] field[name="NUM"]')?.textContent).toBe('1');
            expect(limits?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="DO1"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
            const stake = [...(after?.querySelectorAll('block[type="variables_set"]') || [])].find(
                block => varId(block) === 'ouh_current'
            );
            const next = stake?.querySelector(':scope > value[name="VALUE"] > block[type="digit_hedge_next_stake"]');
            expect(next?.querySelector(':scope > value[name="CURRENT"] field')?.getAttribute('id')).toBe('ouh_current');
            expect(next?.querySelector(':scope > value[name="INITIAL"] field')?.getAttribute('id')).toBe('ouh_stake');
            expect(next?.querySelector(':scope > value[name="MULTIPLIER"] field')?.getAttribute('id')).toBe(
                'ouh_multiplier'
            );
            const afterStake = stake?.querySelector(':scope > next');
            expect(afterStake?.querySelector('block[type="digit_hedge_continues"]')).not.toBeNull();
            expect(afterStake?.querySelector('block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Over 5 + Under 4 Quiet Gap', () => {
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

        it('Volatility 75 (1s), Over 5 and Under 4, range 1, immediate recovery on', () => {
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPE_LIST')).toBe('overunder');
            expect(field('TYPE_LIST')).toBe('DIGITOVER');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(setValue('qgh_stake')).toEqual(['1']);
            expect(setValue('qgh_duration')).toEqual(['1']);
            expect(setValue('qgh_range')).toEqual(['1']);
            expect(setValue('qgh_immediate')).toEqual(['1']);
            expect(setValue('qgh_multiplier')).toEqual(['2']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('qgh_current');
            expect(options?.querySelector('value[name="DURATION"] field')?.getAttribute('id')).toBe('qgh_duration');
            expect(options?.querySelector('value[name="PREDICTION"] field[name="NUM"]')?.textContent).toBe('5');
        });

        it('buys only when the range is clear, and can recover without that check', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const signal = before?.querySelector('block[type="digit_hedge_quiet"]');
            expect(signal?.querySelector(':scope > value[name="RANGE"] field')?.getAttribute('id')).toBe('qgh_range');
            const purchases = before?.querySelectorAll('block[type="digit_hedge_purchase"]') || [];
            expect(purchases).toHaveLength(2);
            purchases.forEach(purchase => {
                expect(purchase.querySelector(':scope > value[name="OVER"] field[name="NUM"]')?.textContent).toBe('5');
                expect(purchase.querySelector(':scope > value[name="UNDER"] field[name="NUM"]')?.textContent).toBe('4');
            });
            const recovery = [...(before?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
                block.querySelector(':scope > value[name="IF0"] block[type="digit_hedge_skip_analysis"]')
            );
            expect(recovery?.querySelector(':scope > statement[name="DO0"] block[type="digit_hedge_purchase"]')).not.toBeNull();
            expect(recovery?.querySelector(':scope > statement[name="ELSE"] block[type="digit_hedge_quiet"]')).not.toBeNull();
            expect(recovery?.querySelector(':scope > statement[name="DO0"] block[type="digit_hedge_quiet"]')).toBeNull();
            const after = doc.querySelector('block[type="after_purchase"]');
            const arm = after?.querySelector('block[type="digit_hedge_arm_recovery"]');
            expect(arm?.querySelector(':scope > value[name="ENABLED"] field')?.getAttribute('id')).toBe('qgh_immediate');
            const limits = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
                block.querySelector(':scope > value[name="IF0"] block[type="digit_hedge_limit"]')
            );
            expect(limits?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="DO1"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
            const stake = [...(after?.querySelectorAll('block[type="variables_set"]') || [])].find(
                block => varId(block) === 'qgh_current'
            );
            expect(stake?.querySelector('block[type="digit_hedge_next_stake"]')).not.toBeNull();
            expect(stake?.querySelector(':scope > next block[type="digit_hedge_continues"]')).not.toBeNull();
        });
    });

    describe('Only Ups / Only Downs', () => {
        const doc = parse(FREE_BOTS[4].xml);
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

        it('Volatility 75 (1s) Only Ups and Only Downs, base stake 1, 2 ticks', () => {
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('runs');
            expect(field('TRADETYPE_LIST')).toBe('runs');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(setValue('oud_stake')).toEqual(['1']);
            expect(setValue('oud_duration')).toEqual(['2']);
            expect(setValue('oud_level')).toEqual(['0']);
            expect(setValue('oud_take_profit')).toEqual(['10']);
            expect(setValue('oud_max_losses')).toEqual(['5']);
            expect(setValue('oud_total')).toEqual(['0']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('oud_current');
            expect(options?.querySelector('value[name="DURATION"] field')?.getAttribute('id')).toBe('oud_duration');
        });

        it('buys one direction from one four-digit check, and multiplies a loss by 1.5', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const read = before?.querySelector(':scope statement[name="BEFOREPURCHASE_STACK"] > block');
            expect(varId(read)).toBe('oud_signal');
            const signal = read?.querySelector(':scope > value[name="VALUE"] block[type="only_ups_downs_signal"]');
            expect(signal?.querySelector(':scope > value[name="STAKE"] field')?.getAttribute('id')).toBe('oud_current');
            expect(signal?.querySelector(':scope > value[name="LEVEL"] field')?.getAttribute('id')).toBe('oud_level');
            const gate = read?.querySelector(':scope > next > block[type="controls_if"]');
            expect(gate?.querySelector(':scope > value[name="IF0"] block[type="only_ups_downs_signal"]')).toBeNull();
            expect(gate?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'RUNHIGH'
            );
            expect(gate?.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'RUNLOW'
            );
            expect(gate?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).not.toBe(
                'RUNLOW'
            );
            const after = doc.querySelector('block[type="after_purchase"]');
            const decision = after?.querySelector('block[type="controls_if"]');
            expect(decision?.querySelector(':scope > value[name="IF0"] field[name="CHECK_RESULT"]')?.textContent).toBe(
                'win'
            );
            const win = decision?.querySelector(':scope > statement[name="DO0"]');
            expect(win?.querySelector('block[type="variables_set"] field[name="VAR"]')?.getAttribute('id')).toBe(
                'oud_current'
            );
            expect(win?.querySelector('value[name="VALUE"] field[name="VAR"]')?.getAttribute('id')).toBe('oud_stake');
            expect(win?.querySelector('block[type="only_ups_downs_result"] field[name="NUM"]')?.textContent).toBe('1');
            const loss = decision?.querySelector(':scope > statement[name="ELSE"]');
            const multiply = loss?.querySelector('block[type="math_arithmetic"]');
            expect(multiply?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('MULTIPLY');
            expect(multiply?.querySelector(':scope > value[name="B"] field[name="NUM"]')?.textContent).toBe('1.5');
            expect(loss?.querySelector('block[type="only_ups_downs_result"] field[name="NUM"]')?.textContent).toBe('0');
            const limits = decision?.querySelector(':scope > next > block[type="controls_if"]');
            expect(limits?.querySelector(':scope > value[name="IF0"] block[type="only_ups_downs_limit"]')).not.toBeNull();
            expect(
                limits?.querySelector(':scope > value[name="IF0"] value[name="TAKE_PROFIT"] field')?.getAttribute('id')
            ).toBe('oud_take_profit');
            expect(
                limits?.querySelector(':scope > value[name="IF0"] value[name="MAX_LOSSES"] field')?.getAttribute('id')
            ).toBe('oud_max_losses');
            expect(limits?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="DO1"] block[type="trade_again"]')).toBeNull();
            expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
            expect(decision?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
            expect(decision?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).toBeNull();
        });
    });
});
