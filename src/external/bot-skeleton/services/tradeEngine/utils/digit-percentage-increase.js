import { tripleHitConcentrationStrategy } from './triple-hit-concentration';

export const INCREASE_WINDOW = 1000;

const positive = (value, label) => {
    if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) <= 0) {
        throw new Error(`${label} must be a positive number.`);
    }
    return Number(value);
};

/** Compare consecutive 1,000-tick windows without rounding percentages. */
export const digitPercentageIncreaseStrategy = {
    ...tripleHitConcentrationStrategy,
    initialHistoryTicks: INCREASE_WINDOW,
    createRisk(settings = {}) {
        const risk = tripleHitConcentrationStrategy.createRisk(settings);
        risk.minimumIncrease = positive(settings.minimumIncrease, 'Percentage increase');
        risk.stopLoss = positive(settings.stopLoss, 'Stop loss');
        if (risk.minimumIncrease > 100) throw new Error('Percentage increase cannot exceed 100 percentage points.');
        return risk;
    },
    createDetector: () => ({ digits: Array(INCREASE_WINDOW), counts: Array(10).fill(0), next: 0, filled: 0, tickIndex: 0 }),
    evaluate(detector, digit, risk) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null;
        detector.tickIndex += 1;
        if (detector.filled < INCREASE_WINDOW) {
            detector.digits[detector.next] = digit;
            detector.counts[digit] += 1;
            detector.next = (detector.next + 1) % INCREASE_WINDOW;
            detector.filled += 1;
            return null;
        }
        const previousCount = detector.counts[digit];
        const outgoingDigit = detector.digits[detector.next];
        detector.counts[outgoingDigit] -= 1;
        detector.digits[detector.next] = digit;
        detector.counts[digit] += 1;
        detector.next = (detector.next + 1) % INCREASE_WINDOW;
        const currentCount = detector.counts[digit];
        const increase = (currentCount - previousCount) * 100 / INCREASE_WINDOW;
        const entryPassed = increase > 0 && increase + 1e-10 >= risk.minimumIncrease;
        return { tickIndex: detector.tickIndex, barrier: digit, latestDigit: digit, outgoingDigit,
            previousPercentage: previousCount * 100 / INCREASE_WINDOW,
            currentPercentage: currentCount * 100 / INCREASE_WINDOW, increase,
            threshold: risk.minimumIncrease, windowSize: INCREASE_WINDOW, entryPassed, executed: false,
            reason: entryPassed ? null : increase === 0 ? 'Digit percentage did not increase' : 'Increase is below the configured threshold' };
    },
    reset(detector) {
        detector.digits = Array(INCREASE_WINDOW);
        detector.counts.fill(0);
        detector.next = 0;
        detector.filled = 0;
    },
    applySettlement(risk, settlement, round) {
        tripleHitConcentrationStrategy.applySettlement(risk, settlement, round);
        if (!risk.stopped && risk.totalProfit <= -risk.stopLoss) {
            risk.stopped = true;
            risk.stopReason = 'Stop loss reached';
        }
    },
};
