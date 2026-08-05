import {
    calculatePayoutRecoveryStake,
    detectEvenOddPairSignal,
    getLastTwoDigits,
    isOddPairAtMostThreshold,
    isEvenPairAboveThreshold,
    makeEvenOddPairSignalKey,
    isEvenOddPairSignalConsumed,
    makeEvenOddPairTipKey,
    armEvenOddPairPrediction,
    applyEvenOddPairSettlement,
    clearEvenOddPairCommit,
    createEvenOddPairRuntimeState,
    releaseStaleEvenOddPairCommit,
    ENTRY_OVER_BARRIER,
    RECOVERY_OVER_BARRIER,
    ENTRY_UNDER_BARRIER,
    RECOVERY_UNDER_BARRIER,
} from '../even-odd-pair-over-under';

describe('getLastTwoDigits / pair checks', () => {
    it('reads previous and current digits', () => {
        expect(getLastTwoDigits([1, 2, 4, 0])).toEqual({
            previous_digit: 4,
            current_digit: 0,
            ready: true,
        });
        expect(getLastTwoDigits([7])).toEqual({
            previous_digit: null,
            current_digit: null,
            ready: false,
        });
        expect(getLastTwoDigits(['0', '2.0'])).toEqual({
            previous_digit: 0,
            current_digit: 2,
            ready: true,
        });
    });

    it('detects odd pair at most threshold', () => {
        expect(isOddPairAtMostThreshold(1, 3, 5)).toBe(true);
        expect(isOddPairAtMostThreshold(1, 5, 5)).toBe(true); // <= 5
        expect(isOddPairAtMostThreshold(5, 7, 5)).toBe(false); // 7 > 5
        expect(isOddPairAtMostThreshold(0, 2, 5)).toBe(false); // even
        expect(isOddPairAtMostThreshold(1, 1, 1)).toBe(true);
        expect(isOddPairAtMostThreshold(3, 3, 1)).toBe(false); // 3 > 1
    });

    it('detects even pair above threshold', () => {
        expect(isEvenPairAboveThreshold(6, 8, 4)).toBe(true);
        expect(isEvenPairAboveThreshold(8, 8, 4)).toBe(true);
        expect(isEvenPairAboveThreshold(2, 6, 4)).toBe(false); // 2 not > 4
        expect(isEvenPairAboveThreshold(5, 7, 4)).toBe(false); // odd
        expect(isEvenPairAboveThreshold(6, 6, 6)).toBe(false); // not > 6
    });
});

describe('detectEvenOddPairSignal', () => {
    it('Over: odd pair <= 5 → barrier 2', () => {
        const result = detectEvenOddPairSignal([8, 1, 5], { side: 'OVER', odd_max: 5 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_OVER_BARRIER);
        expect(result.previous_digit).toBe(1);
        expect(result.current_digit).toBe(5);
        expect(result.contract_type).toBe('DIGITOVER');
    });

    it('Over recovery → barrier 3 immediately', () => {
        const result = detectEvenOddPairSignal([0, 2], {
            side: 'OVER',
            recovering: true,
        });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(RECOVERY_OVER_BARRIER);
        expect(result.reason).toContain('recovery');
    });

    it('Under: even pair > 4 → barrier 7', () => {
        const result = detectEvenOddPairSignal([1, 6, 8], { side: 'UNDER', even_min: 4 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_UNDER_BARRIER);
        expect(result.contract_type).toBe('DIGITUNDER');
    });

    it('Under recovery → barrier 6 immediately', () => {
        const result = detectEvenOddPairSignal([1, 3], {
            side: 'UNDER',
            recovering: true,
        });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(RECOVERY_UNDER_BARRIER);
    });

    it('rejects non-matching pairs', () => {
        expect(detectEvenOddPairSignal([0, 2], { side: 'OVER' }).matched).toBe(false);
        expect(detectEvenOddPairSignal([1, 3], { side: 'UNDER' }).matched).toBe(false);
    });
});

describe('recovery stake + tip key', () => {
    it('sizes stake from payout percent', () => {
        expect(calculatePayoutRecoveryStake(1.2, 60)).toBeCloseTo(2, 5);
        expect(calculatePayoutRecoveryStake(0, 60)).toBe(0);
    });

    it('locks one purchase per tip key', () => {
        const signal = detectEvenOddPairSignal([1, 5], { side: 'OVER' });
        const key = makeEvenOddPairSignalKey(signal, 42);
        expect(isEvenOddPairSignalConsumed(signal, 42, key)).toBe(true);
        expect(isEvenOddPairSignalConsumed(signal, 43, key)).toBe(false);
    });

    it('builds tip key from epoch + last-2 digits', () => {
        expect(makeEvenOddPairTipKey('100', [1, 0, 2])).toBe('100|d:0,2');
        expect(makeEvenOddPairTipKey('', [7])).toBe('empty|d:na');
    });
});

describe('runtime commit / settlement', () => {
    it('arms and releases stale commits', () => {
        const state = createEvenOddPairRuntimeState();
        armEvenOddPairPrediction(state, 3);
        expect(state.trade_committed).toBe(true);
        expect(state.armed_prediction).toBe(3);
        clearEvenOddPairCommit(state);
        expect(state.trade_committed).toBe(false);

        armEvenOddPairPrediction(state, 6);
        state.signal_issued_at = Date.now() - 25000;
        expect(releaseStaleEvenOddPairCommit(state, 20000)).toBe(true);
        expect(state.trade_committed).toBe(false);
    });

    it('applies settlement once per contract id and ignores stale stubs', () => {
        const state = createEvenOddPairRuntimeState();
        armEvenOddPairPrediction(state, 3);
        expect(applyEvenOddPairSettlement(state, 'c1')).toBe(true);
        expect(state.trade_committed).toBe(false);
        expect(state.last_handled_contract_id).toBe('c1');

        armEvenOddPairPrediction(state, 3);
        expect(state.trade_committed).toBe(true);
        expect(applyEvenOddPairSettlement(state, 'c1')).toBe(false);
        expect(state.trade_committed).toBe(true);

        expect(applyEvenOddPairSettlement(state, 'c2')).toBe(true);
        expect(state.trade_committed).toBe(false);
        expect(state.last_handled_contract_id).toBe('c2');
    });

    it('keeps armed barrier available until settlement or stale release', () => {
        const state = createEvenOddPairRuntimeState();
        armEvenOddPairPrediction(state, 2);
        expect(state.trade_committed).toBe(true);
        expect(state.armed_prediction).toBe(2);
        // Mimic pending purchase: still committed, barrier retained for retry.
        expect(state.armed_prediction).toBe(ENTRY_OVER_BARRIER);
        applyEvenOddPairSettlement(state, 'buy-1');
        expect(state.trade_committed).toBe(false);
        expect(state.armed_prediction).toBe(-1);
    });
});
