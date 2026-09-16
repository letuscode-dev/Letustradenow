import {
    createDigitPairReturnState,
    evaluateDigitPairReturnDiffers,
    resetDigitPairReturnState,
} from '../digit-pair-return-differs';

describe('digit pair return differs', () => {
    it('signals Differ A when A → B → C completes after bootstrap', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        expect(first.prediction).toBe(-1);

        const confirmation = evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        // New tip 4 completes 3 → 1 → 4 → Differ 3
        expect(confirmation.prediction).toBe(3);
        expect(confirmation.allowed).toBe(true);
    });

    it('Differs the first digit of the newest triple', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([0, 9, 4], {}, state);
        const next = evaluateDigitPairReturnDiffers([0, 9, 4, 2], {}, state);
        expect(next.prediction).toBe(9);
    });

    it('does not fire during bootstrap of the first window', () => {
        const state = createDigitPairReturnState();
        const result = evaluateDigitPairReturnDiffers([1, 2, 3, 4, 5], {}, state);
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
        // Tip 2 completes 4 → 5 → 2 → Differ 4
        expect(confirmation.prediction).toBe(4);
    });

    it('does not re-process an unchanged plain digit window on the next poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        expect(fire.prediction).toBe(3);

        const replay = evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        expect(replay.prediction).toBe(3);
        expect(replay.allowed).toBe(true);
    });

    it('keeps a fired signal available on the same tip re-poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 8], {}, state);
        expect(fire.prediction).toBe(3);
        const again = evaluateDigitPairReturnDiffers([7, 3, 1, 8], {}, state);
        expect(again.prediction).toBe(3);
        expect(again.allowed).toBe(true);
    });

    it('processes only the new tip when a plain digit sliding window advances', () => {
        const state = createDigitPairReturnState();

        evaluateDigitPairReturnDiffers([9, 7, 3, 1], {}, state);
        const confirmation = evaluateDigitPairReturnDiffers([7, 3, 1, 0], {}, state);
        // Tip 0 completes 3 → 1 → 0 → Differ 3
        expect(confirmation.prediction).toBe(3);
    });

    it('resets runtime state in place on stop', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        resetDigitPairReturnState(state);
        expect(state.bootstrapped).toBe(false);
        expect(state.previous_digit).toBe(-1);
        expect(state.prev_previous_digit).toBe(-1);
        expect(state.last_signal_key).toBe(null);
    });
});
