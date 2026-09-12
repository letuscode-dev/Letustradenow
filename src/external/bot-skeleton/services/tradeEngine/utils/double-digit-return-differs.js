const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const normalizeTicks = ticks => (Array.isArray(ticks) ? ticks : []).flatMap(item => {
    const digit = toDigit(item && typeof item === 'object' ? item.digit ?? item.quote : item);
    if (digit === null) return [];
    const epoch = item && typeof item === 'object' ? Number(item.epoch) : NaN;
    return [{ digit, epoch: Number.isFinite(epoch) ? epoch : null }];
});

const createDigitState = () => ({
    target_digit: -1,
    awaiting_target: false,
    status: 'WATCHING',
    confirmations: 0,
    first_pattern_epoch: null,
    last_pattern: '',
    trade_status: 'IDLE',
});

export const createDoubleDigitReturnState = () => ({
    digits: Array.from({ length: 10 }, createDigitState),
    bootstrapped: false,
    last_processed_epoch: null,
    last_signal_key: null,
    last_plain_fingerprint: null,
    tick_index: -1,
    previous_digit: -1,
});

export const resetDoubleDigitReturnState = () => createDoubleDigitReturnState();

const statusLine = state =>
    state.digits
        .map((item, digit) => `${digit}: ${item.target_digit >= 0 ? item.target_digit : '-'} ${item.status}`)
        .join(' | ');

const storeTarget = (state, trigger, target, epoch, journal_messages) => {
    const item = state.digits[trigger];
    item.target_digit = target;
    item.awaiting_target = false;
    item.status = 'WAITING';
    item.trade_status = 'IDLE';
    item.first_pattern_epoch = epoch;
    item.last_pattern = `${trigger} → ${trigger} → ${target}`;
    journal_messages.push({
        className: 'journal__text',
        message: `Digit ${trigger}: stored target ${target} (${item.last_pattern}).`,
    });
};

const handleRepeatedDigit = (state, trigger, epoch, journal_messages, suppress_signal) => {
    const item = state.digits[trigger];
    if (item.target_digit < 0) {
        item.awaiting_target = true;
        return -1;
    }
    if (suppress_signal) return -1;

    const target = item.target_digit;
    const signal_key = `${epoch ?? state.tick_index}:${trigger}->${target}`;
    if (state.last_signal_key === signal_key) {
        return -1;
    }

    item.confirmations += 1;
    item.status = 'CONFIRMED';
    item.trade_status = 'SIGNAL';
    journal_messages.push({
        className: 'journal__text--success',
        message: `Digit ${trigger}: return repeat confirmed → DIFFER ${target}.`,
    });
    item.target_digit = -1;
    item.awaiting_target = false;
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
        // Append-only growth — process only the new digits.
        start = prev.length;
    } else if (
        fingerprint.length === prev.length &&
        prev.length > 0 &&
        fingerprint.slice(0, -1) === prev.slice(1)
    ) {
        // Fixed-size sliding window — only the newest tip is new.
        start = fingerprint.length - 1;
    } else if (
        fingerprint.length === prev.length + 1 &&
        fingerprint.slice(0, -1) === prev
    ) {
        start = prev.length;
    } else {
        // Unrelated window reshape: rebuild quietly (no live signals).
        state.bootstrapped = false;
        start = 0;
    }

    state.last_plain_fingerprint = fingerprint;
    return ticks.slice(Math.max(0, start));
};

export const evaluateDoubleDigitReturnDiffers = (
    raw_ticks,
    options = {},
    state = createDoubleDigitReturnState()
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
            state.digits.forEach((item, trigger) => {
                if (item.awaiting_target && tick.digit !== trigger) {
                    storeTarget(state, trigger, tick.digit, tick.epoch ?? state.tick_index, journal_messages);
                }
            });

            if (state.previous_digit >= 0 && state.previous_digit === tick.digit) {
                const result = handleRepeatedDigit(
                    state,
                    tick.digit,
                    tick.epoch ?? state.tick_index,
                    journal_messages,
                    bootstrapping
                );
                if (prediction < 0 && result >= 0) prediction = result;
            }
            state.previous_digit = tick.digit;
            if (tick.epoch !== null) state.last_processed_epoch = tick.epoch;
        });
        state.bootstrapped = true;
    }

    if (!journal_enabled) journal_messages.length = 0;
    return {
        prediction,
        allowed: prediction >= 0,
        tick_window,
        states: state.digits.map((item, digit) => ({ digit, ...item })),
        state_summary: statusLine(state),
        journal_messages,
    };
};
