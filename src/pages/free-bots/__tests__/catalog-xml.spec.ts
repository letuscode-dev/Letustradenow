import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it('ships only Rise/Fall Two-Tick Trend', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['rise-fall-trend-v1']);
    });

    describe('Rise/Fall Two-Tick Trend', () => {
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

        it('reads the last three ticks from the end of the tick list', () => {
            const before = doc.querySelector('block[type="before_purchase"]');
            const reads = [...(before?.querySelectorAll('block[type="variables_set"]') || [])]
                .filter(b => b.querySelector(':scope > value[name="VALUE"] > block[type="lists_getIndex"]'))
                .map(b => [
                    varId(b),
                    b.querySelector('field[name="WHERE"]')?.textContent,
                    b.querySelector('block[type="ticks"]') ? 'ticks' : null,
                    b.querySelector('value[name="AT"] field')?.textContent,
                ]);
            expect(reads).toEqual([
                ['rfs_t1', 'FROM_END', 'ticks', '1'],
                ['rfs_t2', 'FROM_END', 'ticks', '2'],
                ['rfs_t3', 'FROM_END', 'ticks', '3'],
            ]);
        });

        it('two up ticks buy CALL, two down ticks buy PUT, otherwise no purchase', () => {
            const choice = doc.querySelector('block[type="before_purchase"] block[type="controls_if"]');
            expect(choice?.querySelector(':scope > mutation')?.getAttribute('else')).toBeNull();
            const condition = (input: string) =>
                [...(choice?.querySelectorAll(`:scope > value[name="${input}"] block[type="logic_compare"]`) || [])].map(c => [
                    c.querySelector(':scope > value[name="A"] field')?.getAttribute('id'),
                    c.querySelector(':scope > field[name="OP"]')?.textContent,
                    c.querySelector(':scope > value[name="B"] field')?.getAttribute('id'),
                ]);
            expect(condition('IF0')).toEqual([
                ['rfs_t3', 'LT', 'rfs_t2'],
                ['rfs_t2', 'LT', 'rfs_t1'],
            ]);
            expect(condition('IF1')).toEqual([
                ['rfs_t3', 'GT', 'rfs_t2'],
                ['rfs_t2', 'GT', 'rfs_t1'],
            ]);
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
