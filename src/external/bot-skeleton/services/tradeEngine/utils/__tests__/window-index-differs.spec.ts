import {
    applyWindowIndexDiffersResult,
    createWindowIndexDiffersState,
    evaluateWindowIndexDiffers,
} from '../window-index-differs';

describe('window-index-differs (same-digit wait)', () => {
    it('waits until match_count identical digits appear', () => {
        const state = createWindowIndexDiffersState(2);
        const waiting = evaluateWindowIndexDiffers([1], {
            tick_window: 2,
            trade_wait: 2,
            journal_enabled: false,
        }, state);
        expect(waiting.allowed).toBe(false);
        expect(state.phase).toBe('watching');

        const matched = evaluateWindowIndexDiffers([1, 1], {
            tick_window: 2,
            trade_wait: 2,
            journal_enabled: false,
        }, state);
        expect(matched.allowed).toBe(false);
        expect(state.phase).toBe('waiting');
        expect(state.targetDigit).toBe(1);
    });

    it('after a match, waits trade_wait ticks then Differs that digit', () => {
        const state = createWindowIndexDiffersState(2);
        evaluateWindowIndexDiffers([7, 7], { tick_window: 2, trade_wait: 2, journal_enabled: false }, state);
        expect(state.phase).toBe('waiting');

        const mid = evaluateWindowIndexDiffers([7, 7, 3], {
            tick_window: 2,
            trade_wait: 2,
            journal_enabled: false,
        }, state);
        expect(mid.allowed).toBe(false);
        expect(state.phase).toBe('waiting');

        const ready = evaluateWindowIndexDiffers([7, 7, 3, 9], {
            tick_window: 2,
            trade_wait: 2,
            journal_enabled: false,
        }, state);
        expect(ready.allowed).toBe(true);
        expect(ready.prediction).toBe(7);
        expect(state.phase).toBe('armed');
    });

    it('keeps the same prediction on re-evaluate while armed', () => {
        const state = createWindowIndexDiffersState(2);
        evaluateWindowIndexDiffers([4, 4], { tick_window: 2, trade_wait: 0, journal_enabled: false }, state);
        const first = evaluateWindowIndexDiffers([4, 4], {
            tick_window: 2,
            trade_wait: 0,
            journal_enabled: false,
        }, state);
        const second = evaluateWindowIndexDiffers([4, 4], {
            tick_window: 2,
            trade_wait: 0,
            journal_enabled: false,
        }, state);
        expect(first.prediction).toBe(4);
        expect(second.prediction).toBe(4);
        expect(second.allowed).toBe(true);
    });

    it('does not match when recent digits differ', () => {
        const state = createWindowIndexDiffersState(2);
        const result = evaluateWindowIndexDiffers([1, 2], {
            tick_window: 2,
            trade_wait: 1,
            journal_enabled: false,
        }, state);
        expect(result.allowed).toBe(false);
        expect(state.phase).toBe('watching');
    });

    it('resets to watching after a trade settles', () => {
        const state = createWindowIndexDiffersState(2);
        evaluateWindowIndexDiffers([5, 5], { tick_window: 2, trade_wait: 0, journal_enabled: false }, state);
        expect(state.phase).toBe('armed');
        applyWindowIndexDiffersResult(state, 8);
        expect(state.phase).toBe('watching');
        expect(state.lastPrediction).toBe(-1);
        expect(state.targetDigit).toBe(-1);
    });

    it('does not trade when disabled', () => {
        const state = createWindowIndexDiffersState(2);
        const result = evaluateWindowIndexDiffers([1, 1], {
            enabled: false,
            tick_window: 2,
            trade_wait: 0,
        }, state);
        expect(result.allowed).toBe(false);
        expect(result.enabled).toBe(false);
    });
});
