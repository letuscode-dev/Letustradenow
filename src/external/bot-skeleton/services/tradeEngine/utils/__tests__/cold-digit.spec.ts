import {
    DEFAULT_TICK_SAMPLE_SIZE,
    MAX_CONFIDENCE,
    MIN_CONFIDENCE,
    analyzeColdDigit,
    calculateColdDigitConfidence,
    consumeColdDigitSignal,
    createColdDigitState,
    evaluateColdDigit,
    getLatestDigitSample,
} from '../cold-digit';

describe('calculateColdDigitConfidence', () => {
    it('stays within 62–72', () => {
        expect(calculateColdDigitConfidence(0)).toBe(72);
        expect(calculateColdDigitConfidence(5)).toBe(67);
        expect(calculateColdDigitConfidence(10)).toBe(62);
        expect(calculateColdDigitConfidence(25)).toBe(62);
        expect(calculateColdDigitConfidence(0)).toBeLessThanOrEqual(MAX_CONFIDENCE);
        expect(calculateColdDigitConfidence(0)).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
    });
});

describe('analyzeColdDigit', () => {
    it('picks the least frequent digit', () => {
        const digits = [
            0,
            1,
            2,
            ...Array.from({ length: 16 }, () => 7),
            ...Array.from({ length: 4 }, () => [4, 5, 6, 8, 9]).flat(),
        ];
        // digit 3 never appears → cold
        const analysis = analyzeColdDigit(digits);
        expect(analysis?.coldDigit).toBe(3);
        expect(analysis?.hotDigit).toBe(7);
        expect(analysis?.confidence).toBeGreaterThanOrEqual(62);
        expect(analysis?.confidence).toBeLessThanOrEqual(72);
    });
});

describe('evaluateColdDigit', () => {
    it('requires the full user-configured sample size before trading', () => {
        const state = createColdDigitState();
        const short = evaluateColdDigit([1, 2, 3], { tick_sample_size: 100, journal_enabled: false }, state);
        expect(short.prediction).toBe(-1);
        expect(short.sample_size).toBe(3);

        // Partial (≥30) but below configured 100 → still wait for configured window
        const partial = Array.from({ length: 40 }, (_, i) => i % 9);
        const notReady = evaluateColdDigit(
            partial,
            { tick_sample_size: 100, runs_per_signal: 1, journal_enabled: false },
            state
        );
        expect(notReady.prediction).toBe(-1);
        expect(notReady.sample_size).toBe(40);
    });

    it('returns cold digit Differs when sample is ready', () => {
        const sample = getLatestDigitSample(
            Array.from({ length: 100 }, (_, i) => (i === 50 ? 3 : i % 10 === 3 ? 7 : i % 10)),
            100
        );
        // Force digit 3 to be rare: mostly 0-9 cycling but skip 3 often
        const digits = [];
        for (let i = 0; i < 99; i++) {
            digits.push(i % 9); // 0-8 only → 9 never? use 0-8 so 9 is cold
        }
        digits.push(0);
        while (digits.length < 100) digits.push(0);

        const state = createColdDigitState();
        const result = evaluateColdDigit(digits, { tick_sample_size: 100, runs_per_signal: 2, journal_enabled: false }, state);
        expect(result.prediction).toBe(9);
        expect(result.runs_remaining).toBe(2);
        expect(result.confidence).toBeGreaterThanOrEqual(62);
    });

    it('reuses sticky signal until runs are consumed', () => {
        const digits = Array.from({ length: 100 }, (_, i) => i % 9); // 0-8, never 9
        const state = createColdDigitState();
        const first = evaluateColdDigit(digits, { tick_sample_size: 100, runs_per_signal: 2, journal_enabled: false }, state);
        expect(first.prediction).toBe(9);

        const second = evaluateColdDigit(
            Array.from({ length: 100 }, () => 1), // would make different cold if recomputed
            { tick_sample_size: 100, runs_per_signal: 2, journal_enabled: false },
            state
        );
        expect(second.prediction).toBe(9);

        consumeColdDigitSignal(state);
        expect(state.runsRemaining).toBe(1);
        consumeColdDigitSignal(state);
        expect(state.activeDigit).toBeNull();
        expect(state.runsRemaining).toBe(0);
    });

    it('returns -1 when disabled', () => {
        const state = createColdDigitState();
        const result = evaluateColdDigit([1, 2, 3], { enabled: false }, state);
        expect(result.prediction).toBe(-1);
        expect(result.enabled).toBe(false);
    });

    it('recomputes from the latest configured window after the signal is consumed', () => {
        const firstDigits = Array.from({ length: 100 }, (_, i) => i % 9); // cold 9
        const state = createColdDigitState();
        const first = evaluateColdDigit(
            firstDigits,
            { tick_sample_size: 100, runs_per_signal: 1, journal_enabled: false },
            state
        );
        expect(first.prediction).toBe(9);
        expect(first.sample_size).toBe(100);
        consumeColdDigitSignal(state);

        // New full window: digit 0 never appears → cold becomes 0
        const nextDigits = Array.from({ length: 100 }, (_, i) => (i % 9) + 1); // 1-9
        const next = evaluateColdDigit(
            nextDigits,
            { tick_sample_size: 100, runs_per_signal: 1, journal_enabled: false },
            state
        );
        expect(next.prediction).toBe(0);
        expect(next.sample_size).toBe(100);
    });
});

describe('DEFAULT_TICK_SAMPLE_SIZE', () => {
    it('matches Analysis default', () => {
        expect(DEFAULT_TICK_SAMPLE_SIZE).toBe(100);
    });
});
