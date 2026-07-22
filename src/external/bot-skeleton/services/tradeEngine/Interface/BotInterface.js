import { observer as globalObserver } from '../../../utils/observer';
import { createDetails } from '../utils/helpers';
import { getDigitTransitionPrediction } from '../utils/digit-transition';
import { evaluateOverZeroGapFilter } from '../utils/gap-filter';
import { evaluatePercentageFilter } from '../utils/percentage-filter';
import {
    createRecoveryState,
    calculateRecoveryStake,
    configureRecoveryState,
    applyRecoveryResult,
} from '../utils/recovery-stake';
import { createTrackerState, evaluateAdaptiveDigitGap, releaseAdaptiveDigitGapActiveTrade } from '../utils/adaptive-digit-gap';
import {
    createTrackerState as createIncreasingGapTrackerState,
    evaluateIncreasingDigitGap,
    releaseIncreasingDigitGapActiveTrade,
} from '../utils/increasing-digit-gap';
import {
    createTrackerState as createSignalScoreTrackerState,
    evaluateSignalScoreDiffers,
    releaseSignalScoreDiffersActiveTrade,
} from '../utils/signal-score-differs';
import {
    createTrackerState as createLongAbsenceReturnTrackerState,
    evaluateLongAbsenceReturnDiffers,
    releaseLongAbsenceReturnActiveTrade,
} from '../utils/long-absence-return-differs';
import {
    createTrackerState as createConditionalEvenOddTrackerState,
    evaluateConditionalEvenOddDiffers,
    releaseConditionalEvenOddActiveTrade,
} from '../utils/conditional-even-odd-differs';
import {
    createTrackerState as createConditionalHighLowTrackerState,
    evaluateConditionalHighLowDiffers,
    releaseConditionalHighLowActiveTrade,
} from '../utils/conditional-high-low-differs';
import { evaluateConsecutiveDigitsOver } from '../utils/consecutive-digits-over';
import {
    applyWindowIndexDiffersResult,
    createWindowIndexDiffersState,
    evaluateWindowIndexDiffers,
    resetWindowIndexDiffersState,
} from '../utils/window-index-differs';
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
            releaseSignalScoreDiffersActiveTrade(tradeEngine.signalScoreDiffersState);
            tradeEngine.signalScoreDiffersState = null;
            releaseLongAbsenceReturnActiveTrade(tradeEngine.longAbsenceReturnState);
            tradeEngine.longAbsenceReturnState = null;
            releaseConditionalEvenOddActiveTrade(tradeEngine.conditionalEvenOddState);
            tradeEngine.conditionalEvenOddState = null;
            releaseConditionalHighLowActiveTrade(tradeEngine.conditionalHighLowState);
            tradeEngine.conditionalHighLowState = null;
            if (tradeEngine.rangeMomentumState) {
                resetRangeMomentumState(tradeEngine.rangeMomentumState);
                tradeEngine.rangeMomentumState = null;
            }
            tradeEngine.recoveryState = null;
            if (tradeEngine.windowIndexDiffersState) {
                resetWindowIndexDiffersState(tradeEngine.windowIndexDiffersState);
                tradeEngine.windowIndexDiffersState = null;
            }
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
            if (tradeEngine.windowIndexDiffersState) {
                const digits = tradeEngine.getCachedLastDigitList(1);
                const last =
                    Array.isArray(digits) && digits.length
                        ? digits[digits.length - 1]
                        : undefined;
                applyWindowIndexDiffersResult(tradeEngine.windowIndexDiffersState, last);
            }
        },
        isRecovering: () => {
            const state = tradeEngine.recoveryState;
            if (!state) {
                return false;
            }
            return Number(state.accumulatedLoss) > 0 && Number(state.remainingSplits) > 0;
        },
        /**
         * Digit Successor Differs — within tick_window, map what followed each
         * digit 0–9; when current is X and X→Y was seen, Differs on Y.
         */
        evaluateConsecutiveDigitsOver: async options => {
            const opts = options || {};
            const window_size = Math.max(
                2,
                Math.floor(Number(opts.tick_window ?? opts.digit_count)) || 5
            );
            const digits = tradeEngine.ensureTickHistory
                ? await tradeEngine.ensureTickHistory(window_size)
                : tradeEngine.getCachedLastDigitList(window_size);
            const window_digits = Array.isArray(digits) ? digits.slice(-window_size) : [];
            return evaluateConsecutiveDigitsOver(window_digits, opts);
        },
        /**
         * Window Index Differs — reference window of n digits; next window Differs
         * each index against the digit at the same index in the previous window.
         */
        evaluateWindowIndexDiffers: async options => {
            const opts = options || {};
            if (!tradeEngine.windowIndexDiffersState) {
                tradeEngine.windowIndexDiffersState = createWindowIndexDiffersState(
                    opts.tick_window
                );
            }
            const window_size = Math.max(2, Math.floor(Number(opts.tick_window)) || 5);
            const digits = tradeEngine.ensureTickHistory
                ? await tradeEngine.ensureTickHistory(window_size)
                : tradeEngine.getCachedLastDigitList(window_size);
            return evaluateWindowIndexDiffers(
                Array.isArray(digits) ? digits : [],
                opts,
                tradeEngine.windowIndexDiffersState
            );
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
         * Signal Score Differs — modular multi-condition scoring per digit.
         */
        evaluateSignalScoreDiffers: options => {
            if (!tradeEngine.signalScoreDiffersState) {
                tradeEngine.signalScoreDiffersState = createSignalScoreTrackerState();
            }
            const digit_ticks = tradeEngine.getCachedDigitTicks();
            return evaluateSignalScoreDiffers(digit_ticks, options || {}, tradeEngine.signalScoreDiffersState);
        },
        /**
         * Long-Absence Return Differs — wait after a digit returns from long absence.
         */
        evaluateLongAbsenceReturnDiffers: options => {
            if (!tradeEngine.longAbsenceReturnState) {
                tradeEngine.longAbsenceReturnState = createLongAbsenceReturnTrackerState();
            }
            const digit_ticks = tradeEngine.getCachedDigitTicks();
            return evaluateLongAbsenceReturnDiffers(
                digit_ticks,
                options || {},
                tradeEngine.longAbsenceReturnState
            );
        },
        /**
         * Conditional Even/Odd Differs — primary digit signal + parity confirmation filter.
         */
        evaluateConditionalEvenOddDiffers: options => {
            if (!tradeEngine.conditionalEvenOddState) {
                tradeEngine.conditionalEvenOddState = createConditionalEvenOddTrackerState();
                tradeEngine.conditionalEvenOddState.primaryProbeStates = {
                    signalScoreState: createSignalScoreTrackerState(),
                    increasingGapState: createIncreasingGapTrackerState(),
                    longAbsenceState: createLongAbsenceReturnTrackerState(),
                    adaptiveGapState: createTrackerState(),
                };
            }
            const digit_ticks = tradeEngine.getCachedDigitTicks();
            return evaluateConditionalEvenOddDiffers(
                digit_ticks,
                options || {},
                tradeEngine.conditionalEvenOddState,
                tradeEngine.conditionalEvenOddState.primaryProbeStates
            );
        },
        /**
         * Conditional High/Low Differs — primary digit signal + High/Low group confirmation filter.
         */
        evaluateConditionalHighLowDiffers: options => {
            if (!tradeEngine.conditionalHighLowState) {
                tradeEngine.conditionalHighLowState = createConditionalHighLowTrackerState();
                tradeEngine.conditionalHighLowState.primaryProbeStates = {
                    signalScoreState: createSignalScoreTrackerState(),
                    increasingGapState: createIncreasingGapTrackerState(),
                    longAbsenceState: createLongAbsenceReturnTrackerState(),
                    adaptiveGapState: createTrackerState(),
                };
            }
            const digit_ticks = tradeEngine.getCachedDigitTicks();
            return evaluateConditionalHighLowDiffers(
                digit_ticks,
                options || {},
                tradeEngine.conditionalHighLowState,
                tradeEngine.conditionalHighLowState.primaryProbeStates
            );
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
