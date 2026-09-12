/**
 * Dominant Digit Percentage – Differ
 *
 * Rolling-window digit frequency → IDENTIFY dominant digit → DIFFER when
 * percentage (and optional gap / persistence / multi-window) filters pass.
 *
 * Observed percentages are historical only — not a guaranteed win probability.
 */

export const BASELINE_PERCENT = 10;

export const TIE_HANDLING = {
    REJECT: 'REJECT_TIE',
    MOST_RECENT: 'MOST_RECENT',
    SHORT_WINDOW: 'SHORT_WINDOW',
    PERSISTENCE: 'PERSISTENCE',
};

export const DEFAULT_OPTIONS = {
    analysis_window: 200,
    min_sample: 50,
    min_dominant_percent: 15,
    enable_dominance_gap: false,
    min_dominance_gap: 3,
    enable_persistence: false,
    min_persistence: 3,
    enable_multi_window: false,
    short_window: 50,
    medium_window: 100,
    long_window: 200,
    min_confirming_windows: 2,
    max_target_rank: 1,
    tie_handling: TIE_HANDLING.REJECT,
    weak_min: 15,
    moderate_min: 17,
    strong_min: 20,
    very_strong_min: 25,
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

const normalizeTieHandling = value => {
    const raw = String(value ?? '')
        .trim()
        .toUpperCase();
    if (raw === '1' || raw === TIE_HANDLING.MOST_RECENT || raw === 'MOST_RECENT') {
        return TIE_HANDLING.MOST_RECENT;
    }
    if (raw === '2' || raw === TIE_HANDLING.SHORT_WINDOW || raw === 'SHORT_WINDOW') {
        return TIE_HANDLING.SHORT_WINDOW;
    }
    if (raw === '3' || raw === TIE_HANDLING.PERSISTENCE || raw === 'PERSISTENCE') {
        return TIE_HANDLING.PERSISTENCE;
    }
    // Random intentionally unsupported / disabled by default → reject
    return TIE_HANDLING.REJECT;
};

export const normalizeDominantDigitPercentageOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    const analysis_window = toPositiveInt(options.analysis_window, d.analysis_window, 10, 5000);
    const min_sample = toPositiveInt(options.min_sample, d.min_sample, 1, analysis_window);
    return {
        analysis_window,
        min_sample,
        min_dominant_percent: toNonNegNumber(options.min_dominant_percent, d.min_dominant_percent),
        enable_dominance_gap: toBool(options.enable_dominance_gap, d.enable_dominance_gap),
        min_dominance_gap: toNonNegNumber(options.min_dominance_gap, d.min_dominance_gap),
        enable_persistence: toBool(options.enable_persistence, d.enable_persistence),
        min_persistence: toPositiveInt(options.min_persistence, d.min_persistence, 1, 500),
        enable_multi_window: toBool(options.enable_multi_window, d.enable_multi_window),
        short_window: toPositiveInt(options.short_window, d.short_window, 10, 5000),
        medium_window: toPositiveInt(options.medium_window, d.medium_window, 10, 5000),
        long_window: toPositiveInt(options.long_window, d.long_window, 10, 5000),
        min_confirming_windows: toPositiveInt(options.min_confirming_windows, d.min_confirming_windows, 1, 3),
        max_target_rank: toPositiveInt(options.max_target_rank, d.max_target_rank, 1, 3),
        tie_handling: normalizeTieHandling(options.tie_handling ?? d.tie_handling),
        weak_min: toNonNegNumber(options.weak_min, d.weak_min),
        moderate_min: toNonNegNumber(options.moderate_min, d.moderate_min),
        strong_min: toNonNegNumber(options.strong_min, d.strong_min),
        very_strong_min: toNonNegNumber(options.very_strong_min, d.very_strong_min),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        reset_analysis: toBool(options.reset_analysis, false),
    };
};

export const createDominantDigitPercentageState = () => ({
    last_dominant: -1,
    persistence: 0,
    last_tip_fp: '',
});

export const resetDominantDigitPercentageState = state => {
    if (!state) return createDominantDigitPercentageState();
    state.last_dominant = -1;
    state.persistence = 0;
    state.last_tip_fp = '';
    return state;
};

export const computeDigitStats = sample => {
    const counts = Array.from({ length: 10 }, () => 0);
    const size = Array.isArray(sample) ? sample.length : 0;
    for (let i = 0; i < size; i++) {
        counts[sample[i]] += 1;
    }
    const rows = counts.map((count, digit) => ({
        digit,
        count,
        percent: size > 0 ? (count / size) * 100 : 0,
    }));
    const ranked = [...rows].sort((a, b) => {
        if (b.percent !== a.percent) return b.percent - a.percent;
        return a.digit - b.digit;
    });
    return { size, counts, rows, ranked };
};

export const classifySignalStrength = (percent, options) => {
    if (percent < options.weak_min) return 'NO SIGNAL';
    if (percent >= options.very_strong_min) return 'VERY STRONG';
    if (percent >= options.strong_min) return 'STRONG';
    if (percent >= options.moderate_min) return 'MODERATE';
    return 'WEAK';
};

const dominantFromStats = stats => {
    if (!stats?.ranked?.length || stats.size <= 0) {
        return { dominant: null, second: null, tied: false };
    }
    const top = stats.ranked[0];
    const tied = stats.ranked.filter(r => Math.abs(r.percent - top.percent) < 1e-9);
    return {
        dominant: top,
        second: stats.ranked[1] || null,
        tied: tied.length > 1,
        tied_digits: tied.map(r => r.digit),
    };
};

const windowDominant = (digits, window_size) => {
    if (!Array.isArray(digits) || digits.length < window_size) {
        return { ready: false, digit: -1, percent: 0, tied: false };
    }
    const stats = computeDigitStats(digits.slice(-window_size));
    const info = dominantFromStats(stats);
    return {
        ready: true,
        digit: info.tied ? -1 : info.dominant.digit,
        percent: info.dominant?.percent ?? 0,
        tied: info.tied,
        tied_digits: info.tied_digits || [],
        stats,
    };
};

/**
 * Resolve which digit to target given ranking, ties, and max_target_rank.
 */
export const resolveTargetDigit = ({
    ranked,
    options,
    short_window_result,
    state,
}) => {
    if (!Array.isArray(ranked) || !ranked.length) {
        return { digit: -1, reason: 'empty', candidates: [] };
    }

    const top = ranked[0];
    const tied_at_top = ranked.filter(r => Math.abs(r.percent - top.percent) < 1e-9);
    if (tied_at_top.length > 1 && options.max_target_rank === 1) {
        if (options.tie_handling === TIE_HANDLING.REJECT) {
            return {
                digit: -1,
                reason: 'tie_rejected',
                candidates: tied_at_top,
                message: 'NO SIGNAL — tie at dominant percentage (REJECT TIE)',
            };
        }
        if (options.tie_handling === TIE_HANDLING.MOST_RECENT) {
            if (state?.last_dominant >= 0 && tied_at_top.some(r => r.digit === state.last_dominant)) {
                return {
                    digit: state.last_dominant,
                    reason: 'tie_most_recent',
                    candidates: tied_at_top,
                };
            }
            return {
                digit: -1,
                reason: 'tie_no_recent',
                candidates: tied_at_top,
                message: 'NO SIGNAL — tie and no recent dominant to break it',
            };
        }
        if (options.tie_handling === TIE_HANDLING.SHORT_WINDOW) {
            const short_digit = short_window_result?.digit;
            if (
                short_digit >= 0 &&
                !short_window_result.tied &&
                tied_at_top.some(r => r.digit === short_digit)
            ) {
                return { digit: short_digit, reason: 'tie_short_window', candidates: tied_at_top };
            }
            return {
                digit: -1,
                reason: 'tie_short_unresolved',
                candidates: tied_at_top,
                message: 'NO SIGNAL — tie unresolved by short window',
            };
        }
        if (options.tie_handling === TIE_HANDLING.PERSISTENCE) {
            if (state?.last_dominant >= 0 && tied_at_top.some(r => r.digit === state.last_dominant)) {
                return {
                    digit: state.last_dominant,
                    reason: 'tie_persistence',
                    candidates: tied_at_top,
                };
            }
            return {
                digit: -1,
                reason: 'tie_persistence_unresolved',
                candidates: tied_at_top,
                message: 'NO SIGNAL — tie unresolved by persistence',
            };
        }
    }

    const limit = Math.min(options.max_target_rank, ranked.length);
    const candidates = ranked.slice(0, limit).filter(r => r.percent >= options.min_dominant_percent);
    if (!candidates.length) {
        return {
            digit: -1,
            reason: 'below_threshold',
            candidates: ranked.slice(0, limit),
            message: 'NO SIGNAL — DOMINANCE BELOW THRESHOLD',
        };
    }
    // Default: only #1 when max_target_rank=1; otherwise prefer highest % among qualifying top-N
    return { digit: candidates[0].digit, reason: 'ok', candidates };
};

export const detectDominantDigitPercentage = (digits, raw_options = {}, runtime_state = null) => {
    const options = normalizeDominantDigitPercentageOptions(raw_options);
    const state = runtime_state || createDominantDigitPercentageState();
    if (options.reset_analysis) {
        resetDominantDigitPercentageState(state);
    }

    const cleaned = cleanDigits(digits);
    const need = Math.max(
        options.analysis_window,
        options.min_sample,
        options.enable_multi_window
            ? Math.max(options.short_window, options.medium_window, options.long_window)
            : 0
    );
    const window_digits = cleaned.slice(-options.analysis_window);
    const ready = window_digits.length >= options.min_sample;

    const tip = cleaned.length ? cleaned[cleaned.length - 1] : null;
    const tip_fp = `${cleaned.length}:${tip}`;
    const tip_advanced = tip_fp !== state.last_tip_fp;

    const stats = computeDigitStats(window_digits);
    const info = dominantFromStats(stats);
    const short_window_result = windowDominant(cleaned, options.short_window);
    const medium_window_result = windowDominant(cleaned, options.medium_window);
    const long_window_result = windowDominant(cleaned, options.long_window);

    const resolved = ready
        ? resolveTargetDigit({
              ranked: stats.ranked,
              options,
              short_window_result,
              state,
          })
        : { digit: -1, reason: 'collecting', candidates: [], message: `collecting ${window_digits.length}/${options.min_sample}` };

    // Persistence: same dominant after each new tip
    let persistence = state.persistence;
    const observed_dominant = info.tied ? -1 : info.dominant?.digit ?? -1;
    if (tip_advanced) {
        if (observed_dominant >= 0 && observed_dominant === state.last_dominant) {
            persistence += 1;
        } else if (observed_dominant >= 0) {
            persistence = 1;
        } else {
            persistence = 0;
        }
        state.last_dominant = observed_dominant;
        state.persistence = persistence;
        state.last_tip_fp = tip_fp;
    } else {
        persistence = state.persistence;
    }

    const target_row =
        resolved.digit >= 0 ? stats.rows[resolved.digit] : info.dominant || null;
    const dominant_percent = target_row?.percent ?? info.dominant?.percent ?? 0;
    const second = info.second;
    const dominance_gap =
        target_row && second && target_row.digit !== second.digit
            ? dominant_percent - second.percent
            : target_row && second && target_row.digit === second.digit
              ? 0
              : second
                ? dominant_percent - second.percent
                : dominant_percent;
    // If targeting #1, gap vs second; if targeting lower rank, gap vs next below that digit
    let gap = 0;
    if (resolved.digit >= 0) {
        const idx = stats.ranked.findIndex(r => r.digit === resolved.digit);
        const next = idx >= 0 ? stats.ranked[idx + 1] : null;
        gap = next ? dominant_percent - next.percent : dominant_percent;
    } else if (info.dominant && second) {
        gap = info.dominant.percent - second.percent;
    }

    const dominance_excess = dominant_percent - BASELINE_PERCENT;
    const strength = classifySignalStrength(dominant_percent, options);

    const multi = {
        short: short_window_result,
        medium: medium_window_result,
        long: long_window_result,
    };
    let confirming_windows = 0;
    let consensus_digit = -1;
    if (options.enable_multi_window && resolved.digit >= 0) {
        const windows = [short_window_result, medium_window_result, long_window_result];
        confirming_windows = windows.filter(
            w => w.ready && !w.tied && w.digit === resolved.digit
        ).length;
        consensus_digit = confirming_windows >= options.min_confirming_windows ? resolved.digit : -1;
    }

    const failures = [];
    if (!ready) {
        failures.push(`collecting ticks ${window_digits.length}/${options.min_sample}`);
    }
    if (ready && resolved.digit < 0) {
        failures.push(resolved.message || resolved.reason || 'no target');
    }
    if (ready && resolved.digit >= 0 && dominant_percent < options.min_dominant_percent) {
        failures.push('DOMINANCE BELOW THRESHOLD');
    }
    if (
        ready &&
        resolved.digit >= 0 &&
        options.enable_dominance_gap &&
        gap < options.min_dominance_gap
    ) {
        failures.push(
            `dominance gap ${gap.toFixed(2)}% < min ${options.min_dominance_gap}%`
        );
    }
    if (
        ready &&
        resolved.digit >= 0 &&
        options.enable_persistence &&
        persistence < options.min_persistence
    ) {
        failures.push(`persistence ${persistence}/${options.min_persistence}`);
    }
    if (
        ready &&
        resolved.digit >= 0 &&
        options.enable_multi_window &&
        confirming_windows < options.min_confirming_windows
    ) {
        failures.push(
            `multi-window ${confirming_windows}/${options.min_confirming_windows}`
        );
    }

    const matched =
        ready &&
        resolved.digit >= 0 &&
        dominant_percent >= options.min_dominant_percent &&
        failures.length === 0;

    return {
        options,
        state,
        tick_count: cleaned.length,
        window_size: window_digits.length,
        need,
        ready,
        stats,
        ranked: stats.ranked,
        dominant_digit: info.dominant?.digit ?? -1,
        dominant_percent: info.dominant?.percent ?? 0,
        second_digit: second?.digit ?? -1,
        second_percent: second?.percent ?? 0,
        target_digit: resolved.digit,
        prediction: matched ? resolved.digit : -1,
        barrier: matched ? resolved.digit : -1,
        matched,
        dominance_excess,
        dominance_gap: gap,
        persistence,
        strength: matched ? strength : strength === 'NO SIGNAL' ? 'NO SIGNAL' : strength,
        multi,
        confirming_windows,
        consensus_digit,
        failures,
        tied: info.tied,
        reason: matched ? 'signal' : failures[0] || resolved.reason || 'no_signal',
    };
};

const fmtPct = value => `${(Math.round(Number(value) * 100) / 100).toFixed(2)}%`;

export const buildDominantDigitPercentageJournal = analysis => {
    const messages = [];
    const { options, ready, window_size, ranked, matched, prediction } = analysis;

    messages.push({
        className: 'journal__text',
        message: `DOMINANT DIGIT ANALYSIS — window ${window_size}/${options.analysis_window} (min sample ${options.min_sample})`,
    });

    if (!ready) {
        messages.push({
            className: 'journal__text',
            message: `Collecting ticks ${window_size}/${options.min_sample}…`,
        });
        return messages;
    }

    messages.push({
        className: 'journal__text',
        message: 'Digit | Count | Percentage',
    });

    ranked.slice(0, 10).forEach((row, index) => {
        const mark =
            row.digit === analysis.dominant_digit && index === 0 ? ' ← DOMINANT' : '';
        messages.push({
            className:
                matched && row.digit === prediction
                    ? 'journal__text--success'
                    : 'journal__text',
            message: `${index + 1}. Digit ${row.digit} → ${row.count} | ${fmtPct(row.percent)}${mark}`,
        });
    });

    messages.push({
        className: 'journal__text',
        message: `DOMINANT: ${analysis.dominant_digit} @ ${fmtPct(analysis.dominant_percent)} | baseline ${BASELINE_PERCENT}% | excess ${analysis.dominance_excess >= 0 ? '+' : ''}${fmtPct(analysis.dominance_excess).replace('%', '')}% | 2nd ${analysis.second_digit}=${fmtPct(analysis.second_percent)} | gap ${fmtPct(analysis.dominance_gap)}`,
    });

    if (options.enable_multi_window) {
        const s = analysis.multi.short;
        const m = analysis.multi.medium;
        const l = analysis.multi.long;
        messages.push({
            className: 'journal__text',
            message: `CONSENSUS: ${analysis.confirming_windows}/3 | ${options.short_window}T→${s.digit >= 0 ? `${s.digit} ${fmtPct(s.percent)}` : '…'} | ${options.medium_window}T→${m.digit >= 0 ? `${m.digit} ${fmtPct(m.percent)}` : '…'} | ${options.long_window}T→${l.digit >= 0 ? `${l.digit} ${fmtPct(l.percent)}` : '…'}`,
        });
    }

    if (options.enable_persistence) {
        messages.push({
            className: 'journal__text',
            message: `Persistence: ${analysis.persistence}/${options.min_persistence}`,
        });
    }

    if (matched) {
        messages.push({
            className: 'journal__text--success',
            message: `SIGNAL DETECTED — DIFFER ${prediction} | ${fmtPct(analysis.dominant_percent)} | excess ${analysis.dominance_excess >= 0 ? '+' : ''}${analysis.dominance_excess.toFixed(2)}pp | gap ${analysis.dominance_gap.toFixed(2)}pp | ${analysis.strength}`,
        });
        messages.push({
            className: 'journal__text',
            message:
                'Note: observed % is historical frequency only — not a guaranteed Differ win rate.',
        });
    } else {
        messages.push({
            className: 'journal__text',
            message: `NO SIGNAL — ${analysis.reason}`,
        });
    }

    return messages;
};

/**
 * @param {Array<number|string>} digits oldest → newest
 * @param {object} raw_options
 * @param {object|null} runtime_state mutable persistence state
 */
export const evaluateDominantDigitPercentage = (
    digits,
    raw_options = {},
    runtime_state = null
) => {
    const analysis = detectDominantDigitPercentage(digits, raw_options, runtime_state);
    const journal_messages = analysis.options.journal_enabled
        ? buildDominantDigitPercentageJournal(analysis)
        : [];

    return {
        prediction: analysis.prediction,
        barrier: analysis.barrier,
        matched: analysis.matched,
        allowed: analysis.matched,
        digit: analysis.prediction,
        dominant_digit: analysis.dominant_digit,
        dominant_percent: analysis.dominant_percent,
        dominance_excess: analysis.dominance_excess,
        dominance_gap: analysis.dominance_gap,
        strength: analysis.strength,
        persistence: analysis.persistence,
        analysis,
        journal_messages,
    };
};
