/**
 * Odd/Even Hot-Digit scanner.
 *
 * On each market's lookback window, compute digit % occurrence.
 * If ≥ min_hot_digits odd digits are each ≥ min_digit_pct → favor Odd
 * (vice versa for Even). Pick the best qualifying market.
 *
 * Then wait for `opposite_streak` consecutive opposite-parity tips,
 * take up to `max_trades` on the favored side at base stake, and if the
 * last trade loses, take one martingale recovery (× multiplier) then stop.
 */

import {
    DEFAULT_MARKET_GROUP,
    orderSymbolsForScan,
    resolveScanSymbols,
    toMarketGroup,
} from './sequential-digit-differs';

export { resolveScanSymbols, orderSymbolsForScan, toMarketGroup, DEFAULT_MARKET_GROUP };

export const SIDE_NONE = -1;
export const SIDE_EVEN = 0;
export const SIDE_ODD = 1;

export const PHASE_IDLE = 'idle';
export const PHASE_WAIT_OPPOSITE = 'wait_opposite';
export const PHASE_TRADING = 'trading';
export const PHASE_RECOVERY = 'recovery';

export const DEFAULT_LOOKBACK = 1000;
export const DEFAULT_MIN_DIGIT_PCT = 10.4;
export const DEFAULT_MIN_HOT_DIGITS = 3;
export const DEFAULT_OPPOSITE_STREAK = 3;
export const DEFAULT_MAX_TRADES = 5;
export const DEFAULT_MARTINGALE_MULTIPLIER = 2;

export const EVEN_DIGITS = [0, 2, 4, 6, 8];
export const ODD_DIGITS = [1, 3, 5, 7, 9];

const toNum = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toInt = (value, fallback, min = null, max = null) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (min !== null && n < min) {
        n = min;
    }
    if (max !== null && n > max) {
        n = max;
    }
    return n;
};

const toDigit = value => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
};

export const isEvenDigit = digit => {
    const d = toDigit(digit);
    return d !== null && d % 2 === 0;
};

export const isOddDigit = digit => {
    const d = toDigit(digit);
    return d !== null && d % 2 === 1;
};

export const sideToCode = side => {
    if (side === 'even') {
        return SIDE_EVEN;
    }
    if (side === 'odd') {
        return SIDE_ODD;
    }
    return SIDE_NONE;
};

export const codeToSide = code => {
    if (code === SIDE_EVEN || code === 0) {
        return 'even';
    }
    if (code === SIDE_ODD || code === 1) {
        return 'odd';
    }
    return null;
};

export const oppositeSide = side => {
    if (side === 'even') {
        return 'odd';
    }
    if (side === 'odd') {
        return 'even';
    }
    return null;
};

export const normalizeOddEvenHotDigitOptions = (options = {}) => ({
    lookback: toInt(options.lookback, DEFAULT_LOOKBACK, 50, 1000),
    min_digit_pct: Math.max(0.1, toNum(options.min_digit_pct, DEFAULT_MIN_DIGIT_PCT)),
    min_hot_digits: toInt(options.min_hot_digits, DEFAULT_MIN_HOT_DIGITS, 1, 5),
    opposite_streak: toInt(options.opposite_streak, DEFAULT_OPPOSITE_STREAK, 1, 20),
    max_trades: toInt(options.max_trades, DEFAULT_MAX_TRADES, 1, 20),
    martingale_multiplier: Math.max(1, toNum(options.martingale_multiplier, DEFAULT_MARTINGALE_MULTIPLIER)),
    market_group: toMarketGroup(options.market_group),
    journal_enabled:
        options.journal_enabled === undefined
            ? true
            : options.journal_enabled === true ||
              options.journal_enabled === 1 ||
              options.journal_enabled === 'TRUE' ||
              options.journal_enabled === 'true',
    switch_symbol:
        options.switch_symbol === undefined
            ? true
            : options.switch_symbol === true ||
              options.switch_symbol === 1 ||
              options.switch_symbol === 'TRUE' ||
              options.switch_symbol === 'true',
});

/**
 * % occurrence of digits 0–9 over the newest `lookback` samples.
 * @param {Array<number|string>} digits
 * @param {number} lookback
 */
export const computeDigitPercentages = (digits, lookback = DEFAULT_LOOKBACK) => {
    const window = Math.max(1, Math.min(1000, Math.floor(Number(lookback)) || DEFAULT_LOOKBACK));
    const counts = Array(10).fill(0);
    const slice = Array.isArray(digits) ? digits.slice(-window) : [];
    let total = 0;

    for (let i = 0; i < slice.length; i++) {
        const d = toDigit(slice[i]);
        if (d === null) {
            continue;
        }
        counts[d] += 1;
        total += 1;
    }

    const percentages = counts.map(c => (total > 0 ? (c / total) * 100 : 0));
    return { counts, percentages, total, window };
};

/**
 * Find hot odd/even digit groups meeting the threshold.
 * @param {number[]} percentages length 10
 * @param {number} min_digit_pct
 * @param {number} min_hot_digits
 */
export const findHotParitySignal = (percentages, min_digit_pct = DEFAULT_MIN_DIGIT_PCT, min_hot_digits = DEFAULT_MIN_HOT_DIGITS) => {
    const pcts = Array.isArray(percentages) ? percentages : [];
    const threshold = Math.max(0, Number(min_digit_pct) || DEFAULT_MIN_DIGIT_PCT);
    const need = Math.max(1, Math.floor(Number(min_hot_digits)) || DEFAULT_MIN_HOT_DIGITS);

    const hot_even = EVEN_DIGITS.filter(d => Number(pcts[d]) >= threshold);
    const hot_odd = ODD_DIGITS.filter(d => Number(pcts[d]) >= threshold);

    const even_sum = hot_even.reduce((s, d) => s + Number(pcts[d] || 0), 0);
    const odd_sum = hot_odd.reduce((s, d) => s + Number(pcts[d] || 0), 0);

    const even_ok = hot_even.length >= need;
    const odd_ok = hot_odd.length >= need;

    let side = null;
    let hot_digits = [];
    let score = 0;

    if (even_ok && odd_ok) {
        // Stronger side wins; tie → higher % sum; still tied → more hot digits.
        const even_score = hot_even.length * 1000 + even_sum;
        const odd_score = hot_odd.length * 1000 + odd_sum;
        if (odd_score > even_score) {
            side = 'odd';
            hot_digits = hot_odd;
            score = odd_score;
        } else {
            side = 'even';
            hot_digits = hot_even;
            score = even_score;
        }
    } else if (odd_ok) {
        side = 'odd';
        hot_digits = hot_odd;
        score = hot_odd.length * 1000 + odd_sum;
    } else if (even_ok) {
        side = 'even';
        hot_digits = hot_even;
        score = hot_even.length * 1000 + even_sum;
    }

    return {
        matched: Boolean(side),
        side,
        hot_digits,
        hot_even,
        hot_odd,
        score,
        even_sum,
        odd_sum,
        reason: side
            ? `${side}_hot_${hot_digits.join(',')}`
            : `no_hot_group_even${hot_even.length}_odd${hot_odd.length}`,
    };
};

/**
 * Evaluate one symbol's digit window for a hot-parity signal.
 */
export const evaluateSymbolOddEvenHotDigit = (symbol, digits, options = {}) => {
    const opts = normalizeOddEvenHotDigitOptions(options);
    const stats = computeDigitPercentages(digits, opts.lookback);
    const signal = findHotParitySignal(stats.percentages, opts.min_digit_pct, opts.min_hot_digits);
    const ready = stats.total >= opts.lookback;

    return {
        symbol: String(symbol || ''),
        ready,
        total: stats.total,
        lookback: opts.lookback,
        percentages: stats.percentages,
        counts: stats.counts,
        ...signal,
        matched: Boolean(signal.matched && ready),
        reason: !ready
            ? `insufficient_history_${stats.total}/${opts.lookback}`
            : signal.reason,
    };
};

/**
 * Pick the best qualifying evaluation (highest score).
 */
export const pickBestHotDigitMatch = evaluations => {
    if (!Array.isArray(evaluations)) {
        return null;
    }
    let best = null;
    for (let i = 0; i < evaluations.length; i++) {
        const item = evaluations[i];
        if (!item?.matched || !item.side) {
            continue;
        }
        if (!best || item.score > best.score) {
            best = item;
        }
    }
    return best;
};

export const createOddEvenHotDigitState = () => ({
    phase: PHASE_IDLE,
    favored: null,
    symbol: '',
    opposite_count: 0,
    trades_done: 0,
    last_was_loss: false,
    trade_committed: false,
    signal_issued_at: 0,
    last_handled_contract_id: null,
    last_tip_key: null,
    cycle_hot_digits: [],
    stake_multiplier: 1,
});

export const resetOddEvenHotDigitState = (state = null) => {
    const tracker = state || createOddEvenHotDigitState();
    tracker.phase = PHASE_IDLE;
    tracker.favored = null;
    tracker.symbol = '';
    tracker.opposite_count = 0;
    tracker.trades_done = 0;
    tracker.last_was_loss = false;
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.last_handled_contract_id = null;
    tracker.last_tip_key = null;
    tracker.cycle_hot_digits = [];
    tracker.stake_multiplier = 1;
    return tracker;
};

const armTrade = (state, multiplier = 1) => {
    state.trade_committed = true;
    state.signal_issued_at = Date.now();
    state.stake_multiplier = multiplier;
};

export const releaseStaleOddEvenCommit = (state, max_age_ms = 20000) => {
    const tracker = state || createOddEvenHotDigitState();
    if (!tracker.trade_committed) {
        return false;
    }
    const issued = Number(tracker.signal_issued_at) || 0;
    if (!issued || Date.now() - issued < max_age_ms) {
        return false;
    }
    tracker.trade_committed = false;
    tracker.stake_multiplier = tracker.phase === PHASE_RECOVERY ? tracker.stake_multiplier : 1;
    return true;
};

/**
 * Apply settled contract result to the cycle state machine.
 */
export const applyOddEvenHotDigitTradeResult = (state, args = {}) => {
    const tracker = state || createOddEvenHotDigitState();
    const contract_id =
        args.contract_id === undefined || args.contract_id === null ? null : String(args.contract_id);
    if (contract_id && tracker.last_handled_contract_id === contract_id) {
        return tracker;
    }
    if (contract_id) {
        tracker.last_handled_contract_id = contract_id;
    }

    if (!tracker.trade_committed && tracker.phase !== PHASE_TRADING && tracker.phase !== PHASE_RECOVERY) {
        return tracker;
    }

    tracker.trade_committed = false;
    const is_loss = args.is_loss === true || args.is_loss === 1;
    const max_trades = toInt(args.max_trades, DEFAULT_MAX_TRADES, 1, 20);

    if (tracker.phase === PHASE_RECOVERY) {
        // Stop after recovery whether win or loss — rescan next.
        resetOddEvenHotDigitState(tracker);
        return tracker;
    }

    if (tracker.phase === PHASE_TRADING) {
        tracker.trades_done += 1;
        tracker.last_was_loss = is_loss;
        tracker.stake_multiplier = 1;

        if (tracker.trades_done >= max_trades) {
            if (tracker.last_was_loss) {
                tracker.phase = PHASE_RECOVERY;
            } else {
                resetOddEvenHotDigitState(tracker);
            }
        }
    }

    return tracker;
};

/**
 * Advance opposite-parity streak on a new tip. Returns true when streak met.
 */
export const advanceOppositeStreak = (state, digit, tip_key, opposite_needed) => {
    const tracker = state || createOddEvenHotDigitState();
    if (tracker.phase !== PHASE_WAIT_OPPOSITE || !tracker.favored) {
        return false;
    }

    const key = tip_key == null ? null : String(tip_key);
    if (key && tracker.last_tip_key === key) {
        return tracker.opposite_count >= opposite_needed;
    }
    if (key) {
        tracker.last_tip_key = key;
    }

    const d = toDigit(digit);
    if (d === null) {
        return false;
    }

    const want_opposite = oppositeSide(tracker.favored);
    const is_opposite =
        (want_opposite === 'even' && isEvenDigit(d)) || (want_opposite === 'odd' && isOddDigit(d));

    if (is_opposite) {
        tracker.opposite_count += 1;
    } else {
        tracker.opposite_count = 0;
    }

    if (tracker.opposite_count >= opposite_needed) {
        tracker.phase = PHASE_TRADING;
        tracker.trades_done = 0;
        tracker.last_was_loss = false;
        tracker.stake_multiplier = 1;
        return true;
    }
    return false;
};

/**
 * Start a new wait cycle from a scan match.
 */
export const armOddEvenHotDigitCycle = (state, match) => {
    const tracker = state || createOddEvenHotDigitState();
    if (!match?.matched || !match.side) {
        return tracker;
    }
    tracker.phase = PHASE_WAIT_OPPOSITE;
    tracker.favored = match.side;
    tracker.symbol = String(match.symbol || '');
    tracker.opposite_count = 0;
    tracker.trades_done = 0;
    tracker.last_was_loss = false;
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.last_tip_key = null;
    tracker.cycle_hot_digits = Array.isArray(match.hot_digits) ? [...match.hot_digits] : [];
    tracker.stake_multiplier = 1;
    return tracker;
};

/**
 * Decide what to return this tick given runtime phase (after settlement handling).
 * Caller supplies latest digit/tip for wait_opposite advancement.
 */
export const decideOddEvenHotDigitAction = (state, args = {}) => {
    const tracker = state || createOddEvenHotDigitState();
    const opposite_needed = toInt(args.opposite_streak, DEFAULT_OPPOSITE_STREAK, 1, 20);
    const martingale = Math.max(1, toNum(args.martingale_multiplier, DEFAULT_MARTINGALE_MULTIPLIER));

    if (tracker.trade_committed) {
        return {
            side_code: SIDE_NONE,
            side: null,
            should_trade: false,
            stake_multiplier: tracker.stake_multiplier || 1,
            phase: tracker.phase,
            reason: 'awaiting_settlement',
        };
    }

    if (tracker.phase === PHASE_WAIT_OPPOSITE) {
        advanceOppositeStreak(tracker, args.digit, args.tip_key, opposite_needed);
        if (tracker.phase === PHASE_WAIT_OPPOSITE) {
            return {
                side_code: SIDE_NONE,
                side: null,
                should_trade: false,
                stake_multiplier: 1,
                phase: tracker.phase,
                reason: `wait_opposite_${tracker.opposite_count}/${opposite_needed}`,
                favored: tracker.favored,
                opposite_count: tracker.opposite_count,
            };
        }
        // fell through into trading on this tip — take first trade now
    }

    if (tracker.phase === PHASE_RECOVERY) {
        armTrade(tracker, martingale);
        return {
            side_code: sideToCode(tracker.favored),
            side: tracker.favored,
            should_trade: true,
            stake_multiplier: martingale,
            phase: PHASE_RECOVERY,
            reason: `recovery_x${martingale}`,
            favored: tracker.favored,
            trades_done: tracker.trades_done,
        };
    }

    if (tracker.phase === PHASE_TRADING && tracker.favored) {
        armTrade(tracker, 1);
        return {
            side_code: sideToCode(tracker.favored),
            side: tracker.favored,
            should_trade: true,
            stake_multiplier: 1,
            phase: PHASE_TRADING,
            reason: `trade_${tracker.trades_done + 1}`,
            favored: tracker.favored,
            trades_done: tracker.trades_done,
        };
    }

    return {
        side_code: SIDE_NONE,
        side: null,
        should_trade: false,
        stake_multiplier: 1,
        phase: tracker.phase,
        reason: 'idle',
    };
};

export const buildOddEvenHotDigitResult = ({
    action = {},
    match = null,
    evaluations = [],
    market_group = DEFAULT_MARKET_GROUP,
    active_symbol = '',
    switched = false,
    journal_enabled = true,
    state = null,
} = {}) => {
    const tracker = state || createOddEvenHotDigitState();
    const side_code = action.should_trade ? action.side_code : SIDE_NONE;
    const journal_messages = [];

    if (journal_enabled) {
        if (action.should_trade) {
            journal_messages.push({
                className: 'success',
                message: `Odd/Even Hot: ${String(action.side || '').toUpperCase()} trade (${action.reason}) stake×${action.stake_multiplier}${
                    switched ? ' (switched market)' : ''
                }`,
            });
        } else if (tracker.phase === PHASE_WAIT_OPPOSITE) {
            journal_messages.push({
                className: 'info',
                message: `Odd/Even Hot: waiting ${oppositeSide(tracker.favored)} streak ${tracker.opposite_count} — favor ${tracker.favored} on ${tracker.symbol}`,
            });
        } else if (match?.matched) {
            journal_messages.push({
                className: 'success',
                message: `Odd/Even Hot: locked ${match.side} on ${match.symbol} hot[${(match.hot_digits || []).join(',')}] — waiting opposite streak`,
            });
        } else {
            const sample = (evaluations || [])
                .slice(0, 4)
                .map(e => `${e.symbol}:${e.reason || '-'}`)
                .join(' | ');
            journal_messages.push({
                className: 'info',
                message: `Odd/Even Hot: scanning [${toMarketGroup(market_group)}]${sample ? ` — ${sample}` : ''}`,
            });
        }
    }

    return {
        prediction: side_code,
        side_code,
        side: action.side || null,
        should_trade: Boolean(action.should_trade),
        stake_multiplier: action.stake_multiplier || 1,
        phase: tracker.phase,
        favored: tracker.favored,
        symbol: tracker.symbol || match?.symbol || active_symbol || '',
        market_group: toMarketGroup(market_group),
        hot_digits: tracker.cycle_hot_digits.length
            ? tracker.cycle_hot_digits
            : match?.hot_digits || [],
        trades_done: tracker.trades_done,
        opposite_count: tracker.opposite_count,
        switched: Boolean(switched),
        evaluations,
        reason: action.reason || 'idle',
        journal_messages,
    };
};
