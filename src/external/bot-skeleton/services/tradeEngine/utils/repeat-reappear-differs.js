/**
 * Repeat-Reappear Differs
 *
 * When previous_digit === current_digit (a repeated digit streak of length ≥ 2):
 *   1. Remember that digit
 *   2. Wait until the streak breaks (a different digit appears)
 *   3. Wait for the digit to appear again → Digit Differs on it
 *
 * If the streak length was 3 or 4 when it broke, skip the first tip after the
 * break before accepting a reappearance ("not on the next tick").
 */

import { normalizeDigitTicks } from './window-index-differs';

/** @typedef {'watching' | 'waiting_break' | 'waiting_reappear' | 'armed'} RepeatReappearPhase */

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toDigit = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return null;
    }
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) > 1e-9 || rounded < 0 || rounded > 9) {
        return null;
    }
    return rounded;
};

export const normalizeRepeatReappearOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    journal_enabled: toBool(options.journal_enabled, true),
});

/**
 * @returns {{
 *   phase: RepeatReappearPhase,
 *   tickIndex: number,
 *   lastProcessedEpoch: number|null,
 *   previousDigit: number,
 *   streak: number,
 *   targetDigit: number,
 *   armedStreak: number,
 *   skipNext: boolean,
 *   lastPrediction: number,
 *   trade_committed: boolean,
 *   signal_issued_at: number,
 *   last_handled_contract_id: string|null,
 * }}
 */
export const createRepeatReappearState = () => ({
    phase: 'watching',
    tickIndex: -1,
    lastProcessedEpoch: null,
    previousDigit: -1,
    streak: 0,
    targetDigit: -1,
    armedStreak: 0,
    skipNext: false,
    lastPrediction: -1,
    trade_committed: false,
    signal_issued_at: 0,
    last_handled_contract_id: null,
});

export const resetRepeatReappearState = (state = null) => {
    const tracker = state || createRepeatReappearState();
    tracker.phase = 'watching';
    tracker.targetDigit = -1;
    tracker.armedStreak = 0;
    tracker.skipNext = false;
    tracker.lastPrediction = -1;
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    // Keep tickIndex / previousDigit / streak / lastProcessedEpoch / last_handled_contract_id
    // so live ticks continue cleanly after settlement.
    return tracker;
};

export const applyRepeatReappearSettlement = (state, contract_id) => {
    const tracker = state || createRepeatReappearState();
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
    resetRepeatReappearState(tracker);
    return true;
};

export const releaseStaleRepeatReappearCommit = (state, max_age_ms = 20000) => {
    const tracker = state || createRepeatReappearState();
    if (!tracker.trade_committed) {
        return false;
    }
    const issued = Number(tracker.signal_issued_at) || 0;
    if (!issued || Date.now() - issued < max_age_ms) {
        return false;
    }
    tracker.trade_committed = false;
    tracker.signal_issued_at = 0;
    if (tracker.phase === 'armed') {
        tracker.phase = 'watching';
        tracker.lastPrediction = -1;
        tracker.targetDigit = -1;
        tracker.armedStreak = 0;
        tracker.skipNext = false;
    }
    return true;
};

const armPrediction = (tracker, journal_messages, options, reason) => {
    tracker.phase = 'armed';
    tracker.lastPrediction = tracker.targetDigit;
    tracker.trade_committed = true;
    tracker.signal_issued_at = Date.now();
    if (options.journal_enabled) {
        journal_messages.push({
            className: 'journal__text--success',
            message: `${reason} → DIFFERS ${tracker.targetDigit}`,
        });
    }
};

/**
 * Process one newly arrived last digit.
 */
export const processRepeatReappearTick = (tracker, digit, options, journal_messages) => {
    tracker.tickIndex += 1;
    const previous = tracker.previousDigit;

    if (tracker.phase === 'armed') {
        tracker.previousDigit = digit;
        tracker.streak = previous === digit ? tracker.streak + 1 : 1;
        return;
    }

    // Update ending streak for watching / break tracking.
    const next_streak = previous === digit && previous >= 0 ? tracker.streak + 1 : 1;

    if (tracker.phase === 'waiting_break') {
        if (digit === tracker.targetDigit) {
            tracker.streak = next_streak;
            tracker.armedStreak = next_streak;
            tracker.previousDigit = digit;
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text',
                    message: `Repeat streak continues: ${digit} x${tracker.streak} — still waiting for break.`,
                });
            }
            return;
        }

        // Streak broken by a different digit.
        const streak_at_break = tracker.armedStreak || tracker.streak;
        tracker.skipNext = streak_at_break === 3 || streak_at_break === 4;
        tracker.phase = 'waiting_reappear';
        tracker.streak = 1;
        tracker.previousDigit = digit;
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text',
                message: tracker.skipNext
                    ? `Streak of ${streak_at_break} broke on ${digit}. Skip next tip, then wait for ${tracker.targetDigit} again.`
                    : `Streak of ${streak_at_break} broke on ${digit}. Waiting for ${tracker.targetDigit} to reappear.`,
            });
        }
        return;
    }

    if (tracker.phase === 'waiting_reappear') {
        if (tracker.skipNext) {
            tracker.skipNext = false;
            tracker.streak = next_streak;
            tracker.previousDigit = digit;
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text',
                    message: `Skipped tip ${digit} after 3–4 streak — still waiting for ${tracker.targetDigit}.`,
                });
            }
            return;
        }

        if (digit === tracker.targetDigit) {
            tracker.streak = next_streak;
            tracker.previousDigit = digit;
            armPrediction(
                tracker,
                journal_messages,
                options,
                `Reappear ${digit} after repeat streak`
            );
            return;
        }

        tracker.streak = 1;
        tracker.previousDigit = digit;
        return;
    }

    // watching: detect a new repeat (streak >= 2)
    tracker.streak = next_streak;
    if (previous >= 0 && previous === digit && next_streak >= 2) {
        tracker.targetDigit = digit;
        tracker.armedStreak = next_streak;
        tracker.skipNext = false;
        tracker.phase = 'waiting_break';
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Repeat detected: ${digit} x${next_streak}. Waiting for streak to break, then reappear → Differs ${digit}.`,
            });
        }
    }

    tracker.previousDigit = digit;
};

/**
 * @param {Array<number|{digit:number,epoch?:number}|string>} digit_ticks
 * @param {object} raw_options
 * @param {ReturnType<typeof createRepeatReappearState>} state
 */
export const evaluateRepeatReappearDiffers = (digit_ticks, raw_options = {}, state = null) => {
    const options = normalizeRepeatReappearOptions(raw_options);
    const journal_messages = [];
    const tracker = state || createRepeatReappearState();

    if (!options.enabled) {
        return {
            prediction: -1,
            barrier: -1,
            matched: false,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            streak: tracker.streak,
            skip_next: tracker.skipNext,
            reason: 'disabled',
            journal_messages,
        };
    }

    // Keep armed barrier available for purchase retry.
    if (tracker.phase === 'armed' && tracker.lastPrediction >= 0) {
        return {
            prediction: tracker.lastPrediction,
            barrier: tracker.lastPrediction,
            matched: true,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            streak: tracker.streak,
            skip_next: tracker.skipNext,
            reason: 'armed_pending_purchase',
            journal_messages: [],
        };
    }

    const ticks = normalizeDigitTicks(digit_ticks);
    if (!ticks.length) {
        return {
            prediction: -1,
            barrier: -1,
            matched: false,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            streak: tracker.streak,
            skip_next: tracker.skipNext,
            reason: 'no_ticks',
            journal_messages,
        };
    }

    // First live call: anchor on newest tip so historical cache repeats are ignored.
    if (tracker.tickIndex < 0) {
        const tip = ticks[ticks.length - 1];
        tracker.previousDigit = tip.digit;
        tracker.streak = 1;
        tracker.tickIndex = 0;
        tracker.lastProcessedEpoch = tip.epoch;
        return {
            prediction: -1,
            barrier: -1,
            matched: false,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            streak: tracker.streak,
            skip_next: tracker.skipNext,
            reason: 'anchored',
            journal_messages,
        };
    }

    let start = 0;
    if (tracker.lastProcessedEpoch != null) {
        const idx = ticks.findIndex(t => t.epoch != null && t.epoch > tracker.lastProcessedEpoch);
        start = idx >= 0 ? idx : ticks.length;
    } else {
        // Plain digit arrays (tests): process only newly appended tips.
        const already = tracker.tickIndex + 1;
        start = Math.min(already, ticks.length);
    }

    for (let i = start; i < ticks.length; i++) {
        const tip = ticks[i];
        processRepeatReappearTick(tracker, tip.digit, options, journal_messages);
        if (tip.epoch != null) {
            tracker.lastProcessedEpoch = tip.epoch;
        }
    }

    const matched = tracker.phase === 'armed' && tracker.lastPrediction >= 0;
    return {
        prediction: matched ? tracker.lastPrediction : -1,
        barrier: matched ? tracker.lastPrediction : -1,
        matched,
        phase: tracker.phase,
        target_digit: tracker.targetDigit,
        streak: tracker.streak,
        skip_next: tracker.skipNext,
        reason: matched
            ? 'reappear_differs'
            : tracker.phase === 'waiting_break'
              ? 'waiting_break'
              : tracker.phase === 'waiting_reappear'
                ? 'waiting_reappear'
                : 'watching',
        journal_messages,
    };
};
