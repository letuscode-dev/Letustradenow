import {
    PURCHASE_LEAD_TICKS,
    SELECTION_FIRST,
    SELECTION_LARGEST_ADAPTIVE,
    createTrackerState,
    evaluateAdaptiveDigitGap,
    formatGapDashboard,
    openAdaptiveDigitGapActiveTrade,
    processDigitTick,
    releaseAdaptiveDigitGapActiveTrade,
    selectEligibleDigit,
    syncTrackerWithDigits,
} from '../adaptive-digit-gap';

/** Build digit → gap → digit → gap → digit (two equal consecutive gaps). */
const buildConfirmedPattern = (digit, gap) => {
    const other = (digit + 1) % 10;
    const seq = [digit];
    for (let i = 0; i < gap; i++) seq.push(other);
    seq.push(digit);
    for (let i = 0; i < gap; i++) seq.push(other);
    seq.push(digit);
    return seq;
};

const toHistory = digits => digits.map((digit, i) => ({ epoch: i + 1, digit }));

/** Append filler ticks until tickIndex reaches fireTick; returns last evaluate result. */
const runUntilFire = (history, digit, opts, state) => {
    let epoch = history[history.length - 1].epoch;
    let result = evaluateAdaptiveDigitGap(history, opts, state);
    const fire_tick = state.digits[digit].fireTick;
    const other = (digit + 1) % 10;

    while (state.tickIndex < fire_tick) {
        epoch += 1;
        history.push({ epoch, digit: other });
        result = evaluateAdaptiveDigitGap(history, opts, state);
    }
    return result;
};

describe('processDigitTick / repeated equal gaps', () => {
    it('records the first in-range gap without scheduling', () => {
        const state = createTrackerState();
        const opts = { min_adaptive_gap: 1, max_adaptive_gap: 20, journal_enabled: false };
        [7, 0, 1, 2, 3, 4, 7].forEach(d => processDigitTick(state, d, opts));
        expect(state.digits[7].lastGap).toBe(5);
        expect(state.digits[7].schedulePhase).toBe('none');
    });

    it('confirms two consecutive equal gaps and schedules a countdown', () => {
        const state = createTrackerState();
        const opts = { min_adaptive_gap: 1, max_adaptive_gap: 20, journal_enabled: false };
        buildConfirmedPattern(7, 5).forEach(d => processDigitTick(state, d, opts));

        const ds = state.digits[7];
        expect(ds.schedulePhase).toBe('countdown');
        expect(ds.scheduleGap).toBe(5);
        expect(ds.targetTick).toBe(state.tickIndex + 5 + 1);
        expect(ds.fireTick).toBe(ds.targetTick - PURCHASE_LEAD_TICKS);
        expect(ds.lastGap).toBeNull();
    });

    it('does not confirm when consecutive gaps differ', () => {
        const state = createTrackerState();
        const opts = { min_adaptive_gap: 1, max_adaptive_gap: 20, journal_enabled: false };
        [7, 0, 1, 2, 3, 4, 7, 0, 1, 2, 7].forEach(d => processDigitTick(state, d, opts));
        expect(state.digits[7].schedulePhase).toBe('none');
        expect(state.digits[7].lastGap).toBe(3);
    });

    it('cancels a scheduled signal when the digit appears early', () => {
        const state = createTrackerState();
        const opts = { min_adaptive_gap: 1, max_adaptive_gap: 20, journal_enabled: true };
        buildConfirmedPattern(7, 5).forEach(d => processDigitTick(state, d, opts));
        expect(state.digits[7].schedulePhase).toBe('countdown');

        processDigitTick(state, 0, opts);
        processDigitTick(state, 7, opts);

        expect(state.digits[7].schedulePhase).toBe('none');
        expect(state.pendingJournal.some(m => String(m.message).includes('cancelled'))).toBe(true);
    });
});

describe('evaluateAdaptiveDigitGap', () => {
    it('waits the confirmed gap then Differs one tick before the expected occurrence', () => {
        const state = createTrackerState();
        const opts = {
            journal_enabled: false,
            min_adaptive_gap: 5,
            max_adaptive_gap: 5,
            one_active_trade_only: false,
        };

        const pattern = buildConfirmedPattern(7, 5);
        const history = toHistory(pattern);
        let result = evaluateAdaptiveDigitGap(history, opts, state);
        expect(result.prediction).toBe(-1);
        expect(state.digits[7].schedulePhase).toBe('countdown');

        const fire_tick = state.digits[7].fireTick;
        const target_tick = state.digits[7].targetTick;
        expect(target_tick - fire_tick).toBe(PURCHASE_LEAD_TICKS);

        result = runUntilFire(history, 7, opts, state);
        expect(state.tickIndex).toBe(fire_tick);
        expect(result.prediction).toBe(7);
        expect(state.digits[7].schedulePhase).toBe('none');
    });

    it('journals first gap, confirmation, countdown, and trade placement', () => {
        const state = createTrackerState();
        const opts = {
            journal_enabled: true,
            min_adaptive_gap: 2,
            max_adaptive_gap: 2,
            one_active_trade_only: false,
        };

        const pattern = buildConfirmedPattern(3, 2);
        const history = toHistory(pattern);
        evaluateAdaptiveDigitGap(history, opts, state);

        const messages = state.lastJournal.map(m => m.message);
        expect(messages.some(m => m.includes('first gap recorded'))).toBe(true);
        expect(messages.some(m => m.includes('repeated gap confirmed'))).toBe(true);
        expect(messages.some(m => m.includes('Waiting 2 ticks'))).toBe(true);

        const result = runUntilFire(history, 3, opts, state);
        expect(result.prediction).toBe(3);
        expect(result.journal_messages.some(m => String(m.message).includes('trade placed'))).toBe(true);
    });

    it('does not Differs on a single gap (needs two equal consecutive gaps)', () => {
        const state = createTrackerState();
        const result = evaluateAdaptiveDigitGap(
            [7, 0, 1, 2, 3, 4, 7],
            { journal_enabled: false, min_adaptive_gap: 5, max_adaptive_gap: 5 },
            state
        );
        expect(result.prediction).toBe(-1);
        expect(state.digits[7].schedulePhase).toBe('none');
        expect(state.digits[7].lastGap).toBe(5);
    });

    it('ignores equal gaps outside min–max', () => {
        const state = createTrackerState();
        const result = evaluateAdaptiveDigitGap(
            buildConfirmedPattern(7, 3),
            { journal_enabled: false, min_adaptive_gap: 10, max_adaptive_gap: 15 },
            state
        );
        expect(result.prediction).toBe(-1);
        expect(state.digits[7].schedulePhase).toBe('none');
        expect(state.digits[7].lastGap).toBeNull();
    });

    it('cancels schedule when the digit appears before the wait completes', () => {
        const state = createTrackerState();
        const opts = { journal_enabled: true, min_adaptive_gap: 5, max_adaptive_gap: 5 };
        const history = toHistory(buildConfirmedPattern(7, 5));
        evaluateAdaptiveDigitGap(history, opts, state);
        expect(state.digits[7].schedulePhase).toBe('countdown');

        let epoch = history.length;
        epoch += 1;
        history.push({ epoch, digit: 0 });
        epoch += 1;
        history.push({ epoch, digit: 7 });
        const result = evaluateAdaptiveDigitGap(history, opts, state);

        expect(result.prediction).toBe(-1);
        expect(state.digits[7].schedulePhase).toBe('none');
        expect(result.journal_messages.some(m => String(m.message).includes('cancelled'))).toBe(true);
    });

    it('blocks new signals until active Differs is released when one_active_trade_only is on', () => {
        const state = createTrackerState();
        const opts = {
            journal_enabled: false,
            min_adaptive_gap: 2,
            max_adaptive_gap: 2,
            one_active_trade_only: true,
            selection_mode: SELECTION_FIRST,
        };

        const history = toHistory(buildConfirmedPattern(3, 2));
        let result = runUntilFire(history, 3, opts, state);
        expect(result.prediction).toBe(3);
        expect(state.activeTradePhase).toBe('signaled');

        openAdaptiveDigitGapActiveTrade(state);

        let epoch = history[history.length - 1].epoch;
        for (const digit of buildConfirmedPattern(5, 2)) {
            epoch += 1;
            history.push({ epoch, digit });
        }
        result = evaluateAdaptiveDigitGap(history, opts, state);

        if (state.digits[5].schedulePhase === 'countdown') {
            const fire_tick = state.digits[5].fireTick;
            while (state.tickIndex < fire_tick) {
                epoch += 1;
                history.push({ epoch, digit: 0 });
                result = evaluateAdaptiveDigitGap(history, opts, state);
            }
            expect(result.prediction).toBe(-1);
        }

        releaseAdaptiveDigitGapActiveTrade(state);
    });

    it('does not flood journal when syncing a large tick window', () => {
        const state = createTrackerState();
        const digits = Array.from({ length: 200 }, (_, i) => i % 10);
        const result = evaluateAdaptiveDigitGap(digits, { journal_enabled: true, min_adaptive_gap: 1 }, state);
        expect(result.journal_messages.length).toBeLessThanOrEqual(5);
        expect(state.tickIndex).toBe(199);
    });

    it('selects first eligible digit by default', () => {
        const digits = [
            {
                digit: 0,
                initialized: true,
                schedulePhase: 'countdown',
                scheduleGap: 2,
                fireTick: 10,
                targetTick: 11,
                tradePlacedThisCycle: false,
            },
            {
                digit: 1,
                initialized: true,
                schedulePhase: 'countdown',
                scheduleGap: 5,
                fireTick: 10,
                targetTick: 11,
                tradePlacedThisCycle: false,
            },
        ];
        const options = {
            min_adaptive_gap: 1,
            max_adaptive_gap: 20,
            one_trade_per_cycle: true,
            selection_mode: SELECTION_FIRST,
        };
        expect(selectEligibleDigit(digits, options, 10)).toBe(0);
        expect(selectEligibleDigit(digits, { ...options, selection_mode: SELECTION_LARGEST_ADAPTIVE }, 10)).toBe(1);
    });
});

describe('sliding tick cache', () => {
    it('keeps processing when history length is fixed and the window slides', () => {
        const state = createTrackerState();
        const opts = { journal_enabled: false, min_adaptive_gap: 1 };

        let window_ticks = [0, 1, 2, 3, 4].map((digit, i) => ({ epoch: i + 1, digit }));
        evaluateAdaptiveDigitGap(window_ticks, opts, state);
        expect(state.lastProcessedEpoch).toBe(5);
        expect(state.tickIndex).toBe(4);

        window_ticks = [1, 2, 3, 4, 7].map((digit, i) => ({ epoch: i + 2, digit }));
        evaluateAdaptiveDigitGap(window_ticks, opts, state);
        expect(state.lastProcessedEpoch).toBe(6);
        expect(state.tickIndex).toBe(5);

        window_ticks = [2, 3, 4, 7, 8].map((digit, i) => ({ epoch: i + 3, digit }));
        evaluateAdaptiveDigitGap(window_ticks, opts, state);
        expect(state.lastProcessedEpoch).toBe(7);
        expect(state.tickIndex).toBe(6);
    });
});

describe('formatGapDashboard', () => {
    it('renders a compact one-line status for all digits', () => {
        const state = createTrackerState();
        syncTrackerWithDigits(state, [1, 2, 1], { journal_enabled: false, min_adaptive_gap: 1 });
        const table = formatGapDashboard(state.digits, state.tickIndex);
        expect(table).toContain('1:');
        expect(table).toContain(' · ');
        expect(table.split('\n')).toHaveLength(1);
    });
});
