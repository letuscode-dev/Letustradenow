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

/**
 * Window with exact per-digit counts: `head` first, then the remaining digits
 * spread so no digit repeats back-to-back (largest remaining first, never the
 * previous digit), then `tail`. Repetition therefore only comes from head/tail.
 */
const buildWindow = (counts: Counts, tail: number[] = [], head: number[] = []) => {
    const remaining: Counts = { ...counts };
    [...head, ...tail].forEach(d => {
        remaining[d] -= 1;
    });
    const seq = [...head];
    let left = Object.values(remaining).reduce((sum, n) => sum + n, 0);
    while (left > 0) {
        const prev = seq[seq.length - 1];
        let pick = -1;
        for (let d = 0; d <= 9; d++) {
            if ((remaining[d] ?? 0) > 0 && d !== prev && (pick < 0 || remaining[d] > remaining[pick])) pick = d;
        }
        if (pick < 0) pick = prev;
        seq.push(pick);
        remaining[pick] -= 1;
        left -= 1;
    }
    return [...seq, ...tail];
};

const withEpochs = (digits: number[], start = 1000) => digits.map((digit, i) => ({ digit, epoch: start + i }));

// recent_ticks = analysis_window by default so exact ties fall through to the later
// tie-breakers; tests for the Recent Appearances breaker set it explicitly.
const opts = (overrides = {}) =>
    normalizeHighLowTieOptions({
        analysis_window: 100,
        recent_ticks: 100,
        tie_tolerance: 0,
        mode: 'AUTO',
        signal_cooldown_tips: 1,
        journal_enabled: false,
        ...overrides,
    });

const journalText = (result: { journal_messages: { message: string }[] }) =>
    result.journal_messages.map(m => m.message).join('\n');

// Neutral head: appending these digits in order drops the same digit from the window start.
const HEAD = [0, 2, 0, 2];

// HIGH tie 3 & 6 at 14%, unique lowest 0.
const HIGH: Counts = { 0: 4, 1: 6, 2: 7, 3: 14, 4: 9, 5: 10, 6: 14, 7: 11, 8: 12, 9: 13 };
// LOW tie 4 & 9 at 5%, unique highest 3.
const LOW: Counts = { 0: 10, 1: 10, 2: 11, 3: 16, 4: 5, 5: 11, 6: 10, 7: 11, 8: 11, 9: 5 };
// HIGH tie 3 & 6 at 14% and LOW tie 4 & 9 at 5%.
const BOTH: Counts = { 0: 10, 1: 10, 2: 10, 3: 14, 4: 5, 5: 11, 6: 14, 7: 11, 8: 10, 9: 5 };
// HIGH tie 3 & 7 at 15% and LOW tie 1, 4, 9 at 0% (absent → cannot be separated).
const UNRESOLVED_LOW: Counts = { 0: 14, 1: 0, 2: 14, 3: 15, 4: 0, 5: 14, 6: 14, 7: 15, 8: 14, 9: 0 };
const FLAT: Counts = { 0: 10, 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10, 9: 10 };
// 3 = 12.0%, 6 = 12.3% (highest) over 1000 ticks.
const HIGH_TOL: Counts = { 0: 80, 1: 95, 2: 96, 3: 120, 4: 97, 5: 97, 6: 123, 7: 97, 8: 97, 9: 98 };
// 0 = 7.0% (lowest), 1 = 7.3% over 1000 ticks.
const LOW_TOL: Counts = { 0: 70, 1: 73, 2: 105, 3: 106, 4: 107, 5: 107, 6: 107, 7: 107, 8: 108, 9: 110 };

describe('High-Low Tie Differs (single Analysis Window)', () => {
    describe('options', () => {
        it('has the documented defaults', () => {
            const o = normalizeHighLowTieOptions({});
            expect(o).toEqual({
                analysis_window: 200,
                recent_ticks: 50,
                tie_tolerance: 0,
                mode: 'AUTO',
                signal_cooldown_tips: 1,
                journal_enabled: true,
                adjustments: [],
            });
            expect(normalizeHighLowTieOptions({ mode: 'high tie' }).mode).toBe('HIGH');
            expect(normalizeHighLowTieOptions({ mode: 'LOW TIE' }).mode).toBe('LOW');
        });

        it('ignores legacy recent/micro window options entirely', () => {
            const o = normalizeHighLowTieOptions({ recent_window: 3, micro_window: 2 });
            expect(o).not.toHaveProperty('recent_window');
            expect(o).not.toHaveProperty('micro_window');
            expect(o.adjustments).toEqual([]);
            const ticks = buildWindow(HIGH, [1, 3, 3]);
            expect(analyzeHighLowTie(ticks, opts({ recent_window: 5, micro_window: 3 }))).toEqual(
                analyzeHighLowTie(ticks, opts())
            );
        });

        it('reports adjusted settings with requested, actual and reason', () => {
            const o = normalizeHighLowTieOptions({
                analysis_window: 50,
                recent_ticks: 2,
                tie_tolerance: 20,
                mode: 'xyz',
            });
            expect(o.adjustments).toEqual([
                { setting: 'Analysis Window', requested: 50, actual: 100, reason: 'minimum allowed value is 100' },
                { setting: 'Recent Ticks', requested: 2, actual: 5, reason: 'minimum allowed value is 5' },
                { setting: 'Tie Tolerance %', requested: 20, actual: 10, reason: 'maximum allowed value is 10' },
                { setting: 'Mode', requested: 'xyz', actual: 'AUTO', reason: 'use HIGH, LOW or AUTO' },
            ]);
            const capped = normalizeHighLowTieOptions({ analysis_window: 100, recent_ticks: 500 });
            expect(capped.recent_ticks).toBe(100);
            expect(capped.adjustments[0].reason).toBe('cannot exceed the Analysis Window (100)');
            const result = evaluateHighLowTie(
                buildWindow(HIGH, [1, 3, 3]),
                { analysis_window: 50, journal_enabled: true },
                createHighLowTieState()
            );
            expect(journalText(result)).toContain(
                'SETTING ADJUSTED: Analysis Window requested 50 → actual 100 (minimum allowed value is 100)'
            );
        });
    });

    describe('counting', () => {
        it('counts digits over the Analysis Window and recalculates on every new tick', () => {
            const ticks = buildWindow(HIGH, [1, 3, 3], HEAD);
            const a = analyzeHighLowTie(ticks, opts());
            expect(a.total).toBe(100);
            expect(a.counts).toEqual([4, 6, 7, 14, 9, 10, 14, 11, 12, 13]);
            expect(a.percentages[3]).toBeCloseTo(14);
            const b = analyzeHighLowTie([...ticks, 3], opts());
            expect(b.total).toBe(100);
            expect(b.counts[3]).toBe(15);
            expect(b.counts[0]).toBe(3);
        });

        it('derives repetition and recency from the same Analysis Window', () => {
            const ticks = [9, 9, 9, ...buildWindow(HIGH, [1, 3, 3])];
            const a = analyzeHighLowTie(ticks, opts());
            expect(a.total).toBe(100);
            expect(a.features[3]).toMatchObject({ count: 14, repeats: 1, last_seen: 0 });
            expect(a.features[6].repeats).toBe(0);
            // The 9s outside the window are not counted.
            expect(a.counts[9]).toBe(13);
        });
    });

    describe('tie detection', () => {
        it('A: two-way HIGH tie is broken by repetition inside the window', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3]), opts({ mode: 'HIGH' }));
            expect(a.high.digits).toEqual([3, 6]);
            expect(a.features[3].repeats).toBe(1);
            expect(a.features[6].repeats).toBe(0);
            expect(a.target).toBe(3);
            expect(a.target_type).toBe('HIGH');
            expect(a.high.decider).toBe('Repetition');
        });

        it('HIGH tie targets the digit appearing most in the last Recent Ticks', () => {
            // Last 8 ticks: 6 appears 3 times, 3 twice — 3 has the repeat and was seen last, 6 still wins.
            const a = analyzeHighLowTie(buildWindow(HIGH, [6, 1, 6, 2, 6, 4, 3, 3]), opts({ mode: 'HIGH', recent_ticks: 8 }));
            expect(a.high.digits).toEqual([3, 6]);
            expect(a.features[6].recent_count).toBe(3);
            expect(a.features[3].recent_count).toBe(2);
            expect(a.target).toBe(6);
            expect(a.high.decider).toBe('Recent Appearances');
            expect(a.high.decider_detail).toBe('LAST 8: 3 = 2, 6 = 3');
        });

        it('LOW tie targets the digit appearing most in the last Recent Ticks', () => {
            const a = analyzeHighLowTie(buildWindow(LOW, [4, 1, 4, 2, 9]), opts({ mode: 'LOW', recent_ticks: 5 }));
            expect(a.low.digits).toEqual([4, 9]);
            expect(a.target).toBe(4);
            expect(a.low.decider).toBe('Recent Appearances');
        });

        it('uses the default 50 recent ticks from the same window', () => {
            const ticks = buildWindow(HIGH, [6, 1, 6, 2, 6, 4, 3, 3]);
            const a = analyzeHighLowTie(ticks, opts({ mode: 'HIGH', recent_ticks: undefined }));
            expect(a.options.recent_ticks).toBe(50);
            const last50 = ticks.slice(-50);
            expect(a.features[3].recent_count).toBe(last50.filter(d => d === 3).length);
            expect(a.features[6].recent_count).toBe(last50.filter(d => d === 6).length);
        });

        it('two-way HIGH tie with equal repetition is broken by recency', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 6, 3]), opts({ mode: 'HIGH' }));
            expect(a.features[3].repeats).toBe(a.features[6].repeats);
            expect(a.target).toBe(3);
            expect(a.high.decider).toBe('Recency');
        });

        it('B / R: three-way HIGH tie detects all candidates and breaks deterministically', () => {
            const c = { 0: 4, 1: 7, 2: 8, 3: 14, 4: 9, 5: 10, 6: 14, 7: 10, 8: 14, 9: 10 };
            const ticks = buildWindow(c, [1, 8, 8]);
            const a = analyzeHighLowTie(ticks, opts({ mode: 'HIGH' }));
            expect(a.high.digits).toEqual([3, 6, 8]);
            expect(a.target).toBe(8);
            expect(analyzeHighLowTie([...ticks], opts({ mode: 'HIGH' })).target).toBe(8);
        });

        it('four-way HIGH tie', () => {
            const c = { 0: 4, 1: 7, 2: 8, 3: 14, 4: 8, 5: 8, 6: 14, 7: 9, 8: 14, 9: 14 };
            const a = analyzeHighLowTie(buildWindow(c, [1, 9, 9]), opts({ mode: 'HIGH' }));
            expect(a.high.digits).toEqual([3, 6, 8, 9]);
            expect(a.target).toBe(9);
        });

        it('C: two-way LOW tie', () => {
            const a = analyzeHighLowTie(buildWindow(LOW, [1, 9, 9]), opts({ mode: 'LOW' }));
            expect(a.low.digits).toEqual([4, 9]);
            expect(a.target).toBe(9);
            expect(a.target_type).toBe('LOW');
            expect(a.low.decider).toBe('Repetition');
        });

        it('D / S: three-way and four-way LOW ties detect all candidates', () => {
            const c3 = { 0: 12, 1: 5, 2: 12, 3: 13, 4: 5, 5: 12, 6: 12, 7: 12, 8: 12, 9: 5 };
            const a = analyzeHighLowTie(buildWindow(c3, [0, 1, 1]), opts({ mode: 'LOW' }));
            expect(a.low.digits).toEqual([1, 4, 9]);
            expect(a.target).toBe(1);
            const c4 = { 0: 13, 1: 5, 2: 5, 3: 16, 4: 5, 5: 13, 6: 13, 7: 12, 8: 13, 9: 5 };
            const b = analyzeHighLowTie(buildWindow(c4, [0, 2, 2]), opts({ mode: 'LOW' }));
            expect(b.low.digits).toEqual([1, 2, 4, 9]);
            expect(b.target).toBe(2);
        });

        it('reports NO_TIE when the selected mode has no tie', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3]), opts({ mode: 'LOW' }));
            expect(a.target).toBeNull();
            expect(a.status).toBe(STATUS.NO_TIE);
        });
    });

    describe('tie tolerance', () => {
        const o1000 = (x = {}) => opts({ analysis_window: 1000, ...x });

        it('H / I: 12.0% vs 12.3% tie at 0.5 and not at 0', () => {
            const ticks = buildWindow(HIGH_TOL);
            const on = analyzeHighLowTie(ticks, o1000({ mode: 'HIGH', tie_tolerance: 0.5 }));
            expect(on.high.digits).toEqual([3, 6]);
            const off = analyzeHighLowTie(ticks, o1000({ mode: 'HIGH', tie_tolerance: 0 }));
            expect(off.status).toBe(STATUS.NO_TIE);
        });

        it('V: the boundary is inclusive and applied the same way to HIGH and LOW', () => {
            const high_ticks = buildWindow(HIGH_TOL);
            expect(analyzeHighLowTie(high_ticks, o1000({ mode: 'HIGH', tie_tolerance: 0.3 })).high.digits).toEqual([
                3, 6,
            ]);
            expect(analyzeHighLowTie(high_ticks, o1000({ mode: 'HIGH', tie_tolerance: 0.29 })).high.exists).toBe(
                false
            );
            const low_ticks = buildWindow(LOW_TOL);
            expect(analyzeHighLowTie(low_ticks, o1000({ mode: 'LOW', tie_tolerance: 0.3 })).low.digits).toEqual([
                0, 1,
            ]);
            expect(analyzeHighLowTie(low_ticks, o1000({ mode: 'LOW', tie_tolerance: 0.29 })).low.exists).toBe(false);
        });

        it('T: occurrence count decides a tolerance tie before repetition (HIGH keeps the higher count)', () => {
            // Neither candidate appears in the last 5 ticks, so Recent Appearances does not decide.
            const a = analyzeHighLowTie(
                buildWindow(HIGH_TOL, [1, 3, 3, 3, 2, 4, 5, 7, 8]),
                o1000({ mode: 'HIGH', tie_tolerance: 0.5, recent_ticks: 5 })
            );
            expect(a.features[3].repeats).toBeGreaterThan(a.features[6].repeats);
            expect(a.target).toBe(6);
            expect(a.high.decider).toBe('Occurrence Count');
        });

        it('occurrence count decides a LOW tolerance tie (LOW keeps the lower count)', () => {
            const a = analyzeHighLowTie(
                buildWindow(LOW_TOL, [2, 1, 1, 1, 3, 4, 5, 6, 7]),
                o1000({ mode: 'LOW', tie_tolerance: 0.3, recent_ticks: 5 })
            );
            expect(a.features[1].repeats).toBeGreaterThan(a.features[0].repeats);
            expect(a.target).toBe(0);
            expect(a.low.decider).toBe('Occurrence Count');
        });
    });

    describe('tie-breakers', () => {
        it('applies recent appearances → count → repetition → recency in order', () => {
            const base = { pct: 14, count: 14, recent_count: 0, repeats: 0, last_seen: 5 };
            const recent = breakTie(
                [
                    { ...base, digit: 3, recent_count: 4, count: 14, repeats: 0, last_seen: 9 },
                    { ...base, digit: 6, recent_count: 6, count: 13, repeats: 5, last_seen: 0 },
                ],
                'HIGH',
                50
            );
            expect(recent.selected?.digit).toBe(6);
            expect(recent.decider?.label).toBe('Recent Appearances');
            expect(recent.reason).toBe('Recent Appearances 6=6 vs 3=4');

            const count = breakTie(
                [
                    { ...base, digit: 3, count: 14, repeats: 5 },
                    { ...base, digit: 6, count: 15, repeats: 0 },
                ],
                'HIGH'
            );
            expect(count.selected?.digit).toBe(6);
            expect(count.decider?.label).toBe('Occurrence Count');

            const low_count = breakTie(
                [
                    { ...base, digit: 3, count: 4 },
                    { ...base, digit: 6, count: 5 },
                ],
                'LOW'
            );
            expect(low_count.selected?.digit).toBe(3);

            const repetition = breakTie(
                [
                    { ...base, digit: 3, repeats: 2, last_seen: 9 },
                    { ...base, digit: 6, repeats: 1, last_seen: 0 },
                ],
                'HIGH'
            );
            expect(repetition.selected?.digit).toBe(3);
            expect(repetition.decider?.label).toBe('Repetition');

            const recency = breakTie(
                [
                    { ...base, digit: 3, last_seen: 9 },
                    { ...base, digit: 6, last_seen: 2 },
                ],
                'HIGH'
            );
            expect(recency.selected?.digit).toBe(6);
            expect(recency.decider?.label).toBe('Recency');

            const equal = breakTie(
                [
                    { ...base, digit: 3, last_seen: Infinity },
                    { ...base, digit: 6, last_seen: Infinity },
                ],
                'HIGH'
            );
            expect(equal.selected).toBeNull();
        });

        it('G / L: identical statistics after every tie-breaker give no trade', () => {
            const absent: Counts = { 0: 12, 1: 12, 2: 12, 3: 13, 4: 0, 5: 12, 6: 13, 7: 12, 8: 14, 9: 0 };
            const two = analyzeHighLowTie(buildWindow(absent), opts({ mode: 'LOW' }));
            expect(two.low.digits).toEqual([4, 9]);
            expect(two.target).toBeNull();
            expect(two.status).toBe(STATUS.TIE_UNRESOLVED);

            const three = analyzeHighLowTie(buildWindow(UNRESOLVED_LOW, [0, 3, 3]), opts({ mode: 'LOW' }));
            expect(three.low.digits).toEqual([1, 4, 9]);
            expect(three.target).toBeNull();
            expect(three.status).toBe(STATUS.TIE_UNRESOLVED);
        });
    });

    describe('AUTO mode', () => {
        it('E: compares same-window scores when both ties exist', () => {
            const a = analyzeHighLowTie(buildWindow(BOTH, [1, 3, 3, 2, 9, 9]), opts({ mode: 'AUTO' }));
            expect(a.high.selected).toBe(3);
            expect(a.low.selected).toBe(9);
            expect(a.auto?.high_score).toBeCloseTo(42.47, 2);
            expect(a.auto?.low_score).toBeCloseTo(52.5, 2);
            expect(a.target).toBe(9);
            expect(a.target_type).toBe('LOW');
        });

        it('trades the only tie that exists', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3]), opts({ mode: 'AUTO' }));
            expect(a.auto).toBeNull();
            expect(a.target).toBe(3);
        });

        it('M: unresolved HIGH + resolved LOW gives no trade', () => {
            const decision = selectHighLowTarget({
                high: { type: 'HIGH', exists: true, digits: [3, 7], selected: null, reason: '3 and 7 equal' },
                low: { type: 'LOW', exists: true, digits: [1, 4, 9], selected: 1, reason: 'Repetition' },
                features: [],
                options: opts({ mode: 'AUTO' }),
                window_size: 100,
            });
            expect(decision.status).toBe(STATUS.TIE_UNRESOLVED);
            expect(decision.target).toBeNull();
        });

        it('N: resolved HIGH + unresolved LOW gives no trade', () => {
            const ticks = buildWindow(UNRESOLVED_LOW, [0, 3, 3]);
            const a = analyzeHighLowTie(ticks, opts({ mode: 'AUTO' }));
            expect(a.high.selected).toBe(3);
            expect(a.low.selected).toBeNull();
            expect(a.status).toBe(STATUS.TIE_UNRESOLVED);
            const result = evaluateHighLowTie(ticks, opts({ mode: 'AUTO' }), createHighLowTieState());
            expect(result.contract_type).toBeNull();
            expect(result.prediction).toBe(-1);
        });

        it('HIGH mode ignores an unresolved LOW tie outside its scope', () => {
            const a = analyzeHighLowTie(buildWindow(UNRESOLVED_LOW, [0, 3, 3]), opts({ mode: 'HIGH' }));
            expect(a.target).toBe(3);
        });

        it('Q: equal AUTO scores give no trade, compared unrounded with a float tolerance', () => {
            const features: Record<
                number,
                { digit: number; count: number; pct: number; repeats: number; last_seen: number }
            > = {};
            // 12% with floating-point noise vs exactly 8%: mathematically equal scores.
            features[6] = { digit: 6, count: 12, pct: 12 + 1e-12, repeats: 0, last_seen: Infinity };
            features[9] = { digit: 9, count: 8, pct: 8, repeats: 0, last_seen: Infinity };
            expect(rawScoreCandidate(features[6], 'HIGH', 100)).not.toBe(rawScoreCandidate(features[9], 'LOW', 100));
            const decision = selectHighLowTarget({
                high: { type: 'HIGH', exists: true, digits: [3, 6], selected: 6, reason: 'Recency' },
                low: { type: 'LOW', exists: true, digits: [4, 9], selected: 9, reason: 'Recency' },
                features,
                options: opts({ mode: 'AUTO' }),
                window_size: 100,
            });
            expect(decision.status).toBe(STATUS.AUTO_EQUAL);
            expect(decision.target).toBeNull();
        });

        it('scores are deterministic and use only window data', () => {
            const ticks = buildWindow(BOTH, [1, 3, 3, 2, 9, 9]);
            const first = analyzeHighLowTie(ticks, opts());
            const second = analyzeHighLowTie([...ticks], opts());
            expect(second.auto).toEqual(first.auto);
            const f = first.features[9];
            expect(rawScoreCandidate(f, 'LOW', 100)).toBeCloseTo(
                80 * ((10 - f.pct) / 10) + 10 * (f.repeats / (f.count - 1)) + 10 * (1 - f.last_seen / 100),
                9
            );
        });
    });

    describe('no extreme', () => {
        it('O: all ten digits equal gives NO_EXTREME_TIE in every mode', () => {
            const ticks = buildWindow(FLAT);
            ['HIGH', 'LOW', 'AUTO'].forEach(mode => {
                const a = analyzeHighLowTie(ticks, opts({ mode }));
                expect(a.status).toBe(STATUS.NO_EXTREME_TIE);
                expect(a.target).toBeNull();
            });
        });

        it('completely overlapping HIGH and LOW groups (via tolerance) give NO_EXTREME_TIE', () => {
            const a = analyzeHighLowTie(buildWindow(HIGH, [1, 3, 3]), opts({ tie_tolerance: 10 }));
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
            const ticks = buildWindow(HIGH, [1, 3, 3], HEAD);
            const first = evaluateHighLowTie(ticks, opts({ mode: 'HIGH' }), state);
            expect(first.status).toBe(STATUS.AWAITING_CONFIRMATION);
            expect(first.matched).toBe(false);

            const next = [...ticks, 0];
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
            const ticks = buildWindow(HIGH, [1, 3, 3], HEAD);
            evaluateHighLowTie(ticks, opts({ mode: 'HIGH' }), state);
            const gone = evaluateHighLowTie([...ticks, 3], opts({ mode: 'HIGH' }), state);
            expect(gone.status).toBe(STATUS.SETUP_CANCELLED);
            expect(gone.matched).toBe(false);
        });

        it('J / U: a changed target cancels the old setup and re-confirms the new one', () => {
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [1, 6, 3], [6, 0]);
            const first = evaluateHighLowTie(ticks, opts({ mode: 'HIGH' }), state);
            expect(first.status).toBe(STATUS.AWAITING_CONFIRMATION);
            // A new 6 replaces the oldest 6: counts unchanged, 6 is now most recent → target flips to 6.
            const changed = evaluateHighLowTie([...ticks, 6], opts({ mode: 'HIGH' }), state);
            expect(changed.status).toBe(STATUS.SETUP_CANCELLED);
            expect(changed.matched).toBe(false);
            expect(changed.prediction).toBe(-1);
            const reconfirmed = evaluateHighLowTie([...ticks, 6, 0], opts({ mode: 'HIGH' }), state);
            expect(reconfirmed.status).toBe(STATUS.VALID_SIGNAL);
            expect(reconfirmed.prediction).toBe(6);
        });

        it('applies the cooldown after a trade', () => {
            const o = opts({ mode: 'HIGH', signal_cooldown_tips: 1 });
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [1, 3, 3], HEAD);
            evaluateHighLowTie(ticks, o, state);
            expect(evaluateHighLowTie([...ticks, 0], o, state).prediction).toBe(3);
            expect(evaluateHighLowTie([...ticks, 0, 2], o, state).status).toBe(STATUS.COOLDOWN_ACTIVE);
        });

        it('does not repeat a setup that was already traded', () => {
            const o = opts({ mode: 'HIGH', signal_cooldown_tips: 0 });
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [1, 3, 3], HEAD);
            evaluateHighLowTie(ticks, o, state);
            expect(evaluateHighLowTie([...ticks, 0], o, state).prediction).toBe(3);
            const again = evaluateHighLowTie([...ticks, 0, 2], o, state);
            expect(again.status).toBe(STATUS.SETUP_ALREADY_TRADED);
            expect(again.matched).toBe(false);
        });
    });

    describe('contract settlement', () => {
        const signalThen = () => {
            const o = opts({ mode: 'HIGH', journal_enabled: true });
            const state = createHighLowTieState();
            const ticks = withEpochs([...buildWindow(HIGH, [1, 3, 3], HEAD), 0]);
            evaluateHighLowTie(ticks.slice(0, -1), o, state);
            const signal = evaluateHighLowTie(ticks, o, state);
            return { o, state, ticks, signal, signal_epoch: ticks[ticks.length - 1].epoch };
        };

        it('P: the journal result comes from the actual contract, not the first tick after the signal', () => {
            const { o, state, ticks, signal, signal_epoch } = signalThen();
            expect(signal.prediction).toBe(3);

            const after = [...ticks, { digit: 2, epoch: signal_epoch + 1 }];
            const no_contract = evaluateHighLowTie(after, o, state);
            expect(no_contract.live.trades).toBe(0);
            expect(no_contract.settled).toBeNull();

            recordHighLowTieContract(state, {
                contract_id: 991,
                is_sold: 1,
                status: 'lost',
                barrier: '3',
                purchase_time: signal_epoch + 1,
                exit_tick_display_value: '1234.53',
                profit: -0.5,
            });
            const reported = evaluateHighLowTie([...after, { digit: 0, epoch: signal_epoch + 2 }], o, state);
            expect(reported.live).toMatchObject({ trades: 1, wins: 0, losses: 1, streak: -1 });
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
        it('shows only the Analysis Window, the full digit table, tie, tie-break and selection for a HIGH trade', () => {
            const o = opts({ mode: 'HIGH', journal_enabled: true });
            const state = createHighLowTieState();
            const ticks = buildWindow(HIGH, [1, 3, 3], HEAD);
            evaluateHighLowTie(ticks, o, state);
            const text = journalText(evaluateHighLowTie([...ticks, 0], o, state));
            expect(text).toContain('ANALYSIS WINDOW: 100 TICKS | RECENT TICKS: 100 | TIE TOLERANCE: 0%');
            expect(text).toContain('DIGIT | COUNT | % | LAST 100');
            expect(text).toContain('3 | 14 | 14.0% | 14');
            expect(text).toContain('9 | 13 | 13.0% | 13');
            expect(text).toContain('HIGH TIE: 3, 6 @ 14.00%');
            expect(text).toContain('HIGH TIE-BREAK: Repetition (REPETITION: 3 = 1 repeat, 6 = 0 repeats)');
            expect(text).toContain('HIGH SELECTED: 3');
            expect(text).toContain('TRADE: DIFFERS 3');
            expect(text).toContain('SOURCE: HIGH TIE');
            expect(text).toContain('TIE CANDIDATES: 3, 6');
            expect(text).toContain('TIE PERCENTAGE: 14.00%');
            expect(text).toContain('TIE-BREAK: Repetition');
            expect(text).not.toMatch(/micro/i);
        });

        it('shows the Recent Appearances tie-break', () => {
            const o = opts({ mode: 'HIGH', recent_ticks: 8, journal_enabled: true });
            const ticks = buildWindow(HIGH, [6, 1, 6, 2, 6, 4, 3, 3]);
            const text = journalText(evaluateHighLowTie(ticks, o, createHighLowTieState()));
            expect(text).toContain('DIGIT | COUNT | % | LAST 8');
            expect(text).toContain('HIGH TIE-BREAK: Recent Appearances (LAST 8: 3 = 2, 6 = 3)');
            expect(text).toContain('HIGH SELECTED: 6');
        });

        it('shows both ties, AUTO scores, source and live stats for an AUTO trade', () => {
            const o = opts({ journal_enabled: true });
            const state = createHighLowTieState();
            const ticks = buildWindow(BOTH, [1, 3, 3, 2, 9, 9], HEAD);
            evaluateHighLowTie(ticks, o, state);
            const text = journalText(evaluateHighLowTie([...ticks, 0], o, state));
            expect(text).toContain('HIGH-LOW TIE DIFFERS (AUTO)');
            expect(text).toContain('HIGH TIE: 3, 6 @ 14.00%');
            expect(text).toContain('LOW TIE: 4, 9 @ 5.00%');
            expect(text).toContain('LOW TIE-BREAK: Repetition (REPETITION: 4 = 0 repeats, 9 = 1 repeat)');
            expect(text).toMatch(/AUTO: High-Tie 3 score \d+\.\d\d vs Low-Tie 9 score \d+\.\d\d → target 9/);
            expect(text).toContain('TRADE: DIFFERS 9');
            expect(text).toContain('SOURCE: LOW TIE');
            expect(text).toContain('HIGH CANDIDATE: 3');
            expect(text).toMatch(/HIGH SCORE: \d+\.\d\d/);
            expect(text).toContain('LOW CANDIDATE: 9');
            expect(text).toMatch(/LOW SCORE: \d+\.\d\d/);
            expect(text).toContain('Last Result: — | Trades: 0 | Wins: 0 | Losses: 0 | Win rate: 0.0% | Streak: 0');
            expect(text).not.toMatch(/micro/i);
        });

        it('explains NO_EXTREME_TIE and TIE_UNRESOLVED', () => {
            const flat = evaluateHighLowTie(buildWindow(FLAT), opts({ journal_enabled: true }), createHighLowTieState());
            expect(journalText(flat)).toContain('WHY NO TRADE? NO_EXTREME_TIE');
            const unresolved = evaluateHighLowTie(
                buildWindow(UNRESOLVED_LOW, [0, 3, 3]),
                opts({ journal_enabled: true }),
                createHighLowTieState()
            );
            const text = journalText(unresolved);
            expect(text).toContain('LOW SELECTED: none (no clear candidate)');
            expect(text).toContain('WHY NO TRADE? TIE_UNRESOLVED — LOW tie 1, 4, 9');
        });
    });

    it('replays without look-ahead and tallies every simulated trade', () => {
        let seed = 7;
        const ticks = Array.from({ length: 1500 }, () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return Math.floor(seed / 65536) % 10;
        });
        const report = replayHighLowTie(ticks, { analysis_window: 100 });
        expect(report.trades).toBe(report.wins + report.losses);
        expect(report.valid_signals).toBeGreaterThanOrEqual(report.trades);
        report.signals.forEach(signal => expect(signal.target).toBeGreaterThanOrEqual(0));
    });
});
