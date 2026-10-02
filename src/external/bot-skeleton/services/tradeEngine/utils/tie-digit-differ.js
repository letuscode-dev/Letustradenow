/**
 * Tie Digit DIFFER
 *
 * Over the last `analysis_window` ticks (default 120), compute the appearance %
 * of digits 0–9. When the current digit's % ties with exactly ONE other digit,
 * Differ that other digit (never the current one) on the next tick.
 *
 * No trade when the current digit has no tie, or ties with two or more digits
 * (the target would be ambiguous).
 */

import { MAX_ANALYSIS_WINDOW } from './top-two-digit-gap-differ';

export const STATUS = {
    COLLECTING: 'COLLECTING',
    NO_TIE: 'NO_TIE',
    MULTIPLE_TIES: 'MULTIPLE_TIES',
    SIGNAL_CONSUMED: 'SIGNAL_CONSUMED',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const DEFAULT_OPTIONS = {
    analysis_window: 120,
    signal_cooldown_tips: 1,
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

export const normalizeTieDigitOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 10, MAX_ANALYSIS_WINDOW),
        signal_cooldown_tips: toPositiveInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createTieDigitState = () => ({
    tip_index: -1,
    last_tip_fp: null,
    last_signal_tip: -1,
    last_result: null,
    pending_outcome: null,
    live: {
        signals: 0,
        wins: 0,
        losses: 0,
        history: [],
    },
});

export const resetTieDigitState = (state = null) => {
    const next = createTieDigitState();
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

const tipFingerprint = (all_ticks, window_ticks) => {
    const tip = window_ticks[window_ticks.length - 1];
    if (tip.epoch !== null) return `e:${tip.epoch}`;
    const tail = window_ticks
        .slice(-20)
        .map(t => t.digit)
        .join('');
    return `n:${all_ticks.length}:${tail}`;
};

export const digitPercentages = digits => {
    const counts = Array.from({ length: 10 }, () => 0);
    digits.forEach(d => {
        counts[d] += 1;
    });
    const total = digits.length;
    return { counts, percentages: counts.map(c => (total ? (c / total) * 100 : 0)), total };
};

/** Digits (other than `current`) whose count equals the current digit's count. */
export const findTiedDigits = (counts, current) =>
    counts.flatMap((count, digit) => (digit !== current && count === counts[current] ? [digit] : []));

export const recordTieDigitOutcome = (state, actual_digit) => {
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
        current: pending.current,
        actual: digit,
        result: won ? 'WIN' : 'LOSS',
    });
    if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, target: pending.target };
};

const formatPct = value => `${value.toFixed(2)}%`;

const buildJournal = ({ options, window_size, percentages, current, tied, status, rejection, target }) => {
    const messages = [{ className: 'journal__text', message: '══ TIE DIGIT DIFFER ══' }];

    if (status === STATUS.COLLECTING) {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
        return messages;
    }

    messages.push({
        className: 'journal__text',
        message: `Window: ${window_size}/${options.analysis_window} ticks | ${percentages
            .map((pct, digit) => `${digit}:${pct.toFixed(1)}`)
            .join(' ')}`,
    });
    messages.push({
        className: 'journal__text',
        message: `Current digit: ${current} (${formatPct(percentages[current])}) | Tied with: ${
            tied.length ? tied.join(', ') : 'none'
        }`,
    });

    if (status === STATUS.VALID_SIGNAL) {
        messages.push({
            className: 'journal__text--success',
            message: `STATUS: VALID SIGNAL — current ${current} ties with ${target} at ${formatPct(
                percentages[current]
            )}. ACTION: DIFFER ${target}`,
        });
    } else {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
    }
    return messages;
};

export const evaluateTieDigit = (raw_ticks, raw_options = {}, state = createTieDigitState()) => {
    const options = normalizeTieDigitOptions(raw_options);
    const all_ticks = normalizeTicks(raw_ticks);
    const window_ticks = all_ticks.slice(-options.analysis_window);

    if (!window_ticks.length) {
        return {
            prediction: -1,
            matched: false,
            status: STATUS.COLLECTING,
            rejection: 'No ticks yet.',
            why_no_trade: 'No ticks yet.',
            options,
            journal_messages: [],
        };
    }

    const fp = tipFingerprint(all_ticks, window_ticks);
    if (fp === state.last_tip_fp && state.last_result) {
        // The first poll of a tip already handed out its signal; re-polls must not re-trade it.
        if (state.last_result.matched) {
            state.last_result = {
                ...state.last_result,
                prediction: -1,
                barrier: -1,
                matched: false,
                contract_type: null,
                status: STATUS.SIGNAL_CONSUMED,
                rejection: 'Signal on this tick already traded — waiting for the next tick.',
                why_no_trade: 'Signal on this tick already traded — waiting for the next tick.',
            };
        }
        return { ...state.last_result, journal_messages: [] };
    }

    const tip = window_ticks[window_ticks.length - 1];
    const current = tip.digit;
    if (state.last_tip_fp !== null && state.pending_outcome) {
        const { epoch: signal_epoch } = state.pending_outcome;
        const settle_tick =
            signal_epoch !== null && tip.epoch !== null
                ? all_ticks.find(t => t.epoch !== null && t.epoch > signal_epoch)
                : tip;
        if (settle_tick) recordTieDigitOutcome(state, settle_tick.digit);
    }
    state.last_tip_fp = fp;
    state.tip_index += 1;

    let prediction = -1;
    let status;
    let rejection = '';
    let target = null;
    let tied = [];
    let percentages = [];

    if (window_ticks.length < options.analysis_window) {
        status = STATUS.COLLECTING;
        rejection = `Loading tick history ${window_ticks.length}/${options.analysis_window}.`;
    } else {
        const stats = digitPercentages(window_ticks.map(t => t.digit));
        percentages = stats.percentages;
        tied = findTiedDigits(stats.counts, current);

        const cooldown =
            options.signal_cooldown_tips > 0 &&
            state.last_signal_tip >= 0 &&
            state.tip_index - state.last_signal_tip <= options.signal_cooldown_tips;

        if (!tied.length) {
            status = STATUS.NO_TIE;
            rejection = `Current digit ${current} (${formatPct(percentages[current])}) does not tie with any digit.`;
        } else if (tied.length > 1) {
            status = STATUS.MULTIPLE_TIES;
            rejection = `Current digit ${current} ties with ${tied.join(', ')} — need exactly one tied digit.`;
        } else if (cooldown) {
            status = STATUS.COOLDOWN_ACTIVE;
            rejection = `Cooldown active (${state.tip_index - state.last_signal_tip}/${options.signal_cooldown_tips} tips).`;
        } else {
            [target] = tied;
            prediction = target;
            status = STATUS.VALID_SIGNAL;
            state.last_signal_tip = state.tip_index;
            state.pending_outcome = { target, current, epoch: tip.epoch };
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({
              options,
              window_size: window_ticks.length,
              percentages,
              current,
              tied,
              status,
              rejection,
              target,
          })
        : [];

    const live_total = state.live.wins + state.live.losses;
    const result = {
        prediction,
        barrier: prediction,
        matched: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITDIFF' : null,
        current,
        tied,
        target,
        percentages,
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        live: {
            ...state.live,
            win_rate: live_total > 0 ? (state.live.wins / live_total) * 100 : 0,
        },
        options,
        journal_messages,
    };
    state.last_result = result;
    return result;
};

export const replayTieDigit = (raw_ticks, raw_options = {}) => {
    const options = normalizeTieDigitOptions({ ...raw_options, journal_enabled: false });
    const state = createTieDigitState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateTieDigit(digits.slice(0, i + 1), options, state);
        if (result.matched) signals.push({ tip: i, current: result.current, target: result.target });
    }

    const { wins, losses } = state.live;
    const trades = wins + losses;
    return {
        total_ticks: digits.length,
        valid_signals: signals.length,
        trades,
        wins,
        losses,
        win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        signals,
        options,
    };
};
