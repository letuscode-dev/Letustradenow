import type { FreeBot } from './types';
import {
    PATTERN_PROBABILITY_OVER_XML,
    PATTERN_PROBABILITY_UNDER_XML,
} from './bots/pattern-probability-ou';
import { SEQUENTIAL_DIGIT_DIFFERS_XML } from './bots/sequential-digit-differs';
import { EVEN_HOT_DIGIT_XML, ODD_HOT_DIGIT_XML } from './bots/odd-even-hot-digit';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'even-hot-digit-v1',
        title: 'Even Hot Digit',
        description:
            'Digit Differs on the selected market — even analysis only. Tip = hottest even → Differ coldest even. Recovery: martingale × Multiplier (default 10.5). Stops on Max Cons Loss or Profit Threshold. Set Lookback / Multiplier in Run once at start.',
        tags: ['Differs', 'Digit Differs', 'Hot digit', 'Even', 'Cold digit', 'Single market', 'Martingale'],
        xml: EVEN_HOT_DIGIT_XML,
    },
    {
        id: 'odd-hot-digit-v1',
        title: 'Odd Hot Digit',
        description:
            'Digit Differs on the selected market — odd analysis only. Tip = hottest odd → Differ coldest odd. Recovery: martingale × Multiplier (default 10.5). Stops on Max Cons Loss or Profit Threshold. Set Lookback / Multiplier in Run once at start.',
        tags: ['Differs', 'Digit Differs', 'Hot digit', 'Odd', 'Cold digit', 'Single market', 'Martingale'],
        xml: ODD_HOT_DIGIT_XML,
    },
    {
        id: 'sequential-digit-differs-v1',
        title: 'Sequential Digit Differs',
        description:
            'Scans volatility for ascending (1→2→3) / descending (8→7→6) runs → Differs previous_digit_2 (1 / 8). In Run once at start set Market_group to 1S, STANDARD, or ALL; Immediate_loss_retry is off by default.',
        tags: ['Differs', 'Sequential', 'Ascending', 'Descending', 'Multi-market', 'Loss retry'],
        xml: SEQUENTIAL_DIGIT_DIFFERS_XML,
    },
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
