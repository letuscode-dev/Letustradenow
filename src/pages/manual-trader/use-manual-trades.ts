import { useCallback, useEffect, useRef, useState } from 'react';
import { api_base, LogTypes } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import type RootStore from '@/stores/root-store';
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
    buy?: {
        contract_id: number;
        buy_price: number | string;
        payout: number | string;
        longcode?: string;
        shortcode?: string;
        start_time?: number;
        transaction_id?: number;
    };
    proposal_open_contract?: OpenContract;
};

type OpenContract = {
    [key: string]: unknown;
    contract_id?: number;
    currency?: string;
    buy_price?: number | string;
    payout?: number | string;
    profit?: number | string;
    is_sold?: number | boolean;
    status?: string;
    exit_tick_display_value?: string;
};

type StoreContract = Parameters<RootStore['transactions']['onBotContractEvent']>[0];
type JournalExtra = Parameters<RootStore['journal']['onLogSuccess']>[0]['extra'];

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

/** Contracts bought here, and the ones whose result was already journaled (kept across tab switches). */
const manual_contract_ids = new Set<number>();
const journaled_contract_ids = new Set<number>();

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
    const { journal, summary_card, transactions } = useStore();
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

    const syncRunPanel = useCallback(
        (poc: OpenContract) => {
            const id = Number(poc.contract_id);
            if (!manual_contract_ids.has(id)) return;
            const contract = poc as unknown as StoreContract;
            transactions.onBotContractEvent(contract);
            summary_card.onBotContractEvent(contract);
            const is_sold = Boolean(poc.is_sold) || poc.status === 'won' || poc.status === 'lost';
            if (is_sold && !journaled_contract_ids.has(id)) {
                journaled_contract_ids.add(id);
                const profit = Number(poc.profit) || 0;
                journal.onLogSuccess({
                    log_type: profit > 0 ? LogTypes.PROFIT : LogTypes.LOST,
                    extra: { currency: poc.currency, profit },
                });
            }
        },
        [journal, summary_card, transactions]
    );

    const applyContract = useCallback((poc?: OpenContract) => {
        if (!poc?.contract_id) return;
        syncRunPanel(poc);
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
    }, [syncRunPanel]);

    useEffect(() => {
        if (!enabled || !api_base.api) return undefined;
        const subscription = api_base.api
            .onMessage()
            .subscribe(({ data }: { data: { msg_type?: string; proposal_open_contract?: OpenContract } }) => {
                if (data?.msg_type === 'proposal_open_contract') applyContract(data.proposal_open_contract);
            });
        const poll = window.setInterval(() => {
            const open_ids = new Set(
                trades_ref.current
                    .filter(t => t.status === 'open' && t.contract_id && Date.now() - t.time > POLL_INTERVAL_MS)
                    .map(t => t.contract_id as number)
            );
            manual_contract_ids.forEach(id => {
                if (!journaled_contract_ids.has(id)) open_ids.add(id);
            });
            open_ids.forEach(contract_id => {
                send({ proposal_open_contract: 1, contract_id })
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
                        const bought = response.buy;
                        manual_contract_ids.add(bought.contract_id);
                        journal.onLogSuccess({
                            log_type: LogTypes.PURCHASE,
                            extra: {
                                longcode: bought.longcode,
                                transaction_id: bought.transaction_id,
                            } as unknown as JournalExtra,
                        });
                        transactions.onBotContractEvent({
                            contract_id: bought.contract_id,
                            contract_type,
                            currency: params_now.currency,
                            underlying: params_now.symbol,
                            underlying_symbol: params_now.symbol,
                            buy_price: Number(bought.buy_price),
                            payout: Number(bought.payout),
                            longcode: bought.longcode,
                            shortcode: bought.shortcode,
                            date_start: bought.start_time,
                            purchase_time: bought.start_time,
                            transaction_ids: { buy: bought.transaction_id },
                            barrier: params_now.prediction === undefined ? undefined : String(params_now.prediction),
                            profit: 0,
                            is_sold: 0,
                            status: 'open',
                        } as unknown as StoreContract);
                        updateTrade(trade.key, {
                            status: 'open',
                            contract_id: response.buy.contract_id,
                            buy_price: Number(response.buy.buy_price),
                            payout: Number(response.buy.payout),
                            time: Date.now(),
                            latency_ms: Date.now() - started,
                        });
                    } catch (e) {
                        const message = errorMessage(e);
                        updateTrade(trade.key, { status: 'error', message });
                        journal.onError(`${label}: ${message}`);
                    }
                })
            );
            refill(contract_type);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [refill, updateTrade, journal, transactions]
    );

    const clearTrades = useCallback(() => {
        setTrades(current => current.filter(t => t.status === 'buying' || t.status === 'open'));
    }, []);

    return { quotes, trades, buy, clearTrades };
};
