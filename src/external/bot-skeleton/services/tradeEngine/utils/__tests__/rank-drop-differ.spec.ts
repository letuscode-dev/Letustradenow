import {
    analyzeRankDrop,
    createRankDropState,
    evaluateRankDrop,
    normalizeRankDropOptions,
    rankDigits,
    recordRankDropContract,
    replayRankDrop,
    STATUS,
} from '../rank-drop-differ';

/** Interleave digits by remaining count so the segment has exactly the requested counts. */
const buildSegment = (counts: Record<number, number>): number[] => {
    const remaining = Array.from({ length: 10 }, (_, d) => counts[d] ?? 0);
    const out: number[] = [];
    while (remaining.some(c => c > 0)) {
        for (let d = 0; d < 10; d++) {
            if (remaining[d] > 0) {
                out.push(d);
                remaining[d] -= 1;
            }
        }
    }
    return out;
};

// Window 100, lookback 50: INITIAL = DROPPED + SHARED, LATER = SHARED + ADDED.
const opts = { analysis_window: 100, lookback_ticks: 50, min_rank_drop: 3, confirmation: false };
const SHARED = buildSegment(Object.fromEntries(Array.from({ length: 10 }, (_, d) => [d, 5])));
// Initial ranks: 3 #1 (19), 7 #2 (15), 5 #3 (13), 0/1/2/4 #4 (8), 6/8/9 #8 (7).
const DROPPED = buildSegment({ 3: 14, 7: 10, 5: 8, 0: 3, 1: 3, 2: 3, 4: 3, 6: 2, 8: 2, 9: 2 });
// Later ranks: 7 #1 (19), 5 #2 (17), 0 #3 (15), 3 #4 (11), 1/2/4 #5 (7), 6/8 #8 (6), 9 #10 (5).
const ADDED = buildSegment({ 7: 14, 5: 12, 0: 10, 3: 6, 1: 2, 2: 2, 4: 2, 6: 1, 8: 1, 9: 0 });
// Same, but digit 4 falls #4 → #7 as well, so 3 and 4 share the biggest drop.
const ADDED_TIED = buildSegment({ 7: 14, 5: 12, 0: 10, 3: 6, 1: 3, 2: 2, 4: 1, 6: 1, 8: 1, 9: 0 });

const SCENARIO = [...DROPPED, ...SHARED, ...ADDED];

const run = (ticks: number[], options: Record<string, unknown> = {}) =>
    evaluateRankDrop(ticks, { ...opts, ...options }, createRankDropState());

describe('Rank Drop Differs — ranking', () => {
    it('fixtures are 50 ticks per segment', () => {
        [SHARED, DROPPED, ADDED, ADDED_TIED].forEach(segment => expect(segment).toHaveLength(50));
    });

    it('ranks highest to lowest frequency, tied counts share a rank', () => {
        expect(rankDigits([5, 9, 9, 1, 7, 0, 0, 0, 0, 0])).toEqual([4, 1, 1, 5, 3, 6, 6, 6, 6, 6]);
    });

    it('example: 3 #1 → #4 while 7 and 5 move up → DIFFER 3', () => {
        const analysis = analyzeRankDrop(SCENARIO, opts);
        expect(analysis.initial_ranks[3]).toBe(1);
        expect(analysis.initial_ranks[7]).toBe(2);
        expect(analysis.initial_ranks[5]).toBe(3);
        expect(analysis.later_ranks[7]).toBe(1);
        expect(analysis.later_ranks[5]).toBe(2);
        expect(analysis.later_ranks[3]).toBe(4);
        expect(analysis.biggest_drop).toBe(3);
        expect(analysis.target).toBe(3);

        const result = run(SCENARIO);
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.prediction).toBe(3);
        expect(result.contract_type).toBe('DIGITDIFF');
    });
});

describe('Rank Drop Differs — no trade', () => {
    it('biggest drop below the minimum', () => {
        const result = run(SCENARIO, { min_rank_drop: 4 });
        expect(result.status).toBe(STATUS.DROP_TOO_SMALL);
        expect(result.prediction).toBe(-1);
    });

    it('several digits share the biggest drop', () => {
        const result = run([...DROPPED, ...SHARED, ...ADDED_TIED]);
        expect(result.status).toBe(STATUS.MOVER_TIED);
        expect(result.prediction).toBe(-1);
    });

    it('no digit lost rank', () => {
        const result = run([...SHARED, ...SHARED, ...SHARED]);
        expect(result.status).toBe(STATUS.NO_RANK_DROP);
        expect(result.prediction).toBe(-1);
    });

    it('not enough ticks for window + lookback', () => {
        const result = run(SCENARIO.slice(1));
        expect(result.status).toBe(STATUS.COLLECTING);
        expect(result.prediction).toBe(-1);
    });

    it('analysis alone also refuses a short history', () => {
        const analysis = analyzeRankDrop(SCENARIO.slice(1), opts);
        expect(analysis.status).toBe(STATUS.COLLECTING);
        expect(analysis.target).toBeNull();
    });

    it('strategy disabled', () => {
        const result = run(SCENARIO, { enabled: false });
        expect(result.status).toBe(STATUS.DISABLED);
        expect(result.prediction).toBe(-1);
    });
});

describe('Rank Drop Differs — settings', () => {
    it('defaults: window 1000, lookback 100, minimum drop 3, enabled, confirmation on', () => {
        expect(normalizeRankDropOptions({})).toMatchObject({
            analysis_window: 1000,
            lookback_ticks: 100,
            min_rank_drop: 3,
            enabled: true,
            confirmation: true,
        });
    });

    it('lookback cannot exceed the window and the total stays within one history request', () => {
        expect(normalizeRankDropOptions({ analysis_window: 100, lookback_ticks: 500 }).lookback_ticks).toBe(100);
        const big = normalizeRankDropOptions({ analysis_window: 4500, lookback_ticks: 1000 });
        expect(big.analysis_window + big.lookback_ticks).toBe(5000);
        expect(big.adjustments.map(a => a.setting)).toContain('Lookback Ticks');
    });

    it('only the last window + lookback ticks are used', () => {
        const older = Array.from({ length: 300 }, () => 9);
        expect(run([...older, ...SCENARIO]).prediction).toBe(3);
    });
});

describe('Rank Drop Differs — confirmation and re-polls', () => {
    const confirm = { ...opts, confirmation: true };

    it('arms first, trades when the next tick keeps the same biggest mover', () => {
        const state = createRankDropState();
        const first = evaluateRankDrop(SCENARIO, confirm, state);
        expect(first.status).toBe(STATUS.AWAITING_CONFIRMATION);
        expect(first.prediction).toBe(-1);
        // Appending 0 keeps both rankings unchanged (the ticks leaving each window are also 0).
        const second = evaluateRankDrop([...SCENARIO, 0], confirm, state);
        expect(second.status).toBe(STATUS.VALID_SIGNAL);
        expect(second.prediction).toBe(3);
        expect(second.confirmation_status).toBe('CONFIRMED');
    });

    it('cancels when the next tick removes the setup', () => {
        const state = createRankDropState();
        evaluateRankDrop(SCENARIO, confirm, state);
        const next = evaluateRankDrop([...SCENARIO, 3, 3, 3, 3, 3], confirm, state);
        expect(next.prediction).toBe(-1);
        expect(next.status).toBe(STATUS.SETUP_CANCELLED);
    });

    it('re-polls of the same tick do not trade twice', () => {
        const state = createRankDropState();
        expect(evaluateRankDrop(SCENARIO, opts, state).prediction).toBe(3);
        const again = evaluateRankDrop(SCENARIO, opts, state);
        expect(again.status).toBe(STATUS.SIGNAL_CONSUMED);
        expect(again.prediction).toBe(-1);
    });
});

describe('Rank Drop Differs — journal and results', () => {
    it('journal shows both rankings, the biggest mover and the target', () => {
        const text = run(SCENARIO)
            .journal_messages.map(m => m.message)
            .join('\n');
        expect(text).toContain('RANK DROP DIFFERS');
        expect(text).toContain('Window: 100 ticks | Lookback: 50 ticks | Minimum Rank Drop: 3');
        expect(text).toContain('Initial: #1 3(19)  #2 7(15)  #3 5(13)');
        expect(text).toContain('Later:   #1 7(19)  #2 5(17)  #3 0(15)  #4 3(11)');
        expect(text).toContain('Biggest Mover: Digit 3 | #1 → #4 | Drop: 3');
        expect(text).toContain('Condition: PASSED');
        expect(text).toContain('Target: DIFFER 3');
    });

    it('records WIN/LOSS from the settled purchased contract', () => {
        const state = createRankDropState();
        evaluateRankDrop(SCENARIO, opts, state);
        expect(state.pending_outcome?.target).toBe(3);
        const settled = recordRankDropContract(state, { contract_id: 9, is_sold: 1, status: 'lost', barrier: '3' });
        expect(settled).toMatchObject({ result: 'LOSS', target: 3 });
        expect(state.live).toMatchObject({ trades: 1, wins: 0, losses: 1 });
    });

    it('replay settles every signal without look-ahead', () => {
        const report = replayRankDrop([...SCENARIO, 0, 0], opts);
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.trades).toBe(report.wins + report.losses);
    });
});
