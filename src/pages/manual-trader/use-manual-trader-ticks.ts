import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisSymbol, AnalysisTick } from '../analysis/analysis-types';
import { loadSymbols, parseTick, subscribeToTicks, waitForChartApi } from '../analysis/use-analysis-market-data';
import { isDigitMarket, MAX_TICK_WINDOW } from './manual-trader-utils';

export type TickStatus = 'idle' | 'loading' | 'live' | 'error';

const fetchHistory = async (symbol: string, pip?: number): Promise<AnalysisTick[]> => {
    const api = await waitForChartApi();
    const response = await api.send({ count: MAX_TICK_WINDOW, end: 'latest', style: 'ticks', ticks_history: symbol });
    const prices = response?.history?.prices || [];
    const times = response?.history?.times || [];
    return prices
        .map((quote: number | string, i: number) => parseTick({ epoch: times[i], quote }, pip))
        .filter((tick: AnalysisTick) => Number.isFinite(tick.quote) && Number.isFinite(tick.epoch));
};

/** Digit markets plus a rolling buffer of the selected market's last ticks (history first, then live). */
export const useManualTraderTicks = () => {
    const [symbols, setSymbols] = useState<AnalysisSymbol[]>([]);
    const [symbol, setSymbol] = useState('');
    const [ticks, setTicks] = useState<AnalysisTick[]>([]);
    const [status, setStatus] = useState<TickStatus>('idle');
    const [error, setError] = useState('');
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        loadSymbols()
            .then(all => {
                if (!mounted.current) return;
                const digit_markets = all
                    .filter(s => isDigitMarket(s.symbol))
                    .sort((a, b) => {
                        const a1 = a.symbol.startsWith('1HZ') ? 0 : 1;
                        const b1 = b.symbol.startsWith('1HZ') ? 0 : 1;
                        return a1 - b1 || parseInt(a.symbol.replace(/\D/g, ''), 10) - parseInt(b.symbol.replace(/\D/g, ''), 10);
                    });
                setSymbols(digit_markets);
                setSymbol(current => current || digit_markets.find(s => s.symbol === 'R_100')?.symbol || digit_markets[0]?.symbol || '');
            })
            .catch(e => {
                if (!mounted.current) return;
                setError(e instanceof Error ? e.message : 'Unable to load markets');
                setStatus('error');
            });
        return () => {
            mounted.current = false;
        };
    }, []);

    const symbol_info = useMemo(() => symbols.find(s => s.symbol === symbol) || null, [symbol, symbols]);

    useEffect(() => {
        if (!symbol) return undefined;
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        const pip = symbol_info?.pip;

        const start = async () => {
            try {
                setStatus('loading');
                setError('');
                setTicks([]);
                const history = await fetchHistory(symbol, pip);
                if (cancelled) return;
                setTicks(history);
                setStatus('live');
                unsubscribe = await subscribeToTicks(symbol, pip, tick => {
                    if (cancelled) return;
                    setTicks(current => {
                        if (current.length && current[current.length - 1].epoch >= tick.epoch) return current;
                        return [...current, tick].slice(-MAX_TICK_WINDOW);
                    });
                    setStatus('live');
                });
                if (cancelled) unsubscribe?.();
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : 'Unable to stream ticks');
                setStatus('error');
            }
        };
        start();

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [symbol, symbol_info?.pip]);

    return { symbols, symbol, setSymbol, symbol_info, ticks, status, error };
};
