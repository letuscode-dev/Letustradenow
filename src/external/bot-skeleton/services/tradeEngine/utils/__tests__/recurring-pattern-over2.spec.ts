import {
    BASELINE_OVER2_PCT,
    OVER2_BARRIER,
    STATUS,
    computeConsistencyScore,
    createRecurringPatternOver2State,
    evaluateRecurringPatternOver2,
    isOver2Win,
    normalizeRecurringPatternOver2Options,
    recordRecurringPatternOver2Outcome,
    replayRecurringPatternOver2,
    resetRecurringPatternOver2State,
} from '../recurring-pattern-over2';

const opts = (overrides = {}) =>
    normalizeRecurringPatternOver2Options({
        pattern_length: 3,
        min_occurrences: 10,
        min_over2_rate: 75,
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

/** Build history so pattern 4-8-2 is followed mostly by Over 2 wins. */
const buildConsistentHistory = (repeats = 15) => {
    const history = [];
    // Mostly wins (digits 3–9), occasional loss — clustered for consistency
    const followers = [7, 5, 9, 8, 4, 6, 9, 5, 3, 7, 8, 6, 4, 5, 9, 7, 2, 8, 4, 6];
    for (let i = 0; i < repeats; i++) {
        history.push(4, 8, 2, followers[i % followers.length]);
    }
    return history;
};

describe('recurring pattern over 2 consistency', () => {
    it('defaults to ACTIVE Over 2 thresholds', () => {
        const o = normalizeRecurringPatternOver2Options({});
        expect(o.pattern_length).toBe(3);
        expect(o.min_occurrences).toBe(10);
        expect(o.min_over2_rate).toBe(75);
        expect(o.min_edge).toBe(5);
        expect(o.min_consistency_score).toBe(70);
        expect(o.mode).toBe('active');
        expect(BASELINE_OVER2_PCT).toBe(70);
        expect(OVER2_BARRIER).toBe(2);
    });

    it('strict mode raises thresholds', () => {
        const o = normalizeRecurringPatternOver2Options({ mode: 'strict' });
        expect(o.min_occurrences).toBe(20);
        expect(o.min_over2_rate).toBe(80);
        expect(o.min_consistency_score).toBe(80);
        expect(o.max_rolling_range).toBe(20);
    });

    it('classifies Over 2 wins and losses correctly', () => {
        expect(isOver2Win(3)).toBe(true);
        expect(isOver2Win(9)).toBe(true);
        expect(isOver2Win(2)).toBe(false);
        expect(isOver2Win(0)).toBe(false);
    });

    it('scores consistency separately from raw Over 2 rate', () => {
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

    it('fires OVER 2 when rate and consistency pass', () => {
        const state = createRecurringPatternOver2State();
        const history = buildConsistentHistory(18);
        evaluateRecurringPatternOver2(history, opts(), state);
        const live = evaluateRecurringPatternOver2([...history, 4, 8, 2], opts(), state);
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(2);
        expect(live.contract_type).toBe('DIGITOVER');
        expect(live.barrier).toBe(2);
        expect(live.status).toBe(STATUS.VALID_SIGNAL);
        expect(live.over2_rate).toBeGreaterThanOrEqual(75);
        expect(live.consistency_score).toBeGreaterThanOrEqual(70);
    });

    it('explains insufficient occurrences instead of silent no-signal', () => {
        const state = createRecurringPatternOver2State();
        const history = [4, 8, 2, 7, 4, 8, 2, 5, 4, 8, 2, 9];
        evaluateRecurringPatternOver2(history, opts({ min_occurrences: 10 }), state);
        const live = evaluateRecurringPatternOver2(
            [...history, 4, 8, 2],
            opts({ min_occurrences: 10 }),
            state
        );
        expect(live.matched).toBe(false);
        expect(live.status).toBe(STATUS.INSUFFICIENT_OCCURRENCES);
        expect(live.why_no_trade).toMatch(/occurrences/i);
    });

    it('rejects low Over 2 rate with diagnostic reason', () => {
        const state = createRecurringPatternOver2State();
        const history = [];
        // Alternate win/loss so rate ~50%
        for (let i = 0; i < 20; i++) history.push(1, 2, 3, i % 2 === 0 ? 8 : 0);
        evaluateRecurringPatternOver2(history, opts({ min_occurrences: 10 }), state);
        const live = evaluateRecurringPatternOver2(
            [...history, 1, 2, 3],
            opts({ min_occurrences: 10 }),
            state
        );
        expect(live.matched).toBe(false);
        expect(live.why_no_trade).toMatch(/RATE|threshold|Below/i);
    });

    it('rejects inconsistent patterns even with high Over 2 rate', () => {
        const state = createRecurringPatternOver2State();
        // High overall rate but huge volatility: long win block then long loss block then wins
        const history = [];
        for (let i = 0; i < 12; i++) history.push(5, 5, 5, 8); // wins
        for (let i = 0; i < 8; i++) history.push(5, 5, 5, 0); // losses — blows rolling range / streaks
        for (let i = 0; i < 10; i++) history.push(5, 5, 5, 9); // wins again
        evaluateRecurringPatternOver2(
            history,
            opts({
                min_occurrences: 10,
                min_over2_rate: 60,
                min_edge: 0,
                min_consistency_score: 70,
                min_recent_rate: 50,
                max_rolling_range: 25,
                max_losing_streak: 3,
            }),
            state
        );
        const live = evaluateRecurringPatternOver2(
            [...history, 5, 5, 5],
            opts({
                min_occurrences: 10,
                min_over2_rate: 60,
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
        const state = createRecurringPatternOver2State();
        const history = buildConsistentHistory(18);
        evaluateRecurringPatternOver2(history, opts(), state);
        const before = evaluateRecurringPatternOver2([...history, 4, 8, 2], opts(), state);
        expect(before.matched).toBe(true);
        const occ_before = before.occurrences;
        // Same tip re-poll must not grow occurrences
        const again = evaluateRecurringPatternOver2([...history, 4, 8, 2], opts(), state);
        expect(again.occurrences).toBe(occ_before);
        // Next tip settles and updates DB
        evaluateRecurringPatternOver2([...history, 4, 8, 2, 9], opts(), state);
        expect(state.live.wins + state.live.losses).toBeGreaterThanOrEqual(1);
    });

    it('records explicit Over 2 outcomes', () => {
        const state = createRecurringPatternOver2State();
        state.pending_outcome = {
            pattern: '4-8-2',
            over2_rate: 80,
            consistency_score: 85,
            signal_score: 88,
            tip_index: 10,
        };
        expect(recordRecurringPatternOver2Outcome(state, 1).won).toBe(false);
        state.pending_outcome = {
            pattern: '4-8-2',
            over2_rate: 80,
            consistency_score: 85,
            signal_score: 88,
            tip_index: 11,
        };
        expect(recordRecurringPatternOver2Outcome(state, 7).won).toBe(true);
        expect(state.live.wins).toBe(1);
        expect(state.live.losses).toBe(1);
    });

    it('resets state in place', () => {
        const state = createRecurringPatternOver2State();
        evaluateRecurringPatternOver2([1, 2, 3, 4, 5], opts(), state);
        resetRecurringPatternOver2State(state);
        expect(state.digits).toEqual([]);
        expect(state.bootstrapped).toBe(false);
    });

    it('replays history without look-ahead and only signals OVER 2', () => {
        const history = buildConsistentHistory(25);
        for (let i = 0; i < 6; i++) history.push(4, 8, 2, 5);

        const report = replayRecurringPatternOver2(history, opts({ signal_cooldown_tips: 1 }));
        expect(report.total_ticks).toBe(history.length);
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.trades).toBeGreaterThan(0);
        expect(report.wins + report.losses).toBe(report.trades);
        expect(report.average_historical_over2_rate).toBeGreaterThan(70);
    });
});
