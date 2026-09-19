import {
    STATUS,
    createMissingDigitReturnState,
    evaluateMissingDigitReturn,
    normalizeMissingDigitReturnOptions,
    replayMissingDigitReturn,
    resetMissingDigitReturnState,
} from '../missing-digit-return-differ';

const opts = (overrides = {}) =>
    normalizeMissingDigitReturnOptions({
        missing_period: 20,
        signal_cooldown_tips: 0,
        journal_enabled: false,
        analysis_window: 500,
        ...overrides,
    });

describe('missing digit return differ', () => {
    it('defaults missing period to 20 with cooldown 1', () => {
        const o = normalizeMissingDigitReturnOptions({});
        expect(o.missing_period).toBe(20);
        expect(o.signal_cooldown_tips).toBe(1);
        expect(o.target_digits).toBe('ALL');
    });

    it('Differs a digit that returns after the configured absence', () => {
        const state = createMissingDigitReturnState();
        // Seed digit 7, then 20 other tips, then 7 returns
        const history = [7];
        for (let i = 0; i < 20; i++) history.push((i + 1) % 7); // 1..6 cycling, never 7
        history.push(7);

        for (let i = 0; i < history.length - 1; i++) {
            evaluateMissingDigitReturn(history.slice(0, i + 1), opts(), state);
        }
        const live = evaluateMissingDigitReturn(history, opts(), state);
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(7);
        expect(live.absence).toBe(20);
        expect(live.status).toBe(STATUS.VALID_SIGNAL);
    });

    it('does not trade when absence is below threshold', () => {
        const state = createMissingDigitReturnState();
        const history = [7, 1, 2, 3, 7]; // only 3 missing
        for (let i = 0; i < history.length; i++) {
            evaluateMissingDigitReturn(history.slice(0, i + 1), opts({ missing_period: 20 }), state);
        }
        const live = evaluateMissingDigitReturn(history, opts({ missing_period: 20 }), state);
        expect(live.matched).toBe(false);
        expect(live.why_no_trade).toMatch(/only|Required|below|threshold|3/i);
    });

    it('settles DIFFER outcome on the next tip', () => {
        const state = createMissingDigitReturnState();
        const history = [7];
        for (let i = 0; i < 20; i++) history.push((i + 1) % 7);
        history.push(7);
        for (let i = 0; i < history.length; i++) {
            evaluateMissingDigitReturn(history.slice(0, i + 1), opts(), state);
        }
        expect(state.pending_outcome?.target).toBe(7);
        evaluateMissingDigitReturn([...history, 3], opts(), state);
        expect(state.live.wins).toBe(1);
    });

    it('preserves signal on same-tip epoch re-poll', () => {
        const state = createMissingDigitReturnState();
        const toEpoch = digits => digits.map((digit, i) => ({ digit, epoch: i + 1 }));
        const history = [7];
        for (let i = 0; i < 20; i++) history.push((i + 1) % 7);
        history.push(7);
        for (let i = 0; i < history.length; i++) {
            evaluateMissingDigitReturn(toEpoch(history.slice(0, i + 1)), opts(), state);
        }
        const fire = evaluateMissingDigitReturn(toEpoch(history), opts(), state);
        expect(fire.prediction).toBe(7);
        const again = evaluateMissingDigitReturn(toEpoch(history), opts(), state);
        expect(again.prediction).toBe(7);
    });

    it('resets state in place', () => {
        const state = createMissingDigitReturnState();
        evaluateMissingDigitReturn([1, 2, 3], opts(), state);
        resetMissingDigitReturnState(state);
        expect(state.bootstrapped).toBe(false);
        expect(state.last_seen.every(x => x === -1)).toBe(true);
    });

    it('replays history and produces Differ signals', () => {
        const history = [];
        for (let cycle = 0; cycle < 4; cycle++) {
            history.push(9);
            for (let i = 0; i < 20; i++) history.push(i % 8);
            history.push(9);
            history.push(1); // settle
        }
        const report = replayMissingDigitReturn(history, opts({ signal_cooldown_tips: 1 }));
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.signals.some(s => s.digit === 9)).toBe(true);
        expect(report.trades).toBeGreaterThan(0);
    });
});
