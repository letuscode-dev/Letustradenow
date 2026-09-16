import {
    createDigitPairReturnState,
    evaluateDigitPairReturnDiffers,
    resetDigitPairReturnState,
} from '../digit-pair-return-differs';

describe('digit pair return differs', () => {
    it('stores A → B → C → D and signals Differ D when A → B → C return as previous digits', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ a: 7, b: 3, c: 1, target_digit: 4 }),
            ])
        );

        // Return of p3=7,p2=3,p1=1 as previous digits before a new tip (8).
        const confirmation = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 7, 3, 1, 8], {}, state);
        expect(confirmation.prediction).toBe(4);
        expect(
            confirmation.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1)
        ).toBeUndefined();
    });

    it('does not fire when the pattern has only returned as the newest three digits', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        const early = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 7, 3, 1], {}, state);
        expect(early.prediction).toBe(-1);
        expect(early.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1)?.target_digit).toBe(
            4
        );
    });

    it('tracks independent patterns for all digits 0–9', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([0, 9, 4, 2, 5, 8, 1, 6], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs.find(item => item.a === 0 && item.b === 9 && item.c === 4)?.target_digit).toBe(
            2
        );
        expect(first.waiting_pairs.find(item => item.a === 5 && item.b === 8 && item.c === 1)?.target_digit).toBe(
            6
        );

        const confirmation = evaluateDigitPairReturnDiffers(
            [0, 9, 4, 2, 5, 8, 1, 6, 0, 9, 4, 7],
            {},
            state
        );
        expect(confirmation.prediction).toBe(2);
        expect(confirmation.waiting_pairs.find(item => item.a === 5 && item.b === 8 && item.c === 1)?.target_digit).toBe(
            6
        );
    });

    it('enforces the minimum analysis window', () => {
        const result = evaluateDigitPairReturnDiffers([], { tick_window: 20 });
        expect(result.tick_window).toBe(120);
    });

    it('bootstraps targets from an epoch-tagged rolling window without stale trades', () => {
        const state = createDigitPairReturnState();
        const history = [7, 3, 1, 4, 5, 2, 6, 0].map((digit, index) => ({ digit, epoch: index + 1 }));

        const first = evaluateDigitPairReturnDiffers(history, {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1)?.target_digit).toBe(
            4
        );
        expect(first.waiting_pairs.find(item => item.a === 5 && item.b === 2 && item.c === 6)?.target_digit).toBe(
            0
        );

        const confirmation = evaluateDigitPairReturnDiffers(
            [
                ...history,
                { digit: 7, epoch: 9 },
                { digit: 3, epoch: 10 },
                { digit: 1, epoch: 11 },
                { digit: 9, epoch: 12 },
            ],
            {},
            state
        );
        expect(confirmation.prediction).toBe(4);
    });

    it('does not re-process an unchanged plain digit window on the next poll', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1)?.target_digit).toBe(
            4
        );

        const replay = evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        expect(replay.prediction).toBe(-1);
        expect(replay.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1)?.target_digit).toBe(
            4
        );
    });

    it('keeps a fired signal available on the same tip re-poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 7, 3, 1, 8], {}, state);
        expect(fire.prediction).toBe(4);
        const again = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 7, 3, 1, 8], {}, state);
        expect(again.prediction).toBe(4);
        expect(again.allowed).toBe(true);
    });

    it('processes only the new tip when a plain digit sliding window advances', () => {
        const state = createDigitPairReturnState();

        evaluateDigitPairReturnDiffers([9, 7, 3, 1, 4], {}, state);
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 7], {}, state);
        evaluateDigitPairReturnDiffers([3, 1, 4, 7, 3], {}, state);
        evaluateDigitPairReturnDiffers([1, 4, 7, 3, 1], {}, state);
        const confirmation = evaluateDigitPairReturnDiffers([4, 7, 3, 1, 0], {}, state);
        expect(confirmation.prediction).toBe(4);
    });

    it('resets runtime state in place on stop', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4], {}, state);
        expect(Object.keys(state.pairs).length).toBeGreaterThan(0);
        resetDigitPairReturnState(state);
        expect(state.pairs).toEqual({});
        expect(state.bootstrapped).toBe(false);
        expect(state.previous_digit).toBe(-1);
        expect(state.prev3_digit).toBe(-1);
    });
});
