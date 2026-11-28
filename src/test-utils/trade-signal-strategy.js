import { applyMirrorSettlement, createMirrorRiskState } from '../external/bot-skeleton/services/tradeEngine/utils/mirror-risk';

/** Synthetic signals for exercising the shared session and execution machinery. */
export const createTestSignalStrategy = (multiMarket = false) => ({
    ...(multiMarket ? { multiMarket: true, initialCachedTicks: 3, bufferEarlySettlements: true,
        monitorAllContracts: true, prioritizeExecution: true, reportPurchaseBeforeSettlement: true,
        skipBusySignals: true, staleBufferedAnalysisOnly: true } : {}),
    createRisk: settings => createMirrorRiskState(settings),
    createDetector: () => ({ markets: new Map(), signalId: 0, tickIndex: 0 }),
    evaluate(detector, digit, _risk, symbol) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) { detector.markets.delete(symbol); return null; }
        const digits = detector.markets.get(symbol) || [];
        digits.push(digit);
        const size = multiMarket ? 4 : 3;
        if (digits.length > size) digits.shift();
        detector.markets.set(symbol, digits);
        detector.tickIndex += 1;
        if (digits.length !== size || digits[0] !== digits[2] || (multiMarket && digits[1] !== digits[3])) return null;
        return { tickIndex: multiMarket ? ++detector.signalId : detector.tickIndex,
            first: digits[0], middle: digits[1], third: digits[2], second: digits[1], fourth: digits[3], barrier: digits[1] };
    },
    reset(detector, symbol) { if (symbol === undefined) detector.markets.clear(); else detector.markets.delete(symbol); },
    recordSkip() {},
    applySettlement: applyMirrorSettlement,
    formatPattern: signal => multiMarket ? `${signal.first}-${signal.second}-${signal.third}-${signal.fourth}` : `${signal.first}-${signal.middle}-${signal.third}`,
});
