import {
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

describe('processDigitTick / waiting gaps', () => {
    it('measures completed wait when a digit reappears', () => {
        // 3, 8, 5, 1, 3 → waited 3 ticks for 3 to return
        const state = createTrackerState();
        [3, 8, 5, 1, 3].forEach(d => processDigitTick(state, d));

        expect(state.digits[3].completedGap).toBe(3);
        expect(state.digits[3].currentGap).toBe(0);
        expect(state.digits[3].pendingSignal).toBe(true);
    });

    it('keeps counting other digits while waiting', () => {
        const state = createTrackerState();
        [3, 7, 2, 8, 5, 3].forEach(d => processDigitTick(state, d));
        expect(state.digits[3].completedGap).toBe(4);
        expect(state.digits[3].pendingSignal).toBe(true);

        [9, 1, 6, 4].forEach(d => processDigitTick(state, d));
        expect(state.digits[3].currentGap).toBe(4);
        // Pending stays until traded or replaced by a new completion.
        expect(state.digits[3].pendingSignal).toBe(true);
    });

    it('replaces the completed wait on the next reappearance', () => {
        const state = createTrackerState();
        [3, 7, 2, 8, 5, 3].forEach(d => processDigitTick(state, d));
        [9, 1, 6, 4, 0, 2, 8, 3].forEach(d => processDigitTick(state, d));
        expect(state.digits[3].completedGap).toBe(7);
        expect(state.digits[3].pendingSignal).toBe(true);
        expect(state.digits[3].currentGap).toBe(0);
    });
});

describe('evaluateAdaptiveDigitGap', () => {
    it('Differs when a digit reappears after a wait inside min–max', () => {
        const state = createTrackerState();
        // Waited 3 ticks → Differs 3 immediately on reappearance (min=1)
        const result = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3], { journal_enabled: false, min_adaptive_gap: 1 }, state);
        expect(state.digits[3].completedGap).toBe(3);
        expect(result.prediction).toBe(3);
    });

    it('does not Differs when the waited gap is below min', () => {
        const state = createTrackerState();
        const result = evaluateAdaptiveDigitGap(
            [3, 8, 5, 1, 3],
            { journal_enabled: false, min_adaptive_gap: 5, max_adaptive_gap: 20 },
            state
        );
        expect(state.digits[3].completedGap).toBe(3);
        expect(result.prediction).toBe(-1);
        expect(state.digits[3].pendingSignal).toBe(false);
    });

    it('example: wait 10 ticks for digit 3 then Differs 3', () => {
        const state = createTrackerState();
        // First 3, then 10 other digits, then 3 again → gap 10
        const digits = [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 0, 3];
        const result = evaluateAdaptiveDigitGap(
            digits,
            { journal_enabled: false, min_adaptive_gap: 10, max_adaptive_gap: 20 },
            state
        );
        expect(state.digits[3].completedGap).toBe(10);
        expect(result.prediction).toBe(3);
    });

    it('only signals once per digit cycle when one_trade_per_cycle is on', () => {
        const state = createTrackerState();
        const opts = { journal_enabled: false, min_adaptive_gap: 1, one_trade_per_cycle: true };

        evaluateAdaptiveDigitGap([3, 8, 5, 1, 3], opts, state);
        expect(state.digits[3].tradePlacedThisCycle).toBe(true);
        expect(state.digits[3].pendingSignal).toBe(false);

        const again = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3, 0], opts, state);
        expect(again.prediction).not.toBe(3);
    });

    it('still trades other digits when one digit is locked for its cycle (one_active off)', () => {
        const state = createTrackerState();
        const opts = {
            journal_enabled: false,
            min_adaptive_gap: 1,
            one_trade_per_cycle: true,
            one_active_trade_only: false,
            selection_mode: SELECTION_FIRST,
        };

        evaluateAdaptiveDigitGap([3, 8, 5, 1, 3], opts, state);
        expect(state.digits[3].tradePlacedThisCycle).toBe(true);

        // Digit 7 completes a wait of 2
        const result = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3, 7, 9, 8, 7], opts, state);
        expect(state.digits[7].completedGap).toBe(2);
        expect(result.prediction).toBe(7);
    });

    it('blocks new signals until active Differs is released when one_active_trade_only is on', () => {
        const state = createTrackerState();
        const opts = {
            journal_enabled: false,
            min_adaptive_gap: 1,
            one_trade_per_cycle: true,
            one_active_trade_only: true,
            selection_mode: SELECTION_FIRST,
        };

        const first = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3], opts, state);
        expect(first.prediction).toBe(3);
        expect(state.activeTradePhase).toBe('signaled');

        openAdaptiveDigitGapActiveTrade(state);

        const blocked = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3, 7, 9, 8, 7], opts, state);
        expect(state.digits[7].completedGap).toBe(2);
        expect(blocked.prediction).toBe(-1);

        releaseAdaptiveDigitGapActiveTrade(state);

        const after = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3, 7, 9, 8, 7], opts, state);
        expect(after.prediction).toBe(7);
    });

    it('journals a short Differs line with the waited gap', () => {
        const state = createTrackerState();
        const result = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3], { journal_enabled: true, min_adaptive_gap: 1 }, state);
        expect(result.journal_messages.some(m => String(m.message).startsWith('Differs '))).toBe(true);
        expect(result.journal_messages.some(m => String(m.message).includes('waited gap'))).toBe(true);
    });

    it('does not flood journal when syncing a large tick window', () => {
        const state = createTrackerState();
        const digits = Array.from({ length: 200 }, (_, i) => i % 10);
        const result = evaluateAdaptiveDigitGap(digits, { journal_enabled: true, min_adaptive_gap: 1 }, state);
        expect(result.journal_messages.length).toBeLessThanOrEqual(2);
        expect(state.tickIndex).toBe(199);
    });

    it('selects first eligible digit by default', () => {
        const digits = [
            createDigitStateLike(0, { completedGap: 2, pendingSignal: true }),
            createDigitStateLike(1, { completedGap: 5, pendingSignal: true }),
        ];
        const options = {
            min_adaptive_gap: 1,
            max_adaptive_gap: 20,
            one_trade_per_cycle: true,
            selection_mode: SELECTION_FIRST,
        };
        expect(selectEligibleDigit(digits, options)).toBe(0);
        expect(selectEligibleDigit(digits, { ...options, selection_mode: SELECTION_LARGEST_ADAPTIVE })).toBe(1);
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
        syncTrackerWithDigits(state, [1, 2, 1], { journal_enabled: false });
        const table = formatGapDashboard(state.digits);
        expect(table).toContain('1:0/1');
        expect(table).toContain(' · ');
        expect(table.split('\n')).toHaveLength(1);
    });
});

function createDigitStateLike(digit, overrides) {
    return {
        digit,
        initialized: true,
        currentGap: 0,
        completedGap: null,
        adaptiveTriggerGap: null,
        lastOccurrenceTick: 0,
        pendingSignal: false,
        tradePlacedThisCycle: false,
        ...overrides,
    };
}
