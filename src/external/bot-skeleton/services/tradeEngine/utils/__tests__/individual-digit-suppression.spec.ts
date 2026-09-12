import {
    analyzeDigitSuppression,
    classifySuppressionLevel,
    classifySuppressionTrend,
    computeWindowDigitStats,
    evaluateIndividualDigitSuppression,
    higherBarrierSupportsOverOne,
    normalizeIndividualDigitSuppressionOptions,
    scoreOverContracts,
    selectTradeCandidate,
} from '../individual-digit-suppression';

describe('computeWindowDigitStats', () => {
    it('computes percentages and suppressions from baseline 10%', () => {
        const sample = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const stats = computeWindowDigitStats(sample);
        expect(stats.size).toBe(10);
        expect(stats.percentages[0]).toBe(10);
        expect(stats.suppressions[0]).toBe(0);
    });

    it('marks underrepresented digits with positive suppression', () => {
        const sample = Array.from({ length: 50 }, (_, i) => (i === 0 ? 0 : 5));
        const stats = computeWindowDigitStats(sample);
        expect(stats.percentages[0]).toBe(2);
        expect(stats.suppressions[0]).toBe(8);
        expect(stats.suppressions[5]).toBeLessThan(0);
    });
});

describe('classifySuppressionLevel', () => {
    const options = normalizeIndividualDigitSuppressionOptions({});

    it('classifies HIGH at 6% suppression', () => {
        expect(classifySuppressionLevel(6, options).level).toBe('HIGH');
    });

    it('ignores overrepresentation', () => {
        expect(classifySuppressionLevel(-2, options).level).toBe('NORMAL');
        expect(classifySuppressionLevel(-2, options).positive).toBe(0);
    });
});

describe('classifySuppressionTrend', () => {
    it('detects strengthening when recent suppression is higher', () => {
        expect(classifySuppressionTrend(8, 6, 4)).toBe('SUPPRESSION STRENGTHENING');
    });

    it('detects weakening when recent suppression is lower', () => {
        expect(classifySuppressionTrend(4, 6, 8)).toBe('SUPPRESSION WEAKENING');
    });
});

describe('analyzeDigitSuppression', () => {
    it('flags persistent suppression across windows', () => {
        // Digit 0 rare across 200 ticks; all other digits appear regularly
        const digits = Array.from({ length: 200 }, (_, i) => {
            if (i === 10 || i === 80 || i === 150) return 0;
            return 1 + (i % 9);
        });
        const analysis = analyzeDigitSuppression(digits, {
            short_window: 50,
            medium_window: 100,
            long_window: 200,
            min_confirm_windows: 2,
            journal_enabled: false,
        });
        expect(analysis.ready).toBe(true);
        const row0 = analysis.digit_rows[0];
        expect(row0.avg_suppression).toBeGreaterThan(5);
        expect(row0.confirming_windows).toBeGreaterThanOrEqual(2);
        expect(analysis.primary_digit).toBe(0);
    });
});

describe('evaluateIndividualDigitSuppression', () => {
    it('returns NO SIGNAL while collecting history', () => {
        const result = evaluateIndividualDigitSuppression([1, 2, 3], {
            long_window: 200,
            journal_enabled: false,
        });
        expect(result.matched).toBe(false);
        expect(result.prediction).toBe(-1);
        expect(result.strategy_output).toBe('NO SIGNAL');
    });

    it('recommends Over contract when losing digits are suppressed', () => {
        // Make 0,1,2 rare; others uniform-ish among 4-9
        const digits = [];
        for (let i = 0; i < 200; i++) {
            if (i % 40 === 0) digits.push(0);
            else if (i % 41 === 0) digits.push(1);
            else if (i % 42 === 0) digits.push(2);
            else digits.push(4 + (i % 6));
        }
        const result = evaluateIndividualDigitSuppression(digits, {
            short_window: 50,
            medium_window: 100,
            long_window: 200,
            min_confirm_windows: 2,
            min_signal_score: 4,
            require_persistence: true,
            require_trend: false,
            enable_over_1: true,
            enable_over_2: true,
            enable_over_3: true,
            journal_enabled: true,
        });
        expect(result.analysis.ready).toBe(true);
        expect(result.primary_digit).toBeGreaterThanOrEqual(0);
        if (result.matched) {
            expect([1, 2, 3]).toContain(result.prediction);
            expect(result.recommended_contract).toMatch(/^OVER /);
            expect(result.journal_messages.length).toBeGreaterThan(0);
        }
        // Scoring path must always produce contract list
        expect(scoreOverContracts(result.analysis).length).toBe(3);
    });

    it('respects disabled Over contracts', () => {
        const digits = Array.from({ length: 200 }, (_, i) => (i % 25 === 0 ? 0 : 8));
        const result = evaluateIndividualDigitSuppression(digits, {
            enable_over_1: false,
            enable_over_2: false,
            enable_over_3: true,
            min_signal_score: 1,
            min_confirm_windows: 1,
            require_persistence: false,
            journal_enabled: false,
        });
        if (result.matched) {
            expect(result.prediction).toBe(3);
        }
    });

    it('normalizes options', () => {
        const opts = normalizeIndividualDigitSuppressionOptions({});
        expect(opts.short_window).toBe(50);
        expect(opts.very_high_threshold).toBe(7);
    });

    it('forces Over 1/2/3 analysis when trade_barrier is 1', () => {
        const opts = normalizeIndividualDigitSuppressionOptions({
            trade_barrier: 1,
            enable_over_2: false,
            enable_over_3: false,
        });
        expect(opts.trade_barrier).toBe(1);
        expect(opts.enable_over_1).toBe(true);
        expect(opts.enable_over_2).toBe(true);
        expect(opts.enable_over_3).toBe(true);
    });

    it('trade_barrier 1 only returns Over 1 when higher barriers confirm', () => {
        const digits = [];
        for (let i = 0; i < 200; i++) {
            if (i % 40 === 0) digits.push(0);
            else if (i % 41 === 0) digits.push(1);
            else if (i % 42 === 0) digits.push(2);
            else if (i % 43 === 0) digits.push(3);
            else digits.push(5 + (i % 5));
        }
        const result = evaluateIndividualDigitSuppression(digits, {
            short_window: 50,
            medium_window: 100,
            long_window: 200,
            min_confirm_windows: 2,
            min_signal_score: 4,
            require_persistence: true,
            trade_barrier: 1,
            journal_enabled: false,
        });
        expect(result.contracts.length).toBe(3);
        if (result.matched) {
            expect(result.prediction).toBe(1);
            expect(result.recommended_contract).toBe('OVER 1');
            expect(['higher_barrier_confirmed', 'no_higher_barrier_filter']).toContain(
                result.filter_status
            );
        }
    });
});

describe('selectTradeCandidate', () => {
    const base = min => ({
        score: min,
        passes: true,
        suppressed_losing_digits: [0],
        signal_strength: 'MODERATE',
        digit_scores: [],
    });

    it('allows Over 1 when Over 2 confirms', () => {
        const { best, filter_status, higher_barrier_support } = selectTradeCandidate(
            [
                { barrier: 1, label: 'OVER 1', ...base(8) },
                { barrier: 2, label: 'OVER 2', ...base(8), suppressed_losing_digits: [0, 2] },
                {
                    barrier: 3,
                    label: 'OVER 3',
                    score: 0,
                    passes: false,
                    suppressed_losing_digits: [],
                    signal_strength: 'NONE',
                    digit_scores: [],
                },
            ],
            { trade_barrier: 1, min_signal_score: 6, max_simultaneous_signals: 1 }
        );
        expect(best?.barrier).toBe(1);
        expect(filter_status).toBe('higher_barrier_confirmed');
        expect(higher_barrier_support).toContain('OVER 2');
    });

    it('filters Over 1 when Over 2/3 are meaningful but do not support', () => {
        const { best, filter_status } = selectTradeCandidate(
            [
                { barrier: 1, label: 'OVER 1', ...base(8) },
                {
                    barrier: 2,
                    label: 'OVER 2',
                    score: 2,
                    passes: false,
                    suppressed_losing_digits: [0],
                    signal_strength: 'WEAK',
                    digit_scores: [],
                },
                {
                    barrier: 3,
                    label: 'OVER 3',
                    score: 1,
                    passes: false,
                    suppressed_losing_digits: [1],
                    signal_strength: 'WEAK',
                    digit_scores: [],
                },
            ],
            { trade_barrier: 1, min_signal_score: 6, max_simultaneous_signals: 1 }
        );
        expect(best).toBeNull();
        expect(filter_status).toBe('filtered_by_over_2_3');
    });

    it('allows Over 1 without filter when higher barriers have no signal', () => {
        const { best, filter_status } = selectTradeCandidate(
            [
                { barrier: 1, label: 'OVER 1', ...base(8) },
                {
                    barrier: 2,
                    label: 'OVER 2',
                    score: 0,
                    passes: false,
                    suppressed_losing_digits: [],
                    signal_strength: 'NONE',
                    digit_scores: [],
                },
                {
                    barrier: 3,
                    label: 'OVER 3',
                    score: 0,
                    passes: false,
                    suppressed_losing_digits: [],
                    signal_strength: 'NONE',
                    digit_scores: [],
                },
            ],
            { trade_barrier: 1, min_signal_score: 6, max_simultaneous_signals: 1 }
        );
        expect(best?.barrier).toBe(1);
        expect(filter_status).toBe('no_higher_barrier_filter');
    });

    it('detects extra digit support on Over 2', () => {
        expect(
            higherBarrierSupportsOverOne(
                {
                    passes: false,
                    score: 4,
                    suppressed_losing_digits: [0, 2],
                },
                6
            )
        ).toBe(true);
    });
});
