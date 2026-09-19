/**
 * Recurring Pattern Differ
 *
 * Discovers digit sequences of length min–max. When a pattern reappears,
 * Differ the historically most frequent NEXT digit (prior occurrences only).
 */

const BASELINE_PCT = 10;

const CONFLICT_PREFERENCES = {
    LONGEST: 'longest',
    HIGHEST_PCT: 'highest_pct',
    HIGHEST_ADVANTAGE: 'highest_advantage',
    HIGHEST_SAMPLE: 'highest_sample',
    HIGHEST_LIVE_WR: 'highest_live_wr',
};

export const DEFAULT_OPTIONS = {
    min_pattern_length: 2,
    max_pattern_length: 6,
    analysis_window: 1000,
    min_occurrences: 50,
    min_target_pct: 15,
    min_advantage: 4,
    min_target_gap: 3,
    recency_weighting: false,
    multi_window: true,
    short_window: 50,
    medium_window: 200,
    long_window: 500,
    max_pattern_age: 0, // 0 = disabled
    conflict_preference: CONFLICT_PREFERENCES.LONGEST,
    allowed_digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    journal_enabled: true,
    min_signal_score: 0,
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

const normalizeConflictPreference = value => {
    const raw = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (raw === 'highest_pct' || raw === 'highest_percentage' || raw === 'percentage') {
        return CONFLICT_PREFERENCES.HIGHEST_PCT;
    }
    if (raw === 'highest_advantage' || raw === 'advantage') {
        return CONFLICT_PREFERENCES.HIGHEST_ADVANTAGE;
    }
    if (raw === 'highest_sample' || raw === 'sample' || raw === 'occurrences') {
        return CONFLICT_PREFERENCES.HIGHEST_SAMPLE;
    }
    if (raw === 'highest_live_wr' || raw === 'live_wr' || raw === 'win_rate') {
        return CONFLICT_PREFERENCES.HIGHEST_LIVE_WR;
    }
    return CONFLICT_PREFERENCES.LONGEST;
};

export const normalizeRecurringPatternDifferOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    let min_len = toPositiveInt(options.min_pattern_length, d.min_pattern_length, 2, 10);
    let max_len = toPositiveInt(options.max_pattern_length, d.max_pattern_length, 2, 10);
    if (max_len < min_len) {
        const tmp = min_len;
        min_len = max_len;
        max_len = tmp;
    }
    const allowed = parseAllowedDigits(options.allowed_digits);
    return {
        min_pattern_length: min_len,
        max_pattern_length: max_len,
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 20, 5000),
        min_occurrences: toPositiveInt(options.min_occurrences, d.min_occurrences, 1, 100000),
        min_target_pct: toNonNegNumber(options.min_target_pct, d.min_target_pct),
        min_advantage: toNonNegNumber(options.min_advantage, d.min_advantage),
        min_target_gap: toNonNegNumber(options.min_target_gap, d.min_target_gap),
        recency_weighting: toBool(options.recency_weighting, d.recency_weighting),
        multi_window: toBool(options.multi_window, d.multi_window),
        short_window: toPositiveInt(options.short_window, d.short_window, 5, 10000),
        medium_window: toPositiveInt(options.medium_window, d.medium_window, 5, 10000),
        long_window: toPositiveInt(options.long_window, d.long_window, 5, 10000),
        max_pattern_age: toPositiveInt(options.max_pattern_age, d.max_pattern_age, 0, 1000000),
        conflict_preference: normalizeConflictPreference(options.conflict_preference),
        allowed_digits: allowed.length ? allowed : [...d.allowed_digits],
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        min_signal_score: toNonNegNumber(options.min_signal_score, d.min_signal_score),
    };
};

const patternKey = digits => digits.join('-');

const createPatternRecord = () => ({
    next_digits: [], // chronological followers (prior occurrences only)
    occurrence_indices: [],
    live: { signals: 0, wins: 0, losses: 0 },
});

export const createRecurringPatternDifferState = () => ({
    digits: [],
    absolute_index: -1,
    patterns: {},
    bootstrapped: false,
    last_plain_fingerprint: null,
    last_processed_epoch: null,
    last_signal_key: null,
    last_result: null,
    last_result_fp: '',
    tick_index: -1,
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
    if (!state.patterns[key]) {
        state.patterns[key] = createPatternRecord();
    }
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
    // Soft 0–100 strength metric — not a win probability.
    const sample = Math.min(40, (Math.log10(Math.max(1, total)) / Math.log10(1000)) * 40);
    const pct = Math.min(25, Math.max(0, (target_pct - 10) * 2.5));
    const adv = Math.min(15, Math.max(0, advantage * 2));
    const gap_score = Math.min(10, Math.max(0, gap * 2));
    const live = Math.min(10, Math.max(0, (live_wr - 50) / 5));
    return Math.round(Math.min(100, Math.max(0, sample + pct + adv + gap_score + live)));
};

const evaluatePatternCandidate = (state, pattern_digits, tip_index, options) => {
    const key = patternKey(pattern_digits);
    const record = getPatternRecord(state, key);
    const dist = distributionFromFollowers(record.next_digits, options);
    const length = pattern_digits.length;
    const last_idx =
        record.occurrence_indices.length > 0
            ? record.occurrence_indices[record.occurrence_indices.length - 1]
            : -1;
    const age = last_idx >= 0 ? tip_index - last_idx : Number.POSITIVE_INFINITY;

    const live_total = record.live.wins + record.live.losses;
    const live_wr = live_total > 0 ? (record.live.wins / live_total) * 100 : 0;

    const multi = options.multi_window
        ? {
              short: windowPct(record.next_digits, dist.target, options.short_window),
              medium: windowPct(record.next_digits, dist.target, options.medium_window),
              long: windowPct(record.next_digits, dist.target, options.long_window),
          }
        : null;

    const reasons = [];
    if (dist.total < options.min_occurrences) {
        reasons.push(`occurrences ${dist.total}<${options.min_occurrences}`);
    }
    if (!options.allowed_digits.includes(dist.target)) {
        reasons.push(`target ${dist.target} disabled`);
    }
    if (dist.target_pct + 1e-9 < options.min_target_pct) {
        reasons.push(`pct ${dist.target_pct.toFixed(2)}<${options.min_target_pct}`);
    }
    if (dist.advantage + 1e-9 < options.min_advantage) {
        reasons.push(`adv ${dist.advantage.toFixed(2)}<${options.min_advantage}`);
    }
    if (dist.gap + 1e-9 < options.min_target_gap) {
        reasons.push(`gap ${dist.gap.toFixed(2)}<${options.min_target_gap}`);
    }
    if (options.max_pattern_age > 0 && Number.isFinite(age) && age > options.max_pattern_age) {
        reasons.push(`age ${age}>${options.max_pattern_age}`);
    }

    const score = computeSignalScore({
        total: dist.total,
        target_pct: dist.target_pct,
        advantage: dist.advantage,
        gap: dist.gap,
        live_wr,
    });
    if (score + 1e-9 < options.min_signal_score) {
        reasons.push(`score ${score}<${options.min_signal_score}`);
    }

    const qualified = reasons.length === 0 && dist.target >= 0 && dist.total > 0;

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
        prediction: qualified ? dist.target : -1,
    };
};

const pickBestCandidate = (candidates, preference) => {
    const qualified = candidates.filter(c => c.qualified);
    if (!qualified.length) return null;

    const ranked = [...qualified];
    ranked.sort((a, b) => {
        switch (preference) {
            case CONFLICT_PREFERENCES.HIGHEST_PCT:
                return (
                    b.distribution.target_pct - a.distribution.target_pct ||
                    b.length - a.length ||
                    b.occurrences - a.occurrences
                );
            case CONFLICT_PREFERENCES.HIGHEST_ADVANTAGE:
                return (
                    b.distribution.advantage - a.distribution.advantage ||
                    b.length - a.length ||
                    b.occurrences - a.occurrences
                );
            case CONFLICT_PREFERENCES.HIGHEST_SAMPLE:
                return b.occurrences - a.occurrences || b.length - a.length;
            case CONFLICT_PREFERENCES.HIGHEST_LIVE_WR:
                return b.live_wr - a.live_wr || b.length - a.length || b.occurrences - a.occurrences;
            case CONFLICT_PREFERENCES.LONGEST:
            default:
                return b.length - a.length || b.distribution.target_pct - a.distribution.target_pct;
        }
    });
    return ranked[0];
};

const recordFollower = (state, pattern_digits, follower, end_index) => {
    const key = patternKey(pattern_digits);
    const record = getPatternRecord(state, key);
    record.next_digits.push(follower);
    record.occurrence_indices.push(end_index);
    // Cap memory for very long sessions
    if (record.next_digits.length > 5000) {
        record.next_digits = record.next_digits.slice(-5000);
        record.occurrence_indices = record.occurrence_indices.slice(-5000);
    }
};

const buildJournal = (best, candidates, options, matched) => {
    const messages = [];
    if (!best) {
        messages.push({
            className: 'journal__text',
            message: 'Recurring Pattern Differ: watching for qualifying patterns…',
        });
        return messages;
    }

    const dist = best.distribution;
    messages.push({
        className: 'journal__text',
        message: `RECURRING PATTERN — ${best.pattern} (len ${best.length}) | occ ${best.occurrences} | ${dist.mode}`,
    });

    const top = [...dist.percentages]
        .map((pct, digit) => ({ digit, pct, count: dist.counts[digit] }))
        .sort((a, b) => b.pct - a.pct || a.digit - b.digit)
        .slice(0, 5);
    top.forEach(row => {
        const mark = row.digit === dist.target ? ' ← TARGET' : '';
        messages.push({
            className: row.digit === dist.target ? 'journal__text--success' : 'journal__text',
            message: `Digit ${row.digit}: ${row.count} = ${row.pct.toFixed(2)}%${mark}`,
        });
    });

    messages.push({
        className: 'journal__text',
        message: `Target ${dist.target} | ${dist.target_pct.toFixed(2)}% | adv +${dist.advantage.toFixed(2)}pp | 2nd ${dist.second}=${dist.second_pct.toFixed(2)}% | gap +${dist.gap.toFixed(2)}pp | score ${best.score}/100`,
    });

    if (best.multi) {
        messages.push({
            className: 'journal__text',
            message: `Multi-window digit ${dist.target}: short ${best.multi.short.toFixed(1)}% | med ${best.multi.medium.toFixed(1)}% | long ${best.multi.long.toFixed(1)}%`,
        });
    }

    if (matched) {
        messages.push({
            className: 'journal__text--success',
            message: `SIGNAL — DIFFER ${dist.target} on pattern ${best.pattern}`,
        });
    } else if (best.reasons?.length) {
        messages.push({
            className: 'journal__text',
            message: `NO SIGNAL — ${best.reasons.join('; ')}`,
        });
    } else {
        const near = candidates.filter(c => !c.qualified).slice(0, 2);
        if (near.length) {
            messages.push({
                className: 'journal__text',
                message: `NO SIGNAL — best near-miss: ${near[0].pattern} (${near[0].reasons.join('; ')})`,
            });
        }
    }

    return messages;
};

/**
 * Record actual next digit for the last fired signal (call when tip advances after a trade).
 */
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
    if (state.live.history.length > 200) {
        state.live.history = state.live.history.slice(-200);
    }
    state.pending_outcome = null;
    return { won, actual: digit, target: pending.target, pattern: pending.pattern };
};

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

            // Resolve pending outcome from previous signal using this tip.
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

            // 1) Patterns that ended on previous tip now get this tip as follower.
            if (idx >= 1) {
                const end_abs = abs - 1;
                for (let L = options.min_pattern_length; L <= options.max_pattern_length; L++) {
                    if (idx - L < 0) continue;
                    const pattern_digits = state.digits.slice(idx - L, idx);
                    recordFollower(state, pattern_digits, tick.digit, end_abs);
                }
            }

            // 2) Evaluate patterns that complete on this tip (using prior stats only).
            const candidates = [];
            for (let L = options.min_pattern_length; L <= options.max_pattern_length; L++) {
                if (idx - L + 1 < 0) continue;
                const pattern_digits = state.digits.slice(idx - L + 1, idx + 1);
                candidates.push(evaluatePatternCandidate(state, pattern_digits, abs, options));
            }
            all_candidates = candidates;
            const picked = pickBestCandidate(candidates, options.conflict_preference);
            // Prefer showing the best candidate even if unqualified (for journal).
            best =
                picked ||
                [...candidates].sort(
                    (a, b) =>
                        Number(b.qualified) - Number(a.qualified) ||
                        b.length - a.length ||
                        b.distribution.target_pct - a.distribution.target_pct
                )[0] ||
                null;

            if (!bootstrapping && picked && picked.prediction >= 0) {
                const signal_key = `${tick.epoch ?? state.tick_index}:${picked.pattern}->${picked.prediction}`;
                if (state.last_signal_key !== signal_key) {
                    state.last_signal_key = signal_key;
                    prediction = picked.prediction;
                    best = picked;
                    state.pending_outcome = {
                        pattern: picked.pattern,
                        target: picked.prediction,
                        target_pct: picked.distribution.target_pct,
                        score: picked.score,
                        tip_index: idx,
                    };
                }
            }

            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    }

    if (options.journal_enabled) {
        journal_messages.push(
            ...buildJournal(best, all_candidates, options, prediction >= 0)
        );
        if (journal_messages.length > 12) {
            journal_messages.splice(0, journal_messages.length - 12);
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

export { CONFLICT_PREFERENCES, BASELINE_PCT };
