import { buildDigitUnderProposal, hedgeNet, shouldHedgeLastDigits } from '../digit-hedge';

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
    it('adds both settled profits', () => {
        expect(
            hedgeNet({
                over: { profit: 1.2 },
                under: { profit: -1 },
                under_bought: true,
            })
        ).toBe(0.2);
        expect(
            hedgeNet({
                over: { buy_price: 1, sell_price: 0 },
                under: { buy_price: 1, sell_price: 0 },
                under_bought: true,
            })
        ).toBe(-2);
    });

    it('uses only the Over leg when Under was not bought', () => {
        expect(hedgeNet({ over: { profit: -1 }, under: null, under_bought: false })).toBe(-1);
    });

    it('waits while a bought leg has no result yet', () => {
        expect(hedgeNet({ over: { profit: 1 }, under: null, under_bought: true })).toBeNull();
        expect(hedgeNet({ over: null, under: { profit: -1 }, under_bought: true })).toBeNull();
    });

    it('requests Under 4 with the same stake, symbol, and duration', () => {
        expect(
            buildDigitUnderProposal(
                { amount: 2, basis: 'stake', currency: 'USD', duration: 1, duration_unit: 't', symbol: '1HZ75V' },
                {}
            )
        ).toEqual({
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
