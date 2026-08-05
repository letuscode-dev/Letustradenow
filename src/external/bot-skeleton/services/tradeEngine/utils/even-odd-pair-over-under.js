/**
 * Odd-pair Over / Even-pair Under scanners.
 *
 * Over (odd pair): last 2 digits odd AND last 3 digits all >= digit_min (default 5)
 *   → DIGITOVER barrier 2; while recovering → barrier 3
 *
 * Under (even pair): last 2 digits even AND last 3 digits all <= digit_max (default 4)
 *   → DIGITUNDER barrier 7; while recovering → barrier 6
 */

/** Over: last-3 digits must be >= this (default 5). */
export const DEFAULT_DIGIT_MIN = 5;
/** Under: last-3 digits must be <= this (default 4). */
export const DEFAULT_DIGIT_MAX = 4;
/** @deprecated use DEFAULT_DIGIT_MIN */
export const DEFAULT_ODD_MAX = DEFAULT_DIGIT_MIN;
/** @deprecated use DEFAULT_DIGIT_MAX */
export const DEFAULT_EVEN_MIN = DEFAULT_DIGIT_MAX;
/** @deprecated use DEFAULT_DIGIT_MIN */
export const DEFAULT_EVEN_MAX = DEFAULT_DIGIT_MIN;
/** @deprecated use DEFAULT_DIGIT_MIN */
export const DEFAULT_ODD_MIN = DEFAULT_DIGIT_MIN;
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
        // Over: last 3 digits >= digit_min (default 5); odd_max kept as alias
        digit_min: toInt(
            options.digit_min !== undefined
                ? options.digit_min
                : options.odd_max !== undefined
                  ? options.odd_max
                  : options.even_max !== undefined
                    ? options.even_max
                    : side === 'OVER' && threshold !== undefined
                      ? threshold
                      : DEFAULT_DIGIT_MIN,
            DEFAULT_DIGIT_MIN,
            0,
            9
        ),
        // Under: last 3 digits <= digit_max (default 4); even_min kept as alias
        digit_max: toInt(
            options.digit_max !== undefined
                ? options.digit_max
                : options.even_min !== undefined
                  ? options.even_min
                  : side === 'UNDER' && threshold !== undefined
                    ? threshold
                    : DEFAULT_DIGIT_MAX,
            DEFAULT_DIGIT_MAX,
            0,
            9
        ),
        recovering: toBool(options.recovering),
        // Always on — free bots and block input cannot disable journal.
        journal_enabled: true,
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

/**
 * Read last three digits (oldest → newest among the three).
 */
export const getLastThreeDigits = digits => {
    const list = Array.isArray(digits) ? digits : [];
    if (list.length < 3) {
        return {
            digit_a: null,
            digit_b: null,
            digit_c: null,
            previous_digit: null,
            current_digit: null,
            ready: false,
        };
    }
    const digit_a = toDigit(list[list.length - 3]);
    const digit_b = toDigit(list[list.length - 2]);
    const digit_c = toDigit(list[list.length - 1]);
    return {
        digit_a,
        digit_b,
        digit_c,
        previous_digit: digit_b,
        current_digit: digit_c,
        ready: digit_a !== null && digit_b !== null && digit_c !== null,
    };
};

/** Last two digits are both odd. */
export const isOddLastTwoDigits = (previous_digit, current_digit) =>
    isOddDigit(previous_digit) && isOddDigit(current_digit);

/** Last two digits are both even. */
export const isEvenLastTwoDigits = (previous_digit, current_digit) =>
    isEvenDigit(previous_digit) && isEvenDigit(current_digit);

/** Last three digits are each >= digit_min. */
export const areLastThreeAtLeast = (digit_a, digit_b, digit_c, digit_min = DEFAULT_DIGIT_MIN) => {
    const min = toInt(digit_min, DEFAULT_DIGIT_MIN, 0, 9);
    const a = toDigit(digit_a);
    const b = toDigit(digit_b);
    const c = toDigit(digit_c);
    return a !== null && b !== null && c !== null && a >= min && b >= min && c >= min;
};

/** Last three digits are each <= digit_max. */
export const areLastThreeAtMost = (digit_a, digit_b, digit_c, digit_max = DEFAULT_DIGIT_MAX) => {
    const max = toInt(digit_max, DEFAULT_DIGIT_MAX, 0, 9);
    const a = toDigit(digit_a);
    const b = toDigit(digit_b);
    const c = toDigit(digit_c);
    return a !== null && b !== null && c !== null && a <= max && b <= max && c <= max;
};

/**
 * Over entry: last 2 odd AND last 3 all >= digit_min.
 * Accepts either a digits array or explicit last-3 values.
 */
export const isOddPairOverEntry = (digitsOrA, digit_b, digit_c, digit_min = DEFAULT_DIGIT_MIN) => {
    if (Array.isArray(digitsOrA)) {
        const { digit_a, digit_b: b, digit_c: c, ready } = getLastThreeDigits(digitsOrA);
        if (!ready) {
            return false;
        }
        return isOddLastTwoDigits(b, c) && areLastThreeAtLeast(digit_a, b, c, digit_min);
    }
    return (
        isOddLastTwoDigits(digit_b, digit_c) &&
        areLastThreeAtLeast(digitsOrA, digit_b, digit_c, digit_min)
    );
};

/**
 * Under entry: last 2 even AND last 3 all <= digit_max.
 * Accepts either a digits array or explicit last-3 values.
 */
export const isEvenPairUnderEntry = (digitsOrA, digit_b, digit_c, digit_max = DEFAULT_DIGIT_MAX) => {
    if (Array.isArray(digitsOrA)) {
        const { digit_a, digit_b: b, digit_c: c, ready } = getLastThreeDigits(digitsOrA);
        if (!ready) {
            return false;
        }
        return isEvenLastTwoDigits(b, c) && areLastThreeAtMost(digit_a, b, c, digit_max);
    }
    return (
        isEvenLastTwoDigits(digit_b, digit_c) &&
        areLastThreeAtMost(digitsOrA, digit_b, digit_c, digit_max)
    );
};

/**
 * @deprecated Over no longer uses <= on last-2 only. Partial check: both odd and >= digit_min.
 */
export const isOddPairAtMostThreshold = (
    previous_digit,
    current_digit,
    digit_min = DEFAULT_DIGIT_MIN
) => {
    const min = toInt(digit_min, DEFAULT_DIGIT_MIN, 0, 9);
    return (
        isOddDigit(previous_digit) &&
        isOddDigit(current_digit) &&
        previous_digit >= min &&
        current_digit >= min
    );
};

/**
 * @deprecated Under no longer uses >= on last-2. Kept for older callers —
 * now means last-2 even and both <= digit_max (partial check without 3rd digit).
 */
export const isEvenPairAboveThreshold = (
    previous_digit,
    current_digit,
    digit_max = DEFAULT_DIGIT_MAX
) => {
    const max = toInt(digit_max, DEFAULT_DIGIT_MAX, 0, 9);
    return (
        isEvenDigit(previous_digit) &&
        isEvenDigit(current_digit) &&
        previous_digit <= max &&
        current_digit <= max
    );
};

/** @deprecated use isOddPairOverEntry */
export const isEvenPairBelowThreshold = isOddPairAtMostThreshold;
/** @deprecated use isEvenPairUnderEntry */
export const isOddPairAboveThreshold = isEvenPairAboveThreshold;

/**
 * @returns {{ matched: boolean, barrier: number, side: string, reason: string, previous_digit: number|null, current_digit: number|null, recovering: boolean, entry_barrier: number, recovery_barrier: number }}
 */
export const detectEvenOddPairSignal = (digits, options = {}) => {
    const opts = normalizeEvenOddPairOptions(options);
    const entry_barrier = opts.side === 'UNDER' ? ENTRY_UNDER_BARRIER : ENTRY_OVER_BARRIER;
    const recovery_barrier = opts.side === 'UNDER' ? RECOVERY_UNDER_BARRIER : RECOVERY_OVER_BARRIER;
    const three = getLastThreeDigits(digits);

    const base = {
        matched: false,
        barrier: -1,
        prediction: -1,
        side: opts.side,
        contract_type: opts.side === 'UNDER' ? 'DIGITUNDER' : 'DIGITOVER',
        previous_digit: three.previous_digit,
        current_digit: three.current_digit,
        digit_a: three.digit_a,
        digit_b: three.digit_b,
        digit_c: three.digit_c,
        recovering: opts.recovering,
        entry_barrier,
        recovery_barrier,
        digit_min: opts.digit_min,
        digit_max: opts.digit_max,
        odd_max: opts.digit_min,
        even_min: opts.digit_max,
        reason: 'no_signal',
    };

    if (opts.recovering) {
        return {
            ...base,
            matched: true,
            barrier: recovery_barrier,
            prediction: recovery_barrier,
            reason: `recovery_${opts.side.toLowerCase()}_${recovery_barrier}`,
        };
    }

    if (!three.ready) {
        return { ...base, reason: 'insufficient_digits' };
    }

    if (opts.side === 'UNDER') {
        if (!isEvenLastTwoDigits(three.digit_b, three.digit_c)) {
            return {
                ...base,
                reason: `no_even_last2_${three.digit_b},${three.digit_c}`,
            };
        }

        if (!areLastThreeAtMost(three.digit_a, three.digit_b, three.digit_c, opts.digit_max)) {
            return {
                ...base,
                reason: `no_last3_lte_${opts.digit_max}_${three.digit_a},${three.digit_b},${three.digit_c}`,
            };
        }

        return {
            ...base,
            matched: true,
            barrier: entry_barrier,
            prediction: entry_barrier,
            reason: `even_last2_last3_lte_${opts.digit_max}_${three.digit_a},${three.digit_b},${three.digit_c}_under_${entry_barrier}`,
        };
    }

    if (!isOddLastTwoDigits(three.digit_b, three.digit_c)) {
        return {
            ...base,
            reason: `no_odd_last2_${three.digit_b},${three.digit_c}`,
        };
    }

    if (!areLastThreeAtLeast(three.digit_a, three.digit_b, three.digit_c, opts.digit_min)) {
        return {
            ...base,
            reason: `no_last3_gte_${opts.digit_min}_${three.digit_a},${three.digit_b},${three.digit_c}`,
        };
    }

    return {
        ...base,
        matched: true,
        barrier: entry_barrier,
        prediction: entry_barrier,
        reason: `odd_last2_last3_gte_${opts.digit_min}_${three.digit_a},${three.digit_b},${three.digit_c}_over_${entry_barrier}`,
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
                message:
                    hit.side === 'UNDER'
                        ? `${label} ${mode}: last3=${hit.digit_a},${hit.digit_b},${hit.digit_c} (even last2) → ${hit.contract_type} ${hit.barrier}`
                        : `${label} ${mode}: last3=${hit.digit_a},${hit.digit_b},${hit.digit_c} (odd last2) → ${hit.contract_type} ${hit.barrier}`,
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

/** Build a stable tip id from epoch + last digits (3 for Under-ready lists). */
export const makeEvenOddPairTipKey = (tip_epoch, digits) => {
    const epoch =
        tip_epoch === undefined || tip_epoch === null || tip_epoch === ''
            ? 'empty'
            : String(tip_epoch);
    const three = getLastThreeDigits(digits);
    if (three.ready) {
        return `${epoch}|d:${three.digit_a},${three.digit_b},${three.digit_c}`;
    }
    const { previous_digit, current_digit, ready } = getLastTwoDigits(digits);
    const pair = ready ? `${previous_digit},${current_digit}` : 'na';
    return `${epoch}|d:${pair}`;
};
