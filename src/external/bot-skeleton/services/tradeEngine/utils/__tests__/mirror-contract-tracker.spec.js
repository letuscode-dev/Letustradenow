import { createMirrorContractTracker, registerMirrorPurchase, recordMirrorSettlement } from '../mirror-contract-tracker';

describe('mirror contract tracking', () => {
    const signal = barrier => ({ barrier });
    const buy = (id, price = 5) => ({ buy: { contract_id: id, buy_price: price } });

    it('only tracks confirmed purchases with a valid barrier and actual buy price', () => {
        const tracker = createMirrorContractTracker();
        expect(registerMirrorPurchase(tracker, signal(4), {})).toBe(false);
        expect(registerMirrorPurchase(tracker, signal(4), buy(1, null))).toBe(false);
        expect(registerMirrorPurchase(tracker, signal(10), buy(1))).toBe(false);
        expect(registerMirrorPurchase(tracker, signal(4), buy(1))).toBe(true);
        expect(registerMirrorPurchase(tracker, signal(4), buy(1))).toBe(false);
    });

    it('records independent settlements once, only after full settlement', () => {
        const tracker = createMirrorContractTracker();
        registerMirrorPurchase(tracker, signal(4), buy(1));
        registerMirrorPurchase(tracker, signal(7), buy(2, 10));
        expect(recordMirrorSettlement(tracker, { contract_id: 2, status: 'open' })).toBeNull();
        expect(recordMirrorSettlement(tracker, { contract_id: 2, status: 'won', sell_price: 11 })).toBeNull();
        const second = recordMirrorSettlement(tracker, { contract_id: 2, status: 'won', sell_price: 11, profit: 1 });
        expect(second).toMatchObject({ contract_id: 2, stake: 10, signal: { barrier: 7 }, result: 'won', payout: 11, profit: 1 });
        const first = recordMirrorSettlement(tracker, { contract_id: 1, status: 'lost', sell_price: 0, profit: -5 });
        expect(first).toMatchObject({ contract_id: 1, stake: 5, signal: { barrier: 4 }, result: 'lost', payout: 0, profit: -5 });
        expect(recordMirrorSettlement(tracker, { contract_id: 1, status: 'lost', sell_price: 0, profit: -5 })).toBeNull();
        expect(registerMirrorPurchase(tracker, signal(4), buy(1))).toBe(false);
    });
});
