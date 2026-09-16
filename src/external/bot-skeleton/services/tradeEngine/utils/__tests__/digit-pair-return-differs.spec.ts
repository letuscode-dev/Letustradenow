import {
    createDigitPairReturnState,
    evaluateDigitPairReturnDiffers,
    resetDigitPairReturnState,
} from '../digit-pair-return-differs';

describe('digit pair return differs', () => {
    it('signals Differ C when A → B → C → D completes after bootstrap', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        expect(first.prediction).toBe(-1);

        // New tip 5 completes 3 → 1 → 4 → 5 → Differ 4 (C)
        const confirmation = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        expect(confirmation.prediction).toBe(4);
        expect(confirmation.allowed).toBe(true);
    });

    it('Differs the third digit of the newest quartet', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([0, 9, 4, 2], {}, state);
        const next = evaluateDigitPairReturnDiffers([0, 9, 4, 2, 7], {}, state);
        // 9 → 4 → 2 → 7 → Differ 2
        expect(next.prediction).toBe(2);
    });

    it('does not fire during bootstrap of the first window', () => {
        const state = createDigitPairReturnState();
        const result = evaluateDigitPairReturnDiffers([1, 2, 3, 4, 5, 6], {}, state);
        expect(result.prediction).toBe(-1);
    });

    it('enforces the minimum analysis window', () => {
        const result = evaluateDigitPairReturnDiffers([], { tick_window: 20 });
        expect(result.tick_window).toBe(120);
    });

    it('bootstraps from an epoch-tagged rolling window without stale trades', () => {
        const state = createDigitPairReturnState();
        const history = [7, 3, 1, 4, 5].map((digit, index) => ({ digit, epoch: index + 1 }));

        const first = evaluateDigitPairReturnDiffers(history, {}, state);
        expect(first.prediction).toBe(-1);

        const confirmation = evaluateDigitPairReturnDiffers(
            [...history, { digit: 2, epoch: 6 }],
            {},
            state
        );
        // Tip 2 completes 3 → 1 → 4 → 5 → 2 wait: last four are 1,4,5,2 → Differ 5
        expect(confirmation.prediction).toBe(5);
    });

    it('does not re-process an unchanged plain digit window on the next poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        expect(fire.prediction).toBe(4);

        const replay = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        expect(replay.prediction).toBe(4);
        expect(replay.allowed).toBe(true);
    });

    it('keeps a fired signal available on the same tip re-poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 8], {}, state);
        expect(fire.prediction).toBe(4);
        const again = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 8], {}, state);
        expect(again.prediction).toBe(4);
        expect(again.allowed).toBe(true);
    });

    it('processes only the new tip when a plain digit sliding window advances', () => {
        const state = createDigitPairReturnState();

        evaluateDigitPairReturnDiffers([9, 7, 3, 1, 4], {}, state);
        const confirmation = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 0], {}, state);
        // Tip 0 completes 3 → 1 → 4 → 0 → Differ 4
        expect(confirmation.prediction).toBe(4);
    });

    it('resets runtime state in place on stop', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        resetDigitPairReturnState(state);
        expect(state.bootstrapped).toBe(false);
        expect(state.previous_digit).toBe(-1);
        expect(state.prev_previous_digit).toBe(-1);
        expect(state.prev3_digit).toBe(-1);
        expect(state.last_signal_key).toBe(null);
    });
});
