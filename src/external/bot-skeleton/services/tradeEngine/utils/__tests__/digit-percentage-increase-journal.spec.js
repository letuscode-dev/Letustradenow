import { formatDigitPercentageIncreaseJournal as format } from '../digit-percentage-increase-journal';

it('clearly distinguishes a pending buy from a confirmed purchase', () => {
    const pending = format({ type: 'signal', status: 'submitted', timestamp: 1, barrier: 0, previousPercentage: 9.9,
        currentPercentage: 10, increase: 0.1, threshold: 0.1, windowSize: 1000, stake: 5 }, 'USD');
    expect(pending.message).toContain('BUY REQUEST SENT — awaiting Deriv confirmation');
    expect(pending.message).toContain('Digit: 0');
    expect(pending.message).toContain('Previous: 9.9% | Current: 10.0%');
    expect(pending.message).toContain('Increase: 0.1 percentage points');
    const confirmed = format({ type: 'purchase', contractId: 12, barrier: 0, duration: 1, stake: 5 }, 'USD');
    expect(confirmed.message).toContain('CONTRACT BOUGHT — confirmed by Deriv');
    expect(confirmed.message).toContain('Contract ID: 12');
});

it('explains when unavailable history falls back to collecting live ticks', () => {
    const result = format({ type: 'initial_tick_history_unavailable', reason: 'History failed; collecting live ticks instead' }, 'USD');
    expect(result.message).toContain('Digit Percentage Increase');
    expect(result.message).toContain('collecting live ticks instead');
});
