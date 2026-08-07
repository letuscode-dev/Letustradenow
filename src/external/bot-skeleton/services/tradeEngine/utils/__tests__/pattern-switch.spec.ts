import {
    detectPatternSwitchSignal,
    evaluatePatternSwitch,
    normalizePatternSwitchOptions,
} from '../pattern-switch';

describe('detectPatternSwitchSignal', () => {
    it('detects last 4 all odd → Even', () => {
        const result = detectPatternSwitchSignal([2, 1, 3, 5, 7]);
        expect(result.matched).toBe(true);
        expect(result.direction).toBe(0);
        expect(result.contract_type).toBe('DIGITEVEN');
    });

    it('detects last 4 all even → Odd', () => {
        const result = detectPatternSwitchSignal([1, 2, 4, 0, 6]);
        expect(result.matched).toBe(true);
        expect(result.direction).toBe(1);
        expect(result.contract_type).toBe('DIGITODD');
    });

    it('detects last 3 all ≤ 3 → Over 4', () => {
        const result = detectPatternSwitchSignal([9, 1, 2, 3]);
        expect(result.matched).toBe(true);
        expect(result.direction).toBe(4);
        expect(result.prediction).toBe(4);
        expect(result.contract_type).toBe('DIGITOVER');
    });

    it('detects last 3 all ≥ 6 → Under 5', () => {
        const result = detectPatternSwitchSignal([0, 6, 8, 9]);
        expect(result.matched).toBe(true);
        expect(result.direction).toBe(5);
        expect(result.prediction).toBe(5);
        expect(result.contract_type).toBe('DIGITUNDER');
    });

    it('prefers 4-digit parity over 3-digit high/low when both could apply', () => {
        // last 4 odd wins before checking last 3
        const result = detectPatternSwitchSignal([1, 3, 5, 7]);
        expect(result.direction).toBe(0);
    });
});

describe('evaluatePatternSwitch', () => {
    it('returns direction as prediction for free-bot barrier', () => {
        const result = evaluatePatternSwitch([2, 4, 0, 6], { journal_enabled: false });
        expect(result.prediction).toBe(1);
        expect(result.matched).toBe(true);
    });

    it('returns -1 when watching', () => {
        const result = evaluatePatternSwitch([1, 2, 8], { journal_enabled: true });
        expect(result.prediction).toBe(-1);
        expect(result.journal_messages.length).toBeGreaterThan(0);
    });

    it('normalizes options', () => {
        expect(normalizePatternSwitchOptions({}).journal_enabled).toBe(true);
    });
});
