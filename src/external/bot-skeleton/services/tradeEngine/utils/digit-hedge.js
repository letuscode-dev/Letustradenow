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

/** A digit from 0 to 9, or null when the value is not a barrier. */
export const parseDigitBarrier = value => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 9 ? n : null;
};

/** Use the saved barriers, then the trade-option prediction, then Over 5 and Under 4. */
export const resolveHedgeBarriers = ({ over, under, fallbackOver, fallbackUnder } = {}) => ({
    over: parseDigitBarrier(over) ?? parseDigitBarrier(fallbackOver) ?? Number(OVER_BARRIER),
    under: parseDigitBarrier(under) ?? parseDigitBarrier(fallbackUnder) ?? Number(UNDER_BARRIER),
});

/**
 * Digits that lose both sides: not above the Over barrier and not below the
 * Under barrier. Over 5 and Under 4 lose on 4 and 5. Over 7 and Under 2 lose
 * on 2 through 7. No digit loses both when Under is above Over.
 */
export const isDeadDigit = (digit, over = OVER_BARRIER, under = UNDER_BARRIER) => {
    const d = Number(digit);
    const o = parseDigitBarrier(over);
    const u = parseDigitBarrier(under);
    if (!isLastDigit(d) || o == null || u == null) return false;
    return d >= u && d <= o;
};

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

/**
 * 4 and 5 dominate the last `window` digits when they appear more often than
 * every other digit combined. The end of the list is the newest tick. A tie
 * or a short list does not trade.
 */
export const deadDigitsDominate = (digits, window = 5, over = OVER_BARRIER, under = UNDER_BARRIER) => {
    const size = Number(window);
    if (!Number.isInteger(size) || size < 1) return false;
    if (!Array.isArray(digits) || digits.length < size) return false;
    const recent = digits.slice(-size);
    if (!recent.every(isLastDigit)) return false;
    const dead = recent.filter(digit => isDeadDigit(digit, over, under)).length;
    return dead > size - dead;
};

/** How many of the last `window` digits lose both sides. The list end is newest. */
export const deadDigitCount = (digits, window = 5, over = OVER_BARRIER, under = UNDER_BARRIER) => {
    const size = Number(window);
    if (!Array.isArray(digits) || !Number.isInteger(size) || size < 1) return 0;
    return digits.slice(-size).filter(digit => isDeadDigit(digit, over, under)).length;
};

/**
 * A both-sides loss may buy the next hedge at once. Any other result, or the
 * option turned off, goes back to the digit check.
 */
export const armImmediateRecovery = ({ decision, enabled }) =>
    decision === HEDGE_RECOVER && Number(enabled) > 0;

/** Missing or invalid Clear Range uses the newest tick only. */
export const quietGapWindow = (range = 1) => {
    const size = Math.floor(Number(range));
    return Number.isFinite(size) && size >= 1 ? Math.min(size, 500) : 1;
};

/**
 * Volatility last digits need a known decimal size. Pip 0 rounds the price
 * (4521.34 becomes 4521) and can buy when the real digit is 4 or 5.
 */
export const quietGapPipReady = pip => {
    const size = Number(pip);
    return Number.isInteger(size) && size >= 1;
};

/**
 * 1 when the newest `range` ticks (default 1) contain no 4 and no 5.
 * The newest tick is inside that range, so the last digit is not 4 or 5 either.
 * A short list or a missing digit does not trade.
 */
export const evaluateQuietGap = (digits, range = 1) => {
    const window = quietGapWindow(range);
    const raw = (Array.isArray(digits) ? digits : []).map(digit => Number(digit));
    const sample = raw.slice(-window);
    const isDigit = digit => Number.isInteger(digit) && digit >= 0 && digit <= 9;
    const ready = raw.length >= window && sample.length === window && sample.every(isDigit);
    const last = ready ? sample[sample.length - 1] : null;
    const gapCount = ready ? sample.filter(digit => digit === 4 || digit === 5).length : null;
    const lastClear = last !== 4 && last !== 5;
    return {
        trade: ready && lastClear && gapCount === 0,
        window,
        last,
        gapCount,
        ready,
        have: raw.length,
    };
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

export const DIGIT_HEDGE_SKIP = 'skip';
export const DIGIT_HEDGE_OPEN = 'open';
export const DIGIT_HEDGE_CANCEL = 'cancel';

const contractId = value => (value == null || value === '' ? null : value);

/**
 * Nothing is bought until both quotes exist. A hedge is kept only when both
 * buys return a contract. Any single filled contract is cancelled.
 */
export const planDigitHedgeBuys = ({ over_quoted, under_quoted, over_contract_id, under_contract_id }) => {
    const over_id = contractId(over_contract_id);
    const under_id = contractId(under_contract_id);
    const cancel_ids = [over_id, under_id].filter(Boolean);
    if (!over_quoted || !under_quoted) {
        return { action: cancel_ids.length ? DIGIT_HEDGE_CANCEL : DIGIT_HEDGE_SKIP, cancel_ids };
    }
    if (over_id && under_id) {
        return {
            action: DIGIT_HEDGE_OPEN,
            cancel_ids: [],
            over_contract_id: over_id,
            under_contract_id: under_id,
        };
    }
    return { action: DIGIT_HEDGE_CANCEL, cancel_ids };
};

/** True when the account can pay for both legs. An unknown balance does not block. */
export const canAffordBothLegs = (balance, over_price, under_price) => {
    const need = Number(over_price) + Number(under_price);
    const cash = Number(balance);
    if (!Number.isFinite(need) || need <= 0 || !Number.isFinite(cash)) return false;
    return cash + 1e-8 >= need;
};

const positiveStake = value => {
    const stake = Number(value);
    return Number.isFinite(stake) && stake > 0 ? stake : null;
};

/**
 * Next stake from the stake that was actually bought.
 * A both-lost hedge returns round(bought × multiplier). One winning side
 * returns the set stake. Calling this again for the same hedge does not
 * multiply a second time.
 */
export const nextHedgeStake = ({ bought, current, initial, multiplier, decision }) => {
    const bought_stake = positiveStake(bought);
    const current_stake = positiveStake(current);
    const initial_stake = positiveStake(initial);
    const used = bought_stake ?? current_stake;

    if (decision === HEDGE_RESET) return round2(initial_stake ?? used ?? 0);
    if (decision === HEDGE_RECOVER) {
        const mult = Number(multiplier);
        if (used == null || !Number.isFinite(mult) || mult <= 0) return round2(used ?? 0);
        return round2(used * mult);
    }
    return round2(current_stake ?? used ?? 0);
};

/** Trade again only after a finished hedge whose next stake matches the rule. */
export const hedgeMayContinue = plan => {
    if (!plan) return false;
    const next_stake = Number(plan.next);
    if (!Number.isFinite(next_stake) || next_stake <= 0) return false;
    if (plan.decision === HEDGE_RESET) return true;
    if (plan.decision !== HEDGE_RECOVER) return false;

    const used = positiveStake(plan.bought) ?? positiveStake(plan.current);
    const mult = Number(plan.multiplier);
    if (used == null || !Number.isFinite(mult) || mult <= 1) return false;
    return next_stake === round2(used * mult) && next_stake > used;
};

export const HEDGE_LIMIT_TAKE_PROFIT = 'take_profit';
export const HEDGE_LIMIT_STOP_LOSS = 'stop_loss';
export const HEDGE_LIMIT_NONE = 'continue';

/**
 * Add this hedge's combined profit to the running total, then stop when the
 * rounded total has reached take profit or stop loss. Numbers are coerced so a
 * string comparison cannot treat 9.50 as already past 10.
 */
export const applyHedgeLimits = ({ total, profit, takeProfit, stopLoss }) => {
    const start = Number(total);
    const gain = Number(profit);
    const next = round2((Number.isFinite(start) ? start : 0) + (Number.isFinite(gain) ? gain : 0));
    const target = Number(takeProfit);
    const loss_limit = Number(stopLoss);
    if (Number.isFinite(target) && next >= target) {
        return { total: next, action: HEDGE_LIMIT_TAKE_PROFIT };
    }
    if (Number.isFinite(loss_limit) && next <= round2(-Math.abs(loss_limit))) {
        return { total: next, action: HEDGE_LIMIT_STOP_LOSS };
    }
    return { total: next, action: HEDGE_LIMIT_NONE };
};

/** 1 = take profit, -1 = stop loss, 0 = keep trading. */
export const hedgeLimitCode = action => {
    if (action === HEDGE_LIMIT_TAKE_PROFIT) return 1;
    if (action === HEDGE_LIMIT_STOP_LOSS) return -1;
    return 0;
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

const START_KEYS = ['date_start', 'start_time', 'entry_tick_time', 'entry_spot_time'];
const END_KEYS = ['date_expiry', 'exit_tick_time'];
const ENTRY_PRICE_KEYS = ['entry_spot_display_value', 'entry_spot'];
const EXIT_PRICE_KEYS = ['exit_tick_display_value', 'exit_spot', 'exit_tick'];

const epochOf = value => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const firstEpoch = (record, keys) => {
    if (!record) return null;
    for (const key of keys) {
        const n = epochOf(record[key]);
        if (n != null) return n;
    }
    return null;
};

/** A whole digit 0–9 is not the contract price. */
const priceOf = value => {
    if (value == null || value === '') return null;
    const text = String(value).trim();
    const n = Number(text);
    if (!Number.isFinite(n)) return null;
    if (Number.isInteger(n) && n >= 0 && n <= 9 && !text.includes('.')) return null;
    return n;
};

const firstPrice = (record, keys) => {
    if (!record) return null;
    for (const key of keys) {
        const price = priceOf(record[key]);
        if (price != null) return price;
    }
    return null;
};

export const hedgeStartEpoch = record => firstEpoch(record, START_KEYS);

export const hedgeEntryPrice = record => firstPrice(record, ENTRY_PRICE_KEYS);

export const hedgeExitPrice = record => firstPrice(record, EXIT_PRICE_KEYS);

/**
 * True only when both legs open on the same tick and, once prices are known,
 * share that entry price and that exit price. A missing start time is not a match.
 */
export const sameHedgeClock = (over, under) => {
    const over_start = hedgeStartEpoch(over);
    const under_start = hedgeStartEpoch(under);
    if (over_start == null || under_start == null || over_start !== under_start) return false;

    const over_end = firstEpoch(over, END_KEYS);
    const under_end = firstEpoch(under, END_KEYS);
    if (over_end != null && under_end != null && over_end !== under_end) return false;

    const over_entry = hedgeEntryPrice(over);
    const under_entry = hedgeEntryPrice(under);
    if (over_entry != null && under_entry != null && over_entry !== under_entry) return false;

    const over_exit = hedgeExitPrice(over);
    const under_exit = hedgeExitPrice(under);
    if (over_exit != null && under_exit != null && over_exit !== under_exit) return false;

    return true;
};

/** True when both legs report a start, entry, or exit that is not the same tick. */
export const hedgeTicksDiffer = (over, under) => {
    if (!over || !under) return false;
    const over_start = hedgeStartEpoch(over);
    const under_start = hedgeStartEpoch(under);
    if (over_start != null && under_start != null && over_start !== under_start) return true;

    const over_end = firstEpoch(over, END_KEYS);
    const under_end = firstEpoch(under, END_KEYS);
    if (over_end != null && under_end != null && over_end !== under_end) return true;

    const over_entry = hedgeEntryPrice(over);
    const under_entry = hedgeEntryPrice(under);
    if (over_entry != null && under_entry != null && over_entry !== under_entry) return true;

    const over_exit = hedgeExitPrice(over);
    const under_exit = hedgeExitPrice(under);
    return over_exit != null && under_exit != null && over_exit !== under_exit;
};

const barrierOrDefault = (barrier, fallback) => {
    const parsed = parseDigitBarrier(barrier);
    return parsed == null ? fallback : String(parsed);
};

/** Over quote. Defaults to barrier 5. Any digit 0–9 is accepted. */
export const buildDigitOverProposal = (trade_option, barrier = OVER_BARRIER) =>
    buildDigitLegProposal(trade_option, 'DIGITOVER', barrierOrDefault(barrier, OVER_BARRIER));

/** Under quote, sent with Over. Defaults to barrier 4. Any digit 0–9 is accepted. */
export const buildDigitUnderProposal = (trade_option, barrier = UNDER_BARRIER) =>
    buildDigitLegProposal(trade_option, 'DIGITUNDER', barrierOrDefault(barrier, UNDER_BARRIER));
