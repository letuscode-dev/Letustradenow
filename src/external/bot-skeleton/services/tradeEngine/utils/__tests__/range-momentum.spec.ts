import {
    classifyDigitRange,
    createRangeMomentumState,
    detectRangeMomentum,
    evaluateRangeMomentumOverOne,
    passesLosingRangeFilter,
    RANGE_HIGHER,
    RANGE_LOSING,
    RANGE_LOWER,
} from '../range-momentum';

describe('classifyDigitRange', () => {
    it('classifies losing, lower, and higher ranges', () => {
        expect(classifyDigitRange(0)).toBe(RANGE_LOSING);
        expect(classifyDigitRange(1)).toBe(RANGE_LOSING);
        expect(classifyDigitRange(2)).toBe(RANGE_LOWER);
        expect(classifyDigitRange(5)).toBe(RANGE_LOWER);
        expect(classifyDigitRange(6)).toBe(RANGE_HIGHER);
        expect(classifyDigitRange(9)).toBe(RANGE_HIGHER);
    });
});

describe('detectRangeMomentum', () => {
    it('detects Lower → Higher momentum', () => {
        expect(detectRangeMomentum([7, 3, 8])).toEqual({
            previous: 3,
            current: 8,
            previous_range: RANGE_LOWER,
            current_range: RANGE_HIGHER,
            momentum: true,
        });
    });

    it('rejects Higher → Lower', () => {
        expect(detectRangeMomentum([6, 4]).momentum).toBe(false);
    });

    it('rejects Lower → Lower', () => {
        expect(detectRangeMomentum([4, 5]).momentum).toBe(false);
    });
});

describe('passesLosingRangeFilter', () => {
    it('passes when previous two ticks have no losing digits (example 1)', () => {
        // previous two excluding current: 7, 3
        expect(passesLosingRangeFilter([7, 3, 8], 2)).toBe(true);
    });

    it('fails when a losing digit is in the lookback window (example 2)', () => {
        // previous two excluding current: 0, 3
        expect(passesLosingRangeFilter([0, 3, 8], 2)).toBe(false);
    });
});

describe('evaluateRangeMomentumOverOne', () => {
    const opts = { enabled: true, journal_enabled: true, notify_enabled: true, losing_lookback: 2 };

    it('signals Over 1 on valid Lower→Higher with clean lookback (example 1)', () => {
        const result = evaluateRangeMomentumOverOne([7, 3, 8], opts);
        expect(result.allowed).toBe(true);
        expect(result.momentum).toBe(true);
        expect(result.losing_filter_ok).toBe(true);
        expect(result.journal_messages[0].className).toBe('journal__text--success');
        expect(result.notify_messages[0].message).toContain('Over 1 signal');
    });

    it('blocks when losing digit is in lookback (example 2)', () => {
        const result = evaluateRangeMomentumOverOne([0, 3, 8], opts);
        expect(result.allowed).toBe(false);
        expect(result.momentum).toBe(true);
        expect(result.losing_filter_ok).toBe(false);
        expect(result.fail_reason).toMatch(/Losing digit/i);
        expect(result.journal_messages[0].className).toBe('journal__text--error');
    });

    it('blocks Higher→Lower (example 3)', () => {
        const result = evaluateRangeMomentumOverOne([6, 4], opts);
        expect(result.allowed).toBe(false);
        expect(result.fail_reason).toMatch(/Higher→Lower/i);
    });

    it('blocks Lower→Lower (example 4)', () => {
        const result = evaluateRangeMomentumOverOne([4, 5], opts);
        expect(result.allowed).toBe(false);
        expect(result.fail_reason).toMatch(/Lower range/i);
    });

    it('respects disabled strategy', () => {
        const result = evaluateRangeMomentumOverOne([7, 3, 8], { ...opts, enabled: false });
        expect(result.allowed).toBe(false);
        expect(result.fail_reason).toMatch(/disabled/i);
    });

    it('applies cooldown after a signal', () => {
        const state = createRangeMomentumState();
        const first = evaluateRangeMomentumOverOne([7, 3, 8], { ...opts, cooldown_after_trade: 2 }, state);
        expect(first.allowed).toBe(true);

        const second = evaluateRangeMomentumOverOne([7, 3, 8, 4], { ...opts, cooldown_after_trade: 2 }, state);
        expect(second.allowed).toBe(false);
        expect(second.fail_reason).toMatch(/Cooldown/i);
    });
});
