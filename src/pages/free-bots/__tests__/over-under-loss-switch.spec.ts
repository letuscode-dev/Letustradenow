import { OVER_UNDER_LOSS_SWITCH_XML } from '../bots/over-under-loss-switch';

const doc = new DOMParser().parseFromString(OVER_UNDER_LOSS_SWITCH_XML, 'text/xml');
const variableId = (block: Element | null | undefined) =>
    block?.querySelector(':scope > field[name="VAR"]')?.getAttribute('id');
const assignments = (parent: ParentNode | null | undefined) =>
    [...(parent?.querySelectorAll('block[type="variables_set"]') || [])];
const findSet = (parent: ParentNode | null | undefined, id: string) => assignments(parent).find(block => variableId(block) === id);

describe('Over to Under on Loss free bot', () => {
    it('exposes the requested inputs and uses a one-tick contract', () => {
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        const init = doc.querySelector('statement[name="INITIALIZATION"]');
        const value = (id: string) => findSet(init, id)?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent;
        expect(value('ous_over')).toBe('2');
        expect(value('ous_under')).toBe('7');
        expect(value('ous_initial')).toBe('1');
        expect(value('ous_multiplier')).toBe('2');
        expect(value('ous_target')).toBe('10');
        expect(doc.querySelector('field[name="TRADETYPE_LIST"]')?.textContent).toBe('overunder');
        expect(doc.querySelector('field[name="TYPE_LIST"]')?.textContent).toBe('both');
        const options = doc.querySelector('block[type="trade_definition_tradeoptions"]');
        expect(options?.querySelector(':scope > value[name="DURATION"] field')?.textContent).toBe('1');
        expect(options?.querySelector(':scope > value[name="AMOUNT"] field')?.getAttribute('id')).toBe('ous_amount');
        expect(options?.querySelector(':scope > value[name="PREDICTION"] field')?.getAttribute('id')).toBe('ous_prediction');
    });

    it('starts with Over, uses the current tick, and validates inputs before buying', () => {
        const reset = doc.querySelector('block[id="ous_reset"]');
        expect(reset?.querySelector('block[type="set_catch_every_tick"] value[name="ENABLED"] field')?.textContent).toBe('1');
        expect(findSet(reset, 'ous_prediction')?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ous_over');
        expect(findSet(reset, 'ous_is_under')?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
        const before = doc.querySelector('block[type="before_purchase"]');
        const validator = before?.querySelector('block[type="over_under_switch_validate"]');
        for (const [name, id] of [['OVER', 'ous_over'], ['UNDER', 'ous_under'], ['STAKE', 'ous_initial'], ['MULTIPLIER', 'ous_multiplier'], ['TARGET', 'ous_target']]) {
            expect(validator?.querySelector(`:scope > value[name="${name}"] field`)?.getAttribute('id')).toBe(id);
        }
        const side = before?.querySelector('statement[name="DO0"] > block[type="controls_if"]');
        expect(side?.querySelector(':scope > statement[name="DO0"] block[type="over_under_switch_purchase"] field[name="SIDE"]')?.textContent).toBe('DIGITUNDER');
        expect(side?.querySelector(':scope > statement[name="ELSE"] block[type="over_under_switch_purchase"] field[name="SIDE"]')?.textContent).toBe('DIGITOVER');
        expect(before?.querySelector('block[type="refresh_trade_options"]')).toBeNull();
    });

    it('switches to Under and multiplies after each loss; a win resets to Over', () => {
        const after = doc.querySelector('block[type="after_purchase"]');
        const result = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
            block.querySelector(':scope > value[name="IF0"] > block[type="contract_check_result"]')
        );
        const win = result?.querySelector(':scope > statement[name="DO0"]');
        const loss = result?.querySelector(':scope > statement[name="ELSE"]');
        expect(findSet(win, 'ous_amount')?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ous_initial');
        expect(findSet(win, 'ous_prediction')?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ous_over');
        expect(findSet(win, 'ous_is_under')?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('0');
        expect(findSet(loss, 'ous_amount')?.querySelector('block[type="over_under_switch_round"]')).not.toBeNull();
        const product = findSet(loss, 'ous_amount')?.querySelector('block[type="math_arithmetic"]');
        expect(product?.querySelector(':scope > field[name="OP"]')?.textContent).toBe('MULTIPLY');
        expect(product?.querySelector(':scope > value[name="A"] block[type="read_details"] field[name="DETAIL_INDEX"]')?.textContent).toBe('2');
        expect(product?.querySelector(':scope > value[name="B"] field')?.getAttribute('id')).toBe('ous_multiplier');
        expect(findSet(loss, 'ous_prediction')?.querySelector(':scope > value[name="VALUE"] field')?.getAttribute('id')).toBe('ous_under');
        expect(findSet(loss, 'ous_is_under')?.querySelector(':scope > value[name="VALUE"] field')?.textContent).toBe('1');
    });

    it('accumulates P/L and stops when take profit is reached', () => {
        const after = doc.querySelector('block[type="after_purchase"]');
        expect(findSet(after, 'ous_profit')?.querySelector('field[name="DETAIL_INDEX"]')?.textContent).toBe('4');
        expect(findSet(after, 'ous_total')?.querySelector('field[id="ous_profit"]')).not.toBeNull();
        expect(findSet(after, 'ous_total')?.querySelector('block[type="over_under_switch_round"]')).not.toBeNull();
        const limit = [...(after?.querySelectorAll('block[type="controls_if"]') || [])].find(block =>
            block.querySelector(':scope > value[name="IF0"] field[id="ous_target"]')
        );
        expect(limit?.querySelector(':scope > value[name="IF0"] field[name="OP"]')?.textContent).toBe('GTE');
        expect(limit?.querySelector(':scope > statement[name="DO0"] block[type="trade_again"]')).toBeNull();
        expect(limit?.querySelector(':scope > statement[name="ELSE"] block[type="trade_again"]')).not.toBeNull();
    });
});
