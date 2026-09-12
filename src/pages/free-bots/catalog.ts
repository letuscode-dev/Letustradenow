import type { FreeBot } from './types';
import { DIGIT_PERCENTAGE_DECREASE_XML } from './bots/digit-percentage-decrease';
import { DOUBLE_DIGIT_RETURN_DIFFERS_XML } from './bots/double-digit-return-differs';
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
        id: 'digit-percentage-decrease-v1',
        title: 'Digit Percentage Decrease – Differ',
        description:
            'On every new tick, recomputes all digit percentages over a rolling 1000-tick window and trades Digit Differs when any digit’s share drops by at least 0.1pp vs the previous tip. Default martingale 10.5; window and drop threshold are editable in Bot Builder.',
        tags: ['Differs', 'Percentage', 'Decrease', 'Martingale'],
        xml: DIGIT_PERCENTAGE_DECREASE_XML,
    },
];
