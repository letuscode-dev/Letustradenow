import {
    applyWindowIndexDiffersResult,
    createWindowIndexDiffersState,
    evaluateWindowIndexDiffers,
} from '../window-index-differs';

describe('window-index-differs', () => {
    it('collects a reference window before trading', () => {
        const state = createWindowIndexDiffersState(3);
        const waiting = evaluateWindowIndexDiffers([1, 2], { tick_window: 3, journal_enabled: false }, state);
        expect(waiting.allowed).toBe(false);
        expect(state.phase).toBe('collecting');

        const ready = evaluateWindowIndexDiffers([1, 2, 3], { tick_window: 3, journal_enabled: false }, state);
        expect(ready.allowed).toBe(true);
        expect(ready.prediction).toBe(1);
        expect(ready.index).toBe(0);
        expect(state.phase).toBe('trading');
        expect(state.reference).toEqual([1, 2, 3]);
        expect(state.pendingTrade).toBe(true);
    });

    it('Differs each next-window index against the previous window digit', () => {
        const state = createWindowIndexDiffersState(3);
        evaluateWindowIndexDiffers([4, 5, 6], { tick_window: 3, journal_enabled: false }, state);
        expect(state.lastPrediction).toBe(4);

        applyWindowIndexDiffersResult(state, 9);
        expect(state.nextIndex).toBe(1);
        expect(state.currentWindow[0]).toBe(9);
        expect(state.pendingTrade).toBe(false);

        const second = evaluateWindowIndexDiffers([4, 5, 6, 9], { tick_window: 3, journal_enabled: false }, state);
        expect(second.prediction).toBe(5);
        expect(second.index).toBe(1);

        applyWindowIndexDiffersResult(state, 8);
        const third = evaluateWindowIndexDiffers([4, 5, 6, 9, 8], { tick_window: 3, journal_enabled: false }, state);
        expect(third.prediction).toBe(6);
        expect(third.index).toBe(2);

        applyWindowIndexDiffersResult(state, 7);
        expect(state.reference).toEqual([9, 8, 7]);
        expect(state.nextIndex).toBe(0);
        expect(state.phase).toBe('trading');
    });

    it('rolls into the next reference window and continues', () => {
        const state = createWindowIndexDiffersState(2);
        evaluateWindowIndexDiffers([1, 2], { tick_window: 2, journal_enabled: false }, state);
        applyWindowIndexDiffersResult(state, 3);
        evaluateWindowIndexDiffers([1, 2, 3], { tick_window: 2, journal_enabled: false }, state);
        applyWindowIndexDiffersResult(state, 4);

        expect(state.reference).toEqual([3, 4]);

        const next = evaluateWindowIndexDiffers([1, 2, 3, 4], { tick_window: 2, journal_enabled: false }, state);
        expect(next.prediction).toBe(3);
        expect(next.index).toBe(0);
    });

    it('blocks while a trade is pending', () => {
        const state = createWindowIndexDiffersState(2);
        evaluateWindowIndexDiffers([7, 8], { tick_window: 2, journal_enabled: false }, state);
        const blocked = evaluateWindowIndexDiffers([7, 8], { tick_window: 2, journal_enabled: false }, state);
        expect(blocked.allowed).toBe(false);
        expect(blocked.prediction).toBe(-1);
    });

    it('does not trade when disabled', () => {
        const state = createWindowIndexDiffersState(2);
        const result = evaluateWindowIndexDiffers([1, 2], { enabled: false, tick_window: 2 }, state);
        expect(result.allowed).toBe(false);
        expect(result.enabled).toBe(false);
    });
});
