/**
 * Missing Digit Return DIFFER
 *
 * Track how long each digit 0–9 has been absent. When a digit reappears after
 * being missing for at least `missing_period` tips (default 20), Differ that
 * digit on the NEXT tip. Prior absence only — no look-ahead.
 */

export const STATUS = {
    WAITING: 'WAITING',
    NO_RETURN: 'NO_RETURN',
    BELOW_THRESHOLD: 'BELOW_THRESHOLD',
    DIGIT_NOT_WATCHED: 'DIGIT_NOT_WATCHED',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const DEFAULT_OPTIONS = {
    missing_period: 20,
    target_digits: 'ALL',
    signal_cooldown_tips: 1,
    analysis_window: 2000,
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

export const normalizeMissingDigitReturnOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        missing_period: toPositiveInt(options.missing_period ?? options.absence_threshold, d.missing_period, 1, 10000),
        target_digits: parseTargetDigits(options.target_digits ?? options.digits),
        signal_cooldown_tips: toPositiveInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 50, 100000),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createMissingDigitReturnState = () => ({
    absolute_index: -1,
    tick_index: -1,
    // last tip index where each digit was seen (-1 = never)
    last_seen: Array.from({ length: 10 }, () => -1),
    bootstrapped: false,
    last_plain_fingerprint: null,
    last_processed_epoch: null,
    last_signal_key: null,
    last_signal_abs: -1,
    last_result: null,
    last_result_fp: '',
    last_status: STATUS.WAITING,
    last_rejection: '',
    pending_outcome: null,
    live: {
        signals: 0,
        wins: 0,
        losses: 0,
        history: [],
    },
});

export const resetMissingDigitReturnState = (state = null) => {
    const next = createMissingDigitReturnState();
    if (!state || typeof state !== 'object') return next;
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, next);
    return state;
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
        state.last_seen = Array.from({ length: 10 }, () => -1);
        state.absolute_index = -1;
        start = 0;
    }
    state.last_plain_fingerprint = fingerprint;
    return ticks.slice(Math.max(0, start));
};

const currentAbsences = (state, tip_abs) =>
    state.last_seen.map(last => (last < 0 ? tip_abs + 1 : Math.max(0, tip_abs - last)));

export const recordMissingDigitReturnOutcome = (state, actual_digit) => {
    if (!state?.pending_outcome) return null;
    const digit = toDigit(actual_digit);
    if (digit === null) return null;

    const pending = state.pending_outcome;
    const won = digit !== pending.target;
    if (won) state.live.wins += 1;
    else state.live.losses += 1;
    state.live.signals += 1;
    state.live.history.push({
        target: pending.target,
        absence: pending.absence,
        actual: digit,
        result: won ? 'WIN' : 'LOSS',
    });
    if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, target: pending.target };
};

const buildJournal = ({ options, digit, absence, status, rejection, matched, absences }) => {
    const messages = [];
    messages.push({
        className: 'journal__text',
        message: '══ MISSING DIGIT RETURN DIFFER ══',
    });
    messages.push({
        className: 'journal__text',
        message: `Missing period required: ${options.missing_period} | Digits: ${
            options.target_digits === 'ALL' ? 'ALL' : options.target_digits.join(',')
        }`,
    });

    if (absences) {
        const top = absences
            .map((a, d) => ({ d, a }))
            .sort((x, y) => y.a - x.a)
            .slice(0, 5)
            .map(x => `${x.d}:${x.a}`)
            .join(' | ');
        messages.push({
            className: 'journal__text',
            message: `Longest current absences: ${top}`,
        });
    }

    if (matched && digit !== null && digit !== undefined) {
        messages.push({
            className: 'journal__text--success',
            message: `Digit ${digit} returned after ${absence} missing tip(s). STATUS: VALID SIGNAL — ACTION: DIFFER ${digit}`,
        });
    } else {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${status} — ${rejection || 'Waiting for a digit to return after the configured absence.'}`,
        });
    }

    return messages;
};

export const evaluateMissingDigitReturn = (
    raw_ticks,
    raw_options = {},
    state = createMissingDigitReturnState()
) => {
    const options = normalizeMissingDigitReturnOptions(raw_options);
    const journal_messages = [];
    const window_ticks = normalizeTicks(raw_ticks).slice(-options.analysis_window);
    const ticks = selectTicksToProcess(window_ticks, state);
    let prediction = -1;
    let signal_digit = null;
    let signal_absence = 0;
    let status = STATUS.WAITING;
    let rejection = 'Waiting for a digit to return after the configured absence.';

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
                recordMissingDigitReturnOutcome(state, tick.digit);
            }

            state.tick_index += 1;
            state.absolute_index += 1;
            const abs = state.absolute_index;
            const digit = tick.digit;
            const last = state.last_seen[digit];
            // Tips between last sighting and now (exclusive of both ends of the return tip)
            const absence = last < 0 ? abs : Math.max(0, abs - last - 1);

            let fired = false;
            if (!bootstrapping && isWatchedDigit(digit, options.target_digits)) {
                if (last >= 0 && absence >= options.missing_period) {
                    const cooldown =
                        options.signal_cooldown_tips > 0 &&
                        state.last_signal_abs >= 0 &&
                        abs - state.last_signal_abs <= options.signal_cooldown_tips;

                    if (cooldown) {
                        status = STATUS.COOLDOWN_ACTIVE;
                        rejection = `Cooldown active (${abs - state.last_signal_abs}/${options.signal_cooldown_tips}) — digit ${digit} returned after ${absence}.`;
                    } else {
                        const signal_key = `${tick.epoch ?? state.tick_index}:${digit}@${abs}`;
                        if (state.last_signal_key !== signal_key) {
                            state.last_signal_key = signal_key;
                            state.last_signal_abs = abs;
                            prediction = digit;
                            signal_digit = digit;
                            signal_absence = absence;
                            status = STATUS.VALID_SIGNAL;
                            rejection = '';
                            fired = true;
                            state.pending_outcome = {
                                target: digit,
                                absence,
                                tip_index: abs,
                            };
                        }
                    }
                } else if (last >= 0 && absence > 0 && absence < options.missing_period) {
                    status = STATUS.BELOW_THRESHOLD;
                    rejection = `Digit ${digit} returned after only ${absence} missing tip(s). Required: ${options.missing_period}.`;
                } else if (last < 0) {
                    status = STATUS.WAITING;
                    rejection = `Digit ${digit} seen for the first time — no prior absence to measure.`;
                }
            } else if (!bootstrapping && !isWatchedDigit(digit, options.target_digits)) {
                status = STATUS.DIGIT_NOT_WATCHED;
                rejection = `Digit ${digit} is not in the watched set.`;
            } else if (!fired && !bootstrapping) {
                status = STATUS.NO_RETURN;
                rejection = 'No qualifying missing-digit return on this tip.';
            }

            state.last_seen[digit] = abs;
            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    }

    const tip_abs = state.absolute_index;
    const absences = tip_abs >= 0 ? currentAbsences(state, tip_abs) : null;

    state.last_status = status;
    state.last_rejection = rejection;

    if (options.journal_enabled) {
        journal_messages.push(
            ...buildJournal({
                options,
                digit: signal_digit,
                absence: signal_absence,
                status,
                rejection,
                matched: prediction >= 0,
                absences,
            })
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
        contract_type: prediction >= 0 ? 'DIGITDIFF' : null,
        digit: signal_digit,
        absence: signal_absence,
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        absences,
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

export const replayMissingDigitReturn = (raw_ticks, raw_options = {}) => {
    const options = normalizeMissingDigitReturnOptions({
        ...raw_options,
        journal_enabled: false,
    });
    const state = createMissingDigitReturnState();
    const ticks = normalizeTicks(raw_ticks);
    const digits = ticks.map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateMissingDigitReturn(digits.slice(0, i + 1), options, state);
        if (result.matched) {
            signals.push({
                tip: i,
                digit: result.prediction,
                absence: result.absence,
            });
        }
    }

    const wins = state.live.wins;
    const losses = state.live.losses;
    const trades = wins + losses;

    return {
        total_ticks: digits.length,
        valid_signals: signals.length,
        trades,
        wins,
        losses,
        win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        signals,
        live: { ...state.live },
        options,
    };
};
