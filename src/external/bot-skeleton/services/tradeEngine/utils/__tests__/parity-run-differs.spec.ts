import {
    DEFAULT_RUN_LENGTH,
    detectParityRunSignal,
    evaluateSymbolParityRunSignal,
    pickFirstParityRunMatch,
    makeParityRunSignalKey,
    isParityRunSignalConsumed,
    armParityRunPrediction,
    applyParityRunSettlement,
    createParityRunRuntimeState,
    releaseStaleParityRunCommit,
} from '../parity-run-differs';

describe('detectParityRunSignal', () => {
    it('matches last 6 even → Differ oldest (6th back)', () => {
        const result = detectParityRunSignal([1, 2, 4, 0, 6, 8, 4], 6);
        expect(result.matched).toBe(true);
        expect(result.parity).toBe('even');
        expect(result.barrier).toBe(2);
        expect(result.sequence).toEqual([2, 4, 0, 6, 8, 4]);
        expect(result.run_length).toBe(DEFAULT_RUN_LENGTH);
    });

    it('matches last 6 odd → Differ oldest (6th back)', () => {
        const result = detectParityRunSignal([0, 1, 3, 5, 7, 9, 1], 6);
        expect(result.matched).toBe(true);
        expect(result.parity).toBe('odd');
        expect(result.barrier).toBe(1);
        expect(result.sequence).toEqual([1, 3, 5, 7, 9, 1]);
    });

    it('rejects mixed parity runs', () => {
        const result = detectParityRunSignal([2, 4, 0, 6, 8, 5], 6);
        expect(result.matched).toBe(false);
        expect(result.reason).toContain('mixed_parity');
    });

    it('rejects short history', () => {
        expect(detectParityRunSignal([2, 4, 0], 6).matched).toBe(false);
    });
});

describe('multi-symbol pick + tip lock', () => {
    it('picks first matching symbol evaluation', () => {
        const evaluations = [
            evaluateSymbolParityRunSignal('R_10', [1, 3, 5], 6),
            evaluateSymbolParityRunSignal('1HZ75V', [2, 4, 0, 6, 8, 4], 6),
            evaluateSymbolParityRunSignal('R_25', [1, 3, 5, 7, 9, 1], 6),
        ];
        const match = pickFirstParityRunMatch(evaluations);
        expect(match.symbol).toBe('1HZ75V');
        expect(match.barrier).toBe(2);
    });

    it('locks one purchase per tip key', () => {
        const match = evaluateSymbolParityRunSignal('1HZ75V', [2, 4, 0, 6, 8, 4], 6);
        const key = makeParityRunSignalKey(match, 99);
        expect(isParityRunSignalConsumed(match, 99, key)).toBe(true);
        expect(isParityRunSignalConsumed(match, 100, key)).toBe(false);
    });
});

describe('runtime commit', () => {
    it('arms, settles once, and releases stale', () => {
        const state = createParityRunRuntimeState();
        armParityRunPrediction(state, 2);
        expect(state.trade_committed).toBe(true);
        expect(applyParityRunSettlement(state, 'c1')).toBe(true);
        expect(state.trade_committed).toBe(false);
        armParityRunPrediction(state, 4);
        expect(applyParityRunSettlement(state, 'c1')).toBe(false);
        expect(state.trade_committed).toBe(true);
        state.signal_issued_at = Date.now() - 25000;
        expect(releaseStaleParityRunCommit(state, 20000)).toBe(true);
        expect(state.trade_committed).toBe(false);
    });
});
