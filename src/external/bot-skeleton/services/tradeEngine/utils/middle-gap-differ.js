/**
 * Trade when the digit two ticks ago is exactly 2 above the latest digit.
 * The Differs barrier is not that middle digit. It is the last digit of the
 * current seconds: 09:54:01 → 1, 09:54:15 → 5, 09:54:10 → 0.
 *
 * Digits are oldest → newest. previous_2 is two ticks ago. previous_1 is the latest.
 */

const isLastDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9;
};

export const middleGapDiffer = (previous2, previous1) => {
    const older = Number(previous2);
    const newer = Number(previous1);
    if (!isLastDigit(older) || !isLastDigit(newer) || older - newer !== 2) {
        return { trade: false, previous2: null, previous1: null };
    }
    return { trade: true, previous2: older, previous1: newer };
};

/** Last digit of the clock seconds. 09:54:01 → 1. 09:54:15 → 5. */
export const secondsDifferBarrier = (date = new Date()) => {
    const clock = date instanceof Date ? date : new Date(date);
    const seconds = clock.getSeconds();
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return null;
    return seconds % 10;
};

/** Uses the newest two digits of an oldest → newest list. */
export const middleGapFromNewest = digits => {
    const list = Array.isArray(digits) ? digits : [];
    if (list.length < 2) {
        return { trade: false, previous2: null, previous1: null, ready: false };
    }
    const report = middleGapDiffer(list[list.length - 2], list[list.length - 1]);
    return { ...report, ready: true };
};
