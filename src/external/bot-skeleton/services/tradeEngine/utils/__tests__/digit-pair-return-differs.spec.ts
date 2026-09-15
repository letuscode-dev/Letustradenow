import {
    createDigitPairReturnState,
    evaluateDigitPairReturnDiffers,
    resetDigitPairReturnState,
} from '../digit-pair-return-differs';

describe('digit pair return differs', () => {
    it('stores A → B → C and signals Differ C when A → B return as previous digits', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs).toEqual(
            expect.arrayContaining([expect.objectContaining({ a: 7, b: 3, target_digit: 1 })])
        );

        // Return of p2=7,p1=3 as previous digits before a new tip (8).
        const confirmation = evaluateDigitPairReturnDiffers([7, 3, 1, 7, 3, 8], {}, state);
        expect(confirmation.prediction).toBe(1);
        expect(confirmation.waiting_pairs.find(item => item.a === 7 && item.b === 3)).toBeUndefined();
    });

    it('does not fire when the pair has only returned as the newest two digits', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        const early = evaluateDigitPairReturnDiffers([7, 3, 1, 7, 3], {}, state);
        expect(early.prediction).toBe(-1);
        expect(early.waiting_pairs.find(item => item.a === 7 && item.b === 3)?.target_digit).toBe(1);
    });

    it('tracks independent pairs for all digits 0–9', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([0, 9, 4, 2, 5, 8], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs.find(item => item.a === 0 && item.b === 9)?.target_digit).toBe(4);
        expect(first.waiting_pairs.find(item => item.a === 2 && item.b === 5)?.target_digit).toBe(8);

        const confirmation = evaluateDigitPairReturnDiffers([0, 9, 4, 2, 5, 8, 0, 9, 6], {}, state);
        expect(confirmation.prediction).toBe(4);
        expect(confirmation.waiting_pairs.find(item => item.a === 2 && item.b === 5)?.target_digit).toBe(8);
    });

    it('enforces the minimum analysis window', () => {
        const result = evaluateDigitPairReturnDiffers([], { tick_window: 20 });
        expect(result.tick_window).toBe(120);
    });

    it('bootstraps targets from an epoch-tagged rolling window without stale trades', () => {
        const state = createDigitPairReturnState();
        const history = [7, 3, 1, 4, 2, 6].map((digit, index) => ({ digit, epoch: index + 1 }));

        const first = evaluateDigitPairReturnDiffers(history, {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs.find(item => item.a === 7 && item.b === 3)?.target_digit).toBe(1);
        expect(first.waiting_pairs.find(item => item.a === 4 && item.b === 2)?.target_digit).toBe(6);

        const confirmation = evaluateDigitPairReturnDiffers(
            [...history, { digit: 7, epoch: 7 }, { digit: 3, epoch: 8 }, { digit: 0, epoch: 9 }],
            {},
            state
        );
        expect(confirmation.prediction).toBe(1);
    });

    it('does not re-process an unchanged plain digit window on the next poll', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs.find(item => item.a === 7 && item.b === 3)?.target_digit).toBe(1);

        const replay = evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        expect(replay.prediction).toBe(-1);
        expect(replay.waiting_pairs.find(item => item.a === 7 && item.b === 3)?.target_digit).toBe(1);
    });

    it('keeps a fired signal available on the same tip re-poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 7, 3, 8], {}, state);
        expect(fire.prediction).toBe(1);
        const again = evaluateDigitPairReturnDiffers([7, 3, 1, 7, 3, 8], {}, state);
        expect(again.prediction).toBe(1);
        expect(again.allowed).toBe(true);
    });

    it('processes only the new tip when a plain digit sliding window advances', () => {
        const state = createDigitPairReturnState();

        evaluateDigitPairReturnDiffers([9, 7, 3, 1], {}, state);
        evaluateDigitPairReturnDiffers([7, 3, 1, 7], {}, state);
        evaluateDigitPairReturnDiffers([3, 1, 7, 3], {}, state);
        const confirmation = evaluateDigitPairReturnDiffers([1, 7, 3, 0], {}, state);
        expect(confirmation.prediction).toBe(1);
    });

    it('resets runtime state in place on stop', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1], {}, state);
        expect(Object.keys(state.pairs).length).toBeGreaterThan(0);
        resetDigitPairReturnState(state);
        expect(state.pairs).toEqual({});
        expect(state.bootstrapped).toBe(false);
        expect(state.previous_digit).toBe(-1);
    });
});
