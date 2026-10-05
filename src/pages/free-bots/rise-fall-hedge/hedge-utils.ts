/**
 * Rise/Fall Hedge — pure logic (no API calls).
 *
 * A hedge is one Rise (CALL) and one Fall (PUT) contract with the same stake and
 * duration, bought together and treated as one position. All P/L comes from the
 * settled contracts returned by Deriv: a losing leg is −stake, a winning leg is
 * actual payout − stake, and the hedge is the sum of both legs.
 */

export const DEFAULT_SYMBOL = 'stpRNG';
export const RISE = 'CALL';
export const FALL = 'PUT';
export const MIN_STAKE = 0.35;
export const MIN_DURATION = 1;
export const MAX_DURATION = 10;
export const BREAK_EVEN_TOLERANCE = 0.005;

export type TriggerMode = 'MANUAL' | 'AUTO';
export type IncompletePolicy = 'CANCEL_REMAINING' | 'LET_REMAINING_RUN';

export type HedgeSettings = {
    symbol: string;
    stake: number;
    duration: number;
    mode: TriggerMode;
    every_n_ticks: number;
    cooldown_seconds: number;
    max_open_hedges: number;
    max_daily_hedges: number;
    max_stake_per_hedge: number;
    /** Worst case: today's realised loss + open stakes + this hedge's stake may not exceed it. */
    max_daily_loss: number;
    /** Stop once today's realised net loss reaches it. */
    daily_loss_limit: number;
    daily_profit_target: number;
    max_consecutive_losses: number;
    max_trades: number;
    asymmetric_threshold_ms: number;
    incomplete_policy: IncompletePolicy;
};

export const DEFAULT_SETTINGS: HedgeSettings = {
    symbol: DEFAULT_SYMBOL,
    stake: 2,
    duration: 2,
    mode: 'MANUAL',
    every_n_ticks: 10,
    cooldown_seconds: 10,
    max_open_hedges: 1,
    max_daily_hedges: 50,
    max_stake_per_hedge: 10,
    max_daily_loss: 25,
    daily_loss_limit: 20,
    daily_profit_target: 20,
    max_consecutive_losses: 5,
    max_trades: 100,
    asymmetric_threshold_ms: 500,
    incomplete_policy: 'CANCEL_REMAINING',
};

/** Step Indices (Step Index 100 = stpRNG, 200 = stpRNG2, …). */
export const isStepIndex = (symbol: { symbol: string; submarket?: string; displayName?: string }) =>
    /^stpRNG\d*$/i.test(symbol.symbol) ||
    symbol.submarket === 'step_index' ||
    /step index/i.test(symbol.displayName || '');

const num = (value: unknown, fallback: number, min: number, max: number, integer = false) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = integer ? Math.floor(n) : Math.round(n * 100) / 100;
    return Math.min(max, Math.max(min, v));
};

export const normalizeSettings = (raw: Partial<HedgeSettings> = {}): HedgeSettings => {
    const d = DEFAULT_SETTINGS;
    return {
        symbol: raw.symbol || d.symbol,
        stake: num(raw.stake, d.stake, MIN_STAKE, 10000),
        duration: num(raw.duration, d.duration, MIN_DURATION, MAX_DURATION, true),
        mode: raw.mode === 'AUTO' ? 'AUTO' : 'MANUAL',
        every_n_ticks: num(raw.every_n_ticks, d.every_n_ticks, 1, 100000, true),
        cooldown_seconds: num(raw.cooldown_seconds, d.cooldown_seconds, 0, 86400, true),
        max_open_hedges: num(raw.max_open_hedges, d.max_open_hedges, 1, 20, true),
        max_daily_hedges: num(raw.max_daily_hedges, d.max_daily_hedges, 1, 100000, true),
        max_stake_per_hedge: num(raw.max_stake_per_hedge, d.max_stake_per_hedge, MIN_STAKE * 2, 100000),
        max_daily_loss: num(raw.max_daily_loss, d.max_daily_loss, 0, 1000000),
        daily_loss_limit: num(raw.daily_loss_limit, d.daily_loss_limit, 0, 1000000),
        daily_profit_target: num(raw.daily_profit_target, d.daily_profit_target, 0, 1000000),
        max_consecutive_losses: num(raw.max_consecutive_losses, d.max_consecutive_losses, 1, 100000, true),
        max_trades: num(raw.max_trades, d.max_trades, 1, 100000, true),
        asymmetric_threshold_ms: num(raw.asymmetric_threshold_ms, d.asymmetric_threshold_ms, 0, 60000, true),
        incomplete_policy: raw.incomplete_policy === 'LET_REMAINING_RUN' ? 'LET_REMAINING_RUN' : 'CANCEL_REMAINING',
    };
};

/** Subset of Deriv's proposal_open_contract used for settlement. */
export type OpenContract = {
    contract_id?: number;
    buy_price?: number | string;
    payout?: number | string;
    sell_price?: number | string;
    profit?: number | string;
    is_sold?: number | boolean;
    status?: string;
    entry_tick_display_value?: string;
    entry_spot_display_value?: string;
    entry_tick?: number | string;
    entry_spot?: number | string;
    exit_tick_display_value?: string;
    exit_tick?: number | string;
    purchase_time?: number;
    date_start?: number;
};

export type LegResult = 'WIN' | 'LOSS';

export type Leg = {
    side: 'RISE' | 'FALL';
    contract_type: typeof RISE | typeof FALL;
    status: 'PENDING' | 'FAILED' | 'OPEN' | 'SETTLED' | 'CANCELLED';
    stake: number;
    quoted_payout?: number;
    order_sent_at?: number;
    order_confirmed_at?: number;
    purchase_time?: number;
    contract_id?: number;
    entry_spot?: string;
    exit_spot?: string;
    payout?: number;
    profit?: number;
    result?: LegResult;
    error?: string;
    note?: string;
};

export const isSettled = (poc?: OpenContract) =>
    Boolean(poc && (poc.is_sold || poc.status === 'won' || poc.status === 'lost' || poc.status === 'sold'));

const str = (value: unknown) => (value === undefined || value === null || value === '' ? undefined : String(value));

/**
 * Apply a proposal_open_contract update to a leg. Payout and P/L only come from the
 * settled contract: a loss pays 0 (P/L = −stake), a win pays Deriv's actual payout.
 */
export const applyContractToLeg = (leg: Leg, poc: OpenContract): Leg => {
    const next: Leg = {
        ...leg,
        stake: Number.isFinite(Number(poc.buy_price)) ? Number(poc.buy_price) : leg.stake,
        entry_spot:
            str(poc.entry_tick_display_value) ??
            str(poc.entry_spot_display_value) ??
            str(poc.entry_tick) ??
            str(poc.entry_spot) ??
            leg.entry_spot,
        exit_spot: str(poc.exit_tick_display_value) ?? str(poc.exit_tick) ?? leg.exit_spot,
        purchase_time: poc.purchase_time ?? poc.date_start ?? leg.purchase_time,
    };
    if (!isSettled(poc)) return { ...next, status: leg.status === 'CANCELLED' ? 'CANCELLED' : 'OPEN' };

    const profit_reported = Number(poc.profit);
    const sell_price = Number(poc.sell_price);
    const won =
        poc.status === 'won' || poc.status === 'lost'
            ? poc.status === 'won'
            : Number.isFinite(profit_reported) && profit_reported > 0;
    // sell_price is what Deriv actually paid (0 on a loss, the payout on a win, the resale value if sold early).
    const payout = Number.isFinite(sell_price) ? sell_price : won ? Number(poc.payout) : 0;
    const profit = Math.round((payout - next.stake) * 100) / 100;
    return {
        ...next,
        status: leg.status === 'CANCELLED' ? 'CANCELLED' : 'SETTLED',
        result: won ? 'WIN' : 'LOSS',
        payout: Number.isFinite(payout) ? payout : 0,
        profit,
    };
};

export type HedgeStatus = 'BUYING' | 'OPEN' | 'SETTLED' | 'INCOMPLETE' | 'ABORTED';

export type Hedge = {
    id: number;
    symbol: string;
    day: string;
    created_at: number;
    duration: number;
    status: HedgeStatus;
    rise: Leg;
    fall: Leg;
    execution_gap_ms?: number;
    asymmetric?: boolean;
    failure?: string;
    policy_applied?: string;
    total_stake?: number;
    total_payout?: number;
    net?: number;
    return_pct?: number;
};

export const dayKey = (time: number) => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const legDone = (leg: Leg) => leg.status === 'FAILED' || leg.result !== undefined;
const legBought = (leg: Leg) => leg.contract_id !== undefined;

/** Execution gap between the two purchase confirmations (ms). */
export const executionGap = (rise: Leg, fall: Leg) =>
    rise.order_confirmed_at !== undefined && fall.order_confirmed_at !== undefined
        ? Math.abs(rise.order_confirmed_at - fall.order_confirmed_at)
        : undefined;

/** Recompute combined totals once every bought leg has settled. */
export const finalizeHedge = (hedge: Hedge, asymmetric_threshold_ms: number): Hedge => {
    const gap = executionGap(hedge.rise, hedge.fall);
    const next: Hedge = {
        ...hedge,
        execution_gap_ms: gap,
        asymmetric: gap !== undefined && gap > asymmetric_threshold_ms,
    };
    if (hedge.status === 'ABORTED' || !legDone(hedge.rise) || !legDone(hedge.fall)) return next;

    const bought = [hedge.rise, hedge.fall].filter(legBought);
    const total_stake = bought.reduce((s, l) => s + l.stake, 0);
    const total_payout = bought.reduce((s, l) => s + (l.payout ?? 0), 0);
    const net = Math.round(bought.reduce((s, l) => s + (l.profit ?? 0), 0) * 100) / 100;
    return {
        ...next,
        status: bought.length === 2 ? 'SETTLED' : 'INCOMPLETE',
        total_stake: Math.round(total_stake * 100) / 100,
        total_payout: Math.round(total_payout * 100) / 100,
        net,
        return_pct: total_stake > 0 ? (net / total_stake) * 100 : 0,
    };
};

export const isHedgeOpen = (hedge: Hedge) => hedge.status === 'BUYING' || hedge.status === 'OPEN';
export const isHedgeFinal = (hedge: Hedge) => hedge.net !== undefined;

export type HedgeStats = {
    total: number;
    profitable: number;
    losing: number;
    break_even: number;
    total_staked: number;
    total_payout: number;
    net: number;
    average: number;
    best: number | null;
    worst: number | null;
    profit_factor: number | null;
    max_consecutive_losses: number;
    current_consecutive_losses: number;
    max_drawdown: number;
};

/** Statistics over finished hedges (oldest first). Aborted hedges bought nothing and are excluded. */
export const computeStats = (hedges: Hedge[]): HedgeStats => {
    const done = hedges.filter(isHedgeFinal).sort((a, b) => a.created_at - b.created_at);
    let gross_profit = 0;
    let gross_loss = 0;
    let streak = 0;
    let max_streak = 0;
    let equity = 0;
    let peak = 0;
    let max_drawdown = 0;
    const stats: HedgeStats = {
        total: done.length,
        profitable: 0,
        losing: 0,
        break_even: 0,
        total_staked: 0,
        total_payout: 0,
        net: 0,
        average: 0,
        best: null,
        worst: null,
        profit_factor: null,
        max_consecutive_losses: 0,
        current_consecutive_losses: 0,
        max_drawdown: 0,
    };
    done.forEach(h => {
        const net = h.net as number;
        stats.total_staked += h.total_stake ?? 0;
        stats.total_payout += h.total_payout ?? 0;
        stats.net += net;
        stats.best = stats.best === null ? net : Math.max(stats.best, net);
        stats.worst = stats.worst === null ? net : Math.min(stats.worst, net);
        if (Math.abs(net) < BREAK_EVEN_TOLERANCE) {
            stats.break_even += 1;
            streak = 0;
        } else if (net > 0) {
            stats.profitable += 1;
            gross_profit += net;
            streak = 0;
        } else {
            stats.losing += 1;
            gross_loss += -net;
            streak += 1;
            max_streak = Math.max(max_streak, streak);
        }
        equity += net;
        peak = Math.max(peak, equity);
        max_drawdown = Math.max(max_drawdown, peak - equity);
    });
    const round = (v: number) => Math.round(v * 100) / 100;
    stats.total_staked = round(stats.total_staked);
    stats.total_payout = round(stats.total_payout);
    stats.net = round(stats.net);
    stats.average = done.length ? round(stats.net / done.length) : 0;
    stats.profit_factor = gross_loss > 0 ? gross_profit / gross_loss : gross_profit > 0 ? Infinity : null;
    stats.max_consecutive_losses = max_streak;
    stats.current_consecutive_losses = streak;
    stats.max_drawdown = round(max_drawdown);
    return stats;
};

export type GateContext = {
    settings: HedgeSettings;
    hedges: Hedge[];
    now: number;
    emergency_stopped: boolean;
    last_hedge_at?: number;
};

/** Every risk control checked before a hedge is fired. Returns the first blocking reason. */
export const checkRiskGates = ({ settings, hedges, now, emergency_stopped, last_hedge_at }: GateContext) => {
    if (emergency_stopped) return 'Emergency STOP is active.';
    const total_stake = settings.stake * 2;
    if (total_stake > settings.max_stake_per_hedge + 1e-9) {
        return `Total stake per hedge ${total_stake.toFixed(2)} exceeds the maximum ${settings.max_stake_per_hedge.toFixed(2)}.`;
    }
    const today = dayKey(now);
    const today_hedges = hedges.filter(h => h.day === today && h.status !== 'ABORTED');
    const open = hedges.filter(isHedgeOpen).length;
    if (open >= settings.max_open_hedges) return `Maximum simultaneous hedges reached (${settings.max_open_hedges}).`;
    const fired = hedges.filter(h => h.status !== 'ABORTED').length;
    if (fired >= settings.max_trades) return `Maximum number of trades reached (${settings.max_trades}).`;
    if (today_hedges.length >= settings.max_daily_hedges) {
        return `Maximum daily hedge count reached (${settings.max_daily_hedges}).`;
    }
    const day_stats = computeStats(today_hedges);
    if (settings.daily_loss_limit > 0 && day_stats.net <= -settings.daily_loss_limit) {
        return `Daily loss limit reached (${day_stats.net.toFixed(2)}).`;
    }
    if (settings.max_daily_loss > 0) {
        const open_stake = hedges
            .filter(isHedgeOpen)
            .reduce((s, h) => s + [h.rise, h.fall].filter(l => l.status !== 'FAILED').reduce((t, l) => t + l.stake, 0), 0);
        const worst_case = day_stats.net - open_stake - total_stake;
        if (worst_case < -settings.max_daily_loss - 1e-9) {
            return `Maximum daily loss: a losing hedge could take today to ${worst_case.toFixed(2)} (limit −${settings.max_daily_loss.toFixed(2)}).`;
        }
    }
    if (settings.daily_profit_target > 0 && day_stats.net >= settings.daily_profit_target) {
        return `Daily profit target reached (+${day_stats.net.toFixed(2)}).`;
    }
    const all_stats = computeStats(hedges);
    if (all_stats.current_consecutive_losses >= settings.max_consecutive_losses) {
        return `Maximum consecutive losing hedges reached (${settings.max_consecutive_losses}).`;
    }
    if (last_hedge_at !== undefined && now - last_hedge_at < settings.cooldown_seconds * 1000) {
        const left = Math.ceil((settings.cooldown_seconds * 1000 - (now - last_hedge_at)) / 1000);
        return `Cooldown: ${left}s left.`;
    }
    return null;
};

/** Blocks that clear by themselves (automatic mode waits instead of stopping). */
export const isTemporaryBlock = (reason: string) =>
    reason.startsWith('Cooldown') || reason.startsWith('Maximum simultaneous');

/** Automatic trigger: fire once N new ticks have arrived since the last hedge (or since auto start). */
export const shouldAutoFire = (ticks_since_last: number, settings: HedgeSettings) =>
    settings.mode === 'AUTO' && ticks_since_last >= settings.every_n_ticks;

const money = (value: number | undefined) =>
    value === undefined ? '—' : `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`;

const legLine = (label: string, leg: Leg) => {
    if (leg.status === 'FAILED') return `${label}: FAILED (${leg.error || 'not bought'})`;
    if (leg.result === undefined) return `${label}: OPEN`;
    return `${label}: ${leg.result.padEnd(4)}  ${money(leg.profit)}`;
};

/** The HEDGE #n card shown in the dashboard. */
export const formatHedgeCard = (hedge: Hedge) => {
    const lines = [`HEDGE #${hedge.id}`, legLine('Rise', hedge.rise), legLine('Fall', hedge.fall), '--------------------'];
    lines.push(hedge.net === undefined ? 'NET:       pending' : `NET:       ${money(hedge.net)}`);
    return lines.join('\n');
};
