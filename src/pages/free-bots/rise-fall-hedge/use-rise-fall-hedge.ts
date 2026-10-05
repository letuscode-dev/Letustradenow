import { useCallback, useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import type { AnalysisSymbol } from '../../analysis/analysis-types';
import { loadSymbols, subscribeToTicks } from '../../analysis/use-analysis-market-data';
import { buildProposalRequest } from '../../manual-trader/manual-trader-utils';
import {
    applyContractToLeg,
    checkRiskGates,
    dayKey,
    FALL,
    finalizeHedge,
    type Hedge,
    type HedgeSettings,
    isHedgeOpen,
    isStepIndex,
    isTemporaryBlock,
    type Leg,
    type OpenContract,
    RISE,
    shouldAutoFire,
} from './hedge-utils';

type ApiResponse = {
    error?: { code?: string; message?: string };
    proposal?: { id: string; ask_price: number | string; payout: number | string; spot?: number | string };
    buy?: { contract_id: number; buy_price: number | string; payout: number | string; start_time?: number };
    sell?: { sold_for?: number | string };
    proposal_open_contract?: OpenContract;
};

type Quote = { payout?: number; ask_price?: number; error?: string };
type Proposal = { id: string; ask_price: number; payout: number };

const HISTORY_KEY = 'rise_fall_hedge_history_v1';
const MAX_HISTORY = 500;
const POLL_INTERVAL_MS = 1000;
const QUOTE_REFRESH_MS = 5000;

const send = (request: Record<string, unknown>): Promise<ApiResponse> => {
    const api = api_base.api as unknown as { send?: (r: Record<string, unknown>) => Promise<ApiResponse> } | undefined;
    if (!api?.send) return Promise.reject(new Error('Not connected. Please try again.'));
    return api.send(request);
};

const errorMessage = (e: unknown) => {
    const err = e as { error?: { message?: string }; message?: string } | string | undefined;
    if (typeof err === 'string') return err;
    return err?.error?.message || err?.message || 'Request failed.';
};

const loadHistory = (): Hedge[] => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const newLeg = (side: Leg['side'], stake: number): Leg => ({
    side,
    contract_type: side === 'RISE' ? RISE : FALL,
    status: 'PENDING',
    stake,
});

export const useRiseFallHedge = ({
    settings,
    currency,
    authorized,
}: {
    settings: HedgeSettings;
    currency: string;
    authorized: boolean;
}) => {
    const [symbols, setSymbols] = useState<AnalysisSymbol[]>([]);
    const [last_quote, setLastQuote] = useState<number | null>(null);
    const [quotes, setQuotes] = useState<Record<string, Quote>>({});
    const [hedges, setHedges] = useState<Hedge[]>(loadHistory);
    const [auto_running, setAutoRunning] = useState(false);
    const [emergency_stopped, setEmergencyStopped] = useState(false);
    const [message, setMessage] = useState('');
    const [ticks_since_last, setTicksSinceLast] = useState(0);

    const settings_ref = useRef(settings);
    settings_ref.current = settings;
    const hedges_ref = useRef(hedges);
    hedges_ref.current = hedges;
    const stopped_ref = useRef(emergency_stopped);
    stopped_ref.current = emergency_stopped;
    const auto_ref = useRef(auto_running);
    auto_ref.current = auto_running;
    const last_hedge_at = useRef<number | undefined>(undefined);
    const ticks_counter = useRef(0);
    const firing = useRef(false);

    useEffect(() => {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(hedges.slice(-MAX_HISTORY)));
    }, [hedges]);

    useEffect(() => {
        let mounted = true;
        loadSymbols()
            .then(all => {
                if (mounted) setSymbols(all.filter(isStepIndex).sort((a, b) => a.symbol.localeCompare(b.symbol)));
            })
            .catch(e => mounted && setMessage(errorMessage(e)));
        return () => {
            mounted = false;
        };
    }, []);

    const updateHedge = useCallback((id: number, fn: (h: Hedge) => Hedge) => {
        const apply = (list: Hedge[]) =>
            list.map(h => (h.id === id ? finalizeHedge(fn(h), settings_ref.current.asymmetric_threshold_ms) : h));
        hedges_ref.current = apply(hedges_ref.current);
        setHedges(apply);
    }, []);

    const requestProposal = useCallback(
        async (contract_type: string, s: HedgeSettings): Promise<Proposal> => {
            const response = await send(
                buildProposalRequest({ contract_type, symbol: s.symbol, stake: s.stake, duration: s.duration, currency })
            );
            if (response?.error) throw response;
            if (!response?.proposal?.id) throw new Error('No price available.');
            return {
                id: response.proposal.id,
                ask_price: Number(response.proposal.ask_price),
                payout: Number(response.proposal.payout),
            };
        },
        [currency]
    );

    /** Live payout display for both legs. */
    useEffect(() => {
        if (!authorized || !settings.symbol) return undefined;
        let cancelled = false;
        const refresh = () =>
            [RISE, FALL].forEach(type =>
                requestProposal(type, settings_ref.current)
                    .then(p => !cancelled && setQuotes(q => ({ ...q, [type]: { payout: p.payout, ask_price: p.ask_price } })))
                    .catch(e => !cancelled && setQuotes(q => ({ ...q, [type]: { error: errorMessage(e) } })))
            );
        refresh();
        const timer = window.setInterval(refresh, QUOTE_REFRESH_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [authorized, settings.symbol, settings.stake, settings.duration, requestProposal]);

    const markBought = (leg: Leg, response: ApiResponse, sent_at: number, proposal: Proposal): Leg => ({
        ...leg,
        status: 'OPEN',
        order_sent_at: sent_at,
        order_confirmed_at: Date.now(),
        contract_id: response.buy?.contract_id,
        purchase_time: response.buy?.start_time,
        stake: Number(response.buy?.buy_price ?? leg.stake),
        quoted_payout: Number(response.buy?.payout ?? proposal.payout),
    });

    const fire = useCallback(
        async (trigger: 'MANUAL' | 'AUTO') => {
            if (firing.current) return false;
            const s = settings_ref.current;
            const now = Date.now();
            const blocked = checkRiskGates({
                settings: s,
                hedges: hedges_ref.current,
                now,
                emergency_stopped: stopped_ref.current,
                last_hedge_at: last_hedge_at.current,
            });
            if (blocked) {
                setMessage(blocked);
                return false;
            }
            firing.current = true;
            const id = (hedges_ref.current.reduce((m, h) => Math.max(m, h.id), 0) || 0) + 1;
            const hedge: Hedge = {
                id,
                symbol: s.symbol,
                day: dayKey(now),
                created_at: now,
                duration: s.duration,
                status: 'BUYING',
                rise: newLeg('RISE', s.stake),
                fall: newLeg('FALL', s.stake),
            };
            hedges_ref.current = [...hedges_ref.current, hedge];
            setHedges(hedges_ref.current);
            last_hedge_at.current = now;
            ticks_counter.current = 0;
            setTicksSinceLast(0);
            setMessage(`HEDGE #${id} (${trigger}): pricing Rise and Fall…`);

            try {
                // Fresh prices for both legs first; if either is unavailable nothing is bought.
                const [rise_p, fall_p] = await Promise.allSettled([
                    requestProposal(RISE, s),
                    requestProposal(FALL, s),
                ]);
                if (rise_p.status === 'rejected' || fall_p.status === 'rejected') {
                    const failed = [
                        rise_p.status === 'rejected' ? `Rise: ${errorMessage(rise_p.reason)}` : '',
                        fall_p.status === 'rejected' ? `Fall: ${errorMessage(fall_p.reason)}` : '',
                    ]
                        .filter(Boolean)
                        .join(' | ');
                    updateHedge(id, h => ({
                        ...h,
                        status: 'ABORTED',
                        failure: `Price unavailable — no contracts bought. ${failed}`,
                        rise: { ...h.rise, status: 'FAILED', error: rise_p.status === 'rejected' ? errorMessage(rise_p.reason) : 'not sent' },
                        fall: { ...h.fall, status: 'FAILED', error: fall_p.status === 'rejected' ? errorMessage(fall_p.reason) : 'not sent' },
                    }));
                    setMessage(`HEDGE #${id} aborted: ${failed}`);
                    return false;
                }

                // Both buy requests go out back to back; neither waits for the other.
                const rise_sent = Date.now();
                const rise_buy = send({ buy: rise_p.value.id, price: rise_p.value.ask_price });
                const fall_sent = Date.now();
                const fall_buy = send({ buy: fall_p.value.id, price: fall_p.value.ask_price });

                const track = (side: 'rise' | 'fall', promise: Promise<ApiResponse>, sent_at: number, proposal: Proposal) =>
                    promise
                        .then(response => {
                            if (response?.error || !response?.buy) throw response?.error ? response : new Error('Purchase was not confirmed.');
                            updateHedge(id, h => ({ ...h, [side]: markBought(h[side], response, sent_at, proposal) }));
                            return true;
                        })
                        .catch(e => {
                            updateHedge(id, h => ({
                                ...h,
                                [side]: { ...h[side], status: 'FAILED', order_sent_at: sent_at, order_confirmed_at: Date.now(), error: errorMessage(e) },
                            }));
                            return false;
                        });

                const [rise_ok, fall_ok] = await Promise.all([
                    track('rise', rise_buy, rise_sent, rise_p.value),
                    track('fall', fall_buy, fall_sent, fall_p.value),
                ]);

                if (rise_ok && fall_ok) {
                    updateHedge(id, h => ({ ...h, status: 'OPEN' }));
                    setMessage(`HEDGE #${id} open: Rise and Fall bought.`);
                    return true;
                }
                if (!rise_ok && !fall_ok) {
                    updateHedge(id, h => ({ ...h, status: 'ABORTED', failure: 'Both legs failed — nothing bought.' }));
                    setMessage(`HEDGE #${id} failed: both legs rejected.`);
                    return false;
                }

                const failed_side = rise_ok ? 'fall' : 'rise';
                const live_side = rise_ok ? 'rise' : 'fall';
                const failed_label = failed_side === 'rise' ? 'Rise' : 'Fall';
                const live_label = live_side === 'rise' ? 'Rise' : 'Fall';
                const live_leg = hedges_ref.current.find(h => h.id === id)?.[live_side];
                let policy_applied = `${live_label} allowed to run (policy: let remaining leg proceed).`;
                if (s.incomplete_policy === 'CANCEL_REMAINING' && live_leg?.contract_id) {
                    try {
                        const sold = await send({ sell: live_leg.contract_id, price: 0 });
                        if (sold?.error) throw sold;
                        policy_applied = `${live_label} cancelled (sold for ${Number(sold.sell?.sold_for ?? 0).toFixed(2)}).`;
                        updateHedge(id, h => ({ ...h, [live_side]: { ...h[live_side], status: 'CANCELLED', note: policy_applied } }));
                    } catch (e) {
                        policy_applied = `${live_label} could not be cancelled (${errorMessage(e)}) — it runs to expiry.`;
                    }
                }
                const failure = `${failed_label} leg failed: ${hedges_ref.current.find(h => h.id === id)?.[failed_side].error}`;
                updateHedge(id, h => ({ ...h, status: 'OPEN', failure, policy_applied }));
                setMessage(`HEDGE #${id} INCOMPLETE — ${failure}. ${policy_applied}`);
                return false;
            } finally {
                firing.current = false;
            }
        },
        [requestProposal, updateHedge]
    );

    /** Settlement: actual Deriv contract data for every bought leg. */
    const applyContract = useCallback(
        (poc?: OpenContract) => {
            if (!poc?.contract_id) return;
            const hedge = hedges_ref.current.find(
                h => h.rise.contract_id === poc.contract_id || h.fall.contract_id === poc.contract_id
            );
            if (!hedge) return;
            const side = hedge.rise.contract_id === poc.contract_id ? 'rise' : 'fall';
            updateHedge(hedge.id, h => ({
                ...h,
                status: h.status === 'BUYING' ? h.status : 'OPEN',
                [side]: applyContractToLeg(h[side], poc),
            }));
        },
        [updateHedge]
    );

    useEffect(() => {
        if (!authorized || !api_base.api) return undefined;
        const subscription = api_base.api
            .onMessage()
            .subscribe(({ data }: { data: { msg_type?: string; proposal_open_contract?: OpenContract } }) => {
                if (data?.msg_type === 'proposal_open_contract') applyContract(data.proposal_open_contract);
            });
        const poll = window.setInterval(() => {
            hedges_ref.current.filter(isHedgeOpen).forEach(h =>
                [h.rise, h.fall]
                    .filter(l => l.contract_id && l.result === undefined)
                    .forEach(l =>
                        send({ proposal_open_contract: 1, contract_id: l.contract_id })
                            .then(r => applyContract(r?.proposal_open_contract))
                            .catch(() => undefined)
                    )
            );
        }, POLL_INTERVAL_MS);
        return () => {
            subscription?.unsubscribe?.();
            window.clearInterval(poll);
        };
    }, [authorized, applyContract]);

    /** Ticks drive the "every N ticks" automatic trigger. */
    useEffect(() => {
        if (!settings.symbol) return undefined;
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        const pip = symbols.find(s => s.symbol === settings.symbol)?.pip;
        subscribeToTicks(settings.symbol, pip, tick => {
            if (cancelled) return;
            setLastQuote(tick.quote);
            if (!auto_ref.current) return;
            ticks_counter.current += 1;
            setTicksSinceLast(ticks_counter.current);
            if (!shouldAutoFire(ticks_counter.current, settings_ref.current) || firing.current) return;
            const blocked = checkRiskGates({
                settings: settings_ref.current,
                hedges: hedges_ref.current,
                now: Date.now(),
                emergency_stopped: stopped_ref.current,
                last_hedge_at: last_hedge_at.current,
            });
            if (blocked && isTemporaryBlock(blocked)) {
                setMessage(`Waiting: ${blocked}`);
                return;
            }
            if (blocked) {
                setAutoRunning(false);
                setMessage(`Automatic mode stopped — ${blocked}`);
                return;
            }
            fire('AUTO').then(() => undefined);
        })
            .then(unsub => {
                unsubscribe = unsub;
                if (cancelled) unsub?.();
            })
            .catch(e => setMessage(errorMessage(e)));
        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [settings.symbol, symbols, fire]);

    const startAuto = useCallback(() => {
        if (stopped_ref.current) {
            setMessage('Emergency STOP is active — reset it first.');
            return;
        }
        ticks_counter.current = 0;
        setTicksSinceLast(0);
        setAutoRunning(true);
        setMessage('Automatic mode running.');
    }, []);

    const stopAuto = useCallback(() => {
        setAutoRunning(false);
        setMessage('Automatic mode stopped.');
    }, []);

    const emergencyStop = useCallback(() => {
        setEmergencyStopped(true);
        setAutoRunning(false);
        setMessage('EMERGENCY STOP — no new hedges will be placed. Open contracts run to expiry.');
    }, []);

    const resetEmergency = useCallback(() => {
        setEmergencyStopped(false);
        setMessage('Emergency STOP cleared.');
    }, []);

    const clearHistory = useCallback(() => {
        const open = hedges_ref.current.filter(isHedgeOpen);
        hedges_ref.current = open;
        setHedges(open);
    }, []);

    return {
        symbols,
        last_quote,
        quotes,
        hedges,
        auto_running,
        emergency_stopped,
        message,
        ticks_since_last,
        fire,
        startAuto,
        stopAuto,
        emergencyStop,
        resetEmergency,
        clearHistory,
    };
};
