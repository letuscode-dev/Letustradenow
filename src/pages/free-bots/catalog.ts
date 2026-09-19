import type { FreeBot } from './types';
import { RECURRING_PATTERN_DIFFER_XML } from './bots/recurring-pattern-differ';
import { RECURRING_PATTERN_OVER2_XML } from './bots/recurring-pattern-over2';
import { RECURRING_PATTERN_UNDER7_XML } from './bots/recurring-pattern-under7';

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
    {
        id: 'recurring-pattern-over2-v1',
        title: 'Recurring Pattern Over 2 Consistency',
        description:
            'OVER 2 only. When a recurring digit pattern shows high Over 2 rate (≥75%) and high consistency (≥70) vs the 70% baseline, places Digit Over 2. Journal shows WHY NO TRADE. Strict mode raises thresholds. Martingale 10.5.',
        tags: ['Over 2', 'Pattern', 'Consistency', 'Martingale', 'Active'],
        xml: RECURRING_PATTERN_OVER2_XML,
    },
    {
        id: 'recurring-pattern-under7-v1',
        title: 'Recurring Pattern Under 7 Consistency',
        description:
            'UNDER 7 only. When a recurring digit pattern shows high Under 7 rate (≥75%) and high consistency (≥70) vs the 70% baseline, places Digit Under 7. Journal shows WHY NO TRADE. Strict mode raises thresholds. Martingale 10.5.',
        tags: ['Under 7', 'Pattern', 'Consistency', 'Martingale', 'Active'],
        xml: RECURRING_PATTERN_UNDER7_XML,
    },
];
