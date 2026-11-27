import { applyMirrorSettlement, createMirrorRiskState } from './mirror-risk';

const positive = (value, name) => {
    if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) <= 0) {
        throw new Error(`${name} must be a positive number.`);
    }
    return Number(value);
};

export const tripleHitConcentrationStrategy = {
    bufferEarlySettlements: true,
    monitorAllContracts: true,
    prioritizeExecution: true,
    skipBusySignals: true,
    staleBufferedAnalysisOnly: true,
    createRisk({ stake, maxLosses, profitThreshold, recoveryMultiplier }) {
        const risk = createMirrorRiskState({ stake: positive(stake, 'Stake'), maxLosses: positive(maxLosses, 'Maximum losses'),
            profitThreshold: positive(profitThreshold, 'Profit threshold') });
        risk.recoveryMultiplier = positive(recoveryMultiplier, 'Recovery multiplier');
        risk.stats = { totalSignals: 0, executedTrades: 0, skippedSignals: 0, unconfirmedPurchases: 0,
            wins: 0, losses: 0, maxConsecutiveLosses: 0 };
        return risk;
    },
    createDetector: () => ({ digits: [], counts: Array(10).fill(0), tickIndex: 0 }),
    evaluate(detector, digit) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null;
        if (detector.digits.length === 10) detector.counts[detector.digits.shift()] -= 1;
        detector.digits.push(digit);
        detector.counts[digit] += 1;
        detector.tickIndex += 1;
        const maximum = Math.max(...detector.counts);
        const leaders = detector.counts.map((count, index) => count === maximum ? index : -1).filter(index => index >= 0);
        const dominant = leaders.length === 1 ? leaders[0] : null;
        let reason = null;
        if (detector.digits.length < 10) reason = 'Waiting for 10 completed ticks';
        else if (maximum < 3) reason = 'No digit occurs at least three times';
        else if (dominant === null) reason = 'Highest frequency is tied';
        else if (digit !== dominant) reason = 'Latest digit does not match the dominant digit';
        return { tickIndex: detector.tickIndex, digits: [...detector.digits], frequencies: [...detector.counts],
            dominantDigit: dominant, dominantCount: maximum, latestDigit: digit, barrier: dominant,
            entryPassed: reason === null, reason, executed: false };
    },
    reset(detector) { detector.digits = []; detector.counts.fill(0); },
    recordEvaluation(risk) { risk.stats.totalSignals += 1; },
    recordSkip(risk) { risk.stats.skippedSignals += 1; },
    recordPurchase(risk) { risk.stats.executedTrades += 1; },
    recordUnconfirmed(risk) { risk.stats.unconfirmedPurchases += 1; },
    statistics(risk) {
        const { wins, losses } = risk.stats;
        return { ...risk.stats, winRate: wins + losses ? wins * 100 / (wins + losses) : 0, totalProfit: risk.totalProfit };
    },
    applySettlement(risk, settlement, round) {
        applyMirrorSettlement(risk, settlement, round);
        if (settlement.result === 'lost') {
            risk.stats.losses += 1;
            risk.stats.maxConsecutiveLosses = Math.max(risk.stats.maxConsecutiveLosses, risk.inARow);
            risk.stake = round(risk.totalLoss * risk.recoveryMultiplier);
            if (!Number.isFinite(risk.stake) || risk.stake <= 0) {
                risk.stopped = true;
                risk.stopReason = 'Invalid calculated stake or profit';
            }
        } else risk.stats.wins += 1;
    },
};
