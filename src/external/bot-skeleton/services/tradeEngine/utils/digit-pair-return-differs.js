/**
 * Digit Pair → Return Differs
 *
 * When four consecutive last digits form A → B → C → D (digits 0–9),
 * signals Digit Differs on C.
 *
 * Example: 7 → 3 → 1 → 4 → DIFFER 1.
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

export const createDigitPairReturnState = () => ({
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
    last_pattern: '',
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

const buildResult = (state, prediction, tick_window, journal_messages) => ({
    prediction,
    allowed: prediction >= 0,
    tick_window,
    pattern: state.last_pattern || '',
    state_summary: state.last_pattern || 'watching for A → B → C → D',
    waiting_pairs: [],
    journal_messages,
});

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
        return {
            ...state.last_result,
            journal_messages: journal_enabled ? state.last_result.journal_messages || [] : [],
        };
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

            // A → B → C → D complete → Differ C (unless bootstrapping history).
            if (prev3 >= 0 && prev_previous >= 0 && previous >= 0) {
                const a = prev3;
                const b = prev_previous;
                const c = previous;
                const d = current;
                const pattern = `${a} → ${b} → ${c} → ${d}`;
                state.last_pattern = pattern;

                if (!bootstrapping) {
                    const signal_key = `${tick.epoch ?? state.tick_index}:${a},${b},${c},${d}->${c}`;
                    if (state.last_signal_key !== signal_key) {
                        state.last_signal_key = signal_key;
                        prediction = c;
                        journal_messages.push({
                            className: 'journal__text--success',
                            message: `Pattern ${pattern} → DIFFER ${c}.`,
                        });
                    }
                } else {
                    journal_messages.push({
                        className: 'journal__text',
                        message: `Bootstrap saw ${pattern} (no trade).`,
                    });
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

    if (journal_messages.length > 8) {
        journal_messages.splice(0, journal_messages.length - 8);
    }

    const result = buildResult(state, prediction, tick_window, journal_messages);
    state.last_result = result;
    state.last_result_fp = result_fp;
    return result;
};
