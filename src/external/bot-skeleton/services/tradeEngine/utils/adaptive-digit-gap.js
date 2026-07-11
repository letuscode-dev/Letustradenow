/**
 * Adaptive Per-Digit Gap Differs — trade filter / signal (not a fixed-gap predictor).
 *
 * For each digit 0–9 independently:
 * - Current gap = ticks since that digit last appeared
 * - When it appears again, the completed gap becomes the adaptive trigger for the next cycle
 * - Current gap resets to 0 immediately on appearance
 * - Differs is eligible when currentGap >= adaptiveTriggerGap (once per cycle by default)
 */

export const DEFAULT_MIN_ADAPTIVE_GAP = 3;
export const DEFAULT_MAX_ADAPTIVE_GAP = 20;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_MAX_TRADES = 0; // 0 = unlimited

export const SELECTION_FIRST = 0;
export const SELECTION_LARGEST_ADAPTIVE = 1;
export const SELECTION_HIGHEST_EXCESS = 2;
export const SELECTION_LARGEST_CURRENT = 3;

/**
 * @returns {{ digit: number, initialized: boolean, currentGap: number, completedGap: number|null, adaptiveTriggerGap: number|null, lastOccurrenceTick: number, triggerReached: boolean, tradePlacedThisCycle: boolean }}
 */
export const createDigitState = digit => ({
    digit,
    initialized: false,
    currentGap: 0,
    completedGap: null,
    adaptiveTriggerGap: null,
    lastOccurrenceTick: -1,
    triggerReached: false,
    tradePlacedThisCycle: false,
});

/**
 * @returns {{ digits: ReturnType<typeof createDigitState>[], processedCount: number, tickIndex: number, tradesThisSession: number, cooldownUntilTick: number, lastJournal: string[], lastDashboard: string }}
 */
export const createTrackerState = () => ({
    digits: Array.from({ length: 10 }, (_, digit) => createDigitState(digit)),
    processedCount: 0,
    tickIndex: -1,
    tradesThisSession: 0,
    cooldownUntilTick: -1,
    lastJournal: [],
    lastDashboard: '',
});

export const resetTrackerState = state => {
    Object.assign(state, createTrackerState());
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

const toInt = (value, fallback, min = null) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (min !== null && n < min) {
        n = min;
    }
    return n;
};

/**
 * Normalize user options for one evaluation.
 */
export const normalizeAdaptiveGapOptions = (options = {}) => {
    let min_gap = toInt(options.min_adaptive_gap, DEFAULT_MIN_ADAPTIVE_GAP, 0);
    let max_gap = toInt(options.max_adaptive_gap, DEFAULT_MAX_ADAPTIVE_GAP, 0);
    if (max_gap < min_gap) {
        max_gap = min_gap;
    }

    return {
        enabled: toBool(options.enabled, true),
        min_adaptive_gap: min_gap,
        max_adaptive_gap: max_gap,
        one_trade_per_cycle: toBool(options.one_trade_per_cycle, true),
        one_active_trade_only: toBool(options.one_active_trade_only, true),
        selection_mode: toInt(options.selection_mode, SELECTION_FIRST, 0),
        cooldown_after_trade: toInt(options.cooldown_after_trade, DEFAULT_COOLDOWN, 0),
        max_trades_per_session: toInt(options.max_trades_per_session, DEFAULT_MAX_TRADES, 0),
        journal_enabled: toBool(options.journal_enabled, true),
        dashboard_enabled: toBool(options.dashboard_enabled, false),
    };
};

/**
 * Process a single incoming last digit against tracker state.
 * Appeared digit is completed/reset first; all other digits increment once.
 *
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {number} digit
 * @param {{ journal_enabled?: boolean }} [options]
 */
export const processDigitTick = (state, digit, options = {}) => {
    const d = Number(digit);
    if (!Number.isInteger(d) || d < 0 || d > 9) {
        return;
    }

    state.tickIndex += 1;
    const tick = state.tickIndex;
    const journal = [];

    const appeared = state.digits[d];

    if (!appeared.initialized) {
        // First occurrence — initialize only; no adaptive trigger yet.
        appeared.initialized = true;
        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;
        appeared.triggerReached = false;
        appeared.tradePlacedThisCycle = false;
        if (options.journal_enabled) {
            journal.push({
                className: 'journal__text',
                message: `Digit ${d} first seen.\nCurrent Gap Reset: 0\nWaiting for second occurrence before adaptive trigger.`,
            });
        }
    } else {
        const completed = appeared.currentGap;
        const previous_trigger = appeared.adaptiveTriggerGap;
        appeared.completedGap = completed;
        appeared.adaptiveTriggerGap = completed;
        appeared.currentGap = 0;
        appeared.lastOccurrenceTick = tick;
        appeared.triggerReached = false;
        appeared.tradePlacedThisCycle = false;

        if (options.journal_enabled) {
            if (previous_trigger === null) {
                journal.push({
                    className: 'journal__text',
                    message: [
                        `Digit ${d} appeared.`,
                        `Completed Gap: ${completed}`,
                        `New Adaptive Trigger Gap: ${completed}`,
                        'Current Gap Reset: 0',
                        'New Cycle Started',
                    ].join('\n'),
                });
            } else {
                journal.push({
                    className: 'journal__text',
                    message: [
                        `Digit ${d} appeared again`,
                        `Completed Gap: ${completed}`,
                        `Adaptive Trigger Updated: ${previous_trigger} → ${completed}`,
                        'Current Gap Reset: 0',
                        'Trade Cycle Reset',
                    ].join('\n'),
                });
            }
        }
    }

    // Increment every other digit once for this tick.
    for (let i = 0; i <= 9; i++) {
        if (i === d) {
            continue;
        }
        state.digits[i].currentGap += 1;
    }

    state.lastJournal = journal;
};

/**
 * Sync tracker with the full digit history (process only new ticks).
 *
 * @param {ReturnType<typeof createTrackerState>} state
 * @param {Array<number|string>} digits
 * @param {object} options
 */
export const syncTrackerWithDigits = (state, digits, options = {}) => {
    if (!Array.isArray(digits)) {
        return;
    }

    if (digits.length < state.processedCount) {
        resetTrackerState(state);
    }

    for (let i = state.processedCount; i < digits.length; i++) {
        processDigitTick(state, digits[i], options);
    }
    state.processedCount = digits.length;
};

/**
 * Remaining ticks until trigger (0 when ready/triggered).
 */
export const getRemainingTicks = digit_state => {
    if (digit_state.adaptiveTriggerGap === null) {
        return null;
    }
    return Math.max(digit_state.adaptiveTriggerGap - digit_state.currentGap, 0);
};

/**
 * Whether a digit is eligible for Differs under the given options.
 */
export const isDigitEligible = (digit_state, options) => {
    const trigger = digit_state.adaptiveTriggerGap;
    if (trigger === null || !digit_state.initialized) {
        return false;
    }
    if (trigger < options.min_adaptive_gap || trigger > options.max_adaptive_gap) {
        return false;
    }
    if (digit_state.currentGap < trigger) {
        return false;
    }
    if (options.one_trade_per_cycle && digit_state.tradePlacedThisCycle) {
        return false;
    }
    return true;
};

/**
 * Pick one eligible digit using the selection mode.
 *
 * @param {ReturnType<typeof createDigitState>[]} digit_states
 * @param {ReturnType<typeof normalizeAdaptiveGapOptions>} options
 * @returns {number} digit or -1
 */
export const selectEligibleDigit = (digit_states, options) => {
    const eligible = digit_states.filter(ds => isDigitEligible(ds, options));
    if (!eligible.length) {
        return -1;
    }

    const mode = options.selection_mode;

    if (mode === SELECTION_LARGEST_ADAPTIVE) {
        eligible.sort((a, b) => b.adaptiveTriggerGap - a.adaptiveTriggerGap || a.digit - b.digit);
    } else if (mode === SELECTION_HIGHEST_EXCESS) {
        eligible.sort((a, b) => {
            const excess_a = a.currentGap - a.adaptiveTriggerGap;
            const excess_b = b.currentGap - b.adaptiveTriggerGap;
            return excess_b - excess_a || a.digit - b.digit;
        });
    } else if (mode === SELECTION_LARGEST_CURRENT) {
        eligible.sort((a, b) => b.currentGap - a.currentGap || a.digit - b.digit);
    } else {
        // First eligible by digit order (0→9).
        eligible.sort((a, b) => a.digit - b.digit);
    }

    return eligible[0].digit;
};

/**
 * Live dashboard table for all digits.
 */
export const formatGapDashboard = digit_states => {
    const header = 'Digit | Current Gap | Adaptive Gap | Remaining | Trigger | Traded This Cycle';
    const rows = digit_states.map(ds => {
        const adaptive = ds.adaptiveTriggerGap === null ? '-' : String(ds.adaptiveTriggerGap);
        const remaining = getRemainingTicks(ds);
        const remaining_text = remaining === null ? '-' : String(remaining);

        let trigger_status = 'Waiting';
        if (ds.adaptiveTriggerGap === null) {
            trigger_status = ds.initialized ? 'Init' : '-';
        } else if (ds.tradePlacedThisCycle) {
            trigger_status = 'Triggered';
        } else if (ds.currentGap >= ds.adaptiveTriggerGap) {
            trigger_status = 'Ready';
        }

        return `${ds.digit} | ${ds.currentGap} | ${adaptive} | ${remaining_text} | ${trigger_status} | ${
            ds.tradePlacedThisCycle ? 'Yes' : 'No'
        }`;
    });

    return [header, ...rows].join('\n');
};

/**
 * Evaluate adaptive gap Differs signal for the latest digit window.
 *
 * @param {Array<number|string>} digits
 * @param {object} raw_options
 * @param {ReturnType<typeof createTrackerState>} state - mutable persistent state
 * @returns {{ prediction: number, enabled: boolean, journal_messages: Array<{className: string, message: string}>, dashboard: string|null, eligible: number[] }}
 */
export const evaluateAdaptiveDigitGap = (digits, raw_options = {}, state = createTrackerState()) => {
    const options = normalizeAdaptiveGapOptions(raw_options);
    const journal_messages = [];

    if (!options.enabled) {
        return {
            prediction: -1,
            enabled: false,
            journal_messages,
            dashboard: null,
            eligible: [],
        };
    }

    syncTrackerWithDigits(state, digits, options);

    // Carry forward appearance journals from the last processed tick.
    if (options.journal_enabled && state.lastJournal?.length) {
        journal_messages.push(...state.lastJournal);
        state.lastJournal = [];
    }

    const max_trades = options.max_trades_per_session;
    if (max_trades > 0 && state.tradesThisSession >= max_trades) {
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--error',
                message: `Trade Blocked\nReason: Maximum trades per session reached (${max_trades})`,
            });
        }
        const dashboard = options.dashboard_enabled ? formatGapDashboard(state.digits) : null;
        state.lastDashboard = dashboard || '';
        return { prediction: -1, enabled: true, journal_messages, dashboard, eligible: [] };
    }

    if (state.tickIndex < state.cooldownUntilTick) {
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--error',
                message: `Trade Blocked\nReason: Cooldown active (${state.cooldownUntilTick - state.tickIndex} tick(s) left)`,
            });
        }
        const dashboard = options.dashboard_enabled ? formatGapDashboard(state.digits) : null;
        state.lastDashboard = dashboard || '';
        return { prediction: -1, enabled: true, journal_messages, dashboard, eligible: [] };
    }

    // Optional waiting logs for digits approaching trigger (journal only, keep light: ready/blocked).
    const eligible_digits = state.digits.filter(ds => isDigitEligible(ds, options)).map(ds => ds.digit);

    // Digits that would be ready but are blocked by one-trade-per-cycle.
    if (options.journal_enabled) {
        state.digits.forEach(ds => {
            const trigger = ds.adaptiveTriggerGap;
            if (trigger === null) {
                return;
            }
            if (trigger < options.min_adaptive_gap || trigger > options.max_adaptive_gap) {
                return;
            }
            if (ds.currentGap < trigger) {
                return;
            }
            if (options.one_trade_per_cycle && ds.tradePlacedThisCycle) {
                journal_messages.push({
                    className: 'journal__text--error',
                    message: [
                        `Digit ${ds.digit} Trade Blocked`,
                        'Reason: Trade already placed during current gap cycle',
                    ].join('\n'),
                });
            }
        });
    }

    let prediction = selectEligibleDigit(state.digits, options);

    // one_active_trade_only: if any digit already traded this cycle and still in cycle, prefer not stacking
    // another digit unless selection still finds one and flag is false. When true, skip if any tradePlacedThisCycle.
    if (prediction >= 0 && options.one_active_trade_only) {
        const any_active = state.digits.some(ds => ds.tradePlacedThisCycle && ds.digit !== prediction);
        if (any_active) {
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text--error',
                    message: `Digit ${prediction} Trade Blocked\nReason: One active trade only`,
                });
            }
            prediction = -1;
        }
    }

    if (prediction >= 0) {
        const ds = state.digits[prediction];
        ds.triggerReached = true;
        ds.tradePlacedThisCycle = true;
        state.tradesThisSession += 1;
        if (options.cooldown_after_trade > 0) {
            state.cooldownUntilTick = state.tickIndex + options.cooldown_after_trade;
        }

        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: [
                    `Digit ${prediction} Trigger Reached`,
                    `Current Gap: ${ds.currentGap}`,
                    `Adaptive Trigger Gap: ${ds.adaptiveTriggerGap}`,
                    `Action: Buy Differs ${prediction}`,
                ].join('\n'),
            });
        }
    }

    const dashboard = options.dashboard_enabled ? formatGapDashboard(state.digits) : null;
    state.lastDashboard = dashboard || '';

    return {
        prediction,
        enabled: true,
        journal_messages,
        dashboard,
        eligible: eligible_digits,
    };
};
