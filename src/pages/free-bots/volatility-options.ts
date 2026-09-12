import type { FreeBotSymbolOption } from './types';

/** Selectable volatilities for multi-market free bots. */
export const FREE_BOT_VOLATILITY_OPTIONS: FreeBotSymbolOption[] = [
    { symbol: 'R_10', label: 'Volatility 10', group: 'standard', defaultSelected: true },
    { symbol: 'R_25', label: 'Volatility 25', group: 'standard', defaultSelected: true },
    { symbol: 'R_50', label: 'Volatility 50', group: 'standard', defaultSelected: false },
    { symbol: 'R_75', label: 'Volatility 75', group: 'standard', defaultSelected: false },
    { symbol: 'R_100', label: 'Volatility 100', group: 'standard', defaultSelected: false },
    { symbol: '1HZ10V', label: 'Volatility 10 (1s)', group: '1s', defaultSelected: false },
    { symbol: '1HZ25V', label: 'Volatility 25 (1s)', group: '1s', defaultSelected: false },
    { symbol: '1HZ50V', label: 'Volatility 50 (1s)', group: '1s', defaultSelected: true },
    { symbol: '1HZ75V', label: 'Volatility 75 (1s)', group: '1s', defaultSelected: false },
    { symbol: '1HZ100V', label: 'Volatility 100 (1s)', group: '1s', defaultSelected: false },
];
