import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(doc.querySelector('block[type="purchase"], block[type="rise_fall_hedge_purchase"]')).not.toBeNull();
    });

    it('ships Rank Drop Differs and Rise/Fall Hedge as Bot Builder bots', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['rank-drop-differ-v1', 'rise-fall-hedge-v1']);
    });

    it('Rise/Fall Hedge: Step Index 100 Rise + Fall, $2 per leg, 2 ticks, flat stake', () => {
        const bot = FREE_BOTS.find(b => b.id === 'rise-fall-hedge-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('SUBMARKET_LIST')).toBe('step_index');
        expect(field('SYMBOL_LIST')).toBe('stpRNG');
        expect(field('TRADETYPECAT_LIST')).toBe('callput');
        expect(field('TRADETYPE_LIST')).toBe('risefall');
        expect(field('TYPE_LIST')).toBe('both');
        expect(field('DURATIONTYPE_LIST')).toBe('t');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('rfh_stake')).toEqual(['2']);
        expect(setValue('rfh_duration')).toEqual(['2']);
        expect(setValue('rfh_mode')).toEqual(['MANUAL']);
        expect(setValue('rfh_policy')).toEqual(['CANCEL']);
        expect(setValue('rfh_max_stake')).toEqual(['10']);

        expect(doc.querySelector('block[type="before_purchase"] block[type="rise_fall_hedge_ready"]')).not.toBeNull();
        expect(doc.querySelector('block[type="before_purchase"] block[type="rise_fall_hedge_purchase"]')).not.toBeNull();
        expect(doc.querySelector('block[type="after_purchase"] block[type="rise_fall_hedge_result"]')).not.toBeNull();
        expect(doc.querySelector('block[type="purchase"]')).toBeNull();
        expect(bot!.xml).not.toMatch(/martingale/i);
        expect(doc.querySelectorAll('block[type="variables_set"] block[type="math_arithmetic"]')).toHaveLength(0);
    });

    it('Rank Drop Differs: Differs risk management and its own settings', () => {
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
