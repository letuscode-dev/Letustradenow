/**
 * Last-Tick Price Digit Differ.
 *
 * On every new tick the digit immediately BEFORE the decimal point of the price
 * becomes the Differs barrier (4681.35 → 1, 5237.84 → 7, 8.42 → 8). The barrier is
 * always automatic. Entry conditions decide whether a DIGITDIFF trade is placed on
 * that tick; every decision is written to the Journal.
 */

export const BOT_NAME = 'Last-Tick Price Digit Differ';

export const LTD_DEFAULTS = {
    auto_trading: true,
    confirmation_ticks: 2,
    cooldown_seconds: 2,
    max_trades: 50,
    max_consecutive_losses: 3,
    stop_loss: 20,
    take_profit: 10,
    stale_seconds: 5,
    status_every: 10,
};

const num = (value, fallback, min, max, integer = false) => {
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(n)) return fallback;
    const v = integer ? Math.floor(n) : Math.round(n * 100) / 100;
    return Math.min(max, Math.max(min, v));
};

const bool = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'string') return !['FALSE', '0', 'NO', 'OFF'].includes(value.trim().toUpperCase());
    return Boolean(value);
};

export const normalizeLtdSettings = (raw = {}) => {
    const d = LTD_DEFAULTS;
    return {
        auto_trading: bool(raw.auto_trading, d.auto_trading),
        confirmation_ticks: num(raw.confirmation_ticks, d.confirmation_ticks, 1, 100, true),
        cooldown_seconds: num(raw.cooldown_seconds, d.cooldown_seconds, 0, 86400),
        max_trades: num(raw.max_trades, d.max_trades, 1, 100000, true),
        max_consecutive_losses: num(raw.max_consecutive_losses, d.max_consecutive_losses, 1, 1000, true),
        stop_loss: num(raw.stop_loss, d.stop_loss, 0, 1000000),
        take_profit: num(raw.take_profit, d.take_profit, 0, 1000000),
        stale_seconds: num(raw.stale_seconds, d.stale_seconds, 1, 3600, true),
        status_every: num(raw.status_every, d.status_every, 0, 10000, true),
    };
};

/** Price as Deriv displays it (pip-size decimals), or null when it is not a valid number. */
export const formatPrice = (quote, pip_size) => {
    if (typeof quote === 'string') {
        const trimmed = quote.trim();
        return /^\d+(\.\d+)?$/.test(trimmed) ? trimmed : null;
    }
    const n = Number(quote);
    if (quote === null || quote === undefined || !Number.isFinite(n) || n < 0) return null;
    const decimals = Number.isInteger(pip_size) && pip_size >= 0 ? pip_size : null;
    return decimals === null ? String(n) : n.toFixed(decimals);
};

/**
 * The digit immediately to the LEFT of the decimal point, or null if the price has
 * no decimal point or is not valid.
 */
export const extractDigitBeforeDecimal = (quote, pip_size) => {
    const text = formatPrice(quote, pip_size);
    if (text === null) return null;
    const dot = text.indexOf('.');
    if (dot < 1) return null;
    const digit = Number(text[dot - 1]);
    return Number.isInteger(digit) ? digit : null;
};

export const createLtdState = () => ({
    settings: normalizeLtdSettings(),
    started: false,
    status: 'ANALYZING',
    tick_count: 0,
    last_epoch: null,
    price: null,
    digit: null,
    barrier: null,
    previous_barrier: null,
    stable_ticks: 0,
    entry_status: 'WAITING',
    last_action: 'No trade',
    pending: null,
    last_trade_at: null,
    last_trade_epoch: null,
    trades: 0,
    wins: 0,
    losses: 0,
    consecutive_wins: 0,
    consecutive_losses: 0,
    profit: 0,
    stop_requested: false,
    watchdog: null,
    stale: false,
});

/** Limits that end the session (checked before every entry and after every result). */
export const ltdStopReason = (state, settings) => {
    if (state.trades >= settings.max_trades) return `maximum trades reached (${settings.max_trades})`;
    if (state.consecutive_losses >= settings.max_consecutive_losses) {
        return `maximum consecutive loss limit reached (${settings.max_consecutive_losses})`;
    }
    if (settings.take_profit > 0 && state.profit >= settings.take_profit) {
        return `take profit reached (+$${state.profit.toFixed(2)})`;
    }
    if (settings.stop_loss > 0 && state.profit <= -settings.stop_loss) {
        return `stop loss reached (-$${Math.abs(state.profit).toFixed(2)})`;
    }
    return null;
};

/**
 * Process one new tick. Mutates the state (tick count, barrier, streak) and returns
 * the decision: READY (trade this barrier), WAITING (with reason), ERROR or STOPPED.
 */
export const evaluateLtdTick = (state, { quote, epoch, pip_size, now }, settings) => {
    state.tick_count += 1;
    state.last_epoch = epoch;
    const digit = extractDigitBeforeDecimal(quote, pip_size);
    state.price = formatPrice(quote, pip_size);
    if (digit === null) {
        state.entry_status = 'ERROR';
        state.stable_ticks = 0;
        return { decision: 'ERROR', reason: 'Unable to extract barrier from latest tick.', checks: [] };
    }
    state.previous_barrier = state.barrier;
    state.stable_ticks = digit === state.barrier ? state.stable_ticks + 1 : 1;
    state.digit = digit;
    state.barrier = digit;

    const checks = [];
    const wait = reason => {
        state.entry_status = 'WAITING';
        return { decision: 'WAITING', reason, checks };
    };

    const stop = ltdStopReason(state, settings);
    if (stop) {
        state.entry_status = 'STOPPED';
        return { decision: 'STOPPED', reason: stop, checks };
    }
    checks.push('limits ok');

    if (state.stale) return wait('no new tick received (stale data)');
    if (!settings.auto_trading) return wait('auto trading is OFF (analysis only)');
    checks.push('auto trading ON');

    if (state.last_trade_epoch !== null && epoch === state.last_trade_epoch) return wait('duplicate signal');
    checks.push('new tick');

    if (state.last_trade_at !== null) {
        const left = settings.cooldown_seconds * 1000 - (now - state.last_trade_at);
        if (left > 0) return wait(`cooldown active (${Math.ceil(left / 1000)}s left)`);
    }
    checks.push('cooldown clear');

    if (state.stable_ticks < settings.confirmation_ticks) {
        return wait(
            `entry confirmation not satisfied (digit ${digit} stable ${state.stable_ticks}/${settings.confirmation_ticks} ticks)`
        );
    }
    checks.push(`digit stable ${state.stable_ticks}/${settings.confirmation_ticks}`);

    state.entry_status = 'READY';
    return { decision: 'READY', reason: 'all entry conditions satisfied', checks };
};

/** Record a settled contract. */
export const applyLtdResult = (state, { profit }) => {
    const p = Number(profit) || 0;
    const won = p > 0;
    state.trades += 1;
    state.profit = Math.round((state.profit + p) * 100) / 100;
    if (won) {
        state.wins += 1;
        state.consecutive_wins += 1;
        state.consecutive_losses = 0;
    } else {
        state.losses += 1;
        state.consecutive_losses += 1;
        state.consecutive_wins = 0;
    }
    return won;
};

export const clock = ms => {
    const d = new Date(ms);
    const pad = (v, n = 2) => String(v).padStart(n, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

const money = v => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;

export const tickLines = ({ state, result, market, now }) => {
    const head = `[${clock(now)}] NEW TICK RECEIVED #${state.tick_count} | Symbol: ${market} | Price: ${state.price ?? 'invalid'}`;
    if (result.decision === 'ERROR') {
        return [head, 'ERROR — Unable to extract barrier from latest tick. Waiting for the next valid tick.'];
    }
    const lines = [
        head,
        `Extracted digit before decimal: ${state.digit} | Current Differs barrier: ${state.barrier} | Previous barrier: ${
            state.previous_barrier ?? '—'
        }`,
        `Entry analysis: ${result.checks.length ? result.checks.join(' · ') : '—'}`,
    ];
    if (result.decision === 'READY') lines.push('READY — all entry conditions satisfied');
    else if (result.decision === 'STOPPED') lines.push(`STOPPED — ${result.reason}`);
    else lines.push(`Status: WAITING — ${result.reason}`);
    return lines;
};

export const tradeLines = ({ barrier, stake, duration, duration_unit }) => [
    `Action: PLACE DIFFER TRADE | TRADE PLACED — DIFFER ${barrier} | Stake: $${Number(stake).toFixed(2)} | Duration: ${duration} ${
        duration_unit === 't' ? 'ticks' : duration_unit
    }`,
];

export const resultLines = ({ state, barrier, won, profit, contract_id, balance, now }) => [
    `[${clock(now)}] CONTRACT RESULT | Contract ID: ${contract_id ?? '—'} | Barrier: ${barrier ?? '—'} | Result: ${
        won ? 'WON' : 'LOST'
    } | Profit: ${money(profit)}`,
    `Balance: ${balance ?? '—'} | Consecutive wins: ${state.consecutive_wins} | Consecutive losses: ${
        state.consecutive_losses
    } | Session P/L: ${money(state.profit)}`,
];

export const statusLines = (state, market) => [
    `BOT: ${BOT_NAME} | STATUS: ${state.status} | MARKET: ${market}`,
    `LATEST PRICE: ${state.price ?? '—'} | EXTRACTED DIGIT: ${state.digit ?? '—'} | CURRENT BARRIER: ${
        state.barrier ?? '—'
    } | ENTRY STATUS: ${state.entry_status}`,
    `LAST ACTION: ${state.last_action} | TRADES: ${state.trades} | WINS: ${state.wins} | LOSSES: ${
        state.losses
    } | PROFIT/LOSS: ${money(state.profit)}`,
];

export const settingsLines = s => [
    `${BOT_NAME} — barrier = digit immediately before the decimal point of every new tick (automatic)`,
    `Auto trading ${s.auto_trading ? 'ON' : 'OFF (analysis only)'} | Confirmation ${s.confirmation_ticks} tick(s) | Cooldown ${
        s.cooldown_seconds
    }s | Max trades ${s.max_trades} | Max consecutive losses ${s.max_consecutive_losses}`,
    `Stop loss ${s.stop_loss > 0 ? `$${s.stop_loss.toFixed(2)}` : 'off'} | Take profit ${
        s.take_profit > 0 ? `$${s.take_profit.toFixed(2)}` : 'off'
    } | No-tick warning after ${s.stale_seconds}s | Status every ${s.status_every || 'off'} ticks`,
];
