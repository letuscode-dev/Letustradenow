import {
    createDigitPairReturnState,
    evaluateDigitPairReturnDiffers,
    resetDigitPairReturnState,
} from '../digit-pair-return-differs';

describe('digit pair return differs', () => {
    it('stores A → B → C → D → E and signals Differ E when A → B → C → D return as previous digits', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ a: 7, b: 3, c: 1, d: 4, target_digit: 5 }),
            ])
        );

        const confirmation = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 7, 3, 1, 4, 8], {}, state);
        expect(confirmation.prediction).toBe(5);
        expect(
            confirmation.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4)
        ).toBeUndefined();
    });

    it('does not fire when the pattern has only returned as the newest four digits', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        const early = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 7, 3, 1, 4], {}, state);
        expect(early.prediction).toBe(-1);
        expect(
            early.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4)?.target_digit
        ).toBe(5);
    });

    it('tracks independent patterns for all digits 0–9', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([0, 9, 4, 2, 3, 5, 8, 1, 6, 7], {}, state);
        expect(first.prediction).toBe(-1);
        expect(
            first.waiting_pairs.find(item => item.a === 0 && item.b === 9 && item.c === 4 && item.d === 2)?.target_digit
        ).toBe(3);
        expect(
            first.waiting_pairs.find(item => item.a === 5 && item.b === 8 && item.c === 1 && item.d === 6)?.target_digit
        ).toBe(7);

        const confirmation = evaluateDigitPairReturnDiffers(
            [0, 9, 4, 2, 3, 5, 8, 1, 6, 7, 0, 9, 4, 2, 9],
            {},
            state
        );
        expect(confirmation.prediction).toBe(3);
        expect(
            confirmation.waiting_pairs.find(item => item.a === 5 && item.b === 8 && item.c === 1 && item.d === 6)
                ?.target_digit
        ).toBe(7);
    });

    it('enforces the minimum analysis window', () => {
        const result = evaluateDigitPairReturnDiffers([], { tick_window: 20 });
        expect(result.tick_window).toBe(120);
    });

    it('bootstraps targets from an epoch-tagged rolling window without stale trades', () => {
        const state = createDigitPairReturnState();
        const history = [7, 3, 1, 4, 5, 6, 2, 8, 0, 9].map((digit, index) => ({ digit, epoch: index + 1 }));

        const first = evaluateDigitPairReturnDiffers(history, {}, state);
        expect(first.prediction).toBe(-1);
        expect(
            first.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4)?.target_digit
        ).toBe(5);
        expect(
            first.waiting_pairs.find(item => item.a === 6 && item.b === 2 && item.c === 8 && item.d === 0)?.target_digit
        ).toBe(9);

        const confirmation = evaluateDigitPairReturnDiffers(
            [
                ...history,
                { digit: 7, epoch: 11 },
                { digit: 3, epoch: 12 },
                { digit: 1, epoch: 13 },
                { digit: 4, epoch: 14 },
                { digit: 2, epoch: 15 },
            ],
            {},
            state
        );
        expect(confirmation.prediction).toBe(5);
    });

    it('does not re-process an unchanged plain digit window on the next poll', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        expect(first.prediction).toBe(-1);
        expect(
            first.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4)?.target_digit
        ).toBe(5);

        const replay = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        expect(replay.prediction).toBe(-1);
        expect(
            replay.waiting_pairs.find(item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4)?.target_digit
        ).toBe(5);
    });

    it('keeps a fired signal available on the same tip re-poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 7, 3, 1, 4, 8], {}, state);
        expect(fire.prediction).toBe(5);
        const again = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 7, 3, 1, 4, 8], {}, state);
        expect(again.prediction).toBe(5);
        expect(again.allowed).toBe(true);
    });

    it('processes only the new tip when a plain digit sliding window advances', () => {
        const state = createDigitPairReturnState();

        evaluateDigitPairReturnDiffers([9, 7, 3, 1, 4, 5], {}, state);
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 7], {}, state);
        evaluateDigitPairReturnDiffers([3, 1, 4, 5, 7, 3], {}, state);
        evaluateDigitPairReturnDiffers([1, 4, 5, 7, 3, 1], {}, state);
        evaluateDigitPairReturnDiffers([4, 5, 7, 3, 1, 4], {}, state);
        const confirmation = evaluateDigitPairReturnDiffers([5, 7, 3, 1, 4, 0], {}, state);
        expect(confirmation.prediction).toBe(5);
    });

    it('resets runtime state in place on stop', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5], {}, state);
        expect(Object.keys(state.pairs).length).toBeGreaterThan(0);
        resetDigitPairReturnState(state);
        expect(state.pairs).toEqual({});
        expect(state.bootstrapped).toBe(false);
        expect(state.previous_digit).toBe(-1);
        expect(state.prev4_digit).toBe(-1);
    });
});
