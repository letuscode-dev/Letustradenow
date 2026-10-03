import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml as string);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(doc.querySelector('block[type="purchase"]')).not.toBeNull();
    });

    it('ships the High-Low Tie, Frequency Gap and Rank Drop Differs bots', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual([
            'high-low-tie-differ-v1',
            'frequency-gap-differ-v1',
            'rank-drop-differ-v1',
        ]);
    });

    it('Rank Drop Differs: same risk management as High-Low Tie Differs and its own settings', () => {
        const bot = FREE_BOTS.find(b => b.id === 'rank-drop-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('PURCHASE_LIST')).toBe('DIGITDIFF');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('rdd_window')).toEqual(['1000']);
        expect(setValue('rdd_lookback')).toEqual(['100']);
        expect(setValue('rdd_min_drop')).toEqual(['3']);
        expect(setValue('rdd_enabled')).toEqual(['TRUE']);
        expect(setValue('rdd_confirm')).toEqual(['TRUE']);
        expect(setValue('rdd_stake')[0]).toBe('0.5');
        expect(setValue('rdd_martingale')).toEqual(['1']);
        expect(setValue('rdd_take_profit')).toEqual(['20']);
        expect(setValue('rdd_stop_loss')).toEqual(['50']);

        const hlt = FREE_BOTS.find(b => b.id === 'high-low-tie-differ-v1')!.xml;
        const afterPurchase = (xml: string) =>
            xml.slice(xml.indexOf('<block type="after_purchase"')).replace(/hlt_|rdd_/g, 'x_');
        expect(afterPurchase(bot!.xml)).toBe(afterPurchase(hlt));

        const scan = doc.querySelector('block[type="rank_drop_differ_scan"]');
        expect(scan?.querySelector('value[name="ANALYSIS_WINDOW"] field')?.textContent).toBe('Analysis Window');
        expect(scan?.querySelector('value[name="LOOKBACK"] field')?.textContent).toBe('Lookback Ticks');
        expect(scan?.querySelector('value[name="MIN_DROP"] field')?.textContent).toBe('Minimum Rank Drop');
        expect(bot!.xml).not.toContain('frequency_gap_differ_scan');
    });

    it('Frequency Gap Differs: same risk management as High-Low Tie Differs and a single Analysis Window', () => {
        const bot = FREE_BOTS.find(b => b.id === 'frequency-gap-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('PURCHASE_LIST')).toBe('DIGITDIFF');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('fgd_window')).toEqual(['1000']);
        expect(setValue('fgd_min_gap')).toEqual(['4']);
        expect(setValue('fgd_enabled')).toEqual(['TRUE']);
        expect(setValue('fgd_confirm')).toEqual(['TRUE']);
        expect(setValue('fgd_stake')[0]).toBe('0.5');
        expect(setValue('fgd_martingale')).toEqual(['1']);
        expect(setValue('fgd_protect')).toEqual(['FALSE']);
        expect(setValue('fgd_take_profit')).toEqual(['20']);
        expect(setValue('fgd_stop_loss')).toEqual(['50']);
        expect(setValue('fgd_cooldown_loss')).toEqual(['2']);
        expect(setValue('fgd_cooldown_win')).toEqual(['1']);

        const hlt = FREE_BOTS.find(b => b.id === 'high-low-tie-differ-v1')!.xml;
        const afterPurchase = (xml: string) =>
            xml.slice(xml.indexOf('<block type="after_purchase"')).replace(/hlt_|fgd_/g, 'x_');
        expect(afterPurchase(bot!.xml)).toBe(afterPurchase(hlt));

        const scan = doc.querySelector('block[type="frequency_gap_differ_scan"]');
        expect(scan?.querySelector('value[name="ANALYSIS_WINDOW"] field')?.textContent).toBe('Analysis Window');
        expect(scan?.querySelector('value[name="MIN_GAP"] field')?.textContent).toBe('Minimum Frequency Gap %');
        expect(scan?.querySelector('value[name="ENABLED"] field')?.textContent).toBe('Strategy Enabled');
        expect(scan?.querySelector('value[name="CONFIRM"] field')?.textContent).toBe('New-Tick Confirmation');
        expect(scan?.querySelectorAll('value[name$="WINDOW"]')).toHaveLength(1);
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
    });

    it('High-Low Tie Differs: Differs risk management and a single configurable Analysis Window', () => {
        const bot = FREE_BOTS.find(b => b.id === 'high-low-tie-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('PURCHASE_LIST')).toBe('DIGITDIFF');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('hlt_window')).toEqual(['200']);
        expect(setValue('hlt_recent_ticks')).toEqual(['50']);
        expect(setValue('hlt_tolerance')).toEqual(['0']);
        expect(setValue('hlt_mode')).toEqual(['AUTO']);
        expect(setValue('hlt_cooldown_signal')).toEqual(['1']);
        expect(setValue('hlt_stake')[0]).toBe('0.5');
        expect(setValue('hlt_martingale')).toEqual(['1']);
        expect(setValue('hlt_take_profit')).toEqual(['20']);
        expect(setValue('hlt_stop_loss')).toEqual(['50']);

        const scan = doc.querySelector('block[type="high_low_tie_differ_scan"]');
        expect(scan?.querySelector('value[name="ANALYSIS_WINDOW"] field')?.textContent).toBe('Analysis Window');
        expect(scan?.querySelector('value[name="RECENT_TICKS"] field')?.textContent).toBe('Recent Ticks');
        expect(scan?.querySelector('value[name="RECENT_WINDOW"]')).toBeNull();
        expect(scan?.querySelector('value[name="MICRO_WINDOW"]')).toBeNull();
        expect(bot!.xml).not.toMatch(/Recent Window|Micro Window/);
        expect(scan?.querySelector('value[name="TIE_TOLERANCE"] field')?.textContent).toBe('Tie Tolerance %');
        expect(scan?.querySelector('value[name="MODE"] field')?.textContent).toBe('Mode (HIGH / LOW / AUTO)');
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
    });
});
