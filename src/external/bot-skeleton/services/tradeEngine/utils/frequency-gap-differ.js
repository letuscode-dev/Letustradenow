/**
 * Frequency Gap Differs
 *
 * Uses exactly ONE tick window (the Analysis Window, min 50, default 200):
 *
 *   single Analysis Window → count digits 0–9 → % = count / window size × 100
 *   → unique highest (DOMINANT) → unique lowest (WEAKEST)
 *   → gap = dominant % − weakest %
 *   → gap ≥ Minimum Frequency Gap (inclusive) → DIFFER the dominant digit
 *   → otherwise no trade
 *
 * The weakest digit is only used for the gap; it is never the target. A tied
 * dominant or tied weakest digit (including all digits equal) means no trade —
 * nothing is ever selected randomly.
 *
 * Optional new-tick confirmation (same window): a valid setup is armed on one tick
 * and traded only if the next tick recalculates to the same dominant and weakest
 * digits with the gap still at or above the minimum; otherwise it is cancelled.
 *
 * WIN/LOSS statistics come from the settled purchased contract.
 */

import {
    createLiveStats,
    describeLiveStats,
    describeSettlement,
    recordSettledDiffersContract,
} from './differs-contract-settlement';
import { MAX_ANALYSIS_WINDOW } from './top-two-digit-gap-differ';

export const STATUS = {
    DISABLED: 'DISABLED',
    COLLECTING: 'COLLECTING',
    ALL_EQUAL: 'ALL_EQUAL',
    DOMINANT_TIED: 'DOMINANT_TIED',
    WEAKEST_TIED: 'WEAKEST_TIED',
    GAP_TOO_SMALL: 'GAP_TOO_SMALL',
    AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
    SETUP_CANCELLED: 'SETUP_CANCELLED',
    SIGNAL_CONSUMED: 'SIGNAL_CONSUMED',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const MIN_ANALYSIS_WINDOW = 50;
export const MAX_MIN_GAP = 100;

export const DEFAULT_OPTIONS = {
    analysis_window: 200,
    min_gap: 7,
    enabled: true,
    confirmation: true,
    journal_enabled: true,
};

const EPSILON = 1e-9;

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const isProvided = value => value !== undefined && value !== null && value !== '';

const toBool = (value, default_value) => {
    if (!isProvided(value)) return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const clampSetting = ({ label, value, fallback, min, max, integer, adjustments }) => {
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
        reason = `maximum allowed value is ${max}`;
    }
    if (actual !== requested) adjustments.push({ setting: label, requested, actual, reason });
    return actual;
};

export const normalizeFrequencyGapOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    const adjustments = [];
    return {
        analysis_window: clampSetting({
            label: 'Analysis Window',
            value: options.analysis_window,
            fallback: d.analysis_window,
            min: MIN_ANALYSIS_WINDOW,
            max: MAX_ANALYSIS_WINDOW,
            integer: true,
            adjustments,
        }),
        min_gap: clampSetting({
            label: 'Minimum Frequency Gap %',
            value: options.min_gap,
            fallback: d.min_gap,
            min: 0,
            max: MAX_MIN_GAP,
            integer: false,
            adjustments,
        }),
        enabled: toBool(options.enabled, d.enabled),
        confirmation: toBool(options.confirmation, d.confirmation),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
        adjustments,
    };
};

export const createFrequencyGapState = () => ({
    last_tip_fp: null,
    armed: null,
    last_result: null,
    pending_outcome: null,
    last_settled_contract_id: null,
    just_settled: null,
    live: createLiveStats(),
});

export const resetFrequencyGapState = (state = null) => {
    const next = createFrequencyGapState();
    if (!state || typeof state !== 'object') return next;
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, next);
    return state;
};

export const recordFrequencyGapContract = recordSettledDiffersContract;

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

const pctOf = (count, total) => (total ? (count / total) * 100 : 0);

/** Frequency-gap analysis of one full Analysis Window (no state). */
export const analyzeFrequencyGap = (digits, raw_options = {}) => {
    const options = normalizeFrequencyGapOptions(raw_options);
    const window = digits.slice(-options.analysis_window);
    const total = window.length;
    const counts = Array.from({ length: 10 }, () => 0);
    window.forEach(d => {
        counts[d] += 1;
    });
    const percentages = counts.map(c => pctOf(c, total));

    const max_count = Math.max(...counts);
    const min_count = Math.min(...counts);
    const dominant_digits = counts.flatMap((c, d) => (c === max_count ? [d] : []));
    const weakest_digits = counts.flatMap((c, d) => (c === min_count ? [d] : []));
    const gap = pctOf(max_count - min_count, total);

    const base = {
        options,
        total,
        counts,
        percentages,
        dominant_digits,
        weakest_digits,
        dominant: dominant_digits.length === 1 ? dominant_digits[0] : null,
        weakest: weakest_digits.length === 1 ? weakest_digits[0] : null,
        dominant_count: max_count,
        weakest_count: min_count,
        dominant_pct: pctOf(max_count, total),
        weakest_pct: pctOf(min_count, total),
        gap,
        target: null,
        setup_key: null,
        condition_passed: false,
    };

    if (max_count === min_count) {
        return { ...base, status: STATUS.ALL_EQUAL, rejection: 'All digits have the same frequency — no dominant or weakest digit.' };
    }
    if (dominant_digits.length > 1) {
        return {
            ...base,
            status: STATUS.DOMINANT_TIED,
            rejection: `Dominant digit tied: ${dominant_digits.join(', ')} at ${base.dominant_pct.toFixed(2)}%.`,
        };
    }
    if (weakest_digits.length > 1) {
        return {
            ...base,
            status: STATUS.WEAKEST_TIED,
            rejection: `Weakest digit tied: ${weakest_digits.join(', ')} at ${base.weakest_pct.toFixed(2)}%.`,
        };
    }
    if (gap + EPSILON < options.min_gap) {
        return {
            ...base,
            status: STATUS.GAP_TOO_SMALL,
            rejection: `Frequency gap ${gap.toFixed(2)}% < minimum ${options.min_gap}%.`,
        };
    }
    return {
        ...base,
        target: base.dominant,
        setup_key: `${base.dominant}:${base.weakest}`,
        condition_passed: true,
        status: STATUS.VALID_SIGNAL,
        rejection: '',
    };
};

const buildJournal = ({ options, analysis, status, rejection, target, settled, state, confirmation_status }) => {
    const messages = [{ className: 'journal__text', message: '══ FREQUENCY GAP DIFFERS ══' }];
    const push = (message, className = 'journal__text') => messages.push({ className, message });

    if (settled) push(describeSettlement(settled), settled.result === 'WIN' ? 'journal__text--success' : 'journal__text--error');
    options.adjustments.forEach(adj =>
        push(
            `SETTING ADJUSTED: ${adj.setting} requested ${adj.requested} → actual ${adj.actual} (${adj.reason})`,
            'journal__text--warn'
        )
    );

    const loaded = analysis ? analysis.total : 0;
    push(
        `Window: ${options.analysis_window} ticks${loaded < options.analysis_window ? ` (loaded ${loaded})` : ''} | Minimum Gap: ${options.min_gap}%`
    );

    if (analysis && status !== STATUS.COLLECTING) {
        const row = digits =>
            digits.map(d => `${d}: ${analysis.counts[d]} (${analysis.percentages[d].toFixed(1)}%)`).join('  ');
        push(`Digits ${row([0, 1, 2, 3, 4])}`);
        push(`Digits ${row([5, 6, 7, 8, 9])}`);
        push(
            analysis.dominant !== null
                ? `Dominant: Digit ${analysis.dominant} | Count: ${analysis.dominant_count} | Frequency: ${analysis.dominant_pct.toFixed(2)}%`
                : `Dominant: tied (${analysis.dominant_digits.join(', ')}) at ${analysis.dominant_pct.toFixed(2)}%`
        );
        push(
            analysis.weakest !== null
                ? `Weakest: Digit ${analysis.weakest} | Count: ${analysis.weakest_count} | Frequency: ${analysis.weakest_pct.toFixed(2)}%`
                : `Weakest: tied (${analysis.weakest_digits.join(', ')}) at ${analysis.weakest_pct.toFixed(2)}%`
        );
        push(`Frequency Gap: ${analysis.gap.toFixed(2)}% | Minimum Gap: ${options.min_gap}%`);
        push(`Condition: ${analysis.condition_passed ? 'PASSED' : 'FAILED'}`);
    }
    if (options.confirmation) push(`Confirmation: ${confirmation_status}`);

    if (status === STATUS.VALID_SIGNAL) push(`Target: DIFFER ${target}`, 'journal__text--success');
    else push(`WHY NO TRADE? ${status} — ${rejection}`);

    push(describeLiveStats(state.live));
    return messages;
};

export const evaluateFrequencyGap = (raw_ticks, raw_options = {}, state = createFrequencyGapState()) => {
    const options = normalizeFrequencyGapOptions(raw_options);
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
        // The first poll of a tick already handed out its signal; re-polls must not re-trade it.
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

    let prediction = -1;
    let status;
    let rejection = '';
    let target = null;
    let analysis = null;
    let confirmation_status = options.confirmation ? 'WAITING FOR SETUP' : 'OFF';
    const armed = state.armed;
    state.armed = null;

    if (!options.enabled) {
        status = STATUS.DISABLED;
        rejection = 'Strategy disabled.';
    } else if (window_ticks.length < options.analysis_window) {
        status = STATUS.COLLECTING;
        rejection = `Analysis Window not full: ${window_ticks.length}/${options.analysis_window} ticks.`;
    } else {
        analysis = analyzeFrequencyGap(
            window_ticks.map(t => t.digit),
            options
        );
        if (analysis.target === null) {
            status = armed ? STATUS.SETUP_CANCELLED : analysis.status;
            rejection = armed
                ? `Setup DIFFER ${armed.target} no longer valid on the new tick — ${analysis.rejection}`
                : analysis.rejection;
            if (armed) confirmation_status = 'CANCELLED';
        } else if (!options.confirmation || (armed && armed.key === analysis.setup_key)) {
            target = analysis.target;
            prediction = target;
            status = STATUS.VALID_SIGNAL;
            if (options.confirmation) confirmation_status = 'CONFIRMED';
            state.pending_outcome = { target, type: 'FREQUENCY_GAP', epoch: tip.epoch };
        } else {
            state.armed = { key: analysis.setup_key, target: analysis.target };
            status = armed ? STATUS.SETUP_CANCELLED : STATUS.AWAITING_CONFIRMATION;
            confirmation_status = armed ? 'CANCELLED — new setup waiting' : 'AWAITING NEXT TICK';
            rejection = armed
                ? `Setup changed from ${armed.key.replace(':', ' / ')} to ${analysis.setup_key.replace(':', ' / ')} (dominant / weakest) — old setup cancelled, new setup waiting for next-tick confirmation.`
                : `Setup DIFFER ${analysis.target} found — confirming on the next tick.`;
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({ options, analysis, status, rejection, target, settled, state, confirmation_status })
        : [];

    const { trades, wins } = state.live;
    const result = {
        prediction,
        barrier: prediction,
        matched: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITDIFF' : null,
        target,
        dominant: analysis?.dominant ?? null,
        weakest: analysis?.weakest ?? null,
        gap: analysis?.gap ?? null,
        percentages: analysis?.percentages ?? [],
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        confirmation_status,
        settled,
        live: { ...state.live, win_rate: trades > 0 ? (wins / trades) * 100 : 0 },
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
export const replayFrequencyGap = (raw_ticks, raw_options = {}) => {
    const options = normalizeFrequencyGapOptions({ ...raw_options, journal_enabled: false });
    const state = createFrequencyGapState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];

    for (let i = 0; i < digits.length; i++) {
        const pending = state.pending_outcome;
        if (pending) {
            recordFrequencyGapContract(state, {
                contract_id: `replay-${i}`,
                status: digits[i] !== pending.target ? 'won' : 'lost',
                barrier: pending.target,
                exit_tick: digits[i],
            });
        }
        const result = evaluateFrequencyGap(digits.slice(0, i + 1), options, state);
        if (result.matched) signals.push({ tip: i, target: result.target });
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
