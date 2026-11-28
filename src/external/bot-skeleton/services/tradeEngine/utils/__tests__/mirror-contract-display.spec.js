import { mirrorContractForDisplay } from '../mirror-contract-display';

describe('mirror contract display', () => {
    const base = { account: 'A', currency: 'USD', buy: { contract_id: 11, transaction_id: 101, buy_price: 0.62 },
        signal: { barrier: 6, timestamp: 1795810210 } };

    it('shows a confirmed buy while leaving its result pending', () => {
        expect(mirrorContractForDisplay(base)).toMatchObject({ accountID: 'A', contract_id: 11,
            transaction_ids: { buy: 101 }, status: 'open', buy_price: 0.62, barrier: 6, tick_count: 1, date_start: null });
    });

    it('uses the actual purchase time when it is supplied', () => {
        const result = mirrorContractForDisplay({ ...base, buy: { ...base.buy, start_time: 1795810211 } });
        expect(result.date_start).toBe(1795810211);
    });

    it('uses the actual settled profit and sell price, preserving the buy transaction id', () => {
        const result = mirrorContractForDisplay({ ...base, contract: { contract_id: 11, status: 'won',
            transaction_ids: { sell: 102 }, sell_price: '0.67', profit: '0.05' } });
        expect(result).toMatchObject({ status: 'won', is_sold: 1, payout: 0.67, profit: 0.05,
            transaction_ids: { buy: 101, sell: 102 } });
    });

    it('does not display an unconfirmed result as complete', () => {
        const result = mirrorContractForDisplay({ ...base, contract: { status: 'won', is_expired: 1, profit: 0.05 } });
        expect(result).toMatchObject({ status: 'open', is_sold: 0, is_expired: 0 });
        expect(result.profit).toBeUndefined();
    });
});
