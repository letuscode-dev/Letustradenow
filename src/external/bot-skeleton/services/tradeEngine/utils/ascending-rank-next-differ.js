/**
 * Ascending Rank Next Digit DIFFER
 *
 * Over the last `analysis_window` ticks (default 1000), rank digits 0–9 by
 * appearance % in ascending order (weakest → strongest). Locate the current
 * digit in that ranking and Differ the digit ranked immediately above it
 * (the next digit "in power") on the next tick.
 *
 * "Next in power" is the first digit with a strictly higher % than the current
 * digit; digits tied at that level are ordered by digit value. No trade when
 * the current digit already has the highest %.
 */

import { MAX_ANALYSIS_WINDOW } from './top-two-digit-gap-differ';

export const STATUS = {
    COLLECTING: 'COLLECTING',
    CURRENT_IS_STRONGEST: 'CURRENT_IS_STRONGEST',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    SIGNAL_CONSUMED: 'SIGNAL_CONSUMED',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const DEFAULT_OPTIONS = {
    analysis_window: 1000,
    signal_cooldown_tips: 1,
    journal_enabled: true,
};

/** Below this many ticks the percentages are too noisy to trade on. */
const MIN_TICKS_TO_TRADE = 100;

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toPositiveInt = (value, fallback, min = 1, max = MAX_ANALYSIS_WINDOW) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

export const normalizeAscendingRankNextOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 10, MAX_ANALYSIS_WINDOW),
        signal_cooldown_tips: toPositiveInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createAscendingRankNextState = () => ({
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

export const resetAscendingRankNextState = (state = null) => {
    const next = createAscendingRankNextState();
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

/** Ascending by percentage (weakest first); equal percentages ordered by digit. */
export const rankDigitsAscending = digits => {
    const counts = Array.from({ length: 10 }, () => 0);
    digits.forEach(d => {
        counts[d] += 1;
    });
    const total = digits.length;
    return counts
        .map((count, digit) => ({ digit, count, pct: total ? (count / total) * 100 : 0 }))
        .sort((a, b) => a.count - b.count || a.digit - b.digit);
};

export const recordAscendingRankNextOutcome = (state, actual_digit) => {
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

const formatRanking = ranked => ranked.map(r => `${r.digit}(${r.pct.toFixed(1)}%)`).join(' < ');

const buildJournal = ({ options, window_size, ranked, current, status, rejection, target }) => {
    const messages = [{ className: 'journal__text', message: '══ ASCENDING RANK NEXT DIGIT DIFFER ══' }];

    if (status === STATUS.COLLECTING) {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
        return messages;
    }

    messages.push({
        className: 'journal__text',
        message: `Window: ${
            window_size < options.analysis_window ? `${window_size}/${options.analysis_window}` : window_size
        } ticks | Ascending: ${formatRanking(ranked)}`,
    });
    messages.push({ className: 'journal__text', message: `Current digit: ${current}` });

    if (status === STATUS.VALID_SIGNAL) {
        messages.push({
            className: 'journal__text--success',
            message: `STATUS: VALID SIGNAL — next stronger than ${current} is ${target}. ACTION: DIFFER ${target}`,
        });
    } else {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
    }
    return messages;
};

export const evaluateAscendingRankNext = (raw_ticks, raw_options = {}, state = createAscendingRankNextState()) => {
    const options = normalizeAscendingRankNextOptions(raw_options);
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
            const reason = 'Signal on this tick already traded — waiting for the next tick.';
            state.last_result = {
                ...state.last_result,
                prediction: -1,
                barrier: -1,
                matched: false,
                contract_type: null,
                status: STATUS.SIGNAL_CONSUMED,
                rejection: reason,
                why_no_trade: reason,
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
        if (settle_tick) recordAscendingRankNextOutcome(state, settle_tick.digit);
    }
    state.last_tip_fp = fp;
    state.tip_index += 1;

    let prediction = -1;
    let status;
    let rejection = '';
    let ranked = [];
    let target = null;

    const min_ticks = Math.min(options.analysis_window, MIN_TICKS_TO_TRADE);
    if (window_ticks.length < min_ticks) {
        status = STATUS.COLLECTING;
        rejection = `Loading tick history ${window_ticks.length}/${options.analysis_window}.`;
    } else {
        ranked = rankDigitsAscending(window_ticks.map(t => t.digit));
        const self = ranked.find(r => r.digit === current);
        // Equal-weight digits are not "in power" over the current digit — skip past them.
        const next = ranked.find(r => r.count > self.count);

        const cooldown =
            options.signal_cooldown_tips > 0 &&
            state.last_signal_tip >= 0 &&
            state.tip_index - state.last_signal_tip <= options.signal_cooldown_tips;

        if (!next) {
            status = STATUS.CURRENT_IS_STRONGEST;
            rejection = `Current digit ${current} has the highest weight (${formatPct(self.pct)}) — no stronger digit above it.`;
        } else if (cooldown) {
            status = STATUS.COOLDOWN_ACTIVE;
            rejection = `Cooldown active (${state.tip_index - state.last_signal_tip}/${options.signal_cooldown_tips} tips).`;
        } else {
            target = next.digit;
            prediction = target;
            status = STATUS.VALID_SIGNAL;
            state.last_signal_tip = state.tip_index;
            state.pending_outcome = { target, current, epoch: tip.epoch };
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({ options, window_size: window_ticks.length, ranked, current, status, rejection, target })
        : [];

    const live_total = state.live.wins + state.live.losses;
    const result = {
        prediction,
        barrier: prediction,
        matched: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITDIFF' : null,
        current,
        ranked,
        target,
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

export const replayAscendingRankNext = (raw_ticks, raw_options = {}) => {
    const options = normalizeAscendingRankNextOptions({ ...raw_options, journal_enabled: false });
    const state = createAscendingRankNextState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateAscendingRankNext(digits.slice(0, i + 1), options, state);
        if (result.matched) {
            signals.push({ tip: i, current: result.current, target: result.target });
        }
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
