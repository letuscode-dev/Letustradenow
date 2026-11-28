import { DIGIT_PERCENTAGE_INCREASE_XML } from '../bots/digit-percentage-increase';

it('loads the requested window strategy with configurable risk controls', () => {
    const doc = new DOMParser().parseFromString(DIGIT_PERCENTAGE_INCREASE_XML, 'text/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('field[name="SYMBOL_LIST"]')?.textContent).toBe('1HZ75V');
    expect(doc.querySelector('field[name="TYPE_LIST"]')?.textContent).toBe('DIGITDIFF');
    expect(doc.querySelector('field[name="DURATIONTYPE_LIST"]')?.textContent).toBe('t');
    expect(doc.querySelector('value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
    const values = [...doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="variables_set"]')];
    const initial = (id: string) => values.find(block => block.querySelector(':scope > field[name="VAR"]')?.getAttribute('id') === id)
        ?.querySelector(':scope > value[name="VALUE"] field[name="NUM"]')?.textContent;
    expect(Number(initial('dpi_increase'))).toBe(0.1);
    expect(Number(initial('dpi_stake'))).toBe(5);
    expect(Number(initial('dpi_losses'))).toBe(2);
    expect(Number(initial('dpi_target'))).toBe(10);
    expect(Number(initial('dpi_stop_loss'))).toBe(50);
    expect(Number(initial('dpi_recovery'))).toBe(100 / 9.6);
    const run = doc.querySelector('block[type="digit_percentage_increase_run"]');
    expect(run).not.toBeNull();
    ['INCREASE', 'STAKE', 'LOSSES', 'TARGET', 'STOP_LOSS', 'RECOVERY'].forEach(name =>
        expect(run?.querySelector(`value[name="${name}"]`)).not.toBeNull());
});
