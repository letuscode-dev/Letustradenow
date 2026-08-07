/**
 * Pattern Switch — last-digit window signals.
 *
 * Priority (first match wins):
 *   last 4 all odd  → DIGITEVEN  (direction 0)
 *   last 4 all even → DIGITODD   (direction 1)
 *   last 3 all ≤ 3  → DIGITOVER 4 (direction 4)
 *   last 3 all ≥ 6  → DIGITUNDER 5 (direction 5)
 */

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null || value === '') {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true' || value === '1';
};

const toDigitList = digits => {
    if (!Array.isArray(digits)) {
        return [];
    }
    const out = [];
    for (let i = 0; i < digits.length; i++) {
        const n = Number(digits[i]);
        if (Number.isInteger(n) && n >= 0 && n <= 9) {
            out.push(n);
        }
    }
    return out;
};

export const normalizePatternSwitchOptions = (options = {}) => ({
    journal_enabled: toBool(options.journal_enabled, true),
});

/**
 * @param {number[]} digits
 * @returns {{ matched: boolean, direction: number, prediction: number, contract_type: string|null, reason: string }}
 */
export const detectPatternSwitchSignal = digits => {
    const list = toDigitList(digits);
    if (list.length >= 4) {
        const last4 = list.slice(-4);
        if (last4.every(d => d % 2 === 1)) {
            return {
                matched: true,
                direction: 0,
                prediction: -1,
                contract_type: 'DIGITEVEN',
                reason: 'all_odd_4',
                sequence: last4,
            };
        }
        if (last4.every(d => d % 2 === 0)) {
            return {
                matched: true,
                direction: 1,
                prediction: -1,
                contract_type: 'DIGITODD',
                reason: 'all_even_4',
                sequence: last4,
            };
        }
    }
    if (list.length >= 3) {
        const last3 = list.slice(-3);
        if (last3.every(d => d <= 3)) {
            return {
                matched: true,
                direction: 4,
                prediction: 4,
                contract_type: 'DIGITOVER',
                reason: 'all_lte_3',
                sequence: last3,
            };
        }
        if (last3.every(d => d >= 6)) {
            return {
                matched: true,
                direction: 5,
                prediction: 5,
                contract_type: 'DIGITUNDER',
                reason: 'all_gte_6',
                sequence: last3,
            };
        }
    }
    return {
        matched: false,
        direction: -1,
        prediction: -1,
        contract_type: null,
        reason: 'no_pattern',
        sequence: list.slice(-4),
    };
};

export const evaluatePatternSwitch = (digits, raw_options = {}) => {
    const options = normalizePatternSwitchOptions(raw_options);
    const signal = detectPatternSwitchSignal(digits);
    const journal_messages = [];

    if (options.journal_enabled) {
        if (signal.matched) {
            journal_messages.push({
                className: 'journal__text--success',
                message: `Pattern Switch: [${(signal.sequence || []).join(',')}] → ${signal.contract_type}${
                    signal.prediction >= 0 ? ` (${signal.prediction})` : ''
                }`,
            });
        } else {
            journal_messages.push({
                className: 'journal__text',
                message: `Pattern Switch: watching [${(signal.sequence || []).join(',') || '…'}]`,
            });
        }
    }

    return {
        ...signal,
        // Free-bot barrier procedure returns direction (0/1/4/5) or -1.
        prediction: signal.matched ? signal.direction : -1,
        barrier: signal.matched ? signal.direction : -1,
        journal_messages,
    };
};
