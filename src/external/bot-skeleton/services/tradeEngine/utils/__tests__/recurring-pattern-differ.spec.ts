import {
    createRecurringPatternDifferState,
    evaluateRecurringPatternDiffer,
    normalizeRecurringPatternDifferOptions,
    recordRecurringPatternDifferOutcome,
    replayRecurringPatternDiffer,
    resetRecurringPatternDifferState,
    STATUS,
} from '../recurring-pattern-differ';

const opts = (overrides = {}) =>
    normalizeRecurringPatternDifferOptions({
        pattern_length: 3,
        min_occurrences: 5,
        min_target_pct: 15,
        min_advantage: 5,
        min_target_gap: 2,
        require_dominance_gap: false,
        mode: 'active',
        analysis_window: 500,
        journal_enabled: false,
        signal_cooldown_tips: 0,
        ...overrides,
    });

describe('recurring pattern differ (active)', () => {
    it('defaults to ACTIVE trading thresholds', () => {
        const o = normalizeRecurringPatternDifferOptions({});
        expect(o.pattern_length).toBe(3);
        expect(o.min_pattern_length).toBe(3);
        expect(o.max_pattern_length).toBe(3);
        expect(o.min_occurrences).toBe(5);
        expect(o.min_target_pct).toBe(15);
        expect(o.min_advantage).toBe(5);
        expect(o.require_dominance_gap).toBe(false);
        expect(o.multi_window).toBe(false);
        expect(o.mode).toBe('active');
    });

    it('Differs the historically most frequent next digit for a 3-digit pattern', () => {
        const state = createRecurringPatternDifferState();
        const history = [];
        for (let i = 0; i < 8; i++) {
            history.push(3, 7, 1, i === 2 || i === 4 ? (i === 2 ? 2 : 4) : 8);
        }
        evaluateRecurringPatternDiffer(history, opts(), state);
        const live = evaluateRecurringPatternDiffer([...history, 3, 7, 1], opts(), state);
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(8);
        expect(live.pattern).toBe('3-7-1');
        expect(live.status).toBe(STATUS.VALID_SIGNAL);
    });

    it('explains insufficient occurrences instead of silent no-signal', () => {
        const state = createRecurringPatternDifferState();
        const history = [3, 7, 1, 8, 3, 7, 1, 8];
        evaluateRecurringPatternDiffer(history, opts({ min_occurrences: 5 }), state);
        const live = evaluateRecurringPatternDiffer([...history, 3, 7, 1], opts({ min_occurrences: 5 }), state);
        expect(live.matched).toBe(false);
        expect(live.status).toBe(STATUS.INSUFFICIENT_OCCURRENCES);
        expect(live.why_no_trade).toMatch(/occurrences/i);
    });

    it('rejects low target percentage with diagnostic reason', () => {
        const state = createRecurringPatternDifferState();
        const history = [];
        for (let i = 0; i < 20; i++) history.push(1, 2, 3, i % 10);
        evaluateRecurringPatternDiffer(history, opts({ min_occurrences: 10, min_target_pct: 40 }), state);
        const live = evaluateRecurringPatternDiffer(
            [...history, 1, 2, 3],
            opts({ min_occurrences: 10, min_target_pct: 40 }),
            state
        );
        expect(live.matched).toBe(false);
        expect(live.why_no_trade).toMatch(/percentage|Target/i);
    });

    it('does not require dominance gap in ACTIVE mode', () => {
        const state = createRecurringPatternDifferState();
        // Target barely ahead of second — gap < 2 but Active ignores gap
        const history = [];
        for (let i = 0; i < 10; i++) history.push(4, 2, 7, i % 2 === 0 ? 8 : 3);
        // 8 five times, 3 five times — tie-ish; make 8 win 6/10
        history.length = 0;
        for (let i = 0; i < 10; i++) history.push(4, 2, 7, i < 6 ? 8 : 3);

        evaluateRecurringPatternDiffer(
            history,
            opts({ min_occurrences: 5, min_target_pct: 15, min_advantage: 5, require_dominance_gap: false }),
            state
        );
        const live = evaluateRecurringPatternDiffer(
            [...history, 4, 2, 7],
            opts({ min_occurrences: 5, min_target_pct: 15, min_advantage: 5, require_dominance_gap: false }),
            state
        );
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(8);
    });

    it('keeps signal on same-tip re-poll and records outcome on next tip', () => {
        const state = createRecurringPatternDifferState();
        const history = [];
        for (let i = 0; i < 8; i++) history.push(3, 7, 1, 8);

        evaluateRecurringPatternDiffer(history, opts(), state);
        const seq = [...history, 3, 7, 1];
        const fire = evaluateRecurringPatternDiffer(seq, opts(), state);
        expect(fire.prediction).toBe(8);
        const again = evaluateRecurringPatternDiffer(seq, opts(), state);
        expect(again.prediction).toBe(8);

        evaluateRecurringPatternDiffer([...seq, 4], opts(), state);
        expect(state.live.wins).toBe(1);
    });

    it('resets state in place', () => {
        const state = createRecurringPatternDifferState();
        evaluateRecurringPatternDiffer([1, 2, 3, 4, 5], opts(), state);
        resetRecurringPatternDifferState(state);
        expect(state.digits).toEqual([]);
        expect(state.bootstrapped).toBe(false);
    });

    it('records explicit outcomes', () => {
        const state = createRecurringPatternDifferState();
        state.pending_outcome = { pattern: '1-2-3', target: 8, target_pct: 20, score: 70, tip_index: 10 };
        expect(recordRecurringPatternDifferOutcome(state, 8).won).toBe(false);
        state.pending_outcome = { pattern: '1-2-3', target: 8, target_pct: 20, score: 70, tip_index: 11 };
        expect(recordRecurringPatternDifferOutcome(state, 3).won).toBe(true);
        expect(state.live.wins).toBe(1);
        expect(state.live.losses).toBe(1);
    });

    it('replays history without look-ahead and produces Differ signals', () => {
        const history = [];
        for (let i = 0; i < 12; i++) history.push(3, 7, 1, i % 3 === 0 ? 2 : 8);
        for (let i = 0; i < 4; i++) history.push(3, 7, 1, 4);

        const report = replayRecurringPatternDiffer(history, opts({ signal_cooldown_tips: 1 }));
        expect(report.total_ticks).toBe(history.length);
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.signals.every(s => s.target >= 0 && s.target <= 9)).toBe(true);
        expect(report.trades).toBeGreaterThan(0);
        expect(report.wins + report.losses).toBe(report.trades);
    });
});
