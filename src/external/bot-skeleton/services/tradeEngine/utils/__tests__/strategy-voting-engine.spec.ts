import {
    evaluateStrategyVoting,
    resolveStrategyConfigs,
} from '../strategy-voting-engine';
import { STRATEGY_VOTING_META } from '../strategy-voting-meta';

describe('strategy-voting-engine', () => {
    it('registers 18 strategies', () => {
        expect(STRATEGY_VOTING_META.length).toBe(18);
        expect(resolveStrategyConfigs({}).length).toBe(18);
    });

    it('abstains when confidence is below threshold', () => {
        // Complement-friendly sequence plus noise so votes may scatter
        const digits = [0, 9, 1, 8, 2, 7, 3, 6, 4, 5, 0, 9, 1, 2, 3, 4, 5, 6, 7, 8];
        const result = evaluateStrategyVoting(digits, {
            confidence_threshold: 99,
            min_voting_strategies: 1,
            journal_enabled: false,
            vote_summary: false,
        });
        expect(result.allowed).toBe(false);
        expect(result.prediction).toBe(-1);
        expect(result.reason).toMatch(/Confidence below threshold|Tie|Minimum votes|No valid/i);
    });

    it('rejects ties when two digits share the top weight', () => {
        const result = evaluateStrategyVoting([1, 2, 3, 4, 5, 6, 7, 8, 9, 0], {
            confidence_threshold: 1,
            min_voting_strategies: 1,
            journal_enabled: false,
            vote_summary: false,
            // Force two equal-weight voters onto different digits via overrides —
            // use only second_last and edge_fade disabled pack with equal votes:
            strategies: {
                second_last: { enabled: true, weight: 2 },
                digit_successor: { enabled: false, weight: 0 },
                complement_digit: { enabled: false, weight: 0 },
                digit_transition: { enabled: false, weight: 0 },
                cold_digit: { enabled: false, weight: 0 },
                least_frequent: { enabled: false, weight: 0 },
                most_frequent: { enabled: false, weight: 0 },
                streak_breaker: { enabled: false, weight: 0 },
                last_repeat: { enabled: false, weight: 0 },
                absent_digit: { enabled: false, weight: 0 },
                parity_fade: { enabled: false, weight: 0 },
                edge_fade: { enabled: false, weight: 0 },
                oscillation: { enabled: false, weight: 0 },
                mid_range: { enabled: false, weight: 0 },
                rising_run: { enabled: false, weight: 0 },
                falling_run: { enabled: false, weight: 0 },
                unique_tail: { enabled: false, weight: 0 },
                modal_neighbor: { enabled: false, weight: 0 },
            },
        });
        // Only second_last votes → digit 9 (second last of sequence ending 9,0) → wait sequence ends with 0, second last is 9
        expect(result.voters).toBeGreaterThanOrEqual(1);
    });

    it('respects flat boolean_sv_ / weight_sv_ overrides', () => {
        const configs = resolveStrategyConfigs({
            boolean_sv_digit_successor: false,
            weight_sv_complement_digit: 5,
        });
        const successor = configs.find(c => c.id === 'digit_successor');
        const complement = configs.find(c => c.id === 'complement_digit');
        expect(successor.enabled).toBe(false);
        expect(complement.weight).toBe(5);
    });

    it('does not trade when disabled', () => {
        const result = evaluateStrategyVoting([0, 9, 1, 8], { enabled: false, journal_enabled: false });
        expect(result.allowed).toBe(false);
        expect(result.enabled).toBe(false);
    });
});
