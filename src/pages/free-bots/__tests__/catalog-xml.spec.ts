import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(
            doc.querySelector(
                'block[type="purchase"], block[type="first_decimal_digit_differ_purchase"]'
            )
        ).not.toBeNull();
    });

    it('ships only Double Decimal Digit Differ + 10.5 Recovery', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual(['first-decimal-digit-differ-v1']);
    });

    it('every free bot starts on Volatility 75 (1s) Index', () => {
        FREE_BOTS.forEach(bot => {
            expect(parse(bot.xml).querySelector('field[name="SYMBOL_LIST"]')?.textContent).toBe('1HZ75V');
        });
    });

    it('First Decimal Digit Differ: automatic barrier, 10.5 recovery and its limits', () => {
        const bot = FREE_BOTS.find(b => b.id === 'first-decimal-digit-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('TYPE_LIST')).toBe('DIGITDIFF');
        expect(field('DURATIONTYPE_LIST')).toBe('t');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('fdd_stake')).toEqual(['2']);
        expect(setValue('fdd_duration')).toEqual(['1']);
        expect(setValue('fdd_recovery')).toEqual(['TRUE']);
        expect(setValue('fdd_multiplier')).toEqual(['10.5']);
        expect(setValue('fdd_max_level')).toEqual(['2']);
        expect(setValue('fdd_max_recovery_stake')).toEqual(['250']);
        expect(setValue('fdd_auto')).toEqual(['TRUE']);

        const prediction = doc.querySelector('block[type="trade_definition_tradeoptions"] > value[name="PREDICTION"]');
        expect(prediction?.querySelector('field[name="VAR"]')?.getAttribute('id')).toBe('fdd_barrier');
        expect(doc.querySelector('block[type="first_decimal_digit_barrier"]')).not.toBeNull();

        const analyze = doc.querySelector('block[type="before_purchase"] block[type="first_decimal_digit_differ_analyze"]');
        expect(analyze?.querySelector(':scope > value[name="BASE_STAKE"] field')?.getAttribute('id')).toBe('fdd_stake');
        expect(analyze?.querySelector(':scope > value[name="RECOVERY_MULTIPLIER"] field')?.getAttribute('id')).toBe(
            'fdd_multiplier'
        );
        expect(doc.querySelector('block[type="before_purchase"] block[type="first_decimal_digit_differ_purchase"]')).not.toBeNull();
        expect(doc.querySelector('block[type="after_purchase"] block[type="first_decimal_digit_differ_result"]')).not.toBeNull();
    });
});
