/**
 * Digit Percentage Decrease – Differ
 *
 * On every new tip, recompute digit % over the rolling analysis window
 * (default 1000) and compare against the previous tip’s percentages.
 * Digits whose share fell by at least min_decrease (default 0.1pp) qualify.
 * Signal DIGITDIFF on the largest qualifying drop.
 */

export const DEFAULT_OPTIONS = {
    analysis_window: 1000,
    min_decrease: 0.1,
    journal_enabled: true,
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toPositiveInt = (value, fallback, min = 1, max = 10000) => {
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

export const normalizeDigitPercentageDecreaseOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 10, 5000),
        min_decrease: toNonNegNumber(options.min_decrease, d.min_decrease),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createDigitPercentageDecreaseState = () => ({
    last_tip_fp: '',
    prev_percentages: null,
    prev_counts: null,
    last_result: null,
    consumed_key: '',
});

export const resetDigitPercentageDecreaseState = state => {
    const next = state || createDigitPercentageDecreaseState();
    next.last_tip_fp = '';
    next.prev_percentages = null;
    next.prev_counts = null;
    next.last_result = null;
    next.consumed_key = '';
    return next;
};

export const makeDigitPercentageDecreaseSignalKey = (result, tip_fp) => {
    if (!result?.matched || result.prediction < 0) return '';
    return `${tip_fp}:${result.prediction}:${Math.round(Number(result.drop) * 1000)}`;
};

export const isDigitPercentageDecreaseSignalConsumed = (result, tip_fp, consumed_key) => {
    if (!result?.matched || !consumed_key) return false;
    return makeDigitPercentageDecreaseSignalKey(result, tip_fp) === consumed_key;
};

export const computeDigitPercentages = sample => {
    const counts = Array.from({ length: 10 }, () => 0);
    const size = Array.isArray(sample) ? sample.length : 0;
    for (let i = 0; i < size; i++) {
        counts[sample[i]] += 1;
    }
    const percentages = counts.map(c => (size > 0 ? (c / size) * 100 : 0));
    return { size, counts, percentages };
};

const emptyCollecting = (options, tick_count, need) => ({
    options,
    tick_count,
    need,
    ready: false,
    matched: false,
    prediction: -1,
    barrier: -1,
    digit: -1,
    drop: 0,
    rows: [],
    aged_out: -1,
    aged_in: -1,
    tip: null,
    reason: 'collecting',
});

/**
 * Re-evaluate on each new tip: current rolling % vs previous tip’s % for all digits.
 *
 * @param {Array<number|string>} digits
 * @param {object} raw_options
 * @param {ReturnType<typeof createDigitPercentageDecreaseState>|null} runtime_state
 */
export const detectDigitPercentageDecrease = (
    digits,
    raw_options = {},
    runtime_state = null
) => {
    const options = normalizeDigitPercentageDecreaseOptions(raw_options);
    const state = runtime_state || createDigitPercentageDecreaseState();
    const cleaned = cleanDigits(digits);
    const window = options.analysis_window;
    const need = window;
    const ready = cleaned.length >= need;
    const tip = cleaned.length ? cleaned[cleaned.length - 1] : null;
    const tip_fp = `${cleaned.length}:${tip}`;

    if (!ready) {
        const collecting = emptyCollecting(options, cleaned.length, need);
        state.last_result = collecting;
        return collecting;
    }

    // Same tip re-scan: keep prior evaluation (signal stays available for purchase).
    if (state.last_tip_fp === tip_fp && state.last_result) {
        return state.last_result;
    }

    const curr = cleaned.slice(-window);
    const curr_stats = computeDigitPercentages(curr);
    const aged_in = tip;
    // Digit that left the window when the tip advanced (if we still have prior length context).
    const aged_out =
        cleaned.length > window ? cleaned[cleaned.length - 1 - window] : state._last_aged_hint ?? -1;

    // First full window: seed baseline percentages, wait for the next tip to compare.
    if (!Array.isArray(state.prev_percentages)) {
        state.prev_percentages = [...curr_stats.percentages];
        state.prev_counts = [...curr_stats.counts];
        state.last_tip_fp = tip_fp;
        state._last_aged_hint = aged_in;
        const baseline = {
            options,
            tick_count: cleaned.length,
            need,
            ready: true,
            matched: false,
            prediction: -1,
            barrier: -1,
            digit: -1,
            drop: 0,
            rows: curr_stats.percentages.map((curr_pct, digit) => ({
                digit,
                prev_pct: curr_pct,
                curr_pct,
                drop: 0,
                decreased: false,
            })),
            decreased: [],
            aged_out: -1,
            aged_in,
            tip,
            curr_stats,
            reason: 'baseline_seeded',
        };
        state.last_result = baseline;
        return baseline;
    }

    const rows = [];
    for (let digit = 0; digit <= 9; digit++) {
        const prev_pct = Number(state.prev_percentages[digit]) || 0;
        const curr_pct = curr_stats.percentages[digit];
        const drop = prev_pct - curr_pct;
        rows.push({
            digit,
            prev_pct,
            curr_pct,
            drop,
            decreased: drop >= options.min_decrease - 1e-9,
        });
    }

    const decreased = rows
        .filter(r => r.decreased)
        .sort((a, b) => b.drop - a.drop || a.digit - b.digit);

    const best = decreased[0] || null;

    // Advance snapshot to this tip so the next incoming tick re-evaluates fresh changes.
    state.prev_percentages = [...curr_stats.percentages];
    state.prev_counts = [...curr_stats.counts];
    state.last_tip_fp = tip_fp;
    state._last_aged_hint = aged_in;

    const result = {
        options,
        tick_count: cleaned.length,
        need,
        ready: true,
        matched: Boolean(best),
        prediction: best ? best.digit : -1,
        barrier: best ? best.digit : -1,
        digit: best ? best.digit : -1,
        drop: best ? best.drop : 0,
        rows,
        decreased,
        aged_out,
        aged_in,
        tip,
        curr_stats,
        reason: best ? 'percentage_decrease' : 'no_decrease',
    };
    state.last_result = result;
    return result;
};

const fmtPct = value => `${(Math.round(Number(value) * 1000) / 1000).toFixed(3)}%`;

export const buildDigitPercentageDecreaseJournal = analysis => {
    const messages = [];
    const { options, ready, tick_count, need, matched, prediction, aged_out, aged_in } = analysis;

    if (!ready) {
        messages.push({
            className: 'journal__text',
            message: `Digit % Decrease: collecting ticks ${tick_count}/${need} (window ${options.analysis_window})…`,
        });
        return messages;
    }

    if (analysis.reason === 'baseline_seeded') {
        messages.push({
            className: 'journal__text',
            message: `DIGIT % DECREASE — window ${options.analysis_window} ready; baseline set. Waiting for next tick to re-evaluate % changes…`,
        });
        return messages;
    }

    messages.push({
        className: 'journal__text',
        message: `DIGIT % DECREASE — window ${options.analysis_window} | min drop ${options.min_decrease}pp | tip ${aged_in}${aged_out >= 0 ? ` (left ${aged_out})` : ''}`,
    });

    const highlight = [...(analysis.rows || [])].sort((a, b) => b.drop - a.drop).slice(0, 5);
    highlight.forEach(row => {
        messages.push({
            className: row.decreased ? 'journal__text--success' : 'journal__text',
            message: `Digit ${row.digit}: ${fmtPct(row.prev_pct)} → ${fmtPct(row.curr_pct)} (Δ ${row.drop >= 0 ? '-' : '+'}${fmtPct(Math.abs(row.drop))})`,
        });
    });

    if (matched) {
        messages.push({
            className: 'journal__text--success',
            message: `SIGNAL — DIFFER ${prediction} (drop ${fmtPct(analysis.drop)} ≥ ${options.min_decrease}pp)`,
        });
    } else {
        messages.push({
            className: 'journal__text',
            message: 'NO SIGNAL — no digit decreased by the configured minimum on this tip.',
        });
    }

    return messages;
};

/**
 * @param {Array<number|string>} digits oldest → newest
 * @param {object} raw_options
 * @param {object|null} runtime_state
 */
export const evaluateDigitPercentageDecrease = (
    digits,
    raw_options = {},
    runtime_state = null
) => {
    const analysis = detectDigitPercentageDecrease(digits, raw_options, runtime_state);
    const journal_messages = analysis.options.journal_enabled
        ? buildDigitPercentageDecreaseJournal(analysis)
        : [];

    return {
        prediction: analysis.prediction,
        barrier: analysis.barrier,
        matched: analysis.matched,
        allowed: analysis.matched,
        digit: analysis.digit,
        drop: analysis.drop,
        aged_out: analysis.aged_out,
        aged_in: analysis.aged_in,
        analysis,
        journal_messages,
    };
};
