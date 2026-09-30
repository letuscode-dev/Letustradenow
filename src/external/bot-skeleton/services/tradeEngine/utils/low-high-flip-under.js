/**
 * Low-High Flip UNDER
 *
 * On the last four digits (previous_3, previous_2, previous_1, current):
 *   previous_3 < 4, previous_2 < 4, previous_1 > 5 and current > 5
 * → enter DIGITUNDER at the barrier owned by the bot's risk management
 * (Under 8 normally, Under 7 in loss recovery). The barrier is returned as the
 * prediction on a signal. Both thresholds are user-configurable.
 * `evaluateLowHighFlipScan` runs the same check across several markets.
 */

export const STATUS = {
    COLLECTING: 'COLLECTING',
    NO_PATTERN: 'NO_PATTERN',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    SIGNAL_CONSUMED: 'SIGNAL_CONSUMED',
    VALID_SIGNAL: 'VALID_SIGNAL',
};

export const PATTERN_LENGTH = 4;
export const HISTORY_TICKS = 10;

export const DEFAULT_OPTIONS = {
    low_below: 4,
    high_above: 5,
    barrier: 8,
    signal_cooldown_tips: 1,
    journal_enabled: true,
};

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') return default_value;
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toInt = (value, fallback, min, max) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

export const normalizeLowHighFlipOptions = (options = {}) => {
    const d = DEFAULT_OPTIONS;
    return {
        low_below: toInt(options.low_below, d.low_below, 1, 9),
        high_above: toInt(options.high_above, d.high_above, 0, 8),
        barrier: toInt(options.barrier, d.barrier, 1, 9),
        signal_cooldown_tips: toInt(options.signal_cooldown_tips, d.signal_cooldown_tips, 0, 100),
        journal_enabled: toBool(options.journal_enabled, d.journal_enabled),
    };
};

export const createLowHighFlipState = () => ({
    tip_index: -1,
    last_tip_fp: null,
    last_signal_tip: -1,
    last_result: null,
    pending_outcome: null,
    live: {
        signals: 0,
        wins: 0,
        losses: 0,
        history: [],
    },
});

export const resetLowHighFlipState = (state = null) => {
    const next = createLowHighFlipState();
    if (!state || typeof state !== 'object') return next;
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, next);
    return state;
};

const normalizeTicks = ticks =>
    (Array.isArray(ticks) ? ticks : []).flatMap(item => {
        const digit = toDigit(item && typeof item === 'object' ? item.digit ?? item.quote : item);
        if (digit === null) return [];
        const epoch = item && typeof item === 'object' ? Number(item.epoch) : NaN;
        return [{ digit, epoch: Number.isFinite(epoch) ? epoch : null }];
    });

const tipFingerprint = all_ticks => {
    const tip = all_ticks[all_ticks.length - 1];
    if (tip.epoch !== null) return `e:${tip.epoch}`;
    const tail = all_ticks
        .slice(-20)
        .map(t => t.digit)
        .join('');
    return `n:${all_ticks.length}:${tail}`;
};

/** Which of the four pattern conditions hold for [previous_3, previous_2, previous_1, current]. */
export const checkLowHighFlip = (digits, options = DEFAULT_OPTIONS) => {
    const [p3, p2, p1, current] = digits;
    const checks = [
        { label: `previous_3 (${p3}) < ${options.low_below}`, ok: p3 < options.low_below },
        { label: `previous_2 (${p2}) < ${options.low_below}`, ok: p2 < options.low_below },
        { label: `previous_1 (${p1}) > ${options.high_above}`, ok: p1 > options.high_above },
        { label: `current (${current}) > ${options.high_above}`, ok: current > options.high_above },
    ];
    return { matched: checks.every(c => c.ok), checks };
};

export const recordLowHighFlipOutcome = (state, actual_digit) => {
    if (!state?.pending_outcome) return null;
    const digit = toDigit(actual_digit);
    if (digit === null) return null;
    const { barrier } = state.pending_outcome;
    const won = digit < barrier;
    if (won) state.live.wins += 1;
    else state.live.losses += 1;
    state.live.signals += 1;
    state.live.history.push({ barrier, actual: digit, result: won ? 'WIN' : 'LOSS' });
    if (state.live.history.length > 200) state.live.history = state.live.history.slice(-200);
    state.pending_outcome = null;
    return { won, actual: digit, barrier };
};

const buildJournal = ({ options, recent, checks, status, rejection }) => {
    const messages = [
        {
            className: 'journal__text',
            message: `══ LOW-HIGH FLIP UNDER ${options.barrier} | p3,p2 < ${options.low_below} · p1,current > ${options.high_above} ══`,
        },
    ];
    if (recent.length) {
        messages.push({ className: 'journal__text', message: `Last digits: ${recent.join(' ')}` });
    }
    if (checks.length) {
        messages.push({
            className: 'journal__text',
            message: checks.map(c => `${c.label} ${c.ok ? '✓' : '✗'}`).join(' | '),
        });
    }
    if (status === STATUS.VALID_SIGNAL) {
        messages.push({
            className: 'journal__text--success',
            message: `STATUS: VALID SIGNAL — low, low, high, high pattern. ACTION: UNDER ${options.barrier}`,
        });
    } else {
        messages.push({ className: 'journal__text', message: `WHY NO TRADE? ${status} — ${rejection}` });
    }
    return messages;
};

export const evaluateLowHighFlip = (raw_ticks, raw_options = {}, state = createLowHighFlipState()) => {
    const options = normalizeLowHighFlipOptions(raw_options);
    const all_ticks = normalizeTicks(raw_ticks);

    if (!all_ticks.length) {
        return {
            prediction: -1,
            matched: false,
            status: STATUS.COLLECTING,
            rejection: 'No ticks yet.',
            why_no_trade: 'No ticks yet.',
            options,
            journal_messages: [],
        };
    }

    const fp = tipFingerprint(all_ticks);
    if (fp === state.last_tip_fp && state.last_result) {
        // The first poll of a tip already handed out its signal; re-polls must not re-trade it.
        if (state.last_result.matched) {
            const reason = 'Signal on this tick already traded — waiting for the next tick.';
            state.last_result = {
                ...state.last_result,
                prediction: -1,
                matched: false,
                contract_type: null,
                status: STATUS.SIGNAL_CONSUMED,
                rejection: reason,
                why_no_trade: reason,
            };
        }
        return { ...state.last_result, journal_messages: [] };
    }

    const tip = all_ticks[all_ticks.length - 1];
    const current = tip.digit;
    if (state.last_tip_fp !== null && state.pending_outcome) {
        const { epoch: signal_epoch } = state.pending_outcome;
        const settle_tick =
            signal_epoch !== null && tip.epoch !== null
                ? all_ticks.find(t => t.epoch !== null && t.epoch > signal_epoch)
                : tip;
        if (settle_tick) recordLowHighFlipOutcome(state, settle_tick.digit);
    }
    state.last_tip_fp = fp;
    state.tip_index += 1;

    const recent = all_ticks.slice(-HISTORY_TICKS).map(t => t.digit);
    let prediction = -1;
    let status;
    let rejection = '';
    let checks = [];

    if (all_ticks.length < PATTERN_LENGTH) {
        status = STATUS.COLLECTING;
        rejection = `Loading tick history ${all_ticks.length}/${PATTERN_LENGTH}.`;
    } else {
        const pattern = checkLowHighFlip(
            all_ticks.slice(-PATTERN_LENGTH).map(t => t.digit),
            options
        );
        checks = pattern.checks;
        const cooldown =
            options.signal_cooldown_tips > 0 &&
            state.last_signal_tip >= 0 &&
            state.tip_index - state.last_signal_tip <= options.signal_cooldown_tips;

        if (!pattern.matched) {
            status = STATUS.NO_PATTERN;
            rejection = `Failed: ${checks
                .filter(c => !c.ok)
                .map(c => c.label)
                .join(', ')}.`;
        } else if (cooldown) {
            status = STATUS.COOLDOWN_ACTIVE;
            rejection = `Cooldown active (${state.tip_index - state.last_signal_tip}/${options.signal_cooldown_tips} tips).`;
        } else {
            status = STATUS.VALID_SIGNAL;
            state.last_signal_tip = state.tip_index;
            prediction = options.barrier;
            state.pending_outcome = { barrier: options.barrier, epoch: tip.epoch };
        }
    }

    const journal_messages = options.journal_enabled
        ? buildJournal({ options, recent, checks, status, rejection })
        : [];

    const live_total = state.live.wins + state.live.losses;
    const result = {
        prediction,
        matched: prediction >= 0,
        contract_type: prediction >= 0 ? 'DIGITUNDER' : null,
        barrier: options.barrier,
        current,
        recent,
        checks,
        status,
        rejection,
        why_no_trade: prediction >= 0 ? '' : rejection || status,
        live: {
            ...state.live,
            win_rate: live_total > 0 ? (state.live.wins / live_total) * 100 : 0,
        },
        options,
        journal_messages,
    };
    state.last_result = result;
    return result;
};

export const createLowHighFlipScanState = () => ({ symbols: {} });

const describeSymbol = (symbol, result) => {
    const digits = (result.recent || []).slice(-PATTERN_LENGTH).join(' ');
    if (result.status === STATUS.VALID_SIGNAL) return `${symbol}: ${digits} ✓ pattern`;
    if (result.status === STATUS.NO_PATTERN) {
        const failed = (result.checks || []).filter(c => !c.ok).map(c => c.label.split(' ')[0]);
        return `${symbol}: ${digits} ✗ ${failed.join(', ')}`;
    }
    return `${symbol}: ${digits || '—'} ${result.status}${result.rejection ? ` (${result.rejection})` : ''}`;
};

/**
 * Multi-market scan. `markets` is [{ symbol, ticks }] in priority order (active
 * market first); each market keeps its own state so tips, re-polls and cooldowns
 * never mix. The first market with a valid signal is picked; other markets that
 * matched on the same poll are released without a pending outcome.
 */
export const evaluateLowHighFlipScan = (markets, raw_options = {}, scan_state = createLowHighFlipScanState()) => {
    const options = normalizeLowHighFlipOptions(raw_options);
    const list = (Array.isArray(markets) ? markets : []).filter(m => m && m.symbol);
    let any_new_tip = false;

    const evaluations = list.map(({ symbol, ticks }) => {
        if (!scan_state.symbols[symbol]) scan_state.symbols[symbol] = createLowHighFlipState();
        const state = scan_state.symbols[symbol];
        const tip_before = state.tip_index;
        const signal_before = state.last_signal_tip;
        const result = evaluateLowHighFlip(ticks, { ...options, journal_enabled: false }, state);
        if (state.tip_index !== tip_before) any_new_tip = true;
        return { symbol, result, state, signal_before };
    });

    const picked = evaluations.find(e => e.result.matched) || null;
    evaluations.forEach(e => {
        if (e !== picked && e.result.matched) {
            e.state.pending_outcome = null;
            e.state.last_signal_tip = e.signal_before;
        }
    });

    let rejection = '';
    if (!list.length) rejection = 'No markets to scan.';
    else if (!picked) {
        const collecting = evaluations.filter(e => e.result.status === STATUS.COLLECTING).length;
        rejection =
            collecting === evaluations.length
                ? 'Loading ticks for all markets.'
                : `No market matched the pattern (${evaluations.length} scanned).`;
    }

    const journal_messages = [];
    if (options.journal_enabled && any_new_tip) {
        journal_messages.push({
            className: 'journal__text',
            message: `══ LOW-HIGH FLIP UNDER ${options.barrier} | ${list.length} markets | p3,p2 < ${options.low_below} · p1,current > ${options.high_above} ══`,
        });
        evaluations.forEach(e => {
            journal_messages.push({ className: 'journal__text', message: describeSymbol(e.symbol, e.result) });
        });
        journal_messages.push(
            picked
                ? {
                      className: 'journal__text--success',
                      message: `STATUS: VALID SIGNAL on ${picked.symbol}. ACTION: UNDER ${options.barrier}`,
                  }
                : { className: 'journal__text', message: `WHY NO TRADE? ${rejection}` }
        );
    }

    return {
        prediction: picked ? picked.result.prediction : -1,
        matched: Boolean(picked),
        contract_type: picked ? 'DIGITUNDER' : null,
        barrier: options.barrier,
        symbol: picked ? picked.symbol : null,
        evaluations: evaluations.map(e => ({
            symbol: e.symbol,
            status: e.result.status,
            recent: e.result.recent || [],
            why_no_trade: e.result.why_no_trade,
        })),
        why_no_trade: picked ? '' : rejection,
        options,
        journal_messages,
    };
};

/** Drop the pending outcome of a market whose signal could not be traded (e.g. switch failed). */
export const releaseLowHighFlipScanSignal = (scan_state, symbol) => {
    const state = scan_state?.symbols?.[symbol];
    if (state) state.pending_outcome = null;
};

/**
 * Sequential replay with the bot's risk rule: Under `barrier` normally, switch to
 * `recovery_barrier` after a loss until the next win.
 */
export const replayLowHighFlip = (raw_ticks, raw_options = {}) => {
    const entry_barrier = normalizeLowHighFlipOptions(raw_options).barrier;
    const recovery_barrier = toInt(raw_options.recovery_barrier, 7, 1, 9);
    const state = createLowHighFlipState();
    const digits = normalizeTicks(raw_ticks).map(t => t.digit);
    const signals = [];
    let barrier = entry_barrier;

    for (let i = 0; i < digits.length; i++) {
        // The previous trade settles on this tick, before this tick's signal is evaluated.
        if (state.pending_outcome) {
            barrier = digits[i] < state.pending_outcome.barrier ? entry_barrier : recovery_barrier;
        }
        const result = evaluateLowHighFlip(
            digits.slice(0, i + 1),
            { ...raw_options, barrier, journal_enabled: false },
            state
        );
        if (result.matched) {
            signals.push({ tip: i, barrier: result.barrier, current: result.current });
        }
    }

    const { wins, losses } = state.live;
    const trades = wins + losses;
    return {
        total_ticks: digits.length,
        valid_signals: signals.length,
        trades,
        wins,
        losses,
        win_rate: trades > 0 ? (wins / trades) * 100 : 0,
        signals,
    };
};
