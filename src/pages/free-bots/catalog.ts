import type { FreeBot } from './types';
import { DOUBLE_DIGIT_RETURN_DIFFERS_XML } from './bots/double-digit-return-differs';
import { INDIVIDUAL_DIGIT_SUPPRESSION_XML } from './bots/individual-digit-suppression';
import { PATTERN_SWITCH_XML } from './bots/pattern-switch';
import { TRIPLE_DIGIT_MARTINGALE_XML } from './bots/triple-digit-martingale';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'triple-digit-martingale-v1',
        title: 'Triple-Digit Martingale Differs',
        description:
            'Trades Digit Differs when three matching last digits appear. Multi-market ready — set stake, size, TP/SL, and symbols in Bot Builder.',
        tags: ['Differs', 'Martingale', 'Multi-market'],
        xml: TRIPLE_DIGIT_MARTINGALE_XML,
    },
    {
        id: 'double-digit-return-differs-v1',
        title: 'Double Digit → Return Differs',
        description:
            'Learns X → X → Y per digit, then Differs Y on the next double. Risk controls and journal are editable in Bot Builder.',
        tags: ['Differs', 'Double digit', 'Return'],
        xml: DOUBLE_DIGIT_RETURN_DIFFERS_XML,
    },
    {
        id: 'pattern-switch-v1',
        title: 'Pattern Switch',
        description:
            'Switches between Even, Odd, Over 4, and Under 5 from last-digit patterns, with martingale and stop rules in Bot Builder.',
        tags: ['Even/Odd', 'Over/Under', 'Pattern'],
        xml: PATTERN_SWITCH_XML,
    },
    {
        id: 'individual-digit-suppression-v1',
        title: 'Individual Digit Suppression Strategy',
        description:
            'Trades Over 1 only when digits 0–1 stay under the 10% baseline across Short/Medium/Long windows. Journals a suppression dashboard; thresholds are editable in Bot Builder (Over 2/3 disabled for a future recovery layer).',
        tags: ['Over 1', 'Suppression', 'Multi-window'],
        xml: INDIVIDUAL_DIGIT_SUPPRESSION_XML,
    },
];
