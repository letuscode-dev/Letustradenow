import type { FreeBot } from './types';
import { DIGIT_PERCENTAGE_DECREASE_XML } from './bots/digit-percentage-decrease';
import { DOMINANT_DIGIT_PERCENTAGE_XML } from './bots/dominant-digit-percentage';
import { DOUBLE_DIGIT_RETURN_DIFFERS_XML } from './bots/double-digit-return-differs';
import { PATTERN_SWITCH_XML } from './bots/pattern-switch';
import { PERCENTAGE_REVERSAL_XML } from './bots/percentage-reversal';
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
        id: 'percentage-reversal-v1',
        title: 'Percentage Reversal',
        description:
            'Scans Selected Symbols for digit percentage regime changes (dominance → collapse) and trades Digit Differs on the strongest match, switching market when needed. Default martingale is 10.5; windows, thresholds, martingale, and TP/SL are configurable in Bot Builder.',
        tags: ['Differs', 'Percentage', 'Martingale', 'Multi-market'],
        xml: PERCENTAGE_REVERSAL_XML,
    },
    {
        id: 'dominant-digit-percentage-v1',
        title: 'Dominant Digit Percentage – Differ',
        description:
            'Finds the highest-occurrence digit in a configurable tick window and trades Digit Differs when its percentage (and optional gap, persistence, and multi-window filters) pass. Default martingale 10.5; full settings in Bot Builder.',
        tags: ['Differs', 'Percentage', 'Dominant', 'Martingale'],
        xml: DOMINANT_DIGIT_PERCENTAGE_XML,
    },
    {
        id: 'digit-percentage-decrease-v1',
        title: 'Digit Percentage Decrease – Differ',
        description:
            'Tracks all digits over a rolling 1000-tick window and trades Digit Differs when any digit’s occurrence percentage drops by at least 0.1pp. Default martingale 10.5; window and drop threshold are editable in Bot Builder.',
        tags: ['Differs', 'Percentage', 'Decrease', 'Martingale'],
        xml: DIGIT_PERCENTAGE_DECREASE_XML,
    },
];
