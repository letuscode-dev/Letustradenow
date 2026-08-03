/**
 * Sequential Digit Differs — multi-symbol scanner.
 *
 * When the last 3 digits form a consecutive run:
 *   Ascending  (e.g. 1 → 2 → 3) → Digit Differs barrier = previous_digit_2 (1)
 *   Descending (e.g. 8 → 7 → 6) → Digit Differs barrier = previous_digit_2 (8)
 *
 * Scans a configured volatility group (1s / standard / all) or an explicit symbol list.
 */

export const MARKET_GROUP_1S = '1S';
export const MARKET_GROUP_STANDARD = 'STANDARD';
export const MARKET_GROUP_ALL = 'ALL';

/** Selectable 1-second volatility indices (matches SYMBOL_OPTIONS.random_index). */
export const VOLATILITY_1S_SYMBOLS = ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'];

/** Selectable standard volatility indices. */
export const VOLATILITY_STANDARD_SYMBOLS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];

export const DEFAULT_MARKET_GROUP = MARKET_GROUP_1S;
export const MIN_DIGITS_REQUIRED = 3;
/** Default: after a loss, resume scanning (no same-digit retry). */
export const DEFAULT_IMMEDIATE_LOSS_RETRY = false;

/**
 * Session state for sequential Differs (immediate loss-retry + one-shot arming).
 * @returns {{
 *   pending_retry_digit: number|null,
 *   last_barrier: number|null,
 *   just_did_immediate_retry: boolean,
 *   armed_prediction: number,
 *   last_handled_contract_id: string|null,
 * }}
 */
export const createSequentialDiffersRuntimeState = () => ({
    pending_retry_digit: null,
    last_barrier: null,
    just_did_immediate_retry: false,
    armed_prediction: -1,
    trade_committed: false,
    signal_issued_at: 0,
    last_handled_contract_id: null,
});

export const resetSequentialDiffersRuntimeState = (state = null) => {
    const tracker = state || createSequentialDiffersRuntimeState();
    tracker.pending_retry_digit = null;
    tracker.last_barrier = null;
    tracker.just_did_immediate_retry = false;
    tracker.armed_prediction = -1;
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.last_handled_contract_id = null;
    return tracker;
};

const toDigitOrNull = value => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
};

/**
 * Record win/loss. On loss (and option on), queue one Differ of the same barrier
 * with no analysis — but not if that loss was already the immediate retry itself.
 *
 * @param {ReturnType<typeof createSequentialDiffersRuntimeState>} state
 * @param {{ is_loss: boolean, immediate_loss_retry?: boolean, contract_id?: string|null }} args
 */
export const applySequentialDiffersTradeResult = (state, args = {}) => {
    const tracker = state || createSequentialDiffersRuntimeState();
    const contract_id =
        args.contract_id === undefined || args.contract_id === null ? null : String(args.contract_id);
    if (contract_id && tracker.last_handled_contract_id === contract_id) {
        return tracker;
    }
    if (contract_id) {
        tracker.last_handled_contract_id = contract_id;
    }

    tracker.armed_prediction = -1;
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    const enabled = toBool(args.immediate_loss_retry, DEFAULT_IMMEDIATE_LOSS_RETRY);
    const is_loss = args.is_loss === true || args.is_loss === 1;

    // Prefer barrier from the settled contract when present (source of truth).
    const contract_barrier = toDigitOrNull(args.barrier);
    if (contract_barrier !== null) {
        tracker.last_barrier = contract_barrier;
    }

    if (!is_loss) {
        tracker.pending_retry_digit = null;
        tracker.just_did_immediate_retry = false;
        return tracker;
    }

    if (
        enabled &&
        !tracker.just_did_immediate_retry &&
        toDigitOrNull(tracker.last_barrier) !== null
    ) {
        tracker.pending_retry_digit = tracker.last_barrier;
        tracker.just_did_immediate_retry = false;
    } else {
        // Loss was the one-shot retry (or option off) — resume analysis next.
        tracker.pending_retry_digit = null;
        tracker.just_did_immediate_retry = false;
    }
    return tracker;
};

/**
 * If a one-shot loss retry is pending, consume it and arm that digit.
 * @param {ReturnType<typeof createSequentialDiffersRuntimeState>} state
 * @returns {number|null}
 */
export const consumeImmediateLossRetry = state => {
    const tracker = state || createSequentialDiffersRuntimeState();
    const digit = toDigitOrNull(tracker.pending_retry_digit);
    if (digit === null) {
        return null;
    }
    tracker.pending_retry_digit = null;
    tracker.just_did_immediate_retry = true;
    tracker.last_barrier = digit;
    tracker.armed_prediction = digit;
    tracker.trade_committed = true;
    tracker.signal_issued_at = Date.now();
    return digit;
};

/**
 * Remember an analysis (or retry) barrier that is about to be purchased.
 * @param {ReturnType<typeof createSequentialDiffersRuntimeState>} state
 * @param {number} barrier
 * @param {{ from_immediate_retry?: boolean }} [opts]
 */
export const armSequentialDiffersPrediction = (state, barrier, opts = {}) => {
    const tracker = state || createSequentialDiffersRuntimeState();
    const digit = toDigitOrNull(barrier);
    if (digit === null) {
        return tracker;
    }
    tracker.last_barrier = digit;
    tracker.armed_prediction = digit;
    tracker.trade_committed = true;
    tracker.signal_issued_at = Date.now();
    if (!opts.from_immediate_retry) {
        tracker.just_did_immediate_retry = false;
    }
    return tracker;
};

/** Release a stuck commit if settlement never arrived (proposal/purchase failure). */
export const releaseStaleSequentialCommit = (state, max_age_ms = 20000) => {
    const tracker = state || createSequentialDiffersRuntimeState();
    if (!tracker.trade_committed) {
        return false;
    }
    const issued = Number(tracker.signal_issued_at) || 0;
    if (!issued || Date.now() - issued < max_age_ms) {
        return false;
    }
    tracker.trade_committed = false;
    tracker.armed_prediction = -1;
    return true;
};

const toDigit = value => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
};

const toBool = (value, default_value = true) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

/**
 * @param {unknown} value
 * @returns {'1S'|'STANDARD'|'ALL'|string}
 */
export const toMarketGroup = value => {
    const normalized = String(value || DEFAULT_MARKET_GROUP)
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    if (
        normalized === '1S' ||
        normalized === '1S_VOLATILITY' ||
        normalized === 'VOLATILITY_1S' ||
        normalized === 'ONE_SECOND' ||
        normalized === '1_SECOND'
    ) {
        return MARKET_GROUP_1S;
    }
    if (
        normalized === 'STANDARD' ||
        normalized === 'STD' ||
        normalized === 'VOLATILITY_STANDARD' ||
        normalized === 'STANDARD_VOLATILITY'
    ) {
        return MARKET_GROUP_STANDARD;
    }
    if (normalized === 'ALL' || normalized === 'ALL_VOLATILITY' || normalized === 'BOTH') {
        return MARKET_GROUP_ALL;
    }
    return normalized;
};

/**
 * Parse an optional custom symbol list (array or comma/space-separated string).
 * @param {unknown} value
 * @returns {string[]}
 */
export const parseSymbolList = value => {
    if (Array.isArray(value)) {
        return [...new Set(value.map(s => String(s || '').trim()).filter(Boolean))];
    }
    if (typeof value === 'string' && value.trim()) {
        return [
            ...new Set(
                value
                    .split(/[,;\s]+/)
                    .map(s => s.trim())
                    .filter(Boolean)
            ),
        ];
    }
    return [];
};

/**
 * Resolve symbols to scan from market group and/or explicit list.
 * @param {{ market_group?: string, symbols?: unknown }} options
 * @returns {string[]}
 */
export const resolveScanSymbols = (options = {}) => {
    const custom = parseSymbolList(options.symbols);
    if (custom.length) {
        return [...new Set(custom)];
    }
    const group = toMarketGroup(options.market_group);
    if (group === MARKET_GROUP_STANDARD) {
        return [...VOLATILITY_STANDARD_SYMBOLS];
    }
    if (group === MARKET_GROUP_ALL) {
        return [...VOLATILITY_1S_SYMBOLS, ...VOLATILITY_STANDARD_SYMBOLS];
    }
    return [...VOLATILITY_1S_SYMBOLS];
};

/**
 * Detect ascending/descending consecutive last-3 sequence and Differs barrier.
 *
 * Digits are oldest → newest. Uses the newest three when more are provided.
 *
 * @param {Array<number|string>} digits
 * @returns {{
 *   matched: boolean,
 *   direction: 'asc'|'desc'|null,
 *   barrier: number,
 *   sequence: number[],
 *   previous_digit_2: number|null,
 *   previous_digit_1: number|null,
 *   current_digit: number|null,
 *   reason: string,
 * }|null}
 */
export const detectSequentialDigitSignal = digits => {
    if (!Array.isArray(digits) || digits.length < MIN_DIGITS_REQUIRED) {
        return {
            matched: false,
            direction: null,
            barrier: -1,
            sequence: [],
            previous_digit_2: null,
            previous_digit_1: null,
            current_digit: null,
            reason: 'insufficient_digits',
        };
    }

    const cleaned = [];
    for (let i = 0; i < digits.length; i++) {
        const d = toDigit(digits[i]);
        if (d !== null) {
            cleaned.push(d);
        }
    }

    if (cleaned.length < MIN_DIGITS_REQUIRED) {
        return {
            matched: false,
            direction: null,
            barrier: -1,
            sequence: [],
            previous_digit_2: null,
            previous_digit_1: null,
            current_digit: null,
            reason: 'insufficient_digits',
        };
    }

    const previous_digit_2 = cleaned[cleaned.length - 3];
    const previous_digit_1 = cleaned[cleaned.length - 2];
    const current_digit = cleaned[cleaned.length - 1];
    const sequence = [previous_digit_2, previous_digit_1, current_digit];

    // Ascending: …, n, n+1, n+2 → Differ n (previous_digit_2)
    if (previous_digit_1 === previous_digit_2 + 1 && current_digit === previous_digit_1 + 1) {
        const barrier = previous_digit_2;
        return {
            matched: true,
            direction: 'asc',
            barrier,
            sequence,
            previous_digit_2,
            previous_digit_1,
            current_digit,
            reason: `asc_${sequence.join('→')}→${barrier}`,
        };
    }

    // Descending: …, n, n-1, n-2 → Differ n (previous_digit_2)
    if (previous_digit_1 === previous_digit_2 - 1 && current_digit === previous_digit_1 - 1) {
        const barrier = previous_digit_2;
        return {
            matched: true,
            direction: 'desc',
            barrier,
            sequence,
            previous_digit_2,
            previous_digit_1,
            current_digit,
            reason: `desc_${sequence.join('→')}→${barrier}`,
        };
    }

    return {
        matched: false,
        direction: null,
        barrier: -1,
        sequence,
        previous_digit_2,
        previous_digit_1,
        current_digit,
        reason: `no_sequence_${sequence.join(',')}`,
    };
};

/**
 * Order symbols so the active trading symbol is scanned first.
 * @param {string[]} symbols
 * @param {string} [active_symbol]
 * @returns {string[]}
 */
export const orderSymbolsForScan = (symbols, active_symbol) => {
    const list = Array.isArray(symbols) ? [...new Set(symbols.filter(Boolean))] : [];
    if (!active_symbol || !list.includes(active_symbol)) {
        return list;
    }
    return [active_symbol, ...list.filter(s => s !== active_symbol)];
};

/**
 * Evaluate a single symbol's digit window.
 * @param {string} symbol
 * @param {Array<number|string>} digits
 * @returns {object}
 */
export const evaluateSymbolSequentialSignal = (symbol, digits) => {
    const signal = detectSequentialDigitSignal(digits);
    return {
        symbol: String(symbol || ''),
        digits: Array.isArray(digits) ? digits.slice(-MIN_DIGITS_REQUIRED) : [],
        ...signal,
    };
};

/**
 * Pick the first matching scan result from ordered symbol evaluations.
 * @param {Array<object>} evaluations
 * @returns {object|null}
 */
export const pickFirstMatch = evaluations => {
    if (!Array.isArray(evaluations)) {
        return null;
    }
    return evaluations.find(item => item && item.matched && item.barrier >= 0 && item.barrier <= 9) || null;
};

/**
 * Stable id for a tradeable tip — one purchase per key until the tip advances.
 * @param {object|null|undefined} match
 * @param {number|string|null|undefined} tip_epoch
 * @returns {string|null}
 */
export const makeSignalKey = (match, tip_epoch) => {
    if (!match || !match.matched || !Array.isArray(match.sequence) || match.sequence.length < 3) {
        return null;
    }
    const epoch =
        tip_epoch === undefined || tip_epoch === null || tip_epoch === ''
            ? ''
            : String(tip_epoch);
    return `${match.symbol}|${match.sequence.join(',')}→${match.barrier}|e:${epoch}`;
};

/**
 * True when this exact tip was already used for a trade.
 * @param {object|null|undefined} match
 * @param {number|string|null|undefined} tip_epoch
 * @param {string|null|undefined} consumed_key
 */
export const isSignalAlreadyConsumed = (match, tip_epoch, consumed_key) => {
    const key = makeSignalKey(match, tip_epoch);
    return Boolean(key && consumed_key && key === consumed_key);
};

/**
 * Build the public scan result for BotInterface / Blockly.
 * @param {{
 *   market_group?: string,
 *   symbols?: unknown,
 *   active_symbol?: string,
 *   journal_enabled?: boolean,
 *   evaluations?: object[],
 *   match?: object|null,
 *   switched?: boolean,
 *   skipped_consumed?: boolean,
 * }} args
 */
export const buildSequentialScanResult = ({
    market_group = DEFAULT_MARKET_GROUP,
    symbols,
    active_symbol = '',
    journal_enabled = true,
    evaluations = [],
    match = null,
    switched = false,
    skipped_consumed = false,
} = {}) => {
    const group = toMarketGroup(market_group);
    const scanned = Array.isArray(evaluations) ? evaluations : [];
    const hit = !skipped_consumed && match && match.matched ? match : null;
    const prediction = hit ? hit.barrier : -1;
    const journal_messages = [];

    if (toBool(journal_enabled, true)) {
        if (hit) {
            journal_messages.push({
                className: 'success',
                message: `Seq Differs ${hit.symbol}: [${hit.sequence.join('→')}] ${
                    hit.direction === 'asc' ? 'ascending' : 'descending'
                } → Differ ${hit.barrier}${switched ? ' (switched market)' : ''}`,
            });
        } else if (skipped_consumed && match?.matched) {
            journal_messages.push({
                className: 'info',
                message: `Seq Differs ${match.symbol}: [${match.sequence.join('→')}] already traded this tip — waiting for next tick`,
            });
        } else {
            const sample = scanned
                .slice(0, 5)
                .map(e => `${e.symbol}:${(e.sequence || []).join(',') || '-'}`)
                .join(' | ');
            journal_messages.push({
                className: 'info',
                message: `Seq Differs: no consecutive run on ${scanned.length} symbol(s) [${group}]${
                    sample ? ` — ${sample}` : ''
                }`,
            });
        }
    }

    return {
        prediction,
        barrier: prediction,
        matched: Boolean(hit),
        direction: hit ? hit.direction : null,
        sequence: hit ? hit.sequence : [],
        symbol: hit ? hit.symbol : active_symbol || '',
        market_group: group,
        symbols_scanned: scanned.map(e => e.symbol),
        evaluations: scanned,
        switched: Boolean(switched),
        skipped_consumed: Boolean(skipped_consumed),
        reason: hit ? hit.reason : skipped_consumed ? 'signal_consumed' : 'no_match',
        journal_messages,
    };
};
