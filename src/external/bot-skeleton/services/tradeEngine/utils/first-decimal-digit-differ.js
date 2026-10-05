/**
 * Double Decimal Digit Differ + 10.5 Recovery.
 *
 * On every new tick the LAST TWO digits after the decimal point are compared. Only when
 * they are the same (4681.33) is a Differs trade placed, with that digit as the barrier
 * (DIFFER 3). After a loss the next stake is the previous stake × recovery multiplier
 * (default 10.5); a win resets to the base stake. Maximum recovery level / stake pause
 * trading instead of escalating further.
 */
import { clock, formatPrice } from './last-tick-price-digit-differ';

export const FDD_BOT_NAME = 'Double Decimal Digit Differ + 10.5 Recovery';

export const FDD_DEFAULTS = {
    auto_trading: true,
    base_stake: 2,
    confirmation_ticks: 1,
    recovery_enabled: true,
    recovery_multiplier: 10.5,
    max_recovery_level: 2,
    max_recovery_stake: 250,
    max_consecutive_losses: 3,
    stop_loss: 250,
    take_profit: 20,
    max_trades: 100,
    cooldown_seconds: 2,
    stale_seconds: 5,
    status_every: 10,
};

const round2 = v => Math.round(v * 100) / 100;

const num = (value, fallback, min, max, integer = false) => {
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(n)) return fallback;
    const v = integer ? Math.floor(n) : round2(n);
    return Math.min(max, Math.max(min, v));
};

const bool = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'string') return !['FALSE', '0', 'NO', 'OFF'].includes(value.trim().toUpperCase());
    return Boolean(value);
};

export const normalizeFddSettings = (raw = {}) => {
    const d = FDD_DEFAULTS;
    return {
        auto_trading: bool(raw.auto_trading, d.auto_trading),
        base_stake: num(raw.base_stake, d.base_stake, 0.35, 1000000),
        confirmation_ticks: num(raw.confirmation_ticks, d.confirmation_ticks, 1, 100, true),
        recovery_enabled: bool(raw.recovery_enabled, d.recovery_enabled),
        recovery_multiplier: num(raw.recovery_multiplier, d.recovery_multiplier, 1, 1000),
        max_recovery_level: num(raw.max_recovery_level, d.max_recovery_level, 0, 100, true),
        max_recovery_stake: num(raw.max_recovery_stake, d.max_recovery_stake, 0.35, 100000000),
        max_consecutive_losses: num(raw.max_consecutive_losses, d.max_consecutive_losses, 1, 1000, true),
        stop_loss: num(raw.stop_loss, d.stop_loss, 0, 100000000),
        take_profit: num(raw.take_profit, d.take_profit, 0, 100000000),
        max_trades: num(raw.max_trades, d.max_trades, 1, 100000, true),
        cooldown_seconds: num(raw.cooldown_seconds, d.cooldown_seconds, 0, 86400),
        stale_seconds: num(raw.stale_seconds, d.stale_seconds, 1, 3600, true),
        status_every: num(raw.status_every, d.status_every, 0, 10000, true),
    };
};

/**
 * The last two digits after the decimal point: { first, second, pair } where pair is the
 * digit when both are the same (4681.33 → 3) and null otherwise (4681.35). Returns null
 * when the price is invalid or has fewer than two decimals.
 */
export const readLastTwoDecimals = (quote, pip_size) => {
    const text = formatPrice(quote, pip_size);
    if (text === null) return null;
    const dot = text.indexOf('.');
    if (dot < 1) return null;
    const decimals = text.slice(dot + 1);
    if (decimals.length < 2) return null;
    const first = Number(decimals[decimals.length - 2]);
    const second = Number(decimals[decimals.length - 1]);
    if (!Number.isInteger(first) || !Number.isInteger(second)) return null;
    return { first, second, pair: first === second ? first : null };
};

export const createFddState = (settings = normalizeFddSettings()) => ({
    settings,
    started: false,
    status: 'ANALYZING',
    tick_count: 0,
    last_epoch: null,
    price: null,
    last_two: null,
    last_pair: null,
    digit: null,
    barrier: null,
    previous_barrier: null,
    stable_ticks: 0,
    entry_status: 'WAITING',
    last_action: 'No trade',
    last_result: '-',
    pending: null,
    last_trade_at: null,
    last_trade_epoch: null,
    traded_barrier: null,
    traded_stake: null,
    base_stake: settings.base_stake,
    current_stake: settings.base_stake,
    recovery_level: 0,
    paused: null,
    purchase_failures: 0,
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

/** Keeps the base stake in sync with the Stake setting while no recovery is running. */
export const syncFddSettings = (state, settings) => {
    state.settings = settings;
    if (state.base_stake !== settings.base_stake && state.recovery_level === 0) {
        state.base_stake = settings.base_stake;
        state.current_stake = settings.base_stake;
    }
};

/** Session limits that stop the bot. */
export const fddStopReason = (state, settings) => {
    if (state.trades >= settings.max_trades) return `maximum trades reached (${settings.max_trades})`;
    if (settings.take_profit > 0 && state.profit >= settings.take_profit) {
        return `take profit reached (+$${state.profit.toFixed(2)})`;
    }
    if (settings.stop_loss > 0 && state.profit <= -settings.stop_loss) {
        return `stop loss reached (-$${Math.abs(state.profit).toFixed(2)})`;
    }
    if (!state.paused && settings.stop_loss > 0 && round2(state.current_stake - state.profit) > settings.stop_loss) {
        return `stop loss would be exceeded if the next $${state.current_stake.toFixed(2)} trade lost (session P/L ${
            state.profit >= 0 ? '+' : '-'
        }$${Math.abs(state.profit).toFixed(2)}, stop loss $${settings.stop_loss.toFixed(2)})`;
    }
    return null;
};

const PURCHASE_FAILURE_LIMIT = 3;

/** Record a purchase that did not go through; pauses trading after repeated failures. */
export const recordFddPurchaseFailure = (state, message) => {
    state.purchase_failures += 1;
    if (state.purchase_failures >= PURCHASE_FAILURE_LIMIT) {
        state.paused = `purchase failed ${state.purchase_failures} times in a row (${message})`;
        return true;
    }
    return false;
};

export const FDD_PURCHASE_FAILURE_LIMIT = PURCHASE_FAILURE_LIMIT;

/**
 * Process one new tick: extract the barrier, then check entry conditions, risk limits
 * and recovery status. Returns READY / WAITING / ERROR / STOPPED with the reason.
 */
export const evaluateFddTick = (state, { quote, epoch, pip_size, now }, settings) => {
    state.tick_count += 1;
    state.last_epoch = epoch;
    state.price = formatPrice(quote, pip_size);
    const decimals = readLastTwoDecimals(quote, pip_size);
    if (decimals === null) {
        state.entry_status = 'WAITING';
        state.last_two = null;
        state.digit = null;
        state.barrier = null;
        state.stable_ticks = 0;
        return { decision: 'ERROR', reason: 'invalid tick price', checks: [] };
    }
    const { pair } = decimals;
    state.last_two = `${decimals.first}${decimals.second}`;
    if (pair !== null) {
        state.stable_ticks = pair === state.barrier ? state.stable_ticks + 1 : 1;
        if (state.last_pair !== null) state.previous_barrier = state.last_pair;
        state.last_pair = pair;
        state.barrier = pair;
    } else {
        state.stable_ticks = 0;
        state.barrier = null;
    }
    state.digit = pair;

    const checks = [];
    const wait = reason => {
        state.entry_status = 'WAITING';
        return { decision: 'WAITING', reason, checks };
    };

    if (state.stale) return wait('no new tick received (stale data)');
    if (!settings.auto_trading) return wait('auto trading is OFF (analysis only)');
    checks.push('auto trading ON');

    if (state.last_trade_epoch !== null && epoch === state.last_trade_epoch) return wait('duplicate signal');
    if (pair === null) {
        return wait(
            `entry conditions not satisfied (last two decimals ${decimals.first} and ${decimals.second} are not the same)`
        );
    }
    if (state.stable_ticks < settings.confirmation_ticks) {
        return wait(
            `entry conditions not satisfied (repeated digit ${pair} seen on ${state.stable_ticks}/${settings.confirmation_ticks} consecutive ticks)`
        );
    }
    checks.push(`last two decimals ${pair}${pair} match — entry conditions PASSED`);

    const stop = fddStopReason(state, settings);
    if (stop) {
        state.entry_status = 'STOPPED';
        return { decision: 'STOPPED', reason: stop, checks };
    }
    if (state.last_trade_at !== null) {
        const left = settings.cooldown_seconds * 1000 - (now - state.last_trade_at);
        if (left > 0) return wait(`cooldown active (${Math.ceil(left / 1000)}s left)`);
    }
    checks.push('risk limits ok');

    if (state.paused) return wait(state.paused);
    checks.push(`recovery level ${state.recovery_level} ok`);

    state.entry_status = 'READY';
    return { decision: 'READY', reason: 'entry conditions satisfied', checks };
};

/**
 * Record a settled contract and apply the recovery rule. Returns
 * { won, event, from_stake, next_stake, from_level, next_level }.
 */
export const applyFddResult = (state, { profit, stake }) => {
    const settings = state.settings;
    const p = Number(profit) || 0;
    const traded = round2(Number(stake) || state.current_stake);
    const won = p > 0;
    const from_level = state.recovery_level;
    state.trades += 1;
    state.profit = round2(state.profit + p);
    state.last_result = won ? 'WIN' : 'LOSS';

    if (won) {
        state.wins += 1;
        state.consecutive_wins += 1;
        state.consecutive_losses = 0;
        state.current_stake = state.base_stake;
        state.recovery_level = 0;
        return {
            won,
            event: from_level > 0 ? 'RECOVERY_SUCCESS' : 'WIN',
            from_stake: traded,
            next_stake: state.current_stake,
            from_level,
            next_level: 0,
        };
    }

    state.losses += 1;
    state.consecutive_losses += 1;
    state.consecutive_wins = 0;
    const result = { won, from_stake: traded, from_level };

    if (!settings.recovery_enabled) {
        state.current_stake = state.base_stake;
        Object.assign(result, { event: 'LOSS_FLAT', next_stake: state.base_stake, next_level: 0 });
    } else {
        const next_stake = round2(traded * settings.recovery_multiplier);
        const next_level = from_level + 1;
        if (next_level > settings.max_recovery_level || next_stake > settings.max_recovery_stake) {
            state.paused = 'recovery limit reached';
            Object.assign(result, { event: 'RECOVERY_LIMIT', next_stake, next_level });
        } else {
            state.current_stake = next_stake;
            state.recovery_level = next_level;
            Object.assign(result, { event: 'RECOVERY', next_stake, next_level });
        }
    }
    if (!state.paused && state.consecutive_losses >= settings.max_consecutive_losses) {
        state.paused = 'maximum consecutive losses reached';
        result.consecutive_limit = true;
    }
    return result;
};

const money = v => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = v => `${v >= 0 ? '+' : '-'}${money(Math.abs(v))}`;

export const fddTickLines = ({ state, result }) => {
    const head = `#${state.tick_count} ${state.price ?? 'invalid price'}`;
    if (result.decision === 'ERROR') return [`${head} · ERROR — Unable to read the last two decimal digits.`];
    if (state.digit === null) return [`${head} → ${state.last_two} no match · WAITING`];
    const signal = `${head} → ${state.last_two} match`;
    if (result.decision === 'READY') {
        return [
            `${signal} · READY — DIFFER ${state.barrier} · ${money(state.current_stake)} (recovery level ${
                state.recovery_level
            })`,
        ];
    }
    if (result.decision === 'STOPPED') return [`${signal} · STOPPED — ${result.reason}`];
    return [`${signal} · WAITING — ${result.reason}`];
};

export const fddTradeLines = ({ barrier, stake, duration, duration_unit, recovery_level }) => [
    `Action: DIFFER ${barrier} | Stake: ${money(stake)} | Duration: ${duration} ${
        duration_unit === 't' ? (Number(duration) === 1 ? 'tick' : 'ticks') : duration_unit
    } | Recovery Level: ${recovery_level}`,
    'Submitting trade...',
];

export const fddPlacedLine = ({ barrier, contract_id, buy_price }) =>
    `TRADE PLACED — DIFFER ${barrier} | Trade submitted. Contract ID: ${contract_id} | Buy price: ${money(buy_price)}`;

export const fddResultLines = ({ state, outcome, barrier, profit, contract_id, balance, now }) => {
    const s = state.settings;
    const lines = [
        `[${clock(now)}] CONTRACT RESULT | Contract ID: ${contract_id ?? '—'} | Barrier: ${barrier ?? '—'} | Stake: ${money(
            outcome.from_stake
        )} | Result: ${outcome.won ? 'WIN' : 'LOSS'} | Profit: ${signed(profit)}`,
    ];
    switch (outcome.event) {
        case 'RECOVERY_SUCCESS':
            lines.push(
                'RECOVERY SUCCESS — RESETTING STAKE TO BASE STAKE',
                `Recovery Sequence Completed. | Resetting stake: ${money(outcome.from_stake)} → ${money(
                    outcome.next_stake
                )} | Recovery Level: ${outcome.from_level} → 0 | Next Stake: ${money(outcome.next_stake)}`
            );
            break;
        case 'WIN':
            lines.push(`Recovery Level: 0 | Next Stake: ${money(outcome.next_stake)}`);
            break;
        case 'RECOVERY':
            lines.push(
                `Recovery Activated. | Previous Stake: ${money(outcome.from_stake)} | Recovery Multiplier: ${
                    s.recovery_multiplier
                }× | Next Stake: ${money(outcome.next_stake)} | Recovery Level: ${outcome.from_level} → ${outcome.next_level}`
            );
            break;
        case 'RECOVERY_LIMIT':
            lines.push(
                'RECOVERY LIMIT REACHED — TRADING PAUSED',
                `Next recovery would be ${money(outcome.next_stake)} at level ${outcome.next_level} (limits: max level ${
                    s.max_recovery_level
                }, max stake ${money(s.max_recovery_stake)}). No further recovery trade will be placed.`
            );
            break;
        default:
            lines.push(`Recovery disabled — Next Stake: ${money(outcome.next_stake)} (base stake)`);
    }
    if (outcome.consecutive_limit) {
        lines.push(`TRADING PAUSED — maximum consecutive losses reached (${s.max_consecutive_losses})`);
    }
    lines.push(
        `Balance: ${balance ?? '—'} | Consecutive wins: ${state.consecutive_wins} | Consecutive losses: ${
            state.consecutive_losses
        } | Total P/L: ${signed(state.profit)}`
    );
    return lines;
};

export const fddStatusLines = (state, market) => [
    `BOT: ${FDD_BOT_NAME} | STATUS: ${state.paused && state.status === 'ANALYZING' ? 'PAUSED' : state.status} | MARKET: ${market}`,
    `LATEST PRICE: ${state.price ?? '—'} | LAST TWO DECIMALS: ${state.last_two ?? '—'} | CURRENT BARRIER: ${
        state.barrier ?? '—'
    }`,
    `BASE STAKE: ${money(state.base_stake)} | CURRENT STAKE: ${money(state.current_stake)} | RECOVERY MULTIPLIER: ${
        state.settings.recovery_multiplier
    }× | RECOVERY LEVEL: ${state.recovery_level}`,
    `LAST RESULT: ${state.last_result} | CONSECUTIVE LOSSES: ${state.consecutive_losses} | TRADES: ${state.trades} | WINS: ${
        state.wins
    } | LOSSES: ${state.losses} | TOTAL P/L: ${signed(state.profit)}`,
];

export const fddSettingsLines = s => [
    `${FDD_BOT_NAME} — trades only when the last two decimals of the tick are the same (4681.33 → DIFFER 3); barrier is automatic`,
    `Base stake ${money(s.base_stake)} | Recovery ${s.recovery_enabled ? 'ON' : 'OFF'} × ${s.recovery_multiplier} | Max recovery level ${
        s.max_recovery_level
    } | Max recovery stake ${money(s.max_recovery_stake)} | Max consecutive losses ${s.max_consecutive_losses}`,
    `Stop loss ${s.stop_loss > 0 ? money(s.stop_loss) : 'off'} | Take profit ${
        s.take_profit > 0 ? money(s.take_profit) : 'off'
    } | Max trades ${s.max_trades} | Cooldown ${s.cooldown_seconds}s | Confirmation ${s.confirmation_ticks} tick(s) | Auto trading ${
        s.auto_trading ? 'ON' : 'OFF (analysis only)'
    }`,
];
