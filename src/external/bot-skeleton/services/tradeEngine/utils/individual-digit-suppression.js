/**
 * Individual Digit Suppression Strategy
 *
 * Measures underrepresentation of digits 0–9 across Short / Medium / Long
 * tick windows, scores Over 1 / Over 2 / Over 3 from suppressed losing digits,
 * and emits a ranked trade recommendation when thresholds are met.
 */

export const BASELINE_PERCENT = 10;
export const TRADE_AS_OVER_2 = 'OVER_2';

export const DEFAULT_OPTIONS = {
    short_window: 15,
    medium_window: 30,
    long_window: 60,
    min_suppression: 0,
    moderate_threshold: 3,
    high_threshold: 5,
    very_high_threshold: 7,
    min_confirm_windows: 2,
    min_signal_score: 6,
    require_persistence: true,
    require_trend: false,
    enable_over_1: true,
    enable_over_2: true,
    enable_over_3: true,
    max_simultaneous_signals: 1,
    score_strong: 3,
    score_moderate: 2,
    score_weak: 1,
    score_persist_1: 0,
    score_persist_2: 2,
    score_persist_3: 4,
    score_all_windows: 2,
    score_trend_strengthen: 2,
    score_belongs_to_over: 2,
    /**
     * OVER_2: Over 2 / Over 3 analysis drives the entry; always trade Over 2.
     * Empty: pick the best enabled Over among 1/2/3 (legacy ranking).
     */
    trade_as: '',
    journal_enabled: true,
};

/** Losing digits that lose each Over barrier (digit ≤ barrier). */
export const OVER_LOSING_DIGITS = {
    1: [0, 1],
    2: [0, 1, 2],
    3: [0, 1, 2, 3],
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

export const normalizeIndividualDigitSuppressionOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    const trade_as_raw = String(options.trade_as || '')
        .toUpperCase()
        .replace(/\s+/g, '_');
    const trade_as =
        trade_as_raw === 'OVER_2' || trade_as_raw === 'OVER2' ? TRADE_AS_OVER_2 : '';
    const driven_mode = trade_as === TRADE_AS_OVER_2;
    return {
        short_window: toPositiveInt(options.short_window, d.short_window, 10, 2000),
        medium_window: toPositiveInt(options.medium_window, d.medium_window, 10, 2000),
        long_window: toPositiveInt(options.long_window, d.long_window, 10, 5000),
        min_suppression: toNonNegNumber(options.min_suppression, d.min_suppression),
        moderate_threshold: toNonNegNumber(options.moderate_threshold, d.moderate_threshold),
        high_threshold: toNonNegNumber(options.high_threshold, d.high_threshold),
        very_high_threshold: toNonNegNumber(options.very_high_threshold, d.very_high_threshold),
        min_confirm_windows: toPositiveInt(options.min_confirm_windows, d.min_confirm_windows, 1, 3),
        min_signal_score: toNonNegNumber(options.min_signal_score, d.min_signal_score),
        require_persistence: toBool(options.require_persistence, d.require_persistence),
        require_trend: toBool(options.require_trend, d.require_trend),
        // Over 1 is not used for Over-2 driven entries.
        enable_over_1: driven_mode ? false : toBool(options.enable_over_1, d.enable_over_1),
        enable_over_2: driven_mode ? true : toBool(options.enable_over_2, d.enable_over_2),
        enable_over_3: driven_mode ? true : toBool(options.enable_over_3, d.enable_over_3),
        max_simultaneous_signals: toPositiveInt(
            options.max_simultaneous_signals,
            d.max_simultaneous_signals,
            1,
            3
        ),
        score_strong: toNonNegNumber(options.score_strong, d.score_strong),
        score_moderate: toNonNegNumber(options.score_moderate, d.score_moderate),
        score_weak: toNonNegNumber(options.score_weak, d.score_weak),
        score_persist_1: toNonNegNumber(options.score_persist_1, d.score_persist_1),
        score_persist_2: toNonNegNumber(options.score_persist_2, d.score_persist_2),
        score_persist_3: toNonNegNumber(options.score_persist_3, d.score_persist_3),
        score_all_windows: toNonNegNumber(options.score_all_windows, d.score_all_windows),
        score_trend_strengthen: toNonNegNumber(
            options.score_trend_strengthen,
            d.score_trend_strengthen
        ),
        score_belongs_to_over: toNonNegNumber(
            options.score_belongs_to_over,
            d.score_belongs_to_over
        ),
        trade_as,
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

/**
 * @param {number[]} sample
 * @returns {{ size: number, counts: number[], percentages: number[], suppressions: number[] }}
 */
export const computeWindowDigitStats = sample => {
    const counts = Array.from({ length: 10 }, () => 0);
    const size = Array.isArray(sample) ? sample.length : 0;
    for (let i = 0; i < size; i++) {
        counts[sample[i]] += 1;
    }
    const percentages = counts.map(c => (size > 0 ? (c / size) * 100 : 0));
    const suppressions = percentages.map(p => BASELINE_PERCENT - p);
    return { size, counts, percentages, suppressions };
};

/**
 * Positive suppression only; negative (overrepresented) → 0 / NORMAL.
 */
export const classifySuppressionLevel = (suppression, options) => {
    const positive = Math.max(0, Number(suppression) || 0);
    if (positive < (options.min_suppression || 0)) {
        return { level: 'NORMAL', positive: 0 };
    }
    if (positive >= options.very_high_threshold) {
        return { level: 'VERY HIGH', positive };
    }
    if (positive >= options.high_threshold) {
        return { level: 'HIGH', positive };
    }
    if (positive >= options.moderate_threshold) {
        return { level: 'MODERATE', positive };
    }
    if (positive > 0) {
        return { level: 'NORMAL', positive };
    }
    return { level: 'NORMAL', positive: 0 };
};

const levelScorePoints = (level, options) => {
    if (level === 'VERY HIGH' || level === 'HIGH') return options.score_strong;
    if (level === 'MODERATE') return options.score_moderate;
    if (level === 'NORMAL') return options.score_weak;
    return 0;
};

const persistenceLabel = confirming => {
    if (confirming >= 3) return 'Strong persistence';
    if (confirming === 2) return 'Moderate persistence';
    if (confirming === 1) return 'Weak persistence';
    return 'No persistence';
};

/**
 * Trend uses suppression magnitude (10 − %). Recent (short) vs older (long).
 * Strengthening = short suppression > long suppression.
 */
export const classifySuppressionTrend = (short_supp, medium_supp, long_supp) => {
    const s = Math.max(0, short_supp);
    const m = Math.max(0, medium_supp);
    const l = Math.max(0, long_supp);
    if (s > l + 0.25 && s >= m - 0.25) {
        return 'SUPPRESSION STRENGTHENING';
    }
    if (s + 0.25 < l && s <= m + 0.25) {
        return 'SUPPRESSION WEAKENING';
    }
    return 'SUPPRESSION STABLE';
};

/**
 * Build per-digit multi-window analysis.
 */
export const analyzeDigitSuppression = (digits, raw_options = {}) => {
    const options = normalizeIndividualDigitSuppressionOptions(raw_options);
    const cleaned = cleanDigits(digits);
    const short_n = options.short_window;
    const medium_n = options.medium_window;
    const long_n = options.long_window;
    const need = Math.max(short_n, medium_n, long_n);

    const short_stats = computeWindowDigitStats(cleaned.slice(-short_n));
    const medium_stats = computeWindowDigitStats(cleaned.slice(-medium_n));
    const long_stats = computeWindowDigitStats(cleaned.slice(-long_n));

    const digit_rows = [];
    for (let digit = 0; digit <= 9; digit++) {
        const short_pct = short_stats.percentages[digit];
        const medium_pct = medium_stats.percentages[digit];
        const long_pct = long_stats.percentages[digit];
        const short_supp = short_stats.suppressions[digit];
        const medium_supp = medium_stats.suppressions[digit];
        const long_supp = long_stats.suppressions[digit];

        const window_flags = [
            short_supp > 0 && short_supp >= options.min_suppression,
            medium_supp > 0 && medium_supp >= options.min_suppression,
            long_supp > 0 && long_supp >= options.min_suppression,
        ];
        const confirming = window_flags.filter(Boolean).length;

        const positive_supps = [short_supp, medium_supp, long_supp].map(v => Math.max(0, v));
        const avg_pct = (short_pct + medium_pct + long_pct) / 3;
        const avg_suppression =
            positive_supps.reduce((a, b) => a + b, 0) / positive_supps.length;

        const { level } = classifySuppressionLevel(avg_suppression, options);
        const trend = classifySuppressionTrend(short_supp, medium_supp, long_supp);
        const persistent =
            confirming >= options.min_confirm_windows && avg_suppression >= options.min_suppression;

        digit_rows.push({
            digit,
            short_pct,
            medium_pct,
            long_pct,
            short_supp: Math.max(0, short_supp),
            medium_supp: Math.max(0, medium_supp),
            long_supp: Math.max(0, long_supp),
            avg_pct,
            avg_suppression,
            confirming_windows: confirming,
            persistence: persistenceLabel(confirming),
            level,
            trend,
            persistent,
            status: persistent ? 'PERSISTENT SUPPRESSION' : level === 'NORMAL' ? 'NORMAL' : level,
        });
    }

    const ranked = [...digit_rows].sort((a, b) => {
        if (b.avg_suppression !== a.avg_suppression) {
            return b.avg_suppression - a.avg_suppression;
        }
        return b.confirming_windows - a.confirming_windows;
    });

    const primary = ranked.find(r => r.avg_suppression > 0) || null;
    const secondary =
        ranked.find(r => r.digit !== primary?.digit && r.avg_suppression > 0) || null;

    return {
        options,
        tick_count: cleaned.length,
        need,
        ready: cleaned.length >= need,
        short_stats,
        medium_stats,
        long_stats,
        digit_rows,
        ranked_digits: ranked,
        primary_digit: primary ? primary.digit : -1,
        secondary_digit: secondary ? secondary.digit : -1,
        primary_row: primary,
        secondary_row: secondary,
    };
};

const scoreDigitForOver = (row, options, require_trend) => {
    if (!row || row.avg_suppression <= 0) {
        return { points: 0, reasons: [] };
    }
    if (options.require_persistence && row.confirming_windows < options.min_confirm_windows) {
        return { points: 0, reasons: ['insufficient_persistence'] };
    }
    if (!options.require_persistence && row.confirming_windows < 1) {
        return { points: 0, reasons: ['not_suppressed'] };
    }
    if (require_trend && row.trend !== 'SUPPRESSION STRENGTHENING') {
        return { points: 0, reasons: ['trend_not_strengthening'] };
    }

    let points = 0;
    const reasons = [];

    points += levelScorePoints(row.level, options);
    reasons.push(`level_${row.level}`);

    if (row.confirming_windows >= 3) {
        points += options.score_persist_3;
        reasons.push('persist_3');
    } else if (row.confirming_windows === 2) {
        points += options.score_persist_2;
        reasons.push('persist_2');
    } else {
        points += options.score_persist_1;
        reasons.push('persist_1');
    }

    if (row.confirming_windows === 3) {
        points += options.score_all_windows;
        reasons.push('all_windows');
    }

    if (row.trend === 'SUPPRESSION STRENGTHENING') {
        points += options.score_trend_strengthen;
        reasons.push('trend_strengthen');
    }

    points += options.score_belongs_to_over;
    reasons.push('belongs_to_over');

    return { points, reasons };
};

/**
 * Score Over 1 / 2 / 3 from suppressed losing digits.
 */
export const scoreOverContracts = analysis => {
    const { options, digit_rows } = analysis;
    const by_digit = new Map(digit_rows.map(r => [r.digit, r]));
    const enabled = [];
    if (options.enable_over_1) enabled.push(1);
    if (options.enable_over_2) enabled.push(2);
    if (options.enable_over_3) enabled.push(3);

    const contracts = enabled.map(barrier => {
        const losing = OVER_LOSING_DIGITS[barrier] || [];
        const digit_scores = [];
        let total = 0;
        const suppressed_losing = [];

        losing.forEach(digit => {
            const row = by_digit.get(digit);
            const scored = scoreDigitForOver(row, options, options.require_trend);
            if (scored.points > 0 && row) {
                suppressed_losing.push(digit);
                digit_scores.push({ digit, ...scored, level: row.level, row });
                total += scored.points;
            }
        });

        digit_scores.sort((a, b) => b.points - a.points);

        let strength = 'NONE';
        if (total >= options.min_signal_score + 6) strength = 'VERY HIGH';
        else if (total >= options.min_signal_score + 3) strength = 'HIGH';
        else if (total >= options.min_signal_score) strength = 'MODERATE';
        else if (total > 0) strength = 'WEAK';

        return {
            barrier,
            label: `OVER ${barrier}`,
            score: total,
            suppressed_losing_digits: suppressed_losing,
            digit_scores,
            signal_strength: strength,
            passes:
                total >= options.min_signal_score &&
                suppressed_losing.length > 0 &&
                (!options.require_persistence ||
                    suppressed_losing.some(d => {
                        const row = by_digit.get(d);
                        return row && row.confirming_windows >= options.min_confirm_windows;
                    })),
        };
    });

    contracts.sort((a, b) => b.score - a.score);
    return contracts;
};

export const classifyStrategyOutput = (best, min_score) => {
    if (!best || !best.passes) {
        return 'NO SIGNAL';
    }
    const score = best.score;
    if (score >= min_score + 8) return 'VERY STRONG SIGNAL';
    if (score >= min_score + 5) return 'STRONG SIGNAL';
    if (score >= min_score + 2) return 'MODERATE SIGNAL';
    return 'WEAK SIGNAL';
};

/**
 * Over 1 / Over 2 qualify as drivers when they fully pass their suppression score.
 */
export const analysisContractPasses = contract => Boolean(contract?.passes);

/** @deprecated Use analysisContractPasses */
export const higherBarrierDrivesOverOne = analysisContractPasses;

/**
 * Select the trade candidate.
 *
 * trade_as OVER_2: Over 2 / Over 3 analysis drives the entry; always trade Over 2.
 * Otherwise: best passing enabled Over contract (ranked).
 */
export const selectTradeCandidate = (contracts, options) => {
    const list = Array.isArray(contracts) ? contracts : [];

    if (options.trade_as === TRADE_AS_OVER_2) {
        const o2 = list.find(c => c.barrier === 2) || null;
        const o3 = list.find(c => c.barrier === 3) || null;

        const drivers = [];
        if (analysisContractPasses(o2)) drivers.push('OVER 2');
        if (analysisContractPasses(o3)) drivers.push('OVER 3');

        if (!drivers.length) {
            return {
                best: null,
                filter_status: 'waiting_over_2_3',
                higher_barrier_support: [],
            };
        }

        const suppressed = [
            ...new Set([
                ...(o2?.passes ? o2.suppressed_losing_digits || [] : []),
                ...(o3?.passes ? o3.suppressed_losing_digits || [] : []),
            ]),
        ].sort((a, b) => a - b);

        const score = Math.max(o2?.passes ? o2.score : 0, o3?.passes ? o3.score : 0);
        let strength = 'NONE';
        if (score >= options.min_signal_score + 6) strength = 'VERY HIGH';
        else if (score >= options.min_signal_score + 3) strength = 'HIGH';
        else if (score >= options.min_signal_score) strength = 'MODERATE';
        else if (score > 0) strength = 'WEAK';

        return {
            best: {
                barrier: 2,
                label: 'OVER 2',
                contract_type: 'DIGITOVER',
                score,
                passes: true,
                suppressed_losing_digits: suppressed,
                digit_scores: [
                    ...(o2?.passes ? o2.digit_scores || [] : []),
                    ...(o3?.passes ? o3.digit_scores || [] : []),
                ],
                signal_strength: strength,
                filter_status: 'driven_by_over_2_3',
                higher_barrier_support: drivers,
            },
            filter_status: 'driven_by_over_2_3',
            higher_barrier_support: drivers,
        };
    }

    const passing = list.filter(c => c.passes);
    const limited = passing.slice(0, options.max_simultaneous_signals);
    const best = limited[0] || null;
    return {
        best,
        filter_status: best ? 'ranked' : 'none',
        higher_barrier_support: [],
    };
};

const fmtPct = value => `${(Math.round(value * 100) / 100).toFixed(2)}%`;

export const buildSuppressionJournalMessages = (
    analysis,
    contracts,
    best,
    strategy_output,
    filter_meta = {}
) => {
    const messages = [];
    const { options, digit_rows, primary_digit, secondary_digit, ready, tick_count, need } =
        analysis;

    if (!ready) {
        messages.push({
            className: 'journal__text',
            message: `Digit Suppression: collecting ticks ${tick_count}/${need}…`,
        });
        return messages;
    }

    const top = [...digit_rows]
        .filter(r => r.avg_suppression > 0)
        .sort((a, b) => b.avg_suppression - a.avg_suppression)
        .slice(0, 4);

    messages.push({
        className: 'journal__text',
        message: `DIGIT | SHORT(${options.short_window}) | MED(${options.medium_window}) | LONG(${options.long_window}) | AVG | SUPP | STATUS`,
    });

    top.forEach(row => {
        messages.push({
            className:
                row.digit === primary_digit
                    ? 'journal__text--success'
                    : row.digit === secondary_digit
                      ? 'journal__text'
                      : 'journal__text',
            message: `${row.digit} | ${fmtPct(row.short_pct)} | ${fmtPct(row.medium_pct)} | ${fmtPct(row.long_pct)} | ${fmtPct(row.avg_pct)} | ${fmtPct(row.avg_suppression)} | ${row.status}`,
        });
    });

    messages.push({
        className: 'journal__text',
        message: `PRIMARY SUPPRESSED: ${primary_digit >= 0 ? primary_digit : '—'} | SECONDARY: ${secondary_digit >= 0 ? secondary_digit : '—'}`,
    });

    contracts.forEach(c => {
        messages.push({
            className: c.passes ? 'journal__text--success' : 'journal__text',
            message: `${c.label} Score: ${c.score} | Losing suppressed: [${c.suppressed_losing_digits.join(', ') || '—'}] | ${c.signal_strength}`,
        });
    });

    if (options.trade_as === TRADE_AS_OVER_2) {
        const support = filter_meta.higher_barrier_support || [];
        const status = filter_meta.filter_status || '';
        if (status === 'waiting_over_2_3') {
            messages.push({
                className: 'journal__text',
                message:
                    'Waiting — Over 2 / Over 3 suppression must pass before trading Over 2.',
            });
        } else if (status === 'driven_by_over_2_3' && best?.passes) {
            messages.push({
                className: 'journal__text--success',
                message: `OVER 2 entry driven by ${support.join(' + ') || 'Over 2 / Over 3'} analysis.`,
            });
        }
    }

    if (best?.passes) {
        const primary_row = analysis.primary_row;
        const trade_label = options.trade_as === TRADE_AS_OVER_2 ? 'OVER 2' : best.label;
        messages.push({
            className: 'journal__text--success',
            message: `${strategy_output} → TRADE: ${trade_label} (score ${best.score}) | Primary digit ${primary_digit} | Supp ${primary_row ? fmtPct(primary_row.avg_suppression) : '—'} | Persist ${primary_row ? primary_row.confirming_windows : 0}/3`,
        });
    } else {
        messages.push({
            className: 'journal__text',
            message:
                options.trade_as === TRADE_AS_OVER_2
                    ? 'NO SIGNAL — Over 2 / Over 3 analysis has not confirmed an Over 2 entry yet.'
                    : 'NO SIGNAL — thresholds not met for Over 1 / 2 / 3.',
        });
    }

    return messages;
};

/**
 * Full evaluation for Free Bot / Blockly.
 *
 * @param {Array<number|string>} digits oldest → newest
 * @param {object} raw_options
 * @returns {object}
 */
export const evaluateIndividualDigitSuppression = (digits, raw_options = {}) => {
    const analysis = analyzeDigitSuppression(digits, raw_options);
    const { options } = analysis;

    if (!analysis.ready) {
        return {
            prediction: -1,
            barrier: -1,
            matched: false,
            allowed: false,
            strategy_output: 'NO SIGNAL',
            recommended_contract: null,
            primary_digit: -1,
            secondary_digit: -1,
            analysis,
            contracts: [],
            best: null,
            filter_status: 'collecting',
            higher_barrier_support: [],
            journal_messages: options.journal_enabled
                ? buildSuppressionJournalMessages(analysis, [], null, 'NO SIGNAL')
                : [],
        };
    }

    const contracts = scoreOverContracts(analysis);
    const selection = selectTradeCandidate(contracts, options);
    const best = selection.best;
    const strategy_output = classifyStrategyOutput(best, options.min_signal_score);

    const journal_messages = options.journal_enabled
        ? buildSuppressionJournalMessages(analysis, contracts, best, strategy_output, selection)
        : [];

    const barrier =
        best && options.trade_as === TRADE_AS_OVER_2 ? 2 : best ? best.barrier : -1;

    return {
        prediction: barrier,
        barrier,
        matched: Boolean(best),
        allowed: Boolean(best),
        strategy_output,
        recommended_contract: best
            ? options.trade_as === TRADE_AS_OVER_2
                ? 'OVER 2'
                : best.label
            : null,
        contract_type:
            best && options.trade_as === TRADE_AS_OVER_2
                ? 'DIGITOVER'
                : best?.contract_type || null,
        primary_digit: analysis.primary_digit,
        secondary_digit: analysis.secondary_digit,
        suppression_strength: analysis.primary_row?.avg_suppression ?? 0,
        persistence: analysis.primary_row
            ? `${analysis.primary_row.confirming_windows}/3`
            : '0/3',
        final_score: best ? best.score : 0,
        filter_status: selection.filter_status,
        higher_barrier_support: selection.higher_barrier_support,
        analysis,
        contracts,
        best,
        journal_messages,
    };
};
