import { evaluateDigitHedgeFilter, normalizeDigitHedgeFilter } from '../digit-hedge-filter';

const baseCounts = [11, 11, 11, 11, 4, 5, 12, 12, 12, 11];

const fromCounts = counts => {
    const digits = [];
    counts.forEach((count, digit) => {
        for (let index = 0; index < count; index += 1) digits.push(digit);
    });
    return digits;
};

const swap = (digits, left, right) => {
    const next = digits.slice();
    const held = next[left];
    next[left] = next[right];
    next[right] = held;
    return next;
};

/** 0–3 = 44%, 4 = 4%, 5 = 5%, 6–9 = 47%. Recent and previous gaps are both 0%. */
const quietDigits = () => fromCounts(baseCounts);

const has = (report, line) => expect(report.lines).toContain(line);

describe('selective Over 5 + Under 4 hedge', () => {
    it('uses the documented defaults and ignores a pattern threshold of one', () => {
        expect(normalizeDigitHedgeFilter()).toMatchObject({
            window: 100,
            recent: 20,
            maxGap: 10,
            minLow: 40,
            minHigh: 40,
            maxDigit4: 7,
            maxDigit5: 7,
            patternThreshold: 3,
        });
        expect(normalizeDigitHedgeFilter({ patternThreshold: 1 }).patternThreshold).toBe(2);
    });

    it('enters on 44% / 4% / 5% / 47% when the recent gap is not rising', () => {
        const report = evaluateDigitHedgeFilter(quietDigits(), { market: '1HZ75V' });
        expect(report.trade).toBe(true);
        expect(report.percentages).toMatchObject({ low: 44, gap: 9, high: 47, recentGap: 0, previousGap: 0 });
        expect(report.percentages.digits[4]).toBe(4);
        expect(report.percentages.digits[5]).toBe(5);
        expect(report.counts[0]).toBe(11);
        has(report, 'Market:');
        has(report, '1HZ75V');
        has(report, '0 = 11 (11%)');
        has(report, '4 = 4 (4%)');
        has(report, '5 = 5 (5%)');
        has(report, 'LOW GROUP (0–3):');
        has(report, '44%');
        has(report, 'GAP GROUP (4–5):');
        has(report, '9%');
        has(report, 'HIGH GROUP (6–9):');
        has(report, '47%');
        has(report, '4 + 5 <= 10%:');
        has(report, 'RECENT GAP TREND: DECREASING/STABLE - PASS');
        has(report, 'PATTERN CHECK: No strong 4/5 pattern detected - PASS');
        has(report, 'ALL CONDITIONS PASSED - EXECUTING OVER 5 + UNDER 4 HEDGE');
    });

    it('enters when the latest 20-tick gap is lower than the 20 ticks before it', () => {
        let digits = quietDigits();
        digits = swap(digits, 44, 60);
        digits = swap(digits, 45, 61);
        digits = swap(digits, 46, 80);
        const report = evaluateDigitHedgeFilter(digits);
        expect(report.percentages.previousGap).toBe(10);
        expect(report.percentages.recentGap).toBe(5);
        expect(report.trend).toBe('DECREASING');
        expect(report.trade).toBe(true);
        has(report, 'RECENT GAP TREND: DECREASING/STABLE - PASS');
    });

    it('does not enter when the recent gap is increasing', () => {
        let digits = quietDigits();
        digits = swap(digits, 44, 80);
        digits = swap(digits, 45, 81);
        const report = evaluateDigitHedgeFilter(digits);
        expect(report.percentages.previousGap).toBe(0);
        expect(report.percentages.recentGap).toBe(10);
        expect(report.trend).toBe('INCREASING');
        expect(report.trade).toBe(false);
        has(report, 'RECENT GAP TREND: INCREASING - NO TRADE');
        has(report, 'NO TRADE - ENTRY CONDITIONS NOT FULLY SATISFIED');
        expect(report.lines).not.toContain('ALL CONDITIONS PASSED - EXECUTING OVER 5 + UNDER 4 HEDGE');
    });

    it('does not enter when only the gap, a group, or one digit fails', () => {
        const gap = quietDigits();
        gap[53] = 4;
        gap[54] = 4;
        expect(evaluateDigitHedgeFilter(gap).trade).toBe(false);
        expect(evaluateDigitHedgeFilter(gap).percentages.gap).toBe(11);

        const low = quietDigits();
        for (let index = 0; index < 5; index += 1) low[index] = 6;
        const lowReport = evaluateDigitHedgeFilter(low);
        expect(lowReport.percentages.low).toBe(39);
        expect(lowReport.trade).toBe(false);

        const high = quietDigits();
        for (let index = 53; index <= 59; index += 1) high[index] = 0;
        high[77] = 0;
        const highReport = evaluateDigitHedgeFilter(high);
        expect(highReport.percentages.high).toBe(39);
        expect(highReport.trade).toBe(false);

        const digit4 = quietDigits();
        for (let index = 48; index <= 52; index += 1) digit4[index] = 4;
        const digit4Report = evaluateDigitHedgeFilter(digit4);
        expect(digit4Report.percentages.digits[4]).toBe(9);
        expect(digit4Report.percentages.gap).toBe(9);
        expect(digit4Report.trade).toBe(false);

        const digit5 = quietDigits();
        for (let index = 44; index <= 47; index += 1) digit5[index] = 5;
        const digit5Report = evaluateDigitHedgeFilter(digit5);
        expect(digit5Report.percentages.digits[5]).toBe(9);
        expect(digit5Report.trade).toBe(false);
    });

    it('does not enter on a repeated sequence that keeps leading into 4', () => {
        const digits = quietDigits();
        const plant = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
        plant.forEach((digit, index) => {
            digits[index] = digit;
        });
        for (let index = 44; index <= 47; index += 1) digits[index] = 0;
        digits[97] = 1;
        digits[98] = 2;
        digits[99] = 3;
        const report = evaluateDigitHedgeFilter(digits);
        expect(report.patternDigit).toBe(4);
        expect(report.trade).toBe(false);
        has(report, 'PATTERN WARNING: Repeated sequence indicates elevated probability of digit 4 - NO TRADE');
        has(report, 'NO TRADE - ENTRY CONDITIONS NOT FULLY SATISFIED');
    });

    it('does not reject a sequence that was followed by 4 only once', () => {
        const digits = quietDigits();
        [1, 2, 3, 4].forEach((digit, index) => {
            digits[index] = digit;
        });
        digits[44] = 0;
        digits[97] = 1;
        digits[98] = 2;
        digits[99] = 3;
        const report = evaluateDigitHedgeFilter(digits, { patternThreshold: 1 });
        expect(report.patternPass).toBe(true);
        expect(report.patternDigit).toBeNull();
        expect(report.trade).toBe(true);
        has(report, 'PATTERN CHECK: No strong 4/5 pattern detected - PASS');
    });

    it('does not enter before the analysis window is complete or on a tick that already traded', () => {
        const short = evaluateDigitHedgeFilter(quietDigits().slice(-30));
        expect(short.windowComplete).toBe(false);
        expect(short.trade).toBe(false);
        has(short, 'Window complete:');
        has(short, 'RECENT GAP TREND: NOT ENOUGH TICKS - NO TRADE');
        has(short, 'NO TRADE - ENTRY CONDITIONS NOT FULLY SATISFIED');
        expect(short.lines).not.toContain('ALL CONDITIONS PASSED - EXECUTING OVER 5 + UNDER 4 HEDGE');

        const duplicate = evaluateDigitHedgeFilter(quietDigits(), { alreadyEntered: true });
        expect(duplicate.trade).toBe(false);
        has(duplicate, 'NO TRADE - this tick already has a hedge');
        has(duplicate, 'NO TRADE - ENTRY CONDITIONS NOT FULLY SATISFIED');
    });
});
