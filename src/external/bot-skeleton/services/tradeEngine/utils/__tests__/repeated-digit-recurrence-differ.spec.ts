import {
    STATUS,
    createRepeatedDigitRecurrenceState,
    evaluateRepeatedDigitRecurrence,
    normalizeRepeatedDigitRecurrenceOptions,
    replayRepeatedDigitRecurrence,
    resetRepeatedDigitRecurrenceState,
} from '../repeated-digit-recurrence-differ';

const opts = (overrides = {}) =>
    normalizeRepeatedDigitRecurrenceOptions({
        repetition_count: 3,
        min_previous_occurrences: 1,
        exact_run_matching: true,
        allow_entry_during_run: false,
        historical_differ_filter: false,
        recent_filter: false,
        journal_enabled: false,
        signal_cooldown_tips: 0,
        analysis_window: 500,
        ...overrides,
    });

describe('repeated digit recurrence differ', () => {
    it('defaults to ACTIVE settings', () => {
        const o = normalizeRepeatedDigitRecurrenceOptions({});
        expect(o.repetition_count).toBe(3);
        expect(o.min_previous_occurrences).toBe(1);
        expect(o.exact_run_matching).toBe(true);
        expect(o.allow_entry_during_run).toBe(false);
        expect(o.historical_differ_filter).toBe(false);
        expect(o.target_digits).toBe('ALL');
        expect(o.signal_cooldown_tips).toBe(1);
    });

    it('does not trade on first discovery of digit × N', () => {
        const state = createRepeatedDigitRecurrenceState();
        const history = [4, 8, 7, 7, 7];
        evaluateRepeatedDigitRecurrence(history.slice(0, 4), opts(), state);
        const atThird = evaluateRepeatedDigitRecurrence(history, opts(), state);
        expect(atThird.matched).toBe(false);
        expect(atThird.status).toBe(STATUS.FIRST_DISCOVERY);
        expect(atThird.why_no_trade).toMatch(/not occurred before|First discovery/i);
    });

    it('Differs the repeated digit when the pattern recurs', () => {
        const state = createRepeatedDigitRecurrenceState();
        // First 7×3 then break, then second 7×3
        const history = [4, 8, 7, 7, 7, 2, 5, 1, 7, 7, 7];
        evaluateRepeatedDigitRecurrence(history.slice(0, 6), opts(), state); // settle first occurrence with 2
        // Continue through second run build-up
        for (let i = 6; i < history.length - 1; i++) {
            evaluateRepeatedDigitRecurrence(history.slice(0, i + 1), opts(), state);
        }
        const live = evaluateRepeatedDigitRecurrence(history, opts(), state);
        expect(live.matched).toBe(true);
        expect(live.prediction).toBe(7);
        expect(live.contract_type).toBe('DIGITDIFF');
        expect(live.status).toBe(STATUS.VALID_SIGNAL);
    });

    it('records DIFFER win/loss on the next tip without look-ahead', () => {
        const state = createRepeatedDigitRecurrenceState();
        const base = [4, 8, 7, 7, 7, 2, 5, 1, 7, 7, 7];
        for (let i = 0; i < base.length; i++) {
            evaluateRepeatedDigitRecurrence(base.slice(0, i + 1), opts(), state);
        }
        expect(state.pending_settlement?.is_trade).toBe(true);
        evaluateRepeatedDigitRecurrence([...base, 3], opts(), state);
        expect(state.live.wins).toBe(1);
        expect(state.live.losses).toBe(0);
    });

    it('only one signal during an overlong run', () => {
        const state = createRepeatedDigitRecurrenceState();
        // Seed one prior 7×3
        const seed = [7, 7, 7, 1];
        for (let i = 0; i < seed.length; i++) {
            evaluateRepeatedDigitRecurrence(seed.slice(0, i + 1), opts(), state);
        }
        // Long run of 7s
        const long = [...seed, 7, 7, 7, 7, 7];
        let signals = 0;
        for (let i = seed.length; i < long.length; i++) {
            const r = evaluateRepeatedDigitRecurrence(long.slice(0, i + 1), opts(), state);
            if (r.matched) signals += 1;
        }
        expect(signals).toBe(1);
    });

    it('explains insufficient previous occurrences', () => {
        const state = createRepeatedDigitRecurrenceState();
        const history = [1, 1, 1, 0, 1, 1, 1];
        for (let i = 0; i < history.length; i++) {
            evaluateRepeatedDigitRecurrence(
                history.slice(0, i + 1),
                opts({ min_previous_occurrences: 2 }),
                state
            );
        }
        const live = evaluateRepeatedDigitRecurrence(
            history,
            opts({ min_previous_occurrences: 2 }),
            state
        );
        // Second occurrence with min=2 still needs 2 previous → blocked
        expect(live.matched).toBe(false);
        expect(live.why_no_trade).toMatch(/Need 2|previous|occurrences|First discovery/i);
    });

    it('respects target digit filter', () => {
        const state = createRepeatedDigitRecurrenceState();
        const history = [3, 3, 3, 1, 3, 3, 3];
        for (let i = 0; i < history.length; i++) {
            evaluateRepeatedDigitRecurrence(
                history.slice(0, i + 1),
                opts({ target_digits: '7' }),
                state
            );
        }
        const live = evaluateRepeatedDigitRecurrence(history, opts({ target_digits: '7' }), state);
        expect(live.matched).toBe(false);
    });

    it('preserves signal on same-tip epoch re-poll', () => {
        const state = createRepeatedDigitRecurrenceState();
        const toEpoch = digits => digits.map((digit, i) => ({ digit, epoch: i + 1 }));
        const history = [4, 8, 7, 7, 7, 2, 5, 1, 7, 7, 7];
        for (let i = 0; i < history.length; i++) {
            evaluateRepeatedDigitRecurrence(toEpoch(history.slice(0, i + 1)), opts(), state);
        }
        const fire = evaluateRepeatedDigitRecurrence(toEpoch(history), opts(), state);
        expect(fire.prediction).toBe(7);
        const again = evaluateRepeatedDigitRecurrence(toEpoch(history), opts(), state);
        expect(again.prediction).toBe(7);
    });

    it('resets state in place', () => {
        const state = createRepeatedDigitRecurrenceState();
        evaluateRepeatedDigitRecurrence([1, 1, 1], opts(), state);
        resetRepeatedDigitRecurrenceState(state);
        expect(state.run_length).toBe(0);
        expect(state.bootstrapped).toBe(false);
    });

    it('replays history and produces Differ signals without look-ahead', () => {
        const history = [];
        // Several 7×3 cycles
        for (let i = 0; i < 6; i++) history.push(7, 7, 7, i % 2 === 0 ? 2 : 4);
        const report = replayRepeatedDigitRecurrence(history, opts({ signal_cooldown_tips: 1 }));
        expect(report.valid_signals).toBeGreaterThan(0);
        expect(report.trades).toBeGreaterThan(0);
        expect(report.signals.every(s => s.digit === 7)).toBe(true);
        expect(report.wins + report.losses).toBe(report.trades);
    });
});
