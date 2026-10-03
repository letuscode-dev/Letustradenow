/**
 * High-Low Tie Differs
 *
 * Over the last `analysis_window` ticks (min 100, default 200) compute digit 0–9
 * occurrence %. A HIGH TIE is two or more digits sharing the highest %, a LOW TIE
 * two or more digits sharing the lowest % (within `tie_tolerance` percentage points
 * of that extreme, inclusive). When every digit has the same % (HIGH and LOW groups
 * overlap completely) there is no extreme and no trade.
 *
 * The Analysis Window is the ONLY tick window: counts, percentages, ties,
 * tie-breakers and AUTO scores all come from it.
 *
 * One candidate per tie is chosen deterministically — never randomly:
 *   1. occurrence count (only differs inside a tolerance tie): HIGH keeps the
 *      higher count, LOW keeps the lower count — the digit at the true extreme
 *   2. more repetition/clustering (back-to-back repeats inside the Analysis Window)
 *   3. appeared most recently (inside the Analysis Window)
 * If candidates are still equal after all three, there is no trade.
 *
 * MODE HIGH / LOW trades that tie only. AUTO requires every qualifying tie to resolve
 * (an unresolved tie blocks the trade); when both resolve the candidate with the
 * higher weighted score wins and equal scores mean no trade:
 *   score = 80 × clamp01(overall) + 10 × repetition + 10 × recency
 *   overall    = (pct − 10) / 10 for HIGH, (10 − pct) / 10 for LOW
 *   repetition = repeats / (count − 1)   (share of occurrences that repeat back-to-back, 0 if count ≤ 1)
 *   recency    = 1 − ticks_since_seen / window_size   (0 if unseen)
 * Scores are compared unrounded (with a float tolerance) and only rounded for display.
 *
 * New tick validation: a setup is armed on one tick and only traded when the next
 * tick recalculates to the same tie type, tie digits and target; otherwise it is
 * cancelled. After a trade the same setup is not repeated until it changes, and a
 * cooldown of `signal_cooldown_tips` ticks applies.
 *
 * WIN/LOSS statistics come from the settled purchased contract
 * (`recordHighLowTieContract`), never from a market tick.
 */

import { MAX_ANALYSIS_WINDOW } from './top-two-digit-gap-differ';

export const STATUS = {
    COLLECTING: 'COLLECTING',
    NO_TIE: 'NO_TIE',
    NO_EXTREME_TIE: 'NO_EXTREME_TIE',
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
export const MAX_TIE_TOLERANCE = 10;

export const DEFAULT_OPTIONS = {
    analysis_window: 200,
    tie_tolerance: 0,
    mode: 'AUTO',
    signal_cooldown_tips: 1,
    journal_enabled: true,
};

const EPSILON = 1e-9;
const SCORE_EPSILON = 1e-6;

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const isProvided = value => value !== undefined && value !== null && value !== '';

/**
 * Clamp a numeric setting and describe any adjustment so the journal can show
 * "requested X → actual Y (reason)".
 */
const clampSetting = ({ label, value, fallback, min, max, integer, max_reason, adjustments }) => {
    if (!isProvided(value)) return fallback;
    const requested = Number(value);
    if (!Number.isFinite(requested)) {
        adjustments.push({ setting: label, requested: value, actual: fallback, reason: 'not a number, default used' });
        return fallback;
    }
    let actual = integer ? Math.floor(requested) : requested;
    let reason = integer && actual !== requested ? 'whole ticks only' : '';
    if (actual < min) {
        actual = min;
        reason = `minimum allowed value is ${min}`;
    } else if (actual > max) {
        actual = max;
        reason = max_reason || `maximum allowed value is ${max}`;
    }
    if (actual !== requested) adjustments.push({ setting: label, requested, actual, reason });
    return actual;
};

export const normalizeMode = value => {
    const text = String(value ?? '').toUpperCase();
    if (text.includes('AUTO')) return 'AUTO';
    if (text.includes('HIGH')) return 'HIGH';
    if (text.includes('LOW')) return 'LOW';
    return null;
};

export const normalizeHighLowTieOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    const adjustments = [];
    const analysis_window = clampSetting({
        label: 'Analysis Window',
        value: options.analysis_window,
        fallback: d.analysis_window,
        min: MIN_ANALYSIS_WINDOW,
        max: MAX_ANALYSIS_WINDOW,
        integer: true,
        adjustments,
    });
    const tie_tolerance = clampSetting({
        label: 'Tie Tolerance %',
        value: options.tie_tolerance,
        fallback: d.tie_tolerance,
        min: 0,
        max: MAX_TIE_TOLERANCE,
        integer: false,
        adjustments,
    });
    const signal_cooldown_tips = clampSetting({
        label: 'Cooldown Ticks',
        value: options.signal_cooldown_tips,
        fallback: d.signal_cooldown_tips,
        min: 0,
        max: 100,
        integer: true,
        adjustments,
    });
    let mode = normalizeMode(options.mode);
    if (mode === null) {
        mode = d.mode;
        if (isProvided(options.mode)) {
            adjustments.push({
                setting: 'Mode',
                requested: options.mode,
                actual: mode,
                reason: 'use HIGH, LOW or AUTO',
            });
        }
    }
    return {
        analysis_window,
        tie_tolerance,
        mode,
        signal_cooldown_tips,
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        adjustments,
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
    last_settled_contract_id: null,
    just_settled: null,
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

/** Tie-breakers in priority order; `type` decides the count direction. */
const tieBreakers = type => [
    {
        label: 'Occurrence Count',
        metric: 'COUNT',
        compare: (a, b) => (type === 'LOW' ? a.count - b.count : b.count - a.count),
        describe: c => `${c.count} (${c.pct.toFixed(2)}%)`,
    },
    {
        label: 'Repetition',
        metric: 'REPETITION',
        compare: (a, b) => b.repeats - a.repeats,
        describe: c => `${c.repeats} repeat${c.repeats === 1 ? '' : 's'}`,
    },
    {
        label: 'Recency',
        metric: 'RECENCY',
        compare: (a, b) => {
            if (a.last_seen === b.last_seen) return 0;
            return a.last_seen < b.last_seen ? -1 : 1;
        },
        describe: c => describeTicksAgo(c.last_seen),
    },
];

/**
 * Pick one candidate from a tie using the fixed tie-breaker priority. The first
 * breaker that separates the top two candidates decides; later breakers are never
 * consulted. Returns { selected, reason, decider } or { selected: null, ... } when
 * the top candidates are still equal.
 */
export const breakTie = (candidates, type = 'HIGH') => {
    const breakers = tieBreakers(type);
    const sorted = [...candidates].sort((a, b) => {
        for (const breaker of breakers) {
            const diff = breaker.compare(a, b);
            if (diff !== 0) return diff;
        }
        return 0;
    });
    const [first, second] = sorted;
    if (!second) return { selected: first ?? null, reason: 'single candidate', decider: null };
    const decider = breakers.find(breaker => breaker.compare(first, second) !== 0);
    if (!decider) {
        return {
            selected: null,
            reason: `${first.digit} and ${second.digit} equal on count, repetition and recency`,
            decider: null,
        };
    }
    return {
        selected: first,
        reason: `${decider.label} ${first.digit}=${decider.describe(first)} vs ${second.digit}=${decider.describe(
            second
        )}`,
        decider,
    };
};

/** Unrounded AUTO score (0–100); see the module comment for the formula. */
export const rawScoreCandidate = (candidate, type, window_size) => {
    const clamp = v => Math.min(1, Math.max(0, v));
    const overall = type === 'HIGH' ? (candidate.pct - 10) / 10 : (10 - candidate.pct) / 10;
    const repetition = candidate.count > 1 ? candidate.repeats / (candidate.count - 1) : 0;
    const recency =
        Number.isFinite(candidate.last_seen) && window_size > 0 ? 1 - candidate.last_seen / window_size : 0;
    return 80 * clamp(overall) + 10 * clamp(repetition) + 10 * clamp(recency);
};

/** AUTO score rounded to 2 decimals for display. */
export const scoreCandidate = (candidate, type, window_size) =>
    Math.round(rawScoreCandidate(candidate, type, window_size) * 100) / 100;

const buildGroup = (type, digits_in_tie, features) => {
    if (digits_in_tie.length < 2) return { type, exists: false, digits: digits_in_tie };
    const candidates = digits_in_tie.map(d => features[d]);
    const { selected, reason, decider } = breakTie(candidates, type);
    const pcts = candidates.map(c => c.pct);
    return {
        type,
        exists: true,
        digits: digits_in_tie,
        pct_min: Math.min(...pcts),
        pct_max: Math.max(...pcts),
        selected: selected ? selected.digit : null,
        reason,
        decider: decider ? decider.label : null,
        decider_detail: decider
            ? `${decider.metric}: ${candidates.map(c => `${c.digit} = ${decider.describe(c)}`).join(', ')}`
            : null,
    };
};

/**
 * Decide the trade target from the HIGH / LOW groups (pure, no tick data).
 * Every qualifying tie in scope must resolve; an unresolved tie blocks the trade.
 */
export const selectHighLowTarget = ({ high, low, features, options, window_size }) => {
    const none = (status, rejection, auto = null) => ({
        target: null,
        target_type: null,
        target_reason: '',
        status,
        rejection,
        auto,
    });

    const all_digits_tied = high.exists && low.exists && high.digits.length === 10;
    const same_groups =
        high.exists && low.exists && high.digits.length === low.digits.length && high.digits.every(d => low.digits.includes(d));
    if (all_digits_tied || same_groups) {
        return none(
            STATUS.NO_EXTREME_TIE,
            `HIGH and LOW groups overlap completely (${high.digits.join(', ')}) — no distinct extreme.`
        );
    }

    const groups = options.mode === 'HIGH' ? [high] : options.mode === 'LOW' ? [low] : [high, low];
    const existing = groups.filter(g => g.exists);
    if (!existing.length) {
        return none(
            STATUS.NO_TIE,
            options.mode === 'AUTO'
                ? 'No HIGH tie and no LOW tie in the analysis window.'
                : `No ${options.mode} tie in the analysis window.`
        );
    }

    const unresolved = existing.filter(g => g.selected === null);
    if (unresolved.length) {
        return none(
            STATUS.TIE_UNRESOLVED,
            `${unresolved.map(g => `${g.type} tie ${g.digits.join(', ')}: ${g.reason}`).join('; ')} — tie-breakers cannot pick one target.`
        );
    }

    if (existing.length === 1) {
        const [only] = existing;
        return {
            target: only.selected,
            target_type: only.type,
            target_reason: only.reason,
            status: STATUS.VALID_SIGNAL,
            rejection: '',
            auto: null,
        };
    }

    const high_raw = rawScoreCandidate(features[high.selected], 'HIGH', window_size);
    const low_raw = rawScoreCandidate(features[low.selected], 'LOW', window_size);
    const auto = {
        high_digit: high.selected,
        low_digit: low.selected,
        high_score: Math.round(high_raw * 100) / 100,
        low_score: Math.round(low_raw * 100) / 100,
        target: null,
    };
    if (high.selected === low.selected) {
        auto.target = high.selected;
        return {
            target: high.selected,
            target_type: 'HIGH',
            target_reason: high.reason,
            status: STATUS.VALID_SIGNAL,
            rejection: '',
            auto,
        };
    }
    if (Math.abs(high_raw - low_raw) < SCORE_EPSILON) {
        return none(
            STATUS.AUTO_EQUAL,
            `AUTO scores equal (HIGH ${high.selected}=${auto.high_score} vs LOW ${low.selected}=${auto.low_score}).`,
            auto
        );
    }
    const pick = high_raw > low_raw ? high : low;
    auto.target = pick.selected;
    return {
        target: pick.selected,
        target_type: pick.type,
        target_reason: pick.reason,
        status: STATUS.VALID_SIGNAL,
        rejection: '',
        auto,
    };
};

/** Full High/Low tie analysis of the latest window (no state). */
export const analyzeHighLowTie = (digits_all, raw_options = {}) => {
    const options = normalizeHighLowTieOptions(raw_options);
    const window = digits_all.slice(-options.analysis_window);
    const counts = countDigits(window);
    const total = window.length;

    const features = counts.map((count, digit) => ({
        digit,
        count,
        pct: pctOf(count, total),
        repeats: countRepeats(window, digit),
        last_seen: ticksSinceSeen(window, digit),
    }));

    const max_count = Math.max(...counts);
    const min_count = Math.min(...counts);
    const tol = options.tie_tolerance + EPSILON;
    const high_digits = features.filter(f => pctOf(max_count - f.count, total) <= tol).map(f => f.digit);
    const low_digits = features.filter(f => pctOf(f.count - min_count, total) <= tol).map(f => f.digit);

    const high = buildGroup('HIGH', high_digits, features);
    const low = buildGroup('LOW', low_digits, features);
    const decision = selectHighLowTarget({ high, low, features, options, window_size: total });
    const source = decision.target_type === 'HIGH' ? high : decision.target_type === 'LOW' ? low : null;

    return {
        options,
        total,
        counts,
        percentages: features.map(f => f.pct),
        features,
        high,
        low,
        ...decision,
        setup_key: source ? `${decision.target_type}:${source.digits.join('')}:${decision.target}` : null,
    };
};

const contractId = contract => contract?.contract_id ?? contract?.transaction_ids?.buy ?? null;

const isContractSettled = contract =>
    Boolean(
        contract &&
            contract.status !== 'open' &&
            (contract.is_sold || contract.status === 'won' || contract.status === 'lost' || contract.sell_price != null)
    );

const lastDigitOf = value => {
    if (!isProvided(value)) return null;
    const text = String(value).replace(/[^0-9]/g, '');
    return text.length ? Number(text[text.length - 1]) : null;
};

/**
 * Record the WIN/LOSS of the purchased contract for the pending signal.
 * Only a settled contract bought for this signal (same target barrier, bought at or
 * after the signal tick, not already recorded) is accepted.
 */
export const recordHighLowTieContract = (state, contract) => {
    const pending = state?.pending_outcome;
    if (!pending || !isContractSettled(contract)) return null;
    const id = contractId(contract);
    if (id === null || id === state.last_settled_contract_id) return null;
    const purchase_time = Number(contract.purchase_time ?? contract.date_start);
    if (pending.epoch !== null && Number.isFinite(purchase_time) && purchase_time < pending.epoch) return null;
    const barrier = toDigit(contract.barrier);
    if (barrier !== null && barrier !== pending.target) return null;

    const profit = Number(contract.profit);
    const won =
        contract.status === 'won' || contract.status === 'lost'
            ? contract.status === 'won'
            : Number.isFinite(profit) && profit > 0;
    const exit_digit = lastDigitOf(contract.exit_tick_display_value ?? contract.exit_tick);

    const live = state.live;
    live.trades += 1;
    if (won) {
        live.wins += 1;
        live.streak = live.streak > 0 ? live.streak + 1 : 1;
    } else {
        live.losses += 1;
        live.streak = live.streak < 0 ? live.streak - 1 : -1;
    }
    live.last_outcome = {
        target: pending.target,
        actual: exit_digit,
        result: won ? 'WIN' : 'LOSS',
        contract_id: id,
        profit: Number.isFinite(profit) ? profit : null,
    };
    live.history.push({ ...live.last_outcome, type: pending.type });
    if (live.history.length > 200) live.history = live.history.slice(-200);
    state.last_settled_contract_id = id;
    state.pending_outcome = null;
    state.just_settled = live.last_outcome;
    return live.last_outcome;
};

const formatPct = value => `${value.toFixed(2)}%`;

const formatStreak = streak => {
    if (streak > 0) return `${streak} win${streak === 1 ? '' : 's'}`;
    if (streak < 0) return `${-streak} loss${streak === -1 ? '' : 'es'}`;
    return '0';
};

const formatTiePct = group =>
    Math.abs(group.pct_max - group.pct_min) < EPSILON
        ? formatPct(group.pct_max)
        : `${formatPct(group.pct_min)}–${formatPct(group.pct_max)}`;

const describeGroup = (label, group) => {
    if (!group.exists) return [`${label} TIE: none`];
    const tie_break = group.decider
        ? `${group.decider} (${group.decider_detail})`
        : `unresolved — ${group.reason}`;
    return [
        `${label} TIE: ${group.digits.join(', ')} @ ${formatTiePct(group)}`,
        `${label} TIE-BREAK: ${tie_break}`,
        `${label} SELECTED: ${group.selected === null ? 'none (no clear candidate)' : group.selected}`,
    ];
};

const describeSettlement = settled => {
    const parts = [`RESULT: ${settled.result} — DIFFERS ${settled.target}`, `contract ${settled.contract_id}`];
    if (settled.actual !== null) parts.push(`exit digit ${settled.actual}`);
    if (settled.profit !== null) parts.push(`profit ${settled.profit >= 0 ? '+' : ''}${settled.profit.toFixed(2)}`);
    return parts.join(' | ');
};

const tradeDetailLines = analysis => {
    const source = analysis.target_type === 'HIGH' ? analysis.high : analysis.low;
    const lines = [
        `SOURCE: ${analysis.target_type} TIE`,
        `TIE CANDIDATES: ${source.digits.join(', ')}`,
        `TIE PERCENTAGE: ${formatTiePct(source)}`,
        `TIE-BREAK: ${source.decider || source.reason}`,
    ];
    if (source.decider_detail) lines.push(source.decider_detail);
    if (analysis.auto) {
        lines.push(`HIGH CANDIDATE: ${analysis.auto.high_digit}`);
        lines.push(`HIGH SCORE: ${analysis.auto.high_score.toFixed(2)}`);
        lines.push(`LOW CANDIDATE: ${analysis.auto.low_digit}`);
        lines.push(`LOW SCORE: ${analysis.auto.low_score.toFixed(2)}`);
    }
    return lines;
};

const buildJournal = ({ options, analysis, status, rejection, target, settled, state, cooldown_left }) => {
    const messages = [{ className: 'journal__text', message: `══ HIGH-LOW TIE DIFFERS (${options.mode}) ══` }];

    if (settled) {
        messages.push({
            className: settled.result === 'WIN' ? 'journal__text--success' : 'journal__text--error',
            message: describeSettlement(settled),
        });
    }

    options.adjustments.forEach(adj => {
        messages.push({
            className: 'journal__text--warn',
            message: `SETTING ADJUSTED: ${adj.setting} requested ${adj.requested} → actual ${adj.actual} (${adj.reason})`,
        });
    });

    const loaded = analysis ? analysis.total : 0;
    messages.push({
        className: 'journal__text',
        message: `ANALYSIS WINDOW: ${options.analysis_window} TICKS${
            loaded < options.analysis_window ? ` (loaded ${loaded})` : ''
        } | TIE TOLERANCE: ${options.tie_tolerance}%`,
    });

    if (analysis && status !== STATUS.COLLECTING) {
        messages.push({ className: 'journal__text', message: 'DIGIT | COUNT | %' });
        analysis.counts.forEach((count, digit) => {
            messages.push({
                className: 'journal__text',
                message: `${digit} | ${count} | ${analysis.percentages[digit].toFixed(1)}%`,
            });
        });
        const groupLines = [
            ...(options.mode !== 'LOW' ? describeGroup('HIGH', analysis.high) : []),
            ...(options.mode !== 'HIGH' ? describeGroup('LOW', analysis.low) : []),
        ];
        groupLines.forEach(message => messages.push({ className: 'journal__text', message }));
        if (analysis.auto) {
            const { high_digit, low_digit, high_score, low_score } = analysis.auto;
            messages.push({
                className: 'journal__text',
                message: `AUTO: High-Tie ${high_digit} score ${high_score.toFixed(2)} vs Low-Tie ${low_digit} score ${low_score.toFixed(
                    2
                )} → ${analysis.target === null ? 'no target' : `target ${analysis.target}`}`,
            });
        }
    }

    if (status === STATUS.VALID_SIGNAL) {
        messages.push({ className: 'journal__text--success', message: `TRADE: DIFFERS ${target}` });
        tradeDetailLines(analysis).forEach(message => messages.push({ className: 'journal__text', message }));
    } else {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
    }

    const { trades, wins, losses, streak, last_outcome } = state.live;
    messages.push({
        className: 'journal__text',
        message: `Last Result: ${last_outcome ? last_outcome.result : '—'} | Trades: ${trades} | Wins: ${wins} | Losses: ${losses} | Win rate: ${
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
    const settled = state.just_settled;
    state.just_settled = null;
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
            state.pending_outcome = { target, type: analysis.target_type, epoch: tip.epoch, tip: state.tip_index };
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
        settled,
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

/**
 * Backtest without look-ahead. There is no purchased contract in a replay, so each
 * signal is settled with a simulated 1-tick contract on the following tick.
 */
export const replayHighLowTie = (raw_ticks, raw_options = {}) => {
    const options = normalizeHighLowTieOptions({ ...raw_options, journal_enabled: false });
    const state = createHighLowTieState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const pending = state.pending_outcome;
        if (pending) {
            recordHighLowTieContract(state, {
                contract_id: `replay-${i}`,
                status: digits[i] !== pending.target ? 'won' : 'lost',
                barrier: pending.target,
                exit_tick: digits[i],
            });
        }
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
