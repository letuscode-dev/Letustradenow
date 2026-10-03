import {
    analyzeHighLowTie,
    breakTie,
    createHighLowTieState,
    evaluateHighLowTie,
    normalizeHighLowTieOptions,
    replayHighLowTie,
    STATUS,
} from '../high-low-tie-differ';

type Counts = Record<number, number>;

/** Window with exact per-digit counts whose final digits are `tail` (tail is part of the counts). */
const buildWindow = (counts: Counts, tail: number[]) => {
    const remaining = { ...counts };
    tail.forEach(d => {
        remaining[d] -= 1;
    });
    const prefix: number[] = [];
    for (let d = 0; d <= 9; d++) {
        for (let i = 0; i < (remaining[d] ?? 0); i++) prefix.push(d);
    }
    return [...prefix, ...tail];
};

const opts = (overrides = {}) =>
    normalizeHighLowTieOptions({
        analysis_window: 100,
        recent_window: 5,
        micro_window: 3,
        tie_tolerance: 0,
        mode: 'AUTO',
        signal_cooldown_tips: 1,
        journal_enabled: false,
        ...overrides,
    });

// HIGH tie 3 & 6 at 14%, unique lowest 0.
const HIGH: Counts = { 0: 4, 1: 6, 2: 7, 3: 14, 4: 9, 5: 10, 6: 14, 7: 11, 8: 12, 9: 13 };
// LOW tie 4 & 9 at 5%, unique highest 3.
const LOW: Counts = { 0: 10, 1: 10, 2: 11, 3: 16, 4: 5, 5: 11, 6: 10, 7: 11, 8: 11, 9: 5 };
// HIGH tie 3 & 6 at 14% and LOW tie 4 & 9 at 5%.
const BOTH: Counts = { 0: 10, 1: 10, 2: 10, 3: 14, 4: 5, 5: 11, 6: 14, 7: 11, 8: 10, 9: 5 };

describe('High-Low Tie Differs', () => {
    it('normalizes options with the documented defaults and limits', () => {
        const o = normalizeHighLowTieOptions({});
        expect(o).toMatchObject({
            analysis_window: 200,
            recent_window: 20,
            micro_window: 10,
            tie_tolerance: 0,
            mode: 'AUTO',
            signal_cooldown_tips: 1,
        });
        expect(normalizeHighLowTieOptions({ analysis_window: 50 }).analysis_window).toBe(100);
        expect(normalizeHighLowTieOptions({ recent_window: 8, micro_window: 30 }).micro_window).toBe(8);
        expect(normalizeHighLowTieOptions({ mode: 'high tie' }).mode).toBe('HIGH');
        expect(normalizeHighLowTieOptions({ mode: 'LOW TIE' }).mode).toBe('LOW');
    });

    it('HIGH TIE: picks the candidate with the higher Recent Window occurrence', () => {
        const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3, 6, 2]), opts({ mode: 'HIGH' }));
        expect(a.high.digits).toEqual([3, 6]);
        expect(a.high.pct_max).toBeCloseTo(14);
        expect(a.target).toBe(3);
        expect(a.target_type).toBe('HIGH');
        expect(a.target_reason).toContain('Recent window');
    });

    it('LOW TIE: picks the candidate with the higher Recent Window occurrence', () => {
        const a = analyzeHighLowTie(buildWindow(LOW, [9, 1, 9, 2, 4]), opts({ mode: 'LOW' }));
        expect(a.low.digits).toEqual([4, 9]);
        expect(a.target).toBe(9);
        expect(a.target_type).toBe('LOW');
    });

    it('falls through micro window, repetition and recency in order', () => {
        const base = { digit: 0, pct: 14, recent_count: 1, recent_pct: 20, micro_pct: 0, micro_count: 0 };
        const micro = breakTie([
            { ...base, digit: 3, micro_count: 0, repeats: 0, last_seen: 1 },
            { ...base, digit: 6, micro_count: 1, repeats: 0, last_seen: 2 },
        ]);
        expect(micro.selected?.digit).toBe(6);
        expect(micro.reason).toContain('Micro window');

        const repeats = breakTie([
            { ...base, digit: 3, repeats: 1, last_seen: 4 },
            { ...base, digit: 6, repeats: 0, last_seen: 1 },
        ]);
        expect(repeats.selected?.digit).toBe(3);
        expect(repeats.reason).toContain('Repetition');

        const recency = breakTie([
            { ...base, digit: 3, repeats: 0, last_seen: 4 },
            { ...base, digit: 6, repeats: 0, last_seen: 1 },
        ]);
        expect(recency.selected?.digit).toBe(6);
        expect(recency.reason).toContain('Recency');

        const equal = breakTie([
            { ...base, digit: 3, repeats: 0, last_seen: Infinity },
            { ...base, digit: 6, repeats: 0, last_seen: Infinity },
        ]);
        expect(equal.selected).toBeNull();
    });

    it('does not trade when tie-breakers cannot separate the candidates', () => {
        const absent: Counts = { 0: 12, 1: 12, 2: 12, 3: 13, 4: 0, 5: 12, 6: 13, 7: 12, 8: 14, 9: 0 };
        const a = analyzeHighLowTie(buildWindow(absent, [0, 1, 2, 3, 5]), opts({ mode: 'LOW' }));
        expect(a.low.digits).toEqual([4, 9]);
        expect(a.target).toBeNull();
        expect(a.status).toBe(STATUS.TIE_UNRESOLVED);
    });

    it('reports NO_TIE when the selected mode has no tie', () => {
        const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3, 6, 2]), opts({ mode: 'LOW' }));
        expect(a.target).toBeNull();
        expect(a.status).toBe(STATUS.NO_TIE);
    });

    it('applies the tie tolerance', () => {
        const near: Counts = { ...HIGH, 0: 5, 6: 13 };
        const strict = analyzeHighLowTie(buildWindow(near, [1, 3, 3, 6, 2]), opts({ mode: 'HIGH' }));
        expect(strict.status).toBe(STATUS.NO_TIE);
        const tolerant = analyzeHighLowTie(
            buildWindow(near, [1, 3, 3, 6, 2]),
            opts({ mode: 'HIGH', tie_tolerance: 1 })
        );
        expect(tolerant.high.digits).toEqual([3, 6, 9]);
        expect(tolerant.target).toBe(3);
    });

    it('AUTO: compares the weighted scores when both ties exist', () => {
        const a = analyzeHighLowTie(buildWindow(BOTH, [3, 3, 9, 1, 2]), opts({ mode: 'AUTO' }));
        expect(a.high.selected).toBe(3);
        expect(a.low.selected).toBe(9);
        expect(a.auto?.high_score).toBeCloseTo(31.67, 1);
        expect(a.auto?.low_score).toBeCloseTo(35.67, 1);
        expect(a.target).toBe(9);
        expect(a.target_type).toBe('LOW');
    });

    it('AUTO: trades the only tie that exists', () => {
        const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3, 6, 2]), opts({ mode: 'AUTO' }));
        expect(a.auto).toBeNull();
        expect(a.target).toBe(3);
    });

    it('waits for insufficient ticks', () => {
        const result = evaluateHighLowTie(Array.from({ length: 50 }, (_, i) => i % 10), opts(), createHighLowTieState());
        expect(result.status).toBe(STATUS.COLLECTING);
        expect(result.matched).toBe(false);
    });

    it('confirms the setup on the next tick before trading, then ignores re-polls', () => {
        const state = createHighLowTieState();
        const ticks = buildWindow(HIGH, [1, 3, 3, 6, 2]);
        const first = evaluateHighLowTie(ticks, opts({ mode: 'HIGH' }), state);
        expect(first.status).toBe(STATUS.AWAITING_CONFIRMATION);
        expect(first.matched).toBe(false);

        const next = [...ticks, 5];
        const confirmed = evaluateHighLowTie(next, opts({ mode: 'HIGH' }), state);
        expect(confirmed.status).toBe(STATUS.VALID_SIGNAL);
        expect(confirmed.prediction).toBe(3);
        expect(confirmed.contract_type).toBe('DIGITDIFF');

        const repoll = evaluateHighLowTie(next, opts({ mode: 'HIGH' }), state);
        expect(repoll.status).toBe(STATUS.SIGNAL_CONSUMED);
        expect(repoll.matched).toBe(false);
    });

    it('cancels the setup when the target changes on the new tick', () => {
        const state = createHighLowTieState();
        const ticks = buildWindow(HIGH, [3, 3, 1, 2, 6]);
        expect(evaluateHighLowTie(ticks, opts({ mode: 'HIGH' }), state).status).toBe(STATUS.AWAITING_CONFIRMATION);
        const changed = evaluateHighLowTie([...ticks, 5], opts({ mode: 'HIGH' }), state);
        expect(changed.status).toBe(STATUS.SETUP_CANCELLED);
        expect(changed.matched).toBe(false);
    });

    it('applies the cooldown and settles the outcome', () => {
        const o = opts({ mode: 'HIGH', recent_window: 10, signal_cooldown_tips: 1 });
        const state = createHighLowTieState();
        const ticks = buildWindow(HIGH, [3, 3, 3, 3, 6, 1, 2, 4, 5, 7]);
        evaluateHighLowTie(ticks, o, state);
        expect(evaluateHighLowTie([...ticks, 5], o, state).prediction).toBe(3);
        const cooling = evaluateHighLowTie([...ticks, 5, 7], o, state);
        expect(cooling.status).toBe(STATUS.COOLDOWN_ACTIVE);
        expect(cooling.live).toMatchObject({ trades: 1, wins: 1, losses: 0, streak: 1 });
    });

    it('does not repeat a setup that was already traded', () => {
        const o = opts({ mode: 'HIGH', recent_window: 10, signal_cooldown_tips: 0 });
        const state = createHighLowTieState();
        const ticks = buildWindow(HIGH, [3, 3, 3, 3, 6, 1, 2, 4, 5, 7]);
        evaluateHighLowTie(ticks, o, state);
        expect(evaluateHighLowTie([...ticks, 5], o, state).prediction).toBe(3);
        const again = evaluateHighLowTie([...ticks, 5, 7], o, state);
        expect(again.status).toBe(STATUS.SETUP_ALREADY_TRADED);
        expect(again.matched).toBe(false);
    });

    it('journals windows, the digit table, both ties, AUTO scores, the trade and live stats', () => {
        const o = opts({ journal_enabled: true });
        const state = createHighLowTieState();
        const ticks = buildWindow(BOTH, [3, 3, 9, 1, 2]);
        evaluateHighLowTie(ticks, o, state);
        const text = evaluateHighLowTie([...ticks, 0], o, state)
            .journal_messages.map(m => m.message)
            .join('\n');
        expect(text).toContain('HIGH-LOW TIE DIFFERS (AUTO)');
        expect(text).toContain('Analysis Window: 100/100 | Recent Window: 5 | Micro Window: 3');
        expect(text).toContain('Digit | Count | %: 0 |');
        expect(text).toContain('HIGH TIE: digits 3, 6 @ 14.00%');
        expect(text).toContain('LOW TIE: digits 4, 9 @ 5.00%');
        expect(text).toContain('AUTO: High-Tie 3 score');
        expect(text).toContain('TRADE: DIFFERS 9');
        expect(text).toContain('Trades: 0 | Wins: 0 | Losses: 0 | Win rate: 0.0% | Streak: 0');
    });

    it('replays without look-ahead and tallies every trade', () => {
        let seed = 7;
        const ticks = Array.from({ length: 1500 }, () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return Math.floor(seed / 65536) % 10;
        });
        const report = replayHighLowTie(ticks, { analysis_window: 100, recent_window: 20, micro_window: 10 });
        expect(report.trades).toBe(report.wins + report.losses);
        expect(report.valid_signals).toBeGreaterThanOrEqual(report.trades);
        report.signals.forEach(signal => expect(signal.target).toBeGreaterThanOrEqual(0));
    });
});
