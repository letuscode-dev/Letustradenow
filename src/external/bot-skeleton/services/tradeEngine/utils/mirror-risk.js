/** Risk state is advanced only by confirmed contract settlements. */
export const createMirrorRiskState = ({ stake = 5, maxLosses = 2, profitThreshold = 10 } = {}) => {
    const initialStake = Number(stake);
    const limit = Number(maxLosses);
    const target = Number(profitThreshold);
    if (!Number.isFinite(initialStake) || initialStake <= 0 || !Number.isInteger(limit) || limit < 1 ||
        !Number.isFinite(target) || target <= 0) {
        throw new Error('Stake and profit threshold must be positive, and maximum losses must be a positive integer.');
    }
    return { initialStake, stake: initialStake, maxLosses: limit, profitThreshold: target, totalProfit: 0,
        totalLoss: 0, lossCount: 0, inARow: 0, stopped: false, stopReason: null };
};

/**
 * On a loss the next stake recovers the accumulated loss at 9.6%. A win resets
 * the loss sequence and stake. Rounding is supplied by the account adapter.
 */
export const applyMirrorSettlement = (state, settlement, round = value => value) => {
    if (!settlement || !['won', 'lost'].includes(settlement.result) || !Number.isFinite(settlement.profit) ||
        (settlement.result === 'won' && settlement.profit < 0) ||
        (settlement.result === 'lost' && settlement.profit >= 0)) {
        throw new Error('A confirmed settlement with a consistent profit is required.');
    }
    state.totalProfit = round(state.totalProfit + settlement.profit);
    if (settlement.result === 'lost') {
        state.lossCount += 1;
        state.inARow += 1;
        state.totalLoss = round(state.totalLoss - settlement.profit);
        state.stake = round(state.totalLoss * (100 / 9.6));
    } else {
        state.inARow = 0;
        state.totalLoss = 0;
        state.stake = state.initialStake;
    }
    if (!Number.isFinite(state.stake) || state.stake <= 0 || !Number.isFinite(state.totalProfit)) {
        state.stopped = true;
        state.stopReason = 'Invalid calculated stake or profit';
    } else if (!state.stopped && state.totalProfit >= state.profitThreshold) {
        state.stopped = true;
        state.stopReason = 'Profit threshold reached';
    } else if (!state.stopped && state.inARow >= state.maxLosses) {
        state.stopped = true;
        state.stopReason = 'Maximum consecutive losses reached';
    }
    return state;
};
