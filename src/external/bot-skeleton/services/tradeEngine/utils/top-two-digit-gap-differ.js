/**
 * Top Two Digit Gap DIFFER
 *
 * Over the last `analysis_window` ticks (default 1000), rank digits 0–9 by
 * appearance %. When the gap between the most and second-most appearing digit
 * meets `gap_threshold` (default 0.5pp) and the current digit is one of those
 * two, Differ the OTHER one on the next tick.
 *
 * gap_mode 'max'   → gap <= threshold (top two are within the threshold)
 * gap_mode 'exact' → gap === threshold
 */

export const STATUS = {
    COLLECTING: 'COLLECTING',
    GAP_NOT_MET: 'GAP_NOT_MET',
    CURRENT_NOT_TOP_TWO: 'CURRENT_NOT_TOP_TWO',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const DEFAULT_OPTIONS = {
    analysis_window: 1000,
    gap_threshold: 0.5,
    gap_mode: 'max',
    signal_cooldown_tips: 1,
    journal_enabled: true,
};

const EPSILON = 1e-6;

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

const normalizeGapMode = value =>
    String(value || '')
        .trim()
        .toLowerCase() === 'exact'
        ? 'exact'
        : 'max';

export const normalizeTopTwoDigitGapOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        analysis_window: toPositiveInt(options.analysis_window, d.analysis_window, 10, 100000),
        gap_threshold: toNonNegNumber(options.gap_threshold, d.gap_threshold),
        gap_mode: normalizeGapMode(options.gap_mode ?? d.gap_mode),
        signal_cooldown_tips: toPositiveInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createTopTwoDigitGapState = () => ({
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

export const resetTopTwoDigitGapState = (state = null) => {
    const next = createTopTwoDigitGapState();
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

export const rankDigits = digits => {
    const counts = Array.from({ length: 10 }, () => 0);
    digits.forEach(d => {
        counts[d] += 1;
    });
    const total = digits.length;
    const percentages = counts.map(c => (total ? (c / total) * 100 : 0));
    const ranked = percentages
        .map((pct, digit) => ({ digit, pct, count: counts[digit] }))
        .sort((a, b) => b.pct - a.pct || a.digit - b.digit);
    return { counts, percentages, ranked, total };
};

export const gapMeetsThreshold = (gap, options) =>
    options.gap_mode === 'exact'
        ? Math.abs(gap - options.gap_threshold) < EPSILON
        : gap <= options.gap_threshold + EPSILON;

export const recordTopTwoDigitGapOutcome = (state, actual_digit) => {
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
        gap: pending.gap,
        actual: digit,
        result: won ? 'WIN' : 'LOSS',
    });
    if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, target: pending.target };
};

const formatPct = value => `${value.toFixed(2)}%`;

const buildJournal = ({ options, window_size, top1, top2, gap, current, status, rejection, target }) => {
    const messages = [
        { className: 'journal__text', message: '══ TOP TWO DIGIT GAP DIFFER ══' },
    ];

    if (status === STATUS.COLLECTING) {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${status} — ${rejection}`,
        });
        return messages;
    }

    const rule = options.gap_mode === 'exact' ? `= ${options.gap_threshold}` : `≤ ${options.gap_threshold}`;
    messages.push({
        className: 'journal__text',
        message: `Window: ${window_size} ticks | Most: ${top1.digit} (${formatPct(top1.pct)}) | Second: ${top2.digit} (${formatPct(top2.pct)}) | Gap: ${gap.toFixed(2)}pp (required ${rule})`,
    });
    messages.push({
        className: 'journal__text',
        message: `Current digit: ${current}`,
    });

    if (status === STATUS.VALID_SIGNAL) {
        messages.push({
            className: 'journal__text--success',
            message: `STATUS: VALID SIGNAL — current ${current} is a top-two digit. ACTION: DIFFER ${target}`,
        });
    } else {
        messages.push({
            className: 'journal__text',
            message: `WHY NO TRADE? ${status} — ${rejection}`,
        });
    }
    return messages;
};

export const evaluateTopTwoDigitGap = (raw_ticks, raw_options = {}, state = createTopTwoDigitGapState()) => {
    const options = normalizeTopTwoDigitGapOptions(raw_options);
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
        return {
            ...state.last_result,
            journal_messages: options.journal_enabled ? state.last_result.journal_messages || [] : [],
        };
    }

    const current = window_ticks[window_ticks.length - 1].digit;
    if (state.last_tip_fp !== null && state.pending_outcome) {
        recordTopTwoDigitGapOutcome(state, current);
    }
    state.last_tip_fp = fp;
    state.tip_index += 1;

    let prediction = -1;
    let status;
    let rejection = '';
    let top1 = null;
    let top2 = null;
    let gap = 0;
    let target = null;

    if (window_ticks.length < options.analysis_window) {
        status = STATUS.COLLECTING;
        rejection = `Collecting ticks ${window_ticks.length}/${options.analysis_window}.`;
    } else {
        const { ranked } = rankDigits(window_ticks.map(t => t.digit));
        [top1, top2] = ranked;
        gap = top1.pct - top2.pct;

        const cooldown =
            options.signal_cooldown_tips > 0 &&
            state.last_signal_tip >= 0 &&
            state.tip_index - state.last_signal_tip <= options.signal_cooldown_tips;

        if (!gapMeetsThreshold(gap, options)) {
            status = STATUS.GAP_NOT_MET;
            rejection = `Gap ${gap.toFixed(2)}pp does not meet ${
                options.gap_mode === 'exact' ? '=' : '≤'
            } ${options.gap_threshold}pp.`;
        } else if (current !== top1.digit && current !== top2.digit) {
            status = STATUS.CURRENT_NOT_TOP_TWO;
            rejection = `Current digit ${current} is not ${top1.digit} or ${top2.digit}.`;
        } else if (cooldown) {
            status = STATUS.COOLDOWN_ACTIVE;
            rejection = `Cooldown active (${state.tip_index - state.last_signal_tip}/${options.signal_cooldown_tips} tips).`;
        } else {
            target = current === top1.digit ? top2.digit : top1.digit;
            prediction = target;
            status = STATUS.VALID_SIGNAL;
            state.last_signal_tip = state.tip_index;
            state.pending_outcome = { target, current, gap };
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({
              options,
              window_size: window_ticks.length,
              top1,
              top2,
              gap,
              current,
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
        top1,
        top2,
        gap,
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

export const replayTopTwoDigitGap = (raw_ticks, raw_options = {}) => {
    const options = normalizeTopTwoDigitGapOptions({ ...raw_options, journal_enabled: false });
    const state = createTopTwoDigitGapState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateTopTwoDigitGap(digits.slice(0, i + 1), options, state);
        if (result.matched) {
            signals.push({ tip: i, current: result.current, target: result.target, gap: result.gap });
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
