import {
    DEFAULT_LOOKBACK,
    DEFAULT_MIN_CONFIDENCE,
    DEFAULT_MIN_OCCURRENCES,
    DEFAULT_PATTERN_LENGTH,
    MAX_LOOKBACK,
    buildPatternSuccessorIndex,
    evaluatePatternProbabilityOverUnder,
    filterMarketsAfterLoss,
    getCurrentPattern,
    getMarketProbabilityFromCounts,
    getMarketsForSide,
    getTheoreticalProbability,
    scoreConfidence,
} from '../pattern-probability-over-under';

describe('filterMarketsAfterLoss', () => {
    it('removes Over 1 and Under 8 after a loss', () => {
        const filtered = filterMarketsAfterLoss(getMarketsForSide('BOTH'), true);
        expect(filtered.some(m => m.side === 'OVER' && m.barrier === 1)).toBe(false);
        expect(filtered.some(m => m.side === 'UNDER' && m.barrier === 8)).toBe(false);
        expect(filtered.some(m => m.side === 'OVER' && m.barrier === 2)).toBe(true);
        expect(filtered.some(m => m.side === 'UNDER' && m.barrier === 7)).toBe(true);
    });

    it('keeps full market list when last trade was not a loss', () => {
        const filtered = filterMarketsAfterLoss(getMarketsForSide('OVER'), false);
        expect(filtered.some(m => m.side === 'OVER' && m.barrier === 1)).toBe(true);
    });
});

describe('getTheoreticalProbability', () => {
    it('matches uniform digit theory for Over/Under markets', () => {
        expect(getTheoreticalProbability('OVER', 1)).toBe(80);
        expect(getTheoreticalProbability('OVER', 5)).toBe(40);
        expect(getTheoreticalProbability('UNDER', 8)).toBe(80);
        expect(getTheoreticalProbability('UNDER', 4)).toBe(40);
    });
});

describe('getMarketProbabilityFromCounts', () => {
    it('computes Over 3 probability from a frequency table', () => {
        const counts = [4, 6, 8, 12, 18, 21, 15, 9, 5, 2];
        const result = getMarketProbabilityFromCounts(counts, 'OVER', 3);
        expect(result.total).toBe(100);
        expect(result.matching).toBe(18 + 21 + 15 + 9 + 5 + 2);
        expect(result.probability).toBe(70);
    });

    it('computes Under 8 probability', () => {
        const counts = [4, 6, 8, 12, 18, 21, 15, 9, 5, 2];
        const result = getMarketProbabilityFromCounts(counts, 'UNDER', 8);
        expect(result.matching).toBe(4 + 6 + 8 + 12 + 18 + 21 + 15 + 9);
        expect(result.probability).toBe(93);
    });
});

describe('buildPatternSuccessorIndex / getCurrentPattern', () => {
    it('indexes successors for a repeating pattern', () => {
        const digits = [4, 7, 2, 6, 4, 7, 2, 5, 4, 7, 2, 8, 4, 7, 2, 6, 9];
        const index = buildPatternSuccessorIndex(digits, 3);
        const counts = index.get('472');
        expect(counts).toBeDefined();
        expect(counts[6]).toBe(2);
        expect(counts[5]).toBe(1);
        expect(counts[8]).toBe(1);
        expect(getCurrentPattern(digits, 3).key).toBe('269');
    });
});

describe('scoreConfidence', () => {
    it('scores higher with larger samples and edge', () => {
        const weak = scoreConfidence({
            probability: 82,
            theoretical: 80,
            occurrences: 5,
            min_occurrences: 10,
            recent_agreement: 0.4,
            consensus_ratio: 0,
        });
        const strong = scoreConfidence({
            probability: 92,
            theoretical: 80,
            occurrences: 40,
            min_occurrences: 10,
            recent_agreement: 0.9,
            consensus_ratio: 0.8,
        });
        expect(strong).toBeGreaterThan(weak);
    });
});

describe('evaluatePatternProbabilityOverUnder', () => {
    const makeBiasedSeries = () => {
        const digits = [];
        for (let i = 0; i < 40; i++) {
            digits.push(1, 2, 9);
        }
        for (let i = 0; i < 20; i++) {
            digits.push(3, 4, 5);
        }
        digits.push(1, 2);
        return digits;
    };

    it('returns collecting when too few ticks', () => {
        const result = evaluatePatternProbabilityOverUnder([1, 2], {
            lookback: 100,
            pattern_length: 2,
            min_occurrences: 10,
            journal_enabled: false,
        });
        expect(result.status).toBe('collecting');
        expect(result.should_trade).toBe(false);
        expect(result.barrier).toBe(-1);
    });

    it('skips when occurrences are below the minimum', () => {
        const digits = [1, 2, 9, 1, 2, 9, 1, 2];
        const result = evaluatePatternProbabilityOverUnder(digits, {
            lookback: 100,
            pattern_length: 2,
            min_occurrences: 50,
            min_confidence: 50,
            journal_enabled: false,
            multi_length_consensus: false,
        });
        expect(result.should_trade).toBe(false);
        expect(result.reason).toMatch(/insufficient_occurrences/);
    });

    it('selects a high-probability Over market when pattern is biased', () => {
        const digits = makeBiasedSeries();
        const result = evaluatePatternProbabilityOverUnder(digits, {
            lookback: 500,
            pattern_length: 2,
            min_occurrences: 10,
            min_confidence: 70,
            journal_enabled: false,
            multi_length_consensus: false,
            market_side: 'OVER',
        });
        expect(result.pattern).toBe('12');
        expect(result.occurrences).toBeGreaterThanOrEqual(10);
        expect(result.should_trade).toBe(true);
        expect(result.side).toBe('OVER');
        expect(result.barrier).toBeGreaterThanOrEqual(1);
        expect(result.contract_type).toBe('DIGITOVER');
        expect(result.probability).toBeGreaterThan(result.theoretical);
    });

    it('restricts Under-only mode to Under markets', () => {
        const digits = [];
        for (let i = 0; i < 40; i++) {
            digits.push(1, 2, 0);
        }
        for (let i = 0; i < 20; i++) {
            digits.push(3, 4, 5);
        }
        digits.push(1, 2);
        const result = evaluatePatternProbabilityOverUnder(digits, {
            lookback: 500,
            pattern_length: 2,
            min_occurrences: 10,
            min_confidence: 70,
            journal_enabled: false,
            multi_length_consensus: false,
            market_side: 'UNDER',
        });
        expect(result.should_trade).toBe(true);
        expect(result.side).toBe('UNDER');
        expect(result.contract_type).toBe('DIGITUNDER');
        expect(result.market_probabilities.every(m => m.side === 'UNDER')).toBe(true);
    });

    it('skips Over 1 after a loss in Over-only mode', () => {
        // Bias successors to 9 — Over 1 would normally win, but must be skipped after loss.
        const digits = [];
        for (let i = 0; i < 40; i++) {
            digits.push(1, 2, 9);
        }
        digits.push(1, 2);
        const after_loss = evaluatePatternProbabilityOverUnder(digits, {
            lookback: 500,
            pattern_length: 2,
            min_occurrences: 10,
            min_confidence: 50,
            journal_enabled: false,
            multi_length_consensus: false,
            market_side: 'OVER',
            last_was_loss: true,
            avoid_low_payout_after_loss: true,
        });
        expect(after_loss.market_probabilities.every(m => !(m.side === 'OVER' && m.barrier === 1))).toBe(
            true
        );
        expect(after_loss.skipped_low_payout).toBe(true);
        if (after_loss.should_trade) {
            expect(after_loss.barrier).not.toBe(1);
        }
    });

    it('honours defaults and lookback clamp', () => {
        expect(DEFAULT_LOOKBACK).toBe(400);
        expect(DEFAULT_PATTERN_LENGTH).toBe(2);
        expect(DEFAULT_MIN_OCCURRENCES).toBe(3);
        expect(DEFAULT_MIN_CONFIDENCE).toBe(70);
        expect(MAX_LOOKBACK).toBe(1000);
    });
});
