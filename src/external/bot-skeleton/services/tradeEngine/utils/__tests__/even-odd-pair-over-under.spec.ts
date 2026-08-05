import {
    calculatePayoutRecoveryStake,
    detectEvenOddPairSignal,
    getLastTwoDigits,
    getLastThreeDigits,
    isOddPairOverEntry,
    isEvenPairUnderEntry,
    isOddLastTwoDigits,
    isEvenLastTwoDigits,
    areLastThreeAtLeast,
    areLastThreeAtMost,
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

    it('reads last three digits', () => {
        expect(getLastThreeDigits([9, 2, 0, 4])).toEqual({
            digit_a: 2,
            digit_b: 0,
            digit_c: 4,
            previous_digit: 0,
            current_digit: 4,
            ready: true,
        });
        expect(getLastThreeDigits([1, 2]).ready).toBe(false);
    });

    it('detects odd last-2 + last-3 >= digit_min', () => {
        expect(isOddLastTwoDigits(5, 7)).toBe(true);
        expect(isOddLastTwoDigits(4, 7)).toBe(false);
        expect(areLastThreeAtLeast(5, 5, 7, 5)).toBe(true);
        expect(areLastThreeAtLeast(4, 5, 7, 5)).toBe(false); // 4 < 5
        expect(isOddPairOverEntry([5, 5, 7], undefined, undefined, 5)).toBe(true);
        expect(isOddPairOverEntry([4, 5, 7], undefined, undefined, 5)).toBe(false);
        expect(isOddPairOverEntry([5, 4, 6], undefined, undefined, 5)).toBe(false); // even last2
        expect(isOddPairOverEntry([5, 7], undefined, undefined, 5)).toBe(false); // need 3
        expect(isOddPairOverEntry(5, 5, 7, 5)).toBe(true);
    });

    it('detects even last-2 + last-3 <= digit_max', () => {
        expect(isEvenLastTwoDigits(0, 4)).toBe(true);
        expect(isEvenLastTwoDigits(1, 4)).toBe(false);
        expect(areLastThreeAtMost(2, 0, 4, 4)).toBe(true);
        expect(areLastThreeAtMost(5, 0, 4, 4)).toBe(false); // 5 > 4
        expect(isEvenPairUnderEntry([2, 0, 4], undefined, undefined, 4)).toBe(true);
        expect(isEvenPairUnderEntry([5, 0, 4], undefined, undefined, 4)).toBe(false);
        expect(isEvenPairUnderEntry([2, 1, 3], undefined, undefined, 4)).toBe(false); // odd last2
        expect(isEvenPairUnderEntry([4, 6], undefined, undefined, 4)).toBe(false); // need 3
        expect(isEvenPairUnderEntry(2, 0, 4, 4)).toBe(true);
    });
});

describe('detectEvenOddPairSignal', () => {
    it('Over: odd last-2 and last-3 >= 5 → barrier 2', () => {
        const result = detectEvenOddPairSignal([1, 5, 5, 7], { side: 'OVER', digit_min: 5 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_OVER_BARRIER);
        expect(result.contract_type).toBe('DIGITOVER');
        expect(result.digit_a).toBe(5);
        expect(result.digit_b).toBe(5);
        expect(result.digit_c).toBe(7);
    });

    it('Over accepts last-3 exactly at digit_min', () => {
        const result = detectEvenOddPairSignal([5, 5, 5], { side: 'OVER', digit_min: 5 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_OVER_BARRIER);
    });

    it('Over rejects when a last-3 digit is below digit_min', () => {
        expect(detectEvenOddPairSignal([4, 5, 7], { side: 'OVER', digit_min: 5 }).matched).toBe(
            false
        );
        expect(detectEvenOddPairSignal([5, 5, 3], { side: 'OVER', digit_min: 5 }).matched).toBe(
            false
        );
    });

    it('Over rejects even last-2 even if last-3 >= 5', () => {
        expect(detectEvenOddPairSignal([5, 6, 8], { side: 'OVER', digit_min: 5 }).matched).toBe(
            false
        );
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

    it('Under: even last-2 and last-3 <= 4 → barrier 7', () => {
        const result = detectEvenOddPairSignal([9, 2, 0, 4], { side: 'UNDER', digit_max: 4 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_UNDER_BARRIER);
        expect(result.contract_type).toBe('DIGITUNDER');
        expect(result.digit_a).toBe(2);
        expect(result.digit_b).toBe(0);
        expect(result.digit_c).toBe(4);
    });

    it('Under accepts last-3 exactly at digit_max', () => {
        const result = detectEvenOddPairSignal([4, 4, 4], { side: 'UNDER', digit_max: 4 });
        expect(result.matched).toBe(true);
        expect(result.barrier).toBe(ENTRY_UNDER_BARRIER);
    });

    it('Under rejects when a last-3 digit is above digit_max', () => {
        expect(detectEvenOddPairSignal([5, 0, 2], { side: 'UNDER', digit_max: 4 }).matched).toBe(
            false
        );
        expect(detectEvenOddPairSignal([2, 0, 6], { side: 'UNDER', digit_max: 4 }).matched).toBe(
            false
        );
    });

    it('Under rejects odd last-2 even if last-3 <= 4', () => {
        expect(detectEvenOddPairSignal([2, 1, 3], { side: 'UNDER', digit_max: 4 }).matched).toBe(
            false
        );
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
        const signal = detectEvenOddPairSignal([5, 5, 7], { side: 'OVER' });
        const key = makeEvenOddPairSignalKey(signal, 42);
        expect(isEvenOddPairSignalConsumed(signal, 42, key)).toBe(true);
        expect(isEvenOddPairSignalConsumed(signal, 43, key)).toBe(false);
    });

    it('builds tip key from epoch + last digits', () => {
        expect(makeEvenOddPairTipKey('100', [1, 0, 2])).toBe('100|d:1,0,2');
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
        expect(state.armed_prediction).toBe(ENTRY_OVER_BARRIER);
        applyEvenOddPairSettlement(state, 'buy-1');
        expect(state.trade_committed).toBe(false);
        expect(state.armed_prediction).toBe(-1);
    });
});
