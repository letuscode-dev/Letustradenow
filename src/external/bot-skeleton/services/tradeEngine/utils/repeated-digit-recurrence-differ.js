/**
 * Repeated Digit Recurrence DIFFER
 *
 * Detect digit × N consecutive runs. First discovery is recorded only.
 * When the same digit × N recurs (min previous occurrences satisfied),
 * Differ that digit on the NEXT tip. Prior stats only — no look-ahead.
 *
 * Default: fire once when run length hits N (one signal per run).
 * Exact Run Matching: do not emit overlapping signals inside a longer run.
 */

export const STATUS = {
    NO_COMPLETE_RUN: 'NO_COMPLETE_RUN',
    FIRST_DISCOVERY: 'FIRST_DISCOVERY',
    INSUFFICIENT_OCCURRENCES: 'INSUFFICIENT_OCCURRENCES',
    DIGIT_NOT_WATCHED: 'DIGIT_NOT_WATCHED',
    HISTORICAL_DIFFER_TOO_LOW: 'HISTORICAL_DIFFER_TOO_LOW',
    RECENT_DIFFER_TOO_LOW: 'RECENT_DIFFER_TOO_LOW',
    LOSING_STREAK_TOO_HIGH: 'LOSING_STREAK_TOO_HIGH',
    SCORE_TOO_LOW: 'SCORE_TOO_LOW',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    RUN_IN_PROGRESS: 'RUN_IN_PROGRESS',
    VALID_SIGNAL: 'VALID_SIGNAL',
    WATCHING: 'WATCHING',
};

export const DEFAULT_OPTIONS = {
    repetition_count: 3,
    target_digits: 'ALL',
    min_previous_occurrences: 1,
    exact_run_matching: true,
    allow_entry_during_run: false,
    historical_differ_filter: false,
    min_historical_differ_pct: 70,
    recent_filter: false,
    recent_window: 10,
    min_recent_differ_pct: 70,
    max_losing_streak: 5,
    signal_cooldown_tips: 1,
    min_signal_score: 0,
    analysis_window: 5000,
    journal_enabled: true,
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

const parseTargetDigits = value => {
    if (value === undefined || value === null || value === '') return 'ALL';
    if (Array.isArray(value)) {
        const digits = [...new Set(value.map(toDigit).filter(d => d !== null))].sort((a, b) => a - b);
        return digits.length ? digits : 'ALL';
    }
    const raw = String(value).trim().toUpperCase();
    if (!raw || raw === 'ALL' || raw === '*') return 'ALL';
    const digits = [
        ...new Set(
            raw
                .split(/[,;\s]+/)
                .map(s => toDigit(s.trim()))
                .filter(d => d !== null)
        ),
    ].sort((a, b) => a - b);
    return digits.length ? digits : 'ALL';
};

const isWatchedDigit = (digit, target_digits) =>
    target_digits === 'ALL' || (Array.isArray(target_digits) && target_digits.includes(digit));

export const normalizeRepeatedDigitRecurrenceOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        repetition_count: toPositiveInt(options.repetition_count, d.repetition_count, 2, 10),
        target_digits: parseTargetDigits(options.target_digits ?? options.digits),
        min_previous_occurrences: toPositiveInt(
            options.min_previous_occurrences,
            d.min_previous_occurrences,
            1,
            20
        ),
        exact_run_matching: toBool(options.exact_run_matching, d.exact_run_matching),
        allow_entry_during_run: toBool(options.allow_entry_during_run, d.allow_entry_during_run),
        historical_differ_filter: toBool(options.historical_differ_filter, d.historical_differ_filter),
        min_historical_differ_pct: toNonNegNumber(
            options.min_historical_differ_pct,
            d.min_historical_differ_pct
        ),
        recent_filter: toBool(options.recent_filter, d.recent_filter),
        recent_window: toPositiveInt(options.recent_window, d.recent_window, 5, 50),
        min_recent_differ_pct: toNonNegNumber(options.min_recent_differ_pct, d.min_recent_differ_pct),
        max_losing_streak: toPositiveInt(options.max_losing_streak, d.max_losing_streak, 1, 10),
        signal_cooldown_tips: toPositiveInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 10),
        min_signal_score: toNonNegNumber(options.min_signal_score, d.min_signal_score),
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 50, 100000),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

const patternKey = (digit, repetition) => `${digit}x${repetition}`;

const createPatternRecord = () => ({
    outcomes: [],
    occurrence_ids: [],
    live: { signals: 0, wins: 0, losses: 0 },
    current_loss_streak: 0,
    max_loss_streak: 0,
});

export const createRepeatedDigitRecurrenceState = () => ({
    absolute_index: -1,
    tick_index: -1,
    patterns: {},
    bootstrapped: false,
    last_plain_fingerprint: null,
    last_processed_epoch: null,
    last_signal_key: null,
    last_signal_abs: -1,
    last_result: null,
    last_result_fp: '',
    last_status: STATUS.WATCHING,
    last_rejection: '',
    run_digit: null,
    run_length: 0,
    run_start_abs: -1,
    run_signaled: false,
    pending_settlement: null,
    live: {
        signals: 0,
        wins: 0,
        losses: 0,
        win_streak: 0,
        loss_streak: 0,
        max_win_streak: 0,
        max_loss_streak: 0,
        history: [],
        blocked_signals: 0,
    },
});

export const resetRepeatedDigitRecurrenceState = (state = null) => {
    const next = createRepeatedDigitRecurrenceState();
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
    if (has_epochs) {
        if (state.last_processed_epoch !== null) {
            return ticks.filter(
                tick => tick.epoch !== null && tick.epoch > state.last_processed_epoch
            );
        }
        return ticks;
    }

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
        state.patterns = {};
        state.absolute_index = -1;
        state.run_digit = null;
        state.run_length = 0;
        state.run_start_abs = -1;
        state.run_signaled = false;
        start = 0;
    }
    state.last_plain_fingerprint = fingerprint;
    return ticks.slice(Math.max(0, start));
};

const differStats = (outcomes, recent_window) => {
    const total = outcomes.length;
    const wins = outcomes.reduce((s, o) => s + (o === 1 ? 1 : 0), 0);
    const losses = total - wins;
    const rate = total ? (wins / total) * 100 : 0;
    const recent = outcomes.slice(-recent_window);
    const recent_wins = recent.reduce((s, o) => s + (o === 1 ? 1 : 0), 0);
    const recent_rate = recent.length ? (recent_wins / recent.length) * 100 : 0;
    return {
        total,
        wins,
        losses,
        rate,
        recent_wins,
        recent_total: recent.length,
        recent_rate,
    };
};

const computeSignalScore = ({ stats, max_loss_streak, max_losing_streak_cap }) => {
    const sample = Math.min(30, (Math.log10(Math.max(1, stats.total)) / Math.log10(50)) * 30);
    const hist = Math.min(30, Math.max(0, (stats.rate - 50) * 0.75));
    const recent = Math.min(25, Math.max(0, (stats.recent_rate - 50) * 0.625));
    const streak = Math.max(0, 15 - (max_loss_streak / Math.max(1, max_losing_streak_cap)) * 15);
    return Math.round(Math.min(100, Math.max(0, sample + hist + recent + streak)));
};

const settlePending = (state, actual_digit) => {
    if (!state.pending_settlement) return null;
    const digit = toDigit(actual_digit);
    if (digit === null) return null;

    const pending = state.pending_settlement;
    const won = digit !== pending.target;
    const record = getPatternRecord(state, pending.pattern);

    record.outcomes.push(won ? 1 : 0);
    record.occurrence_ids.push(pending.occurrence_id);
    if (record.outcomes.length > 5000) {
        record.outcomes = record.outcomes.slice(-5000);
        record.occurrence_ids = record.occurrence_ids.slice(-5000);
    }

    if (won) {
        record.current_loss_streak = 0;
    } else {
        record.current_loss_streak += 1;
        record.max_loss_streak = Math.max(record.max_loss_streak, record.current_loss_streak);
    }

    if (pending.is_trade) {
        record.live.signals += 1;
        state.live.signals += 1;
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
        state.live.history.push({
            pattern: pending.pattern,
            target: pending.target,
            actual: digit,
            result: won ? 'WIN' : 'LOSS',
            score: pending.score,
        });
        if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    }

    state.pending_settlement = null;
    return { won, actual: digit, target: pending.target, pattern: pending.pattern, is_trade: pending.is_trade };
};

export const recordRepeatedDigitRecurrenceOutcome = (state, actual_digit) =>
    settlePending(state, actual_digit);

const evaluateCandidate = (state, digit, options) => {
    const key = patternKey(digit, options.repetition_count);
    const record = getPatternRecord(state, key);
    const stats = differStats(record.outcomes, options.recent_window);
    const score = computeSignalScore({
        stats,
        max_loss_streak: record.max_loss_streak,
        max_losing_streak_cap: options.max_losing_streak,
    });

    const reasons = [];
    let status = STATUS.VALID_SIGNAL;
    const previous = stats.total;

    if (!isWatchedDigit(digit, options.target_digits)) {
        reasons.push(`Waiting — digit ${digit} is not in the watched set.`);
        status = STATUS.DIGIT_NOT_WATCHED;
    } else if (previous < options.min_previous_occurrences) {
        if (previous === 0) {
            reasons.push(
                `Waiting — repetition has not occurred before. Pattern detected: ${digit} × ${options.repetition_count}. First discovery — record only.`
            );
            status = STATUS.FIRST_DISCOVERY;
        } else {
            reasons.push(
                `Pattern detected: ${digit} × ${options.repetition_count}. Historical occurrences: ${previous}. Need ${options.min_previous_occurrences} previous occurrences.`
            );
            status = STATUS.INSUFFICIENT_OCCURRENCES;
        }
    } else if (
        options.historical_differ_filter &&
        stats.rate + 1e-9 < options.min_historical_differ_pct
    ) {
        reasons.push(
            `Signal rejected — historical DIFFER rate below threshold. Observed: ${stats.rate.toFixed(1)}% | Required: ${options.min_historical_differ_pct}%`
        );
        status = STATUS.HISTORICAL_DIFFER_TOO_LOW;
    } else if (
        options.recent_filter &&
        stats.recent_total > 0 &&
        stats.recent_rate + 1e-9 < options.min_recent_differ_pct
    ) {
        reasons.push(
            `Signal rejected — recent DIFFER rate below threshold. Recent: ${stats.recent_rate.toFixed(1)}% | Required: ${options.min_recent_differ_pct}%`
        );
        status = STATUS.RECENT_DIFFER_TOO_LOW;
    } else if (record.current_loss_streak >= options.max_losing_streak) {
        reasons.push(
            `Signal rejected — maximum losing streak reached (${record.current_loss_streak}/${options.max_losing_streak}).`
        );
        status = STATUS.LOSING_STREAK_TOO_HIGH;
    } else if (score + 1e-9 < options.min_signal_score) {
        reasons.push(
            `Signal rejected — signal score ${score} below minimum ${options.min_signal_score}.`
        );
        status = STATUS.SCORE_TOO_LOW;
    }

    const qualified = reasons.length === 0;
    if (qualified) status = STATUS.VALID_SIGNAL;

    return {
        pattern: key,
        digit,
        repetition: options.repetition_count,
        previous,
        stats,
        score,
        qualified,
        reasons,
        status,
        prediction: qualified ? digit : -1,
        rejection: reasons[0] || '',
        pattern_status: previous === 0 ? 'NEW' : 'REPEATED',
    };
};

const buildPatternTable = (state, options) => {
    const rows = [];
    const digits =
        options.target_digits === 'ALL' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : options.target_digits;
    digits.forEach(digit => {
        const key = patternKey(digit, options.repetition_count);
        const record = state.patterns[key] || createPatternRecord();
        const stats = differStats(record.outcomes, options.recent_window);
        const score = computeSignalScore({
            stats,
            max_loss_streak: record.max_loss_streak,
            max_losing_streak_cap: options.max_losing_streak,
        });
        let row_status = 'WATCHING';
        if (stats.total < options.min_previous_occurrences) row_status = 'NEW';
        else if (record.current_loss_streak >= options.max_losing_streak) row_status = 'BLOCKED';
        else if (
            options.historical_differ_filter &&
            stats.rate + 1e-9 < options.min_historical_differ_pct
        ) {
            row_status = 'BLOCKED';
        } else row_status = 'READY';
        rows.push({
            digit,
            repetition: options.repetition_count,
            occurrences: stats.total,
            differ_wins: stats.wins,
            differ_losses: stats.losses,
            differ_pct: stats.rate,
            recent_pct: stats.recent_rate,
            score,
            status: row_status,
        });
    });
    return rows;
};

const buildJournal = ({ options, candidate, matched, status, rejection, cooldown, current_run }) => {
    const messages = [];
    messages.push({
        className: 'journal__text',
        message: '══ REPEATED DIGIT RECURRENCE DIFFER ══',
    });
    messages.push({
        className: 'journal__text',
        message: `Current digit: ${current_run.digit ?? '—'} | Current repetition: ${current_run.length} | Run: ${current_run.visual || '—'} | Configured: ${options.repetition_count}`,
    });

    if (candidate) {
        const s = candidate.stats;
        messages.push({
            className: 'journal__text',
            message: `Pattern: ${candidate.digit} × ${candidate.repetition} | Status: ${candidate.pattern_status} | Prior occurrences: ${candidate.previous}`,
        });
        messages.push({
            className: 'journal__text',
            message: `Historical DIFFER: ${s.wins}W / ${s.losses}L = ${s.rate.toFixed(1)}% | Recent (${s.recent_total}): ${s.recent_rate.toFixed(1)}% | Score: ${candidate.score}/100`,
        });
    }

    if (cooldown) {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${STATUS.COOLDOWN_ACTIVE} — waiting ${options.signal_cooldown_tips} tip(s) after last signal.`,
        });
    } else if (matched && candidate) {
        messages.push({
            className: 'journal__text--success',
            message: `Pattern qualifies. Historical DIFFER rate = ${(candidate.stats.rate || 0).toFixed(1)}%. Signal approved. Placing DIFFER ${candidate.digit}.`,
        });
    } else if (status === STATUS.RUN_IN_PROGRESS) {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${STATUS.RUN_IN_PROGRESS} — ${rejection}`,
        });
    } else {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${status} — ${rejection || 'No qualifying repetition.'}`,
        });
    }

    return messages;
};

/**
 * Decide whether this tip's run length should emit a digit×N event.
 *
 * - allow_entry_during_run ON: fire once when length hits N (even if run continues).
 * - allow_entry_during_run OFF + exact ON: fire when run ends and final length === N
 *   is too late for live entry; so OFF still fires once at length === N (one per run),
 *   matching "still only one signal" for long runs. Exact OFF also fires once at N.
 * - On run end with exact ON and length !== N and never hit N: no event.
 * - On run end with exact OFF and length > N without mid-fire: shouldn't happen if we fire at N.
 */
const shouldEmitAtLength = (length, options) => length === options.repetition_count;

const armSettlement = (state, { pattern, digit, occurrence_id, is_trade, score, tip_abs }) => {
    state.pending_settlement = {
        pattern,
        target: digit,
        occurrence_id,
        is_trade: !!is_trade,
        score: score || 0,
        tip_index: tip_abs,
    };
};

const handlePatternEvent = (state, options, bootstrapping, { digit, length, tip_abs }) => {
    const candidate = evaluateCandidate(state, digit, options);
    const occurrence_id = `${tip_abs}:${digit}x${length}`;

    const cooldown =
        options.signal_cooldown_tips > 0 &&
        state.last_signal_abs >= 0 &&
        tip_abs - state.last_signal_abs <= options.signal_cooldown_tips;

    // Always settle this occurrence after the next tip (for historical DIFFER %).
    // Only live-trade when qualified, not bootstrapping, and not in cooldown.
    if (bootstrapping) {
        if (!state.pending_settlement) {
            armSettlement(state, {
                pattern: candidate.pattern,
                digit,
                occurrence_id,
                is_trade: false,
                score: candidate.score,
                tip_abs,
            });
        }
        return {
            candidate,
            prediction: -1,
            status: candidate.status,
            rejection: candidate.rejection || 'Bootstrapping history.',
            cooldown: false,
        };
    }

    if (candidate.qualified && !cooldown) {
        const signal_key = `${occurrence_id}->DIFF`;
        if (state.last_signal_key === signal_key) {
            return {
                candidate,
                prediction: -1,
                status: STATUS.WATCHING,
                rejection: 'Duplicate occurrence — already signaled.',
                cooldown: false,
            };
        }
        state.last_signal_key = signal_key;
        state.last_signal_abs = tip_abs;
        armSettlement(state, {
            pattern: candidate.pattern,
            digit,
            occurrence_id,
            is_trade: true,
            score: candidate.score,
            tip_abs,
        });
        return {
            candidate,
            prediction: digit,
            status: STATUS.VALID_SIGNAL,
            rejection: '',
            cooldown: false,
        };
    }

    if (!state.pending_settlement) {
        armSettlement(state, {
            pattern: candidate.pattern,
            digit,
            occurrence_id,
            is_trade: false,
            score: candidate.score,
            tip_abs,
        });
    }

    if (candidate.qualified && cooldown) {
        state.live.blocked_signals += 1;
        return {
            candidate,
            prediction: -1,
            status: STATUS.COOLDOWN_ACTIVE,
            rejection: `Cooldown active (${tip_abs - state.last_signal_abs}/${options.signal_cooldown_tips})`,
            cooldown: true,
        };
    }

    state.live.blocked_signals += 1;
    return {
        candidate,
        prediction: -1,
        status: candidate.status,
        rejection: candidate.rejection,
        cooldown: false,
    };
};

export const evaluateRepeatedDigitRecurrence = (
    raw_ticks,
    raw_options = {},
    state = createRepeatedDigitRecurrenceState()
) => {
    const options = normalizeRepeatedDigitRecurrenceOptions(raw_options);
    const journal_messages = [];
    const window_ticks = normalizeTicks(raw_ticks).slice(-options.analysis_window);
    const ticks = selectTicksToProcess(window_ticks, state);
    let prediction = -1;
    let candidate = null;
    let status = STATUS.WATCHING;
    let rejection = '';
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

            if (state.pending_settlement) {
                settlePending(state, tick.digit);
            }

            state.tick_index += 1;
            state.absolute_index += 1;
            const abs = state.absolute_index;
            const digit = tick.digit;

            if (state.run_digit === digit) {
                state.run_length += 1;
            } else {
                // Optional: if exact matching and allow_entry_during_run OFF, we already
                // fire at N. When a run ends without ever reaching N, nothing to do.
                // If exact OFF and somehow length > N without signal — fire on end as digit×N once.
                if (
                    !options.exact_run_matching &&
                    !state.run_signaled &&
                    state.run_digit !== null &&
                    state.run_length >= options.repetition_count
                ) {
                    const sig = handlePatternEvent(state, options, bootstrapping, {
                        digit: state.run_digit,
                        length: options.repetition_count,
                        tip_abs: abs - 1,
                    });
                    candidate = sig.candidate;
                    cooldown = !!sig.cooldown;
                    if (!bootstrapping && sig.prediction >= 0) {
                        prediction = sig.prediction;
                        status = STATUS.VALID_SIGNAL;
                        rejection = '';
                    } else {
                        status = sig.status;
                        rejection = sig.rejection;
                    }
                }

                state.run_digit = digit;
                state.run_length = 1;
                state.run_start_abs = abs;
                state.run_signaled = false;
            }

            if (
                !state.run_signaled &&
                shouldEmitAtLength(state.run_length, options) &&
                isWatchedDigit(digit, options.target_digits)
            ) {
                // When allow_entry_during_run is OFF and exact is ON, still emit once at N
                // (one signal per run). Long runs do not create extra signals.
                state.run_signaled = true;
                const sig = handlePatternEvent(state, options, bootstrapping, {
                    digit,
                    length: state.run_length,
                    tip_abs: abs,
                });
                candidate = sig.candidate;
                cooldown = !!sig.cooldown;
                if (!bootstrapping && sig.prediction >= 0) {
                    prediction = sig.prediction;
                    status = STATUS.VALID_SIGNAL;
                    rejection = '';
                } else {
                    status = sig.status;
                    rejection = sig.rejection;
                }
            } else if (
                prediction < 0 &&
                state.run_length > 0 &&
                state.run_length < options.repetition_count
            ) {
                status = STATUS.RUN_IN_PROGRESS;
                rejection = `Building run: ${digit} × ${state.run_length} / ${options.repetition_count}`;
            }

            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    }

    const current_run = {
        digit: state.run_digit,
        length: state.run_length,
        visual:
            state.run_digit !== null && state.run_length > 0
                ? Array(state.run_length).fill(state.run_digit).join(',')
                : '',
    };

    if (!candidate && current_run.digit !== null) {
        const key = patternKey(current_run.digit, options.repetition_count);
        const record = getPatternRecord(state, key);
        const stats = differStats(record.outcomes, options.recent_window);
        candidate = {
            pattern: key,
            digit: current_run.digit,
            repetition: options.repetition_count,
            previous: stats.total,
            stats,
            score: computeSignalScore({
                stats,
                max_loss_streak: record.max_loss_streak,
                max_losing_streak_cap: options.max_losing_streak,
            }),
            qualified: false,
            reasons: [rejection || 'Waiting for repetition or filters.'],
            status,
            prediction: -1,
            rejection,
            pattern_status: stats.total === 0 ? 'NEW' : 'REPEATED',
        };
    }

    state.last_status = status;
    state.last_rejection = rejection;

    if (options.journal_enabled) {
        journal_messages.push(
            ...buildJournal({
                options,
                candidate,
                matched: prediction >= 0,
                status,
                rejection,
                cooldown: status === STATUS.COOLDOWN_ACTIVE || cooldown,
                current_run,
            })
        );
        if (journal_messages.length > 14) {
            journal_messages.splice(0, journal_messages.length - 14);
        }
    }

    const live_total = state.live.wins + state.live.losses;
    const result = {
        prediction,
        barrier: prediction,
        matched: prediction >= 0,
        allowed: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITDIFF' : null,
        pattern: candidate?.pattern || '',
        digit: candidate?.digit ?? current_run.digit,
        repetition: options.repetition_count,
        current_run,
        occurrences: candidate?.previous ?? 0,
        differ_rate: candidate?.stats?.rate ?? 0,
        recent_rate: candidate?.stats?.recent_rate ?? 0,
        score: candidate?.score ?? 0,
        pattern_status: candidate?.pattern_status || '—',
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        pattern_table: buildPatternTable(state, options),
        candidate,
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

export const replayRepeatedDigitRecurrence = (raw_ticks, raw_options = {}) => {
    const options = normalizeRepeatedDigitRecurrenceOptions({
        ...raw_options,
        journal_enabled: false,
    });
    const state = createRepeatedDigitRecurrenceState();
    const ticks = normalizeTicks(raw_ticks);
    const digits = ticks.map(t => t.digit);
    const signals = [];
    let valid_signals = 0;

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateRepeatedDigitRecurrence(digits.slice(0, i + 1), options, state);
        if (result.matched) {
            valid_signals += 1;
            signals.push({
                tip: i,
                pattern: result.pattern,
                digit: result.prediction,
                score: result.score,
            });
        }
    }

    const wins = state.live.wins;
    const losses = state.live.losses;
    const trades = wins + losses;

    return {
        total_ticks: digits.length,
        valid_signals,
        trades,
        wins,
        losses,
        win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        profit_loss_units: wins - losses,
        max_losing_streak: state.live.max_loss_streak,
        max_winning_streak: state.live.max_win_streak,
        blocked_signals: state.live.blocked_signals,
        signals,
        live: { ...state.live },
        options,
    };
};
