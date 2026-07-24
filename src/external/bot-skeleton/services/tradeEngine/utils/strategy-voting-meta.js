/**
 * Strategy Voting — shared strategy metadata (ids, defaults).
 * Used by the voting engine and (mirrored) Quick Strategy form fields.
 */

export const STRATEGY_VOTING_META = [
    { id: 'digit_successor', label: 'Digit Successor', default_weight: 1.5, default_enabled: true },
    { id: 'complement_digit', label: 'Complement Digit', default_weight: 1.2, default_enabled: true },
    { id: 'digit_transition', label: 'Digit Transition', default_weight: 1.0, default_enabled: true },
    { id: 'cold_digit', label: 'Cold Digit', default_weight: 2.0, default_enabled: true },
    { id: 'least_frequent', label: 'Least Frequent', default_weight: 1.4, default_enabled: true },
    { id: 'most_frequent', label: 'Most Frequent', default_weight: 1.0, default_enabled: true },
    { id: 'streak_breaker', label: 'Streak Breaker', default_weight: 1.8, default_enabled: true },
    { id: 'last_repeat', label: 'Last Repeat', default_weight: 1.3, default_enabled: true },
    { id: 'absent_digit', label: 'Absent Digit', default_weight: 1.6, default_enabled: true },
    { id: 'second_last', label: 'Second Last', default_weight: 0.9, default_enabled: true },
    { id: 'parity_fade', label: 'Parity Fade', default_weight: 1.1, default_enabled: true },
    { id: 'edge_fade', label: 'Edge Fade', default_weight: 1.0, default_enabled: true },
    { id: 'oscillation', label: 'Oscillation', default_weight: 1.3, default_enabled: true },
    { id: 'mid_range', label: 'Mid Range', default_weight: 1.0, default_enabled: true },
    { id: 'rising_run', label: 'Rising Run', default_weight: 1.2, default_enabled: true },
    { id: 'falling_run', label: 'Falling Run', default_weight: 1.2, default_enabled: true },
    { id: 'unique_tail', label: 'Unique Tail', default_weight: 1.1, default_enabled: true },
    { id: 'modal_neighbor', label: 'Modal Neighbor', default_weight: 1.0, default_enabled: true },
];

export const DEFAULT_CONFIDENCE_THRESHOLD = 70;
export const DEFAULT_MIN_VOTING_STRATEGIES = 3;
export const DEFAULT_MAX_ABSTAINING = 15;
export const DEFAULT_TICK_WINDOW = 50;
