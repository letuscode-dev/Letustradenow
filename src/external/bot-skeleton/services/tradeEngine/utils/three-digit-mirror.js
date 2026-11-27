/**
 * Stateful detector for a continuous stream of already-decoded tick digits.
 * Call once per received tick, in chronological order. The caller must reset
 * the window whenever continuity cannot be established (for example after a
 * disconnect); this module cannot infer missing ticks from their values.
 */
export const createThreeDigitMirrorState = () => ({ digits: [], tickIndex: 0 });

export const resetThreeDigitMirrorWindow = state => {
    state.digits = [];
};

export const processThreeDigitMirrorTick = (state, digit) => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        resetThreeDigitMirrorWindow(state);
        return null;
    }

    state.tickIndex += 1;
    state.digits.push(digit);
    if (state.digits.length > 3) state.digits.shift();
    if (state.digits.length !== 3 || state.digits[0] !== state.digits[2]) return null;

    const [first, middle, third] = state.digits;
    return { tickIndex: state.tickIndex, first, middle, third, barrier: middle };
};
