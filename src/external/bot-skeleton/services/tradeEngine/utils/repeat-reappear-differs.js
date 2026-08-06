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

const pushStatus = (tracker, tip_digit, options, journal_messages) => {
    if (!options.journal_enabled) {
        return;
    }
    let message;
    if (tracker.phase === 'waiting_break') {
        message = `Repeat-reappear: tip ${tip_digit} — waiting for ${tracker.targetDigit} streak to break (x${tracker.streak})`;
    } else if (tracker.phase === 'waiting_reappear') {
        message = tracker.skipNext
            ? `Repeat-reappear: tip ${tip_digit} — skip this tip, then wait for ${tracker.targetDigit}`
            : `Repeat-reappear: tip ${tip_digit} — waiting for ${tracker.targetDigit} to reappear`;
    } else if (tracker.phase === 'armed') {
        message = `Repeat-reappear: ARMED Differs ${tracker.lastPrediction} (tip ${tip_digit})`;
    } else {
        message = `Repeat-reappear: watching tip ${tip_digit} (prev ${tracker.previousDigit})`;
    }
    journal_messages.push({
        className: 'journal__text',
        message,
    });
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

    const resultBase = (extra = {}) => ({
        prediction: -1,
        barrier: -1,
        matched: false,
        phase: tracker.phase,
        target_digit: tracker.targetDigit,
        streak: tracker.streak,
        skip_next: tracker.skipNext,
        tip_digit: tracker.previousDigit,
        tip_epoch: tracker.lastProcessedEpoch,
        journal_messages,
        ...extra,
    });

    if (!options.enabled) {
        return resultBase({ reason: 'disabled' });
    }

    // Keep armed barrier available for purchase retry.
    if (tracker.phase === 'armed' && tracker.lastPrediction >= 0) {
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Repeat-reappear: ARMED Differs ${tracker.lastPrediction} — awaiting purchase`,
            });
        }
        return {
            prediction: tracker.lastPrediction,
            barrier: tracker.lastPrediction,
            matched: true,
            phase: tracker.phase,
            target_digit: tracker.targetDigit,
            streak: tracker.streak,
            skip_next: tracker.skipNext,
            tip_digit: tracker.previousDigit,
            tip_epoch: tracker.lastProcessedEpoch,
            reason: 'armed_pending_purchase',
            journal_messages,
        };
    }

    const ticks = normalizeDigitTicks(digit_ticks);
    if (!ticks.length) {
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text',
                message: 'Repeat-reappear: waiting for ticks…',
            });
        }
        return resultBase({ reason: 'no_ticks' });
    }

    const has_epochs = ticks.some(tick => tick.epoch !== null);
    let processed_new = false;

    if (has_epochs) {
        // First live call: anchor on newest tip so historical cache repeats are ignored.
        if (tracker.lastProcessedEpoch === null || tracker.tickIndex < 0) {
            const newest = ticks[ticks.length - 1];
            tracker.previousDigit = newest.digit;
            tracker.streak = 1;
            tracker.tickIndex = Math.max(0, tracker.tickIndex);
            if (tracker.tickIndex < 0) {
                tracker.tickIndex = 0;
            }
            if (newest.epoch !== null) {
                tracker.lastProcessedEpoch = newest.epoch;
            }
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text--success',
                    message: `Repeat-reappear: live — watching from tip ${newest.digit}`,
                });
            }
            return resultBase({
                reason: 'anchored',
                tip_digit: newest.digit,
                tip_epoch: newest.epoch,
            });
        }

        for (let i = 0; i < ticks.length; i++) {
            const { digit, epoch } = ticks[i];
            if (epoch !== null && epoch === tracker.lastProcessedEpoch) {
                continue;
            }
            if (
                epoch !== null &&
                tracker.lastProcessedEpoch !== null &&
                epoch < tracker.lastProcessedEpoch
            ) {
                continue;
            }
            if (epoch !== null) {
                tracker.lastProcessedEpoch = epoch;
            }
            processRepeatReappearTick(tracker, digit, options, journal_messages);
            processed_new = true;
            if (tracker.phase === 'armed') {
                break;
            }
        }
    } else {
        // Unit tests / plain digit lists: treat list growth as new ticks.
        if (tracker.tickIndex < 0) {
            const tip = ticks[ticks.length - 1];
            tracker.previousDigit = tip.digit;
            tracker.streak = 1;
            tracker.tickIndex = 0;
            tracker.lastProcessedEpoch = tip.epoch;
            if (options.journal_enabled) {
                journal_messages.push({
                    className: 'journal__text--success',
                    message: `Repeat-reappear: live — watching from tip ${tip.digit}`,
                });
            }
            return resultBase({
                reason: 'anchored',
                tip_digit: tip.digit,
                tip_epoch: tip.epoch,
            });
        }

        const start_index = Math.max(0, tracker.tickIndex + 1);
        for (let i = start_index; i < ticks.length; i++) {
            processRepeatReappearTick(tracker, ticks[i].digit, options, journal_messages);
            processed_new = true;
            if (tracker.phase === 'armed') {
                break;
            }
        }
    }

    const tip = ticks[ticks.length - 1];
    const matched = tracker.phase === 'armed' && tracker.lastPrediction >= 0;

    // Heartbeat when nothing else was logged this evaluate (so the journal isn't silent).
    if (
        options.journal_enabled &&
        journal_messages.length === 0 &&
        (processed_new || tracker.phase !== 'watching')
    ) {
        pushStatus(tracker, tip.digit, options, journal_messages);
    } else if (options.journal_enabled && journal_messages.length === 0) {
        pushStatus(tracker, tip.digit, options, journal_messages);
    }

    return {
        prediction: matched ? tracker.lastPrediction : -1,
        barrier: matched ? tracker.lastPrediction : -1,
        matched,
        phase: tracker.phase,
        target_digit: tracker.targetDigit,
        streak: tracker.streak,
        skip_next: tracker.skipNext,
        tip_digit: tip.digit,
        tip_epoch: tip.epoch,
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
