import {
    applyWindowIndexDiffersResult,
    createWindowIndexDiffersState,
    evaluateWindowIndexDiffers,
} from '../window-index-differs';

describe('window-index-differs (previous === current, then wait)', () => {
    it('does nothing until previous_digit equals current_digit', () => {
        const state = createWindowIndexDiffersState();
        const result = evaluateWindowIndexDiffers([1, 2, 3], {
            trade_wait: 2,
            journal_enabled: false,
        }, state);
        expect(result.allowed).toBe(false);
        expect(state.phase).toBe('watching');
        expect(state.previousDigit).toBe(3);
    });

    it('on previous === current, waits trade_wait ticks then Differs that digit', () => {
        const state = createWindowIndexDiffersState();
        // Digits: 4, then 4 → repeat at tickIndex 1; wait 2 → fire at tickIndex 1+2=3
        evaluateWindowIndexDiffers([4, 4], { trade_wait: 2, journal_enabled: false }, state);
        expect(state.phase).toBe('waiting');
        expect(state.targetDigit).toBe(4);
        expect(state.fireTick).toBe(3);

        const mid = evaluateWindowIndexDiffers([4, 4, 9], {
            trade_wait: 2,
            journal_enabled: false,
        }, state);
        expect(mid.allowed).toBe(false);
        expect(state.phase).toBe('waiting');
        expect(state.tickIndex).toBe(2);

        const ready = evaluateWindowIndexDiffers([4, 4, 9, 1], {
            trade_wait: 2,
            journal_enabled: false,
        }, state);
        expect(ready.allowed).toBe(true);
        expect(ready.prediction).toBe(4);
        expect(state.phase).toBe('armed');
        expect(state.tickIndex).toBe(3);
    });

    it('advances wait using epochs even when the sliding list length is fixed', () => {
        const state = createWindowIndexDiffersState();
        // First call anchors on the newest live tick (ignores historical repeats).
        evaluateWindowIndexDiffers(
            [
                { digit: 1, epoch: 100 },
                { digit: 7, epoch: 101 },
            ],
            { trade_wait: 2, journal_enabled: false },
            state
        );
        expect(state.phase).toBe('watching');
        expect(state.previousDigit).toBe(7);

        // New tick repeats previous tip → start wait.
        evaluateWindowIndexDiffers(
            [
                { digit: 7, epoch: 101 },
                { digit: 7, epoch: 102 },
            ],
            { trade_wait: 2, journal_enabled: false },
            state
        );
        expect(state.phase).toBe('waiting');
        expect(state.targetDigit).toBe(7);

        evaluateWindowIndexDiffers(
            [
                { digit: 7, epoch: 102 },
                { digit: 3, epoch: 103 },
            ],
            { trade_wait: 2, journal_enabled: false },
            state
        );
        expect(state.phase).toBe('waiting');

        const ready = evaluateWindowIndexDiffers(
            [
                { digit: 3, epoch: 103 },
                { digit: 9, epoch: 104 },
            ],
            { trade_wait: 2, journal_enabled: false },
            state
        );
        expect(ready.allowed).toBe(true);
        expect(ready.prediction).toBe(7);
    });

    it('arms immediately when trade_wait is 0', () => {
        const state = createWindowIndexDiffersState();
        const result = evaluateWindowIndexDiffers([5, 5], {
            trade_wait: 0,
            journal_enabled: false,
        }, state);
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(5);
        expect(state.phase).toBe('armed');
    });

    it('keeps the same prediction on re-evaluate while armed', () => {
        const state = createWindowIndexDiffersState();
        evaluateWindowIndexDiffers([2, 2], { trade_wait: 0, journal_enabled: false }, state);
        const again = evaluateWindowIndexDiffers([2, 2, 8], {
            trade_wait: 0,
            journal_enabled: false,
        }, state);
        expect(again.prediction).toBe(2);
        expect(again.allowed).toBe(true);
    });

    it('resets to watching after a trade settles', () => {
        const state = createWindowIndexDiffersState();
        evaluateWindowIndexDiffers([6, 6], { trade_wait: 0, journal_enabled: false }, state);
        applyWindowIndexDiffersResult(state, 1);
        expect(state.phase).toBe('watching');
        expect(state.lastPrediction).toBe(-1);
        expect(state.targetDigit).toBe(-1);
    });

    it('does not trade when disabled', () => {
        const state = createWindowIndexDiffersState();
        const result = evaluateWindowIndexDiffers([1, 1], {
            enabled: false,
            trade_wait: 0,
        }, state);
        expect(result.allowed).toBe(false);
        expect(result.enabled).toBe(false);
    });
});
