/**
 * Hybrid multi-scan — combines free-bot scan families on the active market:
 *   1. Odd Pair → DIGITOVER 2 (recovery 3)
 *   2. Even Pair → last 2 even + last 3 ≤ digit_max → DIGITUNDER 7 (recovery 6)
 *   3. Pattern Probability Over/Under
 *   4. Sequential Digit Differs
 *   5. Hot Digit Differs (both parities)
 *
 * First matching lane wins (priority above). While recovering, stick to the
 * last winning lane / contract family.
 */

import {
    DEFAULT_EVEN_MIN,
    DEFAULT_ODD_MAX,
    detectEvenOddPairSignal,
} from './even-odd-pair-over-under';
import {
    DEFAULT_LOOKBACK as PATTERN_DEFAULT_LOOKBACK,
    DEFAULT_MIN_CONFIDENCE,
    DEFAULT_MIN_OCCURRENCES,
    DEFAULT_PATTERN_LENGTH,
    evaluatePatternProbabilityOverUnder,
} from './pattern-probability-over-under';
import { detectSequentialDigitSignal } from './sequential-digit-differs';
import {
    DEFAULT_LOOKBACK as HOT_DEFAULT_LOOKBACK,
    detectHotOddEvenDiffersSignal,
} from './odd-even-hot-digit';

export const HYBRID_LANES = {
    ODD_PAIR: 'odd_pair',
    EVEN_PAIR: 'even_pair',
    PATTERN: 'pattern',
    SEQUENTIAL: 'sequential',
    HOT_DIGIT: 'hot_digit',
};

export const CONTRACT_DIGITOVER = 'DIGITOVER';
export const CONTRACT_DIGITUNDER = 'DIGITUNDER';
export const CONTRACT_DIGITDIFF = 'DIGITDIFF';

/** Blockly-friendly numeric codes for purchase branching. */
export const CONTRACT_CODE = {
    NONE: 0,
    DIGITOVER: 1,
    DIGITUNDER: 2,
    DIGITDIFF: 3,
};

export const DEFAULT_HOT_LOOKBACK = HOT_DEFAULT_LOOKBACK;
export const DEFAULT_PATTERN_LOOKBACK = PATTERN_DEFAULT_LOOKBACK;

const toBool = value =>
    value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';

const toInt = (value, fallback, min = null, max = null) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (min !== null && n < min) {
        n = min;
    }
    if (max !== null && n > max) {
        n = max;
    }
    return n;
};

export const contractTypeToCode = contract_type => {
    if (contract_type === CONTRACT_DIGITOVER) {
        return CONTRACT_CODE.DIGITOVER;
    }
    if (contract_type === CONTRACT_DIGITUNDER) {
        return CONTRACT_CODE.DIGITUNDER;
    }
    if (contract_type === CONTRACT_DIGITDIFF) {
        return CONTRACT_CODE.DIGITDIFF;
    }
    return CONTRACT_CODE.NONE;
};

export const normalizeHybridMultiScanOptions = (options = {}) => ({
    recovering: toBool(options.recovering),
    last_lane: options.last_lane || null,
    last_contract_type: options.last_contract_type || null,
    last_was_loss: toBool(options.last_was_loss) || toBool(options.recovering),
    odd_max: toInt(options.odd_max !== undefined ? options.odd_max : options.threshold, DEFAULT_ODD_MAX, 1, 9),
    even_min: toInt(
        options.even_min !== undefined ? options.even_min : options.threshold,
        DEFAULT_EVEN_MIN,
        0,
        8
    ),
    pattern_lookback: toInt(options.pattern_lookback, DEFAULT_PATTERN_LOOKBACK, 10, 1000),
    pattern_length: toInt(options.pattern_length, DEFAULT_PATTERN_LENGTH, 1, 5),
    min_occurrences: toInt(options.min_occurrences, DEFAULT_MIN_OCCURRENCES, 1, 50),
    min_confidence: toInt(options.min_confidence, DEFAULT_MIN_CONFIDENCE, 1, 100),
    hot_lookback: toInt(options.hot_lookback, DEFAULT_HOT_LOOKBACK, 50, 5000),
    journal_enabled: true,
});

const emptyResult = (reason = 'no_signal') => ({
    matched: false,
    prediction: -1,
    barrier: -1,
    contract_type: null,
    contract_code: CONTRACT_CODE.NONE,
    lane: null,
    reason,
    journal_messages: [],
    scans: {},
});

const toCandidate = ({ lane, contract_type, barrier, reason, detail }) => {
    const prediction = Number(barrier);
    if (!Number.isFinite(prediction) || prediction < 0 || prediction > 9) {
        return null;
    }
    return {
        matched: true,
        prediction,
        barrier: prediction,
        contract_type,
        contract_code: contractTypeToCode(contract_type),
        lane,
        reason,
        detail: detail || null,
    };
};

const scanOddPair = (digits, opts) => {
    const signal = detectEvenOddPairSignal(digits, {
        side: 'OVER',
        odd_max: opts.odd_max,
        recovering: opts.recovering && opts.last_lane === HYBRID_LANES.ODD_PAIR,
    });
    if (!signal.matched) {
        return { signal, candidate: null };
    }
    return {
        signal,
        candidate: toCandidate({
            lane: HYBRID_LANES.ODD_PAIR,
            contract_type: CONTRACT_DIGITOVER,
            barrier: signal.barrier,
            reason: signal.reason,
            detail: `odd_pair→Over ${signal.barrier}`,
        }),
    };
};

const scanEvenPair = (digits, opts) => {
    const signal = detectEvenOddPairSignal(digits, {
        side: 'UNDER',
        even_min: opts.even_min,
        recovering: opts.recovering && opts.last_lane === HYBRID_LANES.EVEN_PAIR,
    });
    if (!signal.matched) {
        return { signal, candidate: null };
    }
    return {
        signal,
        candidate: toCandidate({
            lane: HYBRID_LANES.EVEN_PAIR,
            contract_type: CONTRACT_DIGITUNDER,
            barrier: signal.barrier,
            reason: signal.reason,
            detail: `even_pair→Under ${signal.barrier}`,
        }),
    };
};

const scanPattern = (digits, opts) => {
    let market_side = 'BOTH';
    if (opts.recovering && opts.last_contract_type === CONTRACT_DIGITOVER) {
        market_side = 'OVER';
    } else if (opts.recovering && opts.last_contract_type === CONTRACT_DIGITUNDER) {
        market_side = 'UNDER';
    } else if (opts.recovering && opts.last_contract_type === CONTRACT_DIGITDIFF) {
        return { signal: { should_trade: false, reason: 'pattern_skipped_differs_recovery' }, candidate: null };
    }

    const signal = evaluatePatternProbabilityOverUnder(digits, {
        market_side,
        lookback: opts.pattern_lookback,
        pattern_length: opts.pattern_length,
        min_occurrences: opts.min_occurrences,
        min_confidence: opts.min_confidence,
        last_was_loss: opts.last_was_loss,
        journal_enabled: false,
        multi_length_consensus: true,
    });

    if (!signal.should_trade || signal.barrier < 0) {
        return { signal, candidate: null };
    }

    const contract_type =
        signal.contract_type ||
        (String(signal.side || '').toUpperCase() === 'UNDER' ? CONTRACT_DIGITUNDER : CONTRACT_DIGITOVER);

    return {
        signal,
        candidate: toCandidate({
            lane: HYBRID_LANES.PATTERN,
            contract_type,
            barrier: signal.barrier,
            reason: signal.reason || `pattern_${contract_type}_${signal.barrier}`,
            detail: `pattern→${contract_type === CONTRACT_DIGITUNDER ? 'Under' : 'Over'} ${signal.barrier}`,
        }),
    };
};

const scanSequential = (digits, opts) => {
    if (opts.recovering && opts.last_contract_type && opts.last_contract_type !== CONTRACT_DIGITDIFF) {
        return { signal: { matched: false, reason: 'seq_skipped_ou_recovery' }, candidate: null };
    }
    const signal = detectSequentialDigitSignal(digits);
    if (!signal.matched) {
        return { signal, candidate: null };
    }
    return {
        signal,
        candidate: toCandidate({
            lane: HYBRID_LANES.SEQUENTIAL,
            contract_type: CONTRACT_DIGITDIFF,
            barrier: signal.barrier,
            reason: signal.reason,
            detail: `sequential→Differ ${signal.barrier}`,
        }),
    };
};

const scanHotDigit = (digits, opts) => {
    if (opts.recovering && opts.last_contract_type && opts.last_contract_type !== CONTRACT_DIGITDIFF) {
        return { signal: { matched: false, reason: 'hot_skipped_ou_recovery' }, candidate: null };
    }
    const signal = detectHotOddEvenDiffersSignal(digits, opts.hot_lookback, 'both');
    if (!signal.matched) {
        return { signal, candidate: null };
    }
    return {
        signal,
        candidate: toCandidate({
            lane: HYBRID_LANES.HOT_DIGIT,
            contract_type: CONTRACT_DIGITDIFF,
            barrier: signal.barrier,
            reason: signal.reason || `hot_${signal.trigger}_differ_${signal.barrier}`,
            detail: `hot_${signal.trigger}→Differ ${signal.barrier}`,
        }),
    };
};

/**
 * Priority when flat: odd pair → even pair → pattern → sequential → hot.
 * When recovering: only lanes compatible with last_contract_type / last_lane.
 */
export const evaluateHybridMultiScan = (digits, options = {}) => {
    const opts = normalizeHybridMultiScanOptions(options);
    const list = Array.isArray(digits) ? digits : [];

    const odd = scanOddPair(list, opts);
    const even = scanEvenPair(list, opts);
    const pattern = scanPattern(list, opts);
    const sequential = scanSequential(list, opts);
    const hot = scanHotDigit(list, opts);

    const scans = {
        odd_pair: odd.signal,
        even_pair: even.signal,
        pattern: {
            should_trade: Boolean(pattern.signal?.should_trade),
            barrier: pattern.signal?.barrier ?? -1,
            reason: pattern.signal?.reason || null,
        },
        sequential: sequential.signal,
        hot_digit: {
            matched: Boolean(hot.signal?.matched),
            barrier: hot.signal?.barrier ?? -1,
            reason: hot.signal?.reason || null,
        },
    };

    let ordered = [odd.candidate, even.candidate, pattern.candidate, sequential.candidate, hot.candidate].filter(
        Boolean
    );

    if (opts.recovering && opts.last_lane) {
        const preferred = ordered.filter(c => c.lane === opts.last_lane);
        if (preferred.length) {
            ordered = preferred;
        } else if (opts.last_contract_type) {
            const same_family = ordered.filter(c => c.contract_type === opts.last_contract_type);
            if (same_family.length) {
                ordered = same_family;
            }
        }
    }

    const winner = ordered[0] || null;
    const journal_messages = [];
    if (winner) {
        journal_messages.push({
            className: 'journal__text--success',
            message: `Hybrid ${winner.detail || winner.lane}: ${winner.contract_type} ${winner.prediction}`,
        });
    } else {
        journal_messages.push({
            className: 'journal__text',
            message: 'Hybrid: no scan matched',
        });
    }

    if (!winner) {
        return {
            ...emptyResult('no_scan_matched'),
            scans,
            journal_messages,
        };
    }

    return {
        matched: true,
        prediction: winner.prediction,
        barrier: winner.barrier,
        contract_type: winner.contract_type,
        contract_code: winner.contract_code,
        lane: winner.lane,
        reason: winner.reason,
        detail: winner.detail,
        scans,
        journal_messages,
    };
};

export const createHybridMultiScanRuntimeState = () => ({
    last_lane: null,
    last_contract_type: null,
    last_tip_key: null,
    trade_committed: false,
    armed_prediction: -1,
    armed_contract_type: null,
    armed_contract_code: CONTRACT_CODE.NONE,
    commit_at: 0,
});

export const resetHybridMultiScanRuntimeState = (state = null) => {
    const tracker = state || createHybridMultiScanRuntimeState();
    tracker.last_lane = null;
    tracker.last_contract_type = null;
    tracker.last_tip_key = null;
    tracker.trade_committed = false;
    tracker.armed_prediction = -1;
    tracker.armed_contract_type = null;
    tracker.armed_contract_code = CONTRACT_CODE.NONE;
    tracker.commit_at = 0;
    return tracker;
};

export const armHybridMultiScanPrediction = (state, result) => {
    const tracker = state || createHybridMultiScanRuntimeState();
    if (!result?.matched) {
        return tracker;
    }
    tracker.trade_committed = true;
    tracker.armed_prediction = result.prediction;
    tracker.armed_contract_type = result.contract_type;
    tracker.armed_contract_code = result.contract_code;
    tracker.last_lane = result.lane;
    tracker.last_contract_type = result.contract_type;
    tracker.commit_at = Date.now();
    return tracker;
};

export const clearHybridMultiScanCommit = state => {
    const tracker = state || createHybridMultiScanRuntimeState();
    tracker.trade_committed = false;
    tracker.armed_prediction = -1;
    tracker.armed_contract_type = null;
    tracker.armed_contract_code = CONTRACT_CODE.NONE;
    tracker.commit_at = 0;
    return tracker;
};

export const applyHybridMultiScanSettlement = (state, contract_id) => {
    const tracker = state || createHybridMultiScanRuntimeState();
    if (!contract_id) {
        return tracker;
    }
    if (tracker.last_settled_contract_id === contract_id) {
        return tracker;
    }
    tracker.last_settled_contract_id = contract_id;
    return clearHybridMultiScanCommit(tracker);
};

export const releaseStaleHybridMultiScanCommit = (state, max_age_ms = 20000) => {
    const tracker = state || createHybridMultiScanRuntimeState();
    if (!tracker.trade_committed) {
        return false;
    }
    if (Date.now() - (tracker.commit_at || 0) < max_age_ms) {
        return false;
    }
    clearHybridMultiScanCommit(tracker);
    return true;
};

export const makeHybridMultiScanTipKey = (tip_base, result) => {
    if (!result?.matched) {
        return '';
    }
    return `${tip_base || ''}|${result.lane}|${result.contract_type}|${result.prediction}`;
};
