import { applyMirrorSettlement, createMirrorRiskState } from './mirror-risk';

/** Each market must have its own detector so unrelated tick streams never mix. */
export const createFourDigitMirrorState = () => ({ digits: [], tickIndex: 0 });

export const resetFourDigitMirrorWindow = state => { state.digits = []; };

/** Detect consecutive A-B-A-B digits; the caller chooses the contract prediction. */
export const processFourDigitMirrorTick = (state, digit) => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        resetFourDigitMirrorWindow(state);
        return null;
    }
    state.tickIndex += 1;
    state.digits.push(digit);
    if (state.digits.length > 4) state.digits.shift();
    if (state.digits.length !== 4 || state.digits[0] !== state.digits[2] || state.digits[1] !== state.digits[3]) return null;
    const [first, second, third, fourth] = state.digits;
    return { tickIndex: state.tickIndex, first, second, third, fourth };
};

/** Keep each market's sequence independent and reject repeated or unordered ticks. */
export const createFourDigitMarketScanner = () => {
    const markets = new Map();
    const reset = symbol => {
        if (symbol === undefined) markets.clear();
        else markets.delete(symbol);
    };
    const tick = (symbol, digit, epoch) => {
        if (typeof symbol !== 'string' || !symbol || !Number.isInteger(epoch)) {
            if (typeof symbol === 'string' && symbol) reset(symbol);
            return null;
        }
        let state = markets.get(symbol);
        if (!state) {
            state = { detector: createFourDigitMirrorState(), epoch: null, digit: null };
            markets.set(symbol, state);
        }
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            reset(symbol);
            return null;
        }
        if (state.epoch !== null && epoch <= state.epoch) {
            if (epoch !== state.epoch || digit !== state.digit) reset(symbol);
            return null;
        }
        state.epoch = epoch;
        state.digit = digit;
        const pattern = processFourDigitMirrorTick(state.detector, digit);
        return pattern && { ...pattern, symbol, epoch };
    };
    return { tick, reset };
};
export const DEFAULT_MIRROR_MARKETS = ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'];

export const parseMirrorMarkets = input => {
    const source = input === undefined || input === null ? DEFAULT_MIRROR_MARKETS : String(input).split(',').map(s => s.trim().toUpperCase());
    if (!source.length || source.some(symbol => !/^(?:1HZ\d+V|R_(?:10|25|50|75|100))$/.test(symbol))) {
        throw new Error('Enter comma-separated Volatility market symbols, such as 1HZ10V, 1HZ75V, R_10.');
    }
    const symbols = [...new Set(source)];
    if (symbols.length > 10) throw new Error('Select at most 10 markets.');
    return symbols;
};

/** Use the original mirror risk rules with a separate four-tick sequence per market. */
export const fourDigitMirrorStrategy = {
    multiMarket: true,
    initialCachedTicks: 3,
    bufferEarlySettlements: true,
    monitorAllContracts: true,
    prioritizeExecution: true,
    reportPurchaseBeforeSettlement: true,
    skipBusySignals: true,
    staleBufferedAnalysisOnly: true,
    createRisk: settings => createMirrorRiskState(settings),
    createDetector: () => ({ scanner: createFourDigitMarketScanner(), signalId: 0 }),
    evaluate(detector, digit, _risk, symbol, timestamp) {
        const pattern = detector.scanner.tick(symbol, digit, timestamp);
        return pattern && { ...pattern, tickIndex: ++detector.signalId, barrier: pattern.second };
    },
    reset(detector, symbol) { detector.scanner.reset(symbol); },
    recordSkip() {},
    applySettlement: applyMirrorSettlement,
    formatPattern: pattern => `${pattern.first}-${pattern.second}-${pattern.third}-${pattern.fourth}`,
};
