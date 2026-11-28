import { formatTripleHitJournal } from '../triple-hit-journal';

const format = event => formatTripleHitJournal(event, 'USD');

describe('Triple-Hit journal notifications', () => {
    it('describes an analysis and distinguishes a sent buy from confirmation', () => {
        const { message } = format({ type: 'signal', timestamp: 1, digits: [4, 7, 4, 2, 4, 9, 1, 4, 6, 4],
            frequencies: [0, 1, 1, 0, 5, 0, 1, 1, 0, 1], dominantDigit: 4, dominantCount: 5,
            latestDigit: 4, barrier: 4, entryPassed: true, status: 'submitted', stake: 5 });
        expect(message).toContain('BUY REQUEST SENT');
        expect(message).toContain('awaiting confirmation');
        expect(message).not.toContain('CONTRACT BOUGHT');
        expect(message).toContain('Last 10 digits: 4, 7, 4, 2, 4, 9, 1, 4, 6, 4');
        expect(message).toContain('Counts: 0:0 1:1 2:1 3:0 4:5 5:0 6:1 7:1 8:0 9:1');
        expect(message).toContain('Leader: 4 (5 times)');
        expect(message).toContain('1970-01-01 00:00:01 UTC');
    });

    it('makes a confirmed purchase and the selected barrier visible', () => {
        const notice = format({ type: 'purchase', contractId: 123, barrier: 0, stake: 5, duration: 1, confirmed: true });
        expect(notice.message).toContain('CONTRACT BOUGHT — confirmed by Deriv');
        expect(notice.message).toContain('Contract ID: 123');
        expect(notice.message).toContain('barrier: 0');
        expect(notice.message).toContain('Stake: 5 USD');
        expect(notice.message).toContain('Duration: 1 tick');
        expect(notice.message).toContain('See Transactions');
        expect(notice.className).toBe('journal__text--success');
    });

    it('shows an actual settlement, recovery amount and cumulative performance', () => {
        const notice = format({ type: 'settlement', contract_id: 123, signal: { barrier: 0 }, stake: 5, result: 'lost',
            payout: 0, profit: -5, inARow: 1, nextStake: 52.08, totalProfit: -5,
            statistics: { executedTrades: 1, wins: 0, losses: 1, winRate: 0, totalSignals: 10,
                skippedSignals: 9, unconfirmedPurchases: 0, maxConsecutiveLosses: 1 } });
        expect(notice.message).toContain('CONTRACT LOST — ID: 123');
        expect(notice.message).toContain('Payout: 0 USD');
        expect(notice.message).toContain('Profit/loss: -5 USD');
        expect(notice.message).toContain('Next stake: 52.08 USD');
        expect(notice.message).toContain('Trades: 1; wins: 0; losses: 1');
        expect(notice.className).toBe('journal__text--error');
    });

    it('explains skipped signals and uncertain purchases without claiming a trade was bought', () => {
        const skipped = format({ type: 'signal', digits: [], frequencies: Array(10).fill(0), entryPassed: true,
            status: 'skipped', reason: 'Previous contract is not settled' }).message;
        expect(skipped).toContain('SIGNAL SKIPPED — Previous contract is not settled');
        const unknown = format({ type: 'purchase_error', reason: 'Connection lost' }).message;
        expect(unknown).toContain('PURCHASE NOT CONFIRMED');
        expect(unknown).toContain('Check Transactions');
        expect(unknown).not.toContain('CONTRACT BOUGHT');
    });
});
