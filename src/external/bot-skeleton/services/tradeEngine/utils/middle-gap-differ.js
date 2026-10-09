/**
 * Differs when the digit two ticks ago is exactly 2 above the latest digit.
 * The barrier is the digit between them.
 *
 * Digits are oldest → newest. previous_2 is two ticks ago. previous_1 is the latest.
 * 8 then 6 → 8 − 6 = 2 → differ 7.
 */

const isLastDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9;
};

export const middleGapDiffer = (previous2, previous1) => {
    const older = Number(previous2);
    const newer = Number(previous1);
    if (!isLastDigit(older) || !isLastDigit(newer) || older - newer !== 2) {
        return { trade: false, barrier: null, previous2: null, previous1: null };
    }
    return { trade: true, barrier: newer + 1, previous2: older, previous1: newer };
};

/** Uses the newest two digits of an oldest → newest list. */
export const middleGapFromNewest = digits => {
    const list = Array.isArray(digits) ? digits : [];
    if (list.length < 2) {
        return { trade: false, barrier: null, previous2: null, previous1: null, ready: false };
    }
    const report = middleGapDiffer(list[list.length - 2], list[list.length - 1]);
    return { ...report, ready: true };
};
