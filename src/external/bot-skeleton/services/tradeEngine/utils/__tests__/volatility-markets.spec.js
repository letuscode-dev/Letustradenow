import { parseMirrorMarkets, resolveMirrorMarkets } from '../volatility-markets';

it('validates and deduplicates selected Volatility markets', () => {
    expect(parseMirrorMarkets('1hz10v, 1HZ75V, 1HZ10V, R_10')).toEqual(['1HZ10V', '1HZ75V', 'R_10']);
    expect(parseMirrorMarkets(null)).toBeNull();
    expect(parseMirrorMarkets('ALL')).toBeNull();
    for (const invalid of ['', '1HZ10V,', '1HZ10V, BAD']) expect(() => parseMirrorMarkets(invalid)).toThrow();
    expect(parseMirrorMarkets(Array.from({ length: 15 }, (_, i) => `1HZ${i}V`).join(','))).toHaveLength(15);
});

it('discovers every active Digit Differs Volatility market, including newly added symbols', async () => {
    const active = [
        ...Array.from({ length: 12 }, (_, i) => ({ symbol: `1HZ${i + 10}V`, is_trading_suspended: 0, exchange_is_open: 1 })),
        { underlying_symbol: 'R_100', exchange_is_open: 1 }, { symbol: 'R_100' },
        { symbol: '1HZ75V', is_trading_suspended: 1 }, { symbol: 'R_50', exchange_is_open: 0 },
        { symbol: 'frxEURUSD', exchange_is_open: 1 }, { symbol: 'BOOM1000', exchange_is_open: 1 },
    ];
    const api = { send: jest.fn().mockResolvedValue({ active_symbols: active }) };
    const markets = await resolveMirrorMarkets('ALL', api);
    expect(api.send).toHaveBeenCalledWith({ active_symbols: 'brief', contract_type: ['DIGITDIFF'] });
    expect(markets).toHaveLength(13);
    expect(markets).toContain('1HZ21V');
    expect(markets).toContain('R_100');
    expect(markets).not.toContain('R_50');
    expect(markets).not.toContain('1HZ75V');
    expect(markets).not.toContain('frxEURUSD');
});

it('does not silently fall back to a partial list when market discovery fails', async () => {
    await expect(resolveMirrorMarkets('ALL', { send: async () => ({ error: { message: 'Unavailable' } }) })).rejects.toThrow('Unavailable');
    await expect(resolveMirrorMarkets('ALL', { send: async () => ({ active_symbols: [] }) })).rejects.toThrow('No active Volatility markets');
    const api = { send: jest.fn() };
    expect(await resolveMirrorMarkets('1HZ10V, R_10', api)).toEqual(['1HZ10V', 'R_10']);
    expect(api.send).not.toHaveBeenCalled();
});
