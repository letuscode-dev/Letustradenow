/**
 * Parity-run Differs — multi-symbol scanner.
 *
 * When the last `run_length` digits (default 6) are all even or all odd:
 *   → Digit Differs barrier = the oldest of those digits (the Nth back / "last 6th").
 *
 * Scans a configured volatility group (1s / standard / all) or an explicit symbol list.
 */

import {
    MARKET_GROUP_1S,
    MARKET_GROUP_ALL,
    MARKET_GROUP_STANDARD,
    DEFAULT_MARKET_GROUP,
    VOLATILITY_1S_SYMBOLS,
    VOLATILITY_STANDARD_SYMBOLS,
    orderSymbolsForScan,
    resolveScanSymbols,
    toMarketGroup,
} from './sequential-digit-differs';

export {
    MARKET_GROUP_1S,
    MARKET_GROUP_ALL,
    MARKET_GROUP_STANDARD,
    DEFAULT_MARKET_GROUP,
    VOLATILITY_1S_SYMBOLS,
    VOLATILITY_STANDARD_SYMBOLS,
    orderSymbolsForScan,
    resolveScanSymbols,
    toMarketGroup,
};

export const DEFAULT_RUN_LENGTH = 6;
export const MIN_RUN_LENGTH = 2;
export const MAX_RUN_LENGTH = 20;

const toDigit = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return null;
    }
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) > 1e-9 || rounded < 0 || rounded > 9) {
        return null;
    }
    return rounded;
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

const toBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

export const normalizeParityRunOptions = (options = {}) => ({
    run_length: toInt(options.run_length, DEFAULT_RUN_LENGTH, MIN_RUN_LENGTH, MAX_RUN_LENGTH),
    market_group: toMarketGroup(options.market_group),
    journal_enabled: toBool(options.journal_enabled, true),
    switch_symbol: toBool(options.switch_symbol, true),
});

export const isEvenDigit = d => {
    const n = toDigit(d);
    return n !== null && n % 2 === 0;
};

export const isOddDigit = d => {
    const n = toDigit(d);
    return n !== null && n % 2 === 1;
};

/**
 * Detect last-N all-even or all-odd run → Differ the oldest of those N digits.
 *
 * Digits are oldest → newest.
 */
export const detectParityRunSignal = (digits, run_length = DEFAULT_RUN_LENGTH) => {
    const length = toInt(run_length, DEFAULT_RUN_LENGTH, MIN_RUN_LENGTH, MAX_RUN_LENGTH);
    const cleaned = [];
    const list = Array.isArray(digits) ? digits : [];
    for (let i = 0; i < list.length; i++) {
        const d = toDigit(list[i]);
        if (d !== null) {
            cleaned.push(d);
        }
    }

    const base = {
        matched: false,
        barrier: -1,
        prediction: -1,
        parity: null,
        sequence: [],
        run_length: length,
        reason: 'no_signal',
    };

    if (cleaned.length < length) {
        return { ...base, reason: `insufficient_digits_${cleaned.length}/${length}` };
    }

    const sequence = cleaned.slice(cleaned.length - length);
    const all_even = sequence.every(isEvenDigit);
    const all_odd = sequence.every(isOddDigit);

    if (!all_even && !all_odd) {
        return {
            ...base,
            sequence,
            reason: `mixed_parity_${sequence.join(',')}`,
        };
    }

    const parity = all_even ? 'even' : 'odd';
    const barrier = sequence[0]; // oldest of the last N ("last 6th")

    return {
        matched: true,
        barrier,
        prediction: barrier,
        parity,
        sequence,
        run_length: length,
        reason: `${parity}_run_${sequence.join('→')}→differ_${barrier}`,
    };
};

export const evaluateSymbolParityRunSignal = (symbol, digits, run_length = DEFAULT_RUN_LENGTH) => {
    const signal = detectParityRunSignal(digits, run_length);
    return {
        symbol: symbol || '',
        ...signal,
    };
};

export const pickFirstParityRunMatch = evaluations => {
    const list = Array.isArray(evaluations) ? evaluations : [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item?.matched && item.barrier >= 0 && item.barrier <= 9) {
            return item;
        }
    }
    return null;
};

export const makeParityRunSignalKey = (match, tip_epoch) => {
    if (!match?.matched || match.barrier < 0) {
        return null;
    }
    const epoch =
        tip_epoch === undefined || tip_epoch === null || tip_epoch === ''
            ? ''
            : String(tip_epoch);
    return `${match.symbol}|${match.parity}|b:${match.barrier}|seq:${(match.sequence || []).join(',')}|e:${epoch}`;
};

export const isParityRunSignalConsumed = (match, tip_epoch, consumed_key) => {
    const key = makeParityRunSignalKey(match, tip_epoch);
    return Boolean(key && consumed_key && key === consumed_key);
};

export const createParityRunRuntimeState = () => ({
    trade_committed: false,
    signal_issued_at: 0,
    last_barrier: null,
    armed_prediction: -1,
    last_handled_contract_id: null,
});

export const resetParityRunRuntimeState = (state = null) => {
    const tracker = state || createParityRunRuntimeState();
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.last_barrier = null;
    tracker.armed_prediction = -1;
    tracker.last_handled_contract_id = null;
    return tracker;
};

export const armParityRunPrediction = (state, barrier) => {
    const tracker = state || createParityRunRuntimeState();
    const digit = toDigit(barrier);
    if (digit === null) {
        return tracker;
    }
    tracker.last_barrier = digit;
    tracker.armed_prediction = digit;
    tracker.trade_committed = true;
    tracker.signal_issued_at = Date.now();
    return tracker;
};

export const clearParityRunCommit = state => {
    const tracker = state || createParityRunRuntimeState();
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.armed_prediction = -1;
    return tracker;
};

export const applyParityRunSettlement = (state, contract_id) => {
    const tracker = state || createParityRunRuntimeState();
    const id =
        contract_id === undefined || contract_id === null || contract_id === ''
            ? null
            : String(contract_id);
    if (id && tracker.last_handled_contract_id === id) {
        return false;
    }
    if (id) {
        tracker.last_handled_contract_id = id;
    }
    clearParityRunCommit(tracker);
    return true;
};

export const releaseStaleParityRunCommit = (state, max_age_ms = 20000) => {
    const tracker = state || createParityRunRuntimeState();
    if (!tracker.trade_committed) {
        return false;
    }
    const issued = Number(tracker.signal_issued_at) || 0;
    if (!issued || Date.now() - issued < max_age_ms) {
        return false;
    }
    clearParityRunCommit(tracker);
    return true;
};

export const buildParityRunScanResult = ({
    market_group = DEFAULT_MARKET_GROUP,
    symbols = [],
    active_symbol = '',
    journal_enabled = true,
    evaluations = [],
    match = null,
    switched = false,
    skipped_consumed = false,
    run_length = DEFAULT_RUN_LENGTH,
} = {}) => {
    const hit = !skipped_consumed && match?.matched ? match : null;
    const prediction = hit ? hit.barrier : -1;
    const journal_messages = [];

    if (journal_enabled) {
        if (hit) {
            journal_messages.push({
                className: 'success',
                message: `Parity-run ${hit.parity} on ${hit.symbol}: [${(hit.sequence || []).join(',')}] → Differ ${hit.barrier}${
                    switched ? ' (switched)' : ''
                }`,
            });
        } else if (skipped_consumed && match?.matched) {
            journal_messages.push({
                className: 'info',
                message: `Parity-run: already traded this tip on ${match.symbol} — waiting`,
            });
        } else {
            const scanned = (evaluations || [])
                .map(e => `${e.symbol}:${e.reason || 'no'}`)
                .slice(0, 4)
                .join(' | ');
            journal_messages.push({
                className: 'info',
                message: `Parity-run: no ${run_length}-digit even/odd run (${scanned || 'empty'})`,
            });
        }
    }

    return {
        prediction,
        barrier: prediction,
        matched: Boolean(hit),
        parity: hit?.parity || null,
        sequence: hit?.sequence || [],
        symbol: hit?.symbol || active_symbol || '',
        market_group,
        symbols_scanned: symbols,
        evaluations,
        switched: Boolean(switched && hit),
        skipped_consumed: Boolean(skipped_consumed),
        run_length,
        reason: hit
            ? hit.reason
            : skipped_consumed
              ? 'signal_consumed'
              : 'no_parity_run',
        journal_messages,
    };
};
