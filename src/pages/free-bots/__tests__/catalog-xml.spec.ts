import { FREE_BOTS } from '../catalog';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');

describe('free bot catalog XML', () => {
    it.each(FREE_BOTS.map(bot => [bot.title, bot.xml]))('%s is well-formed', (_title, xml) => {
        const doc = parse(xml);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.querySelector('block[type="trade_definition"]')).not.toBeNull();
        expect(
            doc.querySelector(
                'block[type="purchase"], block[type="rise_fall_hedge_purchase"], block[type="last_tick_digit_differ_purchase"], block[type="first_decimal_digit_differ_purchase"]'
            )
        ).not.toBeNull();
    });

    it('ships the free bots as Bot Builder bots', () => {
        expect(FREE_BOTS.map(bot => bot.id)).toEqual([
            'rank-drop-differ-v1',
            'rise-fall-hedge-v1',
            'last-tick-price-digit-differ-v1',
            'first-decimal-digit-differ-v1',
        ]);
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
        expect(setValue('fdd_duration')).toEqual(['2']);
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

    it('Last-Tick Price Digit Differ: DIGITDIFF with an automatic barrier and its settings', () => {
        const bot = FREE_BOTS.find(b => b.id === 'last-tick-price-digit-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('SYMBOL_LIST')).toBe('1HZ75V');
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('TYPE_LIST')).toBe('DIGITDIFF');
        expect(field('DURATIONTYPE_LIST')).toBe('t');

        const setValue = (var_id: string) =>
            [...doc.querySelectorAll('block[type="variables_set"]')]
                .filter(b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === var_id)
                .map(b => b.querySelector(':scope > value[name="VALUE"] field')?.textContent);
        expect(setValue('ltd_stake')).toEqual(['2']);
        expect(setValue('ltd_duration')).toEqual(['2']);
        expect(setValue('ltd_auto')).toEqual(['TRUE']);
        expect(setValue('ltd_confirm')).toEqual(['2']);
        expect(setValue('ltd_max_losses')).toEqual(['3']);

        // The barrier is never a typed number: it comes from the last tick / the analysis block.
        const prediction = doc.querySelector('block[type="trade_definition_tradeoptions"] > value[name="PREDICTION"]');
        expect(prediction?.querySelector('field[name="VAR"]')?.getAttribute('id')).toBe('ltd_barrier');
        const init_barrier = [...doc.querySelectorAll('block[type="variables_set"]')].find(
            b => b.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === 'ltd_barrier'
        );
        expect(init_barrier?.querySelector(':scope > value[name="VALUE"] > block')?.getAttribute('type')).toBe(
            'last_tick_digit_barrier'
        );

        expect(doc.querySelector('block[type="before_purchase"] block[type="last_tick_digit_differ_analyze"]')).not.toBeNull();
        expect(doc.querySelector('block[type="before_purchase"] block[type="last_tick_digit_differ_purchase"]')).not.toBeNull();
        expect(doc.querySelector('block[type="after_purchase"] block[type="last_tick_digit_differ_result"]')).not.toBeNull();
        expect(bot!.xml).not.toMatch(/martingale/i);
    });

    it('Rise/Fall Hedge: Volatility 75 (1s) Rise + Fall, $2 per leg, 2 ticks, flat stake', () => {
        const bot = FREE_BOTS.find(b => b.id === 'rise-fall-hedge-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('SUBMARKET_LIST')).toBe('random_index');
        expect(field('SYMBOL_LIST')).toBe('1HZ75V');
        expect(field('TRADETYPECAT_LIST')).toBe('callput');
        expect(field('TRADETYPE_LIST')).toBe('callput');
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

        const engine = doc.querySelector('block[type="before_purchase"] block[type="rise_fall_hedge_entry_engine"]');
        expect(engine).not.toBeNull();
        expect(engine?.querySelector(':scope > next > block[type="controls_if"]')).not.toBeNull();
        expect(setValue('rfh_entry_enabled')).toEqual(['TRUE']);
        expect(setValue('rfh_entry_mode')).toEqual(['MULTI-CONFIRMATION']);
        expect(setValue('rfh_entry_min_score')).toEqual(['5']);
        expect(setValue('rfh_entry_bias')).toEqual(['60']);
        expect(setValue('rfh_entry_lookback')).toEqual(['50']);
        expect(setValue('rfh_entry_short')).toEqual(['10']);
        expect(setValue('rfh_entry_medium')).toEqual(['20']);
        expect(setValue('rfh_entry_long')).toEqual(['50']);
        expect(setValue('rfh_entry_pattern_len')).toEqual(['4']);
        expect(setValue('rfh_entry_pattern_samples')).toEqual(['10']);
        expect(setValue('rfh_entry_max_open')).toEqual(['1']);
        [
            'ENABLED',
            'MODE',
            'MIN_SCORE',
            'MIN_BIAS',
            'LOOKBACK',
            'SHORT_WINDOW',
            'MEDIUM_WINDOW',
            'LONG_WINDOW',
            'PATTERN_LENGTH',
            'MIN_PATTERN_SAMPLES',
            'MIN_PAYOUT',
            'MAX_SIMULTANEOUS',
            'LOG_NO_TRADE',
        ].forEach(input => expect(engine?.querySelector(`:scope > value[name="${input}"]`)).not.toBeNull());
        expect(bot!.xml).not.toMatch(/martingale/i);
        expect(doc.querySelectorAll('block[type="variables_set"] block[type="math_arithmetic"]')).toHaveLength(0);
    });

    it('Rank Drop Differs: Differs risk management and its own settings', () => {
        const bot = FREE_BOTS.find(b => b.id === 'rank-drop-differ-v1');
        const doc = parse(bot!.xml);
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;
        expect(field('TRADETYPE_LIST')).toBe('matchesdiffers');
        expect(field('PURCHASE_LIST')).toBe('DIGITDIFF');
        expect(field('SYMBOL_LIST')).toBe('1HZ75V');

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
