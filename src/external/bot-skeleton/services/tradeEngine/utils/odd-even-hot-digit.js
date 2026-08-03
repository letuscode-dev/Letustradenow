/**
 * Hot Digit Differs → Differs coldest same-parity digit (single active market).
 *
 * On the selected symbol's lookback window:
 *   - Find the most-appearing odd digit and most-appearing even digit
 *   - parity 'even': tip = hottest even → Differ coldest even
 *   - parity 'odd':  tip = hottest odd  → Differ coldest odd
 *   - parity 'both': either of the above
 */

import {
    DEFAULT_MARKET_GROUP,
    orderSymbolsForScan,
    resolveScanSymbols,
    toMarketGroup,
} from './sequential-digit-differs';

export { resolveScanSymbols, orderSymbolsForScan, toMarketGroup, DEFAULT_MARKET_GROUP };

export const DEFAULT_LOOKBACK = 1000;
export const EVEN_DIGITS = [0, 2, 4, 6, 8];
export const ODD_DIGITS = [1, 3, 5, 7, 9];

const toDigit = value => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
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

export const toParityMode = value => {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (raw === 'even' || raw === 'odd') {
        return raw;
    }
    return 'both';
};

export const normalizeHotOddEvenDiffersOptions = (options = {}) => ({
    lookback: toInt(options.lookback, DEFAULT_LOOKBACK, 50, 1000),
    parity: toParityMode(options.parity),
    journal_enabled:
        options.journal_enabled === undefined
            ? true
            : options.journal_enabled === true ||
              options.journal_enabled === 1 ||
              options.journal_enabled === 'TRUE' ||
              options.journal_enabled === 'true',
});

/**
 * Count digits 0–9 over the newest `lookback` samples.
 * @param {Array<number|string>} digits
 * @param {number} lookback
 */
export const computeDigitCounts = (digits, lookback = DEFAULT_LOOKBACK) => {
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

    const last_digit = slice.length ? toDigit(slice[slice.length - 1]) : null;
    return { counts, total, window, last_digit };
};

/**
 * Most-appearing digit among `candidates`. Ties → lowest digit.
 * @param {number[]} counts
 * @param {number[]} candidates
 * @returns {{ digit: number|null, count: number }}
 */
export const pickHottestAmong = (counts, candidates) => {
    const list = Array.isArray(candidates) ? candidates : [];
    const c = Array.isArray(counts) ? counts : [];
    let best = null;
    let best_count = -1;
    for (let i = 0; i < list.length; i++) {
        const d = list[i];
        const n = Number(c[d]) || 0;
        if (n > best_count || (n === best_count && best !== null && d < best)) {
            best = d;
            best_count = n;
        } else if (best === null) {
            best = d;
            best_count = n;
        }
    }
    return { digit: best, count: best_count < 0 ? 0 : best_count };
};

/**
 * Least-appearing digit among `candidates` (optionally excluding one digit).
 * Ties → lowest digit.
 * @param {number[]} counts
 * @param {number[]} candidates
 * @param {number|null} [exclude]
 */
export const pickColdestAmong = (counts, candidates, exclude = null) => {
    const list = Array.isArray(candidates) ? candidates : [];
    const c = Array.isArray(counts) ? counts : [];
    let best = null;
    let best_count = Infinity;
    for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (exclude !== null && exclude !== undefined && d === exclude) {
            continue;
        }
        const n = Number.isFinite(Number(c[d])) ? Number(c[d]) : 0;
        if (n < best_count || (n === best_count && best !== null && d < best)) {
            best = d;
            best_count = n;
        } else if (best === null) {
            best = d;
            best_count = n;
        }
    }
    return {
        digit: best,
        count: best === null || !Number.isFinite(best_count) ? 0 : best_count,
    };
};

/**
 * Least-appearing digit 0–9. Ties → lowest digit.
 * @param {number[]} counts
 */
export const pickColdestDigit = counts => pickColdestAmong(counts, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

/**
 * Detect signal: tip is hot odd → Differ coldest odd; tip is hot even → Differ coldest even.
 * @param {Array} digits
 * @param {number} lookback
 * @param {'even'|'odd'|'both'} [parity='both']
 */
export const detectHotOddEvenDiffersSignal = (
    digits,
    lookback = DEFAULT_LOOKBACK,
    parity = 'both'
) => {
    const parity_mode = toParityMode(parity);
    const stats = computeDigitCounts(digits, lookback);
    const hot_odd = pickHottestAmong(stats.counts, ODD_DIGITS);
    const hot_even = pickHottestAmong(stats.counts, EVEN_DIGITS);
    const cold_odd = pickColdestAmong(stats.counts, ODD_DIGITS);
    const cold_even = pickColdestAmong(stats.counts, EVEN_DIGITS);
    const last = stats.last_digit;

    const base = {
        last_digit: last,
        hot_odd: hot_odd.digit,
        hot_odd_count: hot_odd.count,
        hot_even: hot_even.digit,
        hot_even_count: hot_even.count,
        cold_odd: cold_odd.digit,
        cold_even: cold_even.digit,
        cold_digit: null,
        cold_count: 0,
        counts: stats.counts,
        total: stats.total,
        lookback,
        parity: parity_mode,
        barrier: -1,
        matched: false,
        trigger: null,
        score: 0,
        reason: 'no_signal',
    };

    if (stats.total < lookback) {
        return {
            ...base,
            reason: `insufficient_history_${stats.total}/${lookback}`,
        };
    }

    if (last === null) {
        return { ...base, reason: 'invalid_digits' };
    }

    const is_hot_odd = last === hot_odd.digit;
    const is_hot_even = last === hot_even.digit;
    const allow_odd = parity_mode === 'both' || parity_mode === 'odd';
    const allow_even = parity_mode === 'both' || parity_mode === 'even';

    if (is_hot_odd && !allow_odd) {
        return {
            ...base,
            reason: `tip_${last}_hot_odd_skipped_parity_${parity_mode}`,
        };
    }
    if (is_hot_even && !allow_even) {
        return {
            ...base,
            reason: `tip_${last}_hot_even_skipped_parity_${parity_mode}`,
        };
    }
    if ((!is_hot_odd || !allow_odd) && (!is_hot_even || !allow_even)) {
        const wanted =
            parity_mode === 'odd'
                ? `hot_odd${hot_odd.digit}`
                : parity_mode === 'even'
                  ? `hot_even${hot_even.digit}`
                  : `hot_odd${hot_odd.digit}_even${hot_even.digit}`;
        return {
            ...base,
            reason: `tip_${last}_not_${wanted}`,
        };
    }

    // Prefer the parity mode when both tip matches somehow (shouldn't happen for one tip digit).
    const trigger = is_hot_odd && allow_odd ? 'odd' : 'even';
    const parity_digits = trigger === 'odd' ? ODD_DIGITS : EVEN_DIGITS;
    const cold = pickColdestAmong(stats.counts, parity_digits, last);
    if (cold.digit === null) {
        return {
            ...base,
            reason: `no_cold_${trigger}_excluding_${last}`,
        };
    }

    const hot_count = trigger === 'odd' ? hot_odd.count : hot_even.count;
    const score = hot_count - cold.count;

    return {
        ...base,
        matched: true,
        barrier: cold.digit,
        cold_digit: cold.digit,
        cold_count: cold.count,
        trigger,
        score,
        reason: `tip_${last}_hot_${trigger}_differ_cold_${trigger}_${cold.digit}`,
    };
};

export const evaluateSymbolHotOddEvenDiffers = (symbol, digits, options = {}) => {
    const opts = normalizeHotOddEvenDiffersOptions(options);
    const signal = detectHotOddEvenDiffersSignal(digits, opts.lookback, opts.parity);
    return {
        symbol: String(symbol || ''),
        ...signal,
    };
};

export const pickBestHotOddEvenDiffersMatch = evaluations => {
    if (!Array.isArray(evaluations)) {
        return null;
    }
    let best = null;
    for (let i = 0; i < evaluations.length; i++) {
        const item = evaluations[i];
        if (!item?.matched || item.barrier < 0 || item.barrier > 9) {
            continue;
        }
        if (!best || item.score > best.score) {
            best = item;
        }
    }
    return best;
};

export const makeHotOddEvenDiffersSignalKey = (match, tip_epoch) => {
    if (!match?.matched || match.barrier < 0) {
        return null;
    }
    const epoch =
        tip_epoch === undefined || tip_epoch === null || tip_epoch === ''
            ? ''
            : String(tip_epoch);
    return `${match.symbol}|tip:${match.last_digit}|diff:${match.barrier}|e:${epoch}`;
};

export const isHotOddEvenDiffersSignalConsumed = (match, tip_epoch, consumed_key) => {
    const key = makeHotOddEvenDiffersSignalKey(match, tip_epoch);
    return Boolean(key && consumed_key && key === consumed_key);
};

export const createHotOddEvenDiffersRuntimeState = () => ({
    trade_committed: false,
    signal_issued_at: 0,
    last_barrier: null,
    armed_prediction: -1,
});

export const resetHotOddEvenDiffersRuntimeState = (state = null) => {
    const tracker = state || createHotOddEvenDiffersRuntimeState();
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.last_barrier = null;
    tracker.armed_prediction = -1;
    return tracker;
};

export const armHotOddEvenDiffersPrediction = (state, barrier) => {
    const tracker = state || createHotOddEvenDiffersRuntimeState();
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

export const clearHotOddEvenDiffersCommit = state => {
    const tracker = state || createHotOddEvenDiffersRuntimeState();
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.armed_prediction = -1;
    return tracker;
};

export const releaseStaleHotOddEvenDiffersCommit = (state, max_age_ms = 20000) => {
    const tracker = state || createHotOddEvenDiffersRuntimeState();
    if (!tracker.trade_committed) {
        return false;
    }
    const issued = Number(tracker.signal_issued_at) || 0;
    if (!issued || Date.now() - issued < max_age_ms) {
        return false;
    }
    clearHotOddEvenDiffersCommit(tracker);
    return true;
};

export const buildHotOddEvenDiffersResult = ({
    market_group = DEFAULT_MARKET_GROUP,
    active_symbol = '',
    journal_enabled = true,
    parity = 'both',
    evaluations = [],
    match = null,
    switched = false,
    skipped_consumed = false,
} = {}) => {
    const hit = !skipped_consumed && match?.matched ? match : null;
    const prediction = hit ? hit.barrier : -1;
    const journal_messages = [];
    const parity_mode = toParityMode(parity || hit?.parity || 'both');
    const label =
        parity_mode === 'even'
            ? 'Even Hot Differs'
            : parity_mode === 'odd'
              ? 'Odd Hot Differs'
              : 'Hot O/E Differs';

    if (journal_enabled) {
        if (hit) {
            journal_messages.push({
                className: 'success',
                message: `${label} ${hit.symbol}: tip ${hit.last_digit} = hot ${hit.trigger} → Differ cold ${hit.trigger} ${hit.barrier}${
                    switched ? ' (switched market)' : ''
                }`,
            });
        } else if (skipped_consumed && match?.matched) {
            journal_messages.push({
                className: 'info',
                message: `${label} ${match.symbol}: already traded this tip — waiting`,
            });
        } else {
            const sample = (evaluations || [])
                .slice(0, 4)
                .map(e => `${e.symbol}:${e.reason || '-'}`)
                .join(' | ');
            journal_messages.push({
                className: 'info',
                message: `${label}: no tip-hot signal on ${
                    Array.isArray(evaluations) ? evaluations.length : 0
                } symbol(s) [${toMarketGroup(market_group)}]${sample ? ` — ${sample}` : ''}`,
            });
        }
    }

    return {
        prediction,
        barrier: prediction,
        matched: Boolean(hit),
        last_digit: hit ? hit.last_digit : null,
        hot_odd: hit ? hit.hot_odd : null,
        hot_even: hit ? hit.hot_even : null,
        cold_digit: hit ? hit.cold_digit : null,
        trigger: hit ? hit.trigger : null,
        parity: parity_mode,
        symbol: hit ? hit.symbol : active_symbol || '',
        market_group: toMarketGroup(market_group),
        symbols_scanned: (evaluations || []).map(e => e.symbol),
        evaluations,
        switched: Boolean(switched),
        skipped_consumed: Boolean(skipped_consumed),
        reason: hit ? hit.reason : skipped_consumed ? 'signal_consumed' : 'no_match',
        journal_messages,
    };
};
