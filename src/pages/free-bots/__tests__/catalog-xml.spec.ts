import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml as string);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(doc.querySelector('block[type="purchase"]')).not.toBeNull();
    });

    it('Digit Rise DIFFER: Differs risk management with target digits and 120-tick window', () => {
        const bot = FREE_BOTS.find(b => b.id === 'digit-rise-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('PURCHASE_LIST')).toBe('DIGITDIFF');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('drd_targets')).toEqual(['0']);
        expect(setValue('drd_window')).toEqual(['120']);
        expect(setValue('drd_lookback')).toEqual(['1']);
        expect(setValue('drd_stake')[0]).toBe('0.5');
        expect(setValue('drd_martingale')).toEqual(['10.5']);
        expect(setValue('drd_take_profit')).toEqual(['20']);
        expect(setValue('drd_stop_loss')).toEqual(['50']);
        expect(setValue('drd_cooldown_loss')).toEqual(['2']);

        const scan = doc.querySelector('block[type="digit_rise_differ_scan"]');
        expect(scan?.querySelector('value[name="TARGET_DIGITS"] field')?.textContent).toBe('Target Digits');
        expect(scan?.querySelector('value[name="COMPARE_LOOKBACK"] field')?.textContent).toBe(
            'Compare Lookback Ticks'
        );
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
    });

    it('Tie Digit DIFFER: Differs risk management with a configurable 120-tick window', () => {
        const bot = FREE_BOTS.find(b => b.id === 'tie-digit-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('PURCHASE_LIST')).toBe('DIGITDIFF');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('tdd_window')).toEqual(['120']);
        expect(setValue('tdd_stake')[0]).toBe('0.5');
        expect(setValue('tdd_martingale')).toEqual(['10.5']);
        expect(setValue('tdd_take_profit')).toEqual(['20']);
        expect(setValue('tdd_stop_loss')).toEqual(['50']);
        expect(setValue('tdd_cooldown_loss')).toEqual(['2']);

        const scan = doc.querySelector('block[type="tie_digit_differ_scan"]');
        expect(scan?.querySelector('value[name="ANALYSIS_WINDOW"] field')?.textContent).toBe('Analysis Tick Window');
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
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
        expect(setValue('zor_window')).toEqual(['120']);
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
        // Rate learning (profit ÷ price) + carried-over shortfall (loss − profit, twice in the ternary).
        expect(win_branch?.querySelectorAll('block[type="read_details"]').length).toBe(4);
        const win_loss_set = [...(win_branch?.querySelectorAll('block[type="variables_set"]') ?? [])].find(
            b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === 'zor_recovery_loss'
        );
        expect(win_loss_set?.querySelector(':scope > value[name="VALUE"] > block')?.getAttribute('type')).toBe(
            'logic_ternary'
        );
        expect(doc.querySelector('variable#zor_protect')?.textContent).toBe('Recovery Off When Profit > Stake');

        const scan = doc.querySelector('block[type="zero_one_rise_over_scan"]');
        expect(scan?.querySelector('value[name="BARRIER"] field')?.textContent).toBe('Barrier');
        expect(scan?.querySelector('value[name="TARGET_DIGITS"] field')?.textContent).toBe('Target Digits');
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
    });

    it('Low-High Flip OVER 1: Over 1 entry, Over 2 recovery sized to repay the losses', () => {
        const bot = FREE_BOTS.find(b => b.id === 'low-high-flip-over-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('overunder');
        expect(field('PURCHASE_LIST')).toBe('DIGITOVER');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);

        expect(setValue('lhf_prev2_below')).toEqual(['4']);
        expect(setValue('lhf_prev1_below')).toEqual(['5']);
        expect(setValue('lhf_current_above')).toEqual(['5']);
        expect(setValue('lhf_entry_barrier')).toEqual(['1']);
        expect(setValue('lhf_recovery_barrier')).toEqual(['2']);
        expect(setValue('lhf_stake')[0]).toBe('0.5');
        expect(setValue('lhf_recovery_rate')[0]).toBe('0.36');
        expect(setValue('lhf_take_profit')).toEqual(['20']);
        expect(setValue('lhf_stop_loss')).toEqual(['50']);
        expect(setValue('lhf_barrier')).toEqual([
            'Entry Over Barrier',
            'Entry Over Barrier',
            'Entry Over Barrier',
            'Recovery Over Barrier',
        ]);

        const loss_xml = doc.querySelector('block#lhf_ap_win > statement[name="ELSE"]')?.innerHTML ?? '';
        expect(loss_xml).toContain('ROUNDUP');
        expect(loss_xml).toContain('Recovery Profit Rate');
        const win_branch = doc.querySelector('block#lhf_ap_win > statement[name="DO0"]');
        expect(win_branch?.querySelectorAll('block[type="read_details"]').length).toBe(4);
        expect(doc.querySelectorAll('block[type="timeout"] value[name="IF1"]')).toHaveLength(2);

        const scan = doc.querySelector('block[type="low_high_flip_over_scan"]');
        expect(scan?.querySelector('value[name="PREV2_BELOW"] field')?.textContent).toBe('Previous_2 Below');
        expect(scan?.querySelector('value[name="PREV1_BELOW"] field')?.textContent).toBe('Previous_1 Below');
        expect(scan?.querySelector('value[name="CURRENT_ABOVE"] field')?.textContent).toBe('Current Above');
        expect(scan?.querySelector('value[name="BARRIER"] field')?.textContent).toBe('Barrier');
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');

        expect(setValue('lhf_scan_markets')).toEqual(['TRUE']);
        expect(setValue('lhf_market_group')).toEqual(['1S']);
        expect(scan?.querySelector('value[name="SCAN_MARKETS"] field')?.textContent).toBe('Scan Multiple Markets');
        expect(scan?.querySelector('value[name="MARKET_GROUP"] field')?.textContent).toBe(
            'Market Group (1S / STANDARD / ALL)'
        );
        expect(scan?.querySelector('value[name="SYMBOLS"] field')?.textContent).toBe('Custom Symbols');
    });
});
