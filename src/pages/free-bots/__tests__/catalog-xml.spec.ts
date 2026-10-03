import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml as string);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(doc.querySelector('block[type="purchase"]')).not.toBeNull();
    });

    it('only ships the High-Low Tie Differs bot', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['high-low-tie-differ-v1']);
    });

    it('High-Low Tie Differs: Differs risk management without martingale and configurable windows', () => {
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
        expect(setValue('hlt_recent')).toEqual(['20']);
        expect(setValue('hlt_micro')).toEqual(['10']);
        expect(setValue('hlt_tolerance')).toEqual(['0']);
        expect(setValue('hlt_mode')).toEqual(['AUTO']);
        expect(setValue('hlt_cooldown_signal')).toEqual(['1']);
        expect(setValue('hlt_stake')[0]).toBe('0.5');
        expect(setValue('hlt_martingale')).toEqual(['1']);
        expect(setValue('hlt_take_profit')).toEqual(['20']);
        expect(setValue('hlt_stop_loss')).toEqual(['50']);

        const scan = doc.querySelector('block[type="high_low_tie_differ_scan"]');
        expect(scan?.querySelector('value[name="ANALYSIS_WINDOW"] field')?.textContent).toBe('Analysis Window');
        expect(scan?.querySelector('value[name="RECENT_WINDOW"] field')?.textContent).toBe('Recent Window');
        expect(scan?.querySelector('value[name="MICRO_WINDOW"] field')?.textContent).toBe('Micro Window');
        expect(scan?.querySelector('value[name="TIE_TOLERANCE"] field')?.textContent).toBe('Tie Tolerance %');
        expect(scan?.querySelector('value[name="MODE"] field')?.textContent).toBe('Mode (HIGH / LOW / AUTO)');
        expect(doc.querySelector('value[name="PREDICTION"] field')?.textContent).toBe('Prediction');
    });
});
