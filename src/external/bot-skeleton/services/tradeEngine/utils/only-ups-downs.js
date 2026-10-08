/**
 * Only Ups / Only Downs from the latest four tick digits.
 *
 * All four below 5 buy Only Ups. All four above 4 buy Only Downs.
 * A mix, a short list, or the same four ticks again do not trade.
 * A loss multiplies the stake by exactly 1.5. A win returns to the base stake.
 */

const isDigit = digit => Number.isInteger(digit) && digit >= 0 && digit <= 9;

export const ONLY_UPS = 1;
export const ONLY_DOWNS = -1;
export const ONLY_NONE = 0;

/** Newest four digits. The list end is the newest tick. */
export const evaluateOnlyUpsDowns = digits => {
    const raw = (Array.isArray(digits) ? digits : []).map(digit => Number(digit));
    const sample = raw.slice(-4);
    const ready = raw.length >= 4 && sample.length === 4 && sample.every(isDigit);
    if (!ready) {
        return {
            trade: ONLY_NONE,
            ready: false,
            digits: sample.filter(isDigit),
            condition: 'WAITING',
            signal: 'NONE',
            action: 'NO TRADE',
        };
    }
    const allBelow = sample.every(digit => digit < 5);
    const allAbove = sample.every(digit => digit > 4);
    if (allBelow) {
        return {
            trade: ONLY_UPS,
            ready: true,
            digits: sample,
            condition: 'ALL BELOW 5',
            signal: 'ONLY UPS',
            action: 'TRADE',
        };
    }
    if (allAbove) {
        return {
            trade: ONLY_DOWNS,
            ready: true,
            digits: sample,
            condition: 'ALL ABOVE 4',
            signal: 'ONLY DOWNS',
            action: 'TRADE',
        };
    }
    return {
        trade: ONLY_NONE,
        ready: true,
        digits: sample,
        condition: 'MIXED',
        signal: 'NONE',
        action: 'NO TRADE',
    };
};

/** $1.00, $1.50, $2.25, $3.375 — at least two decimals, extra places kept. */
export const formatOnlyUpsDownsStake = value => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '$0.00';
    const text = (Math.round(amount * 1e8) / 1e8).toFixed(8).replace(/\.?0+$/, '');
    const [whole, fraction = ''] = text.split('.');
    return `$${whole}.${fraction.length < 2 ? fraction.padEnd(2, '0') : fraction}`;
};

export const onlyUpsDownsAnalysisLines = report => [
    '[ANALYSIS]',
    `Latest 4 digits: ${report.digits.length ? report.digits.join(',') : '—'}`,
    `Condition: ${report.condition}`,
    `Signal: ${report.signal}`,
    `Action: ${report.action}`,
];

export const onlyUpsDownsTradeLines = ({ signal, stake, level }) => {
    const step = Math.floor(Number(level));
    return [
        '[TRADE]',
        `Direction: ${signal}`,
        `Stake: ${formatOnlyUpsDownsStake(stake)}`,
        `Martingale level: ${Number.isFinite(step) && step > 0 ? step : 0}`,
    ];
};

export const onlyUpsDownsResultLines = ({ won, previous, next }) => [
    '[RESULT]',
    `Result: ${won ? 'WIN' : 'LOSS'}`,
    `Previous stake: ${formatOnlyUpsDownsStake(previous)}`,
    `Next stake: ${formatOnlyUpsDownsStake(next)}`,
    'Martingale multiplier: 1.5',
];

/** Win returns the base stake. Loss multiplies the stake that was just used by 1.5. */
export const nextOnlyUpsDownsStake = ({ won, current, base }) => {
    if (won) {
        const start = Number(base);
        return Number.isFinite(start) && start > 0 ? start : Number(current) || 0;
    }
    const stake = Number(current);
    if (!Number.isFinite(stake) || stake <= 0) return 0;
    return stake * 1.5;
};

/**
 * 1 = take profit, -1 = consecutive losses reached the stop, 0 = trade again.
 * Take profit wins when both are true. A blank loss limit stops after 5 losses.
 * A take profit of 0 does not stop on the first tick.
 */
export const onlyUpsDownsLimitCode = ({ total, takeProfit, losses, maxLosses }) => {
    const profit = Number(total);
    const target = Number(takeProfit);
    const streak = Math.floor(Number(losses));
    const requested = Math.floor(Number(maxLosses));
    const stopAfter = Number.isFinite(requested) && requested >= 1 ? requested : 5;
    if (Number.isFinite(target) && target > 0 && Number.isFinite(profit) && profit >= target) return 1;
    if (Number.isFinite(streak) && streak >= stopAfter) return -1;
    return 0;
};

/**
 * One decision per tick. A second look at the same tick does not journal again
 * and does not trade again after that tick already produced a trade.
 */
export const resolveOnlyUpsDownsCall = ({ digits, epoch, seenEpoch, tradedEpoch, stake, level }) => {
    const tick = /^\d+$/.test(String(epoch || '')) ? String(epoch) : '';
    const seen = String(seenEpoch || '');
    const traded = String(tradedEpoch || '');
    if (!tick) {
        if (seen === 'empty') {
            return { code: ONLY_NONE, lines: [], seenEpoch: 'empty', tradedEpoch: traded, repeat: true };
        }
        const report = evaluateOnlyUpsDowns(digits);
        return {
            code: ONLY_NONE,
            lines: onlyUpsDownsAnalysisLines(report),
            seenEpoch: 'empty',
            tradedEpoch: traded,
            repeat: false,
        };
    }
    if (tick === seen) {
        return {
            code: tick === traded ? ONLY_NONE : evaluateOnlyUpsDowns(digits).trade,
            lines: [],
            seenEpoch: seen,
            tradedEpoch: traded,
            repeat: true,
        };
    }
    const report = evaluateOnlyUpsDowns(digits);
    const lines = onlyUpsDownsAnalysisLines(report);
    if (report.trade === ONLY_NONE) {
        return { code: ONLY_NONE, lines, seenEpoch: tick, tradedEpoch: traded, repeat: false };
    }
    lines.push(...onlyUpsDownsTradeLines({ signal: report.signal, stake, level }));
    return { code: report.trade, lines, seenEpoch: tick, tradedEpoch: tick, repeat: false };
};
