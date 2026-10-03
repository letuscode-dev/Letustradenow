import {
    analyzeHighLowTie,
    breakTie,
    createHighLowTieState,
    evaluateHighLowTie,
    normalizeHighLowTieOptions,
    rawScoreCandidate,
    recordHighLowTieContract,
    replayHighLowTie,
    selectHighLowTarget,
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

const withEpochs = (digits: number[], start = 1000) => digits.map((digit, i) => ({ digit, epoch: start + i }));

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

const journalText = (result: { journal_messages: { message: string }[] }) =>
    result.journal_messages.map(m => m.message).join('\n');

// HIGH tie 3 & 6 at 14%, unique lowest 0.
const HIGH: Counts = { 0: 4, 1: 6, 2: 7, 3: 14, 4: 9, 5: 10, 6: 14, 7: 11, 8: 12, 9: 13 };
// LOW tie 4 & 9 at 5%, unique highest 3.
const LOW: Counts = { 0: 10, 1: 10, 2: 11, 3: 16, 4: 5, 5: 11, 6: 10, 7: 11, 8: 11, 9: 5 };
// HIGH tie 3 & 6 at 14% and LOW tie 4 & 9 at 5%.
const BOTH: Counts = { 0: 10, 1: 10, 2: 10, 3: 14, 4: 5, 5: 11, 6: 14, 7: 11, 8: 10, 9: 5 };
// HIGH tie 3 & 7 at 15% and LOW tie 1, 4, 9 at 0% (absent → cannot be separated).
const UNRESOLVED_LOW: Counts = { 0: 14, 1: 0, 2: 14, 3: 15, 4: 0, 5: 14, 6: 14, 7: 15, 8: 14, 9: 0 };
const FLAT: Counts = { 0: 10, 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10, 9: 10 };

describe('High-Low Tie Differs', () => {
    describe('options', () => {
        it('normalizes options with the documented defaults and limits', () => {
            const o = normalizeHighLowTieOptions({});
            expect(o).toMatchObject({
                analysis_window: 200,
                recent_window: 20,
                micro_window: 10,
                tie_tolerance: 0,
                mode: 'AUTO',
                signal_cooldown_tips: 1,
                adjustments: [],
            });
            expect(normalizeHighLowTieOptions({ analysis_window: 50 }).analysis_window).toBe(100);
            expect(normalizeHighLowTieOptions({ recent_window: 8, micro_window: 30 }).micro_window).toBe(8);
            expect(normalizeHighLowTieOptions({ mode: 'high tie' }).mode).toBe('HIGH');
            expect(normalizeHighLowTieOptions({ mode: 'LOW TIE' }).mode).toBe('LOW');
        });

        it('reports every adjusted setting with requested, actual and reason', () => {
            const o = normalizeHighLowTieOptions({ analysis_window: 50, recent_window: 3, micro_window: 2, mode: 'xyz' });
            expect(o.adjustments).toEqual([
                { setting: 'Analysis Window', requested: 50, actual: 100, reason: 'minimum allowed value is 100' },
                { setting: 'Recent Window', requested: 3, actual: 5, reason: 'minimum allowed value is 5' },
                { setting: 'Micro Window', requested: 2, actual: 3, reason: 'minimum allowed value is 3' },
                { setting: 'Mode', requested: 'xyz', actual: 'AUTO', reason: 'use HIGH, LOW or AUTO' },
            ]);
            const capped = normalizeHighLowTieOptions({ recent_window: 8, micro_window: 30 });
            expect(capped.adjustments[0]).toMatchObject({
                setting: 'Micro Window',
                actual: 8,
                reason: 'cannot exceed the Recent Window (8)',
            });
        });

        it('journals adjusted settings', () => {
            const ticks = buildWindow(HIGH, [1, 3, 3, 6, 2]);
            const result = evaluateHighLowTie(
                ticks,
                { analysis_window: 100, recent_window: 3, micro_window: 3, journal_enabled: true },
                createHighLowTieState()
            );
            expect(journalText(result)).toContain(
                'SETTING ADJUSTED: Recent Window requested 3 → actual 5 (minimum allowed value is 5)'
            );
        });
    });

    describe('counting and windows', () => {
        it('counts digits, computes count / total × 100 and recalculates on a new tick', () => {
            const ticks = buildWindow(HIGH, [1, 3, 3, 6, 2]);
            const a = analyzeHighLowTie(ticks, opts());
            expect(a.counts).toEqual([4, 6, 7, 14, 9, 10, 14, 11, 12, 13]);
            expect(a.percentages[3]).toBeCloseTo(14);
            const b = analyzeHighLowTie([...ticks, 3], opts());
            expect(b.counts[3]).toBe(15);
            expect(b.counts[0]).toBe(3);
        });

        it('calculates Recent and Micro windows independently from the analysis window', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [3, 3, 3, 3, 0, 0, 0, 6, 6, 1]), opts({ recent_window: 10 }));
            expect(a.features[3]).toMatchObject({ count: 14, recent_count: 4, recent_pct: 40, micro_count: 0 });
            expect(a.features[6]).toMatchObject({ count: 14, recent_count: 2, recent_pct: 20, micro_count: 2 });
            expect(a.features[6].micro_pct).toBeCloseTo(66.67, 1);
        });
    });

    describe('tie detection', () => {
        it('A: two-way HIGH tie picks the higher Recent Window occurrence', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3, 6, 2]), opts({ mode: 'HIGH' }));
            expect(a.high.digits).toEqual([3, 6]);
            expect(a.high.pct_max).toBeCloseTo(14);
            expect(a.target).toBe(3);
            expect(a.target_type).toBe('HIGH');
            expect(a.high.decider).toBe('Recent Window');
        });

        it('B / R: three-way HIGH tie detects all candidates and breaks deterministically', () => {
            const c = { 0: 4, 1: 7, 2: 8, 3: 14, 4: 9, 5: 10, 6: 14, 7: 10, 8: 14, 9: 10 };
            const ticks = buildWindow(c, [3, 3, 8, 6, 1]);
            const a = analyzeHighLowTie(ticks, opts({ mode: 'HIGH' }));
            expect(a.high.digits).toEqual([3, 6, 8]);
            expect(a.target).toBe(3);
            expect(analyzeHighLowTie(ticks, opts({ mode: 'HIGH' })).target).toBe(3);
        });

        it('four-way HIGH tie', () => {
            const c = { 0: 4, 1: 7, 2: 8, 3: 14, 4: 8, 5: 8, 6: 14, 7: 9, 8: 14, 9: 14 };
            const a = analyzeHighLowTie(buildWindow(c, [9, 9, 3, 6, 1]), opts({ mode: 'HIGH' }));
            expect(a.high.digits).toEqual([3, 6, 8, 9]);
            expect(a.target).toBe(9);
        });

        it('C: two-way LOW tie picks the higher Recent Window occurrence', () => {
            const a = analyzeHighLowTie(buildWindow(LOW, [9, 1, 9, 2, 4]), opts({ mode: 'LOW' }));
            expect(a.low.digits).toEqual([4, 9]);
            expect(a.target).toBe(9);
            expect(a.target_type).toBe('LOW');
        });

        it('D / S: three-way and four-way LOW ties detect all candidates', () => {
            const c3 = { 0: 12, 1: 5, 2: 12, 3: 13, 4: 5, 5: 12, 6: 12, 7: 12, 8: 12, 9: 5 };
            const a = analyzeHighLowTie(buildWindow(c3, [1, 9, 1, 4, 2]), opts({ mode: 'LOW' }));
            expect(a.low.digits).toEqual([1, 4, 9]);
            expect(a.target).toBe(1);
            const c4 = { 0: 13, 1: 5, 2: 5, 3: 16, 4: 5, 5: 13, 6: 13, 7: 12, 8: 13, 9: 5 };
            const b = analyzeHighLowTie(buildWindow(c4, [2, 2, 1, 4, 9]), opts({ mode: 'LOW' }));
            expect(b.low.digits).toEqual([1, 2, 4, 9]);
            expect(b.target).toBe(2);
        });

        it('reports NO_TIE when the selected mode has no tie', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3, 6, 2]), opts({ mode: 'LOW' }));
            expect(a.target).toBeNull();
            expect(a.status).toBe(STATUS.NO_TIE);
        });
    });

    describe('tie tolerance', () => {
        // 3 = 12.0%, 6 = 12.3% (highest) over 1000 ticks.
        const HIGH_TOL: Counts = { 0: 80, 1: 95, 2: 96, 3: 120, 4: 97, 5: 97, 6: 123, 7: 97, 8: 97, 9: 98 };
        // 0 = 7.0% (lowest), 1 = 7.3% over 1000 ticks.
        const LOW_TOL: Counts = { 0: 70, 1: 73, 2: 105, 3: 106, 4: 107, 5: 107, 6: 107, 7: 107, 8: 108, 9: 110 };
        const o1000 = (x = {}) => opts({ analysis_window: 1000, ...x });

        it('H / I: 12.0% vs 12.3% tie at 0.5 and not at 0', () => {
            const ticks = buildWindow(HIGH_TOL, [3, 3, 6, 1, 2]);
            const on = analyzeHighLowTie(ticks, o1000({ mode: 'HIGH', tie_tolerance: 0.5 }));
            expect(on.high.digits).toEqual([3, 6]);
            expect(on.target).toBe(3);
            const off = analyzeHighLowTie(ticks, o1000({ mode: 'HIGH', tie_tolerance: 0 }));
            expect(off.status).toBe(STATUS.NO_TIE);
        });

        it('V: the boundary is inclusive and applied the same way to HIGH and LOW', () => {
            const high_ticks = buildWindow(HIGH_TOL, [3, 3, 6, 1, 2]);
            expect(analyzeHighLowTie(high_ticks, o1000({ mode: 'HIGH', tie_tolerance: 0.3 })).high.digits).toEqual([3, 6]);
            expect(analyzeHighLowTie(high_ticks, o1000({ mode: 'HIGH', tie_tolerance: 0.29 })).high.exists).toBe(false);

            const low_ticks = buildWindow(LOW_TOL, [1, 1, 0, 2, 3]);
            const low_on = analyzeHighLowTie(low_ticks, o1000({ mode: 'LOW', tie_tolerance: 0.3 }));
            expect(low_on.low.digits).toEqual([0, 1]);
            expect(low_on.target).toBe(1);
            expect(analyzeHighLowTie(low_ticks, o1000({ mode: 'LOW', tie_tolerance: 0.29 })).low.exists).toBe(false);
        });
    });

    describe('tie-breakers', () => {
        it('falls through micro window, repetition and recency in order', () => {
            const base = { digit: 0, pct: 14, recent_count: 1, recent_pct: 20, micro_pct: 0, micro_count: 0 };
            const micro = breakTie([
                { ...base, digit: 3, micro_count: 0, repeats: 0, last_seen: 1 },
                { ...base, digit: 6, micro_count: 1, repeats: 0, last_seen: 2 },
            ]);
            expect(micro.selected?.digit).toBe(6);
            expect(micro.decider?.label).toBe('Micro Window');

            const repeats = breakTie([
                { ...base, digit: 3, repeats: 1, last_seen: 4 },
                { ...base, digit: 6, repeats: 0, last_seen: 1 },
            ]);
            expect(repeats.selected?.digit).toBe(3);
            expect(repeats.decider?.label).toBe('Repetition');

            const recency = breakTie([
                { ...base, digit: 3, repeats: 0, last_seen: 4 },
                { ...base, digit: 6, repeats: 0, last_seen: 1 },
            ]);
            expect(recency.selected?.digit).toBe(6);
            expect(recency.decider?.label).toBe('Recency');

            const equal = breakTie([
                { ...base, digit: 3, repeats: 0, last_seen: Infinity },
                { ...base, digit: 6, repeats: 0, last_seen: Infinity },
            ]);
            expect(equal.selected).toBeNull();
        });

        it('K / T: Recent Window decides even when the Micro Window favours the other digit', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [3, 3, 3, 3, 0, 0, 0, 6, 6, 1]), opts({ mode: 'HIGH', recent_window: 10 }));
            expect(a.features[6].micro_count).toBeGreaterThan(a.features[3].micro_count);
            expect(a.target).toBe(3);
            expect(a.high.decider).toBe('Recent Window');
        });

        it('G / L: identical statistics after every tie-breaker give no trade', () => {
            const absent: Counts = { 0: 12, 1: 12, 2: 12, 3: 13, 4: 0, 5: 12, 6: 13, 7: 12, 8: 14, 9: 0 };
            const two = analyzeHighLowTie(buildWindow(absent, [0, 1, 2, 3, 5]), opts({ mode: 'LOW' }));
            expect(two.low.digits).toEqual([4, 9]);
            expect(two.target).toBeNull();
            expect(two.status).toBe(STATUS.TIE_UNRESOLVED);

            const three = analyzeHighLowTie(buildWindow(UNRESOLVED_LOW, [0, 2, 3, 5, 6]), opts({ mode: 'LOW' }));
            expect(three.low.digits).toEqual([1, 4, 9]);
            expect(three.target).toBeNull();
            expect(three.status).toBe(STATUS.TIE_UNRESOLVED);
        });
    });

    describe('AUTO mode', () => {
        it('E: compares the weighted scores when both ties exist', () => {
            const a = analyzeHighLowTie(buildWindow(BOTH, [3, 3, 9, 1, 2]), opts({ mode: 'AUTO' }));
            expect(a.high.selected).toBe(3);
            expect(a.low.selected).toBe(9);
            expect(a.auto?.high_score).toBeCloseTo(31.67, 2);
            expect(a.auto?.low_score).toBeCloseTo(35.67, 2);
            expect(a.target).toBe(9);
            expect(a.target_type).toBe('LOW');
        });

        it('trades the only tie that exists', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3, 6, 2]), opts({ mode: 'AUTO' }));
            expect(a.auto).toBeNull();
            expect(a.target).toBe(3);
        });

        it('M: unresolved HIGH + resolved LOW gives no trade', () => {
            const decision = selectHighLowTarget({
                high: { type: 'HIGH', exists: true, digits: [3, 7], selected: null, reason: '3 and 7 equal' },
                low: { type: 'LOW', exists: true, digits: [1, 4, 9], selected: 1, reason: 'Recent Window' },
                features: [],
                options: opts({ mode: 'AUTO' }),
            });
            expect(decision.status).toBe(STATUS.TIE_UNRESOLVED);
            expect(decision.target).toBeNull();
        });

        it('N: resolved HIGH + unresolved LOW gives no trade', () => {
            const a = analyzeHighLowTie(buildWindow(UNRESOLVED_LOW, [0, 2, 3, 5, 6]), opts({ mode: 'AUTO' }));
            expect(a.high.selected).toBe(3);
            expect(a.low.selected).toBeNull();
            expect(a.status).toBe(STATUS.TIE_UNRESOLVED);
            expect(a.target).toBeNull();
            const result = evaluateHighLowTie(
                buildWindow(UNRESOLVED_LOW, [0, 2, 3, 5, 6]),
                opts({ mode: 'AUTO' }),
                createHighLowTieState()
            );
            expect(result.contract_type).toBeNull();
            expect(result.prediction).toBe(-1);
        });

        it('HIGH mode ignores an unresolved LOW tie outside its scope', () => {
            const a = analyzeHighLowTie(buildWindow(UNRESOLVED_LOW, [0, 2, 3, 5, 6]), opts({ mode: 'HIGH' }));
            expect(a.target).toBe(3);
        });

        it('Q: equal AUTO scores give no trade, compared unrounded with a float tolerance', () => {
            const equal: Counts = { 0: 10, 1: 10, 2: 10, 3: 12, 4: 8, 5: 10, 6: 12, 7: 10, 8: 10, 9: 8 };
            const a = analyzeHighLowTie(buildWindow(equal, [0, 1, 2, 5, 7]), opts({ mode: 'AUTO' }));
            expect(a.high.selected).toBe(6);
            expect(a.low.selected).toBe(9);
            const o = opts();
            const high_raw = rawScoreCandidate(a.features[6], 'HIGH', o);
            const low_raw = rawScoreCandidate(a.features[9], 'LOW', o);
            expect(Math.abs(high_raw - low_raw)).toBeLessThan(1e-6);
            expect(a.status).toBe(STATUS.AUTO_EQUAL);
            expect(a.target).toBeNull();
        });

        it('scores are deterministic for the same data', () => {
            const ticks = buildWindow(BOTH, [3, 3, 9, 1, 2]);
            const first = analyzeHighLowTie(ticks, opts());
            const second = analyzeHighLowTie([...ticks], opts());
            expect(second.auto).toEqual(first.auto);
            expect(second.target).toBe(first.target);
        });
    });

    describe('no extreme', () => {
        it('O: all ten digits equal gives NO_EXTREME_TIE in every mode', () => {
            const ticks = buildWindow(FLAT, [3, 3, 6, 1, 2]);
            ['HIGH', 'LOW', 'AUTO'].forEach(mode => {
                const a = analyzeHighLowTie(ticks, opts({ mode }));
                expect(a.status).toBe(STATUS.NO_EXTREME_TIE);
                expect(a.target).toBeNull();
            });
        });

        it('completely overlapping HIGH and LOW groups (via tolerance) give NO_EXTREME_TIE', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3, 6, 2]), opts({ tie_tolerance: 10 }));
            expect(a.high.digits).toEqual(a.low.digits);
            expect(a.status).toBe(STATUS.NO_EXTREME_TIE);
        });
    });

    describe('evaluation flow', () => {
        it('waits for insufficient ticks', () => {
            const result = evaluateHighLowTie(
                Array.from({ length: 50 }, (_, i) => i % 10),
                opts(),
                createHighLowTieState()
            );
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

        it('F: tie disappearing on the new tick cancels the setup', () => {
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [1, 3, 3, 6, 2]);
            evaluateHighLowTie(ticks, opts({ mode: 'HIGH' }), state);
            const gone = evaluateHighLowTie([...ticks, 3], opts({ mode: 'HIGH' }), state);
            expect(gone.status).toBe(STATUS.SETUP_CANCELLED);
            expect(gone.matched).toBe(false);
        });

        it('J / U: a changed target cancels the old setup and re-confirms the new one', () => {
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [3, 3, 1, 2, 6]);
            expect(evaluateHighLowTie(ticks, opts({ mode: 'HIGH' }), state).status).toBe(
                STATUS.AWAITING_CONFIRMATION
            );
            const changed = evaluateHighLowTie([...ticks, 5], opts({ mode: 'HIGH' }), state);
            expect(changed.status).toBe(STATUS.SETUP_CANCELLED);
            expect(changed.matched).toBe(false);
            expect(changed.prediction).toBe(-1);
            const reconfirmed = evaluateHighLowTie([...ticks, 5, 8], opts({ mode: 'HIGH' }), state);
            expect(reconfirmed.status).toBe(STATUS.VALID_SIGNAL);
            expect(reconfirmed.prediction).toBe(6);
        });

        it('applies the cooldown after a trade', () => {
            const o = opts({ mode: 'HIGH', recent_window: 10, signal_cooldown_tips: 1 });
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [3, 3, 3, 3, 6, 1, 2, 4, 5, 7]);
            evaluateHighLowTie(ticks, o, state);
            expect(evaluateHighLowTie([...ticks, 5], o, state).prediction).toBe(3);
            const cooling = evaluateHighLowTie([...ticks, 5, 7], o, state);
            expect(cooling.status).toBe(STATUS.COOLDOWN_ACTIVE);
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
    });

    describe('contract settlement', () => {
        const signalThen = () => {
            const o = opts({ mode: 'HIGH', journal_enabled: true });
            const state = createHighLowTieState();
            const ticks = withEpochs([...buildWindow(HIGH, [1, 3, 3, 6, 2]), 5]);
            evaluateHighLowTie(ticks.slice(0, -1), o, state);
            const signal = evaluateHighLowTie(ticks, o, state);
            return { o, state, ticks, signal, signal_epoch: ticks[ticks.length - 1].epoch };
        };

        it('P: the journal result comes from the actual contract, not the first tick after the signal', () => {
            const { o, state, ticks, signal, signal_epoch } = signalThen();
            expect(signal.prediction).toBe(3);

            // The first tick after the signal is 5 (would look like a Differs win)...
            const after = [...ticks, { digit: 5, epoch: signal_epoch + 1 }];
            const no_contract = evaluateHighLowTie(after, o, state);
            expect(no_contract.live.trades).toBe(0);
            expect(no_contract.settled).toBeNull();

            // ...but the purchased contract settled on a later tick ending in 3 → LOSS.
            recordHighLowTieContract(state, {
                contract_id: 991,
                is_sold: 1,
                status: 'lost',
                barrier: '3',
                purchase_time: signal_epoch + 1,
                exit_tick_display_value: '1234.53',
                profit: -0.5,
            });
            const reported = evaluateHighLowTie([...after, { digit: 7, epoch: signal_epoch + 2 }], o, state);
            expect(reported.live).toMatchObject({ trades: 1, wins: 0, losses: 1, streak: -1 });
            expect(reported.live.last_outcome).toMatchObject({ result: 'LOSS', actual: 3, contract_id: 991 });
            const text = journalText(reported);
            expect(text).toContain('RESULT: LOSS — DIFFERS 3 | contract 991 | exit digit 3 | profit -0.50');
            expect(text).toContain('Last Result: LOSS | Trades: 1 | Wins: 0 | Losses: 1 | Win rate: 0.0% | Streak: 1 loss');
        });

        it('ignores open, stale, mismatched and duplicate contracts', () => {
            const { state, signal_epoch } = signalThen();
            const base = { contract_id: 5, is_sold: 1, status: 'won', barrier: '3', purchase_time: signal_epoch + 1 };
            expect(recordHighLowTieContract(state, { ...base, is_sold: 0, status: 'open' })).toBeNull();
            expect(recordHighLowTieContract(state, { ...base, purchase_time: signal_epoch - 5 })).toBeNull();
            expect(recordHighLowTieContract(state, { ...base, barrier: '6' })).toBeNull();
            expect(recordHighLowTieContract(state, base)).toMatchObject({ result: 'WIN' });
            expect(recordHighLowTieContract(state, base)).toBeNull();
            expect(state.live).toMatchObject({ trades: 1, wins: 1, streak: 1 });
        });
    });

    describe('journal', () => {
        it('shows source, candidates, tie %, tie-break and the deciding metric for a HIGH trade', () => {
            const o = opts({ mode: 'HIGH', journal_enabled: true });
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [1, 3, 3, 6, 2]);
            evaluateHighLowTie(ticks, o, state);
            const text = journalText(evaluateHighLowTie([...ticks, 5], o, state));
            expect(text).toContain('TRADE: DIFFERS 3');
            expect(text).toContain('SOURCE: HIGH TIE');
            expect(text).toContain('TIE CANDIDATES: 3, 6');
            expect(text).toContain('TIE PERCENTAGE: 14.00%');
            expect(text).toContain('TIE-BREAK: Recent Window');
            expect(text).toContain('RECENT: 3 = 40.0%, 6 = 20.0%');
        });

        it('shows windows, digit table, ties, AUTO scores, source and live stats for an AUTO trade', () => {
            const o = opts({ journal_enabled: true });
            const state = createHighLowTieState();
            const ticks = buildWindow(BOTH, [3, 3, 9, 1, 2]);
            evaluateHighLowTie(ticks, o, state);
            const text = journalText(evaluateHighLowTie([...ticks, 0], o, state));
            expect(text).toContain('HIGH-LOW TIE DIFFERS (AUTO)');
            expect(text).toContain('Analysis Window: 100/100 | Recent Window: 5 | Micro Window: 3');
            expect(text).toContain('Digit | Count | %: 0 |');
            expect(text).toContain('HIGH TIE: digits 3, 6 @ 14.00%');
            expect(text).toContain('LOW TIE: digits 4, 9 @ 5.00%');
            expect(text).toContain('AUTO: High-Tie 3 score 23.00 vs Low-Tie 9 score 28.00 → target 9');
            expect(text).toContain('TRADE: DIFFERS 9');
            expect(text).toContain('SOURCE: LOW TIE');
            expect(text).toContain('TIE CANDIDATES: 4, 9');
            expect(text).toContain('RECENT: 4 = 0.0%, 9 = 20.0%');
            expect(text).toContain('HIGH CANDIDATE: 3');
            expect(text).toContain('HIGH SCORE: 23.00');
            expect(text).toContain('LOW CANDIDATE: 9');
            expect(text).toContain('LOW SCORE: 28.00');
            expect(text).toContain('Last Result: — | Trades: 0 | Wins: 0 | Losses: 0 | Win rate: 0.0% | Streak: 0');
        });

        it('explains NO_EXTREME_TIE and TIE_UNRESOLVED', () => {
            const flat = evaluateHighLowTie(
                buildWindow(FLAT, [3, 3, 6, 1, 2]),
                opts({ journal_enabled: true }),
                createHighLowTieState()
            );
            expect(journalText(flat)).toContain('WHY NO TRADE? NO_EXTREME_TIE');
            const unresolved = evaluateHighLowTie(
                buildWindow(UNRESOLVED_LOW, [0, 2, 3, 5, 6]),
                opts({ journal_enabled: true }),
                createHighLowTieState()
            );
            expect(journalText(unresolved)).toContain('WHY NO TRADE? TIE_UNRESOLVED — LOW tie 1, 4, 9');
        });
    });

    it('replays without look-ahead and tallies every simulated trade', () => {
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
