import { useCallback, useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { buildProposalRequest } from './manual-trader-utils';

export type Quote = { payout?: number; ask_price?: number; error?: string; loading?: boolean };

export type TradeStatus = 'buying' | 'open' | 'won' | 'lost' | 'error';

export type ManualTrade = {
    key: string;
    label: string;
    symbol: string;
    stake: number;
    status: TradeStatus;
    contract_id?: number;
    buy_price?: number;
    payout?: number;
    profit?: number;
    message?: string;
    time: number;
};

type TradeParams = {
    symbol: string;
    stake: number;
    duration: number;
    prediction?: number;
    currency: string;
};

const MAX_TRADES_KEPT = 50;
const POLL_INTERVAL_MS = 2000;

const errorMessage = (e: any) =>
    e?.error?.message || e?.message || (typeof e === 'string' ? e : 'Request failed. Please try again.');

const send = (request: Record<string, unknown>): Promise<any> => {
    const api = api_base.api as unknown as { send?: (r: Record<string, unknown>) => Promise<any> } | undefined;
    if (!api?.send) return Promise.reject(new Error('Not connected. Please try again.'));
    return api.send(request);
};

const requestQuote = async (contract_type: string, params: TradeParams) => {
    const response = await send(buildProposalRequest({ contract_type, ...params }));
    if (response?.error) throw response;
    const proposal = response?.proposal;
    if (!proposal?.id) throw new Error('No price available for this contract.');
    return proposal as { id: string; ask_price: number; payout: number };
};

/** Live payout quotes for both sides, bulk purchase, and settlement tracking for manual trades. */
export const useManualTrades = ({
    enabled,
    contract_types,
    params,
}: {
    enabled: boolean;
    contract_types: [string, string];
    params: TradeParams;
}) => {
    const [quotes, setQuotes] = useState<Record<string, Quote>>({});
    const [trades, setTrades] = useState<ManualTrade[]>([]);
    const trades_ref = useRef<ManualTrade[]>([]);
    trades_ref.current = trades;
    const params_key = JSON.stringify({ contract_types, ...params });

    const updateTrade = useCallback((key: string, patch: Partial<ManualTrade>) => {
        setTrades(current => current.map(t => (t.key === key ? { ...t, ...patch } : t)));
    }, []);

    const applyContract = useCallback((poc: any) => {
        if (!poc?.contract_id) return;
        setTrades(current =>
            current.map(t => {
                if (t.contract_id !== poc.contract_id) return t;
                const profit = Number(poc.profit);
                const is_sold = Boolean(poc.is_sold) || poc.status === 'won' || poc.status === 'lost';
                return {
                    ...t,
                    buy_price: Number(poc.buy_price ?? t.buy_price),
                    payout: Number(poc.payout ?? t.payout),
                    profit: Number.isFinite(profit) ? profit : t.profit,
                    status: is_sold ? (profit > 0 || poc.status === 'won' ? 'won' : 'lost') : 'open',
                };
            })
        );
    }, []);

    useEffect(() => {
        if (!enabled) {
            setQuotes({});
            return undefined;
        }
        let cancelled = false;
        setQuotes(Object.fromEntries(contract_types.map(type => [type, { loading: true }])));
        const timer = window.setTimeout(() => {
            contract_types.forEach(type => {
                requestQuote(type, params)
                    .then(p => {
                        if (!cancelled) setQuotes(q => ({ ...q, [type]: { payout: Number(p.payout), ask_price: Number(p.ask_price) } }));
                    })
                    .catch(e => {
                        if (!cancelled) setQuotes(q => ({ ...q, [type]: { error: errorMessage(e) } }));
                    });
            });
        }, 350);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
        // params_key captures every field of contract_types and params.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, params_key]);

    useEffect(() => {
        if (!enabled || !api_base.api) return undefined;
        const subscription = api_base.api.onMessage().subscribe(({ data }: { data: any }) => {
            if (data?.msg_type === 'proposal_open_contract') applyContract(data.proposal_open_contract);
        });
        const poll = window.setInterval(() => {
            trades_ref.current
                .filter(t => t.status === 'open' && t.contract_id && Date.now() - t.time > POLL_INTERVAL_MS)
                .forEach(t => {
                    send({ proposal_open_contract: 1, contract_id: t.contract_id })
                        .then(r => applyContract(r?.proposal_open_contract))
                        .catch(() => undefined);
                });
        }, POLL_INTERVAL_MS);
        return () => {
            subscription?.unsubscribe?.();
            window.clearInterval(poll);
        };
    }, [enabled, applyContract]);

    const buy = useCallback(
        async (contract_type: string, label: string, count: number) => {
            const batch: ManualTrade[] = Array.from({ length: count }, (_, i) => ({
                key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
                label,
                symbol: params.symbol,
                stake: params.stake,
                status: 'buying',
                time: Date.now(),
            }));
            setTrades(current => [...batch, ...current].slice(0, MAX_TRADES_KEPT));

            await Promise.all(
                batch.map(async trade => {
                    try {
                        const proposal = await requestQuote(contract_type, params);
                        const response = await send({ buy: proposal.id, price: proposal.ask_price });
                        if (response?.error) throw response;
                        updateTrade(trade.key, {
                            status: 'open',
                            contract_id: response.buy.contract_id,
                            buy_price: Number(response.buy.buy_price),
                            payout: Number(response.buy.payout),
                            time: Date.now(),
                        });
                    } catch (e) {
                        updateTrade(trade.key, { status: 'error', message: errorMessage(e) });
                    }
                })
            );
        },
        // params_key captures every field of params.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [params_key, updateTrade]
    );

    const clearTrades = useCallback(() => {
        setTrades(current => current.filter(t => t.status === 'buying' || t.status === 'open'));
    }, []);

    return { quotes, trades, buy, clearTrades };
};
