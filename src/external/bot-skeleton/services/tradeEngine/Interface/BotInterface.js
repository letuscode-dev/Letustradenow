import { observer as globalObserver } from '../../../utils/observer';
import { createDetails } from '../utils/helpers';
import { getDigitTransitionPrediction } from '../utils/digit-transition';
import { evaluateOverZeroGapFilter } from '../utils/gap-filter';
import { evaluatePercentageFilter } from '../utils/percentage-filter';
import {
    applyRecoveryResult,
    calculateRecoveryStake,
    configureRecoveryState,
    createRecoveryState,
} from '../utils/recovery-stake';
import { createTrackerState, evaluateAdaptiveDigitGap, releaseAdaptiveDigitGapActiveTrade } from '../utils/adaptive-digit-gap';
import {
    createTrackerState as createIncreasingGapTrackerState,
    evaluateIncreasingDigitGap,
    releaseIncreasingDigitGapActiveTrade,
} from '../utils/increasing-digit-gap';
import { evaluateComplementDigit } from '../utils/complement-digit';
import {
    consumeColdDigitSignal,
    createColdDigitState,
    evaluateColdDigit,
    resetColdDigitState,
} from '../utils/cold-digit';
import {
    createRangeMomentumState,
    evaluateRangeMomentumOverOne,
    resetRangeMomentumState,
} from '../utils/range-momentum';

const getBotInterface = tradeEngine => {
    const getDetail = i => createDetails(tradeEngine.data.contract)[i];

    return {
        init: (...args) => tradeEngine.init(...args),
        start: (...args) => tradeEngine.start(...args),
        stop: (...args) => {
            releaseAdaptiveDigitGapActiveTrade(tradeEngine.adaptiveDigitGapState);
            tradeEngine.adaptiveDigitGapState = null;
            releaseIncreasingDigitGapActiveTrade(tradeEngine.increasingDigitGapState);
            tradeEngine.increasingDigitGapState = null;
            if (tradeEngine.rangeMomentumState) {
                resetRangeMomentumState(tradeEngine.rangeMomentumState);
                tradeEngine.rangeMomentumState = null;
            }
            tradeEngine.recoveryState = null;
            if (tradeEngine.coldDigitState) {
                resetColdDigitState(tradeEngine.coldDigitState);
                tradeEngine.coldDigitState = null;
            }
            return tradeEngine.stop(...args);
        },
        purchase: contract_type => tradeEngine.purchase(contract_type),
        purchaseOverrideContractType: contract_type => tradeEngine.purchaseOverrideContractType(contract_type),
        getAskPrice: contract_type => Number(getProposal(contract_type, tradeEngine).ask_price),
        getPayout: contract_type => Number(getProposal(contract_type, tradeEngine).payout),
        getCachedLastDigitList: tick_count => tradeEngine.getCachedLastDigitList(tick_count),
        configureRecovery: (initial_stake, payout_percent, recovery_splits) => {
            const is_new = !tradeEngine.recoveryState;
            if (is_new) {
                tradeEngine.recoveryState = createRecoveryState();
            }
            // Only wipe recovery progress on a fresh bot start (first configure).
            configureRecoveryState(
                tradeEngine.recoveryState,
                {
                    initialStake: initial_stake,
                    payoutPercent: payout_percent,
                    recoverySplits: recovery_splits,
                },
                is_new
            );
        },
        getRecoveryStake: () => {
            if (!tradeEngine.recoveryState) {
                tradeEngine.recoveryState = createRecoveryState();
            }
            const stake = calculateRecoveryStake(tradeEngine.recoveryState);
            tradeEngine.recoveryState.lastStake = stake;
            return stake;
        },
        applyRecoveryResult: (is_win, profit) => {
            if (!tradeEngine.recoveryState) {
                tradeEngine.recoveryState = createRecoveryState();
            }
            applyRecoveryResult(tradeEngine.recoveryState, !!is_win, profit);
        },
        getDigitTransitionPrediction: (tick_count, threshold) => {
            const requested = Math.max(2, Math.floor(Number(tick_count)) || 120);
            const digits = tradeEngine.getCachedLastDigitList(requested);
            if (!digits?.length || digits.length < requested) {
                return -1;
            }
            return getDigitTransitionPrediction(digits.slice(-requested), threshold);
        },
        /**
         * Over 0 gap filter — returns { allowed, gap, message, journal_enabled, ... }.
         * Uses all currently cached digits (request 1 ⇒ full cache when any ticks exist).
         */
        evaluateOverZeroGapFilter: (enabled, min_gap, max_gap, journal_enabled) => {
            const digits = tradeEngine.getCachedLastDigitList(1);
            return evaluateOverZeroGapFilter(digits, {
                enabled,
                min_gap,
                max_gap,
                journal_enabled,
            });
        },
        /**
         * Percentage Filter (Over 2) — last 100 ticks, digits 3–9 vs threshold.
         * Requests Deriv tick history when the cache is short, then reads the
         * live sliding window as new ticks arrive.
         */
        evaluatePercentageFilter: async (enabled, threshold, journal_enabled) => {
            const digits = await tradeEngine.ensureTickHistory(100);
            return evaluatePercentageFilter(digits, {
                enabled,
                threshold,
                journal_enabled,
            });
        },
        /**
         * Adaptive per-digit gap Differs — returns { prediction, journal_messages, dashboard, ... }.
         * Persistent tracker state is kept on the trade engine for the bot session.
         */
        evaluateAdaptiveDigitGap: options => {
            if (!tradeEngine.adaptiveDigitGapState) {
                tradeEngine.adaptiveDigitGapState = createTrackerState();
            }
            // Use epoch-tagged ticks — the live cache is a fixed-length sliding window.
            const digit_ticks = tradeEngine.getCachedDigitTicks();
            return evaluateAdaptiveDigitGap(digit_ticks, options || {}, tradeEngine.adaptiveDigitGapState);
        },
        /**
         * Increasing gap Differs — arithmetic progression gap prediction.
         */
        evaluateIncreasingDigitGap: options => {
            if (!tradeEngine.increasingDigitGapState) {
                tradeEngine.increasingDigitGapState = createIncreasingGapTrackerState();
            }
            const digit_ticks = tradeEngine.getCachedDigitTicks();
            return evaluateIncreasingDigitGap(digit_ticks, options || {}, tradeEngine.increasingDigitGapState);
        },
        /**
         * Complement Digit Differs — previous+current === 9 → Differs current digit.
         */
        evaluateComplementDigit: options => {
            const digits = tradeEngine.getCachedLastDigitList(2);
            return evaluateComplementDigit(digits, options || {});
        },
        /**
         * Cold Digit Differs — Analysis-style least-frequent digit in last N ticks.
         * Requests the user-configured ticks_history immediately, then evaluates the
         * latest sliding window of exactly that sample size.
         */
        evaluateColdDigit: async options => {
            if (!tradeEngine.coldDigitState) {
                tradeEngine.coldDigitState = createColdDigitState();
            }
            const sample = Math.max(
                30,
                Math.min(500, Math.floor(Number(options?.tick_sample_size)) || 100)
            );
            const digits = tradeEngine.ensureTickHistory
                ? await tradeEngine.ensureTickHistory(sample)
                : tradeEngine.getCachedLastDigitList(sample);
            return evaluateColdDigit(digits || [], options || {}, tradeEngine.coldDigitState);
        },
        consumeColdDigitSignal: () => {
            if (!tradeEngine.coldDigitState) {
                tradeEngine.coldDigitState = createColdDigitState();
            }
            consumeColdDigitSignal(tradeEngine.coldDigitState);
        },
        /**
         * Range Momentum Over 1 — Lower(2-5)→Higher(6-9) with losing-digit lookback filter.
         */
        evaluateRangeMomentumOverOne: options => {
            if (!tradeEngine.rangeMomentumState) {
                tradeEngine.rangeMomentumState = createRangeMomentumState();
            }
            const digit_ticks = tradeEngine.getCachedDigitTicks
                ? tradeEngine.getCachedDigitTicks()
                : tradeEngine.getCachedLastDigitList(1);
            return evaluateRangeMomentumOverOne(digit_ticks, options || {}, tradeEngine.rangeMomentumState);
        },
        getPurchaseReference: () => tradeEngine.getPurchaseReference(),
        isSellAvailable: () => tradeEngine.isSellAtMarketAvailable(),
        sellAtMarket: () => tradeEngine.sellAtMarket(),
        getSellPrice: () => getSellPrice(tradeEngine),
        isResult: result => getDetail(10) === result,
        isTradeAgain: result => globalObserver.emit('bot.trade_again', result),
        readDetails: i => getDetail(i - 1),
    };
};

const getProposal = (contract_type, tradeEngine) => {
    return tradeEngine.data.proposals.find(
        proposal =>
            proposal.contract_type === contract_type &&
            proposal.purchase_reference === tradeEngine.getPurchaseReference()
    );
};

const getSellPrice = tradeEngine => {
    return tradeEngine.getSellPrice();
};

export default getBotInterface;
