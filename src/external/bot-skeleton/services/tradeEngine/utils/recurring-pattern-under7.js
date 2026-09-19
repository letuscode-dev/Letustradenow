/**
 * Recurring Pattern Under 7 Consistency
 *
 * Sliding digit patterns. When a pattern recurs, measure how often the next
 * digit is Under 7 (0–6) AND how consistently that behavior repeats.
 * Prior occurrences only — no look-ahead. Contract is DIGITUNDER barrier 7 only.
 */

export const BASELINE_UNDER7_PCT = 70;
export const UNDER7_BARRIER = 7;

export const STATUS = {
    NO_COMPLETE_PATTERN: 'NO_COMPLETE_PATTERN',
    INSUFFICIENT_OCCURRENCES: 'INSUFFICIENT_OCCURRENCES',
    UNDER7_RATE_TOO_LOW: 'UNDER7_RATE_TOO_LOW',
    EDGE_TOO_LOW: 'EDGE_TOO_LOW',
    CONSISTENCY_TOO_LOW: 'CONSISTENCY_TOO_LOW',
    RECENT_RATE_TOO_LOW: 'RECENT_RATE_TOO_LOW',
    ROLLING_RANGE_TOO_HIGH: 'ROLLING_RANGE_TOO_HIGH',
    LOSING_STREAK_TOO_HIGH: 'LOSING_STREAK_TOO_HIGH',
    SCORE_TOO_LOW: 'SCORE_TOO_LOW',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    VALID_SIGNAL: 'VALID_SIGNAL',
    WATCHING: 'WATCHING',
};

const ACTIVE_DEFAULTS = {
    min_occurrences: 10,
    min_under7_rate: 75,
    min_edge: 5,
    min_consistency_score: 70,
    min_recent_rate: 70,
    max_rolling_range: 30,
    max_losing_streak: 5,
    min_signal_score: 0,
};

const STRICT_DEFAULTS = {
    min_occurrences: 20,
    min_under7_rate: 80,
    min_edge: 10,
    min_consistency_score: 80,
    min_recent_rate: 75,
    max_rolling_range: 20,
    max_losing_streak: 3,
    min_signal_score: 0,
};

export const DEFAULT_OPTIONS = {
    pattern_length: 3,
    analysis_window: 1000,
    recent_window: 10,
    rolling_window: 10,
    block_size: 5,
    min_block_rate: 60,
    mode: 'active',
    journal_enabled: true,
    signal_cooldown_tips: 1,
    ...ACTIVE_DEFAULTS,
};

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const isUnder7Win = digit => digit !== null && digit < UNDER7_BARRIER;

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toPositiveInt = (value, fallback, min = 1, max = 100000) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

const toNonNegNumber = (value, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
};

const hasOption = (options, key) => {
    if (!Object.prototype.hasOwnProperty.call(options, key)) return false;
    const v = options[key];
    return v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v));
};

const normalizeMode = value => {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    return raw === 'strict' ? 'strict' : 'active';
};

export const normalizeRecurringPatternUnder7Options = (options = {}) => {
    const mode = normalizeMode(options.mode ?? options.signal_mode);
    const presets = mode === 'strict' ? STRICT_DEFAULTS : ACTIVE_DEFAULTS;
    const d = DEFAULT_OPTIONS;
    const length = toPositiveInt(options.pattern_length, d.pattern_length, 2, 6);

    const pick = (key, fallback) => (hasOption(options, key) ? options[key] : fallback);

    let min_occurrences = toPositiveInt(
        pick('min_occurrences', presets.min_occurrences),
        presets.min_occurrences,
        1,
        100000
    );
    let min_under7_rate = toNonNegNumber(pick('min_under7_rate', presets.min_under7_rate), presets.min_under7_rate);
    let min_edge = toNonNegNumber(pick('min_edge', presets.min_edge), presets.min_edge);
    let min_consistency_score = toNonNegNumber(
        pick('min_consistency_score', presets.min_consistency_score),
        presets.min_consistency_score
    );
    let min_recent_rate = toNonNegNumber(pick('min_recent_rate', presets.min_recent_rate), presets.min_recent_rate);
    let max_rolling_range = toNonNegNumber(
        pick('max_rolling_range', presets.max_rolling_range),
        presets.max_rolling_range
    );
    let max_losing_streak = toPositiveInt(
        pick('max_losing_streak', presets.max_losing_streak),
        presets.max_losing_streak,
        0,
        1000
    );
    let min_signal_score = toNonNegNumber(
        pick('min_signal_score', presets.min_signal_score),
        presets.min_signal_score
    );

    if (mode === 'strict') {
        min_occurrences = Math.max(min_occurrences, STRICT_DEFAULTS.min_occurrences);
        min_under7_rate = Math.max(min_under7_rate, STRICT_DEFAULTS.min_under7_rate);
        min_edge = Math.max(min_edge, STRICT_DEFAULTS.min_edge);
        min_consistency_score = Math.max(min_consistency_score, STRICT_DEFAULTS.min_consistency_score);
        min_recent_rate = Math.max(min_recent_rate, STRICT_DEFAULTS.min_recent_rate);
        max_rolling_range = Math.min(max_rolling_range, STRICT_DEFAULTS.max_rolling_range);
        max_losing_streak = Math.min(max_losing_streak, STRICT_DEFAULTS.max_losing_streak);
    }

    return {
        pattern_length: length,
        min_pattern_length: length,
        max_pattern_length: length,
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 20, 10000),
        recent_window: toPositiveInt(options.recent_window, d.recent_window, 2, 500),
        rolling_window: toPositiveInt(options.rolling_window, d.rolling_window, 2, 500),
        block_size: toPositiveInt(options.block_size, d.block_size, 2, 100),
        min_block_rate: toNonNegNumber(options.min_block_rate, d.min_block_rate),
        mode,
        min_occurrences,
        min_under7_rate,
        min_edge,
        min_consistency_score,
        min_recent_rate,
        max_rolling_range,
        max_losing_streak,
        min_signal_score,
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        signal_cooldown_tips: toPositiveInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
    };
};

const patternKey = digits => digits.join('-');

const createPatternRecord = () => ({
    next_digits: [],
    outcomes: [], // 1 = Under 7 win, 0 = loss
    occurrence_indices: [],
    live: { signals: 0, wins: 0, losses: 0 },
});

export const createRecurringPatternUnder7State = () => ({
    digits: [],
    absolute_index: -1,
    patterns: {},
    bootstrapped: false,
    last_plain_fingerprint: null,
    last_processed_epoch: null,
    last_signal_key: null,
    last_signal_abs: -1,
    last_result: null,
    last_result_fp: '',
    tick_index: -1,
    last_status: STATUS.WATCHING,
    last_rejection: '',
    patterns_evaluated: 0,
    valid_signals: 0,
    live: {
        signals: 0,
        wins: 0,
        losses: 0,
        win_streak: 0,
        loss_streak: 0,
        max_win_streak: 0,
        max_loss_streak: 0,
        history: [],
    },
    pending_outcome: null,
});

export const resetRecurringPatternUnder7State = (state = null) => {
    const next = createRecurringPatternUnder7State();
    if (!state || typeof state !== 'object') return next;
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, next);
    return state;
};

const getPatternRecord = (state, key) => {
    if (!state.patterns[key]) state.patterns[key] = createPatternRecord();
    return state.patterns[key];
};

const normalizeTicks = ticks =>
    (Array.isArray(ticks) ? ticks : []).flatMap(item => {
        const digit = toDigit(item && typeof item === 'object' ? item.digit ?? item.quote : item);
        if (digit === null) return [];
        const epoch = item && typeof item === 'object' ? Number(item.epoch) : NaN;
        return [{ digit, epoch: Number.isFinite(epoch) ? epoch : null }];
    });

const selectTicksToProcess = (ticks, state) => {
    const has_epochs = ticks.some(tick => tick.epoch !== null);
    if (has_epochs) return ticks;

    const fingerprint = ticks.map(tick => tick.digit).join('');
    if (!fingerprint) return [];

    if (!state.bootstrapped || !state.last_plain_fingerprint) {
        state.last_plain_fingerprint = fingerprint;
        return ticks;
    }
    if (fingerprint === state.last_plain_fingerprint) return [];

    const prev = state.last_plain_fingerprint;
    let start = 0;
    if (fingerprint.length >= prev.length && fingerprint.slice(0, prev.length) === prev) {
        start = prev.length;
    } else if (
        fingerprint.length === prev.length &&
        prev.length > 0 &&
        fingerprint.slice(0, -1) === prev.slice(1)
    ) {
        start = fingerprint.length - 1;
    } else if (fingerprint.length === prev.length + 1 && fingerprint.slice(0, -1) === prev) {
        start = prev.length;
    } else {
        state.bootstrapped = false;
        state.digits = [];
        state.patterns = {};
        state.absolute_index = -1;
        start = 0;
    }
    state.last_plain_fingerprint = fingerprint;
    return ticks.slice(Math.max(0, start));
};

const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const stdev = values => {
    if (values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / values.length;
    return Math.sqrt(variance);
};

const rateFromOutcomes = outcomes => {
    if (!outcomes.length) return 0;
    let wins = 0;
    for (let i = 0; i < outcomes.length; i++) if (outcomes[i] === 1) wins += 1;
    return (wins / outcomes.length) * 100;
};

const streakStats = outcomes => {
    let max_win = 0;
    let max_loss = 0;
    let cur_win = 0;
    let cur_loss = 0;
    let win_streak_sum = 0;
    let win_streak_count = 0;
    let current_loss_streak = 0;

    for (let i = 0; i < outcomes.length; i++) {
        if (outcomes[i] === 1) {
            if (cur_loss > 0) cur_loss = 0;
            cur_win += 1;
            max_win = Math.max(max_win, cur_win);
        } else {
            if (cur_win > 0) {
                win_streak_sum += cur_win;
                win_streak_count += 1;
                cur_win = 0;
            }
            cur_loss += 1;
            max_loss = Math.max(max_loss, cur_loss);
        }
    }
    if (cur_win > 0) {
        win_streak_sum += cur_win;
        win_streak_count += 1;
    }

    // Current losing streak from the end
    for (let i = outcomes.length - 1; i >= 0; i--) {
        if (outcomes[i] === 0) current_loss_streak += 1;
        else break;
    }

    return {
        max_win_streak: max_win,
        max_loss_streak: max_loss,
        avg_win_streak: win_streak_count > 0 ? win_streak_sum / win_streak_count : 0,
        current_loss_streak,
    };
};

const switchRate = outcomes => {
    if (outcomes.length < 2) return 0;
    let switches = 0;
    for (let i = 1; i < outcomes.length; i++) {
        if (outcomes[i] !== outcomes[i - 1]) switches += 1;
    }
    return (switches / (outcomes.length - 1)) * 100;
};

const rollingRates = (outcomes, window) => {
    const w = Math.max(2, window);
    if (outcomes.length < w) {
        const single = rateFromOutcomes(outcomes);
        return {
            rates: outcomes.length ? [single] : [],
            average: single,
            minimum: single,
            maximum: single,
            range: 0,
            stdev: 0,
        };
    }
    const rates = [];
    for (let i = 0; i <= outcomes.length - w; i++) {
        rates.push(rateFromOutcomes(outcomes.slice(i, i + w)));
    }
    const minimum = Math.min(...rates);
    const maximum = Math.max(...rates);
    return {
        rates,
        average: mean(rates),
        minimum,
        maximum,
        range: maximum - minimum,
        stdev: stdev(rates),
    };
};

const blockStats = (outcomes, block_size, min_block_rate) => {
    const size = Math.max(2, block_size);
    const blocks = [];
    for (let i = 0; i + size <= outcomes.length; i += size) {
        blocks.push(rateFromOutcomes(outcomes.slice(i, i + size)));
    }
    // Remainder as final partial block if at least half size
    const rem = outcomes.length % size;
    if (rem >= Math.ceil(size / 2) && outcomes.length >= size) {
        blocks.push(rateFromOutcomes(outcomes.slice(outcomes.length - rem)));
    } else if (!blocks.length && outcomes.length) {
        blocks.push(rateFromOutcomes(outcomes));
    }
    const passing = blocks.filter(r => r + 1e-9 >= min_block_rate).length;
    return {
        blocks,
        passing,
        total: blocks.length,
        consistency: blocks.length ? (passing / blocks.length) * 100 : 0,
    };
};

const classifyConsistency = score => {
    if (score >= 90) return 'VERY HIGH CONSISTENCY';
    if (score >= 80) return 'HIGH CONSISTENCY';
    if (score >= 70) return 'MODERATE CONSISTENCY';
    if (score >= 60) return 'LOW CONSISTENCY';
    return 'VERY LOW CONSISTENCY';
};

const classifyQuality = ({ occurrences, under7_rate, consistency_score, min_occurrences }) => {
    if (occurrences < min_occurrences) return 'INSUFFICIENT DATA';
    if (under7_rate >= 80 && consistency_score >= 80) return 'STRONG & CONSISTENT';
    if (under7_rate >= 80 && consistency_score < 70) return 'STRONG BUT UNSTABLE';
    if (under7_rate >= 70) return 'MODERATE';
    return 'WEAK';
};

const classifyTrend = (older_rate, recent_rate) => {
    const delta = recent_rate - older_rate;
    if (delta >= 5) return 'IMPROVING';
    if (delta <= -5) return 'WEAKENING';
    return 'STABLE';
};

/**
 * Consistency score 0–100 — deliberately NOT a copy of Under 7 %.
 * 30% rolling stability, 20% block, 15% recent, 15% losing-streak control,
 * 10% switch-rate stability, 10% historical-vs-recent stability.
 */
export const computeConsistencyScore = ({
    rolling,
    block,
    recent_rate,
    historical_rate,
    max_loss_streak,
    switch_rate,
    max_losing_streak_cap = 5,
}) => {
    const rolling_stability = Math.max(0, 100 - rolling.range * 2.5 - rolling.stdev);
    const block_consistency = block.consistency;
    const recent_consistency = Math.min(100, Math.max(0, (recent_rate - 50) * 2));
    const streak_control = Math.max(
        0,
        100 - (max_loss_streak / Math.max(1, max_losing_streak_cap)) * 100
    );
    // Lower switch rate = more stable runs (ideal around 20–40%)
    const switch_stability = Math.max(0, 100 - Math.abs(switch_rate - 30) * 1.5);
    const hist_recent_stability = Math.max(0, 100 - Math.abs(historical_rate - recent_rate) * 3);

    return Math.round(
        Math.min(
            100,
            Math.max(
                0,
                rolling_stability * 0.3 +
                    block_consistency * 0.2 +
                    recent_consistency * 0.15 +
                    streak_control * 0.15 +
                    switch_stability * 0.1 +
                    hist_recent_stability * 0.1
            )
        )
    );
};

const computeSignalScore = ({
    under7_rate,
    edge,
    consistency_score,
    recent_rate,
    rolling,
    block,
    trend,
}) => {
    const rate_part = Math.min(30, Math.max(0, (under7_rate - 70) * 2));
    const edge_part = Math.min(15, Math.max(0, edge * 1.5));
    const cons_part = consistency_score * 0.25;
    const recent_part = Math.min(15, Math.max(0, (recent_rate - 60) * 0.75));
    const rolling_part = Math.min(10, Math.max(0, 10 - rolling.range / 5));
    const block_part = block.consistency * 0.05;
    const trend_part = trend === 'IMPROVING' ? 5 : trend === 'STABLE' ? 3 : 0;
    return Math.round(
        Math.min(100, Math.max(0, rate_part + edge_part + cons_part + recent_part + rolling_part + block_part + trend_part))
    );
};

const analyzeOutcomes = (outcomes, options) => {
    const total = outcomes.length;
    const wins = outcomes.reduce((s, o) => s + (o === 1 ? 1 : 0), 0);
    const losses = total - wins;
    const under7_rate = total ? (wins / total) * 100 : 0;
    const edge = under7_rate - BASELINE_UNDER7_PCT;

    const recent_slice = outcomes.slice(-options.recent_window);
    const recent_wins = recent_slice.reduce((s, o) => s + (o === 1 ? 1 : 0), 0);
    const recent_rate = recent_slice.length ? (recent_wins / recent_slice.length) * 100 : 0;

    const older_slice =
        outcomes.length > options.recent_window
            ? outcomes.slice(0, Math.max(0, outcomes.length - options.recent_window))
            : outcomes;
    const older_rate = rateFromOutcomes(older_slice);
    const trend = classifyTrend(older_rate, recent_rate);
    const recent_change = recent_rate - under7_rate;

    const rolling = rollingRates(outcomes, options.rolling_window);
    const block = blockStats(outcomes, options.block_size, options.min_block_rate);
    const streaks = streakStats(outcomes);
    const switch_rate = switchRate(outcomes);

    const consistency_score = computeConsistencyScore({
        rolling,
        block,
        recent_rate,
        historical_rate: under7_rate,
        max_loss_streak: streaks.max_loss_streak,
        switch_rate,
        max_losing_streak_cap: options.max_losing_streak,
    });

    const signal_score = computeSignalScore({
        under7_rate,
        edge,
        consistency_score,
        recent_rate,
        rolling,
        block,
        trend,
    });

    const visual = outcomes.map(o => (o === 1 ? 'W' : 'L')).join(' ');

    return {
        total,
        wins,
        losses,
        under7_rate,
        edge,
        recent_wins,
        recent_total: recent_slice.length,
        recent_rate,
        recent_change,
        older_rate,
        trend,
        rolling,
        block,
        streaks,
        switch_rate,
        consistency_score,
        consistency_class: classifyConsistency(consistency_score),
        quality: classifyQuality({
            occurrences: total,
            under7_rate,
            consistency_score,
            min_occurrences: options.min_occurrences,
        }),
        signal_score,
        visual,
    };
};

const evaluatePatternCandidate = (state, pattern_digits, options) => {
    const key = patternKey(pattern_digits);
    const record = getPatternRecord(state, key);
    const stats = analyzeOutcomes(record.outcomes, options);
    const reasons = [];
    let status = STATUS.VALID_SIGNAL;

    if (stats.total < options.min_occurrences) {
        reasons.push(
            `WAITING: Pattern occurrences = ${stats.total} | Required = ${options.min_occurrences}`
        );
        status = STATUS.INSUFFICIENT_OCCURRENCES;
    } else if (stats.under7_rate + 1e-9 < options.min_under7_rate) {
        reasons.push(
            `REJECTED: UNDER 7 RATE BELOW THRESHOLD | Observed: ${stats.under7_rate.toFixed(2)}% | Required: ${options.min_under7_rate}%`
        );
        status = STATUS.UNDER7_RATE_TOO_LOW;
    } else if (stats.edge + 1e-9 < options.min_edge) {
        reasons.push(
            `REJECTED: EDGE TOO LOW | Observed: +${stats.edge.toFixed(2)}pp | Required: +${options.min_edge}%`
        );
        status = STATUS.EDGE_TOO_LOW;
    } else if (stats.consistency_score + 1e-9 < options.min_consistency_score) {
        reasons.push(
            `REJECTED: PATTERN TOO INCONSISTENT | Consistency: ${stats.consistency_score} | Required: ${options.min_consistency_score}`
        );
        status = STATUS.CONSISTENCY_TOO_LOW;
    } else if (stats.recent_rate + 1e-9 < options.min_recent_rate) {
        reasons.push(
            `REJECTED: RECENT PERFORMANCE WEAK | Historical: ${stats.under7_rate.toFixed(2)}% | Recent: ${stats.recent_rate.toFixed(2)}% | Required: ${options.min_recent_rate}%`
        );
        status = STATUS.RECENT_RATE_TOO_LOW;
    } else if (stats.rolling.range - 1e-9 > options.max_rolling_range) {
        reasons.push(
            `REJECTED: HISTORICAL PERFORMANCE TOO VARIABLE | Rolling Range: ${stats.rolling.range.toFixed(2)}% | Maximum: ${options.max_rolling_range}%`
        );
        status = STATUS.ROLLING_RANGE_TOO_HIGH;
    } else if (stats.streaks.max_loss_streak > options.max_losing_streak) {
        reasons.push(
            `REJECTED: LOSING STREAK TOO HIGH | Max Loss Streak: ${stats.streaks.max_loss_streak} | Maximum: ${options.max_losing_streak}`
        );
        status = STATUS.LOSING_STREAK_TOO_HIGH;
    } else if (stats.signal_score + 1e-9 < options.min_signal_score) {
        reasons.push(
            `REJECTED: SIGNAL SCORE TOO LOW | Score: ${stats.signal_score} | Required: ${options.min_signal_score}`
        );
        status = STATUS.SCORE_TOO_LOW;
    }

    const qualified = reasons.length === 0 && stats.total > 0;
    if (qualified) status = STATUS.VALID_SIGNAL;

    return {
        pattern: key,
        pattern_digits: [...pattern_digits],
        length: pattern_digits.length,
        stats,
        qualified,
        reasons,
        status,
        prediction: qualified ? UNDER7_BARRIER : -1,
        rejection: reasons[0] || '',
        contract_type: 'DIGITUNDER',
        barrier: UNDER7_BARRIER,
    };
};

const buildJournal = ({ best, options, matched, status, rejection, patterns_evaluated, valid_signals, cooldown }) => {
    const messages = [];
    messages.push({
        className: 'journal__text',
        message: `══ RECURRING PATTERN UNDER 7 (${String(options.mode).toUpperCase()}) ══`,
    });

    if (!best) {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${STATUS.NO_COMPLETE_PATTERN} — waiting for a full ${options.pattern_length}-digit pattern.`,
        });
        messages.push({
            className: 'journal__text',
            message: `Patterns evaluated: ${patterns_evaluated} | Valid signals: ${valid_signals}`,
        });
        return messages;
    }

    const s = best.stats;
    messages.push({
        className: 'journal__text',
        message: `Current Pattern: ${best.pattern} | Length: ${best.length} | Occurrences: ${s.total}`,
    });
    messages.push({
        className: 'journal__text',
        message: `UNDER 7: Wins ${s.wins} | Losses ${s.losses} | Rate ${s.under7_rate.toFixed(2)}% | Baseline ${BASELINE_UNDER7_PCT}% | Edge +${s.edge.toFixed(2)}pp`,
    });
    messages.push({
        className: 'journal__text',
        message: `RECENT last ${s.recent_total}: ${s.recent_wins}/${s.recent_total} = ${s.recent_rate.toFixed(1)}% | Change ${s.recent_change >= 0 ? '+' : ''}${s.recent_change.toFixed(1)}pp | Trend ${s.trend}`,
    });
    messages.push({
        className: 'journal__text',
        message: `ROLLING: avg ${s.rolling.average.toFixed(1)}% | min ${s.rolling.minimum.toFixed(1)}% | max ${s.rolling.maximum.toFixed(1)}% | range ${s.rolling.range.toFixed(1)}pp`,
    });
    messages.push({
        className: 'journal__text',
        message: `BLOCKS: ${s.block.passing}/${s.block.total} pass (≥${options.min_block_rate}%) = ${s.block.consistency.toFixed(1)}%`,
    });
    messages.push({
        className: 'journal__text',
        message: `STREAKS: max W ${s.streaks.max_win_streak} | max L ${s.streaks.max_loss_streak} | cur L ${s.streaks.current_loss_streak} | Switch ${s.switch_rate.toFixed(1)}%`,
    });
    if (s.visual) {
        const short = s.visual.length > 80 ? `… ${s.visual.slice(-80)}` : s.visual;
        messages.push({ className: 'journal__text', message: `History: ${short}` });
    }
    messages.push({
        className: 'journal__text',
        message: `Consistency ${s.consistency_score}/100 (${s.consistency_class}) | Signal ${s.signal_score}/100 | Quality: ${s.quality}`,
    });

    if (cooldown) {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${STATUS.COOLDOWN_ACTIVE} — waiting ${options.signal_cooldown_tips} tip(s) after last signal.`,
        });
    } else if (matched) {
        messages.push({
            className: 'journal__text--success',
            message: `STATUS: VALID SIGNAL — ACTION: UNDER ${UNDER7_BARRIER}`,
        });
    } else {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${status || best.status} — ${rejection || best.rejection || 'No qualifying pattern'}`,
        });
    }

    messages.push({
        className: 'journal__text',
        message: `Patterns evaluated: ${patterns_evaluated} | Valid: ${valid_signals}`,
    });

    return messages;
};

export const recordRecurringPatternUnder7Outcome = (state, actual_digit) => {
    if (!state?.pending_outcome) return null;
    const digit = toDigit(actual_digit);
    if (digit === null) return null;

    const pending = state.pending_outcome;
    const won = isUnder7Win(digit);
    const record = getPatternRecord(state, pending.pattern);
    record.live.signals += 1;
    if (won) {
        record.live.wins += 1;
        state.live.wins += 1;
        state.live.win_streak += 1;
        state.live.loss_streak = 0;
        state.live.max_win_streak = Math.max(state.live.max_win_streak, state.live.win_streak);
    } else {
        record.live.losses += 1;
        state.live.losses += 1;
        state.live.loss_streak += 1;
        state.live.win_streak = 0;
        state.live.max_loss_streak = Math.max(state.live.max_loss_streak, state.live.loss_streak);
    }
    state.live.signals += 1;
    state.live.history.push({
        pattern: pending.pattern,
        barrier: UNDER7_BARRIER,
        contract_type: 'DIGITUNDER',
        actual: digit,
        result: won ? 'WIN' : 'LOSS',
        under7_rate: pending.under7_rate,
        consistency_score: pending.consistency_score,
        signal_score: pending.signal_score,
    });
    if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, pattern: pending.pattern };
};

const recordFollower = (state, pattern_digits, follower, end_abs) => {
    const key = patternKey(pattern_digits);
    const record = getPatternRecord(state, key);
    record.next_digits.push(follower);
    record.outcomes.push(isUnder7Win(follower) ? 1 : 0);
    record.occurrence_indices.push(end_abs);
    if (record.next_digits.length > 5000) {
        record.next_digits = record.next_digits.slice(-5000);
        record.outcomes = record.outcomes.slice(-5000);
        record.occurrence_indices = record.occurrence_indices.slice(-5000);
    }
};

const patternDigitsFrom = (state, idx, L) => state.digits.slice(idx - L + 1, idx + 1);

export const evaluateRecurringPatternUnder7 = (
    raw_ticks,
    raw_options = {},
    state = createRecurringPatternUnder7State()
) => {
    const options = normalizeRecurringPatternUnder7Options(raw_options);
    const journal_messages = [];
    const window_ticks = normalizeTicks(raw_ticks).slice(-options.analysis_window);
    const ticks = selectTicksToProcess(window_ticks, state);
    let prediction = -1;
    let best = null;
    let status = STATUS.WATCHING;
    let rejection = '';
    let patterns_evaluated = 0;
    let valid_signals = 0;

    const tip = window_ticks.length ? window_ticks[window_ticks.length - 1] : null;
    const result_fp = tip
        ? `${tip.epoch ?? 'e'}:${window_ticks.length}:${tip.digit}`
        : `empty:${state.last_signal_key || ''}`;

    if (!ticks.length && state.last_result && state.last_result_fp === result_fp) {
        return {
            ...state.last_result,
            journal_messages: options.journal_enabled ? state.last_result.journal_messages || [] : [],
        };
    }

    if (ticks.length) {
        const bootstrapping = !state.bootstrapped;
        const L = options.pattern_length;

        ticks.forEach(tick => {
            if (tick.epoch !== null && tick.epoch === state.last_processed_epoch) return;
            if (
                tick.epoch !== null &&
                state.last_processed_epoch !== null &&
                tick.epoch < state.last_processed_epoch
            ) {
                return;
            }

            if (state.pending_outcome) {
                recordRecurringPatternUnder7Outcome(state, tick.digit);
            }

            state.tick_index += 1;
            state.absolute_index += 1;
            state.digits.push(tick.digit);
            const abs = state.absolute_index;
            const buf_len = options.analysis_window + L + 5;
            if (state.digits.length > buf_len) {
                state.digits = state.digits.slice(-buf_len);
            }

            const idx = state.digits.length - 1;

            // 1) Prior pattern ending at previous tip gets this tip as Under 7 outcome.
            if (idx >= 1 && idx - L >= 0) {
                const pattern_digits = state.digits.slice(idx - L, idx);
                recordFollower(state, pattern_digits, tick.digit, abs - 1);
            }

            // 2) Evaluate pattern completing on this tip (prior stats only).
            if (idx - L + 1 < 0) {
                status = STATUS.NO_COMPLETE_PATTERN;
                rejection = `Need ${L} digits for a complete pattern`;
                best = null;
            } else {
                patterns_evaluated += 1;
                const candidate = evaluatePatternCandidate(
                    state,
                    patternDigitsFrom(state, idx, L),
                    options
                );
                best = candidate;
                valid_signals = candidate.qualified ? 1 : 0;

                const cooldown =
                    options.signal_cooldown_tips > 0 &&
                    state.last_signal_abs >= 0 &&
                    abs - state.last_signal_abs <= options.signal_cooldown_tips;

                if (!bootstrapping && candidate.qualified) {
                    if (cooldown) {
                        status = STATUS.COOLDOWN_ACTIVE;
                        rejection = `Cooldown active (${abs - state.last_signal_abs}/${options.signal_cooldown_tips})`;
                    } else {
                        const signal_key = `${tick.epoch ?? state.tick_index}:${candidate.pattern}->UNDER7`;
                        if (state.last_signal_key !== signal_key) {
                            state.last_signal_key = signal_key;
                            state.last_signal_abs = abs;
                            prediction = UNDER7_BARRIER;
                            status = STATUS.VALID_SIGNAL;
                            rejection = '';
                            state.pending_outcome = {
                                pattern: candidate.pattern,
                                under7_rate: candidate.stats.under7_rate,
                                consistency_score: candidate.stats.consistency_score,
                                signal_score: candidate.stats.signal_score,
                                tip_index: abs,
                            };
                        }
                    }
                } else {
                    status = candidate.status || STATUS.WATCHING;
                    rejection = candidate.rejection || '';
                }
            }

            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    } else if (state.digits.length < options.pattern_length) {
        status = STATUS.NO_COMPLETE_PATTERN;
        rejection = `Need ${options.pattern_length} digits for a complete pattern`;
    }

    state.last_status = status;
    state.last_rejection = rejection;
    state.patterns_evaluated = patterns_evaluated;
    state.valid_signals = valid_signals;

    if (options.journal_enabled) {
        journal_messages.push(
            ...buildJournal({
                best,
                options,
                matched: prediction >= 0,
                status,
                rejection,
                patterns_evaluated,
                valid_signals,
                cooldown: status === STATUS.COOLDOWN_ACTIVE,
            })
        );
        if (journal_messages.length > 16) {
            journal_messages.splice(0, journal_messages.length - 16);
        }
    }

    const live_total = state.live.wins + state.live.losses;
    const result = {
        prediction,
        barrier: prediction >= 0 ? UNDER7_BARRIER : -1,
        matched: prediction >= 0,
        allowed: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITUNDER' : null,
        pattern: best?.pattern || '',
        pattern_length: best?.length || 0,
        under7_rate: best?.stats?.under7_rate ?? 0,
        edge: best?.stats?.edge ?? 0,
        consistency_score: best?.stats?.consistency_score ?? 0,
        signal_score: best?.stats?.signal_score ?? 0,
        occurrences: best?.stats?.total ?? 0,
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        patterns_evaluated,
        valid_signals,
        best,
        live: {
            ...state.live,
            win_rate: live_total > 0 ? (state.live.wins / live_total) * 100 : 0,
        },
        options,
        journal_messages,
    };

    state.last_result = result;
    state.last_result_fp = result_fp;
    return result;
};

/**
 * Replay / backtest with the same no-look-ahead rules as live.
 */
export const replayRecurringPatternUnder7 = (raw_ticks, raw_options = {}) => {
    const options = normalizeRecurringPatternUnder7Options({
        ...raw_options,
        journal_enabled: false,
    });
    const state = createRecurringPatternUnder7State();
    const ticks = normalizeTicks(raw_ticks);
    const digits = ticks.map(t => t.digit);
    const signals = [];
    let patterns_detected = 0;
    let valid_signals = 0;
    let consistency_sum = 0;
    let under7_sum = 0;
    let recent_sum = 0;

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateRecurringPatternUnder7(digits.slice(0, i + 1), options, state);
        if (result.pattern) patterns_detected += 1;
        if (result.matched) {
            valid_signals += 1;
            consistency_sum += result.consistency_score || 0;
            under7_sum += result.under7_rate || 0;
            recent_sum += result.best?.stats?.recent_rate || 0;
            signals.push({
                tip: i,
                pattern: result.pattern,
                under7_rate: result.under7_rate,
                consistency_score: result.consistency_score,
                signal_score: result.signal_score,
            });
        }
    }

    const wins = state.live.wins;
    const losses = state.live.losses;
    const trades = wins + losses;

    return {
        total_ticks: digits.length,
        patterns_analyzed: patterns_detected,
        valid_signals,
        trades,
        wins,
        losses,
        win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        profit_loss_units: wins - losses,
        max_losing_streak: state.live.max_loss_streak,
        average_consistency_score: valid_signals > 0 ? consistency_sum / valid_signals : 0,
        average_historical_under7_rate: valid_signals > 0 ? under7_sum / valid_signals : 0,
        average_recent_rate: valid_signals > 0 ? recent_sum / valid_signals : 0,
        signals,
        live: { ...state.live },
        options,
    };
};

export { isUnder7Win };
