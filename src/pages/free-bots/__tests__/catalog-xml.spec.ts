import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships Rise/Fall Tick Trend and Over 2 Digit Filter', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['rise-fall-trend-v1', 'over-two-v1']);
    });

    describe('Over 2 Digit Filter', () => {
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

        it('Volatility 75 (1s) Digit Over 2, 1 tick', () => {
            expect(field('SUBMARKET_LIST')).toBe('random_index');
            expect(field('SYMBOL_LIST')).toBe('1HZ75V');
            expect(field('TRADETYPECAT_LIST')).toBe('digits');
            expect(field('TRADETYPE_LIST')).toBe('overunder');
            expect(field('TYPE_LIST')).toBe('DIGITOVER');
            expect(setValue('ovr_duration')).toEqual(['1']);
            expect(setValue('ovr_prediction')).toEqual(['2']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector(':scope > mutation')?.getAttribute('has_prediction')).toBe('true');
            expect(options?.querySelector('value[name="PREDICTION"] field')?.getAttribute('id')).toBe('ovr_prediction');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('ovr_current');
        });

        it('Digits to Check defaults to 4, Trades per Signal to 1, martingale 2.5', () => {
            expect(setValue('ovr_digits_to_check')).toEqual(['4']);
            expect(setValue('ovr_trades_per_signal')).toEqual(['1']);
            expect(setValue('ovr_multiplier')).toEqual(['2.5']);
            expect(setValue('ovr_loss_streak')).toEqual(['0']);
            const base = [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')].find(
                b => varId(b) === 'ovr_multiplier_base'
            );
            expect(base?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ovr_multiplier');
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

        it('win restores stake and multiplier, two losses add 0.05, trades until limits', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('ovr_loss_streak');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
            const restore = [...(win?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ovr_multiplier'
            );
            expect(restore?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe(
                'ovr_multiplier_base'
            );
            const stake = [...(win?.querySelectorAll('block[type="variables_set"]') || [])].find(
                b => varId(b) === 'ovr_current'
            );
            expect(stake?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ovr_stake');

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('ovr_loss_streak');
            const bump = loss?.querySelector(':scope > next > block[type="controls_if"]');
            expect(bump?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('EQ');
            expect(bump?.querySelector(':scope > value[name="IF0"] value[name="A"] field')?.getAttribute('id')).toBe(
                'ovr_loss_streak'
            );
            expect(bump?.querySelector(':scope > value[name="IF0"] value[name="B"] field')?.textContent).toBe('2');
            const added = [...(bump?.querySelectorAll(':scope > statement[name="DO0"] block[type="math_arithmetic"]') || [])].find(
                b => b.querySelector(':scope > field[name="OP"]')?.textContent === 'ADD'
            );
            expect(added?.querySelector(':scope > value[name="A"] field')?.getAttribute('id')).toBe('ovr_multiplier');
            expect(added?.querySelector(':scope > value[name="B"] field')?.textContent).toBe('0.05');
            const multiply = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b => b.querySelector(':scope > value[name="B"] > block > field')?.getAttribute('id') === 'ovr_multiplier'
            );
            expect(multiply?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('MULTIPLY');
            expect(after?.querySelector('block[type="trade_again"]')).not.toBeNull();
        });
    });

    describe('Rise/Fall Tick Trend', () => {
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
            expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        });

        it('Step Index 500 Rise/Fall, 2 ticks', () => {
            expect(field('SUBMARKET_LIST')).toBe('step_index');
            expect(field('SYMBOL_LIST')).toBe('stpRNG5');
            expect(field('TRADETYPE_LIST')).toBe('callput');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(setValue('rfs_duration')).toEqual(['2']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('rfs_current');
        });

        it('$2 stake and martingale 1.25', () => {
            expect(setValue('rfs_stake')).toEqual(['2']);
            expect(setValue('rfs_multiplier')).toEqual(['1.25']);
        });

        it('Consecutive Ticks defaults to 3', () => {
            expect(setValue('rfs_consecutive')).toEqual(['3']);
        });

        it('counts up/down moves over the last Consecutive Ticks ticks', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const loop = before?.querySelector('block[type="controls_for"]');
            expect(loop?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id')).toBe('rfs_i');
            expect(loop?.querySelector(':scope > value[name="FROM"] field')?.textContent).toBe('1');
            expect(loop?.querySelector(':scope > value[name="TO"] field')?.getAttribute('id')).toBe('rfs_consecutive');

            const reads = [...(loop?.querySelectorAll('block[type="variables_set"]') || [])]
                .filter(b => b.querySelector(':scope > value[name="VALUE"] > block[type="lists_getIndex"]'))
                .map(b => [
                    varId(b),
                    b.querySelector('field[name="WHERE"]')?.textContent,
                    b.querySelector('value[name="VALUE"] > block > value[name="VALUE"] field')?.getAttribute('id'),
                ]);
            expect(reads).toEqual([
                ['rfs_newer', 'FROM_END', 'rfs_ticks'],
                ['rfs_older', 'FROM_END', 'rfs_ticks'],
            ]);

            const counter = loop?.querySelector('block[type="controls_if"]');
            expect(varId(counter?.querySelector(':scope > statement[name="DO0"] > block'))).toBe('rfs_up');
            expect(varId(counter?.querySelector(':scope > statement[name="DO1"] > block'))).toBe('rfs_down');
        });

        it('all moves up buy CALL, all moves down buy PUT, otherwise no purchase', () => {
            const choice = doc.querySelector('block[type="before_purchase"] block[type="controls_for"] > next > block');
            expect(choice?.getAttribute('type')).toBe('controls_if');
            expect(choice?.querySelector(':scope > mutation')?.getAttribute('else')).toBeNull();
            const condition = (input: string) =>
                [...(choice?.querySelectorAll(`:scope > value[name="${input}"] block[type="logic_compare"]`) || [])].map(
                    c => c.querySelector(':scope > value[name="A"] field')?.getAttribute('id')
                );
            expect(condition('IF0')).toEqual(['rfs_consecutive', 'rfs_up']);
            expect(condition('IF1')).toEqual(['rfs_consecutive', 'rfs_down']);
            expect(choice?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'CALL'
            );
            expect(choice?.querySelector(':scope > statement[name="DO1"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'PUT'
            );
        });

        it('win resets the stake, loss multiplies it; no side switching', () => {
            const after = doc.querySelector('block[type="after_purchase"]');
            const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(varId(win)).toBe('rfs_current');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('rfs_stake');

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(varId(loss)).toBe('rfs_current');
            const multiply = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b => b.querySelector(':scope > value[name="B"] > block > field')?.getAttribute('id') === 'rfs_multiplier'
            );
            expect(multiply?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('MULTIPLY');

            const side_changes = [...(after?.querySelectorAll('block[type="variables_set"]') || [])].filter(
                b => varId(b) === 'rfs_side'
            );
            expect(side_changes).toHaveLength(0);
        });

        it('trades again until take profit or stop loss', () => {
            expect(doc.querySelector('block[type="after_purchase"] block[type="trade_again"]')).not.toBeNull();
            expect(setValue('rfs_take_profit')).toEqual(['10']);
            expect(setValue('rfs_stop_loss')).toEqual(['50']);
        });
    });
});
