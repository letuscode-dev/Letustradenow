import { applyMirrorSettlement, createMirrorRiskState } from './mirror-risk';

export const LEAST_DIGIT_WINDOW = 1000;

/** Keep a rolling count for each market; only the outgoing digit can decrease. */
export const leastDigitDecreaseStrategy = {
    multiMarket: true,
    initialHistoryTicks: LEAST_DIGIT_WINDOW,
    bufferEarlySettlements: true,
    monitorAllContracts: true,
    prioritizeExecution: true,
    reportPurchaseBeforeSettlement: true,
    skipBusySignals: true,
    staleBufferedAnalysisOnly: true,
    createRisk: settings => createMirrorRiskState(settings),
    createDetector: () => ({ markets: new Map(), signalId: 0 }),
    evaluate(detector, digit, _risk, symbol) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            detector.markets.delete(symbol);
            return null;
        }
        let state = detector.markets.get(symbol);
        if (!state) {
            state = { digits: new Uint8Array(LEAST_DIGIT_WINDOW), counts: Array(10).fill(0), next: 0, filled: 0 };
            detector.markets.set(symbol, state);
        }
        if (state.filled < LEAST_DIGIT_WINDOW) {
            state.digits[state.next] = digit;
            state.counts[digit] += 1;
            state.next = (state.next + 1) % LEAST_DIGIT_WINDOW;
            state.filled += 1;
            return null;
        }
        const outgoing = state.digits[state.next];
        const previousCount = state.counts[outgoing];
        state.counts[outgoing] -= 1;
        state.counts[digit] += 1;
        state.digits[state.next] = digit;
        state.next = (state.next + 1) % LEAST_DIGIT_WINDOW;
        const currentCount = state.counts[outgoing];
        if (currentCount >= previousCount || state.counts.some(count => count < currentCount)) return null;
        return { tickIndex: ++detector.signalId, barrier: outgoing, previousPercentage: previousCount / 10,
            currentPercentage: currentCount / 10, decrease: (previousCount - currentCount) / 10,
            windowSize: LEAST_DIGIT_WINDOW, tiedDigits: state.counts.map((count, index) => count === currentCount ? index : -1).filter(index => index >= 0) };
    },
    reset(detector, symbol) {
        if (symbol === undefined) detector.markets.clear();
        else detector.markets.delete(symbol);
    },
    recordSkip() {},
    applySettlement: applyMirrorSettlement,
    formatPattern: signal => `Least digit ${signal.barrier}: ${signal.previousPercentage.toFixed(1)}% to ${signal.currentPercentage.toFixed(1)}%`,
};
