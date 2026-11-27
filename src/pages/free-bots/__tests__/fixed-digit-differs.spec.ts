import { FIXED_DIGIT_DIFFERS_XML } from '../bots/fixed-digit-differs';

describe('fixed prediction Digit Differs template', () => {
    const doc = new DOMParser().parseFromString(FIXED_DIGIT_DIFFERS_XML, 'text/xml');
    const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;

    it('uses Volatility 75 (1s), Digit Differs and a one-tick duration', () => {
        expect(doc.querySelector('parsererror')).toBeNull();
        expect(field('SYMBOL_LIST')).toBe('1HZ75V');
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('TYPE_LIST')).toBe('DIGITDIFF');
        expect(field('DURATIONTYPE_LIST')).toBe('t');
        expect(doc.querySelector('value[name="DURATION"] field')?.textContent).toBe('1');
    });

    it('exposes prediction, stake, take profit and stop loss', () => {
        for (const [id, expected] of [['fdd_prediction', '2'], ['fdd_stake', '1'], ['fdd_take_profit', '10'], ['fdd_stop_loss', '50']]) {
            const variable = doc.querySelector(`statement[name="INITIALIZATION"] field[id="${id}"]`);
            expect(variable?.parentElement?.querySelector('value[name="VALUE"] field')?.textContent).toBe(expected);
        }
        const run = doc.querySelector('block[type="fixed_digit_differs_run"]');
        expect(run?.querySelector('value[name="PREDICTION"] field')?.getAttribute('id')).toBe('fdd_prediction');
        expect(run?.querySelector('value[name="STOP_LOSS"] field')?.getAttribute('id')).toBe('fdd_stop_loss');
    });
});
