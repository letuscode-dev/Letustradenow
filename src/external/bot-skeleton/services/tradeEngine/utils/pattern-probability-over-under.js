/**
 * Pattern-probability Over/Under engine.
 *
 * Finds every historical occurrence of the current digit pattern (length 1–5)
 * inside a sliding lookback window, builds a successor frequency table (0–9),
 * then scores the configured Over / Under market(s). Over-only targets Over 2;
 * Under-only targets Under 7. Trades only when the best market clears minimum
 * occurrences, confidence, and theoretical-edge filters.
 *
 * Performance: one O(n) scan builds a Map of pattern → successor counts.
 * Same-tick callers reuse a tip snapshot (handled in BotInterface).
 */

export const DEFAULT_LOOKBACK = 400;
export const DEFAULT_PATTERN_LENGTH = 2;
export const DEFAULT_MIN_OCCURRENCES = 3;
export const DEFAULT_MIN_CONFIDENCE = 70;
export const MAX_LOOKBACK = 1000;
export const MIN_PATTERN_LENGTH = 1;
export const MAX_PATTERN_LENGTH = 5;

/** Markets evaluated every tick (barrier is the purchase prediction). */
export const OVER_MARKETS = [{ side: 'OVER', barrier: 2 }];

export const UNDER_MARKETS = [{ side: 'UNDER', barrier: 7 }];

export const OVER_UNDER_MARKETS = [...OVER_MARKETS, ...UNDER_MARKETS];

/** Low-payout barriers to skip after a loss (kept for BOTH / legacy configs). */
export const LOW_PAYOUT_AFTER_LOSS = [
    { side: 'OVER', barrier: 1 },
    { side: 'UNDER', barrier: 8 },
];

const toMarketSide = value => {
    const normalized = String(value || 'BOTH').toUpperCase();
    if (normalized === 'OVER' || normalized === 'DIGITOVER') {
        return 'OVER';
    }
    if (normalized === 'UNDER' || normalized === 'DIGITUNDER') {
        return 'UNDER';
    }
    return 'BOTH';
};

export const getMarketsForSide = market_side => {
    const side = toMarketSide(market_side);
    if (side === 'OVER') {
        return OVER_MARKETS;
    }
    if (side === 'UNDER') {
        return UNDER_MARKETS;
    }
    return OVER_UNDER_MARKETS;
};

/**
 * Drop Over 1 / Under 8 when recovering from a loss — their payouts are too thin
 * for stake recovery. Falls back to the full list if filtering would leave nothing.
 */
export const filterMarketsAfterLoss = (markets, last_was_loss) => {
    if (!last_was_loss || !Array.isArray(markets) || markets.length === 0) {
        return Array.isArray(markets) ? markets.slice() : [];
    }
    const filtered = markets.filter(
        market =>
            !LOW_PAYOUT_AFTER_LOSS.some(
                banned => banned.side === market.side && banned.barrier === market.barrier
            )
    );
    return filtered.length > 0 ? filtered : markets.slice();
};

const isValidDigit = digit => Number.isInteger(digit) && digit >= 0 && digit <= 9;

const toLookback = value => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 10) {
        n = DEFAULT_LOOKBACK;
    }
    if (n > MAX_LOOKBACK) {
        n = MAX_LOOKBACK;
    }
    return n;
};

const toPatternLength = value => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < MIN_PATTERN_LENGTH) {
        n = DEFAULT_PATTERN_LENGTH;
    }
    if (n > MAX_PATTERN_LENGTH) {
        n = MAX_PATTERN_LENGTH;
    }
    return n;
};

const toMinOccurrences = value => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) {
        n = DEFAULT_MIN_OCCURRENCES;
    }
    return n;
};

const toMinConfidence = value => {
    let n = Number(value);
    if (!Number.isFinite(n)) {
        n = DEFAULT_MIN_CONFIDENCE;
    }
    if (n < 0) {
        n = 0;
    }
    if (n > 100) {
        n = 100;
    }
    return n;
};

const cleanDigits = digits => {
    if (!Array.isArray(digits) || digits.length === 0) {
        return [];
    }
    const out = [];
    for (let i = 0; i < digits.length; i++) {
        const digit = Number(digits[i]);
        if (isValidDigit(digit)) {
            out.push(digit);
        }
    }
    return out;
};

/**
 * Theoretical win rate assuming uniform last digits 0–9.
 * Over B → (9 − B) / 10; Under B → B / 10.
 */
export const getTheoreticalProbability = (side, barrier) => {
    const b = Math.floor(Number(barrier));
    if (side === 'UNDER') {
        if (!Number.isFinite(b) || b < 0 || b > 9) {
            return 0;
        }
        return (b / 10) * 100;
    }
    if (!Number.isFinite(b) || b < 0 || b > 9) {
        return 0;
    }
    return ((9 - b) / 10) * 100;
};

/**
 * Historical win probability for Over/Under given successor frequency counts.
 * @param {number[]} counts length 10
 * @param {'OVER'|'UNDER'} side
 * @param {number} barrier
 * @returns {{ probability: number, matching: number, total: number }}
 */
export const getMarketProbabilityFromCounts = (counts, side, barrier) => {
    const total = Array.isArray(counts) ? counts.reduce((sum, n) => sum + (Number(n) || 0), 0) : 0;
    if (total <= 0) {
        return { probability: 0, matching: 0, total: 0 };
    }

    let matching = 0;
    const b = Math.floor(Number(barrier));
    for (let digit = 0; digit <= 9; digit++) {
        const count = Number(counts[digit]) || 0;
        if (side === 'UNDER') {
            if (digit < b) {
                matching += count;
            }
        } else if (digit > b) {
            matching += count;
        }
    }

    return {
        probability: (matching / total) * 100,
        matching,
        total,
    };
};

/**
 * Build Map patternKey → successor counts[10] for a fixed pattern length.
 * patternKey is a string of L digits, e.g. "472".
 * @param {number[]} digits oldest → newest
 * @param {number} pattern_length
 * @returns {Map<string, number[]>}
 */
export const buildPatternSuccessorIndex = (digits, pattern_length) => {
    const L = toPatternLength(pattern_length);
    const index = new Map();
    if (!Array.isArray(digits) || digits.length < L + 1) {
        return index;
    }

    for (let i = 0; i <= digits.length - L - 1; i++) {
        let key = '';
        let valid = true;
        for (let j = 0; j < L; j++) {
            const d = digits[i + j];
            if (!isValidDigit(d)) {
                valid = false;
                break;
            }
            key += String(d);
        }
        if (!valid) {
            continue;
        }
        const next = digits[i + L];
        if (!isValidDigit(next)) {
            continue;
        }
        let counts = index.get(key);
        if (!counts) {
            counts = new Array(10).fill(0);
            index.set(key, counts);
        }
        counts[next] += 1;
    }

    return index;
};

/**
 * Current pattern string + digit array from the newest L digits.
 */
export const getCurrentPattern = (digits, pattern_length) => {
    const L = toPatternLength(pattern_length);
    if (!Array.isArray(digits) || digits.length < L) {
        return { key: '', digits: [] };
    }
    const slice = digits.slice(digits.length - L);
    if (slice.some(d => !isValidDigit(d))) {
        return { key: '', digits: [] };
    }
    return { key: slice.join(''), digits: slice };
};

/**
 * Score confidence 0–100 from sample size, edge vs theoretical, recent agreement,
 * and optional multi-length consensus.
 */
export const scoreConfidence = ({
    probability,
    theoretical,
    occurrences,
    min_occurrences,
    recent_agreement = 0.5,
    consensus_ratio = 0,
}) => {
    const prob = Number(probability) || 0;
    const theo = Number(theoretical) || 0;
    const edge = Math.max(0, prob - theo);
    const occ = Math.max(0, Number(occurrences) || 0);
    const min_occ = Math.max(1, Number(min_occurrences) || DEFAULT_MIN_OCCURRENCES);

    // Sample-size factor: 0 at 0, ~1 when occ >= 2× min.
    const sample_factor = Math.min(1, occ / (min_occ * 2));
    // Edge factor: full credit at ≥15pp above theoretical.
    const edge_factor = Math.min(1, edge / 15);
    const recent_factor = Math.max(0, Math.min(1, Number(recent_agreement) || 0));
    const consensus_factor = Math.max(0, Math.min(1, Number(consensus_ratio) || 0));

    // Weighted blend anchored on historical probability.
    const adjusted =
        prob * 0.55 +
        prob * sample_factor * 0.15 +
        (theo + edge) * edge_factor * 0.15 +
        prob * recent_factor * 0.1 +
        prob * consensus_factor * 0.05;

    // Penalise tiny samples hard.
    const penalty = occ < min_occ ? 0.35 : occ < min_occ * 1.5 ? 0.85 : 1;
    const scored = Math.max(0, Math.min(100, adjusted * penalty));
    return Math.round(scored * 10) / 10;
};

/**
 * Fraction of the most recent `recent_n` successors that would have won the market.
 */
export const getRecentAgreement = (successors, side, barrier, recent_n = 8) => {
    if (!Array.isArray(successors) || successors.length === 0) {
        return 0.5;
    }
    const n = Math.max(1, Math.min(successors.length, Math.floor(Number(recent_n)) || 8));
    const recent = successors.slice(successors.length - n);
    let wins = 0;
    const b = Math.floor(Number(barrier));
    for (let i = 0; i < recent.length; i++) {
        const d = recent[i];
        if (side === 'UNDER' ? d < b : d > b) {
            wins += 1;
        }
    }
    return wins / recent.length;
};

/**
 * Collect successor digits for a pattern in chronological order (for recent agreement).
 */
export const collectPatternSuccessors = (digits, pattern_length, pattern_key) => {
    const L = toPatternLength(pattern_length);
    const successors = [];
    if (!pattern_key || !Array.isArray(digits) || digits.length < L + 1) {
        return successors;
    }
    for (let i = 0; i <= digits.length - L - 1; i++) {
        let key = '';
        for (let j = 0; j < L; j++) {
            key += String(digits[i + j]);
        }
        if (key === pattern_key) {
            const next = digits[i + L];
            if (isValidDigit(next)) {
                successors.push(next);
            }
        }
    }
    return successors;
};

const emptyResult = (overrides = {}) => ({
    should_trade: false,
    barrier: -1,
    side: null,
    contract_type: null,
    confidence: 0,
    probability: 0,
    theoretical: 0,
    edge: 0,
    occurrences: 0,
    pattern: '',
    pattern_length: DEFAULT_PATTERN_LENGTH,
    lookback: DEFAULT_LOOKBACK,
    frequency: new Array(10).fill(0),
    market_probabilities: [],
    reason: 'no_data',
    status: 'collecting',
    journal_messages: [],
    ...overrides,
});

/**
 * Core evaluation.
 *
 * @param {Array<number|string>} digits oldest → newest (already windowed or full cache)
 * @param {{
 *   lookback?: number,
 *   pattern_length?: number,
 *   min_occurrences?: number,
 *   min_confidence?: number,
 *   journal_enabled?: boolean,
 *   multi_length_consensus?: boolean,
 *   market_side?: 'OVER'|'UNDER'|'BOTH',
 *   avoid_low_payout_after_loss?: boolean,
 *   last_was_loss?: boolean,
 * }} options
 */
export const evaluatePatternProbabilityOverUnder = (digits, options = {}) => {
    const lookback = toLookback(options.lookback);
    const pattern_length = toPatternLength(options.pattern_length);
    const min_occurrences = toMinOccurrences(options.min_occurrences);
    const min_confidence = toMinConfidence(options.min_confidence);
    const market_side = toMarketSide(options.market_side);
    const avoid_low_payout =
        options.avoid_low_payout_after_loss === undefined
            ? true
            : options.avoid_low_payout_after_loss === true ||
              options.avoid_low_payout_after_loss === 1 ||
              options.avoid_low_payout_after_loss === 'TRUE' ||
              options.avoid_low_payout_after_loss === 'true';
    const last_was_loss = options.last_was_loss === true || options.last_was_loss === 1;
    const base_markets = getMarketsForSide(market_side);
    const markets = filterMarketsAfterLoss(base_markets, avoid_low_payout && last_was_loss);
    // Only true when markets were actually removed (e.g. Over 1 / Under 8 in BOTH mode).
    const skipped_low_payout = markets.length < base_markets.length;
    const side_label = market_side === 'BOTH' ? 'OU' : market_side === 'UNDER' ? 'Under' : 'Over';
    const journal_enabled =
        options.journal_enabled === undefined || options.journal_enabled === null
            ? true
            : options.journal_enabled === true ||
              options.journal_enabled === 1 ||
              options.journal_enabled === 'TRUE' ||
              options.journal_enabled === 'true';
    const multi_length =
        options.multi_length_consensus === undefined
            ? true
            : options.multi_length_consensus === true ||
              options.multi_length_consensus === 1 ||
              options.multi_length_consensus === 'TRUE' ||
              options.multi_length_consensus === 'true';

    const cleaned = cleanDigits(digits);
    const window = cleaned.length > lookback ? cleaned.slice(cleaned.length - lookback) : cleaned;

    // Trade as soon as a pattern + successor exists — never wait for full lookback.
    // Background history fill (BotInterface) grows the window without blocking.
    if (window.length < pattern_length + 1) {
        return emptyResult({
            pattern_length,
            lookback,
            market_side,
            reason: 'collecting_ticks',
            status: 'collecting',
            journal_messages: journal_enabled
                ? [
                      {
                          className: 'info',
                          message: `Pattern ${side_label}: collecting ticks (${window.length}/${pattern_length + 1}).`,
                      },
                  ]
                : [],
        });
    }

    const current = getCurrentPattern(window, pattern_length);
    if (!current.key) {
        return emptyResult({
            pattern_length,
            lookback,
            market_side,
            reason: 'invalid_pattern',
            status: 'skip',
            journal_messages: journal_enabled
                ? [{ className: 'error', message: `Pattern ${side_label}: current pattern invalid.` }]
                : [],
        });
    }

    const index = buildPatternSuccessorIndex(window, pattern_length);
    const frequency = (index.get(current.key) || new Array(10).fill(0)).slice();
    const occurrences = frequency.reduce((sum, n) => sum + n, 0);
    const successors = collectPatternSuccessors(window, pattern_length, current.key);

    const market_probabilities = markets
        .map(market => {
            const { probability, matching, total } = getMarketProbabilityFromCounts(
                frequency,
                market.side,
                market.barrier
            );
            const theoretical = getTheoreticalProbability(market.side, market.barrier);
            const edge = probability - theoretical;
            const recent_agreement = getRecentAgreement(successors, market.side, market.barrier);
            return {
                side: market.side,
                barrier: market.barrier,
                label: `${market.side === 'UNDER' ? 'Under' : 'Over'} ${market.barrier}`,
                probability: Math.round(probability * 100) / 100,
                theoretical,
                edge: Math.round(edge * 100) / 100,
                matching,
                total,
                recent_agreement: Math.round(recent_agreement * 1000) / 1000,
            };
        })
        .sort((a, b) => b.probability - a.probability || b.edge - a.edge);

    const best = market_probabilities[0] || null;

    // Multi-length consensus: how many nearby lengths pick the same side (+ barrier family).
    let consensus_ratio = 0;
    if (multi_length && best) {
        const lengths = [];
        for (let L = MIN_PATTERN_LENGTH; L <= MAX_PATTERN_LENGTH; L++) {
            if (L === pattern_length) {
                continue;
            }
            lengths.push(L);
        }
        let agree = 0;
        let checked = 0;
        for (let i = 0; i < lengths.length; i++) {
            const L = lengths[i];
            if (window.length < L + 1) {
                continue;
            }
            const alt_current = getCurrentPattern(window, L);
            if (!alt_current.key) {
                continue;
            }
            const alt_index = buildPatternSuccessorIndex(window, L);
            const alt_freq = alt_index.get(alt_current.key);
            if (!alt_freq) {
                continue;
            }
            const alt_occ = alt_freq.reduce((s, n) => s + n, 0);
            if (alt_occ < Math.max(3, Math.floor(min_occurrences / 2))) {
                continue;
            }
            checked += 1;
            let alt_best = null;
            let alt_best_p = -1;
            for (let m = 0; m < markets.length; m++) {
                const market = markets[m];
                const { probability } = getMarketProbabilityFromCounts(alt_freq, market.side, market.barrier);
                if (probability > alt_best_p) {
                    alt_best_p = probability;
                    alt_best = market;
                }
            }
            if (alt_best && alt_best.side === best.side) {
                agree += 1;
            }
        }
        consensus_ratio = checked > 0 ? agree / checked : 0;
    }

    const confidence = best
        ? scoreConfidence({
              probability: best.probability,
              theoretical: best.theoretical,
              occurrences,
              min_occurrences,
              recent_agreement: best.recent_agreement,
              consensus_ratio,
          })
        : 0;

    const freq_text = frequency.map((c, d) => `${d}:${c}`).join(' ');
    const market_text = market_probabilities
        .map(m => `${m.label}=${m.probability.toFixed(1)}%`)
        .join(' | ');

    let should_trade = false;
    let reason = 'ok';
    let status = 'ready';

    if (occurrences < min_occurrences) {
        reason = `insufficient_occurrences (${occurrences}<${min_occurrences})`;
        status = 'skip';
    } else if (!best) {
        reason = 'no_market';
        status = 'skip';
    } else if (best.probability < min_confidence) {
        reason = `below_min_confidence (${best.probability.toFixed(1)}%<${min_confidence}%)`;
        status = 'skip';
    } else if (best.probability <= best.theoretical) {
        reason = `no_edge_vs_theoretical (${best.probability.toFixed(1)}%≤${best.theoretical}%)`;
        status = 'skip';
    } else {
        // Adaptive confidence is informational / soft — min_confidence applies to
        // historical market probability only (avoids a double-gate that blocked valid edges).
        should_trade = true;
        reason = `trade_${best.side}_${best.barrier}`;
        status = 'trade';
    }

    const lookback_label = window.length < lookback ? `${window.length}/${lookback}` : String(lookback);
    const journal_messages = [];
    if (journal_enabled) {
        journal_messages.push({
            className: should_trade ? 'success' : 'info',
            message: `Pattern ${side_label} [${current.key}] L=${pattern_length} N=${lookback_label} matches=${occurrences} → ${
                should_trade ? `${best.label} @ ${best.probability.toFixed(1)}%` : 'NO TRADE'
            } (${reason})`,
        });
        const skip_note = skipped_low_payout ? ' | skip Over 1/Under 8 after loss' : '';
        journal_messages.push({
            className: 'info',
            message: `Freq {${freq_text}} | ${market_text} | conf=${confidence}%${skip_note}`,
        });
    }

    return {
        should_trade,
        barrier: should_trade ? best.barrier : -1,
        side: should_trade ? best.side : null,
        contract_type: should_trade ? (best.side === 'UNDER' ? 'DIGITUNDER' : 'DIGITOVER') : null,
        confidence,
        probability: best ? best.probability : 0,
        theoretical: best ? best.theoretical : 0,
        edge: best ? best.edge : 0,
        occurrences,
        pattern: current.key,
        pattern_length,
        lookback,
        market_side,
        skipped_low_payout,
        frequency,
        market_probabilities,
        reason,
        status,
        // Only true while we lack a pattern+successor — full lookback is optional.
        collecting: window.length < pattern_length + 1,
        journal_messages,
    };
};
