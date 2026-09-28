import {
    STATUS,
    createTopTwoDigitGapState,
    evaluateTopTwoDigitGap,
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
    it('defaults to 1000-tick window, 0.5 gap, cooldown 1', () => {
        const o = normalizeTopTwoDigitGapOptions({});
        expect(o.analysis_window).toBe(1000);
        expect(o.gap_threshold).toBe(0.5);
        expect(o.gap_mode).toBe('max');
        expect(o.signal_cooldown_tips).toBe(1);
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

    it('waits until the window is full', () => {
        const result = evaluateTopTwoDigitGap([3, 3, 5], opts(), createTopTwoDigitGapState());
        expect(result.status).toBe(STATUS.COLLECTING);
        expect(result.why_no_trade).toMatch(/3\/200/);
    });

    it('keeps the signal on a same-tip epoch re-poll and settles on the next tip', () => {
        const state = createTopTwoDigitGapState();
        const ticks = buildWindow(BASE, 3).map((digit, i) => ({ digit, epoch: i + 1 }));
        expect(evaluateTopTwoDigitGap(ticks, opts(), state).prediction).toBe(5);
        expect(evaluateTopTwoDigitGap(ticks, opts(), state).prediction).toBe(5);
        evaluateTopTwoDigitGap([...ticks.slice(1), { digit: 8, epoch: ticks.length + 1 }], opts(), state);
        expect(state.live.wins).toBe(1);
    });

    it('replays sequentially and only Differs a top-two digit', () => {
        const history = [...buildWindow(BASE, 3), 3, 5, 5, 3, 1];
        const report = replayTopTwoDigitGap(history, opts());
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.signals.every(s => [3, 5].includes(s.target) && s.target !== s.current)).toBe(true);
        expect(report.wins + report.losses).toBe(report.trades);
    });
});
