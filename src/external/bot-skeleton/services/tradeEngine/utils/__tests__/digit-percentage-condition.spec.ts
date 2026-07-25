import {
    DEFAULT_WINDOW,
    countGroupDigits,
    evaluateDigitPercentageCondition,
    getDigitGroup,
} from '../digit-percentage-condition';

describe('getDigitGroup', () => {
    it('maps Over to digits 5–9 and Under to 0–4', () => {
        expect([...getDigitGroup('OVER')].sort()).toEqual([5, 6, 7, 8, 9]);
        expect([...getDigitGroup('UNDER')].sort()).toEqual([0, 1, 2, 3, 4]);
    });
});

describe('countGroupDigits', () => {
    it('counts matching Over / Under digits', () => {
        const sample = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(countGroupDigits(sample, 'OVER')).toBe(5);
        expect(countGroupDigits(sample, 'UNDER')).toBe(5);
    });
});

describe('evaluateDigitPercentageCondition', () => {
    const makeSample = (matching_count: number, direction: 'OVER' | 'UNDER', size = DEFAULT_WINDOW) => {
        const match = direction === 'OVER' ? 7 : 2;
        const other = direction === 'OVER' ? 1 : 8;
        const digits: number[] = [];
        for (let i = 0; i < matching_count; i++) {
            digits.push(match);
        }
        while (digits.length < size) {
            digits.push(other);
        }
        return digits;
    };

    it('reports collecting until the window is full', () => {
        const result = evaluateDigitPercentageCondition(Array.from({ length: 40 }, () => 7), {
            direction: 'OVER',
            threshold: 5,
            sample_size: 100,
        });
        expect(result.allowed).toBe(false);
        expect(result.status).toBe('collecting');
        expect(result.tick_count).toBe(40);
    });

    it('passes Over when matching share meets the threshold', () => {
        const result = evaluateDigitPercentageCondition(makeSample(10, 'OVER'), {
            direction: 'OVER',
            threshold: 5,
            sample_size: 100,
        });
        expect(result.allowed).toBe(true);
        expect(result.status).toBe('passed');
        expect(result.percentage).toBe(10);
        expect(result.matching_count).toBe(10);
    });

    it('fails Under when matching share is below the threshold', () => {
        const result = evaluateDigitPercentageCondition(makeSample(3, 'UNDER'), {
            direction: 'UNDER',
            threshold: 4,
            sample_size: 100,
        });
        expect(result.allowed).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.percentage).toBe(3);
    });

    it('uses only the newest window digits', () => {
        const older = Array.from({ length: 50 }, () => 1); // Under digits
        const newer = Array.from({ length: 100 }, () => 8); // Over digits
        const result = evaluateDigitPercentageCondition([...older, ...newer], {
            direction: 'OVER',
            threshold: 90,
            sample_size: 100,
        });
        expect(result.percentage).toBe(100);
        expect(result.allowed).toBe(true);
    });
});
