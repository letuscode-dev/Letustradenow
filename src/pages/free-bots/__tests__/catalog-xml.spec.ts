import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships only Rise/Fall Switcher', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['rise-fall-switcher-v1']);
    });

    describe('Rise/Fall Switcher', () => {
        const doc = parse(FREE_BOTS[0].xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        it('is well-formed', () => {
            expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
            expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        });

        it('Step Index 100 Rise/Fall, 2 ticks', () => {
            expect(field('SUBMARKET_LIST')).toBe('step_index');
            expect(field('SYMBOL_LIST')).toBe('stpRNG');
            expect(field('TRADETYPE_LIST')).toBe('callput');
            expect(field('TYPE_LIST')).toBe('both');
            expect(field('DURATIONTYPE_LIST')).toBe('t');
            expect(setValue('rfs_duration')).toEqual(['2']);
            const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            expect(options?.querySelector('value[name="AMOUNT"] field')?.getAttribute('id')).toBe('rfs_current');
            expect(options?.querySelector('value[name="DURATION"] field')?.getAttribute('id')).toBe('rfs_duration');
        });

        it('starts on RISE with $2 and martingale 1.25', () => {
            expect(setValue('rfs_side')).toEqual(['RISE']);
            expect(setValue('rfs_stake')).toEqual(['2']);
            expect(setValue('rfs_multiplier')).toEqual(['1.25']);
        });

        it('buys CALL when Side is RISE, otherwise PUT', () => {
            const choice = doc.querySelector('block[type="before_purchase"] > statement > block[type="controls_if"]');
            expect(choice?.querySelector(':scope > value[name="IF0"] block[type="text"] field')?.textContent).toBe('RISE');
            expect(choice?.querySelector(':scope > statement[name="DO0"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'CALL'
            );
            expect(choice?.querySelector(':scope > statement[name="ELSE"] field[name="PURCHASE_LIST"]')?.textContent).toBe(
                'PUT'
            );
        });

        it('win resets the stake; loss multiplies it and switches side', () => {
            const result = [...doc.querySelectorAll('block[type="after_purchase"] block[type="controls_if"]')].find(b =>
                b.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
            );
            const win = result?.querySelector(':scope > statement[name="DO0"] > block');
            expect(win?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id')).toBe('rfs_current');
            expect(win?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('rfs_stake');

            const loss = result?.querySelector(':scope > statement[name="ELSE"] > block');
            expect(loss?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id')).toBe('rfs_current');
            const multiply = [...(loss?.querySelectorAll('block[type="math_arithmetic"]') || [])].find(
                b => b.querySelector(':scope > value[name="B"] > block > field')?.getAttribute('id') === 'rfs_multiplier'
            );
            expect(multiply?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('MULTIPLY');
            expect(multiply?.querySelector(':scope > value[name="A"] > block > field')?.getAttribute('id')).toBe(
                'rfs_current'
            );

            const sides = [...(loss?.querySelectorAll('block[type="variables_set"]') || [])]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === 'rfs_side')
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
            expect(sides).toEqual(['FALL', 'RISE']);
        });

        it('trades again until take profit or stop loss', () => {
            expect(doc.querySelector('block[type="after_purchase"] block[type="trade_again"]')).not.toBeNull();
            expect(setValue('rfs_take_profit')).toEqual(['10']);
            expect(setValue('rfs_stop_loss')).toEqual(['50']);
        });
    });
});
