/**
 * Safely evaluate numeric / arithmetic field values (e.g. tick delay).
 * Rejects anything that is not a safe math expression before evaluating —
 * Blockly variable names still fall through to caller validation via
 * 'invalid_input'.
 */
const SAFE_NUMERIC_EXPRESSION = /^[\d\s+\-*/().%eE]+$/;

export const evaluateExpression = value => {
    if (!value) return 'invalid_input';
    const trimmed = String(value).trim();
    if (!SAFE_NUMERIC_EXPRESSION.test(trimmed)) {
        return 'invalid_input';
    }
    try {
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${trimmed});`)();
        return typeof result === 'number' && !isNaN(result) ? result : 'invalid_input';
    } catch (e) {
        return 'invalid_input';
    }
};
