import type { FreeBot } from './types';
import { DOUBLE_DIGIT_RETURN_DIFFERS_XML } from './bots/double-digit-return-differs';
import { INDIVIDUAL_DIGIT_SUPPRESSION_XML } from './bots/individual-digit-suppression';
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
        id: 'individual-digit-suppression-v1',
        title: 'Individual Digit Suppression Strategy',
        description:
            'Ranks Over 1 / Over 2 / Over 3 from multi-window digit suppression (10% baseline), journals a live dashboard, and trades the strongest DIGITOVER signal. Windows, thresholds, enables, and cooldowns are configurable in Bot Builder.',
        tags: ['Over 1', 'Over 2', 'Over 3', 'Suppression'],
        xml: INDIVIDUAL_DIGIT_SUPPRESSION_XML,
    },
    {
        id: 'percentage-reversal-v1',
        title: 'Percentage Reversal',
        description:
            'Tracks digit percentages across Short/Medium/Long windows and trades Digit Differs when a dominant digit collapses into underrepresentation — a percentage regime-change strategy. Windows, dominance/collapse thresholds, martingale, and TP/SL are configurable in Bot Builder.',
        tags: ['Differs', 'Percentage', 'Regime change'],
        xml: PERCENTAGE_REVERSAL_XML,
    },
];