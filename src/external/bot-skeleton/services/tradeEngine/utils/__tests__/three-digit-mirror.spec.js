import { createThreeDigitMirrorState, processThreeDigitMirrorTick, resetThreeDigitMirrorWindow } from '../three-digit-mirror';

describe('three digit mirror detection', () => {
    it.each([
        [7, 4, 7, 4],
        [2, 9, 2, 9],
        [5, 1, 5, 1],
        [8, 3, 8, 3],
        [6, 0, 6, 0],
        [1, 7, 1, 7],
        [1, 1, 1, 1],
    ])('signals %i-%i-%i with middle barrier %i as soon as the third tick arrives', (a, b, c, barrier) => {
        const state = createThreeDigitMirrorState();
        expect(processThreeDigitMirrorTick(state, a)).toBeNull();
        expect(processThreeDigitMirrorTick(state, b)).toBeNull();
        expect(processThreeDigitMirrorTick(state, c)).toEqual({ tickIndex: 3, first: a, middle: b, third: c, barrier });
    });

    it('detects each overlapping pattern exactly once', () => {
        const state = createThreeDigitMirrorState();
        const results = [7, 4, 7, 4, 7].map(digit => processThreeDigitMirrorTick(state, digit)).filter(Boolean);
        expect(results.map(signal => [signal.tickIndex, signal.barrier])).toEqual([[3, 4], [4, 7], [5, 4]]);
    });

    it('does not signal a non-mirror window', () => {
        const state = createThreeDigitMirrorState();
        expect([7, 4, 8].map(digit => processThreeDigitMirrorTick(state, digit))).toEqual([null, null, null]);
    });

    it('clears incomplete history after an invalid tick or known discontinuity', () => {
        const state = createThreeDigitMirrorState();
        [7, 4].forEach(digit => processThreeDigitMirrorTick(state, digit));
        expect(processThreeDigitMirrorTick(state, null)).toBeNull();
        expect(processThreeDigitMirrorTick(state, 7)).toBeNull();
        resetThreeDigitMirrorWindow(state);
        expect([7, 4, 7].map(digit => processThreeDigitMirrorTick(state, digit)).at(-1).barrier).toBe(4);
    });
});
