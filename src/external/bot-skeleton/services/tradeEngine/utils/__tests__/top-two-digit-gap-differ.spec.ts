import {
    MAX_ANALYSIS_WINDOW,
    STATUS,
    createTopTwoDigitGapState,
    evaluateTopTwoDigitGap,
    mergeDigitTicks,
    normalizeTopTwoDigitGapOptions,
    replayTopTwoDigitGap,
} from '../top-two-digit-gap-differ';

// 200-tick window → each occurrence is 0.5pp.
const WINDOW = 200;

const opts = (overrides = {}) =>
    normalizeTopTwoDigitGapOptions({
        analysis_window: WINDOW,
        gap_threshold: 0.5,
        gap_mode: 'max',
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

// Digit 3 = 30 (15%), digit 5 = 29 (14.5%) → gap 0.5pp; rest below.
const BASE = { 0: 18, 1: 18, 2: 18, 3: 30, 4: 18, 5: 29, 6: 18, 7: 18, 8: 18, 9: 15 };

describe('top two digit gap differ', () => {
    it('defaults to 1000-tick window, gap > 0.3, cooldown 1', () => {
        const o = normalizeTopTwoDigitGapOptions({});
        expect(o.analysis_window).toBe(1000);
        expect(o.gap_threshold).toBe(0.3);
        expect(o.gap_mode).toBe('min');
        expect(o.signal_cooldown_tips).toBe(1);
    });

    it('default min mode trades only when the gap is greater than the threshold', () => {
        const wide = { ...BASE, 3: 34, 9: 11 }; // gap 2.5pp
        const hit = evaluateTopTwoDigitGap(buildWindow(wide, 3), opts({ gap_mode: 'min' }), createTopTwoDigitGapState());
        expect(hit.status).toBe(STATUS.VALID_SIGNAL);
        expect(hit.prediction).toBe(5);

        const equal = evaluateTopTwoDigitGap(buildWindow(BASE, 3), opts({ gap_mode: 'min' }), createTopTwoDigitGapState());
        expect(equal.status).toBe(STATUS.GAP_NOT_MET);
        expect(equal.why_no_trade).toMatch(/must be > 0.5pp/);
    });

    it('default 0.3 threshold trades a 0.5pp gap and rejects a tie', () => {
        const defaults = { gap_mode: undefined, gap_threshold: undefined };
        const hit = evaluateTopTwoDigitGap(buildWindow(BASE, 3), opts(defaults), createTopTwoDigitGapState());
        expect(hit.prediction).toBe(5);

        const tied = { ...BASE, 5: 30, 9: 14 }; // gap 0
        const miss = evaluateTopTwoDigitGap(buildWindow(tied, 3), opts(defaults), createTopTwoDigitGapState());
        expect(miss.status).toBe(STATUS.GAP_NOT_MET);
        expect(miss.why_no_trade).toMatch(/must be > 0.3pp/);
    });

    it('Differs the second digit when the current digit is the most appearing', () => {
        const result = evaluateTopTwoDigitGap(buildWindow(BASE, 3), opts(), createTopTwoDigitGapState());
        expect(result.top1.digit).toBe(3);
        expect(result.top2.digit).toBe(5);
        expect(result.gap).toBeCloseTo(0.5);
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.prediction).toBe(5);
    });

    it('Differs the most appearing digit when the current digit is the second', () => {
        const result = evaluateTopTwoDigitGap(buildWindow(BASE, 5), opts(), createTopTwoDigitGapState());
        expect(result.prediction).toBe(3);
    });

    it('does not trade when the current digit is not one of the top two', () => {
        const result = evaluateTopTwoDigitGap(buildWindow(BASE, 0), opts(), createTopTwoDigitGapState());
        expect(result.matched).toBe(false);
        expect(result.status).toBe(STATUS.CURRENT_NOT_TOP_TWO);
    });

    it('does not trade when the gap is too large', () => {
        const wide = { ...BASE, 3: 34, 9: 11 }; // gap 2.5pp
        const result = evaluateTopTwoDigitGap(buildWindow(wide, 3), opts(), createTopTwoDigitGapState());
        expect(result.matched).toBe(false);
        expect(result.status).toBe(STATUS.GAP_NOT_MET);
    });

    it('exact mode requires the gap to equal the threshold', () => {
        const tied = { ...BASE, 5: 30, 9: 14 }; // gap 0
        const max = evaluateTopTwoDigitGap(buildWindow(tied, 3), opts(), createTopTwoDigitGapState());
        expect(max.matched).toBe(true);
        const exact = evaluateTopTwoDigitGap(
            buildWindow(tied, 3),
            opts({ gap_mode: 'exact' }),
            createTopTwoDigitGapState()
        );
        expect(exact.status).toBe(STATUS.GAP_NOT_MET);
        const exactHit = evaluateTopTwoDigitGap(
            buildWindow(BASE, 3),
            opts({ gap_mode: 'exact' }),
            createTopTwoDigitGapState()
        );
        expect(exactHit.prediction).toBe(5);
    });

    it('only waits while history is still loading (fewer than 100 ticks)', () => {
        const result = evaluateTopTwoDigitGap([3, 3, 5], opts(), createTopTwoDigitGapState());
        expect(result.status).toBe(STATUS.COLLECTING);
        expect(result.why_no_trade).toMatch(/3\/200/);
    });

    it('calculates on a partial window instead of waiting for it to fill', () => {
        const result = evaluateTopTwoDigitGap(
            buildWindow(BASE, 3),
            opts({ analysis_window: 1000 }),
            createTopTwoDigitGapState()
        );
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.prediction).toBe(5);
    });

    it('caps the window at the 5000-tick history limit', () => {
        expect(normalizeTopTwoDigitGapOptions({ analysis_window: 20000 }).analysis_window).toBe(MAX_ANALYSIS_WINDOW);
    });

    it('merges history with live ticks by epoch and keeps the newest window', () => {
        const history = [1, 2, 3, 4].map((digit, i) => ({ epoch: 100 + i, digit }));
        const live = [
            { epoch: 102, digit: 3 },
            { epoch: 103, digit: 4 },
            { epoch: 104, digit: 9 },
        ];
        const merged = mergeDigitTicks(history, live, 4);
        expect(merged.map(t => t.epoch)).toEqual([101, 102, 103, 104]);
        expect(merged.map(t => t.digit)).toEqual([2, 3, 4, 9]);
    });

    it('recalculates percentages as each new tick slides the window', () => {
        const state = createTopTwoDigitGapState();
        let ticks = buildWindow(BASE, 3).map((digit, i) => ({ digit, epoch: i + 1 }));
        const first = evaluateTopTwoDigitGap(ticks, opts(), state);
        expect(first.top1.digit).toBe(3);
        [5, 5, 5].forEach((digit, i) => {
            ticks = mergeDigitTicks(ticks, [{ digit, epoch: WINDOW + 1 + i }], WINDOW);
        });
        const next = evaluateTopTwoDigitGap(ticks, opts(), state);
        expect(next.top1.digit).toBe(5);
    });

    it('never re-trades a signal on a same-tip re-poll and settles on the next tip', () => {
        const state = createTopTwoDigitGapState();
        const ticks = buildWindow(BASE, 3).map((digit, i) => ({ digit, epoch: i + 1 }));
        const first = evaluateTopTwoDigitGap(ticks, opts({ journal_enabled: true }), state);
        expect(first.prediction).toBe(5);
        expect(first.journal_messages.length).toBeGreaterThan(0);

        const repoll = evaluateTopTwoDigitGap(ticks, opts({ journal_enabled: true }), state);
        expect(repoll.prediction).toBe(-1);
        expect(repoll.status).toBe(STATUS.SIGNAL_CONSUMED);
        expect(repoll.journal_messages).toEqual([]);

        evaluateTopTwoDigitGap([...ticks.slice(1), { digit: 8, epoch: ticks.length + 1 }], opts(), state);
        expect(state.live.wins).toBe(1);
    });

    it('settles on the tick right after the signal even when a poll skips ticks', () => {
        const state = createTopTwoDigitGapState();
        const ticks = buildWindow(BASE, 3).map((digit, i) => ({ digit, epoch: i + 1 }));
        evaluateTopTwoDigitGap(ticks, opts(), state);
        const n = ticks.length;
        const later = [...ticks.slice(2), { digit: 5, epoch: n + 1 }, { digit: 1, epoch: n + 2 }];
        evaluateTopTwoDigitGap(later, opts(), state);
        expect(state.live.losses).toBe(1);
        expect(state.live.wins).toBe(0);
    });

    it('skips when second place is tied', () => {
        const tie = { ...BASE, 5: 29, 7: 29, 0: 17, 9: 5 }; // 5 and 7 tied for second
        const total = Object.values(tie).reduce((a, b) => a + b, 0);
        expect(total).toBe(WINDOW);
        const result = evaluateTopTwoDigitGap(buildWindow(tie, 3), opts(), createTopTwoDigitGapState());
        expect(result.status).toBe(STATUS.TOP_TWO_AMBIGUOUS);
        expect(result.matched).toBe(false);
    });

    it('replays sequentially and only Differs a top-two digit', () => {
        const history = [...buildWindow(BASE, 3), 3, 5, 5, 3, 1];
        const report = replayTopTwoDigitGap(history, opts());
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.signals.every(s => s.target !== s.current)).toBe(true);
        const full_window = report.signals.filter(s => s.tip >= WINDOW - 1);
        expect(full_window.length).toBeGreaterThan(0);
        expect(full_window.every(s => [3, 5].includes(s.target))).toBe(true);
        expect(report.wins + report.losses).toBe(report.trades);
    });
});
