/**
 * Triple-digit Martingale signal (from Martingale.xml):
 * When the last 3 digits are equal, Differ the 4th-from-end digit.
 *
 * Supports an explicit multi-symbol scan list (user-selected volatilities).
 */

import {
    orderSymbolsForScan,
    parseSymbolList,
    resolveScanSymbols,
    VOLATILITY_1S_SYMBOLS,
    VOLATILITY_STANDARD_SYMBOLS,
} from './sequential-digit-differs';

export {
    orderSymbolsForScan,
    parseSymbolList,
    resolveScanSymbols,
    VOLATILITY_1S_SYMBOLS,
    VOLATILITY_STANDARD_SYMBOLS,
};

export const MIN_DIGITS_REQUIRED = 4;

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

export const normalizeTripleDigitMartingaleOptions = (options = {}) => ({
    journal_enabled: toBool(options.journal_enabled, true),
    switch_symbol: toBool(options.switch_symbol, true),
    symbols: options.symbols,
    market_group: options.market_group,
});

/**
 * @param {Array<number|string|{digit?: number}>} digits oldest → newest
 */
export const detectTripleDigitMartingaleSignal = digits => {
    if (!Array.isArray(digits) || digits.length < MIN_DIGITS_REQUIRED) {
        return {
            matched: false,
            prediction: -1,
            barrier: -1,
            sequence: [],
            reason: 'insufficient_digits',
        };
    }

    const cleaned = [];
    for (let i = 0; i < digits.length; i++) {
        const item = digits[i];
        const digit = toDigit(item && typeof item === 'object' ? item.digit ?? item.quote : item);
        if (digit !== null) cleaned.push(digit);
    }

    if (cleaned.length < MIN_DIGITS_REQUIRED) {
        return {
            matched: false,
            prediction: -1,
            barrier: -1,
            sequence: cleaned.slice(-4),
            reason: 'insufficient_digits',
        };
    }

    const last4 = cleaned.slice(-4);
    const [prediction, d2, d1, d0] = last4;
    if (d2 === d1 && d1 === d0) {
        return {
            matched: true,
            prediction,
            barrier: prediction,
            sequence: last4,
            reason: 'triple_repeat',
        };
    }

    return {
        matched: false,
        prediction: -1,
        barrier: -1,
        sequence: last4,
        reason: 'no_triple_repeat',
    };
};

export const evaluateSymbolTripleDigitSignal = (symbol, digits) => {
    const signal = detectTripleDigitMartingaleSignal(digits);
    return {
        symbol,
        ...signal,
    };
};

export const pickFirstTripleDigitMatch = evaluations => {
    if (!Array.isArray(evaluations)) return null;
    for (let i = 0; i < evaluations.length; i++) {
        const item = evaluations[i];
        if (item?.matched && item.prediction >= 0) {
            return item;
        }
    }
    return null;
};

export const makeTripleDigitSignalKey = (match, tip_epoch) => {
    if (!match?.matched) return '';
    return `${match.symbol}:${match.prediction}:${(match.sequence || []).join(',')}:${tip_epoch ?? ''}`;
};

export const isTripleDigitSignalConsumed = (match, tip_epoch, consumed_key) => {
    if (!match?.matched || !consumed_key) return false;
    return makeTripleDigitSignalKey(match, tip_epoch) === consumed_key;
};
