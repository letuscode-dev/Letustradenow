import type { FreeBot } from './types';
import { RECURRING_PATTERN_DIFFER_XML } from './bots/recurring-pattern-differ';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'recurring-pattern-differ-v1',
        title: 'Recurring Pattern Differ',
        description:
            'ACTIVE Differ strategy: when a recurring digit pattern (default length 3) completes, Differ the historically most frequent next digit if ≥3 occurrences, target ≥15%, and advantage ≥5pp. Journal shows WHY NO TRADE. Set Signal Mode to strict for extra filters. Martingale 10.5.',
        tags: ['Differs', 'Pattern', 'Conditional probability', 'Martingale', 'Active'],
        xml: RECURRING_PATTERN_DIFFER_XML,
    },
];
