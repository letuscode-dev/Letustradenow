/**
 * Rise/Fall Hedge — buys a Rise (CALL) and a Fall (PUT) together with the same stake
 * and duration and treats them as one position.
 *
 * Rise is bought through the normal engine purchase (so Bot Builder tracks it and
 * After Purchase runs when it settles); Fall is bought in the same instant from the
 * engine's live PUT proposal and followed separately. All P/L comes from the settled
 * contracts returned by Deriv: a losing leg is −stake, a winning leg is the actual
 * payout − stake, and the hedge is the sum of both legs.
 */

export const RISE = 'CALL';
export const FALL = 'PUT';
export const BREAK_EVEN_TOLERANCE = 0.005;
const HISTORY_KEY = 'rise_fall_hedge_history_v1';
const MAX_HISTORY = 500;

export const DEFAULT_SETTINGS = {
    mode: 'MANUAL',
    every_n_ticks: 10,
    cooldown_seconds: 10,
    max_daily_hedges: 50,
    max_stake_per_hedge: 10,
    max_daily_loss: 25,
    daily_loss_limit: 20,
    daily_profit_target: 20,
    max_consecutive_losses: 5,
    max_trades: 100,
    asymmetric_threshold_ms: 500,
    incomplete_policy: 'CANCEL',
};

const num = (value, fallback, min, max, integer = false) => {
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(n)) return fallback;
    const v = integer ? Math.floor(n) : Math.round(n * 100) / 100;
    return Math.min(max, Math.max(min, v));
};

export const normalizeHedgeSettings = (raw = {}) => {
    const d = DEFAULT_SETTINGS;
    const mode = String(raw.mode ?? d.mode).toUpperCase();
    const policy = String(raw.incomplete_policy ?? d.incomplete_policy).toUpperCase();
    return {
        mode: mode.startsWith('AUTO') ? 'AUTO' : 'MANUAL',
        every_n_ticks: num(raw.every_n_ticks, d.every_n_ticks, 1, 100000, true),
        cooldown_seconds: num(raw.cooldown_seconds, d.cooldown_seconds, 0, 86400, true),
        max_daily_hedges: num(raw.max_daily_hedges, d.max_daily_hedges, 1, 100000, true),
        max_stake_per_hedge: num(raw.max_stake_per_hedge, d.max_stake_per_hedge, 0.7, 1000000),
        max_daily_loss: num(raw.max_daily_loss, d.max_daily_loss, 0, 1000000),
        daily_loss_limit: num(raw.daily_loss_limit, d.daily_loss_limit, 0, 1000000),
        daily_profit_target: num(raw.daily_profit_target, d.daily_profit_target, 0, 1000000),
        max_consecutive_losses: num(raw.max_consecutive_losses, d.max_consecutive_losses, 1, 100000, true),
        max_trades: num(raw.max_trades, d.max_trades, 1, 100000, true),
        asymmetric_threshold_ms: num(raw.asymmetric_threshold_ms, d.asymmetric_threshold_ms, 0, 60000, true),
        incomplete_policy: policy.startsWith('RUN') || policy.startsWith('LET') || policy === 'B' ? 'RUN' : 'CANCEL',
    };
};

export const dayKey = time => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const round2 = v => Math.round(v * 100) / 100;
const str = v => (v === undefined || v === null || v === '' ? undefined : String(v));

export const newLeg = (side, stake) => ({
    side,
    contract_type: side === 'RISE' ? RISE : FALL,
    status: 'PENDING',
    stake,
});

export const isSettled = poc =>
    Boolean(poc && (poc.is_sold || poc.status === 'won' || poc.status === 'lost' || poc.status === 'sold'));

/**
 * Apply a proposal_open_contract to a leg. Payout is what Deriv actually paid
 * (sell_price: 0 on a loss, the payout on a win, the resale value if sold early).
 */
export const applyContractToLeg = (leg, poc) => {
    const next = {
        ...leg,
        contract_id: leg.contract_id ?? poc.contract_id,
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
    const payout = Number.isFinite(sell_price) ? sell_price : won ? Number(poc.payout) : 0;
    return {
        ...next,
        status: leg.status === 'CANCELLED' ? 'CANCELLED' : 'SETTLED',
        result: won ? 'WIN' : 'LOSS',
        payout: Number.isFinite(payout) ? payout : 0,
        profit: round2((Number.isFinite(payout) ? payout : 0) - next.stake),
    };
};

const legDone = leg => leg.status === 'FAILED' || leg.result !== undefined;
const legBought = leg => leg.contract_id !== undefined && leg.contract_id !== null;

export const executionGap = (rise, fall) =>
    rise.order_confirmed_at !== undefined && fall.order_confirmed_at !== undefined
        ? Math.abs(rise.order_confirmed_at - fall.order_confirmed_at)
        : undefined;

/** Combined totals once every bought leg has settled. */
export const finalizeHedge = (hedge, asymmetric_threshold_ms) => {
    const gap = executionGap(hedge.rise, hedge.fall);
    const next = { ...hedge, execution_gap_ms: gap, asymmetric: gap !== undefined && gap > asymmetric_threshold_ms };
    if (hedge.status === 'ABORTED' || !legDone(hedge.rise) || !legDone(hedge.fall)) return next;
    const bought = [hedge.rise, hedge.fall].filter(legBought);
    if (!bought.length) return { ...next, status: 'ABORTED' };
    const total_stake = bought.reduce((s, l) => s + l.stake, 0);
    const total_payout = bought.reduce((s, l) => s + (l.payout ?? 0), 0);
    const net = round2(bought.reduce((s, l) => s + (l.profit ?? 0), 0));
    return {
        ...next,
        status: bought.length === 2 ? 'SETTLED' : 'INCOMPLETE',
        total_stake: round2(total_stake),
        total_payout: round2(total_payout),
        net,
        return_pct: total_stake > 0 ? (net / total_stake) * 100 : 0,
    };
};

const isFinal = h => h.net !== undefined;

/** Statistics over finished hedges (oldest first). Aborted hedges bought nothing and are excluded. */
export const computeHedgeStats = hedges => {
    const done = hedges.filter(isFinal).sort((a, b) => a.created_at - b.created_at);
    let gross_profit = 0;
    let gross_loss = 0;
    let streak = 0;
    let max_streak = 0;
    let equity = 0;
    let peak = 0;
    let max_drawdown = 0;
    const s = {
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
        s.total_staked += h.total_stake ?? 0;
        s.total_payout += h.total_payout ?? 0;
        s.net += h.net;
        s.best = s.best === null ? h.net : Math.max(s.best, h.net);
        s.worst = s.worst === null ? h.net : Math.min(s.worst, h.net);
        if (Math.abs(h.net) < BREAK_EVEN_TOLERANCE) {
            s.break_even += 1;
            streak = 0;
        } else if (h.net > 0) {
            s.profitable += 1;
            gross_profit += h.net;
            streak = 0;
        } else {
            s.losing += 1;
            gross_loss += -h.net;
            streak += 1;
            max_streak = Math.max(max_streak, streak);
        }
        equity += h.net;
        peak = Math.max(peak, equity);
        max_drawdown = Math.max(max_drawdown, peak - equity);
    });
    s.total_staked = round2(s.total_staked);
    s.total_payout = round2(s.total_payout);
    s.net = round2(s.net);
    s.average = done.length ? round2(s.net / done.length) : 0;
    s.profit_factor = gross_loss > 0 ? gross_profit / gross_loss : gross_profit > 0 ? Infinity : null;
    s.max_consecutive_losses = max_streak;
    s.current_consecutive_losses = streak;
    s.max_drawdown = round2(max_drawdown);
    return s;
};

/** Every risk control checked before a hedge is fired. Returns the first blocking reason or null. */
export const checkHedgeRiskGates = ({ settings, stake, hedges, now, last_hedge_at }) => {
    const total_stake = stake * 2;
    if (total_stake > settings.max_stake_per_hedge + 1e-9) {
        return `Total stake per hedge ${total_stake.toFixed(2)} exceeds the maximum ${settings.max_stake_per_hedge.toFixed(2)}.`;
    }
    const fired = hedges.filter(h => h.status !== 'ABORTED');
    if (fired.length >= settings.max_trades) return `Maximum number of trades reached (${settings.max_trades}).`;
    const today = fired.filter(h => h.day === dayKey(now));
    if (today.length >= settings.max_daily_hedges) {
        return `Maximum daily hedge count reached (${settings.max_daily_hedges}).`;
    }
    const day = computeHedgeStats(today);
    if (settings.daily_loss_limit > 0 && day.net <= -settings.daily_loss_limit) {
        return `Daily loss limit reached (${day.net.toFixed(2)}).`;
    }
    if (settings.max_daily_loss > 0 && day.net - total_stake < -settings.max_daily_loss - 1e-9) {
        return `Maximum daily loss: a losing hedge could take today to ${(day.net - total_stake).toFixed(2)} (limit −${settings.max_daily_loss.toFixed(2)}).`;
    }
    if (settings.daily_profit_target > 0 && day.net >= settings.daily_profit_target) {
        return `Daily profit target reached (+${day.net.toFixed(2)}).`;
    }
    if (computeHedgeStats(hedges).current_consecutive_losses >= settings.max_consecutive_losses) {
        return `Maximum consecutive losing hedges reached (${settings.max_consecutive_losses}).`;
    }
    if (last_hedge_at !== undefined && now - last_hedge_at < settings.cooldown_seconds * 1000) {
        return `Cooldown: ${Math.ceil((settings.cooldown_seconds * 1000 - (now - last_hedge_at)) / 1000)}s left.`;
    }
    return null;
};

/** Blocks that clear by themselves (the bot waits instead of stopping). */
export const isTemporaryBlock = reason => reason.startsWith('Cooldown');

const money = v => (v === undefined || v === null ? '—' : `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`);

const legLine = (label, leg) => {
    if (leg.status === 'FAILED') return `${label}: FAILED (${leg.error || 'not bought'})`;
    if (leg.result === undefined) return `${label}: OPEN`;
    return `${label}: ${leg.result.padEnd(4)}  ${money(leg.profit)}`;
};

export const formatHedgeCard = hedge =>
    [
        `HEDGE #${hedge.id}`,
        legLine('Rise', hedge.rise),
        legLine('Fall', hedge.fall),
        '--------------------',
        hedge.net === undefined ? 'NET:       pending' : `NET:       ${money(hedge.net)}`,
    ].join('\n');

const loadHistory = () => {
    try {
        const parsed = JSON.parse(window.localStorage?.getItem(HISTORY_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter(h => h.net !== undefined || h.status === 'ABORTED') : [];
    } catch {
        return [];
    }
};

export const saveHedgeHistory = hedges => {
    try {
        window.localStorage?.setItem(HISTORY_KEY, JSON.stringify(hedges.slice(-MAX_HISTORY)));
    } catch {
        // Storage full or unavailable — statistics stay in memory.
    }
};

/** Per-run state; finished hedges are restored from storage so daily limits survive restarts. */
export const createRiseFallHedgeState = (load = true) => ({
    settings: normalizeHedgeSettings(),
    hedges: load ? loadHistory() : [],
    session_start: Date.now(),
    current: null,
    last_hedge_at: undefined,
    last_tick_epoch: null,
    ticks_since_last: 0,
    dashboard_shown: false,
    last_wait_message: '',
});

const statsLines = (title, s) => {
    const pf = s.profit_factor === null ? '—' : s.profit_factor === Infinity ? '∞' : s.profit_factor.toFixed(2);
    return [
        `${title}: Hedges ${s.total} | Profitable ${s.profitable} | Losing ${s.losing} | Break-even ${s.break_even}`,
        `Staked $${s.total_staked.toFixed(2)} | Payout $${s.total_payout.toFixed(2)} | Net ${money(s.net)} | Avg ${money(s.average)}`,
        `Best ${money(s.best)} | Worst ${money(s.worst)} | Profit factor ${pf} | Max losing streak ${s.max_consecutive_losses} | Max drawdown $${s.max_drawdown.toFixed(2)}`,
    ];
};

/** The dashboard block of journal lines. */
export const dashboardLines = ({ symbol_name, stake, duration, state, quotes = {} }) => {
    const session = computeHedgeStats(state.hedges.filter(h => h.created_at >= state.session_start));
    const last = [...state.hedges].reverse().find(isFinal);
    const quote = q => (q ? `  (payout ${Number(q).toFixed(2)})` : '');
    return [
        String(symbol_name || '').toUpperCase(),
        '-------------------------',
        `Stake/leg: $${stake.toFixed(2)} | Duration: ${duration} ticks`,
        `Rise: $${stake.toFixed(2)}${quote(quotes.rise)} | Fall: $${stake.toFixed(2)}${quote(quotes.fall)}`,
        `Total Risk: $${(stake * 2).toFixed(2)}`,
        last
            ? `Last Hedge: Rise ${last.rise.result ?? last.rise.status} | Fall ${last.fall.result ?? last.fall.status} | Net ${money(last.net)}`
            : 'Last Hedge: none yet',
        `Session: Hedges ${session.total} | Wins ${session.profitable} | Losses ${session.losing} | Net P/L ${money(session.net)}`,
    ];
};

const time = ms => (ms ? new Date(ms).toISOString().slice(11, 23) : '—');

/** Journal lines for a finished hedge. */
export const hedgeResultLines = (hedge, state) => {
    const lines = formatHedgeCard(hedge).split('\n');
    const detail = (label, leg) =>
        `${label}: id ${leg.contract_id ?? '—'} | sent ${time(leg.order_sent_at)} | confirmed ${time(leg.order_confirmed_at)} | entry ${leg.entry_spot ?? '—'} | exit ${leg.exit_spot ?? '—'} | stake $${leg.stake.toFixed(2)} | payout ${leg.payout === undefined ? '—' : `$${leg.payout.toFixed(2)}`} | ${leg.result ?? leg.status}${leg.note ? ` | ${leg.note}` : ''}`;
    lines.push(detail('Rise', hedge.rise), detail('Fall', hedge.fall));
    if (hedge.total_stake !== undefined) {
        lines.push(
            `Combined: stake $${hedge.total_stake.toFixed(2)} | payout $${hedge.total_payout.toFixed(2)} | P/L ${money(hedge.net)} | return ${hedge.return_pct.toFixed(2)}%`
        );
    }
    if (hedge.execution_gap_ms !== undefined) {
        lines.push(`Execution gap: ${hedge.execution_gap_ms} ms${hedge.asymmetric ? ' — ASYMMETRIC EXECUTION' : ''}`);
    }
    if (hedge.failure) lines.push(`INCOMPLETE: ${hedge.failure}`);
    if (hedge.policy_applied) lines.push(`Policy: ${hedge.policy_applied}`);
    lines.push(...statsLines('Session', computeHedgeStats(state.hedges.filter(h => h.created_at >= state.session_start))));
    lines.push(...statsLines('All stored', computeHedgeStats(state.hedges)));
    return lines;
};
