import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { contract as emitContract } from '../utils/broadcast';
import { createTrackerState, evaluateAdaptiveDigitGap, releaseAdaptiveDigitGapActiveTrade } from '../utils/adaptive-digit-gap';
import {
    createAscendingRankNextState,
    evaluateAscendingRankNext,
    normalizeAscendingRankNextOptions,
    replayAscendingRankNext,
    resetAscendingRankNextState,
} from '../utils/ascending-rank-next-differ';
import {
    consumeColdDigitSignal,
    createColdDigitState,
    evaluateColdDigit,
    resetColdDigitState,
} from '../utils/cold-digit';
import { evaluateComplementDigit } from '../utils/complement-digit';
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
    applyHedgeLimits,
    armImmediateRecovery,
    deadDigitCount,
    deadDigitsDominate,
    evaluateQuietGap,
    quietGapPipReady,
    quietGapWindow,
    hedgeDecision,
    hedgeLimitCode,
    hedgeMayContinue,
    hedgeEntryPrice,
    hedgeExitPrice,
    hedgeNet,
    hedgeTicksDiffer,
    HEDGE_LIMIT_NONE,
    HEDGE_RECOVER,
    HEDGE_STOP,
    isSettledContract,
    legProfit,
    nextHedgeStake,
    resolveHedgeBarriers,
} from '../utils/digit-hedge';
import {
    createDigitPairReturnState,
    evaluateDigitPairReturnDiffers,
    resetDigitPairReturnState,
} from '../utils/digit-pair-return-differs';
import {
    clampDigitPercentageWindow,
    getDigitPercentageValue,
    getSlidingDigitWindow,
} from '../utils/digit-percentage-condition';
import {
    createDigitPercentageDecreaseRuntime,
    evaluateDigitPercentageDecrease as runDigitPercentageDecrease,
    getDigitPercentageDecreaseSymbolState,
    isDigitPercentageDecreaseSignalConsumed,
    makeDigitPercentageDecreaseSignalKey,
    normalizeDigitPercentageDecreaseOptions,
    pickBestDigitPercentageDecreaseMatch,
    resetDigitPercentageDecreaseState,
} from '../utils/digit-percentage-decrease';
import { getDigitTransitionPrediction } from '../utils/digit-transition';
import {
    createDoubleDigitReturnState,
    evaluateDoubleDigitReturnDiffers,
    resetDoubleDigitReturnState,
} from '../utils/double-digit-return-differs';
import {
    applyEvenOddPairSettlement,
    armEvenOddPairPrediction,
    buildEvenOddPairResult,
    createEvenOddPairRuntimeState,
    detectEvenOddPairSignal,
    makeEvenOddPairTipKey,
    releaseStaleEvenOddPairCommit,
    resetEvenOddPairRuntimeState,
    toMarketSide,
} from '../utils/even-odd-pair-over-under';
import {
    applyFddResult,
    createFddState,
    evaluateFddTick,
    FDD_PURCHASE_FAILURE_LIMIT,
    fddPlacedLine,
    fddResultLines,
    fddSettingsLines,
    fddStatusLines,
    fddStopReason,
    fddTickLines,
    fddTradeLines,
    normalizeFddSettings,
    readLastTwoDecimals,
    recordFddPurchaseFailure,
    syncFddSettings,
} from '../utils/first-decimal-digit-differ';
import { evaluateOverZeroGapFilter } from '../utils/gap-filter';
import { createDetails, getLastDigit } from '../utils/helpers';
import {
    applyHybridMultiScanSettlement,
    armHybridMultiScanPrediction,
    CONTRACT_CODE,
    createHybridMultiScanRuntimeState,
    evaluateHybridMultiScan as runHybridMultiScan,
    makeHybridMultiScanTipKey,
    normalizeHybridMultiScanOptions,
    releaseStaleHybridMultiScanCommit,
    resetHybridMultiScanRuntimeState,
} from '../utils/hybrid-multi-scan';
import {
    createTrackerState as createIncreasingGapTrackerState,
    evaluateIncreasingDigitGap,
    releaseIncreasingDigitGapActiveTrade,
} from '../utils/increasing-digit-gap';
import {
    applyLtdResult,
    createLtdState,
    evaluateLtdTick,
    extractDigitBeforeDecimal,
    ltdStopReason,
    normalizeLtdSettings,
    resultLines as ltdResultLines,
    settingsLines as ltdSettingsLines,
    statusLines as ltdStatusLines,
    tickLines as ltdTickLines,
    tradeLines as ltdTradeLines,
} from '../utils/last-tick-price-digit-differ';
import {
    createTrackerState as createLongAbsenceReturnTrackerState,
    evaluateLongAbsenceReturnDiffers,
    releaseLongAbsenceReturnActiveTrade,
} from '../utils/long-absence-return-differs';
import {
    createLowHighFlipScanState,
    createLowHighFlipState,
    evaluateLowHighFlip,
    evaluateLowHighFlipScan,
    HISTORY_TICKS as LOW_HIGH_FLIP_HISTORY_TICKS,
    releaseLowHighFlipScanSignal,
    replayLowHighFlip,
    resetLowHighFlipState,
} from '../utils/low-high-flip-over';
import {
    createMissingDigitReturnState,
    evaluateMissingDigitReturn,
    replayMissingDigitReturn,
    resetMissingDigitReturnState,
} from '../utils/missing-digit-return-differ';
import {
    armHotOddEvenDiffersPrediction,
    buildHotOddEvenDiffersResult,
    clearHotOddEvenDiffersCommit,
    createHotOddEvenDiffersRuntimeState,
    evaluateSymbolHotOddEvenDiffers,
    isHotOddEvenDiffersSignalConsumed,
    makeHotOddEvenDiffersSignalKey,
    normalizeHotOddEvenDiffersOptions,
    releaseStaleHotOddEvenDiffersCommit,
    resetHotOddEvenDiffersRuntimeState,
} from '../utils/odd-even-hot-digit';
import {
    applyParityRunSettlement,
    armParityRunPrediction,
    buildParityRunScanResult,
    createParityRunRuntimeState,
    evaluateSymbolParityRunSignal,
    isParityRunSignalConsumed,
    makeParityRunSignalKey,
    normalizeParityRunOptions,
    orderSymbolsForScan as orderParityRunSymbols,
    pickFirstParityRunMatch,
    releaseStaleParityRunCommit,
    resetParityRunRuntimeState,
    resolveScanSymbols as resolveParityRunSymbols,
} from '../utils/parity-run-differs';
import {
    DEFAULT_LOOKBACK as PATTERN_OU_DEFAULT_LOOKBACK,
    evaluatePatternProbabilityOverUnder as runPatternProbabilityOverUnder,
    MAX_LOOKBACK as PATTERN_OU_MAX_LOOKBACK,
} from '../utils/pattern-probability-over-under';
import { evaluatePatternSwitch as runPatternSwitch } from '../utils/pattern-switch';
import { evaluatePercentageFilter } from '../utils/percentage-filter';
import {
    createRangeMomentumState,
    evaluateRangeMomentumOverOne,
    resetRangeMomentumState,
} from '../utils/range-momentum';
import {
    createRankDropState,
    evaluateRankDrop,
    normalizeRankDropOptions,
    recordRankDropContract,
    replayRankDrop,
    resetRankDropState,
} from '../utils/rank-drop-differ';
import {
    applyRecoveryResult,
    calculateRecoveryStake,
    configureRecoveryState,
    createRecoveryState,
} from '../utils/recovery-stake';
import {
    createRecurringPatternDifferState,
    evaluateRecurringPatternDiffer,
    replayRecurringPatternDiffer,
    resetRecurringPatternDifferState,
} from '../utils/recurring-pattern-differ';
import {
    createRecurringPatternOver2State,
    evaluateRecurringPatternOver2,
    replayRecurringPatternOver2,
    resetRecurringPatternOver2State,
} from '../utils/recurring-pattern-over2';
import {
    createRecurringPatternUnder7State,
    evaluateRecurringPatternUnder7,
    replayRecurringPatternUnder7,
    resetRecurringPatternUnder7State,
} from '../utils/recurring-pattern-under7';
import {
    applyRepeatReappearSettlement,
    createRepeatReappearState,
    evaluateRepeatReappearDiffers,
    releaseStaleRepeatReappearCommit,
    resetRepeatReappearState,
} from '../utils/repeat-reappear-differs';
import {
    createRepeatedDigitRecurrenceState,
    evaluateRepeatedDigitRecurrence,
    replayRepeatedDigitRecurrence,
    resetRepeatedDigitRecurrenceState,
} from '../utils/repeated-digit-recurrence-differ';
import {
    checkHedgeRiskGates,
    createRiseFallHedgeState,
    dashboardLines,
    FALL,
    isTemporaryBlock,
    normalizeHedgeSettings,
    RISE,
} from '../utils/rise-fall-hedge';
import {
    analyzeHedgeEntry,
    decideHedgeEntry,
    entryFiredLines,
    entryNoTradeLine,
    entryRecord,
    entrySettingsLines,
    hedgeEconomics,
    loadEntryLog,
    normalizeEntrySettings,
    readHedgePayouts,
    requiredEntryScore,
    saveEntryLog,
    strategyBreakdownLines,
} from '../utils/rise-fall-hedge-entry';
import {
    onlyUpsDownsResultLines,
    onlyUpsDownsLimitCode,
    resolveOnlyUpsDownsCall,
} from '../utils/only-ups-downs';
import { notifyHedge, pollUntilSettled, settleCurrentHedge } from '../utils/rise-fall-hedge-runtime';
import {
    applySequentialDiffersTradeResult,
    armSequentialDiffersPrediction,
    buildSequentialScanResult,
    consumeImmediateLossRetry,
    createSequentialDiffersRuntimeState,
    DEFAULT_IMMEDIATE_LOSS_RETRY,
    evaluateSymbolSequentialSignal,
    isSignalAlreadyConsumed,
    makeSignalKey,
    orderSymbolsForScan,
    pickFirstMatch,
    releaseStaleSequentialCommit,
    resetSequentialDiffersRuntimeState,
    resolveScanSymbols,
    toMarketGroup,
} from '../utils/sequential-digit-differs';
import {
    createTrackerState as createSignalScoreTrackerState,
    evaluateSignalScoreDiffers,
    releaseSignalScoreDiffersActiveTrade,
} from '../utils/signal-score-differs';
import {
    createStrategyVotingState,
    evaluateStrategyVoting,
    resetStrategyVotingState,
} from '../utils/strategy-voting-engine';
import {
    createTieDigitState,
    evaluateTieDigit,
    normalizeTieDigitOptions,
    replayTieDigit,
    resetTieDigitState,
} from '../utils/tie-digit-differ';
import {
    createTopTwoDigitGapState,
    evaluateTopTwoDigitGap,
    mergeDigitTicks,
    normalizeTopTwoDigitGapOptions,
    replayTopTwoDigitGap,
    resetTopTwoDigitGapState,
} from '../utils/top-two-digit-gap-differ';
import {
    evaluateSymbolTripleDigitSignal,
    isTripleDigitSignalConsumed,
    makeTripleDigitSignalKey,
    normalizeTripleDigitMartingaleOptions,
    orderSymbolsForScan as orderTripleDigitSymbols,
    pickFirstTripleDigitMatch,
    resolveScanSymbols as resolveTripleDigitSymbols,
} from '../utils/triple-digit-martingale';
import {
    applyWindowIndexDiffersResult,
    createWindowIndexDiffersState,
    evaluateWindowIndexDiffers,
    resetWindowIndexDiffersState,
} from '../utils/window-index-differs';
import {
    createZeroOneRiseState,
    evaluateZeroOneRise,
    normalizeZeroOneRiseOptions,
    replayZeroOneRise,
    resetZeroOneRiseState,
} from '../utils/zero-one-rise-over';

const WINDOW_HISTORY_RETRY_MS = 5000;

/**
 * Per-bot analysis tick buffer: one ticks_history request for the full window,
 * then every live tick is merged in so the window slides with the stream.
 * `key` isolates each bot's buffer; switching symbol clears it.
 */
const loadWindowDigitTicks = async (tradeEngine, window_size, key) => {
    if (!tradeEngine.windowTickBuffers) tradeEngine.windowTickBuffers = {};
    let slot = tradeEngine.windowTickBuffers[key];
    if (!slot || slot.symbol !== tradeEngine.symbol) {
        slot = { symbol: tradeEngine.symbol, ticks: [], fetch_at: 0 };
        tradeEngine.windowTickBuffers[key] = slot;
    }
    const live = typeof tradeEngine.getCachedDigitTicks === 'function' ? tradeEngine.getCachedDigitTicks() : [];
    let buffer = mergeDigitTicks(slot.ticks, live, window_size);

    const can_retry = Date.now() - slot.fetch_at >= WINDOW_HISTORY_RETRY_MS;
    if (buffer.length < window_size && can_retry && tradeEngine.symbol && api_base?.api) {
        slot.fetch_at = Date.now();
        try {
            const response = await api_base.api.send({
                ticks_history: tradeEngine.symbol,
                end: 'latest',
                count: window_size,
                style: 'ticks',
            });
            const prices = response?.history?.prices || [];
            const times = response?.history?.times || [];
            const response_pip = Number(response?.pip_size);
            const pip_size = Number.isFinite(response_pip)
                ? response_pip
                : typeof tradeEngine.getPipSize === 'function'
                  ? tradeEngine.getPipSize()
                  : 0;
            const history = prices.map((price, i) => ({
                epoch: Number(times[i]),
                digit: Number(getLastDigit(Number(price).toFixed(pip_size))),
            }));
            const latest_live =
                typeof tradeEngine.getCachedDigitTicks === 'function' ? tradeEngine.getCachedDigitTicks() : live;
            buffer = mergeDigitTicks(mergeDigitTicks(buffer, history, window_size), latest_live, window_size);
        } catch (e) {
            // Keep the live buffer; the next scan retries after the cooldown.
        }
    }

    slot.ticks = buffer;
    return buffer;
};

const ltdNotify = (message, className = 'journal__text') =>
    globalObserver.emit('ui.log.notify', { className, message, sound: 'silent' });

/** One Journal entry per event: every journal message re-copies and re-stores the whole log. */
const fddLog = (lines, className = 'journal__text') => ltdNotify(lines.join('<br>'), className);

const ltdMarketName = symbol =>
    (api_base.active_symbols || []).find(s => (s.underlying_symbol || s.symbol) === symbol)?.display_name || symbol;

const ltdPipSize = (ticks_service, symbol) => {
    const pip = Number(ticks_service?.pipSizes?.[symbol]);
    return Number.isFinite(pip) ? pip : undefined;
};

/** Warns in the Journal when the market feed stops (no trade is placed on stale data). */
const startLtdWatchdog = (state, ticks_service, symbol, scope) => {
    if (state.watchdog) clearInterval(state.watchdog);
    let last_epoch = ticks_service?.getLatestTick?.(symbol)?.epoch ?? null;
    let last_change = Date.now();
    state.watchdog = setInterval(() => {
        // Bot Builder replaces the interpreter on Stop without calling stop(), so the run's scope is the signal.
        if (scope?.stopped) {
            clearInterval(state.watchdog);
            state.watchdog = null;
            return;
        }
        const epoch = ticks_service?.getLatestTick?.(symbol)?.epoch ?? null;
        if (epoch !== last_epoch) {
            last_epoch = epoch;
            last_change = Date.now();
            if (state.stale) {
                state.stale = false;
                ltdNotify('Market data resumed — analysing new ticks again.');
            }
            return;
        }
        if (!state.stale && Date.now() - last_change > state.settings.stale_seconds * 1000) {
            state.stale = true;
            ltdNotify('WARNING — No new tick received.', 'journal__text--warn');
        }
    }, 1000);
};

const getBotInterface = tradeEngine => {
    const getDetail = i => createDetails(tradeEngine.data.contract)[i];

    return {
        init: (...args) => tradeEngine.init(...args),
        start: (...args) => tradeEngine.start(...args),
        /**
         * 1 analyses the tick already on screen. 0 waits for the next tick.
         * Other bots stay on normal speed because init clears the flag.
         */
        setCatchEveryTick: enabled => {
            tradeEngine.catchEveryTick = Number(enabled) === 1;
        },
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
            if (tradeEngine.repeatReappearDiffersState) {
                resetRepeatReappearState(tradeEngine.repeatReappearDiffersState);
                tradeEngine.repeatReappearDiffersState = null;
            }
            tradeEngine._repeatReappearLastJournalFp = null;
            tradeEngine._patternSwitchLastJournalFp = null;
            tradeEngine._tripleDigitMartingaleLastJournalFp = null;
            tradeEngine._tripleDigitMartingaleConsumedKey = null;
            if (tradeEngine.digitPercentageDecreaseState) {
                resetDigitPercentageDecreaseState(tradeEngine.digitPercentageDecreaseState);
                tradeEngine.digitPercentageDecreaseState = null;
            }
            tradeEngine._digitPercentageDecreaseJournalFp = null;
            tradeEngine._digitPercentageDecreaseConsumedKey = null;
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
            tradeEngine._seqDiffersLastJournalFp = null;
            tradeEngine._seqDiffersConsumedKey = null;
            if (tradeEngine.sequentialDigitDiffersState) {
                resetSequentialDiffersRuntimeState(tradeEngine.sequentialDigitDiffersState);
                tradeEngine.sequentialDigitDiffersState = null;
            }
            tradeEngine.oddEvenHotDigitSnapshot = null;
            tradeEngine._oeHotLastJournalFp = null;
            tradeEngine._oeHotConsumedKey = null;
            if (tradeEngine.oddEvenHotDigitState) {
                resetHotOddEvenDiffersRuntimeState(tradeEngine.oddEvenHotDigitState);
                tradeEngine.oddEvenHotDigitState = null;
            }
            tradeEngine.evenOddPairSnapshot = null;
            tradeEngine._evenOddPairLastJournalFp = null;
            tradeEngine._evenOddPairConsumedKey = null;
            tradeEngine._evenOddPairLastEntryTip = null;
            if (tradeEngine.evenOddPairState) {
                resetEvenOddPairRuntimeState(tradeEngine.evenOddPairState);
                tradeEngine.evenOddPairState = null;
            }
            tradeEngine.hybridMultiScanSnapshot = null;
            tradeEngine._hybridMultiScanLastJournalFp = null;
            tradeEngine._hybridMultiScanLastTipKey = null;
            if (tradeEngine.hybridMultiScanState) {
                resetHybridMultiScanRuntimeState(tradeEngine.hybridMultiScanState);
                tradeEngine.hybridMultiScanState = null;
            }
            if (tradeEngine.doubleDigitReturnState) {
                resetDoubleDigitReturnState(tradeEngine.doubleDigitReturnState);
                tradeEngine.doubleDigitReturnState = null;
            }
            if (tradeEngine.digitPairReturnState) {
                resetDigitPairReturnState(tradeEngine.digitPairReturnState);
                tradeEngine.digitPairReturnState = null;
            }
            if (tradeEngine.recurringPatternDifferState) {
                resetRecurringPatternDifferState(tradeEngine.recurringPatternDifferState);
                tradeEngine.recurringPatternDifferState = null;
            }
            if (tradeEngine.recurringPatternOver2State) {
                resetRecurringPatternOver2State(tradeEngine.recurringPatternOver2State);
                tradeEngine.recurringPatternOver2State = null;
            }
            if (tradeEngine.recurringPatternUnder7State) {
                resetRecurringPatternUnder7State(tradeEngine.recurringPatternUnder7State);
                tradeEngine.recurringPatternUnder7State = null;
            }
            if (tradeEngine.repeatedDigitRecurrenceState) {
                resetRepeatedDigitRecurrenceState(tradeEngine.repeatedDigitRecurrenceState);
                tradeEngine.repeatedDigitRecurrenceState = null;
            }
            if (tradeEngine.missingDigitReturnState) {
                resetMissingDigitReturnState(tradeEngine.missingDigitReturnState);
                tradeEngine.missingDigitReturnState = null;
            }
            if (tradeEngine.topTwoDigitGapState) {
                resetTopTwoDigitGapState(tradeEngine.topTwoDigitGapState);
                tradeEngine.topTwoDigitGapState = null;
            }
            if (tradeEngine.tieDigitState) {
                resetTieDigitState(tradeEngine.tieDigitState);
                tradeEngine.tieDigitState = null;
            }
            if (tradeEngine.rankDropState) {
                resetRankDropState(tradeEngine.rankDropState);
                tradeEngine.rankDropState = null;
            }
            if (tradeEngine.riseFallHedgeState?.entry_log) saveEntryLog(tradeEngine.riseFallHedgeState.entry_log);
            tradeEngine.riseFallHedgeState = null;
            if (tradeEngine.ltdState?.watchdog) clearInterval(tradeEngine.ltdState.watchdog);
            tradeEngine.ltdState = null;
            if (tradeEngine.fddState?.watchdog) clearInterval(tradeEngine.fddState.watchdog);
            tradeEngine.fddState = null;
            if (tradeEngine.ascendingRankNextState) {
                resetAscendingRankNextState(tradeEngine.ascendingRankNextState);
                tradeEngine.ascendingRankNextState = null;
            }
            if (tradeEngine.zeroOneRiseState) {
                resetZeroOneRiseState(tradeEngine.zeroOneRiseState);
                tradeEngine.zeroOneRiseState = null;
            }
            if (tradeEngine.digitRiseDifferState) {
                resetZeroOneRiseState(tradeEngine.digitRiseDifferState);
                tradeEngine.digitRiseDifferState = null;
            }
            if (tradeEngine.lowHighFlipState) {
                resetLowHighFlipState(tradeEngine.lowHighFlipState);
                tradeEngine.lowHighFlipState = null;
            }
            tradeEngine.lowHighFlipScanState = null;
            tradeEngine.windowTickBuffers = null;
            tradeEngine.parityRunDiffersSnapshot = null;
            tradeEngine._parityRunLastJournalFp = null;
            tradeEngine._parityRunConsumedKey = null;
            if (tradeEngine.parityRunDiffersState) {
                resetParityRunRuntimeState(tradeEngine.parityRunDiffersState);
                tradeEngine.parityRunDiffersState = null;
            }
            return tradeEngine.stop(...args);
        },
        purchase: contract_type => tradeEngine.purchase(contract_type),
        purchaseOverrideContractType: (contract_type, prediction) => {
            if (prediction !== undefined && prediction !== null && prediction !== '') {
                const n = Number(prediction);
                if (Number.isFinite(n)) {
                    tradeEngine.tradeOptions = {
                        ...(tradeEngine.tradeOptions || {}),
                        prediction: n,
                    };
                }
            }
            return tradeEngine.purchaseOverrideContractType(contract_type);
        },
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
            if (tradeEngine.repeatReappearDiffersState) {
                const contract = tradeEngine.data?.contract;
                const contract_id =
                    contract?.contract_id || contract?.transaction_ids?.buy || null;
                applyRepeatReappearSettlement(tradeEngine.repeatReappearDiffersState, contract_id);
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
         * Repeat-Reappear Differs — on previous===current, wait for streak break,
         * then Differ when that digit reappears. After a 3–4 streak, skip one tip
         * before accepting reappearance.
         */
        evaluateRepeatReappearDiffers: async options => {
            const opts = options || {};
            if (!tradeEngine.repeatReappearDiffersState) {
                tradeEngine.repeatReappearDiffersState = createRepeatReappearState();
            }
            const state = tradeEngine.repeatReappearDiffersState;

            const contract = tradeEngine.data?.contract;
            const has_open_contract = Boolean(
                contract && contract.buy_price != null && contract.sell_price == null
            );
            if (
                state.trade_committed &&
                contract &&
                contract.sell_price != null &&
                (contract.contract_id || contract.transaction_ids?.buy)
            ) {
                const contract_id =
                    contract.contract_id || contract.transaction_ids?.buy || null;
                applyRepeatReappearSettlement(state, contract_id);
            }
            if (!has_open_contract && releaseStaleRepeatReappearCommit(state, 20000)) {
                // Stale arm — allow watching again.
            }

            if (state.phase === 'armed' && state.lastPrediction >= 0 && state.lastPrediction <= 9) {
                const armed = evaluateRepeatReappearDiffers([], opts, state);
                const armed_fp = `armed:${armed.prediction}`;
                if (tradeEngine._repeatReappearLastJournalFp === armed_fp) {
                    return { ...armed, journal_messages: [] };
                }
                tradeEngine._repeatReappearLastJournalFp = armed_fp;
                return armed;
            }

            // Prefer epoch-tagged ticks so a full sliding cache still advances.
            let digit_ticks = tradeEngine.getCachedDigitTicks
                ? tradeEngine.getCachedDigitTicks()
                : null;
            if (!Array.isArray(digit_ticks) || digit_ticks.length < 1) {
                if (typeof tradeEngine.ensureTickHistory === 'function') {
                    await tradeEngine.ensureTickHistory(20);
                }
                digit_ticks = tradeEngine.getCachedDigitTicks
                    ? tradeEngine.getCachedDigitTicks()
                    : null;
            }
            if (!Array.isArray(digit_ticks) || digit_ticks.length < 1) {
                const digits = tradeEngine.getCachedLastDigitList
                    ? tradeEngine.getCachedLastDigitList(20)
                    : [];
                digit_ticks = Array.isArray(digits) ? digits : [];
            }

            const result = evaluateRepeatReappearDiffers(digit_ticks, opts, state);
            const tip_key =
                result.tip_epoch != null
                    ? String(result.tip_epoch)
                    : `${result.phase}:${result.tip_digit}:${result.streak}`;
            const fp = `${result.phase}:${result.target_digit}:${result.skip_next}:${tip_key}:${result.reason}`;
            if (
                !result.matched &&
                tradeEngine._repeatReappearLastJournalFp === fp &&
                Array.isArray(result.journal_messages)
            ) {
                return { ...result, journal_messages: [] };
            }
            tradeEngine._repeatReappearLastJournalFp = fp;
            return result;
        },
        /**
         * Double Digit → Return Differs — independently tracks X → X → Y
         * relationships for every trigger digit from 0 through 9.
         */
        evaluateDoubleDigitReturnDiffers: async options => {
            const opts = options || {};
            if (!tradeEngine.doubleDigitReturnState) {
                tradeEngine.doubleDigitReturnState = createDoubleDigitReturnState();
            }
            const tick_window = Math.max(120, Math.floor(Number(opts.tick_window)) || 120);
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            // Prefer epoch-tagged ticks so rolling windows do not re-process history.
            let digit_ticks = tradeEngine.getCachedDigitTicks ? tradeEngine.getCachedDigitTicks() : [];
            if (!Array.isArray(digit_ticks)) {
                digit_ticks = [];
            }
            return evaluateDoubleDigitReturnDiffers(digit_ticks, opts, tradeEngine.doubleDigitReturnState);
        },
        /**
         * Digit Pair → Return Differs — A → B → C → D → Differ D.
         */
        evaluateDigitPairReturnDiffers: async options => {
            const opts = options || {};
            if (!tradeEngine.digitPairReturnState) {
                tradeEngine.digitPairReturnState = createDigitPairReturnState();
            }
            const tick_window = Math.max(30, Math.floor(Number(opts.tick_window)) || 30);
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks = tradeEngine.getCachedDigitTicks ? tradeEngine.getCachedDigitTicks() : [];
            if (!Array.isArray(digit_ticks)) {
                digit_ticks = [];
            }
            return evaluateDigitPairReturnDiffers(digit_ticks, opts, tradeEngine.digitPairReturnState);
        },
        /**
         * Recurring Pattern Differ — Differ the historically most frequent next digit
         * after a recurring digit sequence that passes statistical filters (ACTIVE defaults).
         */
        evaluateRecurringPatternDiffer: async options => {
            const opts = options || {};
            if (!tradeEngine.recurringPatternDifferState) {
                tradeEngine.recurringPatternDifferState = createRecurringPatternDifferState();
            }
            const tick_window = Math.max(
                20,
                Math.floor(Number(opts.analysis_window)) || 1000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks = tradeEngine.getCachedDigitTicks ? tradeEngine.getCachedDigitTicks() : [];
            if (!Array.isArray(digit_ticks)) {
                digit_ticks = [];
            }
            return evaluateRecurringPatternDiffer(
                digit_ticks,
                opts,
                tradeEngine.recurringPatternDifferState
            );
        },
        /**
         * Recurring Pattern Differ replay/backtest on cached (or provided) digit history.
         * Uses the same no-look-ahead signal path as live trading.
         */
        replayRecurringPatternDiffer: async options => {
            const opts = options || {};
            const tick_window = Math.max(
                20,
                Math.floor(Number(opts.analysis_window)) || 1000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks =
                Array.isArray(opts.ticks) && opts.ticks.length
                    ? opts.ticks
                    : tradeEngine.getCachedDigitTicks
                      ? tradeEngine.getCachedDigitTicks()
                      : [];
            if (!Array.isArray(digit_ticks)) digit_ticks = [];
            return replayRecurringPatternDiffer(digit_ticks, opts);
        },
        /**
         * Recurring Pattern Over 2 Consistency — OVER 2 only when historical
         * Over 2 rate AND consistency filters pass (ACTIVE defaults).
         */
        evaluateRecurringPatternOver2: async options => {
            const opts = options || {};
            if (!tradeEngine.recurringPatternOver2State) {
                tradeEngine.recurringPatternOver2State = createRecurringPatternOver2State();
            }
            const tick_window = Math.max(
                20,
                Math.floor(Number(opts.analysis_window)) || 1000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks = tradeEngine.getCachedDigitTicks ? tradeEngine.getCachedDigitTicks() : [];
            if (!Array.isArray(digit_ticks)) {
                digit_ticks = [];
            }
            return evaluateRecurringPatternOver2(
                digit_ticks,
                opts,
                tradeEngine.recurringPatternOver2State
            );
        },
        /**
         * Recurring Pattern Over 2 Consistency replay/backtest (no look-ahead).
         */
        replayRecurringPatternOver2: async options => {
            const opts = options || {};
            const tick_window = Math.max(
                20,
                Math.floor(Number(opts.analysis_window)) || 1000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks =
                Array.isArray(opts.ticks) && opts.ticks.length
                    ? opts.ticks
                    : tradeEngine.getCachedDigitTicks
                      ? tradeEngine.getCachedDigitTicks()
                      : [];
            if (!Array.isArray(digit_ticks)) digit_ticks = [];
            return replayRecurringPatternOver2(digit_ticks, opts);
        },
        /**
         * Recurring Pattern Under 7 Consistency — UNDER 7 only when historical
         * Under 7 rate AND consistency filters pass (ACTIVE defaults).
         */
        evaluateRecurringPatternUnder7: async options => {
            const opts = options || {};
            if (!tradeEngine.recurringPatternUnder7State) {
                tradeEngine.recurringPatternUnder7State = createRecurringPatternUnder7State();
            }
            const tick_window = Math.max(
                20,
                Math.floor(Number(opts.analysis_window)) || 1000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks = tradeEngine.getCachedDigitTicks ? tradeEngine.getCachedDigitTicks() : [];
            if (!Array.isArray(digit_ticks)) {
                digit_ticks = [];
            }
            return evaluateRecurringPatternUnder7(
                digit_ticks,
                opts,
                tradeEngine.recurringPatternUnder7State
            );
        },
        /**
         * Recurring Pattern Under 7 Consistency replay/backtest (no look-ahead).
         */
        replayRecurringPatternUnder7: async options => {
            const opts = options || {};
            const tick_window = Math.max(
                20,
                Math.floor(Number(opts.analysis_window)) || 1000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks =
                Array.isArray(opts.ticks) && opts.ticks.length
                    ? opts.ticks
                    : tradeEngine.getCachedDigitTicks
                      ? tradeEngine.getCachedDigitTicks()
                      : [];
            if (!Array.isArray(digit_ticks)) digit_ticks = [];
            return replayRecurringPatternUnder7(digit_ticks, opts);
        },
        /**
         * Repeated Digit Recurrence DIFFER — when digit × N recurs after prior
         * occurrence(s), Differ that digit (ACTIVE defaults).
         */
        evaluateRepeatedDigitRecurrence: async options => {
            const opts = options || {};
            if (!tradeEngine.repeatedDigitRecurrenceState) {
                tradeEngine.repeatedDigitRecurrenceState = createRepeatedDigitRecurrenceState();
            }
            const tick_window = Math.max(
                50,
                Math.floor(Number(opts.analysis_window)) || 5000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks = tradeEngine.getCachedDigitTicks ? tradeEngine.getCachedDigitTicks() : [];
            if (!Array.isArray(digit_ticks)) {
                digit_ticks = [];
            }
            return evaluateRepeatedDigitRecurrence(
                digit_ticks,
                opts,
                tradeEngine.repeatedDigitRecurrenceState
            );
        },
        /**
         * Repeated Digit Recurrence DIFFER replay/backtest (no look-ahead).
         */
        replayRepeatedDigitRecurrence: async options => {
            const opts = options || {};
            const tick_window = Math.max(
                50,
                Math.floor(Number(opts.analysis_window)) || 5000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks =
                Array.isArray(opts.ticks) && opts.ticks.length
                    ? opts.ticks
                    : tradeEngine.getCachedDigitTicks
                      ? tradeEngine.getCachedDigitTicks()
                      : [];
            if (!Array.isArray(digit_ticks)) digit_ticks = [];
            return replayRepeatedDigitRecurrence(digit_ticks, opts);
        },
        /**
         * Missing Digit Return DIFFER — Differ a digit that reappears after
         * being absent for the configured period (default 15).
         */
        evaluateMissingDigitReturn: async options => {
            const opts = options || {};
            if (!tradeEngine.missingDigitReturnState) {
                tradeEngine.missingDigitReturnState = createMissingDigitReturnState();
            }
            const tick_window = Math.max(
                50,
                Math.floor(Number(opts.analysis_window)) || 2000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks = tradeEngine.getCachedDigitTicks ? tradeEngine.getCachedDigitTicks() : [];
            if (!Array.isArray(digit_ticks)) {
                digit_ticks = [];
            }
            return evaluateMissingDigitReturn(
                digit_ticks,
                opts,
                tradeEngine.missingDigitReturnState
            );
        },
        /**
         * Missing Digit Return DIFFER replay/backtest (no look-ahead).
         */
        replayMissingDigitReturn: async options => {
            const opts = options || {};
            const tick_window = Math.max(
                50,
                Math.floor(Number(opts.analysis_window)) || 2000
            );
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(tick_window);
            }
            let digit_ticks =
                Array.isArray(opts.ticks) && opts.ticks.length
                    ? opts.ticks
                    : tradeEngine.getCachedDigitTicks
                      ? tradeEngine.getCachedDigitTicks()
                      : [];
            if (!Array.isArray(digit_ticks)) digit_ticks = [];
            return replayMissingDigitReturn(digit_ticks, opts);
        },
        /**
         * Top Two Digit Gap DIFFER — when the gap between the two most appearing
         * digits meets the threshold and the current digit is one of them, Differ the other.
         */
        evaluateTopTwoDigitGap: async options => {
            const opts = options || {};
            if (!tradeEngine.topTwoDigitGapState) {
                tradeEngine.topTwoDigitGapState = createTopTwoDigitGapState();
            }
            const { analysis_window } = normalizeTopTwoDigitGapOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window, 'top_two_gap');
            return evaluateTopTwoDigitGap(digit_ticks, opts, tradeEngine.topTwoDigitGapState);
        },
        /**
         * Top Two Digit Gap DIFFER replay/backtest (no look-ahead).
         */
        replayTopTwoDigitGap: async options => {
            const opts = options || {};
            if (Array.isArray(opts.ticks) && opts.ticks.length) {
                return replayTopTwoDigitGap(opts.ticks, opts);
            }
            const { analysis_window } = normalizeTopTwoDigitGapOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window, 'top_two_gap');
            return replayTopTwoDigitGap(digit_ticks, opts);
        },
        /**
         * Tie Digit DIFFER — when the current digit's % ties with exactly one
         * other digit over the window, Differ that other digit.
         */
        evaluateTieDigitDiffer: async options => {
            const opts = options || {};
            if (!tradeEngine.tieDigitState) {
                tradeEngine.tieDigitState = createTieDigitState();
            }
            const { analysis_window } = normalizeTieDigitOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window, 'tie_digit');
            return evaluateTieDigit(digit_ticks, opts, tradeEngine.tieDigitState);
        },
        /**
         * Tie Digit DIFFER replay/backtest (no look-ahead).
         */
        replayTieDigitDiffer: async options => {
            const opts = options || {};
            if (Array.isArray(opts.ticks) && opts.ticks.length) {
                return replayTieDigit(opts.ticks, opts);
            }
            const { analysis_window } = normalizeTieDigitOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window, 'tie_digit');
            return replayTieDigit(digit_ticks, opts);
        },
        /**
         * Rise/Fall Hedge — called on every Before Purchase pass. Returns 1 when a hedge
         * should be fired now, 0 to wait. A hard risk limit stops the bot.
         */
        configureRiseFallHedgeEntry: async options => {
            if (!tradeEngine.riseFallHedgeState) tradeEngine.riseFallHedgeState = createRiseFallHedgeState();
            tradeEngine.riseFallHedgeState.entry_settings = normalizeEntrySettings(options || {});
        },
        readyRiseFallHedge: async options => {
            if (!tradeEngine.riseFallHedgeState) tradeEngine.riseFallHedgeState = createRiseFallHedgeState();
            const state = tradeEngine.riseFallHedgeState;
            state.settings = normalizeHedgeSettings(options || {});
            const entry = state.entry_settings?.enabled ? state.entry_settings : null;
            const stake = Number(tradeEngine.tradeOptions?.amount) || 0;
            const duration = Number(tradeEngine.tradeOptions?.duration) || 0;
            const symbol = tradeEngine.tradeOptions?.symbol;
            const symbol_name =
                (api_base.active_symbols || []).find(s => (s.underlying_symbol || s.symbol) === symbol)?.display_name ||
                symbol;

            if (!state.dashboard_shown) {
                state.dashboard_shown = true;
                const payout = type => tradeEngine.data?.proposals?.find(p => p.contract_type === type)?.payout;
                dashboardLines({
                    symbol_name,
                    stake,
                    duration,
                    state,
                    quotes: { rise: payout(RISE), fall: payout(FALL) },
                }).forEach(line => notifyHedge(line));
                if (entry) {
                    notifyHedge(
                        state.settings.mode === 'AUTO'
                            ? `Mode: AUTOMATIC — the Entry Engine checks every new tick; cooldown ${state.settings.cooldown_seconds}s`
                            : 'Mode: MANUAL — this run fires one hedge when the Entry Engine approves, then stops.'
                    );
                    entrySettingsLines(entry).forEach(line => notifyHedge(line));
                    strategyBreakdownLines(state.hedges).forEach(line => notifyHedge(`Stored ${line}`));
                } else {
                    notifyHedge(
                        state.settings.mode === 'AUTO'
                            ? `Mode: AUTOMATIC — a hedge every ${state.settings.every_n_ticks} ticks, cooldown ${state.settings.cooldown_seconds}s`
                            : 'Mode: MANUAL — this run fires one hedge, then stops. Press Run again for the next hedge.'
                    );
                }
            }

            const ticks = typeof tradeEngine.getCachedDigitTicks === 'function' ? tradeEngine.getCachedDigitTicks() : [];
            const epoch = ticks.length ? ticks[ticks.length - 1].epoch : null;
            const new_tick = epoch !== null && epoch !== state.last_tick_epoch;
            if (new_tick) {
                state.last_tick_epoch = epoch;
                state.ticks_since_last += 1;
            }
            if (state.current) return 0;
            if (entry && !new_tick) return 0;
            if (!entry && state.settings.mode === 'AUTO' && state.ticks_since_last < state.settings.every_n_ticks) {
                return 0;
            }

            const blocked = checkHedgeRiskGates({
                settings: state.settings,
                stake,
                hedges: state.hedges,
                now: Date.now(),
                last_hedge_at: state.last_hedge_at,
            });
            if (entry && !(blocked && !isTemporaryBlock(blocked))) {
                const raw = tradeEngine.$scope?.ticksService?.getCachedTicks?.(symbol) || [];
                const prices = raw.map(t => (typeof t === 'object' && t !== null ? Number(t.quote) : Number(t)));
                const analysis = analyzeHedgeEntry(prices.slice(-(entry.pattern_history + 1)), entry);
                if (analysis.status === 'COLLECTING') {
                    const wait = `Entry Engine: collecting ticks (need ${analysis.need}).`;
                    if (state.last_wait_message !== wait) notifyHedge(`${wait} Have ${analysis.have}.`);
                    state.last_wait_message = wait;
                    return 0;
                }
                const payouts = readHedgePayouts(tradeEngine.data?.proposals, tradeEngine.getPurchaseReference?.());
                const required_score = requiredEntryScore(entry, state.hedges);
                const decision = decideHedgeEntry({
                    analysis,
                    settings: entry,
                    required_score,
                    payouts,
                    open_hedges: state.current ? 1 : 0,
                    temporary_block: blocked,
                });
                const now = Date.now();
                const record = entryRecord({
                    now,
                    market: symbol_name,
                    settings: entry,
                    analysis,
                    required_score,
                    payouts,
                    decision,
                });
                if (!state.entry_log) state.entry_log = loadEntryLog();
                state.entry_log.push(record);
                if (state.entry_log.length > 1000) state.entry_log.splice(0, state.entry_log.length - 1000);
                state.last_wait_message = '';
                if (!decision.approved) {
                    if (entry.log_no_trade) notifyHedge(entryNoTradeLine(record));
                    if (state.entry_log.length % 20 === 0) saveEntryLog(state.entry_log);
                    return 0;
                }
                saveEntryLog(state.entry_log);
                const economics = hedgeEconomics(stake, payouts);
                entryFiredLines({ record, analysis, stake, duration, economics }).forEach(line =>
                    notifyHedge(line, 'journal__text--success')
                );
                state.pending_entry = { ...record, economics };
                return 1;
            }
            if (blocked && isTemporaryBlock(blocked)) {
                const wait = blocked.replace(/\d+s left/, 'waiting');
                if (state.last_wait_message !== wait) notifyHedge(`Waiting — ${blocked}`);
                state.last_wait_message = wait;
                return 0;
            }
            if (blocked) {
                if (!state.stop_requested) {
                    state.stop_requested = true;
                    notifyHedge(`STOPPED — ${blocked}`, 'journal__text--error');
                    setTimeout(() => globalObserver.emit('bot.stop_button_click'), 300);
                }
                return 0;
            }
            state.last_wait_message = '';
            return 1;
        },
        purchaseRiseFallHedge: () => tradeEngine.purchaseRiseFallHedge(),
        purchaseDigitHedge: () => tradeEngine.purchaseDigitHedge(),
        /**
         * Waits for Over 5 and Under 4 to settle and returns their combined profit.
         * Also stores the stake decision: 1 reset, -1 both lost, 0 stop.
         */
        settleDigitHedge: async () => {
            const hedge = tradeEngine.digitHedge;
            tradeEngine.digitHedgeResultId = (tradeEngine.digitHedgeResultId || 0) + 1;
            const finish = (decision, net, message, className) => {
                tradeEngine.digitHedgeDecision = decision;
                if (message) notifyHedge(message, className);
                return net;
            };
            if (!hedge) {
                tradeEngine.digitHedgeLive = false;
                return finish(HEDGE_STOP, 0, 'No Over/Under hedge is open — stopped.', 'journal__text--error');
            }

            const tracked = tradeEngine.data?.contract;
            const over_matches =
                tracked &&
                hedge.over_contract_id &&
                String(tracked.contract_id) === String(hedge.over_contract_id) &&
                isSettledContract(tracked);
            const over_poc = over_matches
                ? tracked
                : hedge.over_contract_id
                  ? await pollUntilSettled(hedge.over_contract_id)
                  : null;
            const under_poc = hedge.under_contract_id ? await pollUntilSettled(hedge.under_contract_id) : null;
            if (isSettledContract(under_poc)) {
                const under_sell = Number(under_poc.sell_price);
                const under_buy = Number(under_poc.buy_price);
                if (Number.isFinite(under_sell) && Number.isFinite(under_buy)) {
                    emitContract(under_poc);
                    if (typeof tradeEngine.updateTotals === 'function') {
                        tradeEngine.updateTotals(under_poc);
                    }
                }
            }

            const legs = { over: over_poc, under: under_poc, under_bought: Boolean(hedge.under_bought) };
            if (isSettledContract(over_poc) && isSettledContract(under_poc) && hedgeTicksDiffer(over_poc, under_poc)) {
                tradeEngine.digitHedgeLive = false;
                const broken = hedgeNet(legs);
                return finish(
                    HEDGE_STOP,
                    broken ?? 0,
                    `Hedge stopped. Over 5 and Under 4 did not share one entry and one exit (Over ${hedgeEntryPrice(over_poc) ?? '—'} → ${hedgeExitPrice(over_poc) ?? '—'}, Under ${hedgeEntryPrice(under_poc) ?? '—'} → ${hedgeExitPrice(under_poc) ?? '—'}). Stake was not changed.`,
                    'journal__text--error'
                );
            }
            const decision = hedgeDecision(legs);
            const net = hedgeNet(legs);
            if (decision === HEDGE_STOP || net === null) {
                if (isSettledContract(over_poc) && isSettledContract(under_poc)) {
                    tradeEngine.digitHedgeLive = false;
                }
                return finish(
                    HEDGE_STOP,
                    0,
                    'Hedge did not finish on both sides — stopped so the stake is not changed.',
                    'journal__text--error'
                );
            }

            const over_profit = legProfit(over_poc);
            const under_profit = legProfit(under_poc);
            const label = decision === HEDGE_STOP ? 'STOP' : over_profit < 0 && under_profit < 0 ? 'BOTH LOST' : 'HEDGE';
            const className = net < 0 ? 'journal__text--error' : 'journal__text--success';
            tradeEngine.digitHedgeLive = false;
            return finish(
                decision,
                net,
                `HEDGE ${label} | Over ${over_profit} | Under ${under_profit} | net ${net}`,
                className
            );
        },
        /** 1 = return to the set stake, -1 = both sides lost, 0 = do not trade again. */
        digitHedgeDecision: () => tradeEngine.digitHedgeDecision ?? 0,
        /**
         * Next stake from the stake that was actually bought. A both-lost hedge
         * is bought × multiplier, rounded to the cent. One winning side returns
         * the set stake. A second call does not multiply again.
         */
        digitHedgeNextStake: (current, initial, multiplier) => {
            const decision = tradeEngine.digitHedgeDecision ?? HEDGE_STOP;
            const plan = {
                decision,
                bought: tradeEngine.digitHedge?.stake,
                current,
                initial,
                multiplier,
            };
            const next = nextHedgeStake(plan);
            tradeEngine.digitHedgeStakePlan = { ...plan, next };
            return next;
        },
        /** True only when the hedge finished and the next stake matches the rule. */
        digitHedgeContinues: () => hedgeMayContinue(tradeEngine.digitHedgeStakePlan),
        /**
         * Adds the combined Over 5 + Under 4 profit to the running total.
         * Returns that total. A second call for the same settlement does not add again.
         */
        digitHedgeBookProfit: (total, profit, takeProfit, stopLoss) => {
            const id = tradeEngine.digitHedgeResultId ?? 0;
            if (tradeEngine.digitHedgeBookedId === id && tradeEngine.digitHedgeBooked) {
                return tradeEngine.digitHedgeBooked.total;
            }
            const booked = applyHedgeLimits({ total, profit, takeProfit, stopLoss });
            tradeEngine.digitHedgeBooked = booked;
            tradeEngine.digitHedgeBookedId = id;
            tradeEngine.digitHedgeLimitAction = booked.action;
            if (booked.action !== HEDGE_LIMIT_NONE) {
                tradeEngine.digitHedgeHalt = true;
                tradeEngine.digitHedgeImmediate = false;
                tradeEngine.digitHedgeImmediateUsed = false;
            }
            return booked.total;
        },
        /** 1 = take profit reached, -1 = stop loss reached, 0 = trade again is allowed. */
        digitHedgeLimit: () => hedgeLimitCode(tradeEngine.digitHedgeLimitAction),
        /** Saves the Over and Under digits before the hedge is bought. */
        digitHedgeSetBarriers: (over, under) => {
            const barriers = resolveHedgeBarriers({
                over,
                under,
                fallbackOver: tradeEngine.digitHedgeOverBarrier,
                fallbackUnder: tradeEngine.digitHedgeUnderBarrier,
            });
            tradeEngine.digitHedgeOverBarrier = barriers.over;
            tradeEngine.digitHedgeUnderBarrier = barriers.under;
            return barriers.over;
        },
        /**
         * 1 when the digits that lose both sides dominate the last `window`
         * cached ticks. Over 5 and Under 4 lose on 4 and 5. Reads the live
         * cache only, so it does not wait on a history request.
         */
        digitHedgeSignal: (window, over, under) => {
            const barriers = resolveHedgeBarriers({
                over,
                under,
                fallbackOver: tradeEngine.digitHedgeOverBarrier ?? tradeEngine.tradeOptions?.prediction,
                fallbackUnder: tradeEngine.digitHedgeUnderBarrier,
            });
            const over_barrier = barriers.over;
            const under_barrier = barriers.under;
            tradeEngine.digitHedgeOverBarrier = over_barrier;
            tradeEngine.digitHedgeUnderBarrier = under_barrier;
            let digits = [];
            try {
                digits = tradeEngine.getAvailableLastDigitList?.(window) || [];
            } catch {
                digits = [];
            }
            tradeEngine.digitHedgeDeadCount = deadDigitCount(digits, window, over_barrier, under_barrier);
            return deadDigitsDominate(digits, window, over_barrier, under_barrier) ? 1 : 0;
        },
        /** Count stored by the last signal check. */
        digitHedgeDeadCount: () => tradeEngine.digitHedgeDeadCount ?? 0,
        /** 1 when the newest ticks contain no 4 or 5. Default range is 1. */
        digitHedgeQuietSignal: range => {
            const window = quietGapWindow(range);
            if (!quietGapPipReady(tradeEngine.getPipSize?.())) {
                const line = 'Quiet gap | waiting for the market digit size | NO TRADE';
                if (tradeEngine.quietGapWaitLine !== line) {
                    tradeEngine.quietGapWaitLine = line;
                    notifyHedge(line, 'journal__text');
                }
                return 0;
            }
            tradeEngine.quietGapWaitLine = '';
            let digits = [];
            try {
                digits = tradeEngine.getAvailableLastDigitList?.(window) || [];
            } catch {
                digits = [];
            }
            const report = evaluateQuietGap(digits, window);
            const detail = report.ready
                ? `last digit ${report.last} | 4 or 5 x ${report.gapCount}`
                : `have ${Math.min(report.have, report.window)} of ${report.window}`;
            notifyHedge(
                `Quiet gap | last ${report.window} | ${detail} | ${report.trade ? 'PASS' : 'NO TRADE'}`,
                report.trade ? 'journal__text--success' : 'journal__text'
            );
            if (report.trade) {
                tradeEngine.digitHedgeOverBarrier = 5;
                tradeEngine.digitHedgeUnderBarrier = 4;
            }
            return report.trade ? 1 : 0;
        },
        /**
         * 1 = Only Ups, -1 = Only Downs, 0 = no trade.
         * Journals the four-digit check once per tick. The same tick cannot trade twice.
         */
        analyzeOnlyUpsDowns: (stake, level) => {
            let digits = [];
            try {
                digits = tradeEngine.getAvailableLastDigitList?.(4) || [];
            } catch {
                digits = [];
            }
            const rawTip = String(tradeEngine.getLatestTickTipKey?.() || '');
            const epoch = /^\d+$/.test(rawTip) ? rawTip : '';
            const result = resolveOnlyUpsDownsCall({
                digits,
                epoch,
                seenEpoch: tradeEngine.onlyUpsDownsTip || '',
                tradedEpoch: tradeEngine.onlyUpsDownsTradedTip || '',
                stake,
                level,
            });
            tradeEngine.onlyUpsDownsTip = result.seenEpoch;
            tradeEngine.onlyUpsDownsTradedTip = result.tradedEpoch;
            if (!result.repeat) {
                const klass = result.code ? 'journal__text--success' : 'journal__text';
                result.lines.forEach(line => notifyHedge(line, klass));
            }
            return result.code;
        },
        /** Writes the win or loss and the stake change. The multiplier is 1.5. */
        journalOnlyUpsDownsResult: (won, previous, next) => {
            const win = Number(won) > 0;
            const klass = win ? 'journal__text--success' : 'journal__text--error';
            onlyUpsDownsResultLines({ won: win, previous, next }).forEach(line => notifyHedge(line, klass));
            return win ? 1 : 0;
        },
        /** 1 = take profit, -1 = too many losses in a row, 0 = keep trading. */
        onlyUpsDownsLimit: (total, takeProfit, losses, maxLosses) =>
            onlyUpsDownsLimitCode({ total, takeProfit, losses, maxLosses }),
        /** 1 when a both-sides loss is waiting to buy again without a new digit check. */
        digitHedgeSkipAnalysis: () => (tradeEngine.digitHedgeImmediate ? 1 : 0),
        /**
         * Arms an immediate Over 5 + Under 4 buy when both sides lost and the
         * option is on. A win, a stop, or option 0 clears it.
         */
        digitHedgeArmRecovery: enabled => {
            const armed = armImmediateRecovery({
                decision: tradeEngine.digitHedgeDecision ?? HEDGE_STOP,
                enabled,
            });
            tradeEngine.digitHedgeImmediate = armed;
            tradeEngine.digitHedgeImmediateUsed = false;
            return armed ? 1 : 0;
        },
        /** Last-Tick Price Digit Differ — digit before the decimal of the latest tick (0 if unavailable). */
        getLastTickDigitBarrier: () => {
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const ticks_service = tradeEngine.$scope?.ticksService;
            const latest = ticks_service?.getLatestTick?.(symbol);
            const digit = latest ? extractDigitBeforeDecimal(latest.quote, ltdPipSize(ticks_service, symbol)) : null;
            return digit ?? 0;
        },
        /**
         * Last-Tick Price Digit Differ — analyse each new tick once. Returns the barrier
         * (0–9) when the entry conditions pass, otherwise -1. Everything is journaled.
         */
        analyzeLastTickDigit: async options => {
            if (!tradeEngine.ltdState) tradeEngine.ltdState = createLtdState();
            const state = tradeEngine.ltdState;
            const settings = normalizeLtdSettings(options || {});
            state.settings = settings;
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const market = ltdMarketName(symbol);
            const ticks_service = tradeEngine.$scope?.ticksService;

            if (!state.started) {
                state.started = true;
                ltdSettingsLines(settings).forEach(line => ltdNotify(line));
                ltdStatusLines(state, market).forEach(line => ltdNotify(line));
                startLtdWatchdog(state, ticks_service, symbol, tradeEngine.$scope);
            }

            const latest = ticks_service?.getLatestTick?.(symbol);
            if (!latest || latest.epoch === state.last_epoch) return -1;
            state.stale = false;
            if (state.status !== 'STOPPED') state.status = 'ANALYZING';

            const now = Date.now();
            const result = evaluateLtdTick(
                state,
                { quote: latest.quote, epoch: latest.epoch, pip_size: ltdPipSize(ticks_service, symbol), now },
                settings
            );
            const className = {
                READY: 'journal__text--success',
                ERROR: 'journal__text--error',
                STOPPED: 'journal__text--error',
            }[result.decision];
            ltdTickLines({ state, result, market, now }).forEach((line, i) =>
                ltdNotify(line, i === 0 ? 'journal__text' : className || 'journal__text')
            );
            if (settings.status_every && state.tick_count % settings.status_every === 0) {
                ltdStatusLines(state, market).forEach(line => ltdNotify(line));
            }

            if (result.decision === 'STOPPED') {
                state.status = 'STOPPED';
                if (!state.stop_requested) {
                    state.stop_requested = true;
                    if (state.watchdog) clearInterval(state.watchdog);
                    setTimeout(() => globalObserver.emit('bot.stop_button_click'), 300);
                }
                return -1;
            }
            if (result.decision !== 'READY') return -1;
            state.pending = { barrier: state.barrier, epoch: latest.epoch };
            return state.barrier;
        },
        /** Last-Tick Price Digit Differ — buys DIGITDIFF with the barrier approved on this tick. */
        purchaseLastTickDigitDiffer: async () => {
            const state = tradeEngine.ltdState;
            const pending = state?.pending;
            if (!pending) return undefined;
            state.pending = null;
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const latest = tradeEngine.$scope?.ticksService?.getLatestTick?.(symbol);
            if (latest && latest.epoch !== pending.epoch) {
                ltdNotify('WAITING — a newer tick arrived before purchase; it will be analysed first (no stale trade).');
                return undefined;
            }

            const stake = tradeEngine.tradeOptions?.amount;
            ltdTradeLines({
                barrier: pending.barrier,
                stake,
                duration: tradeEngine.tradeOptions?.duration,
                duration_unit: tradeEngine.tradeOptions?.duration_unit,
            }).forEach(line => ltdNotify(line, 'journal__text--success'));

            state.last_trade_at = Date.now();
            state.last_trade_epoch = pending.epoch;
            state.traded_barrier = pending.barrier;
            state.last_action = `TRADE PLACED — DIFFER ${pending.barrier}`;
            state.status = 'IN TRADE';
            tradeEngine.last_buy = null;
            tradeEngine.tradeOptions = { ...(tradeEngine.tradeOptions || {}), prediction: pending.barrier };
            try {
                await tradeEngine.purchaseOverrideContractType('DIGITDIFF');
            } catch (error) {
                state.status = 'ANALYZING';
                state.last_action = `Trade failed — ${error?.error?.message || error?.message || 'purchase error'}`;
                ltdNotify(`TRADE FAILED — ${state.last_action.replace('Trade failed — ', '')}`, 'journal__text--error');
                throw error;
            }
            const buy = tradeEngine.last_buy;
            if (!buy) {
                state.status = 'ANALYZING';
                state.last_action = 'Trade not submitted';
                ltdNotify('WAITING — trade was not submitted by the engine; analysing the next tick.', 'journal__text--warn');
                return undefined;
            }
            ltdNotify(
                `Trade submitted successfully. Contract ID: ${buy.contract_id} | Buy price: $${Number(
                    buy.buy_price ?? stake
                ).toFixed(2)}`,
                'journal__text--success'
            );
            return undefined;
        },
        /** Last-Tick Price Digit Differ — record the settled contract; 1 = trade again, 0 = stop. */
        lastTickDigitResult: async () => {
            const state = tradeEngine.ltdState;
            if (!state) return 0;
            const contract = tradeEngine.data?.contract || {};
            const profit = Number.isFinite(Number(contract.profit))
                ? Number(contract.profit)
                : Number(contract.sell_price || 0) - Number(contract.buy_price || 0);
            const won = applyLtdResult(state, { profit });
            const barrier = contract.barrier ?? state.traded_barrier;
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const market = ltdMarketName(symbol);
            state.status = 'ANALYZING';
            state.last_action = `DIFFER ${barrier} ${won ? 'WON' : 'LOST'} (${profit >= 0 ? '+' : '-'}$${Math.abs(
                profit
            ).toFixed(2)})`;
            let balance;
            try {
                balance = tradeEngine.getBalance?.('STR');
            } catch {
                balance = undefined;
            }
            ltdResultLines({
                state,
                barrier,
                won,
                profit,
                contract_id: contract.contract_id,
                balance,
                now: Date.now(),
            }).forEach(line => ltdNotify(line, won ? 'journal__text--success' : 'journal__text--error'));

            const stop = ltdStopReason(state, state.settings);
            if (stop) state.status = 'STOPPED';
            ltdStatusLines(state, market).forEach(line => ltdNotify(line));
            if (stop) {
                ltdNotify(`STOPPED — ${stop}`, 'journal__text--error');
                if (state.watchdog) clearInterval(state.watchdog);
                return 0;
            }
            return 1;
        },
        /** Double Decimal Digit Differ — repeated last-two-decimals digit of the latest tick, else its last digit (0 if unavailable). */
        getFirstDecimalDigitBarrier: () => {
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const ticks_service = tradeEngine.$scope?.ticksService;
            const latest = ticks_service?.getLatestTick?.(symbol);
            const decimals = latest ? readLastTwoDecimals(latest.quote, ltdPipSize(ticks_service, symbol)) : null;
            return decimals?.pair ?? decimals?.second ?? 0;
        },
        /**
         * First Decimal Digit Differ — analyse each new tick once. Returns the barrier (0–9)
         * when entry, risk and recovery checks pass, otherwise -1. Everything is journaled.
         */
        analyzeFirstDecimalDigit: async options => {
            const settings = normalizeFddSettings(options || {});
            if (!tradeEngine.fddState) tradeEngine.fddState = createFddState(settings);
            const state = tradeEngine.fddState;
            syncFddSettings(state, settings);
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const market = ltdMarketName(symbol);
            const ticks_service = tradeEngine.$scope?.ticksService;

            if (!state.started) {
                state.started = true;
                fddLog(fddSettingsLines(settings));
                fddLog(fddStatusLines(state, market));
                startLtdWatchdog(state, ticks_service, symbol, tradeEngine.$scope);
            }

            const latest = ticks_service?.getLatestTick?.(symbol);
            if (!latest || latest.epoch === state.last_epoch) return -1;
            state.stale = false;
            if (state.status !== 'STOPPED') state.status = 'ANALYZING';

            const now = Date.now();
            const result = evaluateFddTick(
                state,
                { quote: latest.quote, epoch: latest.epoch, pip_size: ltdPipSize(ticks_service, symbol), now },
                settings
            );
            const className = {
                READY: 'journal__text--success',
                ERROR: 'journal__text--error',
                STOPPED: 'journal__text--error',
            }[result.decision];
            fddLog(fddTickLines({ state, result, market, now }), className);
            if (settings.status_every && state.tick_count % settings.status_every === 0) {
                fddLog(fddStatusLines(state, market));
            }

            if (result.decision === 'STOPPED') {
                state.status = 'STOPPED';
                if (!state.stop_requested) {
                    state.stop_requested = true;
                    if (state.watchdog) clearInterval(state.watchdog);
                    setTimeout(() => globalObserver.emit('bot.stop_button_click'), 300);
                }
                return -1;
            }
            if (result.decision !== 'READY') return -1;
            state.pending = { barrier: state.barrier, epoch: latest.epoch, stake: state.current_stake };
            return state.barrier;
        },
        /** First Decimal Digit Differ — buys DIGITDIFF with this tick's barrier and the recovery stake. */
        purchaseFirstDecimalDigitDiffer: async () => {
            const state = tradeEngine.fddState;
            const pending = state?.pending;
            if (!pending) return undefined;
            state.pending = null;
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const latest = tradeEngine.$scope?.ticksService?.getLatestTick?.(symbol);
            if (latest && latest.epoch !== pending.epoch) {
                ltdNotify('WAITING — a newer tick arrived before purchase; it will be analysed first (no stale trade).');
                return undefined;
            }

            fddLog(
                fddTradeLines({
                    barrier: pending.barrier,
                    stake: pending.stake,
                    duration: tradeEngine.tradeOptions?.duration,
                    duration_unit: tradeEngine.tradeOptions?.duration_unit,
                    recovery_level: state.recovery_level,
                })
            );

            const previous = { at: state.last_trade_at, epoch: state.last_trade_epoch };
            state.last_trade_at = Date.now();
            state.last_trade_epoch = pending.epoch;
            state.traded_barrier = pending.barrier;
            state.traded_stake = pending.stake;
            state.status = 'IN TRADE';
            tradeEngine.last_buy = null;
            tradeEngine.tradeOptions = {
                ...(tradeEngine.tradeOptions || {}),
                prediction: pending.barrier,
                amount: pending.stake,
            };

            // A thrown purchase error makes the interpreter rebuild the trade engine, which would
            // silently lose the recovery level, stake and session P/L — so failures are handled here.
            const failed = message => {
                state.last_trade_at = previous.at;
                state.last_trade_epoch = previous.epoch;
                state.status = 'ANALYZING';
                state.last_action = `Trade failed — ${message}`;
                const paused = recordFddPurchaseFailure(state, message);
                fddLog(
                    [
                        `TRADE FAILED — ${message} (attempt ${state.purchase_failures}/${FDD_PURCHASE_FAILURE_LIMIT})`,
                        paused
                            ? `TRADING PAUSED — ${state.paused}. Check the stake/balance, then restart the bot.`
                            : `Stake stays $${pending.stake.toFixed(2)} at recovery level ${
                                  state.recovery_level
                              }; retrying on the next valid tick.`,
                    ],
                    'journal__text--error'
                );
            };
            try {
                await tradeEngine.purchaseOverrideContractType('DIGITDIFF');
            } catch (error) {
                failed(error?.error?.message || error?.message || 'purchase error');
                return undefined;
            }
            const buy = tradeEngine.last_buy;
            if (!buy) {
                failed('trade was not submitted by the engine');
                return undefined;
            }
            state.purchase_failures = 0;
            state.last_action = `TRADE PLACED — DIFFER ${pending.barrier}`;
            fddLog(
                [
                    fddPlacedLine({
                        barrier: pending.barrier,
                        contract_id: buy.contract_id,
                        buy_price: Number(buy.buy_price ?? pending.stake),
                    }),
                ],
                'journal__text--success'
            );
            return undefined;
        },
        /** First Decimal Digit Differ — record the result and apply recovery; 1 = trade again, 0 = stop. */
        firstDecimalDigitResult: async () => {
            const state = tradeEngine.fddState;
            if (!state) return 0;
            const contract = tradeEngine.data?.contract || {};
            const profit = Number.isFinite(Number(contract.profit))
                ? Number(contract.profit)
                : Number(contract.sell_price || 0) - Number(contract.buy_price || 0);
            const stake = Number(contract.buy_price) || state.traded_stake;
            const outcome = applyFddResult(state, { profit, stake });
            const barrier = contract.barrier ?? state.traded_barrier;
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.symbol;
            const market = ltdMarketName(symbol);
            state.status = 'ANALYZING';
            state.last_action = `DIFFER ${barrier} ${outcome.won ? 'WIN' : 'LOSS'} (${profit >= 0 ? '+' : '-'}$${Math.abs(
                profit
            ).toFixed(2)})`;
            let balance;
            try {
                balance = tradeEngine.getBalance?.('STR');
            } catch {
                balance = undefined;
            }
            fddLog(
                fddResultLines({ state, outcome, barrier, profit, contract_id: contract.contract_id, balance, now: Date.now() }),
                outcome.won ? 'journal__text--success' : 'journal__text--error'
            );

            const stop = fddStopReason(state, state.settings);
            if (stop) state.status = 'STOPPED';
            fddLog(fddStatusLines(state, market));
            if (stop) {
                fddLog([`STOPPED — ${stop}`], 'journal__text--error');
                if (state.watchdog) clearInterval(state.watchdog);
                return 0;
            }
            return 1;
        },
        /**
         * Rise/Fall Hedge — called in After Purchase. Waits for both legs, records the
         * combined result and returns 1 to trade again or 0 to stop.
         */
        settleRiseFallHedge: async () => {
            const state = tradeEngine.riseFallHedgeState;
            if (!state) return 0;
            await settleCurrentHedge(state, tradeEngine.data?.contract);
            if (state.settings.mode !== 'AUTO') {
                notifyHedge('Manual hedge complete — press Run to fire the next hedge.');
                return 0;
            }
            const blocked = checkHedgeRiskGates({
                settings: state.settings,
                stake: Number(tradeEngine.tradeOptions?.amount) || 0,
                hedges: state.hedges,
                now: Date.now(),
                last_hedge_at: undefined,
            });
            if (blocked) {
                notifyHedge(`STOPPED — ${blocked}`, 'journal__text--error');
                return 0;
            }
            return 1;
        },
        /**
         * Rank Drop Differs — Differ the digit with the biggest frequency-rank
         * deterioration between the window Lookback Ticks ago and now.
         */
        evaluateRankDropDiffer: async options => {
            const opts = options || {};
            if (!tradeEngine.rankDropState) {
                tradeEngine.rankDropState = createRankDropState();
            }
            recordRankDropContract(tradeEngine.rankDropState, tradeEngine.data?.contract);
            const { analysis_window, lookback_ticks } = normalizeRankDropOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window + lookback_ticks, 'rank_drop');
            return evaluateRankDrop(digit_ticks, opts, tradeEngine.rankDropState);
        },
        /**
         * Rank Drop Differs replay/backtest (no look-ahead).
         */
        replayRankDropDiffer: async options => {
            const opts = options || {};
            if (Array.isArray(opts.ticks) && opts.ticks.length) {
                return replayRankDrop(opts.ticks, opts);
            }
            const { analysis_window, lookback_ticks } = normalizeRankDropOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window + lookback_ticks, 'rank_drop');
            return replayRankDrop(digit_ticks, opts);
        },
        /**
         * Ascending Rank Next Digit DIFFER — rank digits by % ascending and
         * Differ the digit ranked just above the current digit.
         */
        evaluateAscendingRankNext: async options => {
            const opts = options || {};
            if (!tradeEngine.ascendingRankNextState) {
                tradeEngine.ascendingRankNextState = createAscendingRankNextState();
            }
            const { analysis_window } = normalizeAscendingRankNextOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window, 'ascending_rank_next');
            return evaluateAscendingRankNext(digit_ticks, opts, tradeEngine.ascendingRankNextState);
        },
        /**
         * Ascending Rank Next Digit DIFFER replay/backtest (no look-ahead).
         */
        replayAscendingRankNext: async options => {
            const opts = options || {};
            if (Array.isArray(opts.ticks) && opts.ticks.length) {
                return replayAscendingRankNext(opts.ticks, opts);
            }
            const { analysis_window } = normalizeAscendingRankNextOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(tradeEngine, analysis_window, 'ascending_rank_next');
            return replayAscendingRankNext(digit_ticks, opts);
        },
        /**
         * Zero/One Rise OVER — enter Over (barrier from risk management) when
         * digit 0 or 1 increases in appearance %.
         */
        evaluateZeroOneRise: async options => {
            const opts = options || {};
            if (!tradeEngine.zeroOneRiseState) {
                tradeEngine.zeroOneRiseState = createZeroOneRiseState();
            }
            const { analysis_window, compare_lookback } = normalizeZeroOneRiseOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(
                tradeEngine,
                analysis_window + compare_lookback,
                'zero_one_rise'
            );
            return evaluateZeroOneRise(digit_ticks, opts, tradeEngine.zeroOneRiseState);
        },
        /**
         * Zero/One Rise OVER replay/backtest with Over 1 → Over 2 recovery (no look-ahead).
         */
        replayZeroOneRise: async options => {
            const opts = options || {};
            if (Array.isArray(opts.ticks) && opts.ticks.length) {
                return replayZeroOneRise(opts.ticks, opts);
            }
            const { analysis_window, compare_lookback } = normalizeZeroOneRiseOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(
                tradeEngine,
                analysis_window + compare_lookback,
                'zero_one_rise'
            );
            return replayZeroOneRise(digit_ticks, opts);
        },
        /**
         * Digit Rise DIFFER — Differ the current digit when any target digit
         * increases in appearance %.
         */
        evaluateDigitRiseDiffer: async options => {
            const opts = { ...(options || {}), trade_mode: 'differ' };
            if (!tradeEngine.digitRiseDifferState) {
                tradeEngine.digitRiseDifferState = createZeroOneRiseState();
            }
            const { analysis_window, compare_lookback } = normalizeZeroOneRiseOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(
                tradeEngine,
                analysis_window + compare_lookback,
                'digit_rise_differ'
            );
            return evaluateZeroOneRise(digit_ticks, opts, tradeEngine.digitRiseDifferState);
        },
        /**
         * Digit Rise DIFFER replay/backtest (no look-ahead).
         */
        replayDigitRiseDiffer: async options => {
            const opts = { ...(options || {}), trade_mode: 'differ' };
            if (Array.isArray(opts.ticks) && opts.ticks.length) {
                return replayZeroOneRise(opts.ticks, opts);
            }
            const { analysis_window, compare_lookback } = normalizeZeroOneRiseOptions(opts);
            const digit_ticks = await loadWindowDigitTicks(
                tradeEngine,
                analysis_window + compare_lookback,
                'digit_rise_differ'
            );
            return replayZeroOneRise(digit_ticks, opts);
        },
        /**
         * Low-High Flip OVER — Over (barrier from risk management) when
         * previous_3, previous_2 are low and previous_1, current are high.
         */
        evaluateLowHighFlipOver: async options => {
            const opts = options || {};
            const scan_markets =
                opts.scan_markets === true || opts.scan_markets === 'true' || opts.scan_markets === 'TRUE';
            if (scan_markets) {
                if (!tradeEngine.lowHighFlipScanState) {
                    tradeEngine.lowHighFlipScanState = createLowHighFlipScanState();
                }
                const scan_state = tradeEngine.lowHighFlipScanState;
                const active_symbol = tradeEngine.options?.symbol || tradeEngine.symbol || '';
                const symbols = orderSymbolsForScan(
                    resolveScanSymbols({
                        market_group: opts.market_group,
                        symbols: String(opts.symbols || '').toUpperCase(),
                    }),
                    active_symbol
                );
                const ticks_service = tradeEngine.$scope?.ticksService;
                if (ticks_service?.warmScanStreams) {
                    ticks_service.warmScanStreams(symbols).catch(() => {});
                }
                if (ticks_service?.pickAndRefreshStaleScanSymbol) {
                    try {
                        await ticks_service.pickAndRefreshStaleScanSymbol(symbols, active_symbol);
                    } catch (e) {
                        // Keep prior caches.
                    }
                }

                const n = LOW_HIGH_FLIP_HISTORY_TICKS;
                const markets = await Promise.all(
                    symbols.map(async symbol => {
                        if (symbol === tradeEngine.symbol) {
                            return { symbol, ticks: await loadWindowDigitTicks(tradeEngine, n, 'low_high_flip_over') };
                        }
                        const raw = ticks_service?.getCachedTicks ? (ticks_service.getCachedTicks(symbol) || []).slice(-n) : [];
                        const digits = tradeEngine.getCachedDigitsForSymbol
                            ? tradeEngine.getCachedDigitsForSymbol(symbol, n)
                            : [];
                        const offset = raw.length - digits.length;
                        const ticks = digits.map((digit, i) => ({ digit, epoch: Number(raw[i + offset]?.epoch) }));
                        // 1s markets tick every second, standard ones every 2s.
                        const max_age_ms = symbol.startsWith('1HZ') ? 2500 : 4500;
                        const stale =
                            typeof ticks_service?.isScanTipFresh === 'function' &&
                            !ticks_service.isScanTipFresh(symbol, max_age_ms);
                        return { symbol, ticks, stale };
                    })
                );

                const result = evaluateLowHighFlipScan(markets, opts, scan_state);
                if (result.matched && result.symbol !== active_symbol) {
                    let switched = false;
                    try {
                        if (typeof tradeEngine.switchTradeSymbol === 'function') {
                            await tradeEngine.switchTradeSymbol(result.symbol);
                            switched = (tradeEngine.options?.symbol || tradeEngine.symbol) === result.symbol;
                        }
                    } catch (e) {
                        switched = false;
                    }
                    if (!switched) {
                        releaseLowHighFlipScanSignal(scan_state, result.symbol);
                        const reason = `Signal on ${result.symbol} but the market switch failed — skipping trade.`;
                        return {
                            ...result,
                            prediction: -1,
                            matched: false,
                            contract_type: null,
                            why_no_trade: reason,
                            journal_messages: [
                                ...result.journal_messages.slice(0, -1),
                                { className: 'journal__text--error', message: `WHY NO TRADE? ${reason}` },
                            ],
                        };
                    }
                }
                return result;
            }
            if (!tradeEngine.lowHighFlipState) {
                tradeEngine.lowHighFlipState = createLowHighFlipState();
            }
            const digit_ticks = await loadWindowDigitTicks(
                tradeEngine,
                LOW_HIGH_FLIP_HISTORY_TICKS,
                'low_high_flip_over'
            );
            return evaluateLowHighFlip(digit_ticks, opts, tradeEngine.lowHighFlipState);
        },
        /**
         * Low-High Flip OVER replay/backtest with Over 1 → Over 2 recovery (no look-ahead).
         */
        replayLowHighFlipOver: async options => {
            const opts = options || {};
            if (Array.isArray(opts.ticks) && opts.ticks.length) {
                return replayLowHighFlip(opts.ticks, opts);
            }
            const digit_ticks = await loadWindowDigitTicks(
                tradeEngine,
                LOW_HIGH_FLIP_HISTORY_TICKS,
                'low_high_flip_over'
            );
            return replayLowHighFlip(digit_ticks, opts);
        },
        /**
         * Pattern Switch — last-digit windows → Even / Odd / Over 4 / Under 5.
         */
        evaluatePatternSwitch: async options => {
            const opts = options || {};
            const need = 4;
            if (typeof tradeEngine.ensureTickHistory === 'function') {
                await tradeEngine.ensureTickHistory(Math.max(need, 10));
            }
            let digits = tradeEngine.getAvailableLastDigitList
                ? tradeEngine.getAvailableLastDigitList(Math.max(need, 10))
                : tradeEngine.getCachedLastDigitList
                  ? tradeEngine.getCachedLastDigitList(need)
                  : [];
            if (!Array.isArray(digits)) {
                digits = [];
            }
            const window_digits = digits.slice(-Math.max(need, Math.min(digits.length, 10)));
            const result = runPatternSwitch(window_digits, opts);
            const tip_fp = `${result.reason}:${(result.sequence || []).join(',')}`;
            if (
                !result.matched &&
                tradeEngine._patternSwitchLastJournalFp === tip_fp &&
                Array.isArray(result.journal_messages)
            ) {
                return { ...result, journal_messages: [] };
            }
            tradeEngine._patternSwitchLastJournalFp = tip_fp;
            return result;
        },
        /**
         * Digit Percentage Decrease — multi-market Differ on the largest rolling % drop.
         */
        evaluateDigitPercentageDecrease: async options => {
            const opts = normalizeDigitPercentageDecreaseOptions(options || {});
            const journal_enabled = opts.journal_enabled;
            if (!tradeEngine.digitPercentageDecreaseState?.by_symbol) {
                tradeEngine.digitPercentageDecreaseState = createDigitPercentageDecreaseRuntime();
            }
            const runtime = tradeEngine.digitPercentageDecreaseState;
            const need = opts.analysis_window;
            const symbols = resolveScanSymbols(opts);
            const active_symbol =
                tradeEngine.options?.symbol || tradeEngine.symbol || symbols[0] || '';
            const ordered = orderSymbolsForScan(
                symbols.length ? symbols : [active_symbol].filter(Boolean),
                active_symbol
            );
            const ticks_service = tradeEngine.$scope?.ticksService;

            if (!ordered.length) {
                return {
                    prediction: -1,
                    matched: false,
                    symbol: active_symbol,
                    symbols_scanned: [],
                    journal_messages: journal_enabled
                        ? [
                              {
                                  className: 'journal__text--error',
                                  message: 'Digit % Decrease: no volatilities selected.',
                              },
                          ]
                        : [],
                };
            }

            // Subscribe every configured market, then fill a full analysis window.
            // A 25-tick warm or 50-tick refresh left only the trade-definition
            // market (1HZ50V) ready, so the bot never left that symbol.
            if (ticks_service?.warmScanStreams) {
                try {
                    await ticks_service.warmScanStreams(ordered);
                } catch (e) {
                    // history fill below can still seed the window
                }
            }

            if (typeof tradeEngine.ensureDigitsForSymbol === 'function') {
                for (let i = 0; i < ordered.length; i++) {
                    const symbol = ordered[i];
                    const cached = tradeEngine.getCachedDigitsForSymbol
                        ? tradeEngine.getCachedDigitsForSymbol(symbol, need)
                        : [];
                    if (!Array.isArray(cached) || cached.length < need) {
                        try {
                            await tradeEngine.ensureDigitsForSymbol(symbol, need);
                        } catch (e) {
                            // keep prior cache; this symbol stays collecting
                        }
                    }
                }
            }

            const evaluations = ordered.map(symbol => {
                if (ticks_service?._noteScanTip) {
                    ticks_service._noteScanTip(symbol);
                }
                const digits = tradeEngine.getCachedDigitsForSymbol
                    ? tradeEngine.getCachedDigitsForSymbol(symbol, need)
                    : [];
                const ticks = ticks_service?.getCachedTicks ? ticks_service.getCachedTicks(symbol) || [] : [];
                const latest = ticks.length ? ticks[ticks.length - 1] : null;
                const tip_key =
                    latest?.epoch != null
                        ? `${symbol}:${latest.epoch}`
                        : `${symbol}:${digits.length}:${digits[digits.length - 1] ?? ''}`;
                const result = runDigitPercentageDecrease(
                    digits,
                    { ...opts, journal_enabled: false, tip_key },
                    getDigitPercentageDecreaseSymbolState(runtime, symbol)
                );
                return { ...result, symbol, tip_fp: tip_key };
            });

            const raw_match = pickBestDigitPercentageDecreaseMatch(evaluations, {
                last_symbol: runtime.last_traded_symbol || '',
                symbol_order: symbols.length ? symbols : ordered,
            });
            const tip_fp = raw_match?.tip_fp || 'empty';
            const skipped_consumed = isDigitPercentageDecreaseSignalConsumed(
                raw_match,
                tip_fp,
                tradeEngine._digitPercentageDecreaseConsumedKey
            );
            const match = skipped_consumed ? null : raw_match;

            let switched = false;
            let switch_failed = false;
            if (match && opts.switch_symbol && match.symbol && match.symbol !== active_symbol) {
                try {
                    if (typeof tradeEngine.switchTradeSymbol === 'function') {
                        await tradeEngine.switchTradeSymbol(match.symbol);
                        const now_symbol =
                            tradeEngine.options?.symbol || tradeEngine.symbol || '';
                        if (now_symbol === match.symbol) {
                            switched = true;
                        } else {
                            switch_failed = true;
                        }
                    } else {
                        switch_failed = true;
                    }
                } catch (e) {
                    switch_failed = true;
                }
            }

            const tradeable = match?.matched && !switch_failed ? match : null;
            if (tradeable) {
                runtime.last_traded_symbol = tradeable.symbol || '';
                tradeEngine._digitPercentageDecreaseConsumedKey = makeDigitPercentageDecreaseSignalKey(
                    tradeable,
                    tradeable.tip_fp || tip_fp
                );
            }

            const journal_messages = [];
            if (journal_enabled) {
                if (tradeable) {
                    journal_messages.push({
                        className: 'journal__text--success',
                        message: `Digit % Decrease: ${tradeable.symbol} → DIFFER ${tradeable.prediction} (drop ${Number(tradeable.drop).toFixed(3)}pp)${switched ? ' (switched)' : ''}`,
                    });
                } else if (!skipped_consumed) {
                    const watching = evaluations
                        .map(item => {
                            const ready = item.analysis?.ready;
                            const label = ready
                                ? item.matched
                                    ? `diff ${item.prediction}`
                                    : item.analysis?.reason === 'baseline_seeded'
                                      ? 'baseline'
                                      : 'watch'
                                : `${item.analysis?.tick_count || 0}/${need}`;
                            return `${item.symbol}:${label}`;
                        })
                        .join(' | ');
                    const watch_fp = `watch:${watching}`;
                    if (tradeEngine._digitPercentageDecreaseJournalFp !== watch_fp) {
                        tradeEngine._digitPercentageDecreaseJournalFp = watch_fp;
                        journal_messages.push({
                            className: 'journal__text',
                            message: `Digit % Decrease: scanning ${watching || '…'}`,
                        });
                    }
                }
            }

            return {
                prediction: tradeable ? tradeable.prediction : -1,
                barrier: tradeable ? tradeable.prediction : -1,
                matched: Boolean(tradeable),
                digit: tradeable?.digit ?? -1,
                drop: tradeable?.drop ?? 0,
                symbol: tradeable?.symbol || active_symbol,
                symbols_scanned: ordered,
                evaluations,
                switched,
                skipped_consumed,
                reason: tradeable
                    ? 'percentage_decrease'
                    : skipped_consumed
                      ? 'consumed'
                      : 'watching',
                journal_messages,
            };
        },
        /**
         * Triple-digit Martingale — last 3 equal → Differs 4th-from-end across selected volatilities.
         */
        evaluateTripleDigitMartingaleScan: async options => {
            const opts = normalizeTripleDigitMartingaleOptions(options || {});
            const journal_enabled = opts.journal_enabled;
            const symbols = resolveTripleDigitSymbols(opts);
            const active_symbol =
                tradeEngine.options?.symbol || tradeEngine.symbol || symbols[0] || '';
            const ordered = orderTripleDigitSymbols(symbols.length ? symbols : [active_symbol].filter(Boolean), active_symbol);
            const ticks_service = tradeEngine.$scope?.ticksService;
            const need = 4;

            if (!ordered.length) {
                return {
                    prediction: -1,
                    matched: false,
                    symbol: active_symbol,
                    symbols_scanned: [],
                    journal_messages: journal_enabled
                        ? [{ className: 'journal__text--error', message: 'Triple-digit Martingale: no volatilities selected.' }]
                        : [],
                };
            }

            if (ticks_service?.warmScanStreams) {
                ticks_service.warmScanStreams(ordered).catch(() => {});
            }
            if (ticks_service?.pickAndRefreshStaleScanSymbol) {
                try {
                    await ticks_service.pickAndRefreshStaleScanSymbol(ordered, active_symbol);
                } catch (e) {
                    // keep prior caches
                }
            }

            if (active_symbol && typeof tradeEngine.ensureDigitsForSymbol === 'function') {
                const cached = tradeEngine.getCachedDigitsForSymbol
                    ? tradeEngine.getCachedDigitsForSymbol(active_symbol, need)
                    : [];
                if (!Array.isArray(cached) || cached.length < need) {
                    try {
                        await tradeEngine.ensureDigitsForSymbol(active_symbol, need);
                    } catch (e) {
                        // keep prior cache
                    }
                }
            }

            const evaluations = await Promise.all(
                ordered.map(async symbol => {
                    if (ticks_service?._noteScanTip) {
                        ticks_service._noteScanTip(symbol);
                    }
                    let digits = tradeEngine.getCachedDigitsForSymbol
                        ? tradeEngine.getCachedDigitsForSymbol(symbol, need)
                        : [];
                    if (
                        (!Array.isArray(digits) || digits.length < need) &&
                        typeof tradeEngine.getDigitsForSymbol === 'function'
                    ) {
                        try {
                            digits = await tradeEngine.getDigitsForSymbol(symbol, need);
                        } catch (e) {
                            digits = Array.isArray(digits) ? digits : [];
                        }
                    }
                    return evaluateSymbolTripleDigitSignal(symbol, digits);
                })
            );

            const raw_match = pickFirstTripleDigitMatch(evaluations);
            let tip_epoch = null;
            if (raw_match?.symbol && ticks_service?.getCachedTicks) {
                const ticks = ticks_service.getCachedTicks(raw_match.symbol) || [];
                const tip = ticks[ticks.length - 1];
                if (tip?.epoch != null && Number.isFinite(Number(tip.epoch))) {
                    tip_epoch = Number(tip.epoch);
                } else if (tip) {
                    tip_epoch = `${ticks.length}:${tip.quote ?? ''}`;
                }
            }

            const skipped_consumed = isTripleDigitSignalConsumed(
                raw_match,
                tip_epoch,
                tradeEngine._tripleDigitMartingaleConsumedKey
            );
            const match = skipped_consumed ? null : raw_match;

            let switched = false;
            let switch_failed = false;
            if (match && opts.switch_symbol && match.symbol && match.symbol !== active_symbol) {
                try {
                    if (typeof tradeEngine.switchTradeSymbol === 'function') {
                        await tradeEngine.switchTradeSymbol(match.symbol);
                        const now_symbol =
                            tradeEngine.options?.symbol || tradeEngine.symbol || '';
                        if (now_symbol === match.symbol) {
                            switched = true;
                        } else {
                            switch_failed = true;
                        }
                    } else {
                        switch_failed = true;
                    }
                } catch (e) {
                    switch_failed = true;
                }
            }

            const tradeable = match?.matched && !switch_failed ? match : null;
            if (tradeable) {
                tradeEngine._tripleDigitMartingaleConsumedKey = makeTripleDigitSignalKey(
                    tradeable,
                    tip_epoch
                );
            }

            const journal_messages = [];
            if (journal_enabled) {
                if (tradeable) {
                    journal_messages.push({
                        className: 'journal__text--success',
                        message: `Triple-digit Martingale: ${tradeable.symbol} [${(tradeable.sequence || []).join(',')}] → DIFFER ${tradeable.prediction}${switched ? ' (switched)' : ''}`,
                    });
                } else if (!skipped_consumed) {
                    const watching = evaluations
                        .map(item => `${item.symbol}:[${(item.sequence || []).join(',') || '…'}]`)
                        .slice(0, 4)
                        .join(' | ');
                    const tip_fp = `watch:${watching}`;
                    if (tradeEngine._tripleDigitMartingaleLastJournalFp !== tip_fp) {
                        tradeEngine._tripleDigitMartingaleLastJournalFp = tip_fp;
                        journal_messages.push({
                            className: 'journal__text',
                            message: `Triple-digit Martingale: watching ${watching || '…'}`,
                        });
                    }
                }
            }

            return {
                prediction: tradeable ? tradeable.prediction : -1,
                barrier: tradeable ? tradeable.prediction : -1,
                matched: Boolean(tradeable),
                symbol: tradeable?.symbol || active_symbol,
                sequence: tradeable?.sequence || [],
                symbols_scanned: ordered,
                evaluations,
                switched,
                skipped_consumed,
                reason: tradeable ? 'triple_repeat' : skipped_consumed ? 'consumed' : 'watching',
                journal_messages,
            };
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
         * Digit frequency analysis — least/most frequent digit in last N ticks.
         * Sync + tip cache avoids repeating the same calculation in one loop.
         */
        getDigitFrequencyAnalysis: (analysis_type, sample_size) => {
            const window_size = clampDigitPercentageWindow(sample_size);
            const tip_key = tradeEngine.getLatestTickTipKey
                ? tradeEngine.getLatestTickTipKey()
                : `len:${window_size}`;
            const type_key = String(analysis_type || 'LEAST_FREQUENT').toUpperCase();
            const cache = tradeEngine.digitFrequencySnapshot;

            if (
                cache &&
                cache.tip_key === tip_key &&
                cache.window_size === window_size &&
                cache.results &&
                Object.prototype.hasOwnProperty.call(cache.results, type_key)
            ) {
                return cache.results[type_key];
            }

            const digits = tradeEngine.getAvailableLastDigitList
                ? tradeEngine.getAvailableLastDigitList(window_size)
                : tradeEngine.getCachedLastDigitList(window_size);

            if (
                (!digits || digits.length < window_size) &&
                tradeEngine.ensureTickHistory &&
                !tradeEngine._digitFreqFillPending
            ) {
                tradeEngine._digitFreqFillPending = true;
                Promise.resolve(tradeEngine.ensureTickHistory(window_size))
                    .catch(() => {})
                    .finally(() => {
                        tradeEngine._digitFreqFillPending = false;
                        tradeEngine.digitFrequencySnapshot = null;
                    });
            }

            const digit = analyzeDigitFrequency(digits || [], window_size, type_key);
            const results =
                cache && cache.tip_key === tip_key && cache.window_size === window_size && cache.results
                    ? cache.results
                    : {};
            results[type_key] = digit;
            tradeEngine.digitFrequencySnapshot = {
                tip_key,
                window_size,
                results,
            };
            return digit;
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
         * Odd-pair Over / Even-pair Under — sync last-2/3 digit scan.
         * Over: last 2 odd & last 3 >= digit_min → Over 2; recovering → Over 3.
         * Under: last 2 even & last 3 <= digit_max → Under 7; recovering → Under 6.
         * Arms one purchase at a time; entry is one-shot per tip, recovery may re-arm after settle.
         */
        evaluateEvenOddPairOverUnder: options => {
            const opts = options || {};
            const side = toMarketSide(opts.side || opts.market_side);
            const recovering =
                opts.recovering === true ||
                opts.recovering === 1 ||
                opts.recovering === 'TRUE' ||
                opts.recovering === 'true';

            if (!tradeEngine.evenOddPairState) {
                tradeEngine.evenOddPairState = createEvenOddPairRuntimeState();
            }
            const runtime = tradeEngine.evenOddPairState;

            const contract = tradeEngine.data?.contract;
            const has_open_contract = Boolean(
                contract && contract.buy_price != null && contract.sell_price == null
            );

            // Clear commit once per settled contract id (ignore stale previous stubs).
            if (
                contract &&
                contract.buy_price != null &&
                contract.sell_price != null &&
                contract.transaction_ids?.buy &&
                (contract.contract_id || contract.transaction_ids?.buy)
            ) {
                const contract_id =
                    contract.contract_id || contract.transaction_ids?.buy || null;
                applyEvenOddPairSettlement(runtime, contract_id);
            }

            if (!has_open_contract && releaseStaleEvenOddPairCommit(runtime, 20000)) {
                // Stale arm (purchase never completed) — allow this tip again.
                tradeEngine._evenOddPairLastEntryTip = null;
            }

            // While a contract is open, never re-signal.
            if (has_open_contract) {
                const waiting = {
                    prediction: -1,
                    barrier: -1,
                    matched: false,
                    side,
                    reason: 'awaiting_settlement',
                    journal_messages: [],
                };
                tradeEngine.evenOddPairSnapshot = waiting;
                return waiting;
            }

            // Armed but buy not open yet: keep returning the armed barrier so
            // before_purchase can retry purchase on the next tip/proposal ready
            // instead of going dark (-1) and missing the trade.
            if (runtime.trade_committed && runtime.armed_prediction >= 0) {
                const armed = {
                    prediction: runtime.armed_prediction,
                    barrier: runtime.armed_prediction,
                    matched: true,
                    side,
                    contract_type: side === 'UNDER' ? 'DIGITUNDER' : 'DIGITOVER',
                    recovering,
                    reason: 'armed_pending_purchase',
                    journal_messages: [],
                };
                tradeEngine.evenOddPairSnapshot = armed;
                return armed;
            }

            const digits = tradeEngine.getAvailableLastDigitList
                ? tradeEngine.getAvailableLastDigitList(3)
                : tradeEngine.getCachedLastDigitList
                  ? tradeEngine.getCachedLastDigitList(3)
                  : [];

            const tip_base = tradeEngine.getLatestTickTipKey
                ? tradeEngine.getLatestTickTipKey()
                : '';
            const tip_epoch = makeEvenOddPairTipKey(tip_base, digits);

            const signal = detectEvenOddPairSignal(digits, {
                side,
                threshold: opts.threshold,
                digit_min:
                    opts.digit_min !== undefined
                        ? opts.digit_min
                        : opts.odd_max !== undefined
                          ? opts.odd_max
                          : opts.threshold,
                odd_max: opts.odd_max !== undefined ? opts.odd_max : opts.threshold,
                digit_max:
                    opts.digit_max !== undefined
                        ? opts.digit_max
                        : opts.even_min !== undefined
                          ? opts.even_min
                          : opts.threshold,
                even_min: opts.even_min !== undefined ? opts.even_min : opts.threshold,
                recovering,
                journal_enabled: true,
            });

            // Entry: never re-buy the same tip. Recovery: may re-arm after settlement.
            const tip_already_traded =
                !recovering &&
                tip_epoch != null &&
                tip_epoch !== '' &&
                tradeEngine._evenOddPairLastEntryTip != null &&
                String(tradeEngine._evenOddPairLastEntryTip) === String(tip_epoch);

            const skipped_consumed = tip_already_traded && signal.matched;
            const match = skipped_consumed ? null : signal.matched ? signal : null;

            if (match?.matched) {
                tradeEngine._evenOddPairLastEntryTip = tip_epoch;
                armEvenOddPairPrediction(runtime, match.barrier);
            }

            const result = buildEvenOddPairResult({
                signal,
                journal_enabled: true,
                skipped_consumed,
            });

            const tip_fp = skipped_consumed
                ? `consumed:${tip_epoch}`
                : `${side}:${signal.reason}:${tip_epoch}`;
            let public_result = result;
            if (
                !result.matched &&
                tradeEngine._evenOddPairLastJournalFp === tip_fp &&
                Array.isArray(result.journal_messages)
            ) {
                public_result = { ...result, journal_messages: [] };
            } else {
                tradeEngine._evenOddPairLastJournalFp = tip_fp;
            }

            tradeEngine.evenOddPairSnapshot = public_result;
            return public_result;
        },
        /**
         * Hybrid multi-scan — Odd Pair Over, Even Pair Under, Pattern OU,
         * Sequential Differs, Hot Digit on the active market.
         */
        evaluateHybridMultiScan: options => {
            const opts = normalizeHybridMultiScanOptions(options || {});

            if (!tradeEngine.hybridMultiScanState) {
                tradeEngine.hybridMultiScanState = createHybridMultiScanRuntimeState();
            }
            const runtime = tradeEngine.hybridMultiScanState;

            const contract = tradeEngine.data?.contract;
            const has_open_contract = Boolean(
                contract && contract.buy_price != null && contract.sell_price == null
            );

            if (
                contract &&
                contract.buy_price != null &&
                contract.sell_price != null &&
                contract.transaction_ids?.buy &&
                (contract.contract_id || contract.transaction_ids?.buy)
            ) {
                const contract_id =
                    contract.contract_id || contract.transaction_ids?.buy || null;
                applyHybridMultiScanSettlement(runtime, contract_id);
            }

            if (!has_open_contract && releaseStaleHybridMultiScanCommit(runtime, 20000)) {
                tradeEngine._hybridMultiScanLastTipKey = null;
            }

            if (has_open_contract) {
                const waiting = {
                    matched: false,
                    prediction: -1,
                    barrier: -1,
                    contract_type: null,
                    contract_code: CONTRACT_CODE.NONE,
                    lane: null,
                    reason: 'awaiting_settlement',
                    journal_messages: [],
                };
                tradeEngine.hybridMultiScanSnapshot = waiting;
                return waiting;
            }

            if (runtime.trade_committed && runtime.armed_prediction >= 0) {
                const armed = {
                    matched: true,
                    prediction: runtime.armed_prediction,
                    barrier: runtime.armed_prediction,
                    contract_type: runtime.armed_contract_type,
                    contract_code: runtime.armed_contract_code,
                    lane: runtime.last_lane,
                    reason: 'armed_pending_purchase',
                    journal_messages: [],
                };
                tradeEngine.hybridMultiScanSnapshot = armed;
                return armed;
            }

            const lookback = Math.max(opts.pattern_lookback, opts.hot_lookback, 20);
            const digits = tradeEngine.getAvailableLastDigitList
                ? tradeEngine.getAvailableLastDigitList(lookback)
                : tradeEngine.getCachedLastDigitList
                  ? tradeEngine.getCachedLastDigitList(lookback)
                  : [];

            const tip_base = tradeEngine.getLatestTickTipKey
                ? tradeEngine.getLatestTickTipKey()
                : '';

            const recovering = opts.recovering;

            const result = runHybridMultiScan(digits, {
                ...opts,
                recovering,
                last_lane: runtime.last_lane,
                last_contract_type: runtime.last_contract_type,
                last_was_loss: recovering || Boolean(tradeEngine.patternProbabilityLastWasLoss),
            });

            const tip_key = makeHybridMultiScanTipKey(tip_base, result);
            const tip_already_traded =
                !recovering &&
                tip_key &&
                tradeEngine._hybridMultiScanLastTipKey != null &&
                String(tradeEngine._hybridMultiScanLastTipKey) === String(tip_key);

            let public_result = result;
            if (tip_already_traded && result.matched) {
                public_result = {
                    ...result,
                    matched: false,
                    prediction: -1,
                    barrier: -1,
                    contract_type: null,
                    contract_code: CONTRACT_CODE.NONE,
                    reason: 'tip_consumed',
                    journal_messages: [
                        {
                            className: 'journal__text',
                            message: 'Hybrid: tip already traded',
                        },
                    ],
                };
            } else if (result.matched) {
                tradeEngine._hybridMultiScanLastTipKey = tip_key;
                armHybridMultiScanPrediction(runtime, result);
            }

            const tip_fp = `${public_result.reason}:${tip_key || tip_base}`;
            if (
                !public_result.matched &&
                tradeEngine._hybridMultiScanLastJournalFp === tip_fp &&
                Array.isArray(public_result.journal_messages)
            ) {
                public_result = { ...public_result, journal_messages: [] };
            } else {
                tradeEngine._hybridMultiScanLastJournalFp = tip_fp;
            }

            tradeEngine.hybridMultiScanSnapshot = public_result;
            return public_result;
        },
        getHybridMultiScanContractCode: () => {
            const snap = tradeEngine.hybridMultiScanSnapshot;
            if (!snap || !snap.matched) {
                return CONTRACT_CODE.NONE;
            }
            return snap.contract_code != null ? snap.contract_code : CONTRACT_CODE.NONE;
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
            if (!tradeEngine.sequentialDigitDiffersState) {
                tradeEngine.sequentialDigitDiffersState = createSequentialDiffersRuntimeState();
            }
            const runtime = tradeEngine.sequentialDigitDiffersState;
            const immediate_loss_retry =
                opts.immediate_loss_retry === undefined
                    ? DEFAULT_IMMEDIATE_LOSS_RETRY
                    : opts.immediate_loss_retry === true ||
                      opts.immediate_loss_retry === 1 ||
                      opts.immediate_loss_retry === 'TRUE' ||
                      opts.immediate_loss_retry === 'true';

            // Apply settled contract result once (arms one-shot same-digit retry on loss).
            // Only treat contracts with both buy + sell prices as settled — createDetails
            // crashes on incomplete contract stubs.
            const contract = tradeEngine.data?.contract;
            const has_open_contract = Boolean(
                contract && contract.buy_price != null && contract.sell_price == null
            );
            if (
                contract &&
                contract.buy_price != null &&
                contract.sell_price != null &&
                contract.transaction_ids?.buy &&
                (contract.contract_id || contract.transaction_ids?.buy)
            ) {
                try {
                    const details = createDetails(contract);
                    const outcome = details?.[10];
                    const contract_id =
                        contract.contract_id ||
                        contract.transaction_ids?.buy ||
                        details?.[0] ||
                        null;
                    if (outcome === 'loss' || outcome === 'win') {
                        applySequentialDiffersTradeResult(runtime, {
                            is_loss: outcome === 'loss',
                            immediate_loss_retry,
                            contract_id,
                            // Prefer raw contract barrier — createDetails maps missing → 0.
                            barrier:
                                contract.barrier !== undefined && contract.barrier !== null
                                    ? contract.barrier
                                    : undefined,
                        });
                    }
                } catch (e) {
                    // keep prior runtime flags
                }
            }

            // If purchase never happened, unlock after timeout and allow the same tip again.
            // Never timeout while a bought contract is still open (avoids double-buy).
            if (!has_open_contract && releaseStaleSequentialCommit(runtime, 20000)) {
                tradeEngine._seqDiffersConsumedKey = null;
            }

            const journal_enabled =
                opts.journal_enabled === undefined
                    ? true
                    : opts.journal_enabled === true ||
                      opts.journal_enabled === 1 ||
                      opts.journal_enabled === 'TRUE' ||
                      opts.journal_enabled === 'true';

            // After issuing a signal, return -1 until settlement — prevents Start()
            // from re-buying the same Differ while the contract is still open.
            if (runtime.trade_committed || has_open_contract) {
                const waiting = {
                    prediction: -1,
                    barrier: -1,
                    matched: false,
                    direction: null,
                    sequence: [],
                    symbol: tradeEngine.options?.symbol || tradeEngine.symbol || '',
                    market_group: opts.market_group,
                    symbols_scanned: [],
                    evaluations: [],
                    switched: false,
                    skipped_consumed: false,
                    reason: 'awaiting_settlement',
                    journal_messages: [],
                };
                tradeEngine.sequentialDigitDiffersSnapshot = waiting;
                return waiting;
            }

            // One-shot: Differ the same losing digit with no scan.
            const retry_digit = consumeImmediateLossRetry(runtime);
            if (retry_digit !== null) {
                const retry_result = {
                    prediction: retry_digit,
                    barrier: retry_digit,
                    matched: true,
                    direction: null,
                    sequence: [],
                    symbol: tradeEngine.options?.symbol || tradeEngine.symbol || '',
                    market_group: opts.market_group,
                    symbols_scanned: [],
                    evaluations: [],
                    switched: false,
                    skipped_consumed: false,
                    immediate_loss_retry: true,
                    reason: `immediate_loss_retry_${retry_digit}`,
                    journal_messages: journal_enabled
                        ? [
                              {
                                  className: 'success',
                                  message: `Seq Differs: immediate loss retry → Differ ${retry_digit} (no analysis)`,
                              },
                          ]
                        : [],
                };
                tradeEngine.sequentialDigitDiffersSnapshot = retry_result;
                tradeEngine._seqDiffersLastJournalFp = `immretry:${retry_digit}:${runtime.last_handled_contract_id}`;
                return retry_result;
            }

            const market_group = toMarketGroup(opts.market_group);
            const symbols = resolveScanSymbols({ ...opts, market_group });
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

            const ticks_service = tradeEngine.$scope?.ticksService;

            // Warm live streams serially in the background — never Promise.all
            // ticks_history (that causes RateLimit / RequestFailed storms).
            if (ticks_service?.warmScanStreams) {
                ticks_service.warmScanStreams(ordered).catch(() => {});
            }

            // Refresh at most one stale non-active symbol this cycle (await that
            // one call only — do not wait on the entire historical queue).
            if (ticks_service?.pickAndRefreshStaleScanSymbol) {
                try {
                    await ticks_service.pickAndRefreshStaleScanSymbol(ordered, active_symbol);
                } catch (e) {
                    // keep prior caches
                }
            }

            // Prefer sync cache reads. Only fill the active symbol via API when
            // short — parallel empty-fills across the whole scan group rate-limit.
            const evaluations = await Promise.all(
                ordered.map(async symbol => {
                    if (ticks_service?._noteScanTip) {
                        ticks_service._noteScanTip(symbol);
                    }
                    let digits = tradeEngine.getCachedDigitsForSymbol
                        ? tradeEngine.getCachedDigitsForSymbol(symbol, 5)
                        : [];
                    if (
                        symbol === active_symbol &&
                        (!Array.isArray(digits) || digits.length < 3) &&
                        typeof tradeEngine.getDigitsForSymbol === 'function'
                    ) {
                        try {
                            digits = await tradeEngine.getDigitsForSymbol(symbol, 5);
                        } catch (e) {
                            digits = Array.isArray(digits) ? digits : [];
                        }
                    }
                    return evaluateSymbolSequentialSignal(symbol, digits);
                })
            );

            const raw_match = pickFirstMatch(evaluations);
            let tip_epoch = null;
            if (raw_match?.symbol && ticks_service?.getCachedTicks) {
                const ticks = ticks_service.getCachedTicks(raw_match.symbol) || [];
                const tip = ticks[ticks.length - 1];
                if (tip?.epoch != null && Number.isFinite(Number(tip.epoch))) {
                    tip_epoch = Number(tip.epoch);
                } else if (tip) {
                    // Fallback tip id when epoch is missing — changes when quote/length moves.
                    tip_epoch = `${ticks.length}:${tip.quote ?? ''}`;
                }
            }

            // One purchase per tip — Start()/trade_again must not re-buy the same
            // consecutive run while that tip is still in cache.
            const skipped_consumed = isSignalAlreadyConsumed(
                raw_match,
                tip_epoch,
                tradeEngine._seqDiffersConsumedKey
            );
            const match = skipped_consumed ? null : raw_match;

            let switched = false;
            let switch_failed = false;
            if (match && switch_symbol && match.symbol && match.symbol !== active_symbol) {
                try {
                    if (typeof tradeEngine.switchTradeSymbol === 'function') {
                        await tradeEngine.switchTradeSymbol(match.symbol);
                        const now_symbol =
                            tradeEngine.options?.symbol || tradeEngine.symbol || '';
                        if (now_symbol === match.symbol) {
                            switched = true;
                        } else {
                            switch_failed = true;
                        }
                    } else {
                        switch_failed = true;
                    }
                } catch (e) {
                    switch_failed = true;
                }
            }

            // Never arm a Differs barrier from market A while still on market B.
            const tradeable = match?.matched && !switch_failed ? match : null;

            if (tradeable) {
                tradeEngine._seqDiffersConsumedKey = makeSignalKey(tradeable, tip_epoch);
                armSequentialDiffersPrediction(runtime, tradeable.barrier, {
                    from_immediate_retry: false,
                });
            }

            const result = buildSequentialScanResult({
                market_group,
                symbols: ordered,
                active_symbol,
                journal_enabled,
                evaluations,
                match: switch_failed ? null : raw_match,
                switched,
                skipped_consumed: skipped_consumed || switch_failed,
            });

            if (switch_failed && journal_enabled) {
                result.reason = 'switch_failed';
                result.journal_messages = [
                    {
                        className: 'error',
                        message: `Seq Differs: signal on ${match.symbol} but market switch failed — skipping trade`,
                    },
                ];
            }

            // Suppress duplicate NO-TRADE / consumed spam while Start() retries.
            const tip_fp = skipped_consumed
                ? `consumed:${tradeEngine._seqDiffersConsumedKey}`
                : switch_failed
                  ? `switch_failed:${match?.symbol}:${tip_epoch}`
                  : evaluations.map(e => `${e.symbol}:${(e.sequence || []).join(',')}`).join('|');
            let public_result = result;
            if (
                !result.matched &&
                tradeEngine._seqDiffersLastJournalFp === tip_fp &&
                Array.isArray(result.journal_messages)
            ) {
                public_result = { ...result, journal_messages: [] };
            } else {
                tradeEngine._seqDiffersLastJournalFp = tip_fp;
            }

            tradeEngine.sequentialDigitDiffersSnapshot = public_result;
            return public_result;
        },
        /**
         * Hot Digit Differs — single active market, parity-scoped (even / odd / both).
         * Tip equals hottest digit in that parity → Differ coldest opposite-parity digit.
         */
        evaluateOddEvenHotDigitScan: async options => {
            const opts = normalizeHotOddEvenDiffersOptions(options || {});
            if (!tradeEngine.oddEvenHotDigitState) {
                tradeEngine.oddEvenHotDigitState = createHotOddEvenDiffersRuntimeState();
            }
            const runtime = tradeEngine.oddEvenHotDigitState;

            const contract = tradeEngine.data?.contract;
            const has_open_contract = Boolean(
                contract && contract.buy_price != null && contract.sell_price == null
            );

            if (
                contract &&
                contract.buy_price != null &&
                contract.sell_price != null &&
                contract.transaction_ids?.buy
            ) {
                clearHotOddEvenDiffersCommit(runtime);
            }

            if (!has_open_contract && releaseStaleHotOddEvenDiffersCommit(runtime, 20000)) {
                tradeEngine._oeHotConsumedKey = null;
            }

            if (runtime.trade_committed || has_open_contract) {
                const waiting = {
                    prediction: -1,
                    barrier: -1,
                    matched: false,
                    reason: 'awaiting_settlement',
                    journal_messages: [],
                };
                tradeEngine.oddEvenHotDigitSnapshot = waiting;
                return waiting;
            }

            const active_symbol = tradeEngine.options?.symbol || tradeEngine.symbol || '';
            const ticks_service = tradeEngine.$scope?.ticksService;

            if (
                active_symbol &&
                typeof tradeEngine.ensureDigitsForSymbol === 'function'
            ) {
                const cached = tradeEngine.getCachedDigitsForSymbol
                    ? tradeEngine.getCachedDigitsForSymbol(active_symbol, opts.lookback)
                    : [];
                if (!Array.isArray(cached) || cached.length < opts.lookback) {
                    try {
                        await tradeEngine.ensureDigitsForSymbol(active_symbol, opts.lookback);
                    } catch (e) {
                        // keep prior cache
                    }
                }
            } else if (
                active_symbol &&
                tradeEngine.ensureTickHistory &&
                (!tradeEngine.getCachedLastDigitList ||
                    (tradeEngine.getCachedLastDigitList(opts.lookback) || []).length < opts.lookback)
            ) {
                try {
                    await tradeEngine.ensureTickHistory(opts.lookback);
                } catch (e) {
                    // keep prior
                }
            }

            let digits = [];
            if (active_symbol && tradeEngine.getCachedDigitsForSymbol) {
                digits = tradeEngine.getCachedDigitsForSymbol(active_symbol, opts.lookback) || [];
            } else if (tradeEngine.getAvailableLastDigitList) {
                digits = tradeEngine.getAvailableLastDigitList(opts.lookback) || [];
            } else if (tradeEngine.getCachedLastDigitList) {
                digits = tradeEngine.getCachedLastDigitList(opts.lookback) || [];
            }

            const evaluation = evaluateSymbolHotOddEvenDiffers(active_symbol, digits, opts);
            const evaluations = [evaluation];
            const raw_match = evaluation.matched ? evaluation : null;

            let tip_epoch = null;
            if (active_symbol && ticks_service?.getCachedTicks) {
                const ticks = ticks_service.getCachedTicks(active_symbol) || [];
                const tip = ticks[ticks.length - 1];
                if (tip?.epoch != null && Number.isFinite(Number(tip.epoch))) {
                    tip_epoch = Number(tip.epoch);
                } else if (tip) {
                    tip_epoch = `${ticks.length}:${tip.quote ?? ''}`;
                }
            } else if (tradeEngine.getLatestTickTipKey) {
                tip_epoch = tradeEngine.getLatestTickTipKey();
            }

            const skipped_consumed = isHotOddEvenDiffersSignalConsumed(
                raw_match,
                tip_epoch,
                tradeEngine._oeHotConsumedKey
            );
            const match = skipped_consumed ? null : raw_match;

            if (match?.matched) {
                tradeEngine._oeHotConsumedKey = makeHotOddEvenDiffersSignalKey(match, tip_epoch);
                armHotOddEvenDiffersPrediction(runtime, match.barrier);
            }

            const result = buildHotOddEvenDiffersResult({
                market_group: active_symbol || 'ACTIVE',
                active_symbol,
                journal_enabled: opts.journal_enabled,
                parity: opts.parity,
                evaluations,
                match: raw_match,
                switched: false,
                skipped_consumed,
            });

            const tip_fp = skipped_consumed
                ? `consumed:${tradeEngine._oeHotConsumedKey}`
                : `${active_symbol}:${evaluation.reason}:${tip_epoch}`;
            let public_result = result;
            if (
                !result.matched &&
                tradeEngine._oeHotLastJournalFp === tip_fp &&
                Array.isArray(result.journal_messages)
            ) {
                public_result = { ...result, journal_messages: [] };
            } else {
                tradeEngine._oeHotLastJournalFp = tip_fp;
            }

            tradeEngine.oddEvenHotDigitSnapshot = public_result;
            return public_result;
        },
        /**
         * Parity-run Differs — last N all-even or all-odd → Differ oldest of those N.
         * Multi-market scan across 1S / STANDARD / ALL with optional symbol switch.
         */
        evaluateParityRunDiffersScan: async options => {
            const opts = normalizeParityRunOptions(options || {});
            if (!tradeEngine.parityRunDiffersState) {
                tradeEngine.parityRunDiffersState = createParityRunRuntimeState();
            }
            const runtime = tradeEngine.parityRunDiffersState;

            const contract = tradeEngine.data?.contract;
            const has_open_contract = Boolean(
                contract && contract.buy_price != null && contract.sell_price == null
            );

            if (
                contract &&
                contract.buy_price != null &&
                contract.sell_price != null &&
                contract.transaction_ids?.buy &&
                (contract.contract_id || contract.transaction_ids?.buy)
            ) {
                const contract_id =
                    contract.contract_id || contract.transaction_ids?.buy || null;
                applyParityRunSettlement(runtime, contract_id);
            }

            if (!has_open_contract && releaseStaleParityRunCommit(runtime, 20000)) {
                tradeEngine._parityRunConsumedKey = null;
            }

            // Open contract: never re-signal.
            if (has_open_contract) {
                const waiting = {
                    prediction: -1,
                    barrier: -1,
                    matched: false,
                    parity: null,
                    sequence: [],
                    symbol: tradeEngine.options?.symbol || tradeEngine.symbol || '',
                    market_group: opts.market_group,
                    symbols_scanned: [],
                    evaluations: [],
                    switched: false,
                    skipped_consumed: false,
                    run_length: opts.run_length,
                    reason: 'awaiting_settlement',
                    journal_messages: [],
                };
                tradeEngine.parityRunDiffersSnapshot = waiting;
                return waiting;
            }

            // Armed but buy not open yet: keep returning the armed barrier so
            // before_purchase / Start retries can still purchase instead of going dark (-1).
            if (runtime.trade_committed && runtime.armed_prediction >= 0) {
                const armed = {
                    prediction: runtime.armed_prediction,
                    barrier: runtime.armed_prediction,
                    matched: true,
                    parity: null,
                    sequence: [],
                    symbol: tradeEngine.options?.symbol || tradeEngine.symbol || '',
                    market_group: opts.market_group,
                    symbols_scanned: [],
                    evaluations: [],
                    switched: false,
                    skipped_consumed: false,
                    run_length: opts.run_length,
                    reason: 'armed_pending_purchase',
                    journal_messages: [],
                };
                tradeEngine.parityRunDiffersSnapshot = armed;
                return armed;
            }

            const symbols = resolveParityRunSymbols(opts);
            const active_symbol =
                tradeEngine.options?.symbol || tradeEngine.symbol || symbols[0] || '';
            const ordered = orderParityRunSymbols(symbols, active_symbol);
            const ticks_service = tradeEngine.$scope?.ticksService;
            const need = Math.max(opts.run_length, 6);

            if (ticks_service?.warmScanStreams) {
                ticks_service.warmScanStreams(ordered).catch(() => {});
            }
            if (ticks_service?.pickAndRefreshStaleScanSymbol) {
                try {
                    await ticks_service.pickAndRefreshStaleScanSymbol(ordered, active_symbol);
                } catch (e) {
                    // keep prior caches
                }
            }

            // Prefill active-symbol history when the sliding window is still short.
            if (
                active_symbol &&
                typeof tradeEngine.ensureDigitsForSymbol === 'function'
            ) {
                const cached = tradeEngine.getCachedDigitsForSymbol
                    ? tradeEngine.getCachedDigitsForSymbol(active_symbol, need)
                    : [];
                if (!Array.isArray(cached) || cached.length < opts.run_length) {
                    try {
                        await tradeEngine.ensureDigitsForSymbol(active_symbol, need);
                    } catch (e) {
                        // keep prior cache
                    }
                }
            }

            const evaluations = await Promise.all(
                ordered.map(async symbol => {
                    if (ticks_service?._noteScanTip) {
                        ticks_service._noteScanTip(symbol);
                    }
                    let digits = tradeEngine.getCachedDigitsForSymbol
                        ? tradeEngine.getCachedDigitsForSymbol(symbol, need)
                        : [];
                    if (
                        symbol === active_symbol &&
                        (!Array.isArray(digits) || digits.length < opts.run_length) &&
                        typeof tradeEngine.getDigitsForSymbol === 'function'
                    ) {
                        try {
                            digits = await tradeEngine.getDigitsForSymbol(symbol, need);
                        } catch (e) {
                            digits = Array.isArray(digits) ? digits : [];
                        }
                    }
                    return evaluateSymbolParityRunSignal(symbol, digits, opts.run_length);
                })
            );

            const raw_match = pickFirstParityRunMatch(evaluations);
            let tip_epoch = null;
            if (raw_match?.symbol && ticks_service?.getCachedTicks) {
                const ticks = ticks_service.getCachedTicks(raw_match.symbol) || [];
                const tip = ticks[ticks.length - 1];
                if (tip?.epoch != null && Number.isFinite(Number(tip.epoch))) {
                    tip_epoch = Number(tip.epoch);
                } else if (tip) {
                    tip_epoch = `${ticks.length}:${tip.quote ?? ''}`;
                }
            }

            const skipped_consumed = isParityRunSignalConsumed(
                raw_match,
                tip_epoch,
                tradeEngine._parityRunConsumedKey
            );
            const match = skipped_consumed ? null : raw_match;

            let switched = false;
            let switch_failed = false;
            if (match && opts.switch_symbol && match.symbol && match.symbol !== active_symbol) {
                try {
                    if (typeof tradeEngine.switchTradeSymbol === 'function') {
                        await tradeEngine.switchTradeSymbol(match.symbol);
                        const now_symbol =
                            tradeEngine.options?.symbol || tradeEngine.symbol || '';
                        if (now_symbol === match.symbol) {
                            switched = true;
                        } else {
                            switch_failed = true;
                        }
                    } else {
                        switch_failed = true;
                    }
                } catch (e) {
                    switch_failed = true;
                }
            }

            const tradeable = match?.matched && !switch_failed ? match : null;
            if (tradeable) {
                tradeEngine._parityRunConsumedKey = makeParityRunSignalKey(tradeable, tip_epoch);
                armParityRunPrediction(runtime, tradeable.barrier);
            }

            const result = buildParityRunScanResult({
                market_group: opts.market_group,
                symbols: ordered,
                active_symbol,
                journal_enabled: opts.journal_enabled,
                evaluations,
                match: switch_failed ? null : raw_match,
                switched,
                skipped_consumed: skipped_consumed || switch_failed,
                run_length: opts.run_length,
            });

            if (switch_failed && opts.journal_enabled) {
                result.reason = 'switch_failed';
                result.journal_messages = [
                    {
                        className: 'journal__text--error',
                        message: `Parity-run: signal on ${match.symbol} but market switch failed — skipping trade`,
                    },
                ];
            }

            const tip_fp = skipped_consumed
                ? `consumed:${tradeEngine._parityRunConsumedKey}`
                : switch_failed
                  ? `switch_failed:${match?.symbol}:${tip_epoch}`
                  : evaluations.map(e => `${e.symbol}:${(e.sequence || []).join(',')}`).join('|');
            let public_result = result;
            if (
                !result.matched &&
                tradeEngine._parityRunLastJournalFp === tip_fp &&
                Array.isArray(result.journal_messages)
            ) {
                public_result = { ...result, journal_messages: [] };
            } else {
                tradeEngine._parityRunLastJournalFp = tip_fp;
            }

            tradeEngine.parityRunDiffersSnapshot = public_result;
            return public_result;
        },
        setSequentialDigitDiffersLastResult: (is_loss, immediate_loss_retry) => {
            if (!tradeEngine.sequentialDigitDiffersState) {
                tradeEngine.sequentialDigitDiffersState = createSequentialDiffersRuntimeState();
            }
            applySequentialDiffersTradeResult(tradeEngine.sequentialDigitDiffersState, {
                is_loss: !!is_loss,
                immediate_loss_retry:
                    immediate_loss_retry === undefined
                        ? DEFAULT_IMMEDIATE_LOSS_RETRY
                        : immediate_loss_retry,
                contract_id: `manual:${Date.now()}`,
            });
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
