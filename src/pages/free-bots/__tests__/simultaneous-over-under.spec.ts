import { SIMULTANEOUS_OVER_UNDER_XML } from '../bots/simultaneous-over-under';

const parse = () => new DOMParser().parseFromString(SIMULTANEOUS_OVER_UNDER_XML, 'text/xml');

describe('Simultaneous Over/Under free bot', () => {
    const variableId = (block: Element | null | undefined) =>
        block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');

    const initialValue = (doc: XMLDocument, id: string) =>
        [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')]
            .filter(block => variableId(block) === id)
            .map(block => block.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent);

    it('is well-formed and exposes only the requested configuration inputs', () => {
        const doc = parse();

        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(initialValue(doc, 'sou_over_stake')).toEqual(['1']);
        expect(initialValue(doc, 'sou_under_stake')).toEqual(['1']);
        expect(initialValue(doc, 'sou_over_prediction')).toEqual(['3']);
        expect(initialValue(doc, 'sou_under_prediction')).toEqual(['3']);
        expect(initialValue(doc, 'sou_martingale')).toEqual(['2']);
        expect(initialValue(doc, 'sou_duration')).toEqual(['1']);
        expect(initialValue(doc, 'sou_take_profit')).toEqual(['10']);
        expect(initialValue(doc, 'sou_stop_loss')).toEqual(['50']);
        expect(initialValue(doc, 'sou_over_amount')).toEqual([]);
        expect(initialValue(doc, 'sou_under_amount')).toEqual([]);
    });

    it('configures a tick-duration Digit Over/Under pair and catches the current tick', () => {
        const doc = parse();
        const field = (name: string) => doc.querySelector(`field[name="${name}"]`)?.textContent;

        expect(field('SYMBOL_LIST')).toBe('1HZ75V');
        expect(field('TRADETYPE_LIST')).toBe('overunder');
        expect(field('TYPE_LIST')).toBe('both');
        expect(field('DURATIONTYPE_LIST')).toBe('t');

        const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
        expect(options?.querySelector(':scope > value[name="DURATION"] field')?.getAttribute('id')).toBe('sou_duration');
        expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('sou_over_amount');
        expect(options?.querySelector(':scope > value[name="PREDICTION"] field')?.getAttribute('id')).toBe('sou_over_prediction');

        const reset = doc.querySelector('block[id="sou_reset_fn"]');
        expect(reset?.querySelector('block[type="set_catch_every_tick"] value[name="ENABLED"] field[name="NUM"]')?.textContent).toBe(
            '1'
        );
        expect(reset?.querySelector('block[type="variables_set"] field[id="sou_over_amount"]')).not.toBeNull();
        expect(reset?.querySelector('block[type="variables_set"] field[id="sou_under_amount"]')).not.toBeNull();
    });

    it('sends Over and Under together with independent live stakes and applies Martingale to both only after settlement', () => {
        const doc = parse();
        const purchase = doc.querySelector('block[type="before_purchase"] block[type="digit_hedge_purchase"]');

        expect(purchase?.querySelector(':scope > value[name="OVER"] field')?.getAttribute('id')).toBe('sou_over_prediction');
        expect(purchase?.querySelector(':scope > value[name="UNDER"] field')?.getAttribute('id')).toBe('sou_under_prediction');
        expect(purchase?.querySelector(':scope > value[name="OVER_STAKE"] field')?.getAttribute('id')).toBe('sou_over_amount');
        expect(purchase?.querySelector(':scope > value[name="UNDER_STAKE"] field')?.getAttribute('id')).toBe('sou_under_amount');
        expect(purchase?.querySelector(':scope > value[name="TAKE_PROFIT"] field')?.getAttribute('id')).toBe('sou_take_profit');
        expect(purchase?.querySelector(':scope > value[name="STOP_LOSS"] field')?.getAttribute('id')).toBe('sou_stop_loss');

        const after = doc.querySelector('block[type="after_purchase"]');
        expect(after?.querySelector('block[type="digit_hedge_result"]')).not.toBeNull();
        const nextStakeBlocks = [...(after?.querySelectorAll('block[type="digit_hedge_next_stake"]') || [])];
        expect(nextStakeBlocks.map(block => block.querySelector(':scope > field[name="LEG"]')?.textContent)).toEqual([
            'over',
            'under',
        ]);
        expect(nextStakeBlocks.every(block => block.querySelector(':scope > value[name="MULTIPLIER"] field')?.getAttribute('id') === 'sou_martingale')).toBe(
            true
        );
        expect(after?.querySelector('block[type="digit_hedge_continues"]')).not.toBeNull();
        expect(after?.querySelector('block[type="trade_again"]')).not.toBeNull();
    });

    it('books confirmed combined profit and stops at the configured limits before trading again', () => {
        const doc = parse();
        const after = doc.querySelector('block[type="after_purchase"]');
        const book = after?.querySelector('block[type="digit_hedge_book_profit"]');
        expect(book?.querySelector(':scope > value[name="TOTAL"] field')?.getAttribute('id')).toBe('sou_total');
        expect(book?.querySelector(':scope > value[name="PROFIT"] field')?.getAttribute('id')).toBe('sou_result');
        expect(book?.querySelector(':scope > value[name="TAKE_PROFIT"] field')?.getAttribute('id')).toBe('sou_take_profit');
        expect(book?.querySelector(':scope > value[name="STOP_LOSS"] field')?.getAttribute('id')).toBe('sou_stop_loss');
        const limits = book?.closest('block[type="variables_set"]')?.querySelector(':scope > next > block[type="controls_if"]');
        expect(limits?.querySelector(':scope > value[name="IF0"] block[type="digit_hedge_limit"]')).not.toBeNull();
        expect(limits?.querySelector(':scope > value[name="IF1"] block[type="digit_hedge_limit"]')).not.toBeNull();
        expect(limits?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
        expect(limits?.querySelector(':scope > statement[name="DO1"] block[type="trade_again"]')).toBeNull();
        expect(limits?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
    });
});
