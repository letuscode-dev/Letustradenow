import {
    SAMPLE_SIZE,
    countWinningDigits,
    evaluatePercentageFilter,
    formatPercentageFilterJournalMessage,
    getLatestDigitSample,
} from '../percentage-filter';

describe('getLatestDigitSample', () => {
    it('returns empty for empty input', () => {
        expect(getLatestDigitSample([])).toEqual([]);
        expect(getLatestDigitSample(null)).toEqual([]);
    });

    it('keeps the newest sample_size digits', () => {
        const digits = Array.from({ length: 105 }, (_, i) => i % 10);
        const sample = getLatestDigitSample(digits, 100);
        expect(sample).toHaveLength(100);
        expect(sample[0]).toBe(5); // 105 - 100 = 5 → digit 5
        expect(sample[sample.length - 1]).toBe(4); // 104 % 10
    });
});

describe('countWinningDigits', () => {
    it('counts digits 3–9 only', () => {
        expect(countWinningDigits([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(7);
        expect(countWinningDigits([0, 1, 2, 0, 1, 2])).toBe(0);
    });
});

describe('evaluatePercentageFilter', () => {
    const makeSample = (winning_count, size = SAMPLE_SIZE) => {
        const digits = [];
        for (let i = 0; i < winning_count; i++) {
            digits.push(5);
        }
        while (digits.length < size) {
            digits.push(0);
        }
        return digits;
    };

    it('allows trades when the filter is disabled', () => {
        const result = evaluatePercentageFilter([1, 2, 3], {
            enabled: false,
            threshold: 90,
        });
        expect(result.allowed).toBe(true);
        expect(result.status).toBe('disabled');
    });

    it('reports collecting until 100 ticks are available', () => {
        const digits = Array.from({ length: 63 }, () => 5);
        const result = evaluatePercentageFilter(digits, {
            enabled: true,
            threshold: 75,
            journal_enabled: true,
        });
        expect(result.allowed).toBe(false);
        expect(result.status).toBe('collecting');
        expect(result.tick_count).toBe(63);
        expect(result.message).toBe('Collecting tick history: 63/100 ticks.');
    });

    it('passes when percentage meets the threshold (spec example)', () => {
        // 76 wins of 100 → 76% ≥ 74%
        const result = evaluatePercentageFilter(makeSample(76), {
            enabled: true,
            threshold: 74,
            journal_enabled: true,
        });
        expect(result.allowed).toBe(true);
        expect(result.status).toBe('passed');
        expect(result.percentage).toBe(76);
        expect(result.winning_count).toBe(76);
        expect(result.message).toBe(
            'Over 2 condition passed: 76% ≥ 74%. Purchasing contract.'
        );
    });

    it('fails when percentage is below the threshold', () => {
        const result = evaluatePercentageFilter(makeSample(68), {
            enabled: true,
            threshold: 74,
            journal_enabled: true,
        });
        expect(result.allowed).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.percentage).toBe(68);
        expect(result.message).toBe(
            'Over 2 condition failed: 68% < 74%. Waiting for the next tick.'
        );
    });

    it('uses only the latest 100 ticks when more history is present', () => {
        const older = Array.from({ length: 50 }, () => 0); // losers
        const newer = makeSample(80); // 80% winners
        const result = evaluatePercentageFilter([...older, ...newer], {
            enabled: true,
            threshold: 75,
        });
        expect(result.tick_count).toBe(100);
        expect(result.percentage).toBe(80);
        expect(result.allowed).toBe(true);
    });
});

describe('formatPercentageFilterJournalMessage', () => {
    it('formats collecting / pass / fail messages', () => {
        expect(
            formatPercentageFilterJournalMessage({
                status: 'collecting',
                percentage: 0,
                threshold: 75,
                tick_count: 63,
                sample_size: 100,
            })
        ).toBe('Collecting tick history: 63/100 ticks.');

        expect(
            formatPercentageFilterJournalMessage({
                status: 'passed',
                percentage: 76,
                threshold: 74,
                tick_count: 100,
                sample_size: 100,
            })
        ).toBe('Over 2 condition passed: 76% ≥ 74%. Purchasing contract.');
    });
});
