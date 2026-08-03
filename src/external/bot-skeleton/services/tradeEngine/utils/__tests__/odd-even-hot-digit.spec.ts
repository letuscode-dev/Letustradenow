import {
    SIDE_EVEN,
    SIDE_ODD,
    SIDE_NONE,
    PHASE_WAIT_OPPOSITE,
    PHASE_TRADING,
    PHASE_RECOVERY,
    PHASE_IDLE,
    computeDigitPercentages,
    findHotParitySignal,
    evaluateSymbolOddEvenHotDigit,
    pickBestHotDigitMatch,
    createOddEvenHotDigitState,
    armOddEvenHotDigitCycle,
    advanceOppositeStreak,
    decideOddEvenHotDigitAction,
    applyOddEvenHotDigitTradeResult,
    releaseStaleOddEvenCommit,
} from '../odd-even-hot-digit';

const buildDigitsWithHotOdds = () => {
    // Force odd digits 1,3,5 each well above 10.4% in 100 ticks.
    // 15 each of 1,3,5 = 45; rest even-ish filler not enough for 3 evens at 10.4%.
    const digits = [];
    for (let i = 0; i < 15; i++) digits.push(1, 3, 5);
    for (let i = 0; i < 55; i++) digits.push(0);
    return digits; // 100 ticks
};

describe('computeDigitPercentages / findHotParitySignal', () => {
    it('flags ≥3 odd digits at ≥10.4%', () => {
        const digits = buildDigitsWithHotOdds();
        const { percentages, total } = computeDigitPercentages(digits, 100);
        expect(total).toBe(100);
        expect(percentages[1]).toBe(15);
        expect(percentages[3]).toBe(15);
        expect(percentages[5]).toBe(15);

        const signal = findHotParitySignal(percentages, 10.4, 3);
        expect(signal.matched).toBe(true);
        expect(signal.side).toBe('odd');
        expect(signal.hot_digits).toEqual(expect.arrayContaining([1, 3, 5]));
    });

    it('flags ≥3 even digits at ≥10.4%', () => {
        const digits = [];
        for (let i = 0; i < 15; i++) digits.push(0, 2, 4);
        for (let i = 0; i < 55; i++) digits.push(1);
        const { percentages } = computeDigitPercentages(digits, 100);
        const signal = findHotParitySignal(percentages, 10.4, 3);
        expect(signal.matched).toBe(true);
        expect(signal.side).toBe('even');
    });

    it('requires full lookback before matching a symbol', () => {
        const digits = buildDigitsWithHotOdds().slice(0, 50);
        const result = evaluateSymbolOddEvenHotDigit('1HZ75V', digits, {
            lookback: 100,
            min_digit_pct: 10.4,
            min_hot_digits: 3,
        });
        expect(result.matched).toBe(false);
        expect(result.reason).toContain('insufficient_history');
    });
});

describe('pickBestHotDigitMatch', () => {
    it('picks the highest score among ready matches', () => {
        const a = evaluateSymbolOddEvenHotDigit('1HZ10V', buildDigitsWithHotOdds(), {
            lookback: 100,
        });
        const even_digits = [];
        for (let i = 0; i < 20; i++) even_digits.push(0, 2, 4);
        for (let i = 0; i < 40; i++) even_digits.push(1);
        const b = evaluateSymbolOddEvenHotDigit('1HZ75V', even_digits, { lookback: 100 });
        const best = pickBestHotDigitMatch([a, b]);
        expect(best).toBeTruthy();
        expect(['1HZ10V', '1HZ75V']).toContain(best.symbol);
    });
});

describe('cycle: wait opposite → trades → recovery', () => {
    it('waits for 3 consecutive opposite digits then trades', () => {
        const state = createOddEvenHotDigitState();
        armOddEvenHotDigitCycle(state, {
            matched: true,
            side: 'odd',
            symbol: '1HZ75V',
            hot_digits: [1, 3, 5],
        });
        expect(state.phase).toBe(PHASE_WAIT_OPPOSITE);

        advanceOppositeStreak(state, 0, 'e1', 3); // even
        advanceOppositeStreak(state, 2, 'e2', 3);
        expect(state.phase).toBe(PHASE_WAIT_OPPOSITE);
        advanceOppositeStreak(state, 4, 'e3', 3);
        expect(state.phase).toBe(PHASE_TRADING);

        const action = decideOddEvenHotDigitAction(state, {
            opposite_streak: 3,
            martingale_multiplier: 2,
        });
        expect(action.should_trade).toBe(true);
        expect(action.side_code).toBe(SIDE_ODD);
        expect(action.stake_multiplier).toBe(1);
        expect(state.trade_committed).toBe(true);
    });

    it('resets opposite streak when broken', () => {
        const state = createOddEvenHotDigitState();
        armOddEvenHotDigitCycle(state, {
            matched: true,
            side: 'even',
            symbol: 'R_75',
            hot_digits: [0, 2, 4],
        });
        advanceOppositeStreak(state, 1, 't1', 3);
        advanceOppositeStreak(state, 3, 't2', 3);
        advanceOppositeStreak(state, 0, 't3', 3); // favored even breaks streak
        expect(state.opposite_count).toBe(0);
        expect(state.phase).toBe(PHASE_WAIT_OPPOSITE);
    });

    it('after max trades loss, issues martingale recovery then stops', () => {
        const state = createOddEvenHotDigitState();
        armOddEvenHotDigitCycle(state, {
            matched: true,
            side: 'odd',
            symbol: '1HZ50V',
            hot_digits: [1, 3, 5],
        });
        state.phase = PHASE_TRADING;

        for (let i = 0; i < 5; i++) {
            decideOddEvenHotDigitAction(state, { max_trades: 5, martingale_multiplier: 2 });
            applyOddEvenHotDigitTradeResult(state, {
                is_loss: true,
                max_trades: 5,
                contract_id: `c${i}`,
            });
        }
        expect(state.phase).toBe(PHASE_RECOVERY);

        const recovery = decideOddEvenHotDigitAction(state, {
            martingale_multiplier: 2,
        });
        expect(recovery.should_trade).toBe(true);
        expect(recovery.stake_multiplier).toBe(2);
        expect(recovery.side_code).toBe(SIDE_ODD);

        applyOddEvenHotDigitTradeResult(state, {
            is_loss: false,
            max_trades: 5,
            contract_id: 'rec1',
        });
        expect(state.phase).toBe(PHASE_IDLE);
        expect(decideOddEvenHotDigitAction(state).side_code).toBe(SIDE_NONE);
    });

    it('after max trades win, returns to idle without recovery', () => {
        const state = createOddEvenHotDigitState();
        armOddEvenHotDigitCycle(state, {
            matched: true,
            side: 'even',
            symbol: '1HZ10V',
            hot_digits: [0, 2, 4],
        });
        state.phase = PHASE_TRADING;

        for (let i = 0; i < 4; i++) {
            decideOddEvenHotDigitAction(state, {});
            applyOddEvenHotDigitTradeResult(state, {
                is_loss: true,
                max_trades: 5,
                contract_id: `l${i}`,
            });
        }
        decideOddEvenHotDigitAction(state, {});
        applyOddEvenHotDigitTradeResult(state, {
            is_loss: false,
            max_trades: 5,
            contract_id: 'win5',
        });
        expect(state.phase).toBe(PHASE_IDLE);
    });

    it('releases stale commit', () => {
        const state = createOddEvenHotDigitState();
        state.phase = PHASE_TRADING;
        state.favored = 'odd';
        decideOddEvenHotDigitAction(state, {});
        expect(state.trade_committed).toBe(true);
        expect(releaseStaleOddEvenCommit(state, 20000)).toBe(false);
        state.signal_issued_at = Date.now() - 25000;
        expect(releaseStaleOddEvenCommit(state, 20000)).toBe(true);
        expect(state.trade_committed).toBe(false);
    });
});
