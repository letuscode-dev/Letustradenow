/**
 * Over 5 / Under 4 hedge.
 *
 * Both contracts are quoted and bought together. The bot does not wait for the
 * engine's proposal list, because a stake-based bot never subscribes to one.
 * Over is then registered with the engine so After Purchase runs when it settles.
 * Under is followed separately. Combined profit is the sum of both contracts.
 */

export const OVER_BARRIER = '5';
export const UNDER_BARRIER = '4';

const round2 = value => Math.round(Number(value) * 100) / 100;

/** A 4 or a 5 loses both Over 5 and Under 4. */
export const isDeadDigit = digit => digit === 4 || digit === 5;

const isLastDigit = digit => {
    if (digit === null || digit === undefined || digit === '') return false;
    const value = Number(digit);
    return Number.isInteger(value) && value >= 0 && value <= 9;
};

/**
 * Trade when exactly one of the last two digits is 4 or 5 and the other is
 * some other digit. Skip 4-4, 5-5, 4-5, and 5-4.
 */
export const shouldHedgeLastDigits = (newer, older) => {
    if (!isLastDigit(newer) || !isLastDigit(older)) return false;
    return isDeadDigit(Number(newer)) !== isDeadDigit(Number(older));
};

export const isSettledContract = poc =>
    Boolean(poc && (poc.is_sold || poc.status === 'won' || poc.status === 'lost' || poc.status === 'sold'));

export const legProfit = poc => {
    if (!isSettledContract(poc)) return null;
    const reported = Number(poc.profit);
    if (Number.isFinite(reported)) return round2(reported);
    const sell = Number(poc.sell_price);
    const buy = Number(poc.buy_price);
    if (Number.isFinite(sell) && Number.isFinite(buy)) return round2(sell - buy);
    return null;
};

/** Combined P/L once both legs have settled. Anything incomplete stays unknown. */
export const hedgeNet = ({ over, under, under_bought }) => {
    const over_profit = legProfit(over);
    const under_profit = under_bought ? legProfit(under) : null;
    if (over_profit === null || under_profit === null) return null;
    return round2(over_profit + under_profit);
};

/** 1 = back to the set stake, -1 = both sides lost so multiply, 0 = stop. */
export const HEDGE_RESET = 1;
export const HEDGE_RECOVER = -1;
export const HEDGE_STOP = 0;

/**
 * One winning side is the hedge working, even when the spread leaves a small
 * net loss. Doubling after that loss would raise the stake on almost every trade.
 * Multiply only when both sides lose. Stop when a leg is missing.
 */
export const hedgeDecision = ({ over, under, under_bought }) => {
    const net = hedgeNet({ over, under, under_bought });
    if (net === null) return HEDGE_STOP;
    const over_profit = legProfit(over);
    const under_profit = legProfit(under);
    if (over_profit < 0 && under_profit < 0) return HEDGE_RECOVER;
    return HEDGE_RESET;
};

const buildDigitLegProposal = (trade_option, contract_type, barrier) => ({
    proposal: 1,
    amount: Number(trade_option?.amount),
    basis: trade_option?.basis || 'stake',
    contract_type,
    currency: trade_option?.currency,
    duration: Number(trade_option?.duration) || 1,
    duration_unit: trade_option?.duration_unit || 't',
    underlying_symbol: trade_option?.symbol,
    barrier,
});

/** Over 5 quote. Barrier is fixed so it does not share Under's prediction. */
export const buildDigitOverProposal = trade_option => buildDigitLegProposal(trade_option, 'DIGITOVER', OVER_BARRIER);

/** Under 4 quote, sent at the same time as Over 5. */
export const buildDigitUnderProposal = (trade_option, over_proposal) =>
    buildDigitLegProposal(
        {
            ...trade_option,
            currency: trade_option?.currency || over_proposal?.currency,
            symbol: trade_option?.symbol || over_proposal?.underlying_symbol || over_proposal?.symbol,
        },
        'DIGITUNDER',
        UNDER_BARRIER
    );
