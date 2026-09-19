import {
    BASELINE_UNDER7_PCT,
    UNDER7_BARRIER,
    STATUS,
    computeConsistencyScore,
    createRecurringPatternUnder7State,
    evaluateRecurringPatternUnder7,
    isUnder7Win,
    normalizeRecurringPatternUnder7Options,
    recordRecurringPatternUnder7Outcome,
    replayRecurringPatternUnder7,
    resetRecurringPatternUnder7State,
} from '../recurring-pattern-under7';

const opts = (overrides = {}) =>
    normalizeRecurringPatternUnder7Options({
        pattern_length: 3,
        min_occurrences: 10,
        min_under7_rate: 75,
        min_edge: 5,
        min_consistency_score: 70,
        min_recent_rate: 70,
        max_rolling_range: 30,
        max_losing_streak: 5,
        mode: 'active',
        analysis_window: 500,
        journal_enabled: false,
        signal_cooldown_tips: 0,
        ...overrides,
    });

/** Build history so pattern 4-8-2 is followed mostly by Under 7 wins. */
const buildConsistentHistory = (repeats = 15) => {
    const history = [];
    // Mostly wins (digits 0–6), occasional loss — clustered for consistency
    const followers = [3, 5, 1, 4, 6, 2, 0, 5, 3, 4, 2, 6, 1, 5, 4, 3, 8, 2, 6, 1];
    for (let i = 0; i < repeats; i++) {
        history.push(4, 8, 2, followers[i % followers.length]);
    }
    return history;
};

describe('recurring pattern under 7 consistency', () => {
    it('defaults to ACTIVE Under 7 thresholds', () => {
        const o = normalizeRecurringPatternUnder7Options({});
        expect(o.pattern_length).toBe(3);
        expect(o.min_occurrences).toBe(10);
        expect(o.min_under7_rate).toBe(75);
        expect(o.min_edge).toBe(5);
        expect(o.min_consistency_score).toBe(70);
        expect(o.mode).toBe('active');
        expect(BASELINE_UNDER7_PCT).toBe(70);
        expect(UNDER7_BARRIER).toBe(7);
    });

    it('strict mode raises thresholds', () => {
        const o = normalizeRecurringPatternUnder7Options({ mode: 'strict' });
        expect(o.min_occurrences).toBe(20);
        expect(o.min_under7_rate).toBe(80);
        expect(o.min_consistency_score).toBe(80);
        expect(o.max_rolling_range).toBe(20);
    });

    it('classifies Under 7 wins and losses correctly', () => {
        expect(isUnder7Win(3)).toBe(true);
        expect(isUnder7Win(6)).toBe(true);
        expect(isUnder7Win(0)).toBe(true);
        expect(isUnder7Win(7)).toBe(false);
        expect(isUnder7Win(9)).toBe(false);
    });

    it('scores consistency separately from raw Under 7 rate', () => {
        const stable = computeConsistencyScore({
            rolling: { range: 10, stdev: 3 },
            block: { consistency: 100 },
            recent_rate: 90,
            historical_rate: 85,
            max_loss_streak: 1,
            switch_rate: 25,
            max_losing_streak_cap: 5,
        });
        const unstable = computeConsistencyScore({
            rolling: { range: 45, stdev: 20 },
            block: { consistency: 40 },
            recent_rate: 50,
            historical_rate: 85,
            max_loss_streak: 6,
            switch_rate: 90,
            max_losing_streak_cap: 5,
        });
        expect(stable).toBeGreaterThan(unstable);
        expect(stable).toBeGreaterThanOrEqual(70);
        expect(unstable).toBeLessThan(60);
    });

    it('fires UNDER 7 when rate and consistency pass', () => {
        const state = createRecurringPatternUnder7State();
        const history = buildConsistentHistory(18);
        evaluateRecurringPatternUnder7(history, opts(), state);
        const live = evaluateRecurringPatternUnder7([...history, 4, 8, 2], opts(), state);
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(7);
        expect(live.contract_type).toBe('DIGITUNDER');
        expect(live.barrier).toBe(7);
        expect(live.status).toBe(STATUS.VALID_SIGNAL);
        expect(live.under7_rate).toBeGreaterThanOrEqual(75);
        expect(live.consistency_score).toBeGreaterThanOrEqual(70);
    });

    it('explains insufficient occurrences instead of silent no-signal', () => {
        const state = createRecurringPatternUnder7State();
        const history = [4, 8, 2, 7, 4, 8, 2, 5, 4, 8, 2, 9];
        evaluateRecurringPatternUnder7(history, opts({ min_occurrences: 10 }), state);
        const live = evaluateRecurringPatternUnder7(
            [...history, 4, 8, 2],
            opts({ min_occurrences: 10 }),
            state
        );
        expect(live.matched).toBe(false);
        expect(live.status).toBe(STATUS.INSUFFICIENT_OCCURRENCES);
        expect(live.why_no_trade).toMatch(/occurrences/i);
    });

    it('rejects low Under 7 rate with diagnostic reason', () => {
        const state = createRecurringPatternUnder7State();
        const history = [];
        // Alternate win/loss so rate ~50%
        for (let i = 0; i < 20; i++) history.push(1, 2, 3, i % 2 === 0 ? 8 : 0);
        evaluateRecurringPatternUnder7(history, opts({ min_occurrences: 10 }), state);
        const live = evaluateRecurringPatternUnder7(
            [...history, 1, 2, 3],
            opts({ min_occurrences: 10 }),
            state
        );
        expect(live.matched).toBe(false);
        expect(live.why_no_trade).toMatch(/RATE|threshold|Below/i);
    });

    it('rejects inconsistent patterns even with high Under 7 rate', () => {
        const state = createRecurringPatternUnder7State();
        // High overall rate but huge volatility: long win block then long loss block then wins
        const history = [];
        for (let i = 0; i < 12; i++) history.push(5, 5, 5, 3); // wins
        for (let i = 0; i < 8; i++) history.push(5, 5, 5, 9); // losses — blows rolling range / streaks
        for (let i = 0; i < 10; i++) history.push(5, 5, 5, 2); // wins again
        evaluateRecurringPatternUnder7(
            history,
            opts({
                min_occurrences: 10,
                min_under7_rate: 60,
                min_edge: 0,
                min_consistency_score: 70,
                min_recent_rate: 50,
                max_rolling_range: 25,
                max_losing_streak: 3,
            }),
            state
        );
        const live = evaluateRecurringPatternUnder7(
            [...history, 5, 5, 5],
            opts({
                min_occurrences: 10,
                min_under7_rate: 60,
                min_edge: 0,
                min_consistency_score: 70,
                min_recent_rate: 50,
                max_rolling_range: 25,
                max_losing_streak: 3,
            }),
            state
        );
        expect(live.matched).toBe(false);
        expect(
            [STATUS.CONSISTENCY_TOO_LOW, STATUS.ROLLING_RANGE_TOO_HIGH, STATUS.LOSING_STREAK_TOO_HIGH].includes(
                live.status
            )
        ).toBe(true);
    });

    it('does not contaminate signal stats with its own outcome', () => {
        const state = createRecurringPatternUnder7State();
        const history = buildConsistentHistory(18);
        evaluateRecurringPatternUnder7(history, opts(), state);
        const before = evaluateRecurringPatternUnder7([...history, 4, 8, 2], opts(), state);
        expect(before.matched).toBe(true);
        const occ_before = before.occurrences;
        // Same tip re-poll must not grow occurrences
        const again = evaluateRecurringPatternUnder7([...history, 4, 8, 2], opts(), state);
        expect(again.occurrences).toBe(occ_before);
        // Next tip settles and updates DB
        evaluateRecurringPatternUnder7([...history, 4, 8, 2, 3], opts(), state);
        expect(state.live.wins + state.live.losses).toBeGreaterThanOrEqual(1);
    });

    it('records explicit Under 7 outcomes', () => {
        const state = createRecurringPatternUnder7State();
        state.pending_outcome = {
            pattern: '4-8-2',
            under7_rate: 80,
            consistency_score: 85,
            signal_score: 88,
            tip_index: 10,
        };
        expect(recordRecurringPatternUnder7Outcome(state, 8).won).toBe(false);
        state.pending_outcome = {
            pattern: '4-8-2',
            under7_rate: 80,
            consistency_score: 85,
            signal_score: 88,
            tip_index: 11,
        };
        expect(recordRecurringPatternUnder7Outcome(state, 3).won).toBe(true);
        expect(state.live.wins).toBe(1);
        expect(state.live.losses).toBe(1);
    });

    it('resets state in place', () => {
        const state = createRecurringPatternUnder7State();
        evaluateRecurringPatternUnder7([1, 2, 3, 4, 5], opts(), state);
        resetRecurringPatternUnder7State(state);
        expect(state.digits).toEqual([]);
        expect(state.bootstrapped).toBe(false);
    });

    it('replays history without look-ahead and only signals UNDER 7', () => {
        const history = buildConsistentHistory(25);
        for (let i = 0; i < 6; i++) history.push(4, 8, 2, 4);

        const report = replayRecurringPatternUnder7(history, opts({ signal_cooldown_tips: 1 }));
        expect(report.total_ticks).toBe(history.length);
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.trades).toBeGreaterThan(0);
        expect(report.wins + report.losses).toBe(report.trades);
        expect(report.average_historical_under7_rate).toBeGreaterThan(70);
    });
});
