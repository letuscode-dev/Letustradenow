import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import type { AnalysisCandle, AnalysisSymbol, MarketStatus, TimeframeOption } from './analysis-types';

type RawSymbol = {
    delay_amount?: number;
    display_name?: string;
    exchange_is_open?: boolean | number;
    is_trading_suspended?: boolean | number;
    market_display_name?: string;
    pip?: number;
    pip_size?: number;
    submarket_display_name?: string;
    symbol?: string;
    underlying_symbol?: string;
};

const CANDLE_COUNT = 140;

export const TIMEFRAME_OPTIONS: TimeframeOption[] = [
    { granularity: 60, horizon: '1-3 candles', label: '1m' },
    { granularity: 300, horizon: '1-3 candles', label: '5m' },
    { granularity: 900, horizon: '1-2 candles', label: '15m' },
];

const parseCandle = (raw: any): AnalysisCandle => ({
    close: Number(raw.close),
    epoch: Number(raw.open_time ?? raw.epoch),
    high: Number(raw.high),
    low: Number(raw.low),
    open: Number(raw.open),
});

const normalizeSymbol = (symbol: RawSymbol): AnalysisSymbol | null => {
    const symbolCode = symbol.underlying_symbol || symbol.symbol;
    if (!symbolCode) return null;

    return {
        displayName: symbol.display_name || symbolCode,
        exchangeIsOpen: Boolean(symbol.exchange_is_open) && !Boolean(symbol.is_trading_suspended),
        marketDisplayName: symbol.market_display_name || 'Market',
        pip: symbol.pip ?? symbol.pip_size,
        submarketDisplayName: symbol.submarket_display_name || '',
        symbol: symbolCode,
    };
};

const waitForChartApi = async () => {
    if (!chart_api.api) {
        await chart_api.init();
    }

    const api = chart_api.api as any;
    if (!api?.connection || api.connection.readyState === WebSocket.OPEN) {
        return api;
    }

    if (api.connection.readyState > WebSocket.OPEN) {
        await chart_api.init(true);
        return chart_api.api as any;
    }

    await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            api.connection.removeEventListener('open', onOpen);
            reject(new Error('Market data connection timeout'));
        }, 10000);

        const onOpen = () => {
            window.clearTimeout(timeout);
            resolve();
        };

        api.connection.addEventListener('open', onOpen, { once: true });
    });

    return chart_api.api as any;
};

const mergeCandle = (candles: AnalysisCandle[], candle: AnalysisCandle) => {
    if (!Number.isFinite(candle.close) || !Number.isFinite(candle.epoch)) return candles;

    const last = candles[candles.length - 1];
    if (!last) return [candle];
    if (last.epoch === candle.epoch) return [...candles.slice(0, -1), candle];
    if (last.epoch > candle.epoch) return candles;
    return [...candles, candle].slice(-CANDLE_COUNT);
};

const fetchCandles = async (symbol: string, granularity: number): Promise<AnalysisCandle[]> => {
    const api = await waitForChartApi();
    const response = await api.send({
        adjust_start_time: 1,
        count: CANDLE_COUNT,
        end: 'latest',
        granularity,
        style: 'candles',
        ticks_history: symbol,
    });

    return (response?.candles || []).map(parseCandle).filter((candle: AnalysisCandle) => Number.isFinite(candle.close));
};

const subscribeToCandles = async (
    symbol: string,
    granularity: number,
    onCandle: (candle: AnalysisCandle) => void
) => {
    const api = await waitForChartApi();
    let subscriptionId = '';

    const messageSubscription = api.onMessage()?.subscribe(({ data }: { data: any }) => {
        if (data?.msg_type !== 'ohlc' || !data?.ohlc) return;

        const messageSubscriptionId = data.subscription?.id || data.ohlc.id;
        const isSameSubscription = subscriptionId ? messageSubscriptionId === subscriptionId : true;
        const isSameSymbol = data.ohlc.symbol === symbol && Number(data.ohlc.granularity) === granularity;

        if (isSameSubscription && isSameSymbol) {
            onCandle(parseCandle(data.ohlc));
        }
    });

    const response = await api.send({
        adjust_start_time: 1,
        count: 1,
        end: 'latest',
        granularity,
        style: 'candles',
        subscribe: 1,
        ticks_history: symbol,
    });

    subscriptionId = response?.subscription?.id || '';

    if (response?.candles?.[0]) {
        onCandle(parseCandle(response.candles[0]));
    }

    return () => {
        messageSubscription?.unsubscribe?.();
        if (subscriptionId) {
            api.forget(subscriptionId).catch((error: unknown) => {
                console.warn('[Analysis] Failed to forget candle subscription:', error);
            });
        }
    };
};

const loadSymbols = async (): Promise<AnalysisSymbol[]> => {
    let rawSymbols = api_base.active_symbols;

    if (!rawSymbols?.length) {
        await (api_base.active_symbols_promise || api_base.getActiveSymbols());
        rawSymbols = api_base.active_symbols;
    }

    if (!rawSymbols?.length) {
        rawSymbols = (await api_base.getActiveSymbols()) || [];
    }

    return rawSymbols
        .map(normalizeSymbol)
        .filter((symbol): symbol is AnalysisSymbol => Boolean(symbol))
        .sort((left, right) => {
            if (left.exchangeIsOpen !== right.exchangeIsOpen) return left.exchangeIsOpen ? -1 : 1;
            return left.displayName.localeCompare(right.displayName);
        });
};

export const useAnalysisMarketData = () => {
    const [candles, setCandles] = useState<AnalysisCandle[]>([]);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [status, setStatus] = useState<MarketStatus>('idle');
    const [symbols, setSymbols] = useState<AnalysisSymbol[]>([]);
    const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAME_OPTIONS[0]);
    const [refreshIndex, setRefreshIndex] = useState(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const initSymbols = async () => {
            try {
                const nextSymbols = await loadSymbols();
                if (cancelled || !mountedRef.current) return;

                setSymbols(nextSymbols);

                if (!selectedSymbol && nextSymbols.length) {
                    const preferredSymbol =
                        nextSymbols.find(symbol => symbol.exchangeIsOpen && symbol.symbol === 'R_100') ||
                        nextSymbols.find(symbol => symbol.exchangeIsOpen) ||
                        nextSymbols[0];

                    setSelectedSymbol(preferredSymbol.symbol);
                }
            } catch (loadError) {
                if (cancelled || !mountedRef.current) return;
                setError(loadError instanceof Error ? loadError.message : 'Unable to load markets');
                setStatus('error');
            }
        };

        initSymbols();

        return () => {
            cancelled = true;
        };
    }, [selectedSymbol]);

    useEffect(() => {
        if (!selectedSymbol) return undefined;

        let cancelled = false;
        let cleanup: (() => void) | undefined;

        const startStream = async () => {
            try {
                setStatus('loading');
                setError('');

                const historicalCandles = await fetchCandles(selectedSymbol, timeframe.granularity);
                if (cancelled || !mountedRef.current) return;

                setCandles(historicalCandles);
                setLastUpdated(Date.now());
                setStatus('live');

                cleanup = await subscribeToCandles(selectedSymbol, timeframe.granularity, candle => {
                    if (!mountedRef.current) return;
                    setCandles(current => mergeCandle(current, candle));
                    setLastUpdated(Date.now());
                    setStatus('live');
                });

                if (cancelled) cleanup?.();
            } catch (streamError) {
                if (cancelled || !mountedRef.current) return;
                setError(streamError instanceof Error ? streamError.message : 'Unable to stream market data');
                setStatus('error');
            }
        };

        startStream();

        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, [refreshIndex, selectedSymbol, timeframe.granularity]);

    const selectedSymbolInfo = useMemo(
        () => symbols.find(symbol => symbol.symbol === selectedSymbol) || null,
        [selectedSymbol, symbols]
    );

    const refresh = useCallback(() => {
        setRefreshIndex(index => index + 1);
    }, []);

    return {
        candles,
        error,
        lastUpdated,
        refresh,
        selectedSymbol,
        selectedSymbolInfo,
        setSelectedSymbol,
        setTimeframe,
        status,
        symbols,
        timeframe,
    };
};
