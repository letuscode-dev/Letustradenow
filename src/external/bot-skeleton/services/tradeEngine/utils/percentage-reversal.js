/**
 * Percentage Reversal — detect digit dominance collapsing into underrepresentation,
 * then signal Digit Differs against that digit.
 *
 * Example regime change:
 *   Long 200: 17%  →  Medium 100: 20%  →  Short 50: 8%
 *   Digit was dominant, then rapidly collapsed → DIFFER that digit.
 *
 * Supports multi-symbol scanning via Selected Symbols / market_group.
 */

import {
    orderSymbolsForScan,
    parseSymbolList,
    resolveScanSymbols,
    VOLATILITY_1S_SYMBOLS,
    VOLATILITY_STANDARD_SYMBOLS,
} from './sequential-digit-differs';

export {
    orderSymbolsForScan,
    parseSymbolList,
    resolveScanSymbols,
    VOLATILITY_1S_SYMBOLS,
    VOLATILITY_STANDARD_SYMBOLS,
};

export const BASELINE_PERCENT = 10;

export const DEFAULT_OPTIONS = {
    short_window: 50,
    medium_window: 100,
    long_window: 200,
    /** Minimum % in long or medium to count as prior dominance. */
    dominance_min: 15,
    /** Short-window % must fall to/below this to count as collapsed. */
    collapse_max: 10,
    /** Minimum percentage-point drop from prior peak to short. */
    min_drop: 7,
    /** Prefer medium also above this when scoring (optional soft boost). */
    medium_dominance_min: 12,
    journal_enabled: true,
    switch_symbol: true,
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toPositiveInt = (value, fallback, min = 1, max = 5000) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

const toNonNegNumber = (value, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
};

const cleanDigits = digits => {
    if (!Array.isArray(digits)) return [];
    const out = [];
    for (let i = 0; i < digits.length; i++) {
        const d = Number(digits[i]);
        if (Number.isInteger(d) && d >= 0 && d <= 9) out.push(d);
    }
    return out;
};

export const normalizePercentageReversalOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        short_window: toPositiveInt(options.short_window, d.short_window, 10, 2000),
        medium_window: toPositiveInt(options.medium_window, d.medium_window, 10, 2000),
        long_window: toPositiveInt(options.long_window, d.long_window, 10, 5000),
        dominance_min: toNonNegNumber(options.dominance_min, d.dominance_min),
        collapse_max: toNonNegNumber(options.collapse_max, d.collapse_max),
        min_drop: toNonNegNumber(options.min_drop, d.min_drop),
        medium_dominance_min: toNonNegNumber(options.medium_dominance_min, d.medium_dominance_min),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        switch_symbol: toBool(options.switch_symbol, d.switch_symbol),
        symbols: options.symbols,
        market_group: options.market_group,
    };
};

export const evaluateSymbolPercentageReversal = (symbol, digits, raw_options = {}) => {
    const result = evaluatePercentageReversal(digits, {
        ...raw_options,
        journal_enabled: false,
    });
    const best = result.analysis?.best || null;
    return {
        symbol,
        prediction: result.prediction,
        barrier: result.barrier,
        matched: result.matched,
        digit: result.digit,
        drop: result.drop,
        score: best?.score ?? 0,
        prior_peak: best?.prior_peak ?? 0,
        short_pct: best?.short_pct ?? 0,
        ready: Boolean(result.analysis?.ready),
        tick_count: result.analysis?.tick_count ?? 0,
        need: result.analysis?.need ?? 0,
        analysis: result.analysis,
    };
};

/** Prefer strongest collapse score across scanned symbols. */
export const pickBestPercentageReversalMatch = evaluations => {
    if (!Array.isArray(evaluations)) return null;
    let best = null;
    for (let i = 0; i < evaluations.length; i++) {
        const item = evaluations[i];
        if (!item?.matched || item.prediction < 0) continue;
        if (
            !best ||
            item.score > best.score ||
            (item.score === best.score && item.drop > best.drop)
        ) {
            best = item;
        }
    }
    return best;
};

export const makePercentageReversalSignalKey = (match, tip_epoch) => {
    if (!match?.matched) return '';
    return `${match.symbol}:${match.prediction}:${Math.round(match.drop * 100)}:${tip_epoch ?? ''}`;
};

export const isPercentageReversalSignalConsumed = (match, tip_epoch, consumed_key) => {
    if (!match?.matched || !consumed_key) return false;
    return makePercentageReversalSignalKey(match, tip_epoch) === consumed_key;
};

export const computeWindowPercentages = sample => {
    const counts = Array.from({ length: 10 }, () => 0);
    const size = Array.isArray(sample) ? sample.length : 0;
    for (let i = 0; i < size; i++) {
        counts[sample[i]] += 1;
    }
    const percentages = counts.map(c => (size > 0 ? (c / size) * 100 : 0));
    return { size, counts, percentages };
};

/**
 * Score a single digit for dominance → collapse regime change.
 */
export const scoreDigitReversal = (digit, short_pct, medium_pct, long_pct, options) => {
    const prior_peak = Math.max(medium_pct, long_pct);
    const drop = prior_peak - short_pct;
    const was_dominant = prior_peak >= options.dominance_min;
    const collapsed = short_pct <= options.collapse_max;
    const drop_ok = drop >= options.min_drop;
    const matched = was_dominant && collapsed && drop_ok;

    let score = 0;
    if (matched) {
        score = drop;
        if (medium_pct >= options.medium_dominance_min) score += 2;
        if (long_pct >= options.dominance_min && medium_pct >= options.dominance_min) score += 3;
        if (short_pct < BASELINE_PERCENT) score += 1;
    }

    return {
        digit,
        short_pct,
        medium_pct,
        long_pct,
        prior_peak,
        drop,
        was_dominant,
        collapsed,
        matched,
        score,
        status: matched
            ? 'DOMINANCE → COLLAPSE'
            : was_dominant
              ? 'DOMINANT (watching)'
              : collapsed && drop > 0
                ? 'SOFT COLLAPSE'
                : 'STABLE',
    };
};

export const detectPercentageReversal = (digits, raw_options = {}) => {
    const options = normalizePercentageReversalOptions(raw_options);
    const cleaned = cleanDigits(digits);
    const need = Math.max(options.short_window, options.medium_window, options.long_window);
    const ready = cleaned.length >= need;

    const short_stats = computeWindowPercentages(cleaned.slice(-options.short_window));
    const medium_stats = computeWindowPercentages(cleaned.slice(-options.medium_window));
    const long_stats = computeWindowPercentages(cleaned.slice(-options.long_window));

    const digit_rows = [];
    for (let digit = 0; digit <= 9; digit++) {
        digit_rows.push(
            scoreDigitReversal(
                digit,
                short_stats.percentages[digit],
                medium_stats.percentages[digit],
                long_stats.percentages[digit],
                options
            )
        );
    }

    const ranked = [...digit_rows].sort((a, b) => {
        if (b.matched !== a.matched) return a.matched ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return b.drop - a.drop;
    });

    const best = ranked.find(r => r.matched) || null;

    return {
        options,
        tick_count: cleaned.length,
        need,
        ready,
        digit_rows,
        ranked,
        best,
        matched: Boolean(best),
        prediction: best ? best.digit : -1,
        barrier: best ? best.digit : -1,
    };
};

const fmtPct = value => `${(Math.round(value * 100) / 100).toFixed(2)}%`;

export const buildPercentageReversalJournal = analysis => {
    const messages = [];
    const { options, ready, tick_count, need, digit_rows, best } = analysis;

    if (!ready) {
        messages.push({
            className: 'journal__text',
            message: `Percentage Reversal: collecting ticks ${tick_count}/${need}…`,
        });
        return messages;
    }

    messages.push({
        className: 'journal__text',
        message: `DIGIT | SHORT(${options.short_window}) | MED(${options.medium_window}) | LONG(${options.long_window}) | DROP | STATUS`,
    });

    const highlight = [...digit_rows]
        .sort((a, b) => b.drop - a.drop)
        .slice(0, 4);

    highlight.forEach(row => {
        messages.push({
            className: row.matched ? 'journal__text--success' : 'journal__text',
            message: `${row.digit} | ${fmtPct(row.short_pct)} | ${fmtPct(row.medium_pct)} | ${fmtPct(row.long_pct)} | ${fmtPct(row.drop)} | ${row.status}`,
        });
    });

    if (best) {
        messages.push({
            className: 'journal__text--success',
            message: `Percentage Reversal → DIFFER ${best.digit} (peak ${fmtPct(best.prior_peak)} → short ${fmtPct(best.short_pct)}, drop ${fmtPct(best.drop)})`,
        });
    } else {
        messages.push({
            className: 'journal__text',
            message: 'NO SIGNAL — no digit shows dominance → rapid percentage collapse yet.',
        });
    }

    return messages;
};

/**
 * @param {Array<number|string>} digits oldest → newest
 * @param {object} raw_options
 */
export const evaluatePercentageReversal = (digits, raw_options = {}) => {
    const analysis = detectPercentageReversal(digits, raw_options);
    const { options } = analysis;
    const journal_messages = options.journal_enabled
        ? buildPercentageReversalJournal(analysis)
        : [];

    return {
        prediction: analysis.prediction,
        barrier: analysis.barrier,
        matched: analysis.matched,
        allowed: analysis.matched,
        digit: analysis.best?.digit ?? -1,
        drop: analysis.best?.drop ?? 0,
        analysis,
        journal_messages,
    };
};
