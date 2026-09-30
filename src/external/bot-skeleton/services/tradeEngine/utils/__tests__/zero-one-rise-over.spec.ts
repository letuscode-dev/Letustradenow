import {
    createZeroOneRiseState,
    evaluateZeroOneRise,
    normalizeZeroOneRiseOptions,
    parseTargetDigits,
    replayZeroOneRise,
    STATUS,
} from '../zero-one-rise-over';

const WINDOW = 200;

const opts = (overrides = {}) =>
    normalizeZeroOneRiseOptions({
        target_digits: '0,1',
        analysis_window: WINDOW,
        compare_lookback: 1,
        barrier: 1,
        signal_cooldown_tips: 0,
        journal_enabled: false,
        ...overrides,
    });

// 201 ticks cycling 0–9; index 1 (the tick that slides out when the tip arrives) is a 5.
const base = () => {
    const ticks = Array.from({ length: WINDOW + 1 }, (_, i) => i % 10);
    ticks[1] = 5;
    return ticks;
};

const withTip = (digit: number) => [...base(), digit];

describe('zero/one rise over', () => {
    it('defaults: target digit 0, 120-tick window, compare 1 tick back, Over 1', () => {
        const o = normalizeZeroOneRiseOptions({});
        expect(o.target_digits).toEqual([0]);
        expect(o.analysis_window).toBe(120);
        expect(o.compare_lookback).toBe(1);
        expect(o.barrier).toBe(1);
    });

    it.each([
        ['0,1,5', [0, 1, 5]],
        [' 7 , 3 ', [7, 3]],
        ['1,1,2', [1, 2]],
        ['0,x,12,4', [0, 4]],
        ['', [0]],
        ['abc', [0]],
        [5, [5]],
        ['0,1,2,3,4,5,6,7,8,9', [0, 1, 2, 3, 4, 5, 6, 7, 8]],
    ])('parses target digits %p → %p', (input, expected) => {
        expect(parseTargetDigits(input)).toEqual(expected);
    });

    it('default target 0 ignores digit 1 rising', () => {
        const defaults = { target_digits: undefined };
        expect(evaluateZeroOneRise(withTip(0), opts(defaults), createZeroOneRiseState()).matched).toBe(true);
        const result = evaluateZeroOneRise(withTip(1), opts(defaults), createZeroOneRiseState());
        expect(result.status).toBe(STATUS.NO_RISE);
        expect(result.why_no_trade).toMatch(/\(0\)/);
    });

    describe('differ mode', () => {
        const differ = (overrides = {}) => opts({ trade_mode: 'differ', ...overrides });

        it('Differs the current digit when a target digit rises', () => {
            const result = evaluateZeroOneRise(withTip(0), differ(), createZeroOneRiseState());
            expect(result.status).toBe(STATUS.VALID_SIGNAL);
            expect(result.prediction).toBe(0);
            expect(result.contract_type).toBe('DIGITDIFF');
        });

        it('uses the user targets and ignores other digits', () => {
            const hit = evaluateZeroOneRise(withTip(7), differ({ target_digits: '3,7' }), createZeroOneRiseState());
            expect(hit.prediction).toBe(7);
            const miss = evaluateZeroOneRise(withTip(8), differ({ target_digits: '3,7' }), createZeroOneRiseState());
            expect(miss.status).toBe(STATUS.NO_RISE);
        });

        it('settles as a Differs contract (win when the next digit is different)', () => {
            const state = createZeroOneRiseState();
            const ticks = withTip(0).map((digit, i) => ({ digit, epoch: i + 1 }));
            evaluateZeroOneRise(ticks, differ(), state);
            evaluateZeroOneRise([...ticks, { digit: 1, epoch: ticks.length + 1 }], differ(), state);
            expect(state.live.wins).toBe(1);

            const state2 = createZeroOneRiseState();
            evaluateZeroOneRise(ticks, differ(), state2);
            evaluateZeroOneRise([...ticks, { digit: 0, epoch: ticks.length + 1 }], differ(), state2);
            expect(state2.live.losses).toBe(1);
        });

        it('replay always Differs the digit that just appeared', () => {
            const report = replayZeroOneRise([...withTip(0), 1, 0, 5, 1, 0], differ());
            expect(report.valid_signals).toBeGreaterThan(0);
            expect(report.signals.every(s => s.prediction === s.current)).toBe(true);
        });
    });

    it('over mode stays the default', () => {
        expect(normalizeZeroOneRiseOptions({}).trade_mode).toBe('over');
        expect(normalizeZeroOneRiseOptions({ trade_mode: 'nonsense' }).trade_mode).toBe('over');
    });

    it('trades on any user target digit rising', () => {
        const result = evaluateZeroOneRise(withTip(7), opts({ target_digits: '3,7' }), createZeroOneRiseState());
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.rising).toEqual([7]);
        expect(result.now.map(n => n.digit)).toEqual([3, 7]);
    });

    it.each([0, 1])('enters OVER 1 when digit %i rises in %', digit => {
        const result = evaluateZeroOneRise(withTip(digit), opts(), createZeroOneRiseState());
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
        expect(result.rising).toContain(digit);
        expect(result.prediction).toBe(1);
        expect(result.contract_type).toBe('DIGITOVER');
    });

    it('does not trade when neither 0 nor 1 rises', () => {
        const result = evaluateZeroOneRise(withTip(7), opts(), createZeroOneRiseState());
        expect(result.status).toBe(STATUS.NO_RISE);
        expect(result.matched).toBe(false);
    });

    it('does not trade when the dropped tick was the same digit (% unchanged)', () => {
        // Window slides: the tick leaving the window is also 0 → digit 0 % is flat.
        const ticks = base();
        ticks[1] = 0;
        const result = evaluateZeroOneRise([...ticks, 0], opts(), createZeroOneRiseState());
        expect(result.now[0].pct).toBeCloseTo(result.prev[0].pct);
        expect(result.status).toBe(STATUS.NO_RISE);
    });

    it('uses the recovery barrier passed in by risk management', () => {
        const result = evaluateZeroOneRise(withTip(0), opts({ barrier: 2 }), createZeroOneRiseState());
        expect(result.prediction).toBe(2);
    });

    it('only waits while history is still loading', () => {
        const result = evaluateZeroOneRise([0, 1, 0], opts(), createZeroOneRiseState());
        expect(result.status).toBe(STATUS.COLLECTING);
    });

    it('works on a partial window instead of waiting for it to fill', () => {
        const result = evaluateZeroOneRise(withTip(0), opts({ analysis_window: 1000 }), createZeroOneRiseState());
        expect(result.status).toBe(STATUS.VALID_SIGNAL);
    });

    it('never re-trades a same-tip re-poll and settles on the next tick', () => {
        const state = createZeroOneRiseState();
        const ticks = withTip(0).map((digit, i) => ({ digit, epoch: i + 1 }));
        expect(evaluateZeroOneRise(ticks, opts(), state).prediction).toBe(1);
        const repoll = evaluateZeroOneRise(ticks, opts({ journal_enabled: true }), state);
        expect(repoll.status).toBe(STATUS.SIGNAL_CONSUMED);
        expect(repoll.journal_messages).toEqual([]);

        evaluateZeroOneRise([...ticks, { digit: 1, epoch: ticks.length + 1 }], opts(), state);
        expect(state.live.losses).toBe(1); // 1 is not over 1
    });

    it('replay uses OVER 2 after a loss and OVER 1 after a win', () => {
        const digits = [...withTip(0), 1, 5, 0, 0, 1, 9, 1, 0, 3];
        const report = replayZeroOneRise(digits, { ...opts(), recovery_barrier: 2 });
        expect(report.valid_signals).toBeGreaterThan(3);
        expect(report.signals.some(s => s.barrier === 2)).toBe(true);

        let expected = 1;
        let pending: { tip: number; barrier: number } | null = null;
        const by_tip = new Map(report.signals.map(s => [s.tip, s]));
        digits.forEach((digit, i) => {
            if (pending) {
                expected = digit > pending.barrier ? 1 : 2;
                pending = null;
            }
            const signal = by_tip.get(i);
            if (signal) {
                expect(signal.barrier).toBe(expected);
                pending = signal;
            }
        });
    });
});
