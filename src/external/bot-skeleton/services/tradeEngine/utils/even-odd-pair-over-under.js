/**
 * Odd-pair Over / Even-pair Under — last-2 digit scanners.
 *
 * Over (odd pair): previous + current both odd and both <= odd_max (default 5)
 *   → DIGITOVER barrier 2; while recovering → barrier 3
 *
 * Under (even pair): previous + current both even and both >= even_min (default 4)
 *   → DIGITUNDER barrier 7; while recovering → barrier 6
 */

export const DEFAULT_ODD_MAX = 5;
export const DEFAULT_EVEN_MIN = 4;
/** @deprecated use DEFAULT_ODD_MAX */
export const DEFAULT_EVEN_MAX = DEFAULT_ODD_MAX;
/** @deprecated use DEFAULT_EVEN_MIN */
export const DEFAULT_ODD_MIN = DEFAULT_EVEN_MIN;
export const ENTRY_OVER_BARRIER = 2;
export const RECOVERY_OVER_BARRIER = 3;
export const ENTRY_UNDER_BARRIER = 7;
export const RECOVERY_UNDER_BARRIER = 6;
export const DEFAULT_PAYOUT_PERCENT = 60;

const toDigit = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return null;
    }
    // Accept ints and near-ints from tick pipelines (e.g. 2, "2", 2.0).
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) > 1e-9 || rounded < 0 || rounded > 9) {
        return null;
    }
    return rounded;
};

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

const toBool = value =>
    value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';

export const isEvenDigit = d => {
    const n = toDigit(d);
    return n !== null && n % 2 === 0;
};

export const isOddDigit = d => {
    const n = toDigit(d);
    return n !== null && n % 2 === 1;
};

export const toMarketSide = value => {
    const raw = String(value || '')
        .trim()
        .toUpperCase();
    if (raw === 'UNDER' || raw === 'DIGITUNDER' || raw === 'EVEN') {
        return 'UNDER';
    }
    return 'OVER';
};

/**
 * Stake that fully recovers `total_loss` given a payout percent (e.g. 60 → 60% of stake).
 * stake * (payout%/100) = total_loss  ⇒  stake = total_loss * 100 / payout%
 */
export const calculatePayoutRecoveryStake = (total_loss, payout_percent = DEFAULT_PAYOUT_PERCENT) => {
    const loss = Number(total_loss);
    const pct = Number(payout_percent);
    if (!Number.isFinite(loss) || loss <= 0) {
        return 0;
    }
    if (!Number.isFinite(pct) || pct <= 0) {
        return loss;
    }
    return (loss * 100) / pct;
};

export const normalizeEvenOddPairOptions = (options = {}) => {
    const side = toMarketSide(options.side || options.market_side);
    const threshold = options.threshold;
    return {
        side,
        // Over: odd digits <= odd_max (default 5)
        odd_max: toInt(
            options.odd_max !== undefined
                ? options.odd_max
                : options.even_max !== undefined
                  ? options.even_max
                  : threshold,
            DEFAULT_ODD_MAX,
            1,
            9
        ),
        // Under: even digits >= even_min (default 4)
        even_min: toInt(
            options.even_min !== undefined
                ? options.even_min
                : options.odd_min !== undefined
                  ? options.odd_min
                  : threshold,
            DEFAULT_EVEN_MIN,
            0,
            8
        ),
        recovering: toBool(options.recovering),
        journal_enabled:
            options.journal_enabled === undefined ? true : toBool(options.journal_enabled),
    };
};

/**
 * Read previous + current digit from a digit list (oldest → newest).
 */
export const getLastTwoDigits = digits => {
    const list = Array.isArray(digits) ? digits : [];
    if (list.length < 2) {
        return { previous_digit: null, current_digit: null, ready: false };
    }
    const previous_digit = toDigit(list[list.length - 2]);
    const current_digit = toDigit(list[list.length - 1]);
    return {
        previous_digit,
        current_digit,
        ready: previous_digit !== null && current_digit !== null,
    };
};

/** Over entry: both odd and <= odd_max. */
export const isOddPairAtMostThreshold = (previous_digit, current_digit, odd_max = DEFAULT_ODD_MAX) => {
    const max = toInt(odd_max, DEFAULT_ODD_MAX, 1, 9);
    return (
        isOddDigit(previous_digit) &&
        isOddDigit(current_digit) &&
        previous_digit <= max &&
        current_digit <= max
    );
};

/** Under entry: both even and >= even_min. */
export const isEvenPairAboveThreshold = (
    previous_digit,
    current_digit,
    even_min = DEFAULT_EVEN_MIN
) => {
    const min = toInt(even_min, DEFAULT_EVEN_MIN, 0, 8);
    return (
        isEvenDigit(previous_digit) &&
        isEvenDigit(current_digit) &&
        previous_digit >= min &&
        current_digit >= min
    );
};

/** @deprecated use isOddPairAtMostThreshold */
export const isEvenPairBelowThreshold = isOddPairAtMostThreshold;
/** @deprecated use isEvenPairAboveThreshold */
export const isOddPairAboveThreshold = isEvenPairAboveThreshold;

/**
 * @returns {{ matched: boolean, barrier: number, side: string, reason: string, previous_digit: number|null, current_digit: number|null, recovering: boolean, entry_barrier: number, recovery_barrier: number }}
 */
export const detectEvenOddPairSignal = (digits, options = {}) => {
    const opts = normalizeEvenOddPairOptions(options);
    const { previous_digit, current_digit, ready } = getLastTwoDigits(digits);

    const entry_barrier = opts.side === 'UNDER' ? ENTRY_UNDER_BARRIER : ENTRY_OVER_BARRIER;
    const recovery_barrier = opts.side === 'UNDER' ? RECOVERY_UNDER_BARRIER : RECOVERY_OVER_BARRIER;

    const base = {
        matched: false,
        barrier: -1,
        prediction: -1,
        side: opts.side,
        contract_type: opts.side === 'UNDER' ? 'DIGITUNDER' : 'DIGITOVER',
        previous_digit,
        current_digit,
        recovering: opts.recovering,
        entry_barrier,
        recovery_barrier,
        odd_max: opts.odd_max,
        even_min: opts.even_min,
        reason: 'no_signal',
    };

    if (!ready) {
        return { ...base, reason: 'insufficient_digits' };
    }

    // While recovering, place the recovery-barrier trade immediately (no pattern wait).
    if (opts.recovering) {
        return {
            ...base,
            matched: true,
            barrier: recovery_barrier,
            prediction: recovery_barrier,
            reason: `recovery_${opts.side.toLowerCase()}_${recovery_barrier}`,
        };
    }

    if (opts.side === 'OVER') {
        if (!isOddPairAtMostThreshold(previous_digit, current_digit, opts.odd_max)) {
            return {
                ...base,
                reason: `no_odd_pair_lte_${opts.odd_max}_${previous_digit},${current_digit}`,
            };
        }
        return {
            ...base,
            matched: true,
            barrier: entry_barrier,
            prediction: entry_barrier,
            reason: `odd_pair_${previous_digit},${current_digit}_over_${entry_barrier}`,
        };
    }

    if (!isEvenPairAboveThreshold(previous_digit, current_digit, opts.even_min)) {
        return {
            ...base,
            reason: `no_even_pair_gte_${opts.even_min}_${previous_digit},${current_digit}`,
        };
    }
    return {
        ...base,
        matched: true,
        barrier: entry_barrier,
        prediction: entry_barrier,
        reason: `even_pair_${previous_digit},${current_digit}_under_${entry_barrier}`,
    };
};

export const buildEvenOddPairResult = ({
    signal = null,
    journal_enabled = true,
    skipped_consumed = false,
} = {}) => {
    const hit = !skipped_consumed && signal?.matched ? signal : null;
    const prediction = hit ? hit.barrier : -1;
    const journal_messages = [];

    if (journal_enabled) {
        if (hit) {
            const label = hit.side === 'UNDER' ? 'Even-pair Under' : 'Odd-pair Over';
            const mode = hit.recovering ? 'recovery' : 'entry';
            journal_messages.push({
                className: 'success',
                message: `${label} ${mode}: last2=${hit.previous_digit},${hit.current_digit} → ${hit.contract_type} ${hit.barrier}`,
            });
        } else if (skipped_consumed && signal?.matched) {
            journal_messages.push({
                className: 'info',
                message: `Even/Odd pair: already traded this tip — waiting`,
            });
        } else if (signal) {
            journal_messages.push({
                className: 'info',
                message: `Even/Odd pair: ${signal.reason}`,
            });
        }
    }

    return {
        prediction,
        barrier: prediction,
        matched: Boolean(hit),
        side: signal?.side || null,
        contract_type: hit ? hit.contract_type : null,
        previous_digit: signal?.previous_digit ?? null,
        current_digit: signal?.current_digit ?? null,
        recovering: Boolean(signal?.recovering),
        reason: hit ? hit.reason : skipped_consumed ? 'signal_consumed' : signal?.reason || 'no_match',
        journal_messages,
    };
};

export const makeEvenOddPairSignalKey = (signal, tip_epoch) => {
    if (!signal?.matched || signal.barrier < 0) {
        return null;
    }
    const epoch =
        tip_epoch === undefined || tip_epoch === null || tip_epoch === ''
            ? ''
            : String(tip_epoch);
    return `${signal.side}|b:${signal.barrier}|rec:${signal.recovering ? 1 : 0}|e:${epoch}`;
};

export const isEvenOddPairSignalConsumed = (signal, tip_epoch, consumed_key) => {
    const key = makeEvenOddPairSignalKey(signal, tip_epoch);
    return Boolean(key && consumed_key && key === consumed_key);
};

export const createEvenOddPairRuntimeState = () => ({
    trade_committed: false,
    signal_issued_at: 0,
    last_barrier: null,
    armed_prediction: -1,
    last_handled_contract_id: null,
});

export const resetEvenOddPairRuntimeState = (state = null) => {
    const tracker = state || createEvenOddPairRuntimeState();
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.last_barrier = null;
    tracker.armed_prediction = -1;
    tracker.last_handled_contract_id = null;
    return tracker;
};

export const armEvenOddPairPrediction = (state, barrier) => {
    const tracker = state || createEvenOddPairRuntimeState();
    const digit = toDigit(barrier);
    if (digit === null) {
        return tracker;
    }
    tracker.last_barrier = digit;
    tracker.armed_prediction = digit;
    tracker.trade_committed = true;
    tracker.signal_issued_at = Date.now();
    return tracker;
};

export const clearEvenOddPairCommit = state => {
    const tracker = state || createEvenOddPairRuntimeState();
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    tracker.armed_prediction = -1;
    return tracker;
};

/**
 * Clear commit once per settled contract. Ignores the previous settled stub so a
 * fresh arm is not unlocked before its own purchase completes.
 * @returns {boolean} true when this settlement was newly applied
 */
export const applyEvenOddPairSettlement = (state, contract_id) => {
    const tracker = state || createEvenOddPairRuntimeState();
    const id =
        contract_id === undefined || contract_id === null || contract_id === ''
            ? null
            : String(contract_id);
    if (id && tracker.last_handled_contract_id === id) {
        return false;
    }
    if (id) {
        tracker.last_handled_contract_id = id;
    }
    clearEvenOddPairCommit(tracker);
    return true;
};

export const releaseStaleEvenOddPairCommit = (state, max_age_ms = 20000) => {
    const tracker = state || createEvenOddPairRuntimeState();
    if (!tracker.trade_committed) {
        return false;
    }
    const issued = Number(tracker.signal_issued_at) || 0;
    if (!issued || Date.now() - issued < max_age_ms) {
        return false;
    }
    clearEvenOddPairCommit(tracker);
    return true;
};

/** Build a stable tip id from epoch + last-2 digits. */
export const makeEvenOddPairTipKey = (tip_epoch, digits) => {
    const epoch =
        tip_epoch === undefined || tip_epoch === null || tip_epoch === ''
            ? 'empty'
            : String(tip_epoch);
    const { previous_digit, current_digit, ready } = getLastTwoDigits(digits);
    const pair = ready ? `${previous_digit},${current_digit}` : 'na';
    return `${epoch}|d:${pair}`;
};
