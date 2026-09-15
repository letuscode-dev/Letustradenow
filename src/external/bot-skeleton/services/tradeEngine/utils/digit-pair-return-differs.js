/**
 * Digit Pair → Return Differs
 *
 * Learns A → B → C for every digit pair (A,B) with A,B,C in 0–9.
 * When A → B appears again as the newest two digits, signals Digit Differs C.
 *
 * Example: 7 → 3 → 1 stores target 1 for pair (7,3).
 * Later 7 → 3 fires DIFFER 1.
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

const pairKey = (a, b) => `${a},${b}`;

const createPairState = () => ({
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
    tick_index: -1,
    previous_digit: -1,
    prev_previous_digit: -1,
});

export const resetDigitPairReturnState = () => createDigitPairReturnState();

const getPairState = (state, a, b) => {
    const key = pairKey(a, b);
    if (!state.pairs[key]) {
        state.pairs[key] = createPairState();
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

const storeTarget = (state, a, b, target, epoch, journal_messages) => {
    const item = getPairState(state, a, b);
    if (item.target_digit === target && item.status === 'WAITING') {
        return;
    }
    item.target_digit = target;
    item.status = 'WAITING';
    item.trade_status = 'IDLE';
    item.first_pattern_epoch = epoch;
    item.last_pattern = `${a} → ${b} → ${target}`;
    journal_messages.push({
        className: 'journal__text',
        message: `Pair ${a},${b}: stored target ${target} (${item.last_pattern}).`,
    });
};

const handlePairReturn = (state, a, b, epoch, journal_messages, suppress_signal) => {
    const item = getPairState(state, a, b);
    if (item.target_digit < 0) {
        return -1;
    }
    if (suppress_signal) {
        return -1;
    }

    const target = item.target_digit;
    const signal_key = `${epoch ?? state.tick_index}:${a},${b}->${target}`;
    if (state.last_signal_key === signal_key) {
        return -1;
    }

    item.confirmations += 1;
    item.status = 'CONFIRMED';
    item.trade_status = 'SIGNAL';
    journal_messages.push({
        className: 'journal__text--success',
        message: `Pair ${a},${b}: return confirmed → DIFFER ${target}.`,
    });
    item.target_digit = -1;
    item.status = 'WATCHING';
    item.trade_status = 'IDLE';
    item.first_pattern_epoch = null;
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

    if (ticks.length) {
        const bootstrapping = !state.bootstrapped;
        ticks.forEach(tick => {
            if (tick.epoch !== null && tick.epoch === state.last_processed_epoch) return;
            if (tick.epoch !== null && state.last_processed_epoch !== null && tick.epoch < state.last_processed_epoch) {
                return;
            }

            state.tick_index += 1;
            const tip = tick.digit;
            const previous = state.previous_digit;
            const prev_previous = state.prev_previous_digit;

            if (previous >= 0) {
                const result = handlePairReturn(
                    state,
                    previous,
                    tip,
                    tick.epoch ?? state.tick_index,
                    journal_messages,
                    bootstrapping
                );
                if (prediction < 0 && result >= 0) prediction = result;
            }

            // After a return fire clears (A,B), learning A → B → C on this same tip
            // still stores the new follower for the prior pair.
            if (prev_previous >= 0 && previous >= 0) {
                storeTarget(
                    state,
                    prev_previous,
                    previous,
                    tip,
                    tick.epoch ?? state.tick_index,
                    journal_messages
                );
            }

            state.prev_previous_digit = previous;
            state.previous_digit = tip;
            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    }

    if (!journal_enabled) journal_messages.length = 0;

    const waiting_pairs = Object.entries(state.pairs || {})
        .filter(([, item]) => item.target_digit >= 0)
        .map(([key, item]) => {
            const [a, b] = key.split(',').map(Number);
            return { pair: key, a, b, ...item };
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
