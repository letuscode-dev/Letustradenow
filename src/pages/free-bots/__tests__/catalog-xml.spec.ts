import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml as string);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(doc.querySelector('block[type="purchase"]')).not.toBeNull();
    });

    it('Zero/One Rise OVER 1: Over 1 entry, Over 2 recovery sized to repay the losses', () => {
        const bot = FREE_BOTS.find(b => b.id === 'zero-one-rise-over-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('overunder');
        expect(field('PURCHASE_LIST')).toBe('DIGITOVER');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        expect(setValue('zor_targets')).toEqual(['0']);
        expect(setValue('zor_recovery_rate')[0]).toBe('0.36');
        expect(setValue('zor_entry_barrier')).toEqual(['1']);
        expect(setValue('zor_recovery_barrier')).toEqual(['2']);
        // Barrier: init + win (entry) + loss-protected (entry) + loss (recovery).
        expect(setValue('zor_barrier')).toEqual([
            'Entry Over Barrier',
            'Entry Over Barrier',
            'Entry Over Barrier',
            'Recovery Over Barrier',
        ]);

        const loss_branch = doc.querySelector('block#zor_ap_win > statement[name="ELSE"]');
        const loss_xml = loss_branch?.innerHTML ?? '';
        expect(loss_xml).toContain('Recovery Loss');
        expect(loss_xml).toContain('ROUNDUP');
        expect(loss_xml).toContain('Recovery Profit Rate');
        // Stop Loss guards the next stake: total_profit - Stake < -Stop Loss → stop.
        const stop_checks = [...doc.querySelectorAll('block[type="timeout"] value[name="IF1"]')];
        expect(stop_checks).toHaveLength(2);
        stop_checks.forEach(check => {
            expect(check.querySelector('field[name="OP"]')?.textContent).toBe('LT');
            expect(check.querySelector('block[type="math_arithmetic"] field[name="OP"]')?.textContent).toBe('MINUS');
            expect(check.innerHTML).toContain('Stake');
            expect(check.innerHTML).toContain('Stop Loss');
        });

        const win_branch = doc.querySelector('block#zor_ap_win > statement[name="DO0"]');
        expect(win_branch?.querySelectorAll('block[type="read_details"]').length).toBe(2);

        const scan = doc.querySelector('block[type="zero_one_rise_over_scan"]');
        expect(scan?.querySelector('value[name="BARRIER"] field')?.textContent).toBe('Barrier');
        expect(scan?.querySelector('value[name="TARGET_DIGITS"] field')?.textContent).toBe('Target Digits');
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
    });
});
