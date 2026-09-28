import {
    STATUS,
    createAscendingRankNextState,
    evaluateAscendingRankNext,
    normalizeAscendingRankNextOptions,
    rankDigitsAscending,
    replayAscendingRankNext,
} from '../ascending-rank-next-differ';

const WINDOW = 200;

const opts = (overrides = {}) =>
    normalizeAscendingRankNextOptions({
        analysis_window: WINDOW,
        signal_cooldown_tips: 0,
        journal_enabled: false,
        ...overrides,
    });

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

// Ascending: 9(11) < 4(14) < 0(16) < 7(18) < 2(19) < 6(21) < 1(23) < 8(24) < 3(26) < 5(28) = 200
const DISTINCT = { 0: 16, 1: 23, 2: 19, 3: 26, 4: 14, 5: 28, 6: 21, 7: 18, 8: 24, 9: 11 };

describe('ascending rank next digit differ', () => {
    it('defaults to a 1000-tick window', () => {
        expect(normalizeAscendingRankNextOptions({}).analysis_window).toBe(1000);
    });

    it('ranks digits by percentage ascending', () => {
        const ranked = rankDigitsAscending(buildWindow(DISTINCT, 0));
        expect(ranked.map(r => r.digit)).toEqual([9, 4, 0, 7, 2, 6, 1, 8, 3, 5]);
        expect(ranked[0].pct).toBeCloseTo(5.5);
    });

    it.each([
        [9, 4],
        [0, 7],
        [6, 1],
        [3, 5],
    ])('current %i → Differ the next stronger digit %i', (current, expected) => {
        const result = evaluateAscendingRankNext(
            buildWindow(DISTINCT, current),
            opts(),
            createAscendingRankNextState()
        );
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.prediction).toBe(expected);
        expect(result.contract_type).toBe('DIGITDIFF');
    });

    it('does not trade when the current digit is already the strongest', () => {
        const result = evaluateAscendingRankNext(buildWindow(DISTINCT, 5), opts(), createAscendingRankNextState());
        expect(result.status).toBe(STATUS.CURRENT_IS_STRONGEST);
        expect(result.matched).toBe(false);
    });

    it.each([2, 7])('skips when the current digit %i is tied with a neighbour', current => {
        const tie = { ...DISTINCT, 7: 19, 0: 15 }; // 7 ties 2 at 19
        const result = evaluateAscendingRankNext(buildWindow(tie, current), opts(), createAscendingRankNextState());
        expect(result.status).toBe(STATUS.RANK_TIED);
    });

    it('skips when the next rank is tied', () => {
        const tie = { ...DISTINCT, 7: 19, 0: 15 }; // 2 and 7 tied above 0
        const result = evaluateAscendingRankNext(buildWindow(tie, 0), opts(), createAscendingRankNextState());
        expect(result.status).toBe(STATUS.RANK_TIED);
    });

    it('calculates on a partial window instead of waiting for it to fill', () => {
        const result = evaluateAscendingRankNext(
            buildWindow(DISTINCT, 9),
            opts({ analysis_window: 1000 }),
            createAscendingRankNextState()
        );
        expect(result.prediction).toBe(4);
    });

    it('only waits while history is still loading (fewer than 100 ticks)', () => {
        const result = evaluateAscendingRankNext([1, 2, 3], opts(), createAscendingRankNextState());
        expect(result.status).toBe(STATUS.COLLECTING);
    });

    it('never re-trades a signal on a same-tip re-poll and settles on the next tick', () => {
        const state = createAscendingRankNextState();
        const ticks = buildWindow(DISTINCT, 9).map((digit, i) => ({ digit, epoch: i + 1 }));
        expect(evaluateAscendingRankNext(ticks, opts(), state).prediction).toBe(4);
        const repoll = evaluateAscendingRankNext(ticks, opts({ journal_enabled: true }), state);
        expect(repoll.status).toBe(STATUS.SIGNAL_CONSUMED);
        expect(repoll.journal_messages).toEqual([]);

        const n = ticks.length;
        evaluateAscendingRankNext([...ticks.slice(2), { digit: 4, epoch: n + 1 }, { digit: 8, epoch: n + 2 }], opts(), state);
        expect(state.live.losses).toBe(1);
    });

    it('replays with every target ranked above its current digit', () => {
        const history = [...buildWindow(DISTINCT, 9), 0, 6, 3, 1, 2];
        const report = replayAscendingRankNext(history, opts());
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.signals.every(s => s.target !== s.current)).toBe(true);
        expect(report.wins + report.losses).toBe(report.trades);
    });
});
