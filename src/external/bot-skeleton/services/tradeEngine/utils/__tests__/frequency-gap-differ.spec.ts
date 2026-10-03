import {
    analyzeFrequencyGap,
    createFrequencyGapState,
    evaluateFrequencyGap,
    normalizeFrequencyGapOptions,
    recordFrequencyGapContract,
    replayFrequencyGap,
    STATUS,
} from '../frequency-gap-differ';

/** Interleave digits by remaining count so the window has exactly the requested counts. */
const buildWindow = (counts: Record<number, number>): number[] => {
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

const FIXTURE_A = { 3: 30, 7: 28, 1: 12, 0: 18, 2: 18, 4: 19, 5: 19, 6: 18, 8: 19, 9: 19 };
const FIXTURE_B = { 3: 28, 1: 18, 0: 21, 2: 19, 4: 19, 5: 19, 6: 19, 7: 19, 8: 19, 9: 19 };
const FIXTURE_C = { 3: 30, 7: 30, 1: 12, 0: 18, 2: 18, 4: 18, 5: 18, 6: 18, 8: 19, 9: 19 };
const FIXTURE_D = { 3: 30, 7: 28, 1: 12, 8: 12, 0: 20, 2: 20, 4: 20, 5: 20, 6: 19, 9: 19 };
const FIXTURE_E = { 3: 40, 7: 26, 1: 10, 0: 18, 2: 18, 4: 18, 5: 18, 6: 18, 8: 18, 9: 16 };
const FIXTURE_F = Object.fromEntries(Array.from({ length: 10 }, (_, d) => [d, 20]));

const opts = { analysis_window: 200, min_gap: 7, confirmation: false, journal_enabled: true };

const run = (counts: Record<number, number>, options: Record<string, unknown> = {}) =>
    evaluateFrequencyGap(buildWindow(counts), { ...opts, ...options }, createFrequencyGapState());

const journalText = (result: { journal_messages: { message: string }[] }) =>
    result.journal_messages.map(m => m.message).join('\n');

describe('Frequency Gap Differs — fixtures', () => {
    it.each([
        ['A', FIXTURE_A],
        ['B', FIXTURE_B],
        ['C', FIXTURE_C],
        ['D', FIXTURE_D],
        ['E', FIXTURE_E],
        ['F', FIXTURE_F],
    ])('fixture %s has exactly 200 ticks', (_name, counts) => {
        expect(buildWindow(counts as Record<number, number>)).toHaveLength(200);
    });
});

describe('Frequency Gap Differs — regression tests', () => {
    it('A: dominant 15%, second 14%, weakest 6%, minimum 7% → trade DIFFER 3', () => {
        const result = run(FIXTURE_A);
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.prediction).toBe(3);
        expect(result.contract_type).toBe('DIGITDIFF');
        expect(result.dominant).toBe(3);
        expect(result.weakest).toBe(1);
        expect(result.gap).toBeCloseTo(9, 9);
    });

    it('B: gap 5% below minimum 7% → no trade', () => {
        const result = run(FIXTURE_B);
        expect(result.gap).toBeCloseTo(5, 9);
        expect(result.status).toBe(STATUS.GAP_TOO_SMALL);
        expect(result.prediction).toBe(-1);
    });

    it('C: dominant digit tied → no trade', () => {
        const result = run(FIXTURE_C);
        expect(result.status).toBe(STATUS.DOMINANT_TIED);
        expect(result.prediction).toBe(-1);
    });

    it('D: weakest digit tied → no trade', () => {
        const result = run(FIXTURE_D);
        expect(result.status).toBe(STATUS.WEAKEST_TIED);
        expect(result.prediction).toBe(-1);
    });

    it('E: dominant 20%, second 13%, weakest 5% → trade DIFFER 3', () => {
        const result = run(FIXTURE_E);
        expect(result.gap).toBeCloseTo(15, 9);
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.prediction).toBe(3);
    });

    it('F: all digits 10% → no trade', () => {
        const result = run(FIXTURE_F);
        expect(result.status).toBe(STATUS.ALL_EQUAL);
        expect(result.prediction).toBe(-1);
    });

    it('G: minimum gap 10%, actual gap 9% → no trade', () => {
        const result = run(FIXTURE_A, { min_gap: 10 });
        expect(result.status).toBe(STATUS.GAP_TOO_SMALL);
        expect(result.prediction).toBe(-1);
    });

    it('H: minimum gap 9%, actual gap 9% → trade (inclusive)', () => {
        const result = run(FIXTURE_A, { min_gap: 9 });
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.prediction).toBe(3);
    });

    it('never targets the weakest digit', () => {
        [FIXTURE_A, FIXTURE_E].forEach(counts => {
            const result = run(counts);
            expect(result.prediction).not.toBe(result.weakest);
            expect(result.prediction).toBe(result.dominant);
        });
    });
});

describe('Frequency Gap Differs — single window and settings', () => {
    it('only the last Analysis Window ticks are counted', () => {
        const window = buildWindow(FIXTURE_A);
        const older = Array.from({ length: 300 }, () => 1);
        const result = evaluateFrequencyGap([...older, ...window], opts, createFrequencyGapState());
        expect(result.prediction).toBe(3);
        expect(result.percentages[1]).toBeCloseTo(6, 9);
    });

    it('does not trade until the window is full', () => {
        const result = evaluateFrequencyGap(buildWindow(FIXTURE_A).slice(1), opts, createFrequencyGapState());
        expect(result.status).toBe(STATUS.COLLECTING);
        expect(result.prediction).toBe(-1);
    });

    it('clamps the Analysis Window to the minimum of 50 and journals it', () => {
        const options = normalizeFrequencyGapOptions({ analysis_window: 20 });
        expect(options.analysis_window).toBe(50);
        expect(options.adjustments[0]).toMatchObject({ setting: 'Analysis Window', requested: 20, actual: 50 });
    });

    it('defaults: window 200, minimum gap 7%, enabled, confirmation on', () => {
        const options = normalizeFrequencyGapOptions({});
        expect(options).toMatchObject({ analysis_window: 200, min_gap: 7, enabled: true, confirmation: true });
    });

    it('disabled strategy never trades', () => {
        const result = run(FIXTURE_A, { enabled: false });
        expect(result.status).toBe(STATUS.DISABLED);
        expect(result.prediction).toBe(-1);
    });

    it('analysis is deterministic', () => {
        const digits = buildWindow(FIXTURE_A);
        const a = analyzeFrequencyGap(digits, opts);
        const b = analyzeFrequencyGap(digits, opts);
        expect(a).toEqual(b);
    });
});

describe('Frequency Gap Differs — new-tick confirmation', () => {
    const confirm = { ...opts, confirmation: true };

    it('arms on the first tick and trades when the next tick keeps the same setup', () => {
        const state = createFrequencyGapState();
        const window = buildWindow(FIXTURE_A);
        const first = evaluateFrequencyGap(window, confirm, state);
        expect(first.status).toBe(STATUS.AWAITING_CONFIRMATION);
        expect(first.prediction).toBe(-1);

        const second = evaluateFrequencyGap([...window, window[0]], confirm, state);
        expect(second.status).toBe(STATUS.VALID_SIGNAL);
        expect(second.prediction).toBe(3);
        expect(second.confirmation_status).toBe('CONFIRMED');
    });

    it('cancels when the next tick breaks the setup', () => {
        const state = createFrequencyGapState();
        const window = buildWindow(FIXTURE_A);
        evaluateFrequencyGap(window, { ...confirm, min_gap: 9 }, state);
        expect(window[0]).toBe(0);
        // The new tick (1) replaces the oldest (0): weakest digit 1 rises to 13 → gap 8.5% < 9%.
        const next = evaluateFrequencyGap([...window, 1], { ...confirm, min_gap: 9 }, state);
        expect(next.status).toBe(STATUS.SETUP_CANCELLED);
        expect(next.prediction).toBe(-1);
        expect(next.confirmation_status).toBe('CANCELLED');
    });

    it('re-polls of the same tick do not trade twice', () => {
        const state = createFrequencyGapState();
        const window = buildWindow(FIXTURE_A);
        const first = evaluateFrequencyGap(window, opts, state);
        expect(first.prediction).toBe(3);
        const again = evaluateFrequencyGap(window, opts, state);
        expect(again.status).toBe(STATUS.SIGNAL_CONSUMED);
        expect(again.prediction).toBe(-1);
    });
});

describe('Frequency Gap Differs — journal and results', () => {
    it('journal records window, dominant, weakest, gap, minimum, condition and target', () => {
        const text = journalText(run(FIXTURE_A));
        expect(text).toContain('FREQUENCY GAP DIFFERS');
        expect(text).toContain('Window: 200 ticks');
        expect(text).toContain('Dominant: Digit 3 | Count: 30 | Frequency: 15.00%');
        expect(text).toContain('Weakest: Digit 1 | Count: 12 | Frequency: 6.00%');
        expect(text).toContain('Frequency Gap: 9.00% | Minimum Gap: 7%');
        expect(text).toContain('Condition: PASSED');
        expect(text).toContain('Target: DIFFER 3');
    });

    it('journal explains why there is no trade', () => {
        const text = journalText(run(FIXTURE_B));
        expect(text).toContain('Condition: FAILED');
        expect(text).toContain('WHY NO TRADE? GAP_TOO_SMALL');
    });

    it('records WIN/LOSS from the settled purchased contract only', () => {
        const state = createFrequencyGapState();
        const window = buildWindow(FIXTURE_A);
        evaluateFrequencyGap(window, opts, state);
        expect(state.pending_outcome?.target).toBe(3);

        expect(recordFrequencyGapContract(state, { contract_id: 1, status: 'open', barrier: '3' })).toBeNull();
        expect(recordFrequencyGapContract(state, { contract_id: 2, is_sold: 1, status: 'won', barrier: '5' })).toBeNull();
        const settled = recordFrequencyGapContract(state, {
            contract_id: 3,
            is_sold: 1,
            status: 'won',
            barrier: '3',
            profit: 0.05,
            exit_tick_display_value: '123.47',
        });
        expect(settled).toMatchObject({ result: 'WIN', target: 3, actual: 7 });
        expect(state.live).toMatchObject({ trades: 1, wins: 1, losses: 0 });
        expect(recordFrequencyGapContract(state, { contract_id: 3, is_sold: 1, status: 'won', barrier: '3' })).toBeNull();
    });

    it('replay produces signals and settled results without look-ahead', () => {
        const window = buildWindow(FIXTURE_A);
        const report = replayFrequencyGap([...window, window[0], window[1]], opts);
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.trades).toBe(report.wins + report.losses);
    });
});
