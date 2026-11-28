import { ALTERNATING_OVER_UNDER_XML } from '../bots/alternating-over-under';
import { validOverUnderSwitchSettings } from '../../../external/bot-skeleton/services/tradeEngine/utils/over-under-validation';

const documentForBot = () => new DOMParser().parseFromString(ALTERNATING_OVER_UNDER_XML, 'text/xml');
const childBlock = (parent: Element | null, selector: string) =>
    parent?.querySelector(`:scope > ${selector} > block`) || parent?.querySelector(`:scope > ${selector} > shadow`) || null;
const field = (block: Element, name: string) => block.querySelector(`:scope > field[name="${name}"]`);

// Exercise the imported Blockly decision tree with controlled settled results.
const createRunner = () => {
    const doc = documentForBot();
    const vars = new Map<string, unknown>();
    const state: { total: number; result: string; again: boolean; catchTick: boolean; purchase: string; prediction: number; amount: number } =
        { total: 0, result: '', again: false, catchTick: false, purchase: '', prediction: 0, amount: 0 };

    const evaluate = (block: Element | null): any => {
        if (!block) throw new Error('Missing expression');
        const value = (name: string) => evaluate(childBlock(block, `value[name="${name}"]`));
        const type = block.getAttribute('type');
        switch (type) {
            case 'math_number':
            case 'math_number_positive': return Number(field(block, 'NUM')?.textContent);
            case 'text': return field(block, 'TEXT')?.textContent;
            case 'logic_boolean': return field(block, 'BOOL')?.textContent === 'TRUE';
            case 'variables_get': return vars.get(field(block, 'VAR')!.getAttribute('id')!);
            case 'total_profit': return state.total;
            case 'contract_check_result': return state.result === field(block, 'CHECK_RESULT')?.textContent;
            case 'math_single': return -value('NUM');
            case 'math_arithmetic': return value('A') * value('B');
            case 'over_under_switch_round': return Math.round((value('VALUE') + Number.EPSILON) * 100) / 100;
            case 'over_under_switch_validate': return validOverUnderSwitchSettings(value('OVER'), value('UNDER'), value('STAKE'), value('MULTIPLIER'), value('TARGET'));
            case 'logic_compare': {
                const a = value('A'); const b = value('B');
                switch (field(block, 'OP')?.textContent) {
                    case 'EQ': return a === b;
                    case 'NEQ': return a !== b;
                    case 'GTE': return a >= b;
                    case 'LTE': return a <= b;
                    default: throw new Error('Unknown comparison');
                }
            }
            default: throw new Error(`Unexpected expression ${type}`);
        }
    };
    const run = (block: Element | null): boolean => {
        if (!block) return false;
        const type = block.getAttribute('type');
        const value = (name: string) => evaluate(childBlock(block, `value[name="${name}"]`));
        const statement = (name: string) => childBlock(block, `statement[name="${name}"]`);
        switch (type) {
            case 'variables_set': vars.set(field(block, 'VAR')!.getAttribute('id')!, value('VALUE')); break;
            case 'set_catch_every_tick': state.catchTick = value('ENABLED') === 1; break;
            case 'controls_if': {
                const branches = [...block.children].filter(child => child.tagName === 'value' && /^IF\d+$/.test(child.getAttribute('name') || ''));
                let chosen: Element | null = null;
                for (const branch of branches) {
                    if (evaluate(branch.querySelector(':scope > block'))) {
                        chosen = statement(`DO${branch.getAttribute('name')!.slice(2)}`); break;
                    }
                }
                if (!chosen) chosen = statement('ELSE');
                if (run(chosen)) return true;
                break;
            }
            case 'trade_definition_tradeoptions': state.prediction = value('PREDICTION'); state.amount = value('AMOUNT'); break;
            case 'over_under_switch_purchase': state.purchase = field(block, 'SIDE')!.textContent!; break;
            case 'trade_again': state.again = true; return true;
            case 'text_print': break;
            default: throw new Error(`Unexpected statement ${type}`);
        }
        return run(childBlock(block, 'next'));
    };
    const root = (name: string) => doc.querySelector(`statement[name="${name}"] > block`);
    const init = () => run(root('INITIALIZATION'));
    const order = () => { run(root('SUBMARKET')); run(root('BEFOREPURCHASE_STACK')); return [state.purchase, state.prediction, state.amount]; };
    const settle = (result: string, total: number) => { state.result = result; state.total = total; state.again = false; run(root('AFTERPURCHASE_STACK')); return state.again; };
    return { doc, vars, state, init, order, settle };
};

it('loads the supplied defaults and uses direct purchases with current-tick mode', () => {
    const bot = createRunner();
    expect(bot.doc.querySelector('parsererror')).toBeNull();
    expect(bot.doc.querySelector('field[name="SYMBOL_LIST"]')?.textContent).toBe('1HZ10V');
    expect(bot.doc.querySelector('field[name="RESTARTONERROR"]')?.textContent).toBe('FALSE');
    expect(bot.doc.querySelectorAll('block[type="apollo_purchase"]')).toHaveLength(0);
    expect(bot.doc.querySelectorAll('block[type="over_under_switch_purchase"]')).toHaveLength(2);
    expect(bot.doc.querySelector('block[id="aou_set_over"] field[name="NUM"]')?.textContent).toBe('3');
    expect(bot.doc.querySelector('block[id="aou_set_under"] field[name="NUM"]')?.textContent).toBe('6');
    bot.init();
    expect(bot.state.catchTick).toBe(true);
    expect(bot.order()).toEqual(['DIGITOVER', 3, 0.5]);
});

it.each([[0, 1], [2, 7], [8, 9]])('uses configurable Over %i and Under %i predictions on their respective trades', (over, under) => {
    const bot = createRunner();
    bot.doc.querySelector('block[id="aou_set_over"] field[name="NUM"]')!.textContent = String(over);
    bot.doc.querySelector('block[id="aou_set_under"] field[name="NUM"]')!.textContent = String(under);
    bot.init();
    expect(bot.order()).toEqual(['DIGITOVER', over, 0.5]);
    expect(bot.settle('win', 0.2)).toBe(true);
    expect(bot.order()).toEqual(['DIGITUNDER', under, 0.5]);
    expect(bot.settle('loss', -0.3)).toBe(true);
    expect(bot.order()).toEqual(['DIGITOVER', over, 1.25]);
});

it.each([[9, 6], [3, 0], [-1, 6], [3, 10], [2.5, 6]])('blocks purchase when either configured prediction is invalid: %s, %s', (over, under) => {
    const bot = createRunner();
    bot.doc.querySelector('block[id="aou_set_over"] field[name="NUM"]')!.textContent = String(over);
    bot.doc.querySelector('block[id="aou_set_under"] field[name="NUM"]')!.textContent = String(under);
    bot.init();
    bot.order();
    expect(bot.state.purchase).toBe('');
});

it('alternates after wins and losses, applies rounded Martingale, and resets on a win', () => {
    const bot = createRunner(); bot.init();
    expect(bot.order()).toEqual(['DIGITOVER', 3, 0.5]);
    expect(bot.settle('win', 0.2)).toBe(true);
    expect(bot.order()).toEqual(['DIGITUNDER', 6, 0.5]);
    expect(bot.settle('loss', -0.3)).toBe(true);
    expect(bot.order()).toEqual(['DIGITOVER', 3, 1.25]);
    expect(bot.settle('loss', -1.55)).toBe(true);
    expect(bot.order()).toEqual(['DIGITUNDER', 6, 3.13]);
    expect(bot.settle('win', 0.1)).toBe(true);
    expect(bot.order()).toEqual(['DIGITOVER', 3, 0.5]);
});

it('respects the Martingale toggle and stops at either profit limit', () => {
    const bot = createRunner(); bot.init();
    const toggle = [...bot.doc.querySelectorAll('variable')].find(variable => variable.textContent === 'Use Martingale')!;
    bot.vars.set(toggle.getAttribute('id')!, false);
    expect(bot.settle('loss', -0.5)).toBe(true);
    expect(bot.order()).toEqual(['DIGITUNDER', 6, 0.5]);
    expect(bot.settle('win', 5)).toBe(false);
    expect(bot.settle('loss', -30)).toBe(false);
});
