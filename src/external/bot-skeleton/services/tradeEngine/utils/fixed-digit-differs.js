import { applyMirrorSettlement, createMirrorRiskState } from './mirror-risk';

const numericInput = (value, label) => {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) {
        throw new Error(`${label} must be a valid number.`);
    }
    return Number(value);
};

/** One signal per received live tick; settlement and execution use the shared engine. */
export const fixedDigitDiffersStrategy = {
    bufferEarlySettlements: true,
    monitorAllContracts: true,
    prioritizeExecution: true,
    createRisk(settings = {}) {
        const prediction = numericInput(settings.prediction, 'Prediction');
        const stake = numericInput(settings.stake, 'Stake');
        const takeProfit = numericInput(settings.takeProfit, 'Take profit');
        const stopLoss = numericInput(settings.stopLoss, 'Stop loss');
        if (!Number.isInteger(prediction) || prediction < 0 || prediction > 9 || stake <= 0 || takeProfit <= 0 || stopLoss <= 0) {
            throw new Error('Prediction must be a digit from 0 to 9; stake, take profit, and stop loss must be positive.');
        }
        return { ...createMirrorRiskState({ stake, maxLosses: Number.MAX_SAFE_INTEGER, profitThreshold: takeProfit }),
            prediction, stopLoss };
    },
    createDetector: () => ({ tickIndex: 0 }),
    evaluate(detector, digit, risk) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null;
        detector.tickIndex += 1;
        return { tickIndex: detector.tickIndex, digit, barrier: risk.prediction };
    },
    reset() {},
    applySettlement(risk, settlement, round) {
        applyMirrorSettlement(risk, settlement, round);
        if (!risk.stopped && risk.totalProfit <= -risk.stopLoss) {
            risk.stopped = true;
            risk.stopReason = 'Stop loss reached';
        }
    },
};
