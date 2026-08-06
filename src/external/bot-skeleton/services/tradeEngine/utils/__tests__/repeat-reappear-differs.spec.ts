import {
    createRepeatReappearState,
    evaluateRepeatReappearDiffers,
    applyRepeatReappearSettlement,
    releaseStaleRepeatReappearCommit,
    processRepeatReappearTick,
    normalizeRepeatReappearOptions,
} from '../repeat-reappear-differs';

describe('evaluateRepeatReappearDiffers', () => {
    it('after a double, waits for break then Differ on reappear', () => {
        const state = createRepeatReappearState();
        evaluateRepeatReappearDiffers([{ digit: 4, epoch: 10 }], { journal_enabled: false }, state);

        let result = evaluateRepeatReappearDiffers(
            [
                { digit: 4, epoch: 10 },
                { digit: 1, epoch: 11 },
                { digit: 1, epoch: 12 },
            ],
            { journal_enabled: false },
            state
        );
        expect(result.matched).toBe(false);
        expect(result.phase).toBe('waiting_break');
        expect(result.target_digit).toBe(1);

        result = evaluateRepeatReappearDiffers(
            [
                { digit: 4, epoch: 10 },
                { digit: 1, epoch: 11 },
                { digit: 1, epoch: 12 },
                { digit: 5, epoch: 13 },
            ],
            { journal_enabled: false },
            state
        );
        expect(result.phase).toBe('waiting_reappear');
        expect(result.skip_next).toBe(false);

        result = evaluateRepeatReappearDiffers(
            [
                { digit: 4, epoch: 10 },
                { digit: 1, epoch: 11 },
                { digit: 1, epoch: 12 },
                { digit: 5, epoch: 13 },
                { digit: 1, epoch: 14 },
            ],
            { journal_enabled: false },
            state
        );
        expect(result.matched).toBe(true);
        expect(result.prediction).toBe(1);
        expect(result.phase).toBe('armed');
    });

    it('after a 3-streak, skips the next tip then Differ on later reappear', () => {
        const state = createRepeatReappearState();
        evaluateRepeatReappearDiffers([{ digit: 2, epoch: 1 }], { journal_enabled: false }, state);
        evaluateRepeatReappearDiffers(
            [
                { digit: 2, epoch: 1 },
                { digit: 7, epoch: 2 },
                { digit: 7, epoch: 3 },
                { digit: 7, epoch: 4 },
            ],
            { journal_enabled: false },
            state
        );
        expect(state.phase).toBe('waiting_break');
        expect(state.armedStreak).toBe(3);

        evaluateRepeatReappearDiffers(
            [
                { digit: 2, epoch: 1 },
                { digit: 7, epoch: 2 },
                { digit: 7, epoch: 3 },
                { digit: 7, epoch: 4 },
                { digit: 0, epoch: 5 },
            ],
            { journal_enabled: false },
            state
        );
        expect(state.phase).toBe('waiting_reappear');
        expect(state.skipNext).toBe(true);

        let result = evaluateRepeatReappearDiffers(
            [
                { digit: 2, epoch: 1 },
                { digit: 7, epoch: 2 },
                { digit: 7, epoch: 3 },
                { digit: 7, epoch: 4 },
                { digit: 0, epoch: 5 },
                { digit: 7, epoch: 6 },
            ],
            { journal_enabled: false },
            state
        );
        expect(result.matched).toBe(false);
        expect(state.phase).toBe('waiting_reappear');
        expect(state.skipNext).toBe(false);

        result = evaluateRepeatReappearDiffers(
            [
                { digit: 2, epoch: 1 },
                { digit: 7, epoch: 2 },
                { digit: 7, epoch: 3 },
                { digit: 7, epoch: 4 },
                { digit: 0, epoch: 5 },
                { digit: 7, epoch: 6 },
                { digit: 3, epoch: 7 },
                { digit: 7, epoch: 8 },
            ],
            { journal_enabled: false },
            state
        );
        expect(result.matched).toBe(true);
        expect(result.prediction).toBe(7);
    });

    it('after a 4-streak, sets skip_next on break', () => {
        const state = createRepeatReappearState();
        evaluateRepeatReappearDiffers([{ digit: 9, epoch: 1 }], { journal_enabled: false }, state);
        evaluateRepeatReappearDiffers(
            [
                { digit: 9, epoch: 1 },
                { digit: 3, epoch: 2 },
                { digit: 3, epoch: 3 },
                { digit: 3, epoch: 4 },
                { digit: 3, epoch: 5 },
                { digit: 8, epoch: 6 },
            ],
            { journal_enabled: false },
            state
        );
        expect(state.phase).toBe('waiting_reappear');
        expect(state.skipNext).toBe(true);
        expect(state.targetDigit).toBe(3);
    });

    it('does not fire on the tip that continues a double into a triple', () => {
        const state = createRepeatReappearState();
        evaluateRepeatReappearDiffers([{ digit: 5, epoch: 1 }], { journal_enabled: false }, state);
        evaluateRepeatReappearDiffers(
            [
                { digit: 5, epoch: 1 },
                { digit: 6, epoch: 2 },
                { digit: 6, epoch: 3 },
            ],
            { journal_enabled: false },
            state
        );
        const result = evaluateRepeatReappearDiffers(
            [
                { digit: 5, epoch: 1 },
                { digit: 6, epoch: 2 },
                { digit: 6, epoch: 3 },
                { digit: 6, epoch: 4 },
            ],
            { journal_enabled: false },
            state
        );
        expect(result.matched).toBe(false);
        expect(result.phase).toBe('waiting_break');
        expect(state.armedStreak).toBe(3);
    });

    it('settles once and releases stale arms', () => {
        const state = createRepeatReappearState();
        state.phase = 'armed';
        state.lastPrediction = 4;
        state.targetDigit = 4;
        state.trade_committed = true;
        state.signal_issued_at = Date.now();
        expect(applyRepeatReappearSettlement(state, 'c1')).toBe(true);
        expect(state.phase).toBe('watching');
        expect(state.lastPrediction).toBe(-1);

        state.phase = 'armed';
        state.trade_committed = true;
        state.signal_issued_at = Date.now() - 25000;
        expect(releaseStaleRepeatReappearCommit(state, 20000)).toBe(true);
    });
});

describe('helpers', () => {
    it('normalizes options', () => {
        expect(normalizeRepeatReappearOptions({}).enabled).toBe(true);
        expect(normalizeRepeatReappearOptions({ enabled: false }).enabled).toBe(false);
    });

    it('processRepeatReappearTick advances watching → waiting_break on double', () => {
        const state = createRepeatReappearState();
        state.previousDigit = 2;
        state.streak = 1;
        const msgs = [];
        processRepeatReappearTick(state, 2, { journal_enabled: true }, msgs);
        expect(state.phase).toBe('waiting_break');
        expect(state.targetDigit).toBe(2);
        expect(msgs.length).toBeGreaterThan(0);
    });

    it('journals a watching heartbeat after anchor', () => {
        const state = createRepeatReappearState();
        const first = evaluateRepeatReappearDiffers(
            [{ digit: 4, epoch: 10 }],
            { journal_enabled: true },
            state
        );
        expect(first.reason).toBe('anchored');
        expect(first.journal_messages.length).toBeGreaterThan(0);

        const second = evaluateRepeatReappearDiffers(
            [
                { digit: 4, epoch: 10 },
                { digit: 8, epoch: 11 },
            ],
            { journal_enabled: true },
            state
        );
        expect(second.matched).toBe(false);
        expect(second.journal_messages.some(m => /watching|tip/i.test(m.message))).toBe(true);
    });
});
