/** In-memory pacing for hedge quote attempts, shared by account across bot restarts. */
export const configureHedgePacing = (state, runs, waitSeconds) => {
    const count = Number(runs);
    const wait = Number(waitSeconds);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(wait) || wait <= 0 || wait > 86400) {
        state.invalid = true;
        return false;
    }
    state.invalid = false;
    state.runs = count;
    state.waitMs = wait * 1000;
    return true;
};

/** Start the pause when the next attempt is due, after any open pair settles. */
export const hedgePacingDelay = (state, now) => {
    if (!state) return 0;
    if (state.until && now < state.until) return state.until - now;
    if (state.until) state.until = 0;
    if (state.runs && (state.attempts || 0) >= state.runs) {
        state.attempts = 0;
        state.until = now + state.waitMs;
        return state.waitMs;
    }
    return 0;
};

export const recordHedgeAttempt = state => {
    if (state?.runs) state.attempts = (state.attempts || 0) + 1;
};

export const isRateLimitError = error => {
    const code = String(error?.error?.code ?? error?.code ?? '').toLowerCase();
    const message = String(error?.error?.message ?? error?.message ?? '').toLowerCase();
    return code === 'ratelimit' || code === 'toomanyrequests' || code === '429' || /rate.?limit|too many requests/.test(message);
};

/** Never retry a buy; only delay future quote attempts after a rate-limited quote. */
export const backoffHedgeQuotes = (state, now) => {
    const base = Math.max(state.waitMs || 0, 60000);
    state.backoffLevel = Math.min((state.backoffLevel || 0) + 1, 5);
    const delay = Math.max(base, Math.min(base * 2 ** (state.backoffLevel - 1), 300000));
    state.attempts = 0;
    state.until = Math.max(state.until || 0, now + delay);
    return state.until - now;
};

export const hedgePacingForAccount = (api, account) => {
    if (!api.digitHedgePacingByAccount) api.digitHedgePacingByAccount = new Map();
    if (!api.digitHedgePacingByAccount.has(account)) api.digitHedgePacingByAccount.set(account, {});
    return api.digitHedgePacingByAccount.get(account);
};
