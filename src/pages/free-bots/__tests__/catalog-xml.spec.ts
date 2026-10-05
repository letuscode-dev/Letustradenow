import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.filter(bot => bot.xml).map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml as string);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(doc.querySelector('block[type="purchase"]')).not.toBeNull();
    });

    it('ships Rank Drop Differs (Blockly) and the Rise/Fall Hedge panel', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['rank-drop-differ-v1', 'rise-fall-hedge-v1']);
        const hedge = FREE_BOTS.find(b => b.id === 'rise-fall-hedge-v1');
        expect(hedge?.panel).toBe('rise_fall_hedge');
        expect(hedge?.xml).toBeUndefined();
        FREE_BOTS.forEach(bot => expect(Boolean(bot.xml) !== Boolean(bot.panel)).toBe(true));
    });

    it('Rank Drop Differs: Differs risk management and its own settings', () => {
        const bot = FREE_BOTS.find(b => b.id === 'rank-drop-differ-v1');
        const doc = parse(bot!.xml!);
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
        expect(setValue('rdd_protect')).toEqual(['FALSE']);
        expect(setValue('rdd_take_profit')).toEqual(['20']);
        expect(setValue('rdd_stop_loss')).toEqual(['50']);
        expect(setValue('rdd_cooldown_loss')).toEqual(['2']);
        expect(setValue('rdd_cooldown_win')).toEqual(['1']);

        const scan = doc.querySelector('block[type="rank_drop_differ_scan"]');
        expect(scan?.querySelector('value[name="ANALYSIS_WINDOW"] field')?.textContent).toBe('Analysis Window');
        expect(scan?.querySelector('value[name="LOOKBACK"] field')?.textContent).toBe('Lookback Ticks');
        expect(scan?.querySelector('value[name="MIN_DROP"] field')?.textContent).toBe('Minimum Rank Drop');
        expect(scan?.querySelector('value[name="ENABLED"] field')?.textContent).toBe('Strategy Enabled');
        expect(scan?.querySelector('value[name="CONFIRM"] field')?.textContent).toBe('New-Tick Confirmation');
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
    });
});
