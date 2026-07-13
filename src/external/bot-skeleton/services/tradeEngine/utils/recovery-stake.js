/**
 * Payout-based recovery staking.
 *
 * User configures:
 * - payout_percent: expected win profit as % of stake
 *   (e.g. 11 → profit = stake * 0.11; Digit Differs is typically ~10–12%, not ~95%)
 *   Values between 0 and 1 are treated as ratios (0.11 → 11%).
 * - recovery_splits: number of winning runs to fully recover accumulated loss
 *   (1 = recover in a single win; N = recover over N wins)
 *
 * Stake while recovering:
 *   nextStake = (accumulatedLoss / remainingSplits) / (payoutPercent / 100)
 */

/** Digit Differs-style default (profit ≈ 11% of stake). Rise/Fall is closer to 95. */
export const DEFAULT_PAYOUT_PERCENT = 11;
export const DEFAULT_RECOVERY_SPLITS = 1;
export const DEFAULT_INITIAL_STAKE = 1;
export const MIN_STAKE = 0.35;

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const toPositiveNumber = (value, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        return fallback;
    }
    return n;
};

const toPositiveInt = (value, fallback) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) {
        return fallback;
    }
    return n;
};

/**
 * Normalize user payout input to a percent (e.g. 11 or 0.11 → 11).
 * Values in (0, 1] are treated as decimal ratios.
 *
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export const normalizePayoutPercent = (value, fallback = DEFAULT_PAYOUT_PERCENT) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        return fallback;
    }
    if (n <= 1) {
        return round2(n * 100);
    }
    return n;
};

/**
 * @param {object} [config]
 * @returns {{
 *   initialStake: number,
 *   payoutPercent: number,
 *   recoverySplits: number,
 *   accumulatedLoss: number,
 *   remainingSplits: number,
 *   lastStake: number,
 * }}
 */
export const createRecoveryState = (config = {}) => ({
    initialStake: toPositiveNumber(config.initialStake, DEFAULT_INITIAL_STAKE),
    payoutPercent: normalizePayoutPercent(config.payoutPercent, DEFAULT_PAYOUT_PERCENT),
    recoverySplits: toPositiveInt(config.recoverySplits, DEFAULT_RECOVERY_SPLITS),
    accumulatedLoss: 0,
    remainingSplits: 0,
    lastStake: toPositiveNumber(config.initialStake, DEFAULT_INITIAL_STAKE),
});

/**
 * Sync user config into recovery state (does not clear an active recovery unless
 * `reset` is true).
 */
export const configureRecoveryState = (state, config = {}, reset = true) => {
    if (!state) {
        return createRecoveryState(config);
    }

    state.initialStake = toPositiveNumber(config.initialStake, state.initialStake || DEFAULT_INITIAL_STAKE);
    state.payoutPercent = normalizePayoutPercent(
        config.payoutPercent,
        state.payoutPercent || DEFAULT_PAYOUT_PERCENT
    );
    state.recoverySplits = toPositiveInt(config.recoverySplits, state.recoverySplits || DEFAULT_RECOVERY_SPLITS);

    if (reset) {
        state.accumulatedLoss = 0;
        state.remainingSplits = 0;
        state.lastStake = state.initialStake;
    }

    return state;
};

/**
 * Next stake from current recovery state.
 *
 * @param {ReturnType<typeof createRecoveryState>} state
 * @returns {number}
 */
export const calculateRecoveryStake = state => {
    if (!state) {
        return DEFAULT_INITIAL_STAKE;
    }

    const initial = toPositiveNumber(state.initialStake, DEFAULT_INITIAL_STAKE);
    const loss = Number(state.accumulatedLoss);
    const remaining = Math.floor(Number(state.remainingSplits));
    const payout = normalizePayoutPercent(state.payoutPercent, DEFAULT_PAYOUT_PERCENT);

    if (!Number.isFinite(loss) || loss <= 0 || !Number.isFinite(remaining) || remaining <= 0) {
        return round2(initial);
    }

    const rate = payout / 100;
    if (rate <= 0) {
        return round2(initial);
    }

    const stake = loss / remaining / rate;
    return round2(Math.max(stake, MIN_STAKE));
};

/**
 * Apply a settled trade result to recovery state.
 * On wins, recalibrates payoutPercent from profit / lastStake so recovery
 * matches the live contract payout (critical for Digit Differs ≈ 10–12%).
 *
 * @param {ReturnType<typeof createRecoveryState>} state
 * @param {boolean} is_win
 * @param {number} profit - contract profit (negative on loss)
 * @returns {ReturnType<typeof createRecoveryState>}
 */
export const applyRecoveryResult = (state, is_win, profit) => {
    if (!state) {
        return createRecoveryState();
    }

    const p = Number(profit);
    const profit_amount = Number.isFinite(p) ? p : 0;
    const stake_used = toPositiveNumber(state.lastStake, state.initialStake || DEFAULT_INITIAL_STAKE);

    if (is_win) {
        if (stake_used > 0 && profit_amount > 0) {
            const observed = (profit_amount / stake_used) * 100;
            if (Number.isFinite(observed) && observed > 0) {
                state.payoutPercent = round2(observed);
            }
        }

        if (state.accumulatedLoss > 0) {
            state.accumulatedLoss = Math.max(0, round2(state.accumulatedLoss - profit_amount));
            state.remainingSplits = Math.max(0, Math.floor(Number(state.remainingSplits)) - 1);
            if (state.accumulatedLoss <= 0) {
                state.accumulatedLoss = 0;
                state.remainingSplits = 0;
            }
        }
        return state;
    }

    // Loss — add absolute lost amount and re-plan recovery over N wins.
    state.accumulatedLoss = round2(state.accumulatedLoss + Math.abs(profit_amount));
    state.remainingSplits = toPositiveInt(state.recoverySplits, DEFAULT_RECOVERY_SPLITS);
    return state;
};
