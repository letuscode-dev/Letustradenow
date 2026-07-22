/**
 * Digit Successor Differs — within a user-configured tick window, map what
 * followed each digit 0–9. When the current last digit is X and X→Y was
 * observed in that window, place Digit Differs on Y (the barrier).
 *
 * Example: in the window, 2 was followed by 5; current last digit is 2 → Differs 5.
 *
 * Master toggle: options.enabled (Quick Strategy "Enable strategy").
 * Recovery stake sizing uses the existing payout-based recovery mechanism.
 */

export const DEFAULT_TICK_WINDOW = 120;
export const DEFAULT_PATTERN_THRESHOLD = 1;

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

const toInt = (value, fallback, min = null) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (min !== null && n < min) {
        n = min;
    }
    return n;
};

export const normalizeConsecutiveDigitsOverOptions = (options = {}) => ({
    enabled: toBool(options.enabled, true),
    tick_window: Math.max(
        2,
        toInt(options.tick_window ?? options.digit_count, DEFAULT_TICK_WINDOW, 2)
    ),
    pattern_threshold: Math.max(
        1,
        toInt(options.pattern_threshold ?? options.threshold, DEFAULT_PATTERN_THRESHOLD, 1)
    ),
    journal_enabled: toBool(options.journal_enabled, true),
});

/**
 * Normalize a digit list or digit-tick list to integers 0–9 (oldest → newest).
 * @param {Array<number|{digit:number}|string>} digits
 * @returns {number[]}
 */
export const normalizeDigitSequence = digits => {
    if (!Array.isArray(digits) || digits.length === 0) {
        return [];
    }
    const out = [];
    for (let i = 0; i < digits.length; i++) {
        const item = digits[i];
        const value =
            typeof item === 'object' && item !== null && 'digit' in item
                ? Number(item.digit)
                : Number(item);
        if (Number.isInteger(value) && value >= 0 && value <= 9) {
            out.push(value);
        }
    }
    return out;
};

/**
 * Returns the last `count` digits from a digit list or digit-tick list.
 * @param {Array<number|{digit:number}|string>} digits
 * @param {number} count
 * @returns {number[]}
 */
export const getRecentDigits = (digits, count) => {
    const normalized = normalizeDigitSequence(digits);
    if (normalized.length === 0) {
        return [];
    }
    return normalized.slice(-Math.max(1, count));
};

/**
 * Build outgoing successor counts for digits 0–9 within the window.
 * For each from-digit, tracks the strongest to-digit (count, last index for ties).
 *
 * @param {number[]} window_digits
 * @returns {{
 *   counts: number[],
 *   lastIndex: number[],
 *   successors: Array<{ from: number, to: number, count: number } | null>,
 * }}
 */
export const buildDigitSuccessorMap = window_digits => {
    const counts = new Array(100).fill(0);
    const lastIndex = new Array(100).fill(-1);

    for (let i = 1; i < window_digits.length; i++) {
        const from = window_digits[i - 1];
        const to = window_digits[i];
        const key = from * 10 + to;
        counts[key] += 1;
        lastIndex[key] = i;
    }

    const successors = new Array(10).fill(null);
    for (let from = 0; from <= 9; from++) {
        let best_to = -1;
        let best_count = 0;
        let best_last = -1;
        for (let to = 0; to <= 9; to++) {
            const key = from * 10 + to;
            const count = counts[key];
            const seen = lastIndex[key];
            if (count > best_count || (count === best_count && count > 0 && seen > best_last)) {
                best_count = count;
                best_to = to;
                best_last = seen;
            }
        }
        if (best_to >= 0 && best_count > 0) {
            successors[from] = { from, to: best_to, count: best_count };
        }
    }

    return { counts, lastIndex, successors };
};

/**
 * Find Differs barrier Y for current digit X from successor patterns in the window.
 *
 * @param {Array<number|{digit:number}|string>} digits
 * @param {number} [threshold]
 * @returns {{ from: number, to: number, count: number } | null}
 */
export const getDigitSuccessorSignal = (digits, threshold = DEFAULT_PATTERN_THRESHOLD) => {
    const window_digits = normalizeDigitSequence(digits);
    if (window_digits.length < 2) {
        return null;
    }

    const numeric_threshold = Math.max(1, Math.floor(Number(threshold)) || DEFAULT_PATTERN_THRESHOLD);
    const current = window_digits[window_digits.length - 1];
    const { successors } = buildDigitSuccessorMap(window_digits);
    const signal = successors[current];

    if (!signal || signal.count < numeric_threshold) {
        return null;
    }

    return signal;
};

/**
 * Differs barrier digit (successor of current), or -1 when no pattern qualifies.
 * @param {Array<number|{digit:number}|string>} digits
 * @param {number} [threshold]
 * @returns {number}
 */
export const getDigitSuccessorPrediction = (digits, threshold = DEFAULT_PATTERN_THRESHOLD) => {
    const signal = getDigitSuccessorSignal(digits, threshold);
    return signal ? signal.to : -1;
};

/**
 * Evaluate digit-successor Differs signal.
 *
 * @param {Array<number|{digit:number}|string>} digits
 * @param {object} raw_options
 * @returns {{
 *   prediction: number,
 *   allowed: boolean,
 *   enabled: boolean,
 *   current_digit: number,
 *   tick_window: number,
 *   recent_digits: number[],
 *   successor_map: Array<{ from: number, to: number, count: number } | null>,
 *   journal_messages: Array<{className:string,message:string}>,
 * }}
 */
export const evaluateConsecutiveDigitsOver = (digits, raw_options = {}) => {
    const options = normalizeConsecutiveDigitsOverOptions(raw_options);
    const journal_messages = [];
    const empty_map = new Array(10).fill(null);

    if (!options.enabled) {
        return {
            prediction: -1,
            allowed: false,
            enabled: false,
            current_digit: -1,
            tick_window: options.tick_window,
            recent_digits: [],
            successor_map: empty_map,
            journal_messages,
        };
    }

    const recent_digits = getRecentDigits(digits, options.tick_window);
    if (recent_digits.length < 2) {
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text',
                message: `Waiting for tick window (${recent_digits.length}/${options.tick_window}).`,
            });
        }
        return {
            prediction: -1,
            allowed: false,
            enabled: true,
            current_digit: -1,
            tick_window: options.tick_window,
            recent_digits,
            successor_map: empty_map,
            journal_messages,
        };
    }

    const { successors } = buildDigitSuccessorMap(recent_digits);
    const current_digit = recent_digits[recent_digits.length - 1];
    const signal = getDigitSuccessorSignal(recent_digits, options.pattern_threshold);

    if (!signal) {
        if (options.journal_enabled) {
            journal_messages.push({
                className: 'journal__text',
                message: [
                    `No successor pattern for current digit ${current_digit}.`,
                    `Window: ${recent_digits.length} ticks (need ≥ ${options.pattern_threshold} observation(s)).`,
                ].join('\n'),
            });
        }
        return {
            prediction: -1,
            allowed: false,
            enabled: true,
            current_digit,
            tick_window: options.tick_window,
            recent_digits,
            successor_map: successors,
            journal_messages,
        };
    }

    if (options.journal_enabled) {
        const map_lines = successors
            .map((entry, from) => {
                if (!entry) {
                    return `${from} → —`;
                }
                return `${from} → ${entry.to} (${entry.count}×)`;
            })
            .join('\n');

        journal_messages.push({
            className: 'journal__text--success',
            message: [
                'Digit successor pattern detected.',
                '',
                `Current digit: ${signal.from}`,
                `Historical next: ${signal.to} (${signal.count}× in window)`,
                '',
                'Successor map (0–9):',
                map_lines,
                '',
                `Placing DIFFERS ${signal.to}.`,
            ].join('\n'),
        });
    }

    return {
        prediction: signal.to,
        allowed: true,
        enabled: true,
        current_digit,
        tick_window: options.tick_window,
        recent_digits,
        successor_map: successors,
        journal_messages,
    };
};
