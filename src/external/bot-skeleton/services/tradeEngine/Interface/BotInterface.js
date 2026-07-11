import { observer as globalObserver } from '../../../utils/observer';
import { createDetails } from '../utils/helpers';
import { getDigitTransitionPrediction } from '../utils/digit-transition';
import { evaluateOverZeroGapFilter } from '../utils/gap-filter';
import { createTrackerState, evaluateAdaptiveDigitGap } from '../utils/adaptive-digit-gap';

const getBotInterface = tradeEngine => {
    const getDetail = i => createDetails(tradeEngine.data.contract)[i];

    return {
        init: (...args) => tradeEngine.init(...args),
        start: (...args) => tradeEngine.start(...args),
        stop: (...args) => {
            tradeEngine.adaptiveDigitGapState = null;
            return tradeEngine.stop(...args);
        },
        purchase: contract_type => tradeEngine.purchase(contract_type),
        purchaseOverrideContractType: contract_type => tradeEngine.purchaseOverrideContractType(contract_type),
        getAskPrice: contract_type => Number(getProposal(contract_type, tradeEngine).ask_price),
        getPayout: contract_type => Number(getProposal(contract_type, tradeEngine).payout),
        getCachedLastDigitList: tick_count => tradeEngine.getCachedLastDigitList(tick_count),
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
