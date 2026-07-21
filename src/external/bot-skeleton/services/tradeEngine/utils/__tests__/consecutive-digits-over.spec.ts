import {
    allDigitsBelowMaximum,
    applyConsecutiveDigitsOverResult,
    createConsecutiveDigitsOverState,
    evaluateConsecutiveDigitsOver,
    getRecentDigits,
} from '../consecutive-digits-over';

describe('consecutive-digits-over', () => {
    it('reads the last N digits', () => {
        expect(getRecentDigits([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([2, 3, 4, 5, 6, 7]);
    });

    it('requires every digit to be strictly below the maximum', () => {
        expect(allDigitsBelowMaximum([3, 5, 6, 0, 1, 2], 7)).toBe(true);
        expect(allDigitsBelowMaximum([3, 7, 6, 0, 1, 2], 7)).toBe(false);
        expect(allDigitsBelowMaximum([0, 1, 2, 3, 4, 5], 7)).toBe(true);
    });

    it('places Over 2 when last 6 digits are < 7 in base phase', () => {
        const state = createConsecutiveDigitsOverState();
        const result = evaluateConsecutiveDigitsOver(
            [9, 8, 3, 5, 6, 0, 1, 2],
            { journal_enabled: false },
            state
        );
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(2);
        expect(result.phase).toBe('base');
        expect(result.recent_digits).toEqual([3, 5, 6, 0, 1, 2]);
    });

    it('places Over 3 immediately after an Over 2 loss without digit analysis', () => {
        const state = createConsecutiveDigitsOverState();
        evaluateConsecutiveDigitsOver([1, 2, 3, 4, 5, 6], { journal_enabled: false }, state);
        applyConsecutiveDigitsOverResult(state, false, true);

        expect(state.phase).toBe('immediate');

        // Digits would fail the signal — still allow Over 3.
        const result = evaluateConsecutiveDigitsOver(
            [9, 9, 9, 9, 9, 9],
            { journal_enabled: false },
            state
        );
        expect(result.allowed).toBe(true);
        expect(result.prediction).toBe(3);
        expect(result.phase).toBe('immediate');
    });

    it('enters analysis after an Over 3 loss and requires the digit signal again', () => {
        const state = createConsecutiveDigitsOverState();
        state.phase = 'immediate';
        state.lastPrediction = 3;
        applyConsecutiveDigitsOverResult(state, false, true);
        expect(state.phase).toBe('analysis');

        const blocked = evaluateConsecutiveDigitsOver(
            [9, 9, 9, 9, 9, 9],
            { journal_enabled: false },
            state
        );
        expect(blocked.allowed).toBe(false);

        const allowed = evaluateConsecutiveDigitsOver(
            [1, 2, 3, 4, 5, 6],
            { journal_enabled: false },
            state
        );
        expect(allowed.allowed).toBe(true);
        expect(allowed.prediction).toBe(2);
        expect(allowed.phase).toBe('analysis');
    });

    it('returns to base after a win that clears recovery', () => {
        const state = createConsecutiveDigitsOverState();
        state.phase = 'analysis';
        applyConsecutiveDigitsOverResult(state, true, false);
        expect(state.phase).toBe('base');
    });

    it('stays in analysis after a win while still recovering', () => {
        const state = createConsecutiveDigitsOverState();
        state.phase = 'immediate';
        applyConsecutiveDigitsOverResult(state, true, true);
        expect(state.phase).toBe('analysis');
    });

    it('rejects when any of the last 6 digits is >= 7', () => {
        const result = evaluateConsecutiveDigitsOver(
            [1, 2, 3, 4, 5, 7],
            { journal_enabled: false },
            createConsecutiveDigitsOverState()
        );
        expect(result.allowed).toBe(false);
        expect(result.prediction).toBe(-1);
    });

    it('waits until enough ticks are available', () => {
        const result = evaluateConsecutiveDigitsOver(
            [5, 6, 1, 2, 3],
            { journal_enabled: true },
            createConsecutiveDigitsOverState()
        );
        expect(result.allowed).toBe(false);
        expect(result.prediction).toBe(-1);
        expect(result.journal_messages.length).toBeGreaterThan(0);
    });

    it('does not miss a qualifying window on consecutive ticks', () => {
        const ticks = [9, 8, 1, 2, 3, 4, 5, 6];
        const state = createConsecutiveDigitsOverState();
        const first = evaluateConsecutiveDigitsOver(ticks.slice(0, 5), { journal_enabled: false }, state);
        expect(first.allowed).toBe(false);

        const second = evaluateConsecutiveDigitsOver(ticks, { journal_enabled: false }, state);
        expect(second.allowed).toBe(true);
        expect(second.prediction).toBe(2);
        expect(second.recent_digits).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('does not trade when the strategy is disabled', () => {
        const result = evaluateConsecutiveDigitsOver(
            [1, 2, 3, 4, 5, 6],
            { enabled: false, journal_enabled: false },
            createConsecutiveDigitsOverState()
        );
        expect(result.allowed).toBe(false);
        expect(result.enabled).toBe(false);
        expect(result.prediction).toBe(-1);
    });
});
