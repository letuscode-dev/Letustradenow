import type { AnalysisTick } from './analysis-types';

export const DIGIT_TICK_OPTIONS = [100, 250, 500, 1000];
export const DEFAULT_DIGIT_TICKS = 1000;
export const DIGIT_HISTORY_SIZE = DIGIT_TICK_OPTIONS[DIGIT_TICK_OPTIONS.length - 1];
export const RECENT_DIGIT_COUNT = 10;

/** Over 4 is every digit above 4. Under 5 is every digit below 5. Together they cover 0–9. */
export const OVER_DIGIT = 4;
export const UNDER_DIGIT = 5;

export type DigitDistribution = {
    counts: number[];
    evenPercent: number;
    fallPercent: number;
    hotDigit: number | null;
    lastPrice: number | null;
    oddPercent: number;
    overPercent: number;
    percents: number[];
    recentDigits: number[];
    risePercent: number;
    sampleSize: number;
    underPercent: number;
};

const emptyDistribution = (): DigitDistribution => ({
    counts: Array(10).fill(0),
    evenPercent: 0,
    fallPercent: 0,
    hotDigit: null,
    lastPrice: null,
    oddPercent: 0,
    overPercent: 0,
    percents: Array(10).fill(0),
    recentDigits: [],
    risePercent: 0,
    sampleSize: 0,
    underPercent: 0,
});

const clampSampleSize = (sampleSize: number) => {
    const size = Math.round(Number(sampleSize));
    if (!Number.isFinite(size) || size < 1) return DEFAULT_DIGIT_TICKS;
    return Math.min(DIGIT_HISTORY_SIZE, size);
};

const pairPercent = (left: number, total: number) => {
    if (!total) return { left: 0, right: 0 };
    const leftPercent = Math.round((left / total) * 1000) / 10;
    const rightPercent = Math.round((100 - leftPercent) * 10) / 10;
    return { left: leftPercent, right: rightPercent };
};

const isDigit = (digit: number) => Number.isInteger(digit) && digit >= 0 && digit <= 9;

/**
 * Digit shares, even/odd, tick rise/fall, and Over 4 / Under 5 from the newest ticks.
 * A tied hottest digit is the one that appeared most recently.
 */
export const computeDigitDistribution = (ticks: AnalysisTick[], sampleSize = DEFAULT_DIGIT_TICKS): DigitDistribution => {
    const sample = (ticks || []).slice(-clampSampleSize(sampleSize));
    if (!sample.length) return emptyDistribution();

    const counts = Array(10).fill(0);
    sample.forEach(tick => {
        if (isDigit(tick.digit)) counts[tick.digit] += 1;
    });

    const counted = counts.reduce((sum, count) => sum + count, 0);
    const percents = counts.map(count => (counted ? Math.round((count / counted) * 1000) / 10 : 0));
    const maxCount = Math.max(...counts);
    let hotDigit: number | null = null;
    if (maxCount > 0) {
        sample.forEach(tick => {
            if (isDigit(tick.digit) && counts[tick.digit] === maxCount) hotDigit = tick.digit;
        });
    }

    const evenCount = counts.filter((_, digit) => digit % 2 === 0).reduce((sum, count) => sum + count, 0);
    const evenOdd = pairPercent(evenCount, counted);
    const overCount = counts.slice(OVER_DIGIT + 1).reduce((sum, count) => sum + count, 0);
    const overUnder = pairPercent(overCount, counted);

    let rises = 0;
    let falls = 0;
    for (let index = 1; index < sample.length; index += 1) {
        const change = sample[index].quote - sample[index - 1].quote;
        if (change > 0) rises += 1;
        else if (change < 0) falls += 1;
    }
    const riseFall = pairPercent(rises, rises + falls);
    const lastTick = sample[sample.length - 1];

    return {
        counts,
        evenPercent: evenOdd.left,
        fallPercent: riseFall.right,
        hotDigit,
        lastPrice: Number.isFinite(lastTick?.quote) ? lastTick.quote : null,
        oddPercent: evenOdd.right,
        overPercent: overUnder.left,
        percents,
        recentDigits: sample.slice(-RECENT_DIGIT_COUNT).map(tick => tick.digit).filter(isDigit),
        risePercent: riseFall.left,
        sampleSize: sample.length,
        underPercent: overUnder.right,
    };
};
