import type { FreeBot } from './types';
import {
    PATTERN_PROBABILITY_OVER_XML,
    PATTERN_PROBABILITY_UNDER_XML,
} from './bots/pattern-probability-ou';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'pattern-probability-over-v1',
        title: 'Pattern Probability Over',
        description:
            'Statistical Digit Over bot via custom function — targets Over 2 only. Defaults: lookback 400, min occurrences 3.',
        tags: ['Over 2', 'Pattern', 'Probability', 'Statistics', 'Volatility 75 (1s)'],
        xml: PATTERN_PROBABILITY_OVER_XML,
    },
    {
        id: 'pattern-probability-under-v1',
        title: 'Pattern Probability Under',
        description:
            'Statistical Digit Under bot via custom function — targets Under 7 only. Defaults: lookback 400, min occurrences 3.',
        tags: ['Under 7', 'Pattern', 'Probability', 'Statistics', 'Volatility 75 (1s)'],
        xml: PATTERN_PROBABILITY_UNDER_XML,
    },
];
