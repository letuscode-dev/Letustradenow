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
    exit_digit?: number;
    message?: string;
    time: number;
    latency_ms?: number;
};

type TradeParams = {
    symbol: string;
    stake: number;
    duration: number;
    prediction?: number;
    currency: string;
};

type ApiResponse = {
    error?: { code?: string; message?: string };
    proposal?: { id: string; ask_price: number | string; payout: number | string };
    buy?: { contract_id: number; buy_price: number | string; payout: number | string };
    proposal_open_contract?: OpenContract;
};

type OpenContract = {
    contract_id?: number;
    buy_price?: number | string;
    payout?: number | string;
    profit?: number | string;
    is_sold?: number | boolean;
    status?: string;
    exit_tick_display_value?: string;
};

type PooledProposal = { id: string; ask_price: number; payout: number; key: string; fetched_at: number };

const MAX_TRADES_KEPT = 50;
const POLL_INTERVAL_MS = 1000;
const PROPOSAL_TTL_MS = 20000;
const POOL_REFRESH_MS = 10000;
const RETRYABLE_CODES = ['InvalidContractProposal', 'PriceMoved', 'ContractBuyValidationError', 'InvalidProposal'];

const errorMessage = (e: unknown) => {
    const err = e as { error?: { message?: string }; message?: string } | string | undefined;
    if (typeof err === 'string') return err;
    return err?.error?.message || err?.message || 'Request failed. Please try again.';
};

const errorCode = (e: unknown) => (e as { error?: { code?: string } } | undefined)?.error?.code;

const send = (request: Record<string, unknown>): Promise<ApiResponse> => {
    const api = api_base.api as unknown as { send?: (r: Record<string, unknown>) => Promise<ApiResponse> } | undefined;
    if (!api?.send) return Promise.reject(new Error('Not connected. Please try again.'));
    return api.send(request);
};

const requestProposal = async (contract_type: string, params: TradeParams, key: string): Promise<PooledProposal> => {
    const response = await send(buildProposalRequest({ contract_type, ...params }));
    if (response?.error) throw response;
    const proposal = response?.proposal;
    if (!proposal?.id) throw new Error('No price available for this contract.');
    return {
        id: proposal.id,
        ask_price: Number(proposal.ask_price),
        payout: Number(proposal.payout),
        key,
        fetched_at: Date.now(),
    };
};

const lastDigit = (value?: string) => {
    const digit = Number(String(value ?? '').slice(-1));
    return Number.isInteger(digit) ? digit : undefined;
};

/**
 * Live quotes, a pool of pre-fetched single-use proposals per side (so a click only sends `buy`),
 * bulk purchase, and settlement tracking for manual trades.
 */
export const useManualTrades = ({
    enabled,
    contract_types,
    params,
    pool_size,
}: {
    enabled: boolean;
    contract_types: [string, string];
    params: TradeParams;
    pool_size: number;
}) => {
    const [quotes, setQuotes] = useState<Record<string, Quote>>({});
    const [trades, setTrades] = useState<ManualTrade[]>([]);
    const trades_ref = useRef<ManualTrade[]>([]);
    trades_ref.current = trades;

    const params_key = JSON.stringify(params);
    const params_ref = useRef(params);
    params_ref.current = params;
    const key_ref = useRef(params_key);
    key_ref.current = params_key;
    const pool_size_ref = useRef(pool_size);
    pool_size_ref.current = pool_size;

    const pools = useRef<Record<string, PooledProposal[]>>({});
    const inflight = useRef<Record<string, number>>({});

    const isFresh = (p: PooledProposal) => p.key === key_ref.current && Date.now() - p.fetched_at < PROPOSAL_TTL_MS;

    const refill = useCallback((contract_type: string) => {
        const key = key_ref.current;
        const pool = (pools.current[contract_type] || []).filter(isFresh);
        pools.current[contract_type] = pool;
        const missing = pool_size_ref.current - pool.length - (inflight.current[contract_type] || 0);
        for (let i = 0; i < missing; i++) {
            inflight.current[contract_type] = (inflight.current[contract_type] || 0) + 1;
            requestProposal(contract_type, params_ref.current, key)
                .then(proposal => {
                    if (proposal.key !== key_ref.current) return;
                    pools.current[contract_type] = [...(pools.current[contract_type] || []), proposal];
                    setQuotes(q => ({
                        ...q,
                        [contract_type]: { payout: proposal.payout, ask_price: proposal.ask_price },
                    }));
                })
                .catch(e => {
                    if (key === key_ref.current) setQuotes(q => ({ ...q, [contract_type]: { error: errorMessage(e) } }));
                })
                .finally(() => {
                    inflight.current[contract_type] = Math.max(0, (inflight.current[contract_type] || 1) - 1);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const contract_types_key = contract_types.join('|');

    useEffect(() => {
        pools.current = {};
        inflight.current = {};
        if (!enabled) {
            setQuotes({});
            return undefined;
        }
        setQuotes(Object.fromEntries(contract_types.map(type => [type, { loading: true }])));
        const timer = window.setTimeout(() => contract_types.forEach(refill), 250);
        const refresh = window.setInterval(() => contract_types.forEach(refill), POOL_REFRESH_MS);
        return () => {
            window.clearTimeout(timer);
            window.clearInterval(refresh);
        };
        // params_key and contract_types_key capture every field used here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, params_key, contract_types_key, refill]);

    useEffect(() => {
        if (enabled) contract_types.forEach(refill);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pool_size]);

    const updateTrade = useCallback((key: string, patch: Partial<ManualTrade>) => {
        setTrades(current => current.map(t => (t.key === key ? { ...t, ...patch } : t)));
    }, []);

    const applyContract = useCallback((poc?: OpenContract) => {
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
                    exit_digit: lastDigit(poc.exit_tick_display_value) ?? t.exit_digit,
                    status: is_sold ? (profit > 0 || poc.status === 'won' ? 'won' : 'lost') : 'open',
                };
            })
        );
    }, []);

    useEffect(() => {
        if (!enabled || !api_base.api) return undefined;
        const subscription = api_base.api
            .onMessage()
            .subscribe(({ data }: { data: { msg_type?: string; proposal_open_contract?: OpenContract } }) => {
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
            const started = Date.now();
            const params_now = params_ref.current;
            const key = key_ref.current;
            const pool = (pools.current[contract_type] || []).filter(isFresh);
            const ready = pool.splice(0, count);
            pools.current[contract_type] = pool;

            const batch: ManualTrade[] = Array.from({ length: count }, (_, i) => ({
                key: `${started}-${i}-${Math.random().toString(36).slice(2, 7)}`,
                label,
                symbol: params_now.symbol,
                stake: params_now.stake,
                status: 'buying',
                time: started,
            }));
            setTrades(current => [...batch, ...current].slice(0, MAX_TRADES_KEPT));

            const buyWith = async (proposal: PooledProposal) => {
                const response = await send({ buy: proposal.id, price: proposal.ask_price });
                if (response?.error) throw response;
                return response;
            };

            await Promise.all(
                batch.map(async (trade, i) => {
                    try {
                        let response: ApiResponse;
                        const pooled = ready[i];
                        if (pooled) {
                            try {
                                response = await buyWith(pooled);
                            } catch (e) {
                                if (!RETRYABLE_CODES.includes(errorCode(e) || '')) throw e;
                                response = await buyWith(await requestProposal(contract_type, params_now, key));
                            }
                        } else {
                            response = await buyWith(await requestProposal(contract_type, params_now, key));
                        }
                        if (!response.buy) throw new Error('Purchase was not confirmed.');
                        updateTrade(trade.key, {
                            status: 'open',
                            contract_id: response.buy.contract_id,
                            buy_price: Number(response.buy.buy_price),
                            payout: Number(response.buy.payout),
                            time: Date.now(),
                            latency_ms: Date.now() - started,
                        });
                    } catch (e) {
                        updateTrade(trade.key, { status: 'error', message: errorMessage(e) });
                    }
                })
            );
            refill(contract_type);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [refill, updateTrade]
    );

    const clearTrades = useCallback(() => {
        setTrades(current => current.filter(t => t.status === 'buying' || t.status === 'open'));
    }, []);

    return { quotes, trades, buy, clearTrades };
};
