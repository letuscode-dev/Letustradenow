import {
    DEFAULT_PAYOUT_PERCENT,
    DEFAULT_RECOVERY_SPLITS,
    applyRecoveryResult,
    calculateRecoveryStake,
    configureRecoveryState,
    createRecoveryState,
} from '../recovery-stake';

describe('calculateRecoveryStake', () => {
    it('returns initial stake when not recovering', () => {
        const state = createRecoveryState({ initialStake: 1, payoutPercent: 95, recoverySplits: 1 });
        expect(calculateRecoveryStake(state)).toBe(1);
    });

    it('sizes one-run recovery from payout percent (spec-style)', () => {
        // Lost 10, payout 95%, splits 1 → stake = 10 / 0.95 ≈ 10.53
        const state = createRecoveryState({ initialStake: 1, payoutPercent: 95, recoverySplits: 1 });
        state.accumulatedLoss = 10;
        state.remainingSplits = 1;
        expect(calculateRecoveryStake(state)).toBe(10.53);
    });

    it('splits recovery across N winning runs', () => {
        // Lost 10, payout 100%, splits 2 → first stake = 5
        const state = createRecoveryState({ initialStake: 1, payoutPercent: 100, recoverySplits: 2 });
        state.accumulatedLoss = 10;
        state.remainingSplits = 2;
        expect(calculateRecoveryStake(state)).toBe(5);
    });
});

describe('applyRecoveryResult', () => {
    it('accumulates loss and plans N recovery wins', () => {
        const state = createRecoveryState({
            initialStake: 1,
            payoutPercent: 95,
            recoverySplits: 2,
        });
        applyRecoveryResult(state, false, -1);
        expect(state.accumulatedLoss).toBe(1);
        expect(state.remainingSplits).toBe(2);
    });

    it('reduces accumulated loss on wins until flat', () => {
        const state = createRecoveryState({
            initialStake: 1,
            payoutPercent: 100,
            recoverySplits: 2,
        });
        applyRecoveryResult(state, false, -10);
        expect(state.accumulatedLoss).toBe(10);
        expect(state.remainingSplits).toBe(2);

        const stake1 = calculateRecoveryStake(state);
        expect(stake1).toBe(5);
        applyRecoveryResult(state, true, 5);
        expect(state.accumulatedLoss).toBe(5);
        expect(state.remainingSplits).toBe(1);

        const stake2 = calculateRecoveryStake(state);
        expect(stake2).toBe(5);
        applyRecoveryResult(state, true, 5);
        expect(state.accumulatedLoss).toBe(0);
        expect(state.remainingSplits).toBe(0);
        expect(calculateRecoveryStake(state)).toBe(1);
    });

    it('re-plans remaining splits after another loss mid-recovery', () => {
        const state = createRecoveryState({
            initialStake: 1,
            payoutPercent: 100,
            recoverySplits: 3,
        });
        applyRecoveryResult(state, false, -6);
        applyRecoveryResult(state, true, 2);
        expect(state.accumulatedLoss).toBe(4);
        expect(state.remainingSplits).toBe(2);

        applyRecoveryResult(state, false, -4);
        expect(state.accumulatedLoss).toBe(8);
        expect(state.remainingSplits).toBe(3);
    });
});

describe('configureRecoveryState', () => {
    it('applies defaults and can reset active recovery', () => {
        const state = createRecoveryState();
        state.accumulatedLoss = 9;
        state.remainingSplits = 2;
        configureRecoveryState(
            state,
            { initialStake: 2, payoutPercent: 90, recoverySplits: 4 },
            true
        );
        expect(state.initialStake).toBe(2);
        expect(state.payoutPercent).toBe(90);
        expect(state.recoverySplits).toBe(4);
        expect(state.accumulatedLoss).toBe(0);
        expect(state.remainingSplits).toBe(0);
        expect(DEFAULT_PAYOUT_PERCENT).toBe(95);
        expect(DEFAULT_RECOVERY_SPLITS).toBe(1);
    });
});
