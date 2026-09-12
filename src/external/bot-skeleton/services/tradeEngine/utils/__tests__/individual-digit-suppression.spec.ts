import {
    analyzeDigitSuppression,
    classifySuppressionLevel,
    classifySuppressionTrend,
    computeWindowDigitStats,
    evaluateIndividualDigitSuppression,
    analysisContractPasses,
    normalizeIndividualDigitSuppressionOptions,
    scoreOverContracts,
    selectTradeCandidate,
    TRADE_AS_OVER_2,
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
        expect(opts.short_window).toBe(15);
        expect(opts.very_high_threshold).toBe(7);
        expect(opts.trade_as).toBe('');
    });

    it('forces Over 2/3 analysis when trade_as is OVER_2', () => {
        const opts = normalizeIndividualDigitSuppressionOptions({
            trade_as: 'OVER_2',
            enable_over_1: true,
            enable_over_2: false,
            enable_over_3: false,
        });
        expect(opts.trade_as).toBe(TRADE_AS_OVER_2);
        expect(opts.enable_over_1).toBe(false);
        expect(opts.enable_over_2).toBe(true);
        expect(opts.enable_over_3).toBe(true);
    });

    it('trade_as OVER_2 returns barrier 2 when Over 2/3 analysis passes', () => {
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
            trade_as: 'OVER_2',
            journal_enabled: false,
        });
        expect(result.contracts.every(c => c.barrier !== 1)).toBe(true);
        if (result.matched) {
            expect(result.prediction).toBe(2);
            expect(result.recommended_contract).toBe('OVER 2');
            expect(result.contract_type).toBe('DIGITOVER');
            expect(result.filter_status).toBe('driven_by_over_2_3');
            expect(result.higher_barrier_support.length).toBeGreaterThan(0);
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

    it('trades Over 2 when Over 2 analysis passes', () => {
        const { best, filter_status, higher_barrier_support } = selectTradeCandidate(
            [
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
            { trade_as: TRADE_AS_OVER_2, min_signal_score: 6, max_simultaneous_signals: 1 }
        );
        expect(best?.barrier).toBe(2);
        expect(best?.contract_type).toBe('DIGITOVER');
        expect(filter_status).toBe('driven_by_over_2_3');
        expect(higher_barrier_support).toEqual(['OVER 2']);
    });

    it('trades Over 2 when only Over 3 analysis passes', () => {
        const { best, higher_barrier_support } = selectTradeCandidate(
            [
                {
                    barrier: 2,
                    label: 'OVER 2',
                    score: 2,
                    passes: false,
                    suppressed_losing_digits: [0],
                    signal_strength: 'WEAK',
                    digit_scores: [],
                },
                { barrier: 3, label: 'OVER 3', ...base(9), suppressed_losing_digits: [0, 1, 3] },
            ],
            { trade_as: TRADE_AS_OVER_2, min_signal_score: 6, max_simultaneous_signals: 1 }
        );
        expect(best?.barrier).toBe(2);
        expect(higher_barrier_support).toEqual(['OVER 3']);
    });

    it('waits when neither Over 2 nor Over 3 passes', () => {
        const { best, filter_status } = selectTradeCandidate(
            [
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
            { trade_as: TRADE_AS_OVER_2, min_signal_score: 6, max_simultaneous_signals: 1 }
        );
        expect(best).toBeNull();
        expect(filter_status).toBe('waiting_over_2_3');
    });

    it('combines Over 2 and Over 3 when both pass', () => {
        const { best, higher_barrier_support } = selectTradeCandidate(
            [
                { barrier: 2, label: 'OVER 2', ...base(7), suppressed_losing_digits: [0, 2] },
                { barrier: 3, label: 'OVER 3', ...base(10), suppressed_losing_digits: [0, 1, 3] },
            ],
            { trade_as: TRADE_AS_OVER_2, min_signal_score: 6, max_simultaneous_signals: 1 }
        );
        expect(best?.barrier).toBe(2);
        expect(best?.score).toBe(10);
        expect(higher_barrier_support).toEqual(['OVER 2', 'OVER 3']);
        expect(best?.suppressed_losing_digits).toEqual([0, 1, 2, 3]);
    });

    it('detects analysis drivers only when they pass', () => {
        expect(analysisContractPasses({ passes: true, score: 8 })).toBe(true);
        expect(analysisContractPasses({ passes: false, score: 8 })).toBe(false);
    });
});
