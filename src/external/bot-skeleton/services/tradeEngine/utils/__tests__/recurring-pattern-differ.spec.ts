import {
    createRecurringPatternDifferState,
    evaluateRecurringPatternDiffer,
    normalizeRecurringPatternDifferOptions,
    recordRecurringPatternDifferOutcome,
    resetRecurringPatternDifferState,
} from '../recurring-pattern-differ';

const opts = (overrides = {}) =>
    normalizeRecurringPatternDifferOptions({
        min_pattern_length: 4,
        max_pattern_length: 4,
        min_occurrences: 3,
        min_target_pct: 15,
        min_advantage: 4,
        min_target_gap: 3,
        analysis_window: 200,
        journal_enabled: false,
        ...overrides,
    });

describe('recurring pattern differ', () => {
    it('defaults core options', () => {
        const o = normalizeRecurringPatternDifferOptions({});
        expect(o.min_pattern_length).toBe(2);
        expect(o.max_pattern_length).toBe(6);
        expect(o.min_occurrences).toBe(50);
        expect(o.min_target_pct).toBe(15);
        expect(o.conflict_preference).toBe('longest');
    });

    it('Differs the historically most frequent next digit for a recurring pattern', () => {
        const state = createRecurringPatternDifferState();
        // Build history: pattern 3-7-1-5 followed by 8 most often
        const history = [];
        for (let i = 0; i < 6; i++) {
            history.push(3, 7, 1, 5, i === 2 || i === 4 ? (i === 2 ? 2 : 4) : 8);
        }
        // 8,8,2,8,4,8 → 8 appears 4/6
        const first = evaluateRecurringPatternDiffer(history, opts(), state);
        expect(first.matched).toBe(false);

        const live = evaluateRecurringPatternDiffer([...history, 3, 7, 1, 5], opts(), state);
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(8);
        expect(live.pattern).toBe('3-7-1-5');
    });

    it('does not signal with insufficient occurrences', () => {
        const state = createRecurringPatternDifferState();
        const history = [3, 7, 1, 5, 8, 3, 7, 1, 5, 8];
        evaluateRecurringPatternDiffer(history, opts({ min_occurrences: 50 }), state);
        const live = evaluateRecurringPatternDiffer([...history, 3, 7, 1, 5], opts({ min_occurrences: 50 }), state);
        expect(live.matched).toBe(false);
    });

    it('rejects when target percentage is below threshold', () => {
        const state = createRecurringPatternDifferState();
        // Even distribution-ish: followers cycle 0-9
        const history = [];
        for (let i = 0; i < 20; i++) {
            history.push(1, 2, 3, 4, i % 10);
        }
        evaluateRecurringPatternDiffer(history, opts({ min_occurrences: 10, min_target_pct: 30 }), state);
        const live = evaluateRecurringPatternDiffer(
            [...history, 1, 2, 3, 4],
            opts({ min_occurrences: 10, min_target_pct: 30 }),
            state
        );
        expect(live.matched).toBe(false);
    });

    it('prefers the longest qualifying pattern by default', () => {
        const state = createRecurringPatternDifferState();
        const history = [];
        // Length-2 pattern 9-9 → mostly 1
        for (let i = 0; i < 20; i++) history.push(9, 9, 1);
        // Length-4 pattern 2-2-2-2 → mostly 7 (stronger / longer)
        for (let i = 0; i < 20; i++) history.push(2, 2, 2, 2, 7);

        evaluateRecurringPatternDiffer(
            history,
            opts({
                min_pattern_length: 2,
                max_pattern_length: 4,
                min_occurrences: 10,
                min_target_pct: 50,
                min_advantage: 0,
                min_target_gap: 0,
            }),
            state
        );

        const live = evaluateRecurringPatternDiffer(
            [...history, 2, 2, 2, 2],
            opts({
                min_pattern_length: 2,
                max_pattern_length: 4,
                min_occurrences: 10,
                min_target_pct: 50,
                min_advantage: 0,
                min_target_gap: 0,
            }),
            state
        );
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(7);
        expect(live.pattern).toBe('2-2-2-2');
        expect(live.pattern_length).toBe(4);
    });

    it('keeps signal on same-tip re-poll and records outcome on next tip', () => {
        const state = createRecurringPatternDifferState();
        const history = [];
        for (let i = 0; i < 6; i++) history.push(3, 7, 1, 5, 8);

        evaluateRecurringPatternDiffer(history, opts({ min_target_gap: 0, min_advantage: 0 }), state);
        const seq = [...history, 3, 7, 1, 5];
        const fire = evaluateRecurringPatternDiffer(seq, opts({ min_target_gap: 0, min_advantage: 0 }), state);
        expect(fire.prediction).toBe(8);
        const again = evaluateRecurringPatternDiffer(seq, opts({ min_target_gap: 0, min_advantage: 0 }), state);
        expect(again.prediction).toBe(8);

        const after = evaluateRecurringPatternDiffer(
            [...seq, 4],
            opts({ min_target_gap: 0, min_advantage: 0 }),
            state
        );
        expect(state.live.wins).toBe(1);
        expect(after.live.wins).toBe(1);
    });

    it('respects allowed digits filter', () => {
        const state = createRecurringPatternDifferState();
        const history = [];
        for (let i = 0; i < 8; i++) history.push(3, 7, 1, 5, 8);
        const filterOpts = opts({
            allowed_digits: [0, 1, 2],
            min_advantage: 0,
            min_target_gap: 0,
            min_target_pct: 10,
        });
        evaluateRecurringPatternDiffer(history, filterOpts, state);
        const live = evaluateRecurringPatternDiffer([...history, 3, 7, 1, 5], filterOpts, state);
        const pattern = live.candidates?.find(c => c.pattern === '3-7-1-5');
        expect(pattern).toBeTruthy();
        expect(pattern.distribution.target).toBe(8);
        expect(pattern.qualified).toBe(false);
        expect(pattern.reasons.join(' ')).toMatch(/disabled/i);
    });

    it('resets state in place', () => {
        const state = createRecurringPatternDifferState();
        evaluateRecurringPatternDiffer([1, 2, 3, 4, 5], opts(), state);
        resetRecurringPatternDifferState(state);
        expect(state.digits).toEqual([]);
        expect(state.bootstrapped).toBe(false);
        expect(Object.keys(state.patterns)).toHaveLength(0);
    });

    it('records explicit outcomes', () => {
        const state = createRecurringPatternDifferState();
        state.pending_outcome = {
            pattern: '1-2-3-4',
            target: 8,
            target_pct: 20,
            score: 70,
            tip_index: 10,
        };
        const loss = recordRecurringPatternDifferOutcome(state, 8);
        expect(loss.won).toBe(false);
        state.pending_outcome = {
            pattern: '1-2-3-4',
            target: 8,
            target_pct: 20,
            score: 70,
            tip_index: 11,
        };
        const win = recordRecurringPatternDifferOutcome(state, 3);
        expect(win.won).toBe(true);
        expect(state.live.wins).toBe(1);
        expect(state.live.losses).toBe(1);
    });
});
