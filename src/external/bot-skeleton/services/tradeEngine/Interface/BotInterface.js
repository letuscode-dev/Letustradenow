import { observer as globalObserver } from '../../../utils/observer';
import { createDetails } from '../utils/helpers';
import { getDigitTransitionPrediction } from '../utils/digit-transition';

const getBotInterface = tradeEngine => {
    const getDetail = i => createDetails(tradeEngine.data.contract)[i];

    return {
        init: (...args) => tradeEngine.init(...args),
        start: (...args) => tradeEngine.start(...args),
        stop: (...args) => tradeEngine.stop(...args),
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
