/**
 * Leaf Digit Differs strategies for the Strategy Voting Engine.
 * Each function: (digits, ctx) => number (0–9) or -1 (abstain).
 */

import { getDigitSuccessorPrediction } from './consecutive-digits-over';
import { getComplementDigitPrediction } from './complement-digit';
import { getDigitTransitionPrediction } from './digit-transition';
import { evaluateColdDigit, createColdDigitState } from './cold-digit';

const toDigit = value => {
    const n = Math.floor(Number(value));
    return Number.isInteger(n) && n >= 0 && n <= 9 ? n : null;
};

const clean = digits => {
    if (!Array.isArray(digits)) {
        return [];
    }
    const out = [];
    for (let i = 0; i < digits.length; i++) {
        const d = toDigit(digits[i]);
        if (d !== null) {
            out.push(d);
        }
    }
    return out;
};

const countsOf = digits => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < digits.length; i++) {
        counts[digits[i]] += 1;
    }
    return counts;
};

const argMinCount = counts => {
    let best = -1;
    let best_count = Infinity;
    for (let d = 0; d <= 9; d++) {
        if (counts[d] < best_count) {
            best_count = counts[d];
            best = d;
        } else if (counts[d] === best_count) {
            return -1; // tie → abstain
        }
    }
    return best;
};

const argMaxCount = counts => {
    let best = -1;
    let best_count = -1;
    for (let d = 0; d <= 9; d++) {
        if (counts[d] > best_count) {
            best_count = counts[d];
            best = d;
        } else if (counts[d] === best_count) {
            return -1;
        }
    }
    return best_count > 0 ? best : -1;
};

/** @type {Record<string, function>} */
export const STRATEGY_EVALUATORS = {
    digit_successor: digits => getDigitSuccessorPrediction(digits, 1),

    complement_digit: digits => getComplementDigitPrediction(digits),

    digit_transition: digits => getDigitTransitionPrediction(digits, 2),

    cold_digit: (digits, ctx) => {
        if (!ctx.state.coldDigitState) {
            ctx.state.coldDigitState = createColdDigitState();
        }
        const result = evaluateColdDigit(digits, { enabled: true, journal_enabled: false }, ctx.state.coldDigitState);
        return result && result.prediction >= 0 ? result.prediction : -1;
    },

    least_frequent: digits => {
        const seq = clean(digits);
        if (seq.length < 10) {
            return -1;
        }
        return argMinCount(countsOf(seq));
    },

    most_frequent: digits => {
        const seq = clean(digits);
        if (seq.length < 10) {
            return -1;
        }
        return argMaxCount(countsOf(seq));
    },

    streak_breaker: digits => {
        const seq = clean(digits);
        if (seq.length < 3) {
            return -1;
        }
        const a = seq[seq.length - 1];
        if (seq[seq.length - 2] === a && seq[seq.length - 3] === a) {
            return a;
        }
        return -1;
    },

    last_repeat: digits => {
        const seq = clean(digits);
        if (seq.length < 2) {
            return -1;
        }
        const a = seq[seq.length - 1];
        return seq[seq.length - 2] === a ? a : -1;
    },

    absent_digit: digits => {
        const seq = clean(digits);
        if (seq.length < 10) {
            return -1;
        }
        const counts = countsOf(seq);
        const missing = [];
        for (let d = 0; d <= 9; d++) {
            if (counts[d] === 0) {
                missing.push(d);
            }
        }
        return missing.length === 1 ? missing[0] : -1;
    },

    second_last: digits => {
        const seq = clean(digits);
        if (seq.length < 2) {
            return -1;
        }
        return seq[seq.length - 2];
    },

    parity_fade: digits => {
        const seq = clean(digits);
        if (seq.length < 8) {
            return -1;
        }
        let odd = 0;
        let even = 0;
        for (let i = 0; i < seq.length; i++) {
            if (seq[i] % 2 === 0) {
                even += 1;
            } else {
                odd += 1;
            }
        }
        const last = seq[seq.length - 1];
        if (odd === even) {
            return -1;
        }
        // Fade the dominant parity: Differs last if it matches dominant parity.
        const dominant_odd = odd > even;
        if (dominant_odd && last % 2 === 1) {
            return last;
        }
        if (!dominant_odd && last % 2 === 0) {
            return last;
        }
        return -1;
    },

    edge_fade: digits => {
        const seq = clean(digits);
        if (seq.length < 1) {
            return -1;
        }
        const last = seq[seq.length - 1];
        return last === 0 || last === 9 ? last : -1;
    },

    oscillation: digits => {
        const seq = clean(digits);
        if (seq.length < 3) {
            return -1;
        }
        const a = seq[seq.length - 3];
        const b = seq[seq.length - 2];
        const c = seq[seq.length - 1];
        if (a === c && a !== b) {
            return b;
        }
        return -1;
    },

    mid_range: digits => {
        const seq = clean(digits);
        if (seq.length < 5) {
            return -1;
        }
        const last = seq[seq.length - 1];
        return last >= 3 && last <= 6 ? last : -1;
    },

    rising_run: digits => {
        const seq = clean(digits);
        if (seq.length < 3) {
            return -1;
        }
        const a = seq[seq.length - 3];
        const b = seq[seq.length - 2];
        const c = seq[seq.length - 1];
        if (b === a + 1 && c === b + 1 && c <= 9) {
            return c;
        }
        return -1;
    },

    falling_run: digits => {
        const seq = clean(digits);
        if (seq.length < 3) {
            return -1;
        }
        const a = seq[seq.length - 3];
        const b = seq[seq.length - 2];
        const c = seq[seq.length - 1];
        if (b === a - 1 && c === b - 1 && c >= 0) {
            return c;
        }
        return -1;
    },

    unique_tail: digits => {
        const seq = clean(digits);
        if (seq.length < 6) {
            return -1;
        }
        const tail = seq.slice(-5);
        const last = tail[tail.length - 1];
        const earlier = tail.slice(0, 4);
        return earlier.indexOf(last) === -1 ? last : -1;
    },

    modal_neighbor: digits => {
        const seq = clean(digits);
        if (seq.length < 12) {
            return -1;
        }
        const mode = argMaxCount(countsOf(seq));
        if (mode < 0) {
            return -1;
        }
        const last = seq[seq.length - 1];
        if (last === mode) {
            return -1;
        }
        if (Math.abs(last - mode) === 1) {
            return mode;
        }
        return -1;
    },
};
