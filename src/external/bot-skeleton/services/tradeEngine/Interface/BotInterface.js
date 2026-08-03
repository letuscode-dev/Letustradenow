import { observer as globalObserver } from '../../../utils/observer';
import { createDetails } from '../utils/helpers';
import { getDigitTransitionPrediction } from '../utils/digit-transition';
import { evaluateOverZeroGapFilter } from '../utils/gap-filter';
import {
    clampDigitPercentageWindow,
    getDigitPercentageValue,
    getSlidingDigitWindow,
} from '../utils/digit-percentage-condition';
import {
    DEFAULT_LOOKBACK as PATTERN_OU_DEFAULT_LOOKBACK,
    evaluatePatternProbabilityOverUnder as runPatternProbabilityOverUnder,
    MAX_LOOKBACK as PATTERN_OU_MAX_LOOKBACK,
} from '../utils/pattern-probability-over-under';
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
import {
    createStrategyVotingState,
    evaluateStrategyVoting,
    resetStrategyVotingState,
} from '../utils/strategy-voting-engine';
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
import {
    buildSequentialScanResult,
    evaluateSymbolSequentialSignal,
    orderSymbolsForScan,
    pickFirstMatch,
    resolveScanSymbols,
} from '../utils/sequential-digit-differs';

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
            if (tradeEngine.strategyVotingState) {
                resetStrategyVotingState(tradeEngine.strategyVotingState);
                tradeEngine.strategyVotingState = null;
            }
            if (tradeEngine.coldDigitState) {
                resetColdDigitState(tradeEngine.coldDigitState);
                tradeEngine.coldDigitState = null;
            }
            tradeEngine.digitPercentageSnapshot = null;
            tradeEngine._digitPctFillPending = false;
            tradeEngine.patternProbabilitySnapshot = null;
            tradeEngine._patternOuFillPending = false;
            tradeEngine._patternOuLastJournalKey = null;
            tradeEngine.patternProbabilityLastWasLoss = false;
            tradeEngine.sequentialDigitDiffersSnapshot = null;
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
            tradeEngine.patternProbabilityLastWasLoss = !is_win;
            tradeEngine.patternProbabilitySnapshot = null;
            if (tradeEngine.windowIndexDiffersState) {
                // Prefer epoch-ordered live digits so settlement maps to the right tick.
                const digit_ticks = tradeEngine.getCachedDigitTicks
                    ? tradeEngine.getCachedDigitTicks()
                    : null;
                let last;
                if (Array.isArray(digit_ticks) && digit_ticks.length) {
                    const newest = digit_ticks[digit_ticks.length - 1];
                    last = newest && typeof newest === 'object' ? newest.digit : newest;
                } else {
                    const digits = tradeEngine.getCachedLastDigitList(1);
                    last =
                        Array.isArray(digits) && digits.length
                            ? digits[digits.length - 1]
                            : undefined;
                }
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
         * Same-Digit Wait Differs — if previous_digit === current_digit, wait
         * trade_wait ticks, then Differs that digit. Uses epoch-tagged ticks so
         * the wait advances after the sliding cache stops growing.
         */
        evaluateWindowIndexDiffers: async options => {
            const opts = options || {};
            if (!tradeEngine.windowIndexDiffersState) {
                tradeEngine.windowIndexDiffersState = createWindowIndexDiffersState();
            }
            const state = tradeEngine.windowIndexDiffersState;

            if (state.phase === 'armed' && state.lastPrediction >= 0 && state.lastPrediction <= 9) {
                return evaluateWindowIndexDiffers([], opts, state);
            }

            let digit_ticks = tradeEngine.getCachedDigitTicks
                ? tradeEngine.getCachedDigitTicks()
                : null;
            if (!Array.isArray(digit_ticks) || digit_ticks.length < 2) {
                const digits = tradeEngine.ensureTickHistory
                    ? await tradeEngine.ensureTickHistory(10)
                    : tradeEngine.getCachedLastDigitList(10);
                digit_ticks = Array.isArray(digits) ? digits : [];
            }
            return evaluateWindowIndexDiffers(digit_ticks, opts, state);
        },
        /**
         * Strategy Voting Engine — weighted Digit Differs votes across modular strategies.
         */
        evaluateStrategyVoting: async options => {
            const opts = options || {};
            if (!tradeEngine.strategyVotingState) {
                tradeEngine.strategyVotingState = createStrategyVotingState();
            }
            const window_size = Math.max(10, Math.floor(Number(opts.tick_window)) || 50);
            let digits = tradeEngine.getCachedLastDigitList(window_size);
            if (!Array.isArray(digits) || digits.length < window_size) {
                digits = tradeEngine.ensureTickHistory
                    ? await tradeEngine.ensureTickHistory(window_size)
                    : digits;
            }
            const window_digits = Array.isArray(digits) ? digits.slice(-window_size) : [];
            return evaluateStrategyVoting(
                window_digits,
                opts,
                tradeEngine.strategyVotingState
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
         * Over / Under % of last N digits — returns a finite number 0–100.
         * Barrier: Over 5 → digits > 5; Under 4 → digits < 4.
         * Returns 0 while the tick window is still filling (so comparisons stay false).
         *
         * Sync on purpose: bots often evaluate Over + Under many times per tick
         * (notify + purchase conditions). An async interpreter pause per call caused
         * visible lag. History fill (if needed) is kicked off in the background.
         *
         * Sliding window: newest N live digits. Same-tick Over/Under share one
         * snapshot (window + per-direction results) so work is not repeated.
         */
        evaluateDigitPercentageCondition: (direction, barrier, sample_size) => {
            const window_size = clampDigitPercentageWindow(sample_size);
            const tip_key = tradeEngine.getLatestTickTipKey
                ? tradeEngine.getLatestTickTipKey()
                : `len:${window_size}`;
            const result_key = `${String(direction || 'OVER').toUpperCase()}:${Number(barrier)}`;

            const cache = tradeEngine.digitPercentageSnapshot;
            if (
                cache &&
                cache.tip_key === tip_key &&
                cache.window_size === window_size &&
                cache.results &&
                Object.prototype.hasOwnProperty.call(cache.results, result_key)
            ) {
                return cache.results[result_key];
            }

            let digit_window;
            let results;
            if (
                cache &&
                cache.tip_key === tip_key &&
                cache.window_size === window_size &&
                Array.isArray(cache.window)
            ) {
                digit_window = cache.window;
                results = cache.results || {};
            } else {
                // Map only the newest N ticks — not the full live cache.
                const digits = tradeEngine.getAvailableLastDigitList
                    ? tradeEngine.getAvailableLastDigitList(window_size)
                    : tradeEngine.getCachedLastDigitList(window_size);
                digit_window = getSlidingDigitWindow(digits || [], window_size);
                results = {};

                // Non-blocking history fill — never await inside the interpreter.
                if (
                    digit_window.length < window_size &&
                    tradeEngine.ensureTickHistory &&
                    !tradeEngine._digitPctFillPending
                ) {
                    tradeEngine._digitPctFillPending = true;
                    Promise.resolve(tradeEngine.ensureTickHistory(window_size))
                        .catch(() => {})
                        .finally(() => {
                            tradeEngine._digitPctFillPending = false;
                            // History grew without a new tip — force recompute on next call.
                            tradeEngine.digitPercentageSnapshot = null;
                        });
                }
            }

            const percentage = getDigitPercentageValue(digit_window, {
                direction,
                barrier,
                sample_size: window_size,
            });
            results[result_key] = percentage;
            tradeEngine.digitPercentageSnapshot = {
                tip_key,
                window_size,
                window: digit_window,
                results,
            };
            return percentage;
        },
        /**
         * Pattern-probability Over/Under — sync, tip-snapshotted.
         * Never awaits history fill (no interpreter pause). Uses whatever digits
         * are already cached and kicks off a background fill when short.
         * Returns full analysis object; Blockly unwraps barrier / side / confidence.
         */
        evaluatePatternProbabilityOverUnder: options => {
            const opts = options || {};
            const lookback = Math.max(
                10,
                Math.min(
                    PATTERN_OU_MAX_LOOKBACK,
                    Math.floor(Number(opts.lookback)) || PATTERN_OU_DEFAULT_LOOKBACK
                )
            );

            // After a loss, skip Over 1 / Under 8 (thin payouts hurt recovery).
            let last_was_loss = false;
            if (typeof tradeEngine.patternProbabilityLastWasLoss === 'boolean') {
                last_was_loss = tradeEngine.patternProbabilityLastWasLoss;
            }
            if (tradeEngine.data?.contract) {
                try {
                    const details = createDetails(tradeEngine.data.contract);
                    if (details?.[10] === 'loss' || details?.[10] === 'win') {
                        last_was_loss = details[10] === 'loss';
                        tradeEngine.patternProbabilityLastWasLoss = last_was_loss;
                    }
                } catch (e) {
                    // keep prior flag
                }
            }

            // Prefer available (possibly short) digits — never block until lookback is full.
            const digits = tradeEngine.getAvailableLastDigitList
                ? tradeEngine.getAvailableLastDigitList(lookback)
                : tradeEngine.getCachedLastDigitList(lookback);
            const history_len = Array.isArray(digits) ? digits.length : 0;

            const tip_base = tradeEngine.getLatestTickTipKey
                ? tradeEngine.getLatestTickTipKey()
                : `lb:${lookback}`;
            // Include history length so a background fill invalidates the tip cache
            // without waiting for the next live tick.
            const tip_key = `${tip_base}:hlen:${history_len}`;
            const options_key = [
                lookback,
                Math.floor(Number(opts.pattern_length)) || 2,
                Math.floor(Number(opts.min_occurrences)) || 3,
                Number(opts.min_confidence) || 70,
                String(opts.market_side || 'BOTH').toUpperCase(),
                opts.multi_length_consensus === false ? 0 : 1,
                last_was_loss ? 1 : 0,
            ].join(':');

            const cache = tradeEngine.patternProbabilitySnapshot;
            if (cache && cache.tip_key === tip_key && cache.options_key === options_key && cache.result) {
                return cache.result;
            }

            // Non-blocking history fill — never await inside the interpreter.
            if (history_len < lookback && tradeEngine.ensureTickHistory && !tradeEngine._patternOuFillPending) {
                tradeEngine._patternOuFillPending = true;
                Promise.resolve(tradeEngine.ensureTickHistory(lookback))
                    .catch(() => {})
                    .finally(() => {
                        tradeEngine._patternOuFillPending = false;
                        // Fill completed without a new tip — force recompute on next call.
                        tradeEngine.patternProbabilitySnapshot = null;
                    });
            }

            const result = runPatternProbabilityOverUnder(digits || [], {
                ...opts,
                lookback,
                last_was_loss,
                avoid_low_payout_after_loss:
                    opts.avoid_low_payout_after_loss === undefined ? true : opts.avoid_low_payout_after_loss,
            });

            // Suppress duplicate NO-TRADE journal spam while Start() retries each second.
            const journal_key = `${result.pattern}|${result.reason}|${result.should_trade ? 1 : 0}|${
                last_was_loss ? 1 : 0
            }|hlen:${history_len}`;
            let public_result = result;
            if (
                !result.should_trade &&
                tradeEngine._patternOuLastJournalKey === journal_key &&
                Array.isArray(result.journal_messages)
            ) {
                public_result = { ...result, journal_messages: [] };
            } else {
                tradeEngine._patternOuLastJournalKey = journal_key;
            }

            tradeEngine.patternProbabilitySnapshot = {
                tip_key,
                options_key,
                result: public_result,
            };
            return public_result;
        },
        /**
         * Record last pattern-OU trade outcome so Over 1 / Under 8 can be skipped after losses.
         */
        setPatternProbabilityLastResult: is_loss => {
            tradeEngine.patternProbabilityLastWasLoss = !!is_loss;
            tradeEngine.patternProbabilitySnapshot = null;
        },
        getPatternProbabilityIsOver: () => {
            const result = tradeEngine.patternProbabilitySnapshot?.result;
            return Boolean(result && result.should_trade && result.side === 'OVER');
        },
        getPatternProbabilityConfidence: () => {
            const result = tradeEngine.patternProbabilitySnapshot?.result;
            const confidence = Number(result?.confidence);
            return Number.isFinite(confidence) ? confidence : 0;
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
        /**
         * Sequential Digit Differs — scan configured volatility symbols for
         * ascending/descending consecutive last-3 runs; optionally switch market.
         */
        evaluateSequentialDigitDiffersScan: async options => {
            const opts = options || {};
            const market_group = opts.market_group;
            const symbols = resolveScanSymbols(opts);
            const active_symbol =
                tradeEngine.options?.symbol || tradeEngine.symbol || symbols[0] || '';
            const ordered = orderSymbolsForScan(symbols, active_symbol);
            const switch_symbol =
                opts.switch_symbol === undefined
                    ? true
                    : opts.switch_symbol === true ||
                      opts.switch_symbol === 1 ||
                      opts.switch_symbol === 'TRUE' ||
                      opts.switch_symbol === 'true';

            const evaluations = [];
            for (let i = 0; i < ordered.length; i++) {
                const symbol = ordered[i];
                let digits = [];
                try {
                    digits = tradeEngine.getDigitsForSymbol
                        ? await tradeEngine.getDigitsForSymbol(symbol, 5)
                        : [];
                } catch (e) {
                    digits = [];
                }
                evaluations.push(evaluateSymbolSequentialSignal(symbol, digits));
            }

            const match = pickFirstMatch(evaluations);
            let switched = false;
            if (match && switch_symbol && match.symbol && match.symbol !== active_symbol) {
                try {
                    if (typeof tradeEngine.switchTradeSymbol === 'function') {
                        await tradeEngine.switchTradeSymbol(match.symbol);
                        switched = true;
                    }
                } catch (e) {
                    switched = false;
                }
            }

            const result = buildSequentialScanResult({
                market_group,
                symbols: ordered,
                active_symbol,
                journal_enabled: opts.journal_enabled,
                evaluations,
                match,
                switched,
            });

            tradeEngine.sequentialDigitDiffersSnapshot = result;
            return result;
        },
        switchTradeSymbol: symbol =>
            tradeEngine.switchTradeSymbol
                ? tradeEngine.switchTradeSymbol(symbol)
                : Promise.resolve(symbol),
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
