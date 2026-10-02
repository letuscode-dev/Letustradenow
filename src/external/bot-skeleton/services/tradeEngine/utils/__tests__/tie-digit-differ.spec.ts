import {
    createTieDigitState,
    evaluateTieDigit,
    findTiedDigits,
    normalizeTieDigitOptions,
    replayTieDigit,
    STATUS,
} from '../tie-digit-differ';

const WINDOW = 120;

const opts = (overrides = {}) =>
    normalizeTieDigitOptions({
        analysis_window: WINDOW,
        signal_cooldown_tips: 0,
        journal_enabled: false,
        ...overrides,
    });

/** Window with the given digit counts (summing to 120) that ends on `last_digit`. */
const buildWindow = (counts: Record<number, number>, last_digit: number) => {
    const remaining = { ...counts };
    remaining[last_digit] -= 1;
    const out: number[] = [];
    let added = true;
    while (added) {
        added = false;
        for (let d = 0; d <= 9; d++) {
            if ((remaining[d] || 0) > 0) {
                out.push(d);
                remaining[d] -= 1;
                added = true;
            }
        }
    }
    out.push(last_digit);
    return out;
};

// All counts distinct except 3 and 7 (both 14 → 11.67%). Sum = 120.
const PAIR: Record<number, number> = { 0: 5, 1: 8, 2: 10, 3: 14, 4: 11, 5: 12, 6: 13, 7: 14, 8: 16, 9: 17 };

describe('tie digit differ', () => {
    it('defaults to a 120-tick window and cooldown 1', () => {
        const o = normalizeTieDigitOptions({});
        expect(o.analysis_window).toBe(120);
        expect(o.signal_cooldown_tips).toBe(1);
        expect(normalizeTieDigitOptions({ analysis_window: 300 }).analysis_window).toBe(300);
    });

    it('finds digits whose count equals the current digit', () => {
        expect(findTiedDigits([1, 2, 2, 3, 0, 0, 0, 0, 0, 0], 1)).toEqual([2]);
        expect(findTiedDigits([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4)).toEqual([]);
    });

    it('Differs the other digit when the current digit ties with exactly one digit', () => {
        const hit = evaluateTieDigit(buildWindow(PAIR, 3), opts(), createTieDigitState());
        expect(hit.status).toBe(STATUS.VALID_SIGNAL);
        expect(hit.prediction).toBe(7);
        expect(hit.contract_type).toBe('DIGITDIFF');

        const mirrored = evaluateTieDigit(buildWindow(PAIR, 7), opts(), createTieDigitState());
        expect(mirrored.prediction).toBe(3);
    });

    it('does not trade when the current digit has no tie', () => {
        const result = evaluateTieDigit(buildWindow(PAIR, 8), opts(), createTieDigitState());
        expect(result.status).toBe(STATUS.NO_TIE);
        expect(result.prediction).toBe(-1);
    });

    it('does not trade when the current digit ties with two or more digits', () => {
        const triple = { ...PAIR, 2: 14, 8: 12 }; // 2, 3 and 7 all 14
        const result = evaluateTieDigit(buildWindow(triple, 3), opts(), createTieDigitState());
        expect(result.status).toBe(STATUS.MULTIPLE_TIES);
        expect(result.tied).toEqual([2, 7]);
        expect(result.prediction).toBe(-1);
    });

    it('waits until the full window is loaded', () => {
        const result = evaluateTieDigit([3, 7, 3, 7], opts(), createTieDigitState());
        expect(result.status).toBe(STATUS.COLLECTING);
        expect(result.prediction).toBe(-1);
    });

    it('does not re-trade the same tick on re-poll and settles on the next tick', () => {
        const state = createTieDigitState();
        const ticks = buildWindow(PAIR, 3).map((digit, i) => ({ digit, epoch: i + 1 }));
        expect(evaluateTieDigit(ticks, opts(), state).matched).toBe(true);
        const repoll = evaluateTieDigit(ticks, opts(), state);
        expect(repoll.status).toBe(STATUS.SIGNAL_CONSUMED);
        expect(repoll.matched).toBe(false);

        const next = [...ticks.slice(1), { digit: 7, epoch: ticks.length + 1 }];
        evaluateTieDigit(next, opts(), state);
        expect(state.live.losses).toBe(1);
    });

    it('respects the signal cooldown', () => {
        const state = createTieDigitState();
        const ticks = buildWindow(PAIR, 3).map((digit, i) => ({ digit, epoch: i + 1 }));
        evaluateTieDigit(ticks, opts({ signal_cooldown_tips: 1 }), state);
        // Drop a 3, add a 3 → counts unchanged, current still 3 and tied with 7.
        const first_three = ticks.findIndex(t => t.digit === 3);
        const next = [...ticks.slice(0, first_three), ...ticks.slice(first_three + 1), { digit: 3, epoch: 999 }];
        const result = evaluateTieDigit(next, opts({ signal_cooldown_tips: 1 }), state);
        expect(result.status).toBe(STATUS.COOLDOWN_ACTIVE);
    });

    it('replays history without look-ahead', () => {
        const history = [...buildWindow(PAIR, 3), 1, 2, 3, 4];
        const report = replayTieDigit(history, opts());
        expect(report.total_ticks).toBe(history.length);
        expect(report.valid_signals).toBeGreaterThanOrEqual(1);
        expect(report.trades).toBeLessThanOrEqual(report.valid_signals);
    });
});
