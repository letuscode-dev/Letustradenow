import {
    buildDigitOverProposal,
    buildDigitUnderProposal,
    canAffordBothLegs,
    DIGIT_HEDGE_CANCEL,
    DIGIT_HEDGE_OPEN,
    DIGIT_HEDGE_SKIP,
    hedgeDecision,
    hedgeMayContinue,
    hedgeNet,
    HEDGE_RECOVER,
    HEDGE_RESET,
    HEDGE_STOP,
    nextHedgeStake,
    planDigitHedgeBuys,
    deadDigitsDominate,
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

    it('hedges when 4 and 5 dominate the last five ticks', () => {
        expect(deadDigitsDominate([1, 2, 4, 5, 4])).toBe(true);
        expect(deadDigitsDominate([4, 5, 4, 5, 4])).toBe(true);
        expect(deadDigitsDominate([9, 8, 7, 4, 5, 4])).toBe(true);
        expect(deadDigitsDominate([4, 5, 1, 2, 3])).toBe(false);
        expect(deadDigitsDominate([4, 4, 1, 2, 3])).toBe(false);
        expect(deadDigitsDominate([4, 5, 4, 1])).toBe(false);
        expect(deadDigitsDominate([4, 5, null, 4, 1])).toBe(false);
        expect(deadDigitsDominate([4, 5, 1, 2], 4)).toBe(false);
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

describe('Over 5 / Under 4 hedge is both sides or neither', () => {
    it('does not buy when either quote is missing', () => {
        expect(
            planDigitHedgeBuys({
                over_quoted: true,
                under_quoted: false,
                over_contract_id: null,
                under_contract_id: null,
            }).action
        ).toBe(DIGIT_HEDGE_SKIP);
        expect(
            planDigitHedgeBuys({
                over_quoted: false,
                under_quoted: false,
                over_contract_id: 11,
                under_contract_id: null,
            })
        ).toMatchObject({ action: DIGIT_HEDGE_CANCEL, cancel_ids: [11] });
    });

    it('keeps the hedge only when both contract ids exist', () => {
        expect(
            planDigitHedgeBuys({
                over_quoted: true,
                under_quoted: true,
                over_contract_id: 11,
                under_contract_id: 22,
            })
        ).toEqual({
            action: DIGIT_HEDGE_OPEN,
            cancel_ids: [],
            over_contract_id: 11,
            under_contract_id: 22,
        });
    });

    it('cancels a single fill instead of keeping Over 5 or Under 4 alone', () => {
        expect(
            planDigitHedgeBuys({
                over_quoted: true,
                under_quoted: true,
                over_contract_id: 11,
                under_contract_id: null,
            })
        ).toEqual({ action: DIGIT_HEDGE_CANCEL, cancel_ids: [11] });
        expect(
            planDigitHedgeBuys({
                over_quoted: true,
                under_quoted: true,
                over_contract_id: null,
                under_contract_id: 22,
            })
        ).toEqual({ action: DIGIT_HEDGE_CANCEL, cancel_ids: [22] });
    });

    it('sends nothing when the balance cannot pay for both legs', () => {
        expect(canAffordBothLegs(1.5, 1, 1)).toBe(false);
        expect(canAffordBothLegs(2, 1, 1)).toBe(true);
        expect(canAffordBothLegs(undefined, 1, 1)).toBe(true);
    });
});

describe('Over 5 / Under 4 hedge stake', () => {
    const loss = (bought, multiplier = 2) =>
        nextHedgeStake({ bought, current: bought, initial: 1, multiplier, decision: HEDGE_RECOVER });

    it('doubles the stake that was bought when both sides lose', () => {
        expect(loss(1)).toBe(2);
        expect(loss(2)).toBe(4);
        expect(loss(4)).toBe(8);
        expect(loss(1.11)).toBe(2.22);
        expect(loss(1, 2)).toBe(nextHedgeStake({ bought: 1, current: 99, initial: 1, multiplier: 2, decision: HEDGE_RECOVER }));
    });

    it('does not double again when the next stake is read a second time', () => {
        const first = loss(1);
        const second = nextHedgeStake({
            bought: 1,
            current: first,
            initial: 1,
            multiplier: 2,
            decision: HEDGE_RECOVER,
        });
        expect(second).toBe(2);
    });

    it('returns to the set stake when one side wins, including a small net loss', () => {
        expect(nextHedgeStake({ bought: 4, current: 4, initial: 1, multiplier: 2, decision: HEDGE_RESET })).toBe(1);
    });

    it('leaves the stake unchanged and does not trade again when a side is missing', () => {
        expect(nextHedgeStake({ bought: 2, current: 2, initial: 1, multiplier: 2, decision: HEDGE_STOP })).toBe(2);
        expect(
            hedgeMayContinue({
                decision: HEDGE_STOP,
                next: 2,
                bought: 2,
                current: 2,
                multiplier: 2,
            })
        ).toBe(false);
    });

    it('trades again only when a loss stake is exactly the bought stake times the multiplier', () => {
        expect(
            hedgeMayContinue({
                decision: HEDGE_RECOVER,
                next: 2,
                bought: 1,
                current: 1,
                multiplier: 2,
            })
        ).toBe(true);
        expect(
            hedgeMayContinue({
                decision: HEDGE_RECOVER,
                next: 1,
                bought: 1,
                current: 1,
                multiplier: 2,
            })
        ).toBe(false);
        expect(
            hedgeMayContinue({
                decision: HEDGE_RESET,
                next: 1,
                bought: 4,
                current: 4,
                multiplier: 2,
            })
        ).toBe(true);
    });
});
