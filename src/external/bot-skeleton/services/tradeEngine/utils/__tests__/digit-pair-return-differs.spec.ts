import {
    createDigitPairReturnState,
    evaluateDigitPairReturnDiffers,
    resetDigitPairReturnState,
} from '../digit-pair-return-differs';

describe('digit pair return differs', () => {
    it('stores A → B → C → D → E → F and signals Differ F when A → B → C → D → E return as previous digits', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.waiting_pairs).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ a: 7, b: 3, c: 1, d: 4, e: 5, target_digit: 2 }),
            ])
        );

        const confirmation = evaluateDigitPairReturnDiffers(
            [7, 3, 1, 4, 5, 2, 7, 3, 1, 4, 5, 8],
            {},
            state
        );
        expect(confirmation.prediction).toBe(2);
        expect(
            confirmation.waiting_pairs.find(
                item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4 && item.e === 5
            )
        ).toBeUndefined();
    });

    it('does not fire when the pattern has only returned as the newest five digits', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2], {}, state);
        const early = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2, 7, 3, 1, 4, 5], {}, state);
        expect(early.prediction).toBe(-1);
        expect(
            early.waiting_pairs.find(
                item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4 && item.e === 5
            )?.target_digit
        ).toBe(2);
    });

    it('tracks independent patterns for all digits 0–9', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers(
            [0, 9, 4, 2, 3, 1, 5, 8, 1, 6, 7, 0],
            {},
            state
        );
        expect(first.prediction).toBe(-1);
        expect(
            first.waiting_pairs.find(
                item => item.a === 0 && item.b === 9 && item.c === 4 && item.d === 2 && item.e === 3
            )?.target_digit
        ).toBe(1);
        expect(
            first.waiting_pairs.find(
                item => item.a === 5 && item.b === 8 && item.c === 1 && item.d === 6 && item.e === 7
            )?.target_digit
        ).toBe(0);

        const confirmation = evaluateDigitPairReturnDiffers(
            [0, 9, 4, 2, 3, 1, 5, 8, 1, 6, 7, 0, 0, 9, 4, 2, 3, 9],
            {},
            state
        );
        expect(confirmation.prediction).toBe(1);
        expect(
            confirmation.waiting_pairs.find(
                item => item.a === 5 && item.b === 8 && item.c === 1 && item.d === 6 && item.e === 7
            )?.target_digit
        ).toBe(0);
    });

    it('enforces the minimum analysis window', () => {
        const result = evaluateDigitPairReturnDiffers([], { tick_window: 20 });
        expect(result.tick_window).toBe(120);
    });

    it('bootstraps targets from an epoch-tagged rolling window without stale trades', () => {
        const state = createDigitPairReturnState();
        const history = [7, 3, 1, 4, 5, 2, 6, 8, 0, 9, 1, 3].map((digit, index) => ({
            digit,
            epoch: index + 1,
        }));

        const first = evaluateDigitPairReturnDiffers(history, {}, state);
        expect(first.prediction).toBe(-1);
        expect(
            first.waiting_pairs.find(
                item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4 && item.e === 5
            )?.target_digit
        ).toBe(2);
        expect(
            first.waiting_pairs.find(
                item => item.a === 6 && item.b === 8 && item.c === 0 && item.d === 9 && item.e === 1
            )?.target_digit
        ).toBe(3);

        const confirmation = evaluateDigitPairReturnDiffers(
            [
                ...history,
                { digit: 7, epoch: 13 },
                { digit: 3, epoch: 14 },
                { digit: 1, epoch: 15 },
                { digit: 4, epoch: 16 },
                { digit: 5, epoch: 17 },
                { digit: 0, epoch: 18 },
            ],
            {},
            state
        );
        expect(confirmation.prediction).toBe(2);
    });

    it('does not re-process an unchanged plain digit window on the next poll', () => {
        const state = createDigitPairReturnState();

        const first = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2], {}, state);
        expect(first.prediction).toBe(-1);
        expect(
            first.waiting_pairs.find(
                item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4 && item.e === 5
            )?.target_digit
        ).toBe(2);

        const replay = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2], {}, state);
        expect(replay.prediction).toBe(-1);
        expect(
            replay.waiting_pairs.find(
                item => item.a === 7 && item.b === 3 && item.c === 1 && item.d === 4 && item.e === 5
            )?.target_digit
        ).toBe(2);
    });

    it('keeps a fired signal available on the same tip re-poll', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2], {}, state);
        const fire = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2, 7, 3, 1, 4, 5, 8], {}, state);
        expect(fire.prediction).toBe(2);
        const again = evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2, 7, 3, 1, 4, 5, 8], {}, state);
        expect(again.prediction).toBe(2);
        expect(again.allowed).toBe(true);
    });

    it('processes only the new tip when a plain digit sliding window advances', () => {
        const state = createDigitPairReturnState();

        evaluateDigitPairReturnDiffers([9, 7, 3, 1, 4, 5, 2], {}, state);
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2, 7], {}, state);
        evaluateDigitPairReturnDiffers([3, 1, 4, 5, 2, 7, 3], {}, state);
        evaluateDigitPairReturnDiffers([1, 4, 5, 2, 7, 3, 1], {}, state);
        evaluateDigitPairReturnDiffers([4, 5, 2, 7, 3, 1, 4], {}, state);
        evaluateDigitPairReturnDiffers([5, 2, 7, 3, 1, 4, 5], {}, state);
        const confirmation = evaluateDigitPairReturnDiffers([2, 7, 3, 1, 4, 5, 0], {}, state);
        expect(confirmation.prediction).toBe(2);
    });

    it('resets runtime state in place on stop', () => {
        const state = createDigitPairReturnState();
        evaluateDigitPairReturnDiffers([7, 3, 1, 4, 5, 2], {}, state);
        expect(Object.keys(state.pairs).length).toBeGreaterThan(0);
        resetDigitPairReturnState(state);
        expect(state.pairs).toEqual({});
        expect(state.bootstrapped).toBe(false);
        expect(state.previous_digit).toBe(-1);
        expect(state.prev5_digit).toBe(-1);
    });
});
