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
    tick_index: -1,
    previous_digit: -1,
    previous_previous_digit: -1,
});

export const resetDoubleDigitReturnState = () => createDoubleDigitReturnState();

const statusLine = state =>
    state.digits
        .map((item, digit) => `${digit}: ${item.target_digit >= 0 ? item.target_digit : '-'} ${item.status}`)
        .join(' | ');

const processPattern = (state, trigger, target, epoch, journal_messages, suppress_signal = false) => {
    const item = state.digits[trigger];
    item.last_pattern = `${trigger} → ${trigger} → ${target}`;

    if (item.target_digit < 0) {
        item.target_digit = target;
        item.status = 'WAITING';
        item.trade_status = 'IDLE';
        item.first_pattern_epoch = epoch;
        journal_messages.push({
            className: 'journal__text',
            message: `Digit ${trigger}: stored target ${target} (${item.last_pattern}).`,
        });
        return -1;
    }

    if (item.target_digit !== target) {
        item.target_digit = target;
        item.status = 'WAITING';
        item.trade_status = 'IDLE';
        item.confirmations = 0;
        item.first_pattern_epoch = epoch;
        journal_messages.push({
            className: 'journal__text',
            message: `Digit ${trigger}: target updated to ${target} (${item.last_pattern}).`,
        });
        return -1;
    }

    if (suppress_signal) {
        item.status = 'WAITING';
        item.trade_status = 'IDLE';
        item.first_pattern_epoch = epoch;
        return -1;
    }

    item.confirmations += 1;
    item.status = 'CONFIRMED';
    item.trade_status = 'SIGNAL';
    journal_messages.push({
        className: 'journal__text--success',
        message: `Digit ${trigger}: confirmed ${item.last_pattern} → DIFFER ${target}.`,
    });

    // The trigger is reset as soon as its signal is emitted, so it cannot
    // submit duplicate contracts while the current contract is open.
    item.target_digit = -1;
    item.status = 'WATCHING';
    item.trade_status = 'IDLE';
    item.first_pattern_epoch = null;
    return target;
};

export const evaluateDoubleDigitReturnDiffers = (
    raw_ticks,
    options = {},
    state = createDoubleDigitReturnState()
) => {
    const tick_window = Math.max(120, Math.floor(Number(options.tick_window)) || 120);
    const journal_enabled = options.journal_enabled !== false;
    const journal_messages = [];
    const ticks = normalizeTicks(raw_ticks).slice(-tick_window);
    let prediction = -1;

    if (ticks.length) {
        const bootstrapping = !state.bootstrapped;
        ticks.forEach(tick => {
            if (tick.epoch !== null && tick.epoch === state.last_processed_epoch) return;
            if (tick.epoch !== null && state.last_processed_epoch !== null && tick.epoch < state.last_processed_epoch) return;

            state.tick_index += 1;
            if (state.previous_previous_digit >= 0 && state.previous_digit === state.previous_previous_digit) {
                const result = processPattern(
                    state,
                    state.previous_digit,
                    tick.digit,
                    tick.epoch ?? state.tick_index,
                    journal_messages,
                    bootstrapping
                );
                if (prediction < 0 && result >= 0) prediction = result;
            }
            state.previous_previous_digit = state.previous_digit;
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
