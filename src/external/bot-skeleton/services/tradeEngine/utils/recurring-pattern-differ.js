/**
 * Recurring Pattern Differ
 *
 * Sliding-window digit patterns. When a pattern recurs, Differ the historically
 * most frequent NEXT digit (prior occurrences only — no look-ahead).
 *
 * ACTIVE mode (default): min occurrences + target % + advantage.
 * STRICT mode: also gap / multi-window / persistence / min score when enabled.
 */

const BASELINE_PCT = 10;

export const STATUS = {
    NO_COMPLETE_PATTERN: 'NO_COMPLETE_PATTERN',
    INSUFFICIENT_OCCURRENCES: 'INSUFFICIENT_OCCURRENCES',
    TARGET_BELOW_THRESHOLD: 'TARGET_BELOW_THRESHOLD',
    ADVANTAGE_TOO_LOW: 'ADVANTAGE_TOO_LOW',
    DOMINANCE_GAP_TOO_LOW: 'DOMINANCE_GAP_TOO_LOW',
    MULTI_WINDOW_DISAGREEMENT: 'MULTI_WINDOW_DISAGREEMENT',
    PERSISTENCE_NOT_CONFIRMED: 'PERSISTENCE_NOT_CONFIRMED',
    TARGET_DIGIT_DISABLED: 'TARGET_DIGIT_DISABLED',
    SCORE_TOO_LOW: 'SCORE_TOO_LOW',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    VALID_SIGNAL: 'VALID_SIGNAL',
    WATCHING: 'WATCHING',
};

export const DEFAULT_OPTIONS = {
    pattern_length: 3,
    min_pattern_length: 3,
    max_pattern_length: 3,
    analysis_window: 1000,
    min_occurrences: 3,
    min_target_pct: 15,
    min_advantage: 5,
    min_target_gap: 2,
    require_dominance_gap: false,
    mode: 'active', // active | strict
    recency_weighting: false,
    multi_window: false,
    multi_window_require_agree: true,
    short_window: 100,
    medium_window: 500,
    long_window: 1000,
    persistence: false,
    persistence_count: 2,
    min_signal_score: 0,
    max_pattern_age: 0,
    allowed_digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    journal_enabled: true,
    signal_cooldown_tips: 1,
};

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

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

const parseAllowedDigits = value => {
    if (Array.isArray(value)) {
        return [...new Set(value.map(toDigit).filter(d => d !== null))].sort((a, b) => a - b);
    }
    if (typeof value === 'string' && value.trim()) {
        return [
            ...new Set(
                value
                    .split(/[,;\s]+/)
                    .map(s => toDigit(s.trim()))
                    .filter(d => d !== null)
            ),
        ].sort((a, b) => a - b);
    }
    return [...DEFAULT_OPTIONS.allowed_digits];
};

const normalizeMode = value => {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    return raw === 'strict' ? 'strict' : 'active';
};

export const normalizeRecurringPatternDifferOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    const mode = normalizeMode(options.mode ?? options.signal_mode);

    // Single length preferred; fall back to min/max if provided.
    let length = toPositiveInt(
        options.pattern_length ?? options.min_pattern_length ?? options.max_pattern_length,
        d.pattern_length,
        2,
        6
    );
    let min_len = toPositiveInt(options.min_pattern_length, length, 2, 6);
    let max_len = toPositiveInt(options.max_pattern_length, length, 2, 6);
    if (options.pattern_length != null && options.pattern_length !== '') {
        min_len = length;
        max_len = length;
    }
    if (max_len < min_len) {
        const tmp = min_len;
        min_len = max_len;
        max_len = tmp;
    }

    const strict = mode === 'strict';
    const require_gap = toBool(
        options.require_dominance_gap,
        strict ? true : d.require_dominance_gap
    );

    const allowed = parseAllowedDigits(options.allowed_digits);
    return {
        pattern_length: min_len === max_len ? min_len : length,
        min_pattern_length: min_len,
        max_pattern_length: max_len,
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 20, 10000),
        min_occurrences: toPositiveInt(options.min_occurrences, d.min_occurrences, 1, 100000),
        min_target_pct: toNonNegNumber(options.min_target_pct, d.min_target_pct),
        min_advantage: toNonNegNumber(options.min_advantage, d.min_advantage),
        min_target_gap: toNonNegNumber(options.min_target_gap, d.min_target_gap),
        require_dominance_gap: require_gap,
        mode,
        recency_weighting: toBool(options.recency_weighting, d.recency_weighting),
        multi_window: toBool(options.multi_window, strict ? true : d.multi_window),
        multi_window_require_agree: toBool(
            options.multi_window_require_agree,
            d.multi_window_require_agree
        ),
        short_window: toPositiveInt(options.short_window, d.short_window, 5, 10000),
        medium_window: toPositiveInt(options.medium_window, d.medium_window, 5, 10000),
        long_window: toPositiveInt(options.long_window, d.long_window, 5, 10000),
        persistence: toBool(options.persistence, strict ? true : d.persistence),
        persistence_count: toPositiveInt(options.persistence_count, d.persistence_count, 1, 20),
        min_signal_score: toNonNegNumber(
            options.min_signal_score,
            strict ? Math.max(d.min_signal_score, 40) : d.min_signal_score
        ),
        max_pattern_age: toPositiveInt(options.max_pattern_age, d.max_pattern_age, 0, 1000000),
        allowed_digits: allowed.length ? allowed : [...d.allowed_digits],
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        signal_cooldown_tips: toPositiveInt(
            options.signal_cooldown_tips,
            d.signal_cooldown_tips,
            0,
            100
        ),
    };
};

const patternKey = digits => digits.join('-');

const createPatternRecord = () => ({
    next_digits: [],
    occurrence_indices: [],
    live: { signals: 0, wins: 0, losses: 0 },
    persistence_hits: 0,
    last_dominant: -1,
});

export const createRecurringPatternDifferState = () => ({
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

export const resetRecurringPatternDifferState = (state = null) => {
    const next = createRecurringPatternDifferState();
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

const distributionFromFollowers = (followers, options) => {
    const counts = Array.from({ length: 10 }, () => 0);
    const weights = Array.from({ length: 10 }, () => 0);
    const n = followers.length;
    if (!n) {
        return {
            counts,
            total: 0,
            percentages: counts.map(() => 0),
            weighted_percentages: counts.map(() => 0),
            target: -1,
            target_pct: 0,
            second: -1,
            second_pct: 0,
            advantage: 0,
            gap: 0,
            mode: options.recency_weighting ? 'WEIGHTED' : 'RAW',
        };
    }

    let weight_sum = 0;
    for (let i = 0; i < n; i++) {
        const d = followers[i];
        counts[d] += 1;
        const w = options.recency_weighting ? (i + 1) / n : 1;
        weights[d] += w;
        weight_sum += w;
    }

    const percentages = counts.map(c => (c / n) * 100);
    const weighted_percentages = weights.map(w => (weight_sum > 0 ? (w / weight_sum) * 100 : 0));
    const use_pct = options.recency_weighting ? weighted_percentages : percentages;

    let target = 0;
    let second = -1;
    for (let d = 1; d <= 9; d++) {
        if (use_pct[d] > use_pct[target] || (use_pct[d] === use_pct[target] && d < target)) {
            second = target;
            target = d;
        } else if (second < 0 || use_pct[d] > use_pct[second]) {
            second = d;
        }
    }
    if (second < 0) second = target === 0 ? 1 : 0;

    const target_pct = use_pct[target];
    const second_pct = use_pct[second];
    return {
        counts,
        total: n,
        percentages,
        weighted_percentages,
        target,
        target_pct,
        second,
        second_pct,
        advantage: target_pct - BASELINE_PCT,
        gap: target_pct - second_pct,
        mode: options.recency_weighting ? 'WEIGHTED' : 'RAW',
    };
};

const windowDominant = (followers, window) => {
    if (!followers.length) return -1;
    const slice = followers.slice(-Math.max(1, window));
    const counts = Array.from({ length: 10 }, () => 0);
    slice.forEach(d => {
        counts[d] += 1;
    });
    let best = 0;
    for (let d = 1; d <= 9; d++) {
        if (counts[d] > counts[best]) best = d;
    }
    return best;
};

const windowPct = (followers, digit, window) => {
    if (!followers.length) return 0;
    const slice = followers.slice(-Math.max(1, window));
    let hits = 0;
    for (let i = 0; i < slice.length; i++) {
        if (slice[i] === digit) hits += 1;
    }
    return (hits / slice.length) * 100;
};

const computeSignalScore = ({ total, target_pct, advantage, gap, live_wr }) => {
    const sample = Math.min(40, (Math.log10(Math.max(1, total)) / Math.log10(1000)) * 40);
    const pct = Math.min(25, Math.max(0, (target_pct - 10) * 2.5));
    const adv = Math.min(15, Math.max(0, advantage * 2));
    const gap_score = Math.min(10, Math.max(0, gap * 2));
    const live = Math.min(10, Math.max(0, (live_wr - 50) / 5));
    return Math.round(Math.min(100, Math.max(0, sample + pct + adv + gap_score + live)));
};

const evaluatePatternCandidate = (state, pattern_digits, tip_abs, options) => {
    const key = patternKey(pattern_digits);
    const record = getPatternRecord(state, key);
    const dist = distributionFromFollowers(record.next_digits, options);
    const length = pattern_digits.length;
    const last_idx =
        record.occurrence_indices.length > 0
            ? record.occurrence_indices[record.occurrence_indices.length - 1]
            : -1;
    const age = last_idx >= 0 ? tip_abs - last_idx : Number.POSITIVE_INFINITY;

    const live_total = record.live.wins + record.live.losses;
    const live_wr = live_total > 0 ? (record.live.wins / live_total) * 100 : 0;

    const multi = {
        short: windowPct(record.next_digits, dist.target, options.short_window),
        medium: windowPct(record.next_digits, dist.target, options.medium_window),
        long: windowPct(record.next_digits, dist.target, options.long_window),
        short_dom: windowDominant(record.next_digits, options.short_window),
        medium_dom: windowDominant(record.next_digits, options.medium_window),
        long_dom: windowDominant(record.next_digits, options.long_window),
    };

    const reasons = [];
    let status = STATUS.VALID_SIGNAL;

    if (dist.total < options.min_occurrences) {
        reasons.push(
            `WAITING: Pattern occurrences = ${dist.total} | Required = ${options.min_occurrences}`
        );
        status = STATUS.INSUFFICIENT_OCCURRENCES;
    } else if (!options.allowed_digits.includes(dist.target)) {
        reasons.push(`REJECTED: Target digit ${dist.target} disabled`);
        status = STATUS.TARGET_DIGIT_DISABLED;
    } else if (dist.target_pct + 1e-9 < options.min_target_pct) {
        reasons.push(
            `REJECTED: Target percentage = ${dist.target_pct.toFixed(2)}% | Required = ${options.min_target_pct}%`
        );
        status = STATUS.TARGET_BELOW_THRESHOLD;
    } else if (dist.advantage + 1e-9 < options.min_advantage) {
        reasons.push(
            `REJECTED: Target advantage = ${dist.advantage.toFixed(2)}% | Required = ${options.min_advantage}%`
        );
        status = STATUS.ADVANTAGE_TOO_LOW;
    } else if (
        options.require_dominance_gap &&
        dist.gap + 1e-9 < options.min_target_gap
    ) {
        reasons.push(
            `REJECTED: Dominance gap = ${dist.gap.toFixed(2)}% | Required = ${options.min_target_gap}%`
        );
        status = STATUS.DOMINANCE_GAP_TOO_LOW;
    } else if (
        options.multi_window &&
        options.multi_window_require_agree &&
        !(
            multi.short_dom === dist.target &&
            multi.medium_dom === dist.target &&
            multi.long_dom === dist.target
        )
    ) {
        reasons.push(
            `REJECTED: Multi-window disagreement (S=${multi.short_dom} M=${multi.medium_dom} L=${multi.long_dom} vs ${dist.target})`
        );
        status = STATUS.MULTI_WINDOW_DISAGREEMENT;
    } else if (options.persistence) {
        if (record.last_dominant === dist.target) {
            record.persistence_hits += 1;
        } else {
            record.last_dominant = dist.target;
            record.persistence_hits = 1;
        }
        if (record.persistence_hits < options.persistence_count) {
            reasons.push(
                `REJECTED: Persistence ${record.persistence_hits}/${options.persistence_count} for target ${dist.target}`
            );
            status = STATUS.PERSISTENCE_NOT_CONFIRMED;
        }
    }

    if (options.max_pattern_age > 0 && Number.isFinite(age) && age > options.max_pattern_age) {
        reasons.push(`REJECTED: Pattern age ${age} > ${options.max_pattern_age}`);
        if (status === STATUS.VALID_SIGNAL) status = STATUS.WATCHING;
    }

    const score = computeSignalScore({
        total: dist.total,
        target_pct: dist.target_pct,
        advantage: dist.advantage,
        gap: dist.gap,
        live_wr,
    });
    if (score + 1e-9 < options.min_signal_score) {
        reasons.push(`REJECTED: Signal score ${score} < ${options.min_signal_score}`);
        status = STATUS.SCORE_TOO_LOW;
    }

    const qualified = reasons.length === 0 && dist.target >= 0 && dist.total > 0;
    if (qualified) status = STATUS.VALID_SIGNAL;

    return {
        pattern: key,
        pattern_digits: [...pattern_digits],
        length,
        occurrences: dist.total,
        distribution: dist,
        multi,
        age: Number.isFinite(age) ? age : null,
        live_wr,
        live_signals: record.live.signals,
        score,
        qualified,
        reasons,
        status,
        prediction: qualified ? dist.target : -1,
        rejection: reasons[0] || '',
    };
};

const pickBestCandidate = candidates => {
    const qualified = candidates.filter(c => c.qualified);
    if (!qualified.length) return null;
    return [...qualified].sort(
        (a, b) =>
            b.length - a.length ||
            b.distribution.target_pct - a.distribution.target_pct ||
            b.occurrences - a.occurrences
    )[0];
};

const recordFollower = (state, pattern_digits, follower, end_abs) => {
    const key = patternKey(pattern_digits);
    const record = getPatternRecord(state, key);
    record.next_digits.push(follower);
    record.occurrence_indices.push(end_abs);
    if (record.next_digits.length > 5000) {
        record.next_digits = record.next_digits.slice(-5000);
        record.occurrence_indices = record.occurrence_indices.slice(-5000);
    }
};

const buildJournal = ({
    best,
    candidates,
    options,
    matched,
    status,
    rejection,
    patterns_evaluated,
    valid_signals,
    cooldown,
}) => {
    const messages = [];
    messages.push({
        className: 'journal__text',
        message: `══ RECURRING PATTERN DIFFER (${String(options.mode).toUpperCase()}) ══`,
    });

    if (!best) {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${STATUS.NO_COMPLETE_PATTERN} — waiting for a full ${options.min_pattern_length}-digit pattern.`,
        });
        messages.push({
            className: 'journal__text',
            message: `Patterns evaluated: ${patterns_evaluated} | Valid signals: ${valid_signals}`,
        });
        return messages;
    }

    const dist = best.distribution;
    messages.push({
        className: 'journal__text',
        message: `Current Pattern: ${best.pattern} | Length: ${best.length} | Occurrences: ${best.occurrences} | ${dist.mode}`,
    });

    const rows = dist.percentages
        .map((pct, digit) => ({ digit, pct, count: dist.counts[digit] }))
        .sort((a, b) => b.pct - a.pct || a.digit - b.digit);
    rows.slice(0, 10).forEach(row => {
        const mark = row.digit === dist.target ? ' ← TARGET' : '';
        messages.push({
            className: row.digit === dist.target ? 'journal__text--success' : 'journal__text',
            message: `${row.digit}: ${row.count} = ${row.pct.toFixed(1)}%${mark}`,
        });
    });

    messages.push({
        className: 'journal__text',
        message: `Target: ${dist.target} | Historical freq: ${dist.target_pct.toFixed(2)}% | Baseline: ${BASELINE_PCT}% | Advantage: +${dist.advantage.toFixed(2)}pp | Gap: +${dist.gap.toFixed(2)}pp | Score: ${best.score}/100`,
    });

    if (options.multi_window) {
        messages.push({
            className: 'journal__text',
            message: `Multi-window digit ${dist.target}: short ${best.multi.short.toFixed(1)}% | med ${best.multi.medium.toFixed(1)}% | long ${best.multi.long.toFixed(1)}%`,
        });
    }

    if (cooldown) {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${STATUS.COOLDOWN_ACTIVE} — waiting ${options.signal_cooldown_tips} tip(s) after last signal.`,
        });
    } else if (matched) {
        messages.push({
            className: 'journal__text--success',
            message: `STATUS: VALID SIGNAL — ACTION: DIFFER ${dist.target}`,
        });
    } else {
        const reason =
            rejection ||
            best.rejection ||
            (best.reasons && best.reasons[0]) ||
            'No qualifying pattern';
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${status || best.status} — ${reason}`,
        });
    }

    messages.push({
        className: 'journal__text',
        message: `Patterns evaluated: ${patterns_evaluated} | Near/valid this tip: ${candidates.filter(c => c.occurrences > 0).length} | Qualified: ${valid_signals}`,
    });

    return messages;
};

export const recordRecurringPatternDifferOutcome = (state, actual_digit) => {
    if (!state?.pending_outcome) return null;
    const digit = toDigit(actual_digit);
    if (digit === null) return null;

    const pending = state.pending_outcome;
    const won = digit !== pending.target;
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
        target: pending.target,
        actual: digit,
        result: won ? 'WIN' : 'LOSS',
        historical_pct: pending.target_pct,
        score: pending.score,
    });
    if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, target: pending.target, pattern: pending.pattern };
};

const patternDigitsFrom = (state, idx, L) => state.digits.slice(idx - L + 1, idx + 1);

export const evaluateRecurringPatternDiffer = (
    raw_ticks,
    raw_options = {},
    state = createRecurringPatternDifferState()
) => {
    const options = normalizeRecurringPatternDifferOptions(raw_options);
    const journal_messages = [];
    const window_ticks = normalizeTicks(raw_ticks).slice(-options.analysis_window);
    const ticks = selectTicksToProcess(window_ticks, state);
    let prediction = -1;
    let best = null;
    let all_candidates = [];
    let status = STATUS.WATCHING;
    let rejection = '';
    let patterns_evaluated = 0;
    let valid_signals = 0;
    let cooldown = false;

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
                recordRecurringPatternDifferOutcome(state, tick.digit);
            }

            state.tick_index += 1;
            state.absolute_index += 1;
            state.digits.push(tick.digit);
            const abs = state.absolute_index;
            const buf_len = options.analysis_window + options.max_pattern_length + 5;
            if (state.digits.length > buf_len) {
                state.digits = state.digits.slice(-buf_len);
            }

            const idx = state.digits.length - 1;

            // 1) Prior patterns ending at previous tip get this tip as follower.
            if (idx >= 1) {
                const end_abs = abs - 1;
                for (let L = options.min_pattern_length; L <= options.max_pattern_length; L++) {
                    if (idx - L < 0) continue;
                    const pattern_digits = state.digits.slice(idx - L, idx);
                    recordFollower(state, pattern_digits, tick.digit, end_abs);
                }
            }

            // 2) Evaluate patterns completing on this tip (prior stats only).
            const candidates = [];
            for (let L = options.min_pattern_length; L <= options.max_pattern_length; L++) {
                if (idx - L + 1 < 0) continue;
                patterns_evaluated += 1;
                candidates.push(evaluatePatternCandidate(state, patternDigitsFrom(state, idx, L), abs, options));
            }
            all_candidates = candidates;
            valid_signals = candidates.filter(c => c.qualified).length;

            const picked = pickBestCandidate(candidates);
            best =
                picked ||
                [...candidates].sort(
                    (a, b) =>
                        Number(b.qualified) - Number(a.qualified) ||
                        b.occurrences - a.occurrences ||
                        b.distribution.target_pct - a.distribution.target_pct
                )[0] ||
                null;

            cooldown =
                options.signal_cooldown_tips > 0 &&
                state.last_signal_abs >= 0 &&
                abs - state.last_signal_abs <= options.signal_cooldown_tips;

            if (!bootstrapping && picked && picked.prediction >= 0) {
                if (cooldown) {
                    status = STATUS.COOLDOWN_ACTIVE;
                    rejection = `Cooldown active (${abs - state.last_signal_abs}/${options.signal_cooldown_tips})`;
                } else {
                    const signal_key = `${tick.epoch ?? state.tick_index}:${picked.pattern}->${picked.prediction}`;
                    if (state.last_signal_key !== signal_key) {
                        state.last_signal_key = signal_key;
                        state.last_signal_abs = abs;
                        prediction = picked.prediction;
                        best = picked;
                        status = STATUS.VALID_SIGNAL;
                        rejection = '';
                        state.pending_outcome = {
                            pattern: picked.pattern,
                            target: picked.prediction,
                            target_pct: picked.distribution.target_pct,
                            score: picked.score,
                            tip_index: abs,
                        };
                    }
                }
            } else if (best) {
                status = best.status || STATUS.WATCHING;
                rejection = best.rejection || (best.reasons && best.reasons[0]) || '';
            } else {
                status = STATUS.NO_COMPLETE_PATTERN;
                rejection = `Need ${options.min_pattern_length} digits for a complete pattern`;
            }

            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    } else if (state.digits.length < options.min_pattern_length) {
        status = STATUS.NO_COMPLETE_PATTERN;
        rejection = `Need ${options.min_pattern_length} digits for a complete pattern`;
    }

    state.last_status = status;
    state.last_rejection = rejection;
    state.patterns_evaluated = patterns_evaluated;
    state.valid_signals = valid_signals;

    if (options.journal_enabled) {
        journal_messages.push(
            ...buildJournal({
                best,
                candidates: all_candidates,
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
        barrier: prediction,
        matched: prediction >= 0,
        allowed: prediction >= 0,
        pattern: best?.pattern || '',
        pattern_length: best?.length || 0,
        target_pct: best?.distribution?.target_pct ?? 0,
        advantage: best?.distribution?.advantage ?? 0,
        gap: best?.distribution?.gap ?? 0,
        score: best?.score ?? 0,
        occurrences: best?.occurrences ?? 0,
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        patterns_evaluated,
        valid_signals,
        candidates: all_candidates,
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
 * Replay / backtest: walk ticks one-at-a-time with the same live logic
 * (no look-ahead — each signal uses only prior pattern occurrences).
 */
export const replayRecurringPatternDiffer = (raw_ticks, raw_options = {}) => {
    const options = normalizeRecurringPatternDifferOptions({
        ...raw_options,
        journal_enabled: false,
    });
    const state = createRecurringPatternDifferState();
    const ticks = normalizeTicks(raw_ticks);
    const digits = ticks.map(t => t.digit);
    const signals = [];
    let patterns_detected = 0;
    let valid_signals = 0;
    let target_pct_sum = 0;
    let occ_sum = 0;

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateRecurringPatternDiffer(digits.slice(0, i + 1), options, state);
        if (result.pattern) patterns_detected += 1;
        if (result.matched) {
            valid_signals += 1;
            target_pct_sum += result.target_pct || 0;
            occ_sum += result.occurrences || 0;
            signals.push({
                tip: i,
                pattern: result.pattern,
                target: result.prediction,
                target_pct: result.target_pct,
                occurrences: result.occurrences,
                score: result.score,
            });
        }
    }

    // Settle any pending open signal with a synthetic no-op if history ended mid-trade.
    const wins = state.live.wins;
    const losses = state.live.losses;
    const trades = wins + losses;

    return {
        total_ticks: digits.length,
        patterns_detected,
        valid_signals,
        trades,
        wins,
        losses,
        win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        profit_loss_units: wins - losses,
        max_losing_streak: state.live.max_loss_streak,
        average_target_pct: valid_signals > 0 ? target_pct_sum / valid_signals : 0,
        average_occurrences: valid_signals > 0 ? occ_sum / valid_signals : 0,
        signals,
        live: { ...state.live },
        options,
    };
};

export { BASELINE_PCT };
