import {
    calculatePayoutRecoveryStake,
    detectEvenOddPairSignal,
    getLastTwoDigits,
    isEvenPairBelowThreshold,
    isOddPairAboveThreshold,
    makeEvenOddPairSignalKey,
    isEvenOddPairSignalConsumed,
    armEvenOddPairPrediction,
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

    it('detects even pair below threshold', () => {
        expect(isEvenPairBelowThreshold(0, 2, 5)).toBe(true);
        expect(isEvenPairBelowThreshold(0, 4, 5)).toBe(true);
        expect(isEvenPairBelowThreshold(2, 6, 5)).toBe(false); // 6 not < 5
        expect(isEvenPairBelowThreshold(1, 2, 5)).toBe(false); // odd
        expect(isEvenPairBelowThreshold(4, 4, 4)).toBe(false); // not < 4
    });

    it('detects odd pair above threshold', () => {
        expect(isOddPairAboveThreshold(5, 7, 4)).toBe(true);
        expect(isOddPairAboveThreshold(9, 9, 4)).toBe(true);
        expect(isOddPairAboveThreshold(3, 5, 4)).toBe(false); // 3 not > 4
        expect(isOddPairAboveThreshold(6, 7, 4)).toBe(false); // even
        expect(isOddPairAboveThreshold(5, 5, 5)).toBe(false); // not > 5
    });
});

describe('detectEvenOddPairSignal', () => {
    it('Over: even pair < 5 → barrier 2', () => {
        const result = detectEvenOddPairSignal([9, 0, 2], { side: 'OVER', even_max: 5 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_OVER_BARRIER);
        expect(result.previous_digit).toBe(0);
        expect(result.current_digit).toBe(2);
        expect(result.contract_type).toBe('DIGITOVER');
    });

    it('Over recovery → barrier 3 immediately', () => {
        const result = detectEvenOddPairSignal([1, 3], {
            side: 'OVER',
            recovering: true,
        });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(RECOVERY_OVER_BARRIER);
        expect(result.reason).toContain('recovery');
    });

    it('Under: odd pair > 4 → barrier 7', () => {
        const result = detectEvenOddPairSignal([2, 5, 9], { side: 'UNDER', odd_min: 4 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_UNDER_BARRIER);
        expect(result.contract_type).toBe('DIGITUNDER');
    });

    it('Under recovery → barrier 6 immediately', () => {
        const result = detectEvenOddPairSignal([0, 2], {
            side: 'UNDER',
            recovering: true,
        });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(RECOVERY_UNDER_BARRIER);
    });

    it('rejects non-matching pairs', () => {
        expect(detectEvenOddPairSignal([1, 3], { side: 'OVER' }).matched).toBe(false);
        expect(detectEvenOddPairSignal([0, 2], { side: 'UNDER' }).matched).toBe(false);
    });
});

describe('recovery stake + consume key', () => {
    it('sizes stake from payout percent', () => {
        expect(calculatePayoutRecoveryStake(1.2, 60)).toBeCloseTo(2, 5);
        expect(calculatePayoutRecoveryStake(0, 60)).toBe(0);
    });

    it('locks one purchase per tip', () => {
        const signal = detectEvenOddPairSignal([0, 2], { side: 'OVER' });
        const key = makeEvenOddPairSignalKey(signal, 42);
        expect(isEvenOddPairSignalConsumed(signal, 42, key)).toBe(true);
        expect(isEvenOddPairSignalConsumed(signal, 43, key)).toBe(false);
    });
});

describe('runtime commit', () => {
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
});
