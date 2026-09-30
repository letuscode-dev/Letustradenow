/**
 * Digit Rise OVER
 *
 * Over the last `analysis_window` ticks (default 1000), track the appearance %
 * of the user's target digits (comma-separated, at most 9, default "0"). When
 * any target % increases versus the window `compare_lookback` ticks earlier
 * (default 1), enter DIGITOVER.
 *
 * The barrier (1 normally, 2 in loss recovery) is owned by the bot's risk
 * management and passed in; it is returned as the prediction on a signal.
 */

import { MAX_ANALYSIS_WINDOW } from './top-two-digit-gap-differ';

export const STATUS = {
    COLLECTING: 'COLLECTING',
    NO_RISE: 'NO_RISE',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    SIGNAL_CONSUMED: 'SIGNAL_CONSUMED',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const DEFAULT_TARGET_DIGITS = [0];
export const MAX_TARGET_DIGITS = 9;

export const DEFAULT_OPTIONS = {
    target_digits: DEFAULT_TARGET_DIGITS,
    analysis_window: 1000,
    compare_lookback: 1,
    barrier: 1,
    signal_cooldown_tips: 1,
    journal_enabled: true,
};

const MAX_COMPARE_LOOKBACK = 100;
const MIN_TICKS_TO_TRADE = 100;
const EPSILON = 1e-9;

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toInt = (value, fallback, min, max) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

/**
 * Parse "0,1,5" (or a number / array) into unique digits, in entry order.
 * Non-digit entries are dropped; only the first 9 digits are kept; an empty
 * result falls back to the default.
 */
export const parseTargetDigits = value => {
    const tokens = Array.isArray(value) ? value : String(value ?? '').split(/[,\s;]+/);
    const digits = [];
    tokens.forEach(token => {
        const text = String(token).trim();
        if (!/^\d$/.test(text)) return;
        const digit = Number(text);
        if (!digits.includes(digit)) digits.push(digit);
    });
    return digits.length ? digits.slice(0, MAX_TARGET_DIGITS) : [...DEFAULT_TARGET_DIGITS];
};

export const normalizeZeroOneRiseOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        target_digits: parseTargetDigits(options.target_digits ?? d.target_digits),
        analysis_window: toInt(
            options.analysis_window,
            d.analysis_window,
            10,
            MAX_ANALYSIS_WINDOW - MAX_COMPARE_LOOKBACK
        ),
        compare_lookback: toInt(options.compare_lookback, d.compare_lookback, 1, MAX_COMPARE_LOOKBACK),
        barrier: toInt(options.barrier, d.barrier, 0, 8),
        signal_cooldown_tips: toInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createZeroOneRiseState = () => ({
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

export const resetZeroOneRiseState = (state = null) => {
    const next = createZeroOneRiseState();
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

const tipFingerprint = all_ticks => {
    const tip = all_ticks[all_ticks.length - 1];
    if (tip.epoch !== null) return `e:${tip.epoch}`;
    const tail = all_ticks
        .slice(-20)
        .map(t => t.digit)
        .join('');
    return `n:${all_ticks.length}:${tail}`;
};

/** % of each target digit within `ticks`. */
export const watchedPercentages = (ticks, digits = DEFAULT_TARGET_DIGITS) => {
    const total = ticks.length;
    return digits.map(digit => {
        const count = ticks.reduce((n, t) => n + (t.digit === digit ? 1 : 0), 0);
        return { digit, count, pct: total ? (count / total) * 100 : 0 };
    });
};

export const recordZeroOneRiseOutcome = (state, actual_digit) => {
    if (!state?.pending_outcome) return null;
    const digit = toDigit(actual_digit);
    if (digit === null) return null;
    const pending = state.pending_outcome;
    const won = digit > pending.barrier;
    if (won) state.live.wins += 1;
    else state.live.losses += 1;
    state.live.signals += 1;
    state.live.history.push({ barrier: pending.barrier, actual: digit, result: won ? 'WIN' : 'LOSS' });
    if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, barrier: pending.barrier };
};

const arrow = (now, prev) => {
    if (now > prev + EPSILON) return '↑';
    if (now < prev - EPSILON) return '↓';
    return '=';
};

const buildJournal = ({ options, window_size, now, prev, current, status, rejection, rising }) => {
    const mode = options.barrier === DEFAULT_OPTIONS.barrier ? 'Entry' : 'Recovery';
    const messages = [
        {
            className: 'journal__text',
            message: `══ DIGIT RISE OVER ${options.barrier} (${mode}) | Targets: ${options.target_digits.join(',')} ══`,
        },
    ];

    if (status === STATUS.COLLECTING) {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
        return messages;
    }

    const describe = i =>
        `Digit ${now[i].digit}: ${prev[i].pct.toFixed(2)}% → ${now[i].pct.toFixed(2)}% ${arrow(now[i].pct, prev[i].pct)}`;
    messages.push({
        className: 'journal__text',
        message: `Window: ${
            window_size < options.analysis_window ? `${window_size}/${options.analysis_window}` : window_size
        } ticks | Current digit: ${current}`,
    });
    messages.push({
        className: 'journal__text',
        message: now.map((_, i) => describe(i)).join(' | '),
    });

    if (status === STATUS.VALID_SIGNAL) {
        messages.push({
            className: 'journal__text--success',
            message: `STATUS: VALID SIGNAL — digit ${rising.join(' & ')} % increased. ACTION: OVER ${options.barrier}`,
        });
    } else {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
    }
    return messages;
};

export const evaluateZeroOneRise = (raw_ticks, raw_options = {}, state = createZeroOneRiseState()) => {
    const options = normalizeZeroOneRiseOptions(raw_options);
    const all_ticks = normalizeTicks(raw_ticks);

    if (!all_ticks.length) {
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

    const fp = tipFingerprint(all_ticks);
    if (fp === state.last_tip_fp && state.last_result) {
        // The first poll of a tip already handed out its signal; re-polls must not re-trade it.
        if (state.last_result.matched) {
            const reason = 'Signal on this tick already traded — waiting for the next tick.';
            state.last_result = {
                ...state.last_result,
                prediction: -1,
                matched: false,
                contract_type: null,
                status: STATUS.SIGNAL_CONSUMED,
                rejection: reason,
                why_no_trade: reason,
            };
        }
        return { ...state.last_result, journal_messages: [] };
    }

    const tip = all_ticks[all_ticks.length - 1];
    const current = tip.digit;
    if (state.last_tip_fp !== null && state.pending_outcome) {
        const { epoch: signal_epoch } = state.pending_outcome;
        const settle_tick =
            signal_epoch !== null && tip.epoch !== null
                ? all_ticks.find(t => t.epoch !== null && t.epoch > signal_epoch)
                : tip;
        if (settle_tick) recordZeroOneRiseOutcome(state, settle_tick.digit);
    }
    state.last_tip_fp = fp;
    state.tip_index += 1;

    const { analysis_window, compare_lookback } = options;
    const window_ticks = all_ticks.slice(-analysis_window);
    const prev_end = all_ticks.length - compare_lookback;
    const prev_ticks = all_ticks.slice(Math.max(0, prev_end - analysis_window), Math.max(0, prev_end));

    let prediction = -1;
    let status;
    let rejection = '';
    let now = [];
    let prev = [];
    let rising = [];

    const min_ticks = Math.min(analysis_window, MIN_TICKS_TO_TRADE);
    if (prev_ticks.length < min_ticks) {
        status = STATUS.COLLECTING;
        rejection = `Loading tick history ${all_ticks.length}/${analysis_window + compare_lookback}.`;
    } else {
        now = watchedPercentages(window_ticks, options.target_digits);
        prev = watchedPercentages(prev_ticks, options.target_digits);
        rising = now.filter((n, i) => n.pct > prev[i].pct + EPSILON).map(n => n.digit);

        const cooldown =
            options.signal_cooldown_tips > 0 &&
            state.last_signal_tip >= 0 &&
            state.tip_index - state.last_signal_tip <= options.signal_cooldown_tips;

        if (!rising.length) {
            status = STATUS.NO_RISE;
            rejection = `No target digit (${options.target_digits.join(',')}) increased in % over the last ${compare_lookback} tick(s).`;
        } else if (cooldown) {
            status = STATUS.COOLDOWN_ACTIVE;
            rejection = `Cooldown active (${state.tip_index - state.last_signal_tip}/${options.signal_cooldown_tips} tips).`;
        } else {
            prediction = options.barrier;
            status = STATUS.VALID_SIGNAL;
            state.last_signal_tip = state.tip_index;
            state.pending_outcome = { barrier: options.barrier, epoch: tip.epoch };
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({
              options,
              window_size: window_ticks.length,
              now,
              prev,
              current,
              status,
              rejection,
              rising,
          })
        : [];

    const live_total = state.live.wins + state.live.losses;
    const result = {
        prediction,
        matched: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITOVER' : null,
        barrier: options.barrier,
        current,
        now,
        prev,
        rising,
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

/**
 * Sequential replay with the bot's risk rule: Over `barrier` normally, switch to
 * `recovery_barrier` after a loss until the next win.
 */
export const replayZeroOneRise = (raw_ticks, raw_options = {}) => {
    const entry_barrier = normalizeZeroOneRiseOptions(raw_options).barrier;
    const recovery_barrier = toInt(raw_options.recovery_barrier, 2, 0, 8);
    const state = createZeroOneRiseState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];
    let barrier = entry_barrier;

    for (let i = 0; i < digits.length; i++) {
        // The previous trade settles on this tick, before this tick's signal is evaluated.
        if (state.pending_outcome) {
            barrier = digits[i] > state.pending_outcome.barrier ? entry_barrier : recovery_barrier;
        }
        const result = evaluateZeroOneRise(
            digits.slice(0, i + 1),
            { ...raw_options, barrier, journal_enabled: false },
            state
        );
        if (result.matched) signals.push({ tip: i, barrier: result.barrier, rising: result.rising });
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
    };
};
