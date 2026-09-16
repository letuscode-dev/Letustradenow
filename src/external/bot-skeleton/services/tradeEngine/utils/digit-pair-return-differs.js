/**
 * Digit Pair → Return Differs
 *
 * Learns A → B → C → D for every digit triple (A,B,C) with digits 0–9.
 * When A → B → C appear again as the three previous digits before a new tip,
 * signals Digit Differs on the stored D (the digit that used to be p0).
 *
 * Example: 7 → 3 → 1 → 4 stores target 4 for pattern (7,3,1).
 * Later 7 → 3 → 1 → X fires DIFFER 4.
 */

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const normalizeTicks = ticks =>
    (Array.isArray(ticks) ? ticks : []).flatMap(item => {
        const digit = toDigit(item && typeof item === 'object' ? item.digit ?? item.quote : item);
        if (digit === null) return [];
        const epoch = item && typeof item === 'object' ? Number(item.epoch) : NaN;
        return [{ digit, epoch: Number.isFinite(epoch) ? epoch : null }];
    });

const patternKey = (a, b, c) => `${a},${b},${c}`;

const createPatternState = () => ({
    target_digit: -1,
    status: 'WATCHING',
    confirmations: 0,
    first_pattern_epoch: null,
    last_pattern: '',
    trade_status: 'IDLE',
});

export const createDigitPairReturnState = () => ({
    pairs: {},
    bootstrapped: false,
    last_processed_epoch: null,
    last_signal_key: null,
    last_plain_fingerprint: null,
    last_result: null,
    last_result_fp: '',
    tick_index: -1,
    previous_digit: -1,
    prev_previous_digit: -1,
    prev3_digit: -1,
});

export const resetDigitPairReturnState = (state = null) => {
    const next = createDigitPairReturnState();
    if (!state || typeof state !== 'object') {
        return next;
    }
    Object.keys(state).forEach(key => {
        delete state[key];
    });
    Object.assign(state, next);
    return state;
};

const getPatternState = (state, a, b, c) => {
    const key = patternKey(a, b, c);
    if (!state.pairs[key]) {
        state.pairs[key] = createPatternState();
    }
    return state.pairs[key];
};

const statusLine = state => {
    const entries = Object.entries(state.pairs || {})
        .filter(([, item]) => item.target_digit >= 0)
        .map(([key, item]) => `${key}→${item.target_digit}`)
        .slice(0, 12);
    return entries.length ? entries.join(' | ') : 'none waiting';
};

const storeTarget = (state, a, b, c, target, epoch, journal_messages) => {
    const item = getPatternState(state, a, b, c);
    if (item.target_digit === target && item.status === 'WAITING') {
        return;
    }
    item.target_digit = target;
    item.status = 'WAITING';
    item.trade_status = 'IDLE';
    item.first_pattern_epoch = epoch;
    item.last_pattern = `${a} → ${b} → ${c} → ${target}`;
    journal_messages.push({
        className: 'journal__text',
        message: `Pattern ${a},${b},${c}: stored target ${target} (${item.last_pattern}).`,
    });
};

const firePatternReturn = (state, a, b, c, epoch, journal_messages) => {
    const item = getPatternState(state, a, b, c);
    if (item.target_digit < 0) {
        return -1;
    }

    const target = item.target_digit;
    const signal_key = `${epoch ?? state.tick_index}:${a},${b},${c}->${target}`;
    if (state.last_signal_key === signal_key) {
        return -1;
    }

    item.confirmations += 1;
    item.status = 'CONFIRMED';
    item.trade_status = 'SIGNAL';
    journal_messages.push({
        className: 'journal__text--success',
        message: `Pattern ${a},${b},${c}: return confirmed → DIFFER ${target}.`,
    });
    item.target_digit = -1;
    item.status = 'WATCHING';
    item.trade_status = 'IDLE';
    item.first_pattern_epoch = null;
    item.last_pattern = '';
    state.last_signal_key = signal_key;
    return target;
};

/**
 * When ticks lack epochs (plain digit lists), only process the new suffix / tip
 * so a rolling window is not replayed on every scan poll.
 */
const selectTicksToProcess = (ticks, state) => {
    const has_epochs = ticks.some(tick => tick.epoch !== null);
    if (has_epochs) {
        return ticks;
    }

    const fingerprint = ticks.map(tick => tick.digit).join('');
    if (!fingerprint) {
        return [];
    }

    if (!state.bootstrapped || !state.last_plain_fingerprint) {
        state.last_plain_fingerprint = fingerprint;
        return ticks;
    }

    if (fingerprint === state.last_plain_fingerprint) {
        return [];
    }

    const prev = state.last_plain_fingerprint;
    let start = 0;

    if (fingerprint.length >= prev.length && fingerprint.slice(0, prev.length) === prev) {
        start = prev.length;
    } else if (
        fingerprint.length === prev.length &&
        prev.length > 0 &&
        fingerprint.slice(0, -1) === prev.slice(1)
    ) {
        start = fingerprint.length - 1;
    } else if (fingerprint.length === prev.length + 1 && fingerprint.slice(0, -1) === prev) {
        start = prev.length;
    } else {
        state.bootstrapped = false;
        start = 0;
    }

    state.last_plain_fingerprint = fingerprint;
    return ticks.slice(Math.max(0, start));
};

const buildResult = (state, prediction, tick_window, journal_messages) => {
    const waiting_pairs = Object.entries(state.pairs || {})
        .filter(([, item]) => item.target_digit >= 0)
        .map(([key, item]) => {
            const [a, b, c] = key.split(',').map(Number);
            return { pair: key, a, b, c, ...item };
        });

    return {
        prediction,
        allowed: prediction >= 0,
        tick_window,
        waiting_pairs,
        state_summary: statusLine(state),
        journal_messages,
    };
};

export const evaluateDigitPairReturnDiffers = (
    raw_ticks,
    options = {},
    state = createDigitPairReturnState()
) => {
    const tick_window = Math.max(120, Math.floor(Number(options.tick_window)) || 120);
    const journal_enabled = options.journal_enabled !== false;
    const journal_messages = [];
    const window_ticks = normalizeTicks(raw_ticks).slice(-tick_window);
    const ticks = selectTicksToProcess(window_ticks, state);
    let prediction = -1;

    const tip = window_ticks.length ? window_ticks[window_ticks.length - 1] : null;
    const result_fp = tip
        ? `${tip.epoch ?? 'e'}:${window_ticks.length}:${tip.digit}`
        : `empty:${state.last_signal_key || ''}`;

    // Same tip re-poll (purchase / Start retry): keep the signal available.
    if (!ticks.length && state.last_result && state.last_result_fp === result_fp) {
        const cached = {
            ...state.last_result,
            journal_messages: journal_enabled ? state.last_result.journal_messages || [] : [],
        };
        return cached;
    }

    if (ticks.length) {
        const bootstrapping = !state.bootstrapped;
        ticks.forEach(tick => {
            if (tick.epoch !== null && tick.epoch === state.last_processed_epoch) return;
            if (tick.epoch !== null && state.last_processed_epoch !== null && tick.epoch < state.last_processed_epoch) {
                return;
            }

            state.tick_index += 1;
            const current = tick.digit;
            const previous = state.previous_digit;
            const prev_previous = state.prev_previous_digit;
            const prev3 = state.prev3_digit;

            // p3=prev3, p2=prev_previous, p1=previous, p0=current.
            // Learn on first A→B→C→D; on a later A→B→C→X fire Differ stored D.
            if (prev3 >= 0 && prev_previous >= 0 && previous >= 0) {
                const item = getPatternState(state, prev3, prev_previous, previous);
                if (item.target_digit >= 0) {
                    if (bootstrapping) {
                        storeTarget(
                            state,
                            prev3,
                            prev_previous,
                            previous,
                            current,
                            tick.epoch ?? state.tick_index,
                            journal_messages
                        );
                    } else {
                        const result = firePatternReturn(
                            state,
                            prev3,
                            prev_previous,
                            previous,
                            tick.epoch ?? state.tick_index,
                            journal_messages
                        );
                        if (prediction < 0 && result >= 0) prediction = result;
                    }
                } else {
                    storeTarget(
                        state,
                        prev3,
                        prev_previous,
                        previous,
                        current,
                        tick.epoch ?? state.tick_index,
                        journal_messages
                    );
                }
            }

            state.prev3_digit = prev_previous;
            state.prev_previous_digit = previous;
            state.previous_digit = current;
            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    }

    if (!journal_enabled) journal_messages.length = 0;

    const result = buildResult(state, prediction, tick_window, journal_messages);
    state.last_result = result;
    state.last_result_fp = result_fp;
    return result;
};
