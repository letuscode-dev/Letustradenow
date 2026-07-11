import {
    SELECTION_FIRST,
    SELECTION_HIGHEST_EXCESS,
    SELECTION_LARGEST_ADAPTIVE,
    createTrackerState,
    evaluateAdaptiveDigitGap,
    formatGapDashboard,
    processDigitTick,
    selectEligibleDigit,
    syncTrackerWithDigits,
} from '../adaptive-digit-gap';

describe('processDigitTick / adaptive gaps', () => {
    it('sets adaptive trigger from completed gap on second occurrence', () => {
        // Spec example: 3, 8, 5, 1, 3 → completed gap for 3 = 3
        const state = createTrackerState();
        [3, 8, 5, 1, 3].forEach(d => processDigitTick(state, d, { journal_enabled: false }));

        expect(state.digits[3].adaptiveTriggerGap).toBe(3);
        expect(state.digits[3].currentGap).toBe(0);
        expect(state.digits[3].completedGap).toBe(3);
    });

    it('increments other digits and adapts after each completed cycle', () => {
        const state = createTrackerState();
        [3, 7, 2, 8, 5, 3].forEach(d => processDigitTick(state, d, { journal_enabled: false }));
        expect(state.digits[3].adaptiveTriggerGap).toBe(4);
        expect(state.digits[3].currentGap).toBe(0);

        [9, 1, 6, 4].forEach(d => processDigitTick(state, d, { journal_enabled: false }));
        expect(state.digits[3].currentGap).toBe(4);
        expect(state.digits[3].currentGap).toBe(state.digits[3].adaptiveTriggerGap);
    });

    it('replaces adaptive trigger when the digit appears again', () => {
        const state = createTrackerState();
        [3, 7, 2, 8, 5, 3].forEach(d => processDigitTick(state, d, { journal_enabled: false }));
        [9, 1, 6, 4, 0, 2, 8, 3].forEach(d => processDigitTick(state, d, { journal_enabled: false }));
        expect(state.digits[3].completedGap).toBe(7);
        expect(state.digits[3].adaptiveTriggerGap).toBe(7);
        expect(state.digits[3].currentGap).toBe(0);
        expect(state.digits[3].tradePlacedThisCycle).toBe(false);
    });
});

describe('evaluateAdaptiveDigitGap', () => {
    it('returns -1 until a digit has a valid adaptive trigger and current gap catches up', () => {
        const state = createTrackerState();
        const early = evaluateAdaptiveDigitGap([3, 8, 5], { journal_enabled: false }, state);
        expect(early.prediction).toBe(-1);

        const ready = evaluateAdaptiveDigitGap(
            [3, 8, 5, 1, 3, 0, 2, 4],
            { journal_enabled: false, min_adaptive_gap: 1 },
            state
        );
        expect(state.digits[3].adaptiveTriggerGap).toBe(3);
        expect(state.digits[3].currentGap).toBe(3);
        expect(ready.prediction).toBe(3);
    });

    it('only signals once per digit cycle when one_trade_per_cycle is on', () => {
        const state = createTrackerState();
        const opts = { journal_enabled: false, min_adaptive_gap: 1, one_trade_per_cycle: true };

        evaluateAdaptiveDigitGap([3, 8, 5, 1, 3, 0, 2, 4], opts, state);
        expect(state.digits[3].tradePlacedThisCycle).toBe(true);

        const again = evaluateAdaptiveDigitGap([3, 8, 5, 1, 3, 0, 2, 4, 7], opts, state);
        expect(state.digits[3].currentGap).toBe(4);
        expect(again.prediction).not.toBe(3);
    });

    it('respects min/max adaptive gap filter', () => {
        const state = createTrackerState();
        const result = evaluateAdaptiveDigitGap(
            [3, 8, 5, 1, 3, 0, 2, 4],
            { journal_enabled: false, min_adaptive_gap: 5, max_adaptive_gap: 20 },
            state
        );
        expect(state.digits[3].adaptiveTriggerGap).toBe(3);
        expect(result.prediction).toBe(-1);
    });

    it('selects first eligible digit by default', () => {
        const digits = [
            createDigitStateLike(0, { adaptiveTriggerGap: 2, currentGap: 2 }),
            createDigitStateLike(1, { adaptiveTriggerGap: 5, currentGap: 5 }),
        ];
        const options = {
            min_adaptive_gap: 1,
            max_adaptive_gap: 20,
            one_trade_per_cycle: true,
            selection_mode: SELECTION_FIRST,
        };
        expect(selectEligibleDigit(digits, options)).toBe(0);
        expect(selectEligibleDigit(digits, { ...options, selection_mode: SELECTION_LARGEST_ADAPTIVE })).toBe(1);
        expect(selectEligibleDigit(digits, { ...options, selection_mode: SELECTION_HIGHEST_EXCESS })).toBe(0);
    });
});

describe('formatGapDashboard', () => {
    it('renders a row per digit', () => {
        const state = createTrackerState();
        syncTrackerWithDigits(state, [1, 2, 1], { journal_enabled: false });
        const table = formatGapDashboard(state.digits);
        expect(table.split('\n')).toHaveLength(11);
        expect(table).toContain('Digit | Current Gap | Adaptive Gap');
        expect(table).toContain('1 | 0 | 1 |');
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
        triggerReached: false,
        tradePlacedThisCycle: false,
        ...overrides,
    };
}
