/**
 * Cold Digit Differs — Analysis-style frequency heuristic.
 *
 * Always analyzes the user-configured tick sample size (e.g. last 100 ticks).
 * Requests that history from Deriv immediately (no live tick-by-tick wait), then
 * continuously recomputes on each new signal from the latest sliding window of
 * exactly that size as new ticks arrive.
 *
 * Confidence matches Analysis:
 *   confidence = clamp(62 + max(0, 10 - coldPercent), 62, 72)
 *
 * Optional sticky signal: reuse the same cold digit for `runs_per_signal` trades
 * before recomputing from the latest configured window.
 */

export const DEFAULT_TICK_SAMPLE_SIZE = 100;
export const MIN_TICK_SAMPLE_SIZE = 30;
export const MAX_TICK_SAMPLE_SIZE = 500;
export const DEFAULT_RUNS_PER_SIGNAL = 1;
export const MIN_CONFIDENCE = 62;
export const MAX_CONFIDENCE = 72;

const toBool = (value, default_value = true) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

const toPositiveInt = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (n < min) {
        n = min;
    }
    if (n > max) {
        n = max;
    }
    return n;
};

/**
 * @returns {{
 *   activeDigit: number|null,
 *   runsRemaining: number,
 *   lastConfidence: number,
 *   lastColdPercent: number,
 *   lastSampleSize: number,
 * }}
 */
export const createColdDigitState = () => ({
    activeDigit: null,
    runsRemaining: 0,
    lastConfidence: 0,
    lastColdPercent: 0,
    lastSampleSize: 0,
});

/**
 * @param {ReturnType<typeof createColdDigitState>|null|undefined} state
 */
export const resetColdDigitState = state => {
    if (!state) {
        return createColdDigitState();
    }
    state.activeDigit = null;
    state.runsRemaining = 0;
    state.lastConfidence = 0;
    state.lastColdPercent = 0;
    state.lastSampleSize = 0;
    return state;
};

/**
 * @param {Array<number|string>} digits
 * @param {number} sample_size
 * @returns {number[]}
 */
export const getLatestDigitSample = (digits, sample_size = DEFAULT_TICK_SAMPLE_SIZE) => {
    if (!Array.isArray(digits) || digits.length === 0) {
        return [];
    }

    const cleaned = [];
    for (let i = 0; i < digits.length; i++) {
        const digit = Number(digits[i]);
        if (Number.isInteger(digit) && digit >= 0 && digit <= 9) {
            cleaned.push(digit);
        }
    }

    const size = toPositiveInt(sample_size, DEFAULT_TICK_SAMPLE_SIZE, MIN_TICK_SAMPLE_SIZE, MAX_TICK_SAMPLE_SIZE);
    if (cleaned.length <= size) {
        return cleaned;
    }
    return cleaned.slice(cleaned.length - size);
};

/**
 * Analysis confidence for a cold digit frequency percent.
 * @param {number} cold_percent
 * @returns {number} 62–72
 */
export const calculateColdDigitConfidence = cold_percent => {
    const pct = Number(cold_percent);
    const raw = 62 + Math.max(0, 10 - (Number.isFinite(pct) ? pct : 0));
    return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, Math.round(raw)));
};

/**
 * @param {number[]} sample
 * @returns {{ coldDigit: number, hotDigit: number, counts: number[], coldCount: number, hotCount: number, coldPercent: number, confidence: number }|null}
 */
export const analyzeColdDigit = sample => {
    if (!Array.isArray(sample) || sample.length === 0) {
        return null;
    }

    const counts = Array(10).fill(0);
    for (let i = 0; i < sample.length; i++) {
        counts[sample[i]] += 1;
    }

    const coldDigit = counts.reduce((coldIndex, count, index) => (count < counts[coldIndex] ? index : coldIndex), 0);
    const hotDigit = counts.reduce((hotIndex, count, index) => (count > counts[hotIndex] ? index : hotIndex), 0);
    const coldCount = counts[coldDigit];
    const hotCount = counts[hotDigit];
    const coldPercent = Math.round((coldCount / sample.length) * 100);
    const confidence = calculateColdDigitConfidence(coldPercent);

    return { coldDigit, hotDigit, counts, coldCount, hotCount, coldPercent, confidence };
};

/**
 * Consume one run from the active sticky signal (call after each settled trade).
 * @param {ReturnType<typeof createColdDigitState>} state
 */
export const consumeColdDigitSignal = state => {
    if (!state || state.runsRemaining <= 0) {
        return state;
    }
    state.runsRemaining = Math.max(0, state.runsRemaining - 1);
    if (state.runsRemaining <= 0) {
        state.activeDigit = null;
    }
    return state;
};

/**
 * @param {Array<number|string>} digits
 * @param {{
 *   enabled?: boolean,
 *   tick_sample_size?: number,
 *   runs_per_signal?: number,
 *   journal_enabled?: boolean,
 * }} [options]
 * @param {ReturnType<typeof createColdDigitState>} [state]
 * @returns {{
 *   prediction: number,
 *   enabled: boolean,
 *   confidence: number,
 *   cold_percent: number,
 *   sample_size: number,
 *   runs_remaining: number,
 *   journal_messages: Array<{className: string, message: string}>,
 * }}
 */
export const evaluateColdDigit = (digits, options = {}, state = createColdDigitState()) => {
    const enabled = toBool(options.enabled, true);
    const journal_enabled = toBool(options.journal_enabled, true);
    const tick_sample_size = toPositiveInt(
        options.tick_sample_size,
        DEFAULT_TICK_SAMPLE_SIZE,
        MIN_TICK_SAMPLE_SIZE,
        MAX_TICK_SAMPLE_SIZE
    );
    const runs_per_signal = toPositiveInt(options.runs_per_signal, DEFAULT_RUNS_PER_SIGNAL, 1, 100);
    const journal_messages = [];

    if (!enabled) {
        resetColdDigitState(state);
        return {
            prediction: -1,
            enabled: false,
            confidence: 0,
            cold_percent: 0,
            sample_size: 0,
            runs_remaining: 0,
            journal_messages,
        };
    }

    // Sticky signal: finish remaining runs on the same cold digit.
    if (state.activeDigit !== null && state.runsRemaining > 0) {
        if (journal_enabled) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Cold digit Differs ${state.activeDigit} · confidence ${state.lastConfidence}% · runs left ${state.runsRemaining}`,
            });
        }
        return {
            prediction: state.activeDigit,
            enabled: true,
            confidence: state.lastConfidence,
            cold_percent: state.lastColdPercent,
            sample_size: state.lastSampleSize,
            runs_remaining: state.runsRemaining,
            journal_messages,
        };
    }

    // Use exactly the configured window. History is requested up-front; until it
    // lands, do not trade on a shorter partial sample.
    const sample = getLatestDigitSample(digits, tick_sample_size);
    if (sample.length < tick_sample_size) {
        if (journal_enabled) {
            journal_messages.push({
                className: 'journal__text',
                message: `Requesting tick history from Deriv (${sample.length}/${tick_sample_size}).`,
            });
        }
        return {
            prediction: -1,
            enabled: true,
            confidence: 0,
            cold_percent: 0,
            sample_size: sample.length,
            runs_remaining: 0,
            journal_messages,
        };
    }

    const analysis = analyzeColdDigit(sample);
    if (!analysis) {
        return {
            prediction: -1,
            enabled: true,
            confidence: 0,
            cold_percent: 0,
            sample_size: sample.length,
            runs_remaining: 0,
            journal_messages,
        };
    }

    state.activeDigit = analysis.coldDigit;
    state.runsRemaining = runs_per_signal;
    state.lastConfidence = analysis.confidence;
    state.lastColdPercent = analysis.coldPercent;
    state.lastSampleSize = sample.length;

    if (journal_enabled) {
        journal_messages.push({
            className: 'journal__text--success',
            message: `Cold digit ${analysis.coldDigit}: ${analysis.coldPercent}% · confidence ${analysis.confidence}% · Differs ${analysis.coldDigit} (${runs_per_signal} run${runs_per_signal === 1 ? '' : 's'})`,
        });
    }

    return {
        prediction: analysis.coldDigit,
        enabled: true,
        confidence: analysis.confidence,
        cold_percent: analysis.coldPercent,
        sample_size: sample.length,
        runs_remaining: state.runsRemaining,
        journal_messages,
    };
};
