import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import type { AnalysisCandle, AnalysisSymbol, AnalysisTick, MarketStatus, TimeframeOption } from './analysis-types';

type RawSymbol = {
    delay_amount?: number;
    display_name?: string;
    exchange_is_open?: boolean | number;
    is_trading_suspended?: boolean | number;
    market?: string;
    market_display_name?: string;
    pip?: number;
    pip_size?: number;
    submarket?: string;
    submarket_display_name?: string;
    symbol?: string;
    underlying_symbol?: string;
};

const CANDLE_COUNT = 140;
const TICK_COUNT = 100;

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

const getPipDecimals = (pip?: number) => {
    if (!pip) return 2;
    return Math.max(0, Math.min(8, String(pip).split('.')[1]?.length ?? 0));
};

const getLastDigit = (quote: number | string, pip?: number) => {
    const numericQuote = Number(quote);
    const quoteText = Number.isFinite(numericQuote) ? numericQuote.toFixed(getPipDecimals(pip)) : String(quote);
    const digits = quoteText.replace(/\D/g, '');
    return Number(digits[digits.length - 1] ?? 0);
};

const parseTick = (raw: any, pip?: number): AnalysisTick => ({
    digit: getLastDigit(raw.quote, pip),
    epoch: Number(raw.epoch),
    quote: Number(raw.quote),
});

const isDerivedSymbol = (symbol: RawSymbol) => {
    const market = (symbol.market || '').toLowerCase();
    const marketDisplayName = (symbol.market_display_name || '').toLowerCase();
    const symbolCode = symbol.underlying_symbol || symbol.symbol || '';

    return (
        market === 'synthetic_index' ||
        marketDisplayName.includes('derived') ||
        symbolCode.startsWith('R_') ||
        symbolCode.startsWith('1HZ') ||
        symbolCode.startsWith('JD')
    );
};

const normalizeSymbol = (symbol: RawSymbol): AnalysisSymbol | null => {
    const symbolCode = symbol.underlying_symbol || symbol.symbol;
    if (!symbolCode) return null;

    return {
        displayName: symbol.display_name || symbolCode,
        exchangeIsOpen: Boolean(symbol.exchange_is_open) && !Boolean(symbol.is_trading_suspended),
        market: symbol.market || '',
        marketDisplayName: symbol.market_display_name || 'Market',
        pip: symbol.pip ?? symbol.pip_size,
        submarket: symbol.submarket || '',
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

const fetchTicks = async (symbol: string, pip?: number): Promise<AnalysisTick[]> => {
    const api = await waitForChartApi();
    const response = await api.send({
        count: TICK_COUNT,
        end: 'latest',
        style: 'ticks',
        ticks_history: symbol,
    });

    const prices = response?.history?.prices || [];
    const times = response?.history?.times || [];

    return prices
        .map((quote: number | string, index: number) => parseTick({ epoch: times[index], quote }, pip))
        .filter((tick: AnalysisTick) => Number.isFinite(tick.quote) && Number.isFinite(tick.epoch));
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

const subscribeToTicks = async (symbol: string, pip: number | undefined, onTick: (tick: AnalysisTick) => void) => {
    const api = await waitForChartApi();
    let subscriptionId = '';

    const messageSubscription = api.onMessage()?.subscribe(({ data }: { data: any }) => {
        if (data?.msg_type !== 'tick' || !data?.tick) return;

        const messageSubscriptionId = data.subscription?.id || data.tick.id;
        const isSameSubscription = subscriptionId ? messageSubscriptionId === subscriptionId : true;
        const isSameSymbol = data.tick.symbol === symbol;

        if (isSameSubscription && isSameSymbol) {
            onTick(parseTick(data.tick, pip));
        }
    });

    const response = await api.send({
        subscribe: 1,
        ticks: symbol,
    });

    subscriptionId = response?.subscription?.id || response?.tick?.id || '';

    if (response?.tick) {
        onTick(parseTick(response.tick, pip));
    }

    return () => {
        messageSubscription?.unsubscribe?.();
        if (subscriptionId) {
            api.forget(subscriptionId).catch((error: unknown) => {
                console.warn('[Analysis] Failed to forget tick subscription:', error);
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
        .filter(isDerivedSymbol)
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
    const [ticks, setTicks] = useState<AnalysisTick[]>([]);
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

    const selectedSymbolInfo = useMemo(
        () => symbols.find(symbol => symbol.symbol === selectedSymbol) || null,
        [selectedSymbol, symbols]
    );

    useEffect(() => {
        if (!selectedSymbol) return undefined;

        let cancelled = false;
        let cleanupCandles: (() => void) | undefined;
        let cleanupTicks: (() => void) | undefined;

        const startStream = async () => {
            try {
                setStatus('loading');
                setError('');
                setCandles([]);
                setTicks([]);
                setLastUpdated(null);

                const pip = selectedSymbolInfo?.pip;
                const [historicalCandles, historicalTicks] = await Promise.all([
                    fetchCandles(selectedSymbol, timeframe.granularity),
                    fetchTicks(selectedSymbol, pip),
                ]);
                if (cancelled || !mountedRef.current) return;

                setCandles(historicalCandles);
                setTicks(historicalTicks);
                setLastUpdated(Date.now());
                setStatus('live');

                cleanupCandles = await subscribeToCandles(selectedSymbol, timeframe.granularity, candle => {
                    if (!mountedRef.current) return;
                    setCandles(current => mergeCandle(current, candle));
                    setLastUpdated(Date.now());
                    setStatus('live');
                });

                cleanupTicks = await subscribeToTicks(selectedSymbol, pip, tick => {
                    if (!mountedRef.current) return;
                    setTicks(current => [...current, tick].slice(-TICK_COUNT));
                    setLastUpdated(Date.now());
                    setStatus('live');
                });

                if (cancelled) {
                    cleanupCandles?.();
                    cleanupTicks?.();
                }
            } catch (streamError) {
                if (cancelled || !mountedRef.current) return;
                setError(streamError instanceof Error ? streamError.message : 'Unable to stream market data');
                setStatus('error');
            }
        };

        startStream();

        return () => {
            cancelled = true;
            cleanupCandles?.();
            cleanupTicks?.();
        };
    }, [refreshIndex, selectedSymbol, selectedSymbolInfo?.pip, timeframe.granularity]);

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
        ticks,
        timeframe,
    };
};
