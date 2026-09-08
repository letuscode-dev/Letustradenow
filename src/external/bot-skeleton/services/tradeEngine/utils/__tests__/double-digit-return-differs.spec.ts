import {
    createDoubleDigitReturnState,
    evaluateDoubleDigitReturnDiffers,
} from '../double-digit-return-differs';

describe('double digit return differs', () => {
    it('stores the first pattern and signals only on its return', () => {
        const state = createDoubleDigitReturnState();

        const first = evaluateDoubleDigitReturnDiffers([2, 2, 7], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.states[2]).toMatchObject({ target_digit: 7, status: 'WAITING' });

        const confirmation = evaluateDoubleDigitReturnDiffers([2, 2, 7], {}, state);
        expect(confirmation.prediction).toBe(7);
        expect(confirmation.states[2]).toMatchObject({ target_digit: -1, status: 'WATCHING' });
    });

    it('updates a target without trading and keeps digits independent', () => {
        const state = createDoubleDigitReturnState();

        const first = evaluateDoubleDigitReturnDiffers([2, 2, 7], {}, state);
        expect(first.prediction).toBe(-1);
        expect(first.states[2].target_digit).toBe(7);

        const updated = evaluateDoubleDigitReturnDiffers([2, 2, 5, 5, 3], {}, state);
        expect(updated.prediction).toBe(-1);
        expect(updated.states[2].target_digit).toBe(5);
        expect(updated.states[5].target_digit).toBe(3);

        const confirmation = evaluateDoubleDigitReturnDiffers([2, 2, 5], {}, state);
        expect(confirmation.prediction).toBe(5);
        expect(confirmation.states[2].target_digit).toBe(-1);
        expect(confirmation.states[5].target_digit).toBe(3);
    });

    it('enforces the minimum analysis window', () => {
        const result = evaluateDoubleDigitReturnDiffers([], { tick_window: 20 });
        expect(result.tick_window).toBe(120);
        expect(result.states).toHaveLength(10);
    });
});
