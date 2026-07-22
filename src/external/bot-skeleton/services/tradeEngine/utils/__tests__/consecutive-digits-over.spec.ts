import {
    buildDigitSuccessorMap,
    evaluateConsecutiveDigitsOver,
    getDigitSuccessorPrediction,
    getDigitSuccessorSignal,
    getRecentDigits,
} from '../consecutive-digits-over';

describe('consecutive-digits-over (digit successor Differs)', () => {
    it('reads the last N digits', () => {
        expect(getRecentDigits([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    });

    it('builds a successor map for digits 0–9', () => {
        // 2→5 twice, 2→7 once, 0→1 once
        const { successors } = buildDigitSuccessorMap([2, 5, 2, 5, 2, 7, 0, 1]);
        expect(successors[2]).toEqual({ from: 2, to: 5, count: 2 });
        expect(successors[0]).toEqual({ from: 0, to: 1, count: 1 });
        expect(successors[5]).toEqual({ from: 5, to: 2, count: 2 });
    });

    it('places Differs on the digit that followed the current digit', () => {
        // Pattern 2→5, current ends on 2 → Differs 5
        const digits = [9, 2, 5, 8, 2, 5, 3, 2];
        const signal = getDigitSuccessorSignal(digits, 1);
        expect(signal).toEqual({ from: 2, to: 5, count: 2 });
        expect(getDigitSuccessorPrediction(digits, 1)).toBe(5);

        const result = evaluateConsecutiveDigitsOver(digits, {
            tick_window: 120,
            journal_enabled: false,
        });
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(5);
        expect(result.current_digit).toBe(2);
    });

    it('uses the most recent successor on a count tie', () => {
        // 4→1 once, then 4→8 once; last observation of 4→8 is newer → Differs 8
        const digits = [4, 1, 9, 4, 8, 4];
        const result = evaluateConsecutiveDigitsOver(digits, {
            tick_window: 20,
            journal_enabled: false,
        });
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(8);
    });

    it('respects the pattern threshold', () => {
        const digits = [2, 5, 9, 2];
        const blocked = evaluateConsecutiveDigitsOver(digits, {
            tick_window: 20,
            pattern_threshold: 2,
            journal_enabled: false,
        });
        expect(blocked.allowed).toBe(false);
        expect(blocked.prediction).toBe(-1);

        const digits2 = [2, 5, 9, 2, 5, 1, 2];
        const allowed = evaluateConsecutiveDigitsOver(digits2, {
            tick_window: 20,
            pattern_threshold: 2,
            journal_enabled: false,
        });
        expect(allowed.allowed).toBe(true);
        expect(allowed.prediction).toBe(5);
    });

    it('waits until at least two ticks are available', () => {
        const result = evaluateConsecutiveDigitsOver([5], {
            tick_window: 120,
            journal_enabled: true,
        });
        expect(result.allowed).toBe(false);
        expect(result.prediction).toBe(-1);
        expect(result.journal_messages.length).toBeGreaterThan(0);
    });

    it('does not trade when the current digit has no observed successor', () => {
        // 7 never appears as a "from" before the final tick
        const result = evaluateConsecutiveDigitsOver([1, 2, 3, 7], {
            tick_window: 20,
            journal_enabled: false,
        });
        expect(result.allowed).toBe(false);
        expect(result.prediction).toBe(-1);
        expect(result.current_digit).toBe(7);
    });

    it('does not trade when the strategy is disabled', () => {
        const result = evaluateConsecutiveDigitsOver([2, 5, 2], {
            enabled: false,
            journal_enabled: false,
        });
        expect(result.allowed).toBe(false);
        expect(result.enabled).toBe(false);
        expect(result.prediction).toBe(-1);
    });

    it('limits analysis to the configured tick window', () => {
        // Older 1→9 pattern is outside a window of 4; inside window: 9,3,4,3 → 3→4
        const digits = [1, 9, 1, 9, 3, 4, 3];
        const result = evaluateConsecutiveDigitsOver(digits, {
            tick_window: 4,
            journal_enabled: false,
        });
        expect(result.recent_digits).toEqual([9, 3, 4, 3]);
        expect(result.current_digit).toBe(3);
        expect(result.prediction).toBe(4);
    });
});
