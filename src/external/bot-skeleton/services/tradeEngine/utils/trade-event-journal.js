const value = item => item === null || item === undefined || item === '' ? 'unavailable' : String(item);
const amount = (item, currency) => `${value(item)}${currency ? ` ${currency}` : ''}`;
const time = epoch => {
    if (epoch === null || epoch === undefined || epoch === '' || !Number.isFinite(Number(epoch))) return 'unavailable';
    const date = new Date(Number(epoch) * 1000);
    return Number.isNaN(date.getTime()) ? 'unavailable' : date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
};

const statistics = stats => stats ? ` | Trades: ${stats.executedTrades}; wins: ${stats.wins}; losses: ${stats.losses}; win rate: ${Number(stats.winRate || 0).toFixed(1)}%; signals: ${stats.totalSignals}; skipped: ${stats.skippedSignals}; unconfirmed: ${stats.unconfirmedPurchases}; max consecutive losses: ${stats.maxConsecutiveLosses}` : '';

/** Format the structured audit events without implying that an unconfirmed buy succeeded. */
export const formatTradeEventJournal = (event, currency, prefix) => {
    const stats = statistics(event.statistics);
    switch (event.type) {
        case 'purchase':
            return { message: `${prefix} | CONTRACT BOUGHT — confirmed by Deriv | Contract ID: ${value(event.contractId)} | Digit Differs barrier: ${value(event.barrier)} | Stake: ${amount(event.stake, currency)} | Duration: ${value(event.duration)} tick | Entry time: ${time(event.entryTimestamp)} | See Transactions for the contract.${stats}`, className: 'journal__text--success' };
        case 'settlement': {
            const result = event.result === 'won' ? 'WON' : 'LOST';
            return { message: `${prefix} | CONTRACT ${result} — ID: ${value(event.contract_id)} | Barrier: ${value(event.signal?.barrier)} | Stake: ${amount(event.stake, currency)} | Payout: ${amount(event.payout, currency)} | Profit/loss: ${amount(event.profit, currency)} | Consecutive losses: ${value(event.inARow)} | Next stake: ${amount(event.nextStake, currency)} | Total profit/loss: ${amount(event.totalProfit, currency)}${stats}`, className: event.result === 'won' ? 'journal__text--success' : 'journal__text--error' };
        }
        case 'purchase_error':
            return { message: `${prefix} | PURCHASE NOT CONFIRMED — ${value(event.reason)}. Check Transactions and your account before restarting.${stats}`, className: 'journal__text--error' };
        case 'stop':
            return { message: `${prefix} | STOPPED — ${value(event.reason)}${stats}`, className: 'journal__text--warn' };
        case 'tick_gap':
            return { message: `${prefix} | TICK GAP — restoring ticks from ${time(event.start)} to ${time(event.end)}.`, className: 'journal__text--warn' };
        case 'stream_disconnected':
            return { message: `${prefix} | CONNECTION INTERRUPTED — waiting to restore the tick stream. Last tick: ${time(event.lastEpoch)}.`, className: 'journal__text--warn' };
        case 'replayed_subscription_response':
        case 'replayed_subscription_snapshot':
            return { message: `${prefix} | Repeated subscription tick ignored: ${time(event.epoch)}.`, className: 'journal__text' };
        case 'settlement_pending_order':
            return { message: `${prefix} | SETTLEMENT WAITING — contract ${value(event.contract_id)}: ${value(event.reason)}`, className: 'journal__text--warn' };
        case 'initial_tick_history_unavailable':
            return { message: `${prefix} | INITIAL HISTORY UNAVAILABLE — ${value(event.reason)}.`, className: 'journal__text--warn' };
        case 'display_error':
        case 'settlement_error':
        case 'settlement_check_error':
        case 'settlement_order_incomplete':
        case 'stream_error':
            return { message: `${prefix} | ${event.type.replaceAll('_', ' ').toUpperCase()} — ${value(event.reason)}${event.contractId != null ? ` | Contract ID: ${event.contractId}` : ''}`, className: 'journal__text--error' };
        default:
            return { message: `${prefix} | ${value(event.type).replaceAll('_', ' ')}${event.reason ? ` — ${event.reason}` : ''}`, className: 'journal__text' };
    }
};
