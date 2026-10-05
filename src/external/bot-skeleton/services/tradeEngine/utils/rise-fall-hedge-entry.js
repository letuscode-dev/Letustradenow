/**
 * Rise/Fall Hedge — Entry Engine.
 *
 * Scores recent tick behaviour (0–13) to decide WHEN the hedge may fire. The score
 * never picks a side: an approved entry always buys Rise AND Fall through the
 * existing hedge execution. Directional readings only describe the market condition.
 *
 * Components: momentum 0–2, acceleration 0–2, pattern repetition 0–3,
 * tick strength 0–2, reversal/exhaustion 0–2, multi-window confirmation 0–2.
 */
import { computeHedgeStats } from './rise-fall-hedge';

export const MAX_ENTRY_SCORE = 13;
const ENTRY_LOG_KEY = 'rise_fall_hedge_entry_log_v1';
const MAX_ENTRY_LOG = 500;
const REVERSAL_MAX_CONFIRM_TICKS = 3;
const REVERSAL_MIN_HISTORY = 5;
const ADAPTIVE_MAX_RAISE = 3;

export const ENTRY_MODES = {
    MOMENTUM: 'MOMENTUM',
    ACCELERATION: 'MOMENTUM ACCELERATION',
    PATTERN: 'PATTERN REPETITION',
    REVERSAL: 'REVERSAL/EXHAUSTION',
    MULTI_CONFIRMATION: 'MULTI-CONFIRMATION',
    ADAPTIVE: 'COMBINED ADAPTIVE',
};

export const ENTRY_DEFAULTS = {
    enabled: true,
    mode: 'MULTI_CONFIRMATION',
    min_score: 8,
    min_bias: 65,
    lookback: 50,
    short_window: 10,
    medium_window: 20,
    long_window: 50,
    acceleration_threshold: 20,
    strength_ratio: 1.5,
    pattern_length: 5,
    pattern_history: 1000,
    min_pattern_samples: 20,
    pattern_threshold: 65,
    exhaustion_run: 6,
    min_payout: 0,
    max_simultaneous: 1,
    log_no_trade: true,
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

/** Accepts the letter (A–F) or the name of the entry mode. */
export const parseEntryMode = raw => {
    const s = String(raw ?? '')
        .trim()
        .toUpperCase();
    if (s === 'A') return 'MOMENTUM';
    if (s === 'B' || s.includes('ACCEL')) return 'ACCELERATION';
    if (s === 'C' || s.includes('PATTERN')) return 'PATTERN';
    if (s === 'D' || s.includes('REVERS') || s.includes('EXHAUST')) return 'REVERSAL';
    if (s === 'F' || s.includes('ADAPT') || s.includes('COMBINED')) return 'ADAPTIVE';
    if (s === 'E' || s.includes('MULTI') || s.includes('CONFIRM')) return 'MULTI_CONFIRMATION';
    if (s.includes('MOMENTUM')) return 'MOMENTUM';
    return ENTRY_DEFAULTS.mode;
};

export const normalizeEntrySettings = (raw = {}) => {
    const d = ENTRY_DEFAULTS;
    const pattern_length = num(raw.pattern_length, d.pattern_length, 3, 10, true);
    return {
        enabled: bool(raw.enabled, d.enabled),
        mode: parseEntryMode(raw.mode ?? d.mode),
        min_score: num(raw.min_score, d.min_score, 0, MAX_ENTRY_SCORE, true),
        min_bias: num(raw.min_bias, d.min_bias, 50, 100),
        lookback: num(raw.lookback, d.lookback, 20, 1000, true),
        short_window: num(raw.short_window, d.short_window, 2, 500, true),
        medium_window: num(raw.medium_window, d.medium_window, 2, 1000, true),
        long_window: num(raw.long_window, d.long_window, 2, 1000, true),
        acceleration_threshold: num(raw.acceleration_threshold, d.acceleration_threshold, 0, 100),
        strength_ratio: num(raw.strength_ratio, d.strength_ratio, 1, 100),
        pattern_length,
        pattern_history: num(raw.pattern_history, d.pattern_history, pattern_length + 10, 5000, true),
        min_pattern_samples: num(raw.min_pattern_samples, d.min_pattern_samples, 1, 100000, true),
        pattern_threshold: num(raw.pattern_threshold, d.pattern_threshold, 50, 100),
        exhaustion_run: num(raw.exhaustion_run, d.exhaustion_run, 3, 100, true),
        min_payout: num(raw.min_payout, d.min_payout, 0, 1000000),
        max_simultaneous: num(raw.max_simultaneous, d.max_simultaneous, 1, 100, true),
        log_no_trade: bool(raw.log_no_trade, d.log_no_trade),
    };
};

const round8 = v => Math.round(v * 1e8) / 1e8;
const round2 = v => Math.round(v * 100) / 100;

/** Price changes between consecutive ticks (null when a quote is not a number). */
export const priceMoves = prices => {
    const moves = [];
    for (let i = 1; i < prices.length; i++) {
        const a = Number(prices[i - 1]);
        const b = Number(prices[i]);
        moves.push(Number.isFinite(a) && Number.isFinite(b) ? round8(b - a) : null);
    }
    return moves;
};

/** U = up tick, D = down tick, F = unchanged. */
export const tickDirections = moves => moves.map(m => (m === null || m === 0 ? 'F' : m > 0 ? 'U' : 'D'));

/** Counts, percentages (of up + down ticks) and sequences for a window of directions. */
export const windowStats = dirs => {
    let up = 0;
    let down = 0;
    let longest_up = 0;
    let longest_down = 0;
    let run = 0;
    let run_dir = null;
    dirs.forEach(dir => {
        if (dir === 'U') up += 1;
        if (dir === 'D') down += 1;
        run = dir === run_dir ? run + 1 : 1;
        run_dir = dir;
        if (dir === 'U') longest_up = Math.max(longest_up, run);
        if (dir === 'D') longest_down = Math.max(longest_down, run);
    });
    const decisive = up + down;
    const up_pct = decisive ? (up / decisive) * 100 : 50;
    return {
        ticks: dirs.length,
        up,
        down,
        up_pct,
        down_pct: decisive ? 100 - up_pct : 50,
        longest_up,
        longest_down,
        current: { dir: run_dir, length: run },
    };
};

const lean = stats =>
    stats.up_pct >= stats.down_pct ? { dir: 'UP', pct: stats.up_pct } : { dir: 'DOWN', pct: stats.down_pct };

const avg = arr => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

const runsOf = dirs =>
    dirs.reduce((runs, dir) => {
        const last = runs[runs.length - 1];
        if (last && last.dir === dir) last.length += 1;
        else runs.push({ dir, length: 1 });
        return runs;
    }, []);

const pct = v => `${v.toFixed(1)}%`;
const word = dir => (dir === 'U' ? 'UP' : dir === 'D' ? 'DOWN' : 'FLAT');

const momentumComponent = (dirs, s) => {
    const stats = windowStats(dirs.slice(-s.lookback));
    const l = lean(stats);
    const score = l.pct > 50 && l.pct >= s.min_bias ? 2 : 0;
    return {
        score,
        max: 2,
        lean: l,
        stats,
        detail: `last ${stats.ticks}: UP ${stats.up} (${pct(stats.up_pct)}) DOWN ${stats.down} (${pct(stats.down_pct)}) | longest UP ${stats.longest_up} DOWN ${stats.longest_down} | current ${word(stats.current.dir)} x${stats.current.length}`,
    };
};

const accelerationComponent = (dirs, s) => {
    const w = s.short_window;
    const cur = windowStats(dirs.slice(-w));
    const prev = windowStats(dirs.slice(-2 * w, -w));
    const up_change = cur.up_pct - prev.up_pct;
    const down_change = cur.down_pct - prev.down_pct;
    const dir = up_change >= down_change ? 'UP' : 'DOWN';
    const change = Math.max(up_change, down_change);
    const score = change > 0 && change >= s.acceleration_threshold ? 2 : 0;
    return {
        score,
        max: 2,
        dir,
        change,
        cur,
        prev,
        detail: `UP ${pct(prev.up_pct)} → ${pct(cur.up_pct)}, DOWN ${pct(prev.down_pct)} → ${pct(cur.down_pct)} (${dir} +${change.toFixed(1)} pts, need ${s.acceleration_threshold})`,
    };
};

const strengthComponent = (moves, s) => {
    const w = s.short_window;
    const recent = moves.slice(-w);
    const prior = moves.slice(-2 * w, -w);
    if (recent.some(m => m === null) || prior.some(m => m === null) || !recent.length) {
        return { score: 0, max: 2, available: false, detail: 'no price data — not scored' };
    }
    const avg_up = avg(recent.filter(m => m > 0));
    const avg_down = avg(recent.filter(m => m < 0).map(Math.abs));
    const strength = avg(recent.map(Math.abs));
    const prior_strength = avg(prior.map(Math.abs));
    const acceleration = prior_strength ? strength / prior_strength : null;
    const base = {
        max: 2,
        available: true,
        avg_up,
        avg_down,
        strength,
        acceleration,
    };
    const f = v => (v === null ? '—' : String(round8(v)));
    const info = `avg UP ${f(avg_up)} | avg DOWN ${f(avg_down)} | strength ${f(strength)} | acceleration ${
        acceleration === null ? '—' : `${acceleration.toFixed(2)}x`
    }`;
    if (avg_up === null && avg_down === null) {
        return { ...base, score: 0, detail: `${info} — no movement` };
    }
    if (avg_up === null || avg_down === null) {
        const dir = avg_up === null ? 'DOWN' : 'UP';
        return { ...base, score: 2, dir, detail: `${info} | only ${dir} moves in the last ${recent.length} ticks` };
    }
    const ratio = Math.max(avg_up, avg_down) / Math.min(avg_up, avg_down);
    const dir = avg_up >= avg_down ? 'UP' : 'DOWN';
    const score = ratio >= s.strength_ratio ? 2 : 0;
    return {
        ...base,
        score,
        dir,
        ratio,
        detail: `${info} | ${score ? `${dir} stronger ${ratio.toFixed(2)}x` : `neutral ${ratio.toFixed(2)}x`} (need ${s.strength_ratio}x)`,
    };
};

/**
 * Finds every earlier occurrence of the latest pattern and how price moved over the
 * next 2 ticks (net change). Percentages are over occurrences that moved up or down.
 */
export const patternStats = (dirs, moves, length) => {
    const pattern = dirs.slice(-length).join('');
    const seq = dirs.join('');
    let up = 0;
    let down = 0;
    let flat = 0;
    for (let i = 0; i <= dirs.length - length - 2; i++) {
        if (!seq.startsWith(pattern, i)) continue;
        const a = moves[i + length];
        const b = moves[i + length + 1];
        if (a === null || b === null) continue;
        const net = round8(a + b);
        if (net > 0) up += 1;
        else if (net < 0) down += 1;
        else flat += 1;
    }
    const samples = up + down;
    return {
        pattern,
        occurrences: up + down + flat,
        samples,
        up,
        down,
        flat,
        up_pct: samples ? (up / samples) * 100 : 0,
        down_pct: samples ? (down / samples) * 100 : 0,
    };
};

const patternComponent = (dirs, moves, s) => {
    const start = Math.max(0, dirs.length - s.pattern_history);
    const p = patternStats(dirs.slice(start), moves.slice(start), s.pattern_length);
    const l = p.up_pct >= p.down_pct ? { dir: 'UP', pct: p.up_pct } : { dir: 'DOWN', pct: p.down_pct };
    const enough = p.samples >= s.min_pattern_samples;
    const score = enough && l.pct > 50 && l.pct >= s.pattern_threshold ? 3 : 0;
    const shown = p.pattern
        .split('')
        .map(c => word(c))
        .join(' ');
    return {
        score,
        max: 3,
        ...p,
        lean: l,
        enough,
        detail: `${shown} | seen ${p.occurrences}x, next 2 ticks UP ${p.up} DOWN ${p.down} flat ${p.flat} | ${
            enough ? `${l.dir} continuation ${pct(l.pct)} (need ${s.pattern_threshold}%)` : `only ${p.samples} samples (need ${s.min_pattern_samples})`
        }`,
    };
};

const reversalComponent = (dirs, moves, s, acceleration, strength) => {
    const history = dirs.slice(-s.pattern_history);
    const runs = runsOf(history);
    const last = runs[runs.length - 1];
    const prev = runs[runs.length - 2];
    const none = reason => ({ score: 0, max: 2, confirmations: [], detail: reason });
    if (!last || !prev || last.dir === 'F' || prev.dir === 'F' || last.dir === prev.dir) {
        return none('no exhausted sequence');
    }
    if (prev.length < s.exhaustion_run) {
        return none(`last ${word(prev.dir)} run ${prev.length} (need ${s.exhaustion_run})`);
    }
    if (last.length > REVERSAL_MAX_CONFIRM_TICKS) {
        return none(`${word(prev.dir)} x${prev.length} reversed ${last.length} ticks ago — too late`);
    }

    const prior_word = word(prev.dir);
    const opposite_word = word(last.dir);
    const confirmations = [];
    const share = stats => (prev.dir === 'U' ? stats.up_pct : stats.down_pct);
    if (share(acceleration.cur) < share(acceleration.prev)) confirmations.push(`${prior_word} momentum weakening`);
    if (acceleration.dir === opposite_word && acceleration.change >= s.acceleration_threshold && acceleration.change > 0) {
        confirmations.push(`${opposite_word} acceleration`);
    }
    const past = runs.slice(0, -2);
    let exhausted = 0;
    let reversed = 0;
    for (let i = 0; i < past.length - 1; i++) {
        if (past[i].dir === prev.dir && past[i].length >= s.exhaustion_run) {
            exhausted += 1;
            if (past[i + 1].dir === last.dir && past[i + 1].length >= 2) reversed += 1;
        }
    }
    const reversal_rate = exhausted ? (reversed / exhausted) * 100 : 0;
    if (exhausted >= REVERSAL_MIN_HISTORY && reversal_rate >= s.min_bias) {
        confirmations.push(`historical reversal ${reversed}/${exhausted}`);
    }
    if (strength.available && strength.avg_up !== null && strength.avg_down !== null) {
        const opposite_avg = last.dir === 'U' ? strength.avg_up : strength.avg_down;
        const prior_avg = last.dir === 'U' ? strength.avg_down : strength.avg_up;
        if (opposite_avg > prior_avg) confirmations.push(`${opposite_word} moves stronger`);
    }
    const score = confirmations.length ? 2 : 0;
    return {
        score,
        max: 2,
        dir: opposite_word,
        confirmations,
        detail: `${prior_word} x${prev.length} then ${opposite_word} x${last.length} | ${
            confirmations.length ? `confirmed: ${confirmations.join(', ')}` : 'no confirmation — not scored'
        } | history ${reversed}/${exhausted} reversed`,
    };
};

const multiWindowComponent = (dirs, s) => {
    const windows = [s.short_window, s.medium_window, s.long_window].map(w => ({ w, ...lean(windowStats(dirs.slice(-w))) }));
    const agree = windows.every(x => x.dir === windows[0].dir && x.pct > 50);
    const score = agree && windows[0].pct >= s.min_bias ? 2 : 0;
    return {
        score,
        max: 2,
        windows,
        dir: agree ? windows[0].dir : null,
        detail: `${windows.map(x => `${x.w}t ${x.dir} ${pct(x.pct)}`).join(' | ')} | ${
            score ? `all agree ${windows[0].dir}` : agree ? `agree but short window under ${s.min_bias}%` : 'windows disagree'
        }`,
    };
};

export const requiredTicks = s =>
    Math.max(s.lookback, s.long_window, s.medium_window, 2 * s.short_window, s.pattern_length + 2) + 1;

/** Full entry analysis over tick prices (oldest first). */
export const analyzeHedgeEntry = (prices, settings) => {
    const s = settings;
    const need = requiredTicks(s);
    if (prices.length < need) return { status: 'COLLECTING', have: prices.length, need };
    const moves = priceMoves(prices);
    const dirs = tickDirections(moves);
    const momentum = momentumComponent(dirs, s);
    const acceleration = accelerationComponent(dirs, s);
    const strength = strengthComponent(moves, s);
    const pattern = patternComponent(dirs, moves, s);
    const reversal = reversalComponent(dirs, moves, s, acceleration, strength);
    const multi_window = multiWindowComponent(dirs, s);
    const components = { momentum, acceleration, pattern, strength, reversal, multi_window };
    const score = Object.values(components).reduce((sum, c) => sum + c.score, 0);
    return {
        status: 'READY',
        have: prices.length,
        need,
        components,
        score,
        bias: momentum.lean,
        side_scores: sideScores(components),
    };
};

/** Points supporting each side (Rise = UP, Fall = DOWN). Reporting only — both legs are always bought. */
export const sideScores = c => {
    const sides = { RISE: 0, FALL: 0 };
    const add = (dir, points) => {
        if (!points) return;
        if (dir === 'UP') sides.RISE += points;
        if (dir === 'DOWN') sides.FALL += points;
    };
    add(c.momentum.lean?.dir, c.momentum.score);
    add(c.acceleration.dir, c.acceleration.score);
    add(c.pattern.lean?.dir, c.pattern.score);
    add(c.strength.dir, c.strength.score);
    add(c.reversal.dir, c.reversal.score);
    add(c.multi_window.dir, c.multi_window.score);
    return sides;
};

/** Combined Adaptive raises the minimum score by 1 per consecutive losing adaptive hedge (max +3). */
export const requiredEntryScore = (settings, hedges = []) => {
    if (settings.mode !== 'ADAPTIVE') return settings.min_score;
    const adaptive = hedges.filter(h => h.entry?.mode === 'ADAPTIVE');
    const streak = computeHedgeStats(adaptive).current_consecutive_losses;
    return Math.min(MAX_ENTRY_SCORE, settings.min_score + Math.min(ADAPTIVE_MAX_RAISE, streak));
};

const MODE_SIGNAL = {
    MOMENTUM: c => (c.momentum.score ? null : 'Momentum mode: no directional bias at the threshold.'),
    ACCELERATION: c => (c.acceleration.score ? null : 'Acceleration mode: momentum did not accelerate enough.'),
    PATTERN: c => (c.pattern.score ? null : 'Pattern mode: pattern continuation below threshold.'),
    REVERSAL: c => (c.reversal.score ? null : 'Reversal mode: no confirmed exhaustion/reversal.'),
    MULTI_CONFIRMATION: c =>
        c.multi_window.score && c.momentum.score ? null : 'Multi-Confirmation mode: windows and momentum do not both confirm.',
    ADAPTIVE: c =>
        Object.values(c).filter(x => x.score > 0).length >= 3 ? null : 'Adaptive mode: fewer than 3 components agree.',
};

/** Live CALL/PUT proposals as Deriv quoted them (never estimated). */
export const readHedgePayouts = (proposals = [], purchase_reference) => {
    const find = type =>
        proposals.find(
            p => p.contract_type === type && (purchase_reference === undefined || p.purchase_reference === purchase_reference)
        );
    const rise = find('CALL');
    const fall = find('PUT');
    const value = p => (p && !p.error && Number.isFinite(Number(p.payout)) ? Number(p.payout) : null);
    const problem = (label, p) => {
        if (!p) return `${label} has no live price`;
        if (p.error) return `${label}: ${p.error.message || 'not available'}`;
        if (value(p) === null) return `${label} payout missing`;
        return null;
    };
    const problems = [problem('Rise', rise), problem('Fall', fall)].filter(Boolean);
    return {
        rise: value(rise),
        fall: value(fall),
        rise_ask: rise && !rise.error ? Number(rise.ask_price) : null,
        fall_ask: fall && !fall.error ? Number(fall.ask_price) : null,
        available: problems.length === 0,
        problem: problems.join('; '),
    };
};

/** Potential combined result for each outcome, from the quoted payouts. */
export const hedgeEconomics = (stake, payouts) => {
    const total_stake = round2(stake * 2);
    const outcome = payout => (payout === null ? null : round2(payout - total_stake));
    return {
        total_stake,
        rise_wins: outcome(payouts.rise),
        fall_wins: outcome(payouts.fall),
        both_lose: -total_stake,
    };
};

/**
 * Every condition an entry must pass. `temporary_block` is the cooldown message from
 * the hedge risk gates (hard limits stop the bot before this is called).
 */
export const decideHedgeEntry = ({ analysis, settings, required_score, payouts, open_hedges = 0, temporary_block = null }) => {
    const c = analysis.components;
    const capacity = Math.min(settings.max_simultaneous, 1);
    const conditions = [
        { name: 'Entry engine enabled', ok: settings.enabled, reason: 'Entry engine disabled.' },
        {
            name: `Entry score ${analysis.score}/${MAX_ENTRY_SCORE} >= ${required_score}`,
            ok: analysis.score >= required_score,
            reason: `Insufficient entry score (${analysis.score}/${MAX_ENTRY_SCORE}, minimum ${required_score}).`,
        },
        { name: `${ENTRY_MODES[settings.mode]} signal`, ok: !MODE_SIGNAL[settings.mode](c), reason: MODE_SIGNAL[settings.mode](c) },
    ];
    if (settings.mode === 'PATTERN') {
        conditions.push({
            name: `Pattern samples ${c.pattern.samples} >= ${settings.min_pattern_samples}`,
            ok: c.pattern.enough,
            reason: `Insufficient pattern samples (${c.pattern.samples}, minimum ${settings.min_pattern_samples}).`,
        });
    }
    conditions.push(
        {
            name: 'Both contracts available',
            ok: payouts.available,
            reason: `Contracts not available (${payouts.problem}).`,
        },
        {
            name: `Payout >= $${settings.min_payout.toFixed(2)} (${[
                payouts.rise >= settings.min_payout && 'Rise',
                payouts.fall >= settings.min_payout && 'Fall',
            ]
                .filter(Boolean)
                .join(' + ')})`,
            ok:
                payouts.available &&
                (payouts.rise >= settings.min_payout || payouts.fall >= settings.min_payout),
            reason: `Payout below threshold on both sides (Rise ${payouts.rise ?? '—'}, Fall ${payouts.fall ?? '—'}, minimum $${settings.min_payout.toFixed(2)}).`,
        },
        { name: 'Cooldown expired', ok: !temporary_block, reason: temporary_block },
        {
            name: `Simultaneous hedges < ${capacity}`,
            ok: open_hedges < capacity,
            reason: 'Maximum simultaneous hedges reached.',
        },
        { name: 'Risk limits', ok: true, reason: null }
    );
    const failed = conditions.find(x => !x.ok);
    return {
        approved: !failed,
        reason: failed ? failed.reason : null,
        passed: conditions.filter(x => x.ok).map(x => x.name),
        conditions,
    };
};

const money = v => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`);
const dollars = v => (v === null || v === undefined ? '—' : `$${Number(v).toFixed(2)}`);
const clock = ms => new Date(ms).toTimeString().slice(0, 8);
const signed = n => (n > 0 ? `+${n}` : '0');

/** Compact record stored for every evaluated entry (fired or not). */
export const entryRecord = ({ now, market, settings, analysis, required_score, payouts, decision }) => {
    const c = analysis.components;
    return {
        time: now,
        market,
        mode: settings.mode,
        strategy: ENTRY_MODES[settings.mode],
        score: analysis.score,
        required_score,
        scores: {
            momentum: c.momentum.score,
            acceleration: c.acceleration.score,
            pattern: c.pattern.score,
            strength: c.strength.score,
            reversal: c.reversal.score,
            multi_window: c.multi_window.score,
        },
        side_scores: analysis.side_scores ?? sideScores(c),
        bias: `${analysis.bias.dir} ${analysis.bias.pct.toFixed(1)}%`,
        pattern: c.pattern.pattern,
        pattern_samples: c.pattern.samples,
        rise_payout: payouts.rise,
        fall_payout: payouts.fall,
        decision: decision.approved ? 'HEDGE FIRED' : 'NO TRADE',
        reason: decision.reason,
        passed: decision.passed,
    };
};

/** Full journal block for an approved entry (and the hedge economics before execution). */
export const entryFiredLines = ({ record, analysis, stake, duration, economics }) => {
    const c = analysis.components;
    return [
        `${clock(record.time)}  ${record.market}  |  ENTRY ENGINE: ${record.strategy}`,
        `Momentum: ${signed(c.momentum.score)}  — ${c.momentum.detail}`,
        `Acceleration: ${signed(c.acceleration.score)}  — ${c.acceleration.detail}`,
        `Pattern: ${signed(c.pattern.score)}  — ${c.pattern.detail}`,
        `Strength: ${signed(c.strength.score)}  — ${c.strength.detail}`,
        `Reversal: ${signed(c.reversal.score)}  — ${c.reversal.detail}`,
        `Multi-window: ${signed(c.multi_window.score)}  — ${c.multi_window.detail}`,
        `ENTRY SCORE: ${record.score}/${MAX_ENTRY_SCORE} (minimum ${record.required_score}) | Rise side ${record.side_scores.RISE} | Fall side ${record.side_scores.FALL} | Directional bias: ${record.bias} (condition only — both sides are bought)`,
        `Rise payout: ${dollars(record.rise_payout)} | Fall payout: ${dollars(record.fall_payout)}`,
        `If Rise wins: ${money(economics.rise_wins)} | If Fall wins: ${money(economics.fall_wins)} | If both lose: ${money(
            economics.both_lose
        )} (total stake ${dollars(economics.total_stake)})`,
        `Passed: ${record.passed.join(' · ')}`,
        `DECISION: HEDGE FIRED — Rise ${dollars(stake)} + Fall ${dollars(stake)}, ${duration} ticks`,
    ];
};

/** One-line journal entry for an entry that did not fire. */
export const entryNoTradeLine = record => {
    const s = record.scores;
    return `${clock(record.time)} ${record.market} | ENTRY SCORE ${record.score}/${MAX_ENTRY_SCORE} (min ${
        record.required_score
    }) [Mom ${s.momentum} Acc ${s.acceleration} Pat ${s.pattern} Str ${s.strength} Rev ${s.reversal} Win ${
        s.multi_window
    }] Rise side ${record.side_scores.RISE} / Fall side ${record.side_scores.FALL} | Rise ${dollars(record.rise_payout)} Fall ${dollars(record.fall_payout)} | NO TRADE — ${record.reason}`;
};

/** Hedge stats per entry strategy, so strategies can be compared. */
export const strategyBreakdown = hedges => {
    const groups = {};
    hedges.forEach(h => {
        const key = h.entry?.strategy ?? 'NO ENTRY ENGINE';
        (groups[key] = groups[key] || []).push(h);
    });
    return Object.entries(groups)
        .map(([strategy, list]) => ({ strategy, stats: computeHedgeStats(list) }))
        .filter(g => g.stats.total > 0);
};

export const strategyBreakdownLines = hedges =>
    strategyBreakdown(hedges).map(
        ({ strategy, stats }) =>
            `${strategy}: Hedges ${stats.total} | Profitable ${stats.profitable} | Losses ${stats.losing} | Net P/L ${money(
                stats.net
            )} | Avg ${money(stats.average)}`
    );

/** Entry details for a settled hedge. */
export const hedgeEntryLines = hedge => {
    const e = hedge.entry;
    if (!e) return ['Entry: no entry engine (fired by the hedge trigger).'];
    return [
        `Entry: ${e.strategy} | score ${e.score}/${MAX_ENTRY_SCORE} (min ${e.required_score}) | bias ${e.bias} | pattern ${e.pattern} (${e.pattern_samples} samples) | quoted payout Rise ${dollars(
            e.rise_payout
        )} Fall ${dollars(e.fall_payout)}`,
        `Entry time ${new Date(e.time).toISOString().slice(11, 23)} | passed: ${e.passed.join(' · ')}`,
    ];
};

export const loadEntryLog = () => {
    try {
        const parsed = JSON.parse(window.localStorage?.getItem(ENTRY_LOG_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveEntryLog = log => {
    try {
        window.localStorage?.setItem(ENTRY_LOG_KEY, JSON.stringify(log.slice(-MAX_ENTRY_LOG)));
    } catch {
        // Storage full or unavailable — the journal still has the log.
    }
};

/** Entry engine settings shown when the bot starts. */
export const entrySettingsLines = s => [
    `ENTRY ENGINE: ${s.enabled ? 'ON' : 'OFF'} | Mode ${ENTRY_MODES[s.mode]} | Minimum score ${s.min_score}/${MAX_ENTRY_SCORE} | Directional bias ${s.min_bias}%`,
    `Windows: lookback ${s.lookback} | short ${s.short_window} | medium ${s.medium_window} | long ${s.long_window} | acceleration ${s.acceleration_threshold} pts | strength ${s.strength_ratio}x`,
    `Pattern: length ${s.pattern_length} | history ${s.pattern_history} ticks | min samples ${s.min_pattern_samples} | continuation ${s.pattern_threshold}% | exhaustion run ${s.exhaustion_run}`,
    `Minimum payout ${s.min_payout > 0 ? `$${s.min_payout.toFixed(2)}` : 'off'} | Max simultaneous hedges ${s.max_simultaneous}${
        s.max_simultaneous > 1 ? ' (Bot Builder holds one open hedge at a time — capped at 1)' : ''
    } | No-trade logging ${s.log_no_trade ? 'on' : 'off'}`,
];
