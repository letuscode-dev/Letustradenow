/**
 * Digit Percentage Decrease – Differ
 *
 * Over a rolling analysis window (default 1000 ticks), compare the previous
 * full window to the current window after each new tip. Digits whose occurrence
 * percentage fell by at least min_decrease (default 0.1pp) qualify.
 *
 * On a full 1000-tick slide, the aged-out digit drops by exactly 0.1%.
 * Signal DIGITDIFF against the digit with the largest qualifying decrease.
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

export const computeDigitPercentages = sample => {
    const counts = Array.from({ length: 10 }, () => 0);
    const size = Array.isArray(sample) ? sample.length : 0;
    for (let i = 0; i < size; i++) {
        counts[sample[i]] += 1;
    }
    const percentages = counts.map(c => (size > 0 ? (c / size) * 100 : 0));
    return { size, counts, percentages };
};

/**
 * Compare previous vs current rolling windows and find percentage decreases.
 */
export const detectDigitPercentageDecrease = (digits, raw_options = {}) => {
    const options = normalizeDigitPercentageDecreaseOptions(raw_options);
    const cleaned = cleanDigits(digits);
    const window = options.analysis_window;
    const need = window + 1;
    const ready = cleaned.length >= need;

    if (!ready) {
        return {
            options,
            tick_count: cleaned.length,
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
            reason: 'collecting',
        };
    }

    const prev = cleaned.slice(-(window + 1), -1);
    const curr = cleaned.slice(-window);
    const aged_out = cleaned[cleaned.length - 1 - window];
    const aged_in = cleaned[cleaned.length - 1];

    const prev_stats = computeDigitPercentages(prev);
    const curr_stats = computeDigitPercentages(curr);

    const rows = [];
    for (let digit = 0; digit <= 9; digit++) {
        const prev_pct = prev_stats.percentages[digit];
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

    return {
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
        prev_stats,
        curr_stats,
        reason: best ? 'percentage_decrease' : 'no_decrease',
    };
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

    messages.push({
        className: 'journal__text',
        message: `DIGIT % DECREASE — window ${options.analysis_window} | min drop ${options.min_decrease}pp | out ${aged_out} → in ${aged_in}`,
    });

    const highlight = [...analysis.rows].sort((a, b) => b.drop - a.drop).slice(0, 5);
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
            message: 'NO SIGNAL — no digit decreased by the configured minimum.',
        });
    }

    return messages;
};

/**
 * @param {Array<number|string>} digits oldest → newest
 * @param {object} raw_options
 */
export const evaluateDigitPercentageDecrease = (digits, raw_options = {}) => {
    const analysis = detectDigitPercentageDecrease(digits, raw_options);
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
