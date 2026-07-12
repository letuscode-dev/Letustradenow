/**
 * Last-Digit Range Momentum — Over 1.
 *
 * Ranges:
 *   Losing: 0–1
 *   Lower winning: 2–5
 *   Higher winning: 6–9
 *
 * Signal when previous is Lower, current is Higher, and none of the previous
 * `losing_lookback` ticks (default 2, excluding current) are in the Losing range.
 */

export const RANGE_LOSING = 'losing';
export const RANGE_LOWER = 'lower';
export const RANGE_HIGHER = 'higher';
export const DEFAULT_LOSING_LOOKBACK = 2;
export const DEFAULT_COOLDOWN = 0;
export const MAX_JOURNAL_MESSAGES_PER_EVALUATE = 2;

const toDigit = value => {
    const n = Math.floor(Number(value));
    if (!Number.isInteger(n) || n < 0 || n > 9) {
        return null;
    }
    return n;
};

const toBool = (value, default_value = true) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

const toInt = (value, fallback, min = 0) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (n < min) {
        n = min;
    }
    return n;
};

/**
 * @param {number} digit
 * @returns {'losing'|'lower'|'higher'|null}
 */
export const classifyDigitRange = digit => {
    const d = toDigit(digit);
    if (d === null) {
        return null;
    }
    if (d <= 1) {
        return RANGE_LOSING;
    }
    if (d <= 5) {
        return RANGE_LOWER;
    }
    return RANGE_HIGHER;
};

export const createRangeMomentumState = () => ({
    tickIndex: -1,
    cooldownUntilTick: -1,
    cooldownLogEmitted: false,
    lastProcessedEpoch: null,
});

export const resetRangeMomentumState = state => {
    Object.assign(state, createRangeMomentumState());
};

/**
 * Extract digits + advance tick index when a new epoch arrives.
 * @param {Array<{quote?: number|string, epoch?: number}|number|string>} digit_ticks
 * @param {{ tickIndex: number, lastProcessedEpoch: number|null }} state
 * @returns {number[]}
 */
const ingestTicks = (digit_ticks, state) => {
    const digits = [];
    if (!Array.isArray(digit_ticks)) {
        return digits;
    }

    for (const tick of digit_ticks) {
        if (tick !== null && typeof tick === 'object') {
            const digit = toDigit(tick.quote ?? tick.digit);
            if (digit === null) {
                continue;
            }
            digits.push(digit);
            const epoch = tick.epoch ?? null;
            if (epoch !== null && epoch !== state.lastProcessedEpoch) {
                state.tickIndex += 1;
                state.lastProcessedEpoch = epoch;
            }
        } else {
            const digit = toDigit(tick);
            if (digit !== null) {
                digits.push(digit);
            }
        }
    }

    // Plain digit arrays (unit tests): treat each evaluate with a longer list as new ticks.
    if (
        digits.length > 0 &&
        digit_ticks.length > 0 &&
        typeof digit_ticks[0] !== 'object' &&
        state.tickIndex < digits.length - 1
    ) {
        state.tickIndex = digits.length - 1;
    }

    return digits;
};

/**
 * Losing-range filter: none of the previous `lookback` ticks (excluding current)
 * may be 0 or 1.
 *
 * @param {number[]} digits - oldest → newest
 * @param {number} lookback
 * @returns {boolean}
 */
export const passesLosingRangeFilter = (digits, lookback = DEFAULT_LOSING_LOOKBACK) => {
    const n = toInt(lookback, DEFAULT_LOSING_LOOKBACK, 1);
    if (!Array.isArray(digits) || digits.length < n + 1) {
        return false;
    }

    for (let i = digits.length - 1 - n; i <= digits.length - 2; i++) {
        if (classifyDigitRange(digits[i]) === RANGE_LOSING) {
            return false;
        }
    }
    return true;
};

/**
 * @param {number[]} digits
 * @returns {{ previous: number|null, current: number|null, previous_range: string|null, current_range: string|null, momentum: boolean }}
 */
export const detectRangeMomentum = digits => {
    if (!Array.isArray(digits) || digits.length < 2) {
        return {
            previous: null,
            current: null,
            previous_range: null,
            current_range: null,
            momentum: false,
        };
    }

    const previous = toDigit(digits[digits.length - 2]);
    const current = toDigit(digits[digits.length - 1]);
    const previous_range = classifyDigitRange(previous);
    const current_range = classifyDigitRange(current);
    const momentum = previous_range === RANGE_LOWER && current_range === RANGE_HIGHER;

    return { previous, current, previous_range, current_range, momentum };
};

const rangeLabel = range => {
    if (range === RANGE_LOSING) {
        return 'Losing(0-1)';
    }
    if (range === RANGE_LOWER) {
        return 'Lower(2-5)';
    }
    if (range === RANGE_HIGHER) {
        return 'Higher(6-9)';
    }
    return 'n/a';
};

/**
 * @param {object} detail
 * @returns {Array<{className: string, message: string}>}
 */
export const formatRangeMomentumJournal = detail => {
    const {
        allowed,
        previous,
        current,
        previous_range,
        current_range,
        momentum,
        losing_filter_ok,
        fail_reason,
        cooldown_left,
    } = detail;

    const lines = [
        `Range Momentum ${allowed ? 'SIGNAL' : 'SKIP'}`,
        `Current: ${current ?? 'n/a'} (${rangeLabel(current_range)})`,
        `Previous: ${previous ?? 'n/a'} (${rangeLabel(previous_range)})`,
        `Momentum Lower→Higher: ${momentum ? 'Yes' : 'No'}`,
        `Losing filter: ${losing_filter_ok ? 'Yes' : 'No'}`,
        `Trade signal: ${allowed ? 'Yes' : 'No'}`,
    ];

    if (!allowed && fail_reason) {
        lines.push(`Failed: ${fail_reason}`);
    }
    if (cooldown_left > 0) {
        lines.push(`Cooldown: ${cooldown_left} tick(s) left`);
    }

    return [
        {
            className: allowed ? 'journal__text--success' : 'journal__text--error',
            message: lines.join('\n'),
        },
    ];
};

/**
 * @param {Array} digit_ticks - epoch-tagged ticks or plain digits (oldest → newest)
 * @param {{
 *   enabled?: boolean,
 *   journal_enabled?: boolean,
 *   notify_enabled?: boolean,
 *   cooldown_after_trade?: number,
 *   losing_lookback?: number,
 * }} [options]
 * @param {ReturnType<typeof createRangeMomentumState>} [state]
 * @returns {{
 *   allowed: boolean,
 *   signal: boolean,
 *   enabled: boolean,
 *   previous: number|null,
 *   current: number|null,
 *   previous_range: string|null,
 *   current_range: string|null,
 *   momentum: boolean,
 *   losing_filter_ok: boolean,
 *   fail_reason: string,
 *   journal_messages: Array<{className: string, message: string}>,
 *   notify_messages: Array<{className: string, message: string}>,
 * }}
 */
export const evaluateRangeMomentumOverOne = (digit_ticks, options = {}, state = null) => {
    const enabled = toBool(options.enabled, true);
    const journal_enabled = toBool(options.journal_enabled, true);
    const notify_enabled = toBool(options.notify_enabled, true);
    const cooldown_after_trade = toInt(options.cooldown_after_trade, DEFAULT_COOLDOWN, 0);
    const losing_lookback = toInt(options.losing_lookback, DEFAULT_LOSING_LOOKBACK, 1);

    const session = state || createRangeMomentumState();
    const digits = ingestTicks(digit_ticks, session);

    const empty = {
        allowed: false,
        signal: false,
        enabled,
        previous: null,
        current: null,
        previous_range: null,
        current_range: null,
        momentum: false,
        losing_filter_ok: false,
        fail_reason: '',
        journal_messages: [],
        notify_messages: [],
    };

    if (!enabled) {
        return { ...empty, fail_reason: 'Strategy disabled' };
    }

    const detected = detectRangeMomentum(digits);
    const losing_filter_ok = passesLosingRangeFilter(digits, losing_lookback);
    let fail_reason = '';
    let allowed = false;
    let cooldown_left = 0;

    if (session.tickIndex < session.cooldownUntilTick) {
        cooldown_left = session.cooldownUntilTick - session.tickIndex;
        fail_reason = `Cooldown (${cooldown_left} left)`;
        if (!session.cooldownLogEmitted && journal_enabled) {
            session.cooldownLogEmitted = true;
        }
    } else {
        session.cooldownLogEmitted = false;

        if (detected.previous === null || detected.current === null) {
            fail_reason = 'Need at least 2 digits';
        } else if (!detected.momentum) {
            if (detected.previous_range === RANGE_HIGHER && detected.current_range === RANGE_LOWER) {
                fail_reason = 'Momentum Higher→Lower (need Lower→Higher)';
            } else if (detected.previous_range === RANGE_LOWER && detected.current_range === RANGE_LOWER) {
                fail_reason = 'Both digits in Lower range';
            } else if (detected.previous_range !== RANGE_LOWER) {
                fail_reason = 'Previous tick not in Lower(2-5)';
            } else {
                fail_reason = 'Current tick not in Higher(6-9)';
            }
        } else if (!losing_filter_ok) {
            fail_reason = `Losing digit in previous ${losing_lookback} tick(s)`;
        } else {
            allowed = true;
            if (cooldown_after_trade > 0) {
                session.cooldownUntilTick = session.tickIndex + cooldown_after_trade;
            }
        }
    }

    const detail = {
        allowed,
        ...detected,
        losing_filter_ok,
        fail_reason,
        cooldown_left,
    };

    const journal_messages = journal_enabled ? formatRangeMomentumJournal(detail).slice(0, MAX_JOURNAL_MESSAGES_PER_EVALUATE) : [];
    const notify_messages =
        notify_enabled && allowed
            ? [
                  {
                      className: 'journal__text--success',
                      message: `Over 1 signal · ${detected.previous}→${detected.current} (Lower→Higher)`,
                  },
              ]
            : [];

    return {
        allowed,
        signal: allowed,
        enabled,
        previous: detected.previous,
        current: detected.current,
        previous_range: detected.previous_range,
        current_range: detected.current_range,
        momentum: detected.momentum,
        losing_filter_ok,
        fail_reason,
        journal_messages,
        notify_messages,
    };
};
