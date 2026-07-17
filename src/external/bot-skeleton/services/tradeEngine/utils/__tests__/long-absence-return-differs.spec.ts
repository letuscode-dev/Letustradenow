import {
    PURCHASE_LEAD_TICKS,
    createTrackerState,
    evaluateLongAbsenceReturnDiffers,
    formatDashboard,
    formatDigitDashboard,
    openLongAbsenceReturnActiveTrade,
    processDigitTick,
    releaseLongAbsenceReturnActiveTrade,
} from '../long-absence-return-differs';

const toHistory = (digits: number[]) => digits.map((digit, i) => ({ epoch: i + 1, digit }));

/** Initialize digit, wait absenceCount ticks, then return it. */
const buildReturnSequence = (digit: number, absenceCount: number) => {
    const other = (digit + 1) % 10;
    const seq = [digit];
    for (let i = 0; i < absenceCount; i++) seq.push(other);
    seq.push(digit);
    return seq;
};

const runUntilFire = (
    history: { epoch: number; digit: number }[],
    digit: number,
    opts: Record<string, unknown>,
    state: ReturnType<typeof createTrackerState>
) => {
    let epoch = history[history.length - 1].epoch;
    let result = evaluateLongAbsenceReturnDiffers(history, opts, state);
    const fire_tick = state.digits[digit].fireTick;
    const other = (digit + 1) % 10;

    while (fire_tick != null && state.tickIndex < fire_tick) {
        epoch += 1;
        history.push({ epoch, digit: other });
        result = evaluateLongAbsenceReturnDiffers(history, opts, state);
    }
    return result;
};

const baseOpts = {
    min_absence_threshold: 20,
    max_absence_threshold: 0,
    return_delay: 2,
    cancel_on_early_reappearance: true,
    required_return_confirmations: 1,
    confirmation_window: 5,
    max_signal_age: 0,
    journal_enabled: false,
    dashboard_enabled: false,
    one_active_trade_only: true,
};

describe('processDigitTick / long absence return', () => {
    it('detects a return after the minimum absence threshold', () => {
        const state = createTrackerState();
        buildReturnSequence(8, 25).forEach(d => processDigitTick(state, d, baseOpts));
        const ds = state.digits[8];
        expect(ds.schedulePhase).toBe('countdown');
        expect(ds.returnAbsenceDuration).toBe(25);
        expect(ds.lastCompletedAbsence).toBe(25);
    });

    it('schedules fire and target ticks from the return delay', () => {
        const state = createTrackerState();
        buildReturnSequence(8, 25).forEach(d => processDigitTick(state, d, baseOpts));
        const ds = state.digits[8];
        const return_tick = ds.returnDetectedTick;
        expect(ds.targetTick).toBe(return_tick + 2 + 1);
        expect(ds.fireTick).toBe(ds.targetTick - PURCHASE_LEAD_TICKS);
    });

    it('cancels when the digit reappears during the delay', () => {
        const state = createTrackerState();
        const opts = { ...baseOpts, journal_enabled: true };
        buildReturnSequence(8, 25).forEach(d => processDigitTick(state, d, opts));
        expect(state.digits[8].schedulePhase).toBe('countdown');

        processDigitTick(state, 8, opts);
        expect(state.digits[8].schedulePhase).toBe('none');
        expect(state.pendingJournal.some(m => String(m.message).includes('Signal cancelled'))).toBe(true);
    });

    it('keeps countdown when early cancellation is disabled', () => {
        const state = createTrackerState();
        const opts = { ...baseOpts, cancel_on_early_reappearance: false };
        buildReturnSequence(8, 25).forEach(d => processDigitTick(state, d, opts));
        const fire_tick = state.digits[8].fireTick;
        processDigitTick(state, 8, opts);
        expect(state.digits[8].schedulePhase).toBe('countdown');
        expect(state.digits[8].fireTick).toBe(fire_tick);
    });
});

describe('evaluateLongAbsenceReturnDiffers', () => {
    it('fires DIFFER on the purchase lead tick after the return delay', () => {
        const state = createTrackerState();
        const history = toHistory(buildReturnSequence(8, 25));
        evaluateLongAbsenceReturnDiffers(history, baseOpts, state);
        const result = runUntilFire(history, 8, baseOpts, state);
        expect(result.prediction).toBe(8);
        expect(state.digits[8].schedulePhase).toBe('none');
    });

    it('requires a second appearance before starting the delay when confirmations are 2', () => {
        const state = createTrackerState();
        const opts = { ...baseOpts, required_return_confirmations: 2, confirmation_window: 5 };
        const history = toHistory(buildReturnSequence(8, 25));
        evaluateLongAbsenceReturnDiffers(history, opts, state);
        expect(state.digits[8].schedulePhase).toBe('confirming');

        let epoch = history.length;
        epoch += 1;
        history.push({ epoch, digit: 9 });
        evaluateLongAbsenceReturnDiffers(history, opts, state);
        expect(state.digits[8].schedulePhase).toBe('confirming');

        epoch += 1;
        history.push({ epoch, digit: 8 });
        evaluateLongAbsenceReturnDiffers(history, opts, state);
        expect(state.digits[8].schedulePhase).toBe('countdown');

        const result = runUntilFire(history, 8, opts, state);
        expect(result.prediction).toBe(8);
    });

    it('blocks while an open trade is active', () => {
        const state = createTrackerState();
        const history = toHistory(buildReturnSequence(8, 25));
        const opts = { ...baseOpts, journal_enabled: true };
        evaluateLongAbsenceReturnDiffers(history, opts, state);
        runUntilFire(history, 8, opts, state);
        openLongAbsenceReturnActiveTrade(state);

        const result = evaluateLongAbsenceReturnDiffers(history, opts, state);
        expect(result.prediction).toBe(-1);
        expect(result.journal_messages.some(m => m.message.includes('Blocked'))).toBe(true);
        releaseLongAbsenceReturnActiveTrade(state);
    });

    it('renders dashboard details for an active signal', () => {
        const state = createTrackerState();
        buildReturnSequence(8, 25).forEach(d => processDigitTick(state, d, baseOpts));
        const table = formatDashboard(state, 8);
        expect(table).toContain('Digit 8');
        expect(table).toContain('Return detected: Yes');
        expect(table).toContain('Status: Waiting');
        expect(formatDigitDashboard(state.digits[8], state.tickIndex)).toContain('Last completed absence: 25');
    });

    it('does not flood journal when syncing a large tick window', () => {
        const state = createTrackerState();
        const digits = Array.from({ length: 120 }, (_, i) => i % 10);
        const result = evaluateLongAbsenceReturnDiffers(
            digits,
            { ...baseOpts, journal_enabled: true },
            state
        );
        expect(result.journal_messages.length).toBeLessThanOrEqual(8);
        expect(state.tickIndex).toBe(119);
    });
});
