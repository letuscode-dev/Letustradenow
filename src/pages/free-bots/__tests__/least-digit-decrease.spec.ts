import { LEAST_DIGIT_DECREASE_XML } from '../bots/least-digit-decrease';

describe('least digit decrease bot template', () => {
    const doc = new DOMParser().parseFromString(LEAST_DIGIT_DECREASE_XML, 'text/xml');
    const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
    it('uses Volatility 75 (1s), Digit Differs and one tick', () => {
        expect(doc.querySelector('parsererror')).toBeNull();
        expect(field('SYMBOL_LIST')).toBe('1HZ75V');
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('TYPE_LIST')).toBe('DIGITDIFF');
        expect(field('DURATIONTYPE_LIST')).toBe('t');
        expect(doc.querySelector('value[name="DURATION"] field')?.textContent).toBe('1');
    });
    it('offers stake, consecutive loss limit and take profit with requested defaults', () => {
        for (const [id, expected] of [['mirror_stake', '5'], ['mirror_losses', '2'], ['mirror_target', '10']]) {
            const variable = doc.querySelector(`statement[name="INITIALIZATION"] field[id="${id}"]`);
            expect(variable?.parentElement?.querySelector('value[name="VALUE"] field')?.textContent).toBe(expected);
        }
        expect(doc.querySelector('block[type="mirror_bot_run"]')).not.toBeNull();
        expect(doc.querySelector('statement[name="INITIALIZATION"] field[id="mirror_markets"]')?.parentElement?.querySelector('value[name="VALUE"] field')?.textContent)
            .toBe('ALL');
        expect(doc.querySelector('block[type="mirror_bot_run"] value[name="MARKETS"] field')?.getAttribute('id')).toBe('mirror_markets');
    });
});
