import { TRIPLE_HIT_CONCENTRATION_XML } from '../bots/triple-hit-concentration';

it('loads the correct market, one-tick contract, and configurable controls', () => {
    const doc = new DOMParser().parseFromString(TRIPLE_HIT_CONCENTRATION_XML, 'text/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('field[name="SYMBOL_LIST"]')?.textContent).toBe('1HZ75V');
    expect(doc.querySelector('field[name="TYPE_LIST"]')?.textContent).toBe('DIGITDIFF');
    expect(doc.querySelector('field[name="DURATIONTYPE_LIST"]')?.textContent).toBe('t');
    expect(doc.querySelector('value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
    const values = [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')];
    const initial = (id: string) => values.find(block => block.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === id)
        ?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent;
    expect(Number(initial('thc_stake'))).toBe(5);
    expect(Number(initial('thc_losses'))).toBe(2);
    expect(Number(initial('thc_target'))).toBe(10);
    expect(Number(initial('thc_recovery'))).toBe(100 / 9.6);
    const run = doc.querySelector('block[type="triple_hit_concentration_run"]');
    expect(run).not.toBeNull();
    ['STAKE', 'LOSSES', 'TARGET', 'RECOVERY'].forEach(name => expect(run?.querySelector(`value[name="${name}"]`)).not.toBeNull());
});
