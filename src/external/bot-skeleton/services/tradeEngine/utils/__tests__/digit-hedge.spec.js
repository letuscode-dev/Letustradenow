import {
    applyHedgeLimits,
    buildDigitOverProposal,
    buildDigitUnderProposal,
    canAffordBothLegs,
    DIGIT_HEDGE_CANCEL,
    DIGIT_HEDGE_OPEN,
    DIGIT_HEDGE_SKIP,
    hedgeDecision,
    hedgeLimitCode,
    hedgeMayContinue,
    hedgeNet,
    HEDGE_LIMIT_NONE,
    HEDGE_LIMIT_STOP_LOSS,
    HEDGE_LIMIT_TAKE_PROFIT,
    HEDGE_RECOVER,
    HEDGE_RESET,
    HEDGE_STOP,
    nextHedgeStake,
    hedgeEntryPrice,
    hedgeExitPrice,
    hedgeTicksDiffer,
    parseDigitBarrier,
    resolveHedgeBarriers,
    planDigitHedgeBuys,
    sameHedgeClock,
    armImmediateRecovery,
    deadDigitCount,
    deadDigitsDominate,
    evaluateQuietGap,
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

    it('counts 4 and 5 in the newest window only', () => {
        expect(deadDigitCount([9, 8, 7, 4, 5, 4], 5)).toBe(3);
        expect(deadDigitCount([4, 5, 1, 2, 3], 5)).toBe(2);
        expect(deadDigitCount([1, 2], 5)).toBe(0);
    });

    it('uses any Over and Under barriers, and defaults to 5 and 4', () => {
        expect(deadDigitsDominate([2, 3, 7, 9, 1], 5, 7, 2)).toBe(true);
        expect(deadDigitsDominate([8, 9, 0, 1, 8], 5, 7, 2)).toBe(false);
        expect(deadDigitCount([9, 8, 2, 5, 7], 5, 7, 2)).toBe(3);
        expect(deadDigitsDominate([0, 1, 2, 3, 4], 5, 4, 5)).toBe(false);
        expect(parseDigitBarrier(0)).toBe(0);
        expect(parseDigitBarrier('9')).toBe(9);
        expect(parseDigitBarrier(10)).toBeNull();
        expect(parseDigitBarrier(-1)).toBeNull();
        expect(parseDigitBarrier(4.5)).toBeNull();
        expect(resolveHedgeBarriers()).toEqual({ over: 5, under: 4 });
        expect(resolveHedgeBarriers({ over: undefined, under: undefined })).toEqual({ over: 5, under: 4 });
        expect(resolveHedgeBarriers({ over: 8, under: 1 })).toEqual({ over: 8, under: 1 });
        expect(
            resolveHedgeBarriers({ over: undefined, under: undefined, fallbackOver: 7, fallbackUnder: 2 })
        ).toEqual({ over: 7, under: 2 });
        expect(resolveHedgeBarriers({ over: 'nope', under: 15, fallbackOver: 6, fallbackUnder: 3 })).toEqual({
            over: 6,
            under: 3,
        });
    });

    it('arms an immediate hedge only after both sides lose and the option is on', () => {
        expect(armImmediateRecovery({ decision: HEDGE_RECOVER, enabled: 1 })).toBe(true);
        expect(armImmediateRecovery({ decision: HEDGE_RECOVER, enabled: 0 })).toBe(false);
        expect(armImmediateRecovery({ decision: HEDGE_RESET, enabled: 1 })).toBe(false);
        expect(armImmediateRecovery({ decision: HEDGE_STOP, enabled: 1 })).toBe(false);
        expect(armImmediateRecovery({ decision: HEDGE_RECOVER, enabled: '1' })).toBe(true);
    });

    it('buys Over 5 and Under 4 only when the last ticks have no 4 or 5', () => {
        expect(evaluateQuietGap([1, 2, 3]).trade).toBe(true);
        expect(evaluateQuietGap([6, 7, 8, 9], 3)).toMatchObject({ trade: true, last: 9, gapCount: 0, window: 3 });
        expect(evaluateQuietGap([1, 2, 4]).trade).toBe(false);
        expect(evaluateQuietGap([4, 1, 2]).trade).toBe(false);
        expect(evaluateQuietGap([8, 4, 7]).trade).toBe(false);
        expect(evaluateQuietGap([1, 2, 5]).trade).toBe(false);
        expect(evaluateQuietGap([1, 4, 2, 3], 3).trade).toBe(false);
        expect(evaluateQuietGap([4, 1], 1)).toMatchObject({ trade: true, last: 1, window: 1 });
        expect(evaluateQuietGap([1, 4], 1).trade).toBe(false);
        expect(evaluateQuietGap([7], 3)).toMatchObject({ trade: false, ready: false, have: 1, window: 3 });
        expect(evaluateQuietGap([1, 2, Number.NaN]).trade).toBe(false);
        expect(evaluateQuietGap([8, 7, 6], 0).window).toBe(3);
        expect(evaluateQuietGap([8, 7, 6]).trade).toBe(true);
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

    it('keeps Over 5 and Under 4 only when they share one entry tick and one exit tick', () => {
        const tick = { date_start: 1700000000, date_expiry: 1700000001 };
        expect(sameHedgeClock(tick, { ...tick })).toBe(true);
        expect(sameHedgeClock(tick, { date_start: 1700000001, date_expiry: 1700000002 })).toBe(false);
        expect(sameHedgeClock({ date_start: 1700000000 }, { date_expiry: 1700000001 })).toBe(false);
        expect(sameHedgeClock({ start_time: 1700000000 }, { start_time: '1700000000' })).toBe(true);
        expect(
            sameHedgeClock(
                { date_start: 1700000000, entry_spot: '4521.31', exit_tick: '4521.48' },
                { date_start: 1700000000, entry_spot: 4521.31, exit_tick: 4521.48 }
            )
        ).toBe(true);
        expect(
            sameHedgeClock(
                { date_start: 1700000000, entry_spot: '4521.31', exit_tick: '4521.48' },
                { date_start: 1700000000, entry_spot: '4521.55', exit_tick: '4521.70' }
            )
        ).toBe(false);
        expect(hedgeEntryPrice({ entry_tick: 4, entry_spot: '4521.31' })).toBe(4521.31);
        expect(hedgeExitPrice({ exit_tick: 7 })).toBeNull();
        expect(
            hedgeTicksDiffer(
                { entry_spot: '4521.31', exit_tick: '4521.48' },
                { entry_spot: '4521.55', exit_tick: '4521.70' }
            )
        ).toBe(true);
        expect(
            hedgeTicksDiffer(
                { entry_spot: '4521.31', exit_tick: '4521.48' },
                { entry_spot: '4521.31', exit_tick: '4521.48' }
            )
        ).toBe(false);
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
        expect(buildDigitOverProposal(trade, 0).barrier).toBe('0');
        expect(buildDigitUnderProposal(trade, 9).barrier).toBe('9');
        expect(buildDigitOverProposal(trade, 7).barrier).toBe('7');
        expect(buildDigitUnderProposal(trade, 2).barrier).toBe('2');
        expect(buildDigitOverProposal(trade, 15).barrier).toBe('5');
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
        expect(canAffordBothLegs(undefined, 1, 1)).toBe(false);
        expect(canAffordBothLegs('', 1, 1)).toBe(false);
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

describe('Over 5 / Under 4 hedge take profit', () => {
    it('stops when the combined profit reaches the target, including a fractional cent', () => {
        expect(applyHedgeLimits({ total: 9.5, profit: 0.4, takeProfit: 10, stopLoss: 50 })).toEqual({
            total: 9.9,
            action: HEDGE_LIMIT_NONE,
        });
        expect(applyHedgeLimits({ total: 9.99, profit: 0.006, takeProfit: 10, stopLoss: 50 })).toEqual({
            total: 10,
            action: HEDGE_LIMIT_TAKE_PROFIT,
        });
        expect(hedgeLimitCode(HEDGE_LIMIT_TAKE_PROFIT)).toBe(1);
    });

    it('adds numeric strings instead of joining them, so 9.50 is not treated as past 10', () => {
        expect(applyHedgeLimits({ total: '9.50', profit: '0.40', takeProfit: '10', stopLoss: '50' })).toEqual({
            total: 9.9,
            action: HEDGE_LIMIT_NONE,
        });
        expect(applyHedgeLimits({ total: '9.50', profit: '0.50', takeProfit: '10', stopLoss: '50' }).action).toBe(
            HEDGE_LIMIT_TAKE_PROFIT
        );
    });

    it('stops at stop loss on the combined total and keeps trading above it', () => {
        expect(applyHedgeLimits({ total: -49.4, profit: -0.5, takeProfit: 10, stopLoss: 50 })).toEqual({
            total: -49.9,
            action: HEDGE_LIMIT_NONE,
        });
        expect(applyHedgeLimits({ total: -49.6, profit: -0.4, takeProfit: 10, stopLoss: 50 })).toEqual({
            total: -50,
            action: HEDGE_LIMIT_STOP_LOSS,
        });
        expect(hedgeLimitCode(HEDGE_LIMIT_STOP_LOSS)).toBe(-1);
        expect(hedgeLimitCode(HEDGE_LIMIT_NONE)).toBe(0);
    });

    it('reaches take profit from a run of combined hedge results', () => {
        const profits = [0.35, -0.1, 3.2, 4.1, 2.5];
        const booked = profits.reduce(
            (state, profit) => applyHedgeLimits({ total: state.total, profit, takeProfit: 10, stopLoss: 50 }),
            { total: 0, action: HEDGE_LIMIT_NONE }
        );
        expect(booked.total).toBe(10.05);
        expect(booked.action).toBe(HEDGE_LIMIT_TAKE_PROFIT);
    });
});
