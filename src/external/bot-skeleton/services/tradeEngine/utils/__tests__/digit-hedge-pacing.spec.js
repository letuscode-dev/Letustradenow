import { backoffHedgeQuotes, configureHedgePacing, hedgePacingDelay, isRateLimitError, recordHedgeAttempt } from '../digit-hedge-pacing';

describe('digit hedge pacing', () => {
    it('validates the batch and wait and preserves a live cooldown when configured again', () => {
        const state = {};
        expect(configureHedgePacing(state, 2, 10)).toBe(true);
        recordHedgeAttempt(state);
        recordHedgeAttempt(state);
        expect(hedgePacingDelay(state, 1000)).toBe(10000);
        expect(configureHedgePacing(state, 2, 10)).toBe(true);
        expect(hedgePacingDelay(state, 6000)).toBe(5000);
        expect(hedgePacingDelay(state, 11000)).toBe(0);
        expect(state.attempts).toBe(0);
        expect(configureHedgePacing(state, 0, 10)).toBe(false);
        expect(configureHedgePacing(state, 1.5, 10)).toBe(false);
        expect(configureHedgePacing(state, 2, 0)).toBe(false);
        expect(configureHedgePacing(state, 2, 86401)).toBe(false);
    });

    it('backs off repeated rate-limit responses without shortening the user wait', () => {
        const state = {};
        configureHedgePacing(state, 5, 10);
        expect(isRateLimitError({ error: { code: 'RateLimit' } })).toBe(true);
        expect(isRateLimitError({ code: 'RateLimit' })).toBe(true);
        expect(isRateLimitError({ message: 'Too many requests' })).toBe(true);
        expect(isRateLimitError({ error: { code: 'InvalidContract' } })).toBe(false);
        expect(backoffHedgeQuotes(state, 1000)).toBe(60000);
        expect(hedgePacingDelay(state, 61000)).toBe(0);
        expect(backoffHedgeQuotes(state, 61000)).toBe(120000);
        expect(hedgePacingDelay(state, 181000)).toBe(0);
        expect(backoffHedgeQuotes(state, 181000)).toBe(240000);
        configureHedgePacing(state, 5, 600);
        expect(backoffHedgeQuotes(state, 421000)).toBeGreaterThanOrEqual(600000);
    });
});
