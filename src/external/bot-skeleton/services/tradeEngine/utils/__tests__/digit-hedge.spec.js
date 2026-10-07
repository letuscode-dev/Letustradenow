import {
    buildDigitOverProposal,
    buildDigitUnderProposal,
    hedgeDecision,
    hedgeNet,
    HEDGE_RECOVER,
    HEDGE_RESET,
    HEDGE_STOP,
    shouldHedgeLastDigits,
} from '../digit-hedge';

describe('Over 5 / Under 4 hedge entry', () => {
    it('hedges when exactly one of the last two digits is 4 or 5', () => {
        expect(shouldHedgeLastDigits(4, 6)).toBe(true);
        expect(shouldHedgeLastDigits(6, 4)).toBe(true);
        expect(shouldHedgeLastDigits(5, 0)).toBe(true);
        expect(shouldHedgeLastDigits(1, 5)).toBe(true);
        expect(shouldHedgeLastDigits(9, 4)).toBe(true);
        expect(shouldHedgeLastDigits(5, 8)).toBe(true);
    });

    it('skips 4-4, 5-5, and 4-5 in either order', () => {
        expect(shouldHedgeLastDigits(4, 4)).toBe(false);
        expect(shouldHedgeLastDigits(5, 5)).toBe(false);
        expect(shouldHedgeLastDigits(4, 5)).toBe(false);
        expect(shouldHedgeLastDigits(5, 4)).toBe(false);
    });

    it('skips pairs that contain neither 4 nor 5, and incomplete digits', () => {
        expect(shouldHedgeLastDigits(1, 2)).toBe(false);
        expect(shouldHedgeLastDigits(7, 9)).toBe(false);
        expect(shouldHedgeLastDigits(0, 3)).toBe(false);
        expect(shouldHedgeLastDigits(4, undefined)).toBe(false);
        expect(shouldHedgeLastDigits(null, 5)).toBe(false);
    });
});

describe('Over 5 / Under 4 hedge result', () => {
    const settled = contract => ({ is_sold: true, ...contract });

    it('adds both settled profits', () => {
        const legs = {
            over: settled({ profit: 1.2 }),
            under: settled({ profit: -1 }),
            under_bought: true,
        };
        expect(hedgeNet(legs)).toBe(0.2);
        expect(hedgeDecision(legs)).toBe(HEDGE_RESET);
        expect(
            hedgeNet({
                over: settled({ buy_price: 1, sell_price: 0 }),
                under: settled({ buy_price: 1, sell_price: 0 }),
                under_bought: true,
            })
        ).toBe(-2);
    });

    it('multiplies only when both sides lose, and resets when one side wins at a small net loss', () => {
        const both_lost = {
            over: settled({ profit: -1 }),
            under: settled({ profit: -1 }),
            under_bought: true,
        };
        expect(hedgeDecision(both_lost)).toBe(HEDGE_RECOVER);
        const spread_loss = {
            over: settled({ profit: 0.8 }),
            under: settled({ profit: -1 }),
            under_bought: true,
        };
        expect(hedgeNet(spread_loss)).toBe(-0.2);
        expect(hedgeDecision(spread_loss)).toBe(HEDGE_RESET);
    });

    it('stops when a side is missing or not settled', () => {
        expect(hedgeNet({ over: settled({ profit: -1 }), under: null, under_bought: false })).toBeNull();
        expect(hedgeDecision({ over: settled({ profit: -1 }), under: null, under_bought: false })).toBe(HEDGE_STOP);
        expect(hedgeNet({ over: { profit: 1 }, under: settled({ profit: -1 }), under_bought: true })).toBeNull();
        expect(hedgeDecision({ over: settled({ profit: 1 }), under: null, under_bought: true })).toBe(HEDGE_STOP);
    });

    it('quotes Over 5 and Under 4 with the same stake, symbol, and duration', () => {
        const trade = { amount: 2, basis: 'stake', currency: 'USD', duration: 1, duration_unit: 't', symbol: '1HZ75V' };
        expect(buildDigitOverProposal(trade)).toMatchObject({
            contract_type: 'DIGITOVER',
            barrier: '5',
            amount: 2,
            underlying_symbol: '1HZ75V',
        });
        expect(buildDigitUnderProposal(trade)).toEqual({
            proposal: 1,
            amount: 2,
            basis: 'stake',
            contract_type: 'DIGITUNDER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            underlying_symbol: '1HZ75V',
            barrier: '4',
        });
    });
});
