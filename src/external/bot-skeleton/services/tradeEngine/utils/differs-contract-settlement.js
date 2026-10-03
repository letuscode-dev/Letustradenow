/**
 * Shared WIN/LOSS bookkeeping for Differs strategies that record results from the
 * settled purchased contract (never from a market tick).
 *
 * Expected state shape: { pending_outcome: { target, type, epoch } | null,
 * last_settled_contract_id, just_settled, live: { trades, wins, losses, streak,
 * last_outcome, history } }.
 */

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const isProvided = value => value !== undefined && value !== null && value !== '';

const contractId = contract => contract?.contract_id ?? contract?.transaction_ids?.buy ?? null;

const isContractSettled = contract =>
    Boolean(
        contract &&
            contract.status !== 'open' &&
            (contract.is_sold || contract.status === 'won' || contract.status === 'lost' || contract.sell_price != null)
    );

const lastDigitOf = value => {
    if (!isProvided(value)) return null;
    const text = String(value).replace(/[^0-9]/g, '');
    return text.length ? Number(text[text.length - 1]) : null;
};

export const createLiveStats = () => ({
    trades: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    last_outcome: null,
    history: [],
});

/**
 * Record the WIN/LOSS of the purchased contract for the pending signal.
 * Only a settled contract bought for this signal (same target barrier, bought at or
 * after the signal tick, not already recorded) is accepted.
 */
export const recordSettledDiffersContract = (state, contract) => {
    const pending = state?.pending_outcome;
    if (!pending || !isContractSettled(contract)) return null;
    const id = contractId(contract);
    if (id === null || id === state.last_settled_contract_id) return null;
    const purchase_time = Number(contract.purchase_time ?? contract.date_start);
    if (pending.epoch !== null && Number.isFinite(purchase_time) && purchase_time < pending.epoch) return null;
    const barrier = toDigit(contract.barrier);
    if (barrier !== null && barrier !== pending.target) return null;

    const profit = Number(contract.profit);
    const won =
        contract.status === 'won' || contract.status === 'lost'
            ? contract.status === 'won'
            : Number.isFinite(profit) && profit > 0;
    const exit_digit = lastDigitOf(contract.exit_tick_display_value ?? contract.exit_tick);

    const live = state.live;
    live.trades += 1;
    if (won) {
        live.wins += 1;
        live.streak = live.streak > 0 ? live.streak + 1 : 1;
    } else {
        live.losses += 1;
        live.streak = live.streak < 0 ? live.streak - 1 : -1;
    }
    live.last_outcome = {
        target: pending.target,
        actual: exit_digit,
        result: won ? 'WIN' : 'LOSS',
        contract_id: id,
        profit: Number.isFinite(profit) ? profit : null,
    };
    live.history.push({ ...live.last_outcome, type: pending.type });
    if (live.history.length > 200) live.history = live.history.slice(-200);
    state.last_settled_contract_id = id;
    state.pending_outcome = null;
    state.just_settled = live.last_outcome;
    return live.last_outcome;
};

export const formatStreak = streak => {
    if (streak > 0) return `${streak} win${streak === 1 ? '' : 's'}`;
    if (streak < 0) return `${-streak} loss${streak === -1 ? '' : 'es'}`;
    return '0';
};

export const describeSettlement = settled => {
    const parts = [`RESULT: ${settled.result} — DIFFERS ${settled.target}`, `contract ${settled.contract_id}`];
    if (settled.actual !== null) parts.push(`exit digit ${settled.actual}`);
    if (settled.profit !== null) parts.push(`profit ${settled.profit >= 0 ? '+' : ''}${settled.profit.toFixed(2)}`);
    return parts.join(' | ');
};

export const describeLiveStats = (live, extra = '') => {
    const { trades, wins, losses, streak, last_outcome } = live;
    return `Last Result: ${last_outcome ? last_outcome.result : '—'} | Trades: ${trades} | Wins: ${wins} | Losses: ${losses} | Win rate: ${
        trades ? ((wins / trades) * 100).toFixed(1) : '0.0'
    }% | Streak: ${formatStreak(streak)}${extra}`;
};
