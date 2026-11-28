export const parseMirrorMarkets = input => {
    if (input === undefined || input === null || String(input).trim().toUpperCase() === 'ALL') return null;
    const source = String(input).split(',').map(s => s.trim().toUpperCase());
    if (!source.length || source.some(symbol => !/^(?:1HZ\d+V|R_\d+)$/.test(symbol))) {
        throw new Error('Enter comma-separated Volatility market symbols, such as 1HZ10V, 1HZ75V, R_10.');
    }
    return [...new Set(source)];
};

/** Discover active Volatility symbols that offer Digit Differs for this connection. */
export const resolveMirrorMarkets = async (input, api) => {
    const selected = parseMirrorMarkets(input);
    if (selected) return selected;
    if (!api) throw new Error('Connect to Deriv before loading Volatility markets.');
    const response = await api.send({ active_symbols: 'brief', contract_type: ['DIGITDIFF'] });
    if (response?.error) throw new Error(response.error.message || 'Unable to load Volatility markets.');
    if (!Array.isArray(response?.active_symbols)) throw new Error('Invalid active-market response from Deriv.');
    const symbols = response.active_symbols.filter(item => {
        const code = item?.underlying_symbol || item?.symbol;
        const suspended = item?.is_trading_suspended === true || item?.is_trading_suspended === 1 || item?.is_trading_suspended === '1';
        const closed = item?.exchange_is_open === false || item?.exchange_is_open === 0 || item?.exchange_is_open === '0';
        return typeof code === 'string' && /^(?:1HZ\d+V|R_\d+)$/.test(code) && !suspended && !closed;
    }).map(item => item.underlying_symbol || item.symbol);
    const unique = [...new Set(symbols)];
    if (!unique.length) throw new Error('No active Volatility markets offering Digit Differs were returned by Deriv.');
    return unique;
};
