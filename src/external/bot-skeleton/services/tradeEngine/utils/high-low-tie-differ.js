/**
 * High-Low Tie Differs
 *
 * Over the last `analysis_window` ticks (min 100, default 200) compute digit 0–9
 * occurrence %. A HIGH TIE is two or more digits sharing the highest %, a LOW TIE
 * two or more digits sharing the lowest % (within `tie_tolerance` percentage points).
 *
 * One candidate per tie is chosen deterministically — never randomly:
 *   1. higher Recent Window occurrence
 *   2. higher Micro Window occurrence
 *   3. more repetition/clustering (back-to-back repeats inside the Recent Window)
 *   4. appeared most recently
 * If candidates are still equal after all four, there is no trade.
 *
 * MODE HIGH / LOW trades that tie only. AUTO trades whichever tie exists; when both
 * exist the candidate with the higher weighted score wins
 * (40% overall relationship, 30% recent, 20% micro, 10% repetition/recency).
 *
 * New tick validation: a setup is armed on one tick and only traded when the next
 * tick recalculates to the same tie type and target; otherwise it is cancelled.
 * After a trade the same setup is not repeated until it changes, and a cooldown
 * of `signal_cooldown_tips` ticks applies.
 */

import { MAX_ANALYSIS_WINDOW } from './top-two-digit-gap-differ';

export const STATUS = {
    COLLECTING: 'COLLECTING',
    NO_TIE: 'NO_TIE',
    TIE_UNRESOLVED: 'TIE_UNRESOLVED',
    AUTO_EQUAL: 'AUTO_EQUAL',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    SETUP_ALREADY_TRADED: 'SETUP_ALREADY_TRADED',
    AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
    SETUP_CANCELLED: 'SETUP_CANCELLED',
    SIGNAL_CONSUMED: 'SIGNAL_CONSUMED',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const MODES = ['HIGH', 'LOW', 'AUTO'];

export const MIN_ANALYSIS_WINDOW = 100;

export const DEFAULT_OPTIONS = {
    analysis_window: 200,
    recent_window: 20,
    micro_window: 10,
    tie_tolerance: 0,
    mode: 'AUTO',
    signal_cooldown_tips: 1,
    journal_enabled: true,
};

const EPSILON = 1e-9;

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

const toNumber = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

export const normalizeMode = value => {
    const text = String(value ?? '').toUpperCase();
    if (text.includes('AUTO')) return 'AUTO';
    if (text.includes('HIGH')) return 'HIGH';
    if (text.includes('LOW')) return 'LOW';
    return DEFAULT_OPTIONS.mode;
};

export const normalizeHighLowTieOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    const analysis_window = toPositiveInt(
        options.analysis_window,
        d.analysis_window,
        MIN_ANALYSIS_WINDOW,
        MAX_ANALYSIS_WINDOW
    );
    const recent_window = toPositiveInt(options.recent_window, d.recent_window, 5, analysis_window);
    const micro_window = toPositiveInt(options.micro_window, d.micro_window, 3, recent_window);
    return {
        analysis_window,
        recent_window,
        micro_window,
        tie_tolerance: toNumber(options.tie_tolerance, d.tie_tolerance, 0, 10),
        mode: normalizeMode(options.mode),
        signal_cooldown_tips: toPositiveInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createHighLowTieState = () => ({
    tip_index: -1,
    last_tip_fp: null,
    last_signal_tip: -1,
    last_traded_key: null,
    armed: null,
    last_result: null,
    pending_outcome: null,
    live: {
        trades: 0,
        wins: 0,
        losses: 0,
        streak: 0,
        last_outcome: null,
        history: [],
    },
});

export const resetHighLowTieState = (state = null) => {
    const next = createHighLowTieState();
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

const countDigits = digits => {
    const counts = Array.from({ length: 10 }, () => 0);
    digits.forEach(d => {
        counts[d] += 1;
    });
    return counts;
};

const pctOf = (count, total) => (total ? (count / total) * 100 : 0);

/** Back-to-back repeats of `digit` inside `digits` (e.g. 3,3,3 → 2). */
export const countRepeats = (digits, digit) => {
    let repeats = 0;
    for (let i = 1; i < digits.length; i++) {
        if (digits[i] === digit && digits[i - 1] === digit) repeats += 1;
    }
    return repeats;
};

/** Ticks since `digit` last appeared (0 = the current tick), Infinity if absent. */
export const ticksSinceSeen = (digits, digit) => {
    const index = digits.lastIndexOf(digit);
    return index < 0 ? Infinity : digits.length - 1 - index;
};

const describeTicksAgo = n => (Number.isFinite(n) ? `${n} tick${n === 1 ? '' : 's'} ago` : 'not seen');

const TIE_BREAKERS = [
    {
        label: 'Recent window',
        compare: (a, b) => b.recent_count - a.recent_count,
        describe: c => `${c.recent_pct.toFixed(1)}%`,
    },
    {
        label: 'Micro window',
        compare: (a, b) => b.micro_count - a.micro_count,
        describe: c => `${c.micro_pct.toFixed(1)}%`,
    },
    {
        label: 'Repetition',
        compare: (a, b) => b.repeats - a.repeats,
        describe: c => `${c.repeats} repeat${c.repeats === 1 ? '' : 's'}`,
    },
    {
        label: 'Recency',
        compare: (a, b) => {
            if (a.last_seen === b.last_seen) return 0;
            return a.last_seen < b.last_seen ? -1 : 1;
        },
        describe: c => describeTicksAgo(c.last_seen),
    },
];

/**
 * Pick one candidate from a tie using the fixed tie-breaker priority.
 * Returns { selected, reason } or { selected: null, reason } when still equal.
 */
export const breakTie = candidates => {
    const sorted = [...candidates].sort((a, b) => {
        for (const breaker of TIE_BREAKERS) {
            const diff = breaker.compare(a, b);
            if (diff !== 0) return diff;
        }
        return 0;
    });
    const [first, second] = sorted;
    if (!second) return { selected: first ?? null, reason: 'single candidate' };
    const decider = TIE_BREAKERS.find(breaker => breaker.compare(first, second) !== 0);
    if (!decider) {
        return {
            selected: null,
            reason: `${first.digit} and ${second.digit} equal on recent, micro, repetition and recency`,
        };
    }
    return {
        selected: first,
        reason: `${decider.label} ${first.digit}=${decider.describe(first)} vs ${second.digit}=${decider.describe(
            second
        )}`,
    };
};

/**
 * AUTO MODE score (0–100):
 *   40 × overall relationship (distance from the fair 10% toward the tie side)
 *   30 × Recent Window occurrence
 *   20 × Micro Window occurrence
 *   10 × repetition/recency
 */
export const scoreCandidate = (candidate, type, options) => {
    const overall =
        type === 'HIGH' ? (candidate.pct - 10) / 10 : (10 - candidate.pct) / 10;
    const clamp = v => Math.min(1, Math.max(0, v));
    const recency = Number.isFinite(candidate.last_seen)
        ? 1 - Math.min(candidate.last_seen, options.recent_window) / options.recent_window
        : 0;
    const repetition = Math.min(1, candidate.repeats / 3);
    const score =
        40 * clamp(overall) +
        30 * clamp(candidate.recent_pct / 100) +
        20 * clamp(candidate.micro_pct / 100) +
        10 * (0.5 * repetition + 0.5 * recency);
    return Math.round(score * 100) / 100;
};

const buildGroup = (type, digits_in_tie, features) => {
    if (digits_in_tie.length < 2) return { type, exists: false, digits: digits_in_tie };
    const candidates = digits_in_tie.map(d => features[d]);
    const { selected, reason } = breakTie(candidates);
    const pcts = candidates.map(c => c.pct);
    return {
        type,
        exists: true,
        digits: digits_in_tie,
        pct_min: Math.min(...pcts),
        pct_max: Math.max(...pcts),
        selected: selected ? selected.digit : null,
        reason,
    };
};

/** Full High/Low tie analysis of the latest window (no state). */
export const analyzeHighLowTie = (digits_all, raw_options = {}) => {
    const options = normalizeHighLowTieOptions(raw_options);
    const window = digits_all.slice(-options.analysis_window);
    const recent = window.slice(-options.recent_window);
    const micro = window.slice(-options.micro_window);
    const counts = countDigits(window);
    const recent_counts = countDigits(recent);
    const micro_counts = countDigits(micro);
    const total = window.length;

    const features = counts.map((count, digit) => ({
        digit,
        count,
        pct: pctOf(count, total),
        recent_count: recent_counts[digit],
        recent_pct: pctOf(recent_counts[digit], recent.length),
        micro_count: micro_counts[digit],
        micro_pct: pctOf(micro_counts[digit], micro.length),
        repeats: countRepeats(recent, digit),
        last_seen: ticksSinceSeen(window, digit),
    }));

    const max_count = Math.max(...counts);
    const min_count = Math.min(...counts);
    const tol = options.tie_tolerance + EPSILON;
    const high_digits = features.filter(f => pctOf(max_count - f.count, total) <= tol).map(f => f.digit);
    const low_digits = features.filter(f => pctOf(f.count - min_count, total) <= tol).map(f => f.digit);

    const high = buildGroup('HIGH', high_digits, features);
    const low = buildGroup('LOW', low_digits, features);

    let target = null;
    let target_type = null;
    let target_reason = '';
    let status = STATUS.VALID_SIGNAL;
    let rejection = '';
    let auto = null;

    const usable = group => group.exists && group.selected !== null;
    const groups = options.mode === 'HIGH' ? [high] : options.mode === 'LOW' ? [low] : [high, low];
    const existing = groups.filter(g => g.exists);
    const resolved = groups.filter(usable);

    if (!existing.length) {
        status = STATUS.NO_TIE;
        rejection =
            options.mode === 'AUTO'
                ? 'No HIGH tie and no LOW tie in the analysis window.'
                : `No ${options.mode} tie in the analysis window.`;
    } else if (!resolved.length) {
        status = STATUS.TIE_UNRESOLVED;
        rejection = `Tie-breakers cannot pick a clear candidate (${existing.map(g => g.reason).join('; ')}).`;
    } else if (resolved.length === 1) {
        [{ selected: target, type: target_type, reason: target_reason }] = resolved;
    } else {
        const high_score = scoreCandidate(features[high.selected], 'HIGH', options);
        const low_score = scoreCandidate(features[low.selected], 'LOW', options);
        auto = { high_digit: high.selected, low_digit: low.selected, high_score, low_score };
        if (high.selected === low.selected) {
            target = high.selected;
            target_type = 'HIGH';
            target_reason = high.reason;
        } else if (Math.abs(high_score - low_score) < EPSILON) {
            status = STATUS.AUTO_EQUAL;
            rejection = `AUTO scores equal (HIGH ${high.selected}=${high_score} vs LOW ${low.selected}=${low_score}).`;
        } else {
            const pick = high_score > low_score ? high : low;
            target = pick.selected;
            target_type = pick.type;
            target_reason = pick.reason;
        }
        if (auto) auto.target = target;
    }

    return {
        options,
        total,
        counts,
        percentages: features.map(f => f.pct),
        features,
        high,
        low,
        auto,
        target,
        target_type,
        target_reason,
        setup_key: target !== null ? `${target_type}:${(target_type === 'HIGH' ? high : low).digits.join('')}:${target}` : null,
        status: target !== null ? STATUS.VALID_SIGNAL : status,
        rejection,
    };
};

export const recordHighLowTieOutcome = (state, actual_digit) => {
    if (!state?.pending_outcome) return null;
    const digit = toDigit(actual_digit);
    if (digit === null) return null;
    const pending = state.pending_outcome;
    const won = digit !== pending.target;
    const live = state.live;
    live.trades += 1;
    if (won) {
        live.wins += 1;
        live.streak = live.streak > 0 ? live.streak + 1 : 1;
    } else {
        live.losses += 1;
        live.streak = live.streak < 0 ? live.streak - 1 : -1;
    }
    live.last_outcome = { target: pending.target, actual: digit, result: won ? 'WIN' : 'LOSS' };
    live.history.push({ ...live.last_outcome, type: pending.type });
    if (live.history.length > 200) live.history = live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, target: pending.target };
};

const formatPct = value => `${value.toFixed(2)}%`;

const formatStreak = streak => {
    if (streak > 0) return `${streak} win${streak === 1 ? '' : 's'}`;
    if (streak < 0) return `${-streak} loss${streak === -1 ? '' : 'es'}`;
    return '0';
};

const describeGroup = (label, group) => {
    if (!group.exists) return `${label}: none`;
    const pct =
        Math.abs(group.pct_max - group.pct_min) < EPSILON
            ? formatPct(group.pct_max)
            : `${formatPct(group.pct_min)}–${formatPct(group.pct_max)}`;
    const selected = group.selected === null ? 'no clear candidate' : `selected ${group.selected}`;
    return `${label}: digits ${group.digits.join(', ')} @ ${pct} → ${selected} (${group.reason})`;
};

const buildJournal = ({ options, analysis, status, rejection, target, settled, state, cooldown_left }) => {
    const messages = [
        { className: 'journal__text', message: `══ HIGH-LOW TIE DIFFERS (${options.mode}) ══` },
    ];

    if (settled) {
        messages.push({
            className: settled.won ? 'journal__text--success' : 'journal__text--error',
            message: `RESULT: ${settled.won ? 'WIN' : 'LOSS'} — DIFFERS ${settled.target}, landed ${settled.actual}`,
        });
    }

    messages.push({
        className: 'journal__text',
        message: `Analysis Window: ${analysis ? analysis.total : 0}/${options.analysis_window} | Recent Window: ${
            options.recent_window
        } | Micro Window: ${options.micro_window} | Tie Tolerance: ${options.tie_tolerance}%`,
    });

    if (analysis && status !== STATUS.COLLECTING) {
        const row = digits =>
            digits
                .map(d => `${d} | ${analysis.counts[d]} | ${analysis.percentages[d].toFixed(1)}%`)
                .join('   ');
        messages.push({ className: 'journal__text', message: `Digit | Count | %: ${row([0, 1, 2, 3, 4])}` });
        messages.push({ className: 'journal__text', message: `Digit | Count | %: ${row([5, 6, 7, 8, 9])}` });
        if (options.mode !== 'LOW') messages.push({ className: 'journal__text', message: describeGroup('HIGH TIE', analysis.high) });
        if (options.mode !== 'HIGH') messages.push({ className: 'journal__text', message: describeGroup('LOW TIE', analysis.low) });
        if (analysis.auto) {
            const { high_digit, low_digit, high_score, low_score } = analysis.auto;
            messages.push({
                className: 'journal__text',
                message: `AUTO: High-Tie ${high_digit} score ${high_score} vs Low-Tie ${low_digit} score ${low_score} → ${
                    analysis.target === null ? 'no target' : `target ${analysis.target}`
                }`,
            });
        }
    }

    if (status === STATUS.VALID_SIGNAL) {
        messages.push({ className: 'journal__text--success', message: `TRADE: DIFFERS ${target}` });
    } else {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
    }

    const { trades, wins, losses, streak } = state.live;
    messages.push({
        className: 'journal__text',
        message: `Trades: ${trades} | Wins: ${wins} | Losses: ${losses} | Win rate: ${
            trades ? ((wins / trades) * 100).toFixed(1) : '0.0'
        }% | Streak: ${formatStreak(streak)} | Cooldown: ${cooldown_left}/${options.signal_cooldown_tips}`,
    });
    return messages;
};

export const evaluateHighLowTie = (raw_ticks, raw_options = {}, state = createHighLowTieState()) => {
    const options = normalizeHighLowTieOptions(raw_options);
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
    let settled = null;
    if (state.last_tip_fp !== null && state.pending_outcome) {
        const { epoch: signal_epoch } = state.pending_outcome;
        const settle_tick =
            signal_epoch !== null && tip.epoch !== null
                ? all_ticks.find(t => t.epoch !== null && t.epoch > signal_epoch)
                : tip;
        if (settle_tick) settled = recordHighLowTieOutcome(state, settle_tick.digit);
    }
    state.last_tip_fp = fp;
    state.tip_index += 1;

    let prediction = -1;
    let status;
    let rejection = '';
    let target = null;
    let analysis = null;

    const since_signal = state.last_signal_tip >= 0 ? state.tip_index - state.last_signal_tip : Infinity;
    const cooldown_active = options.signal_cooldown_tips > 0 && since_signal <= options.signal_cooldown_tips;
    const cooldown_left = cooldown_active ? options.signal_cooldown_tips - since_signal + 1 : 0;

    if (window_ticks.length < options.analysis_window) {
        status = STATUS.COLLECTING;
        rejection = `Insufficient ticks ${window_ticks.length}/${options.analysis_window}.`;
        state.armed = null;
    } else {
        analysis = analyzeHighLowTie(
            window_ticks.map(t => t.digit),
            options
        );
        const armed = state.armed;
        state.armed = null;

        if (analysis.setup_key !== state.last_traded_key) state.last_traded_key = null;

        if (cooldown_active) {
            status = STATUS.COOLDOWN_ACTIVE;
            rejection = `Cooldown active (${cooldown_left} tick${cooldown_left === 1 ? '' : 's'} left).`;
        } else if (analysis.target === null) {
            status = armed ? STATUS.SETUP_CANCELLED : analysis.status;
            rejection = armed
                ? `Setup DIFFERS ${armed.target} (${armed.type} tie) disappeared on the new tick — ${analysis.rejection}`
                : analysis.rejection;
        } else if (analysis.setup_key === state.last_traded_key) {
            status = STATUS.SETUP_ALREADY_TRADED;
            rejection = `Setup DIFFERS ${analysis.target} (${analysis.target_type} tie) already traded — waiting for a new setup.`;
        } else if (armed && armed.key === analysis.setup_key) {
            target = analysis.target;
            prediction = target;
            status = STATUS.VALID_SIGNAL;
            state.last_signal_tip = state.tip_index;
            state.last_traded_key = analysis.setup_key;
            state.pending_outcome = { target, type: analysis.target_type, epoch: tip.epoch };
        } else {
            state.armed = { key: analysis.setup_key, target: analysis.target, type: analysis.target_type };
            status = armed ? STATUS.SETUP_CANCELLED : STATUS.AWAITING_CONFIRMATION;
            rejection = armed
                ? `Target changed from DIFFERS ${armed.target} (${armed.type}) to DIFFERS ${analysis.target} (${analysis.target_type}) — old setup cancelled, new setup waiting for next-tick confirmation.`
                : `Setup DIFFERS ${analysis.target} (${analysis.target_type} tie) found — confirming on the next tick.`;
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({ options, analysis, status, rejection, target, settled, state, cooldown_left })
        : [];

    const { trades, wins } = state.live;
    const result = {
        prediction,
        barrier: prediction,
        matched: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITDIFF' : null,
        target,
        target_type: analysis?.target_type ?? null,
        target_reason: analysis?.target_reason ?? '',
        high: analysis?.high ?? null,
        low: analysis?.low ?? null,
        auto: analysis?.auto ?? null,
        percentages: analysis?.percentages ?? [],
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        cooldown_left,
        live: {
            ...state.live,
            win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        },
        options,
        journal_messages,
    };
    state.last_result = result;
    return result;
};

export const replayHighLowTie = (raw_ticks, raw_options = {}) => {
    const options = normalizeHighLowTieOptions({ ...raw_options, journal_enabled: false });
    const state = createHighLowTieState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const result = evaluateHighLowTie(digits.slice(0, i + 1), options, state);
        if (result.matched) signals.push({ tip: i, target: result.target, type: result.target_type });
    }

    const { trades, wins, losses } = state.live;
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
