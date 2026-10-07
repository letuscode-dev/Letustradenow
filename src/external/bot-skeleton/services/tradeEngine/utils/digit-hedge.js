/**
 * Over 5 / Under 4 hedge.
 *
 * Both contracts use the same stake and duration. Over is bought through the
 * engine (prediction 5). Under is a separate proposal with barrier 4, sent at
 * the same time. Combined profit is the sum of the two settled contracts.
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

export const legProfit = poc => {
    if (!poc) return null;
    const reported = Number(poc.profit);
    if (Number.isFinite(reported)) return round2(reported);
    const sell = Number(poc.sell_price);
    const buy = Number(poc.buy_price);
    if (Number.isFinite(sell) && Number.isFinite(buy)) return round2(sell - buy);
    return null;
};

/** Combined P/L. A missing bought leg stays null so the caller can keep waiting. */
export const hedgeNet = ({ over, under, under_bought }) => {
    const over_profit = legProfit(over);
    if (over_profit === null) return null;
    if (!under_bought) return over_profit;
    const under_profit = legProfit(under);
    if (under_profit === null) return null;
    return round2(over_profit + under_profit);
};

/** Under 4 proposal. Over 5 comes from the engine's subscribed proposal. */
export const buildDigitUnderProposal = (trade_option, over_proposal) => ({
    proposal: 1,
    amount: Number(trade_option?.amount),
    basis: trade_option?.basis || 'stake',
    contract_type: 'DIGITUNDER',
    currency: trade_option?.currency || over_proposal?.currency,
    duration: Number(trade_option?.duration) || 1,
    duration_unit: trade_option?.duration_unit || 't',
    underlying_symbol: trade_option?.symbol || over_proposal?.underlying_symbol || over_proposal?.symbol,
    barrier: UNDER_BARRIER,
});
