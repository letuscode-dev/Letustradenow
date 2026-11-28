import { formatLeastDigitDecreaseJournal } from '../least-digit-decrease-journal';

it('clearly distinguishes a buy request from a confirmed purchase and identifies the market', () => {
    const signal = { type: 'signal', status: 'submitted', symbol: 'R_10', barrier: 0, previousPercentage: 8.1,
        currentPercentage: 8, decrease: 0.1, windowSize: 1000, stake: 5 };
    expect(formatLeastDigitDecreaseJournal(signal, 'USD').message).toContain('BUY REQUEST SENT');
    expect(formatLeastDigitDecreaseJournal(signal, 'USD').message).toContain('R_10');
    const purchase = formatLeastDigitDecreaseJournal({ type: 'purchase', signal, contractId: 123, barrier: 0, stake: 5, duration: 1 }, 'USD');
    expect(purchase.message).toContain('CONTRACT BOUGHT');
    expect(purchase.message).toContain('R_10');
});
