import type { FreeBot } from './types';
import { MISSING_DIGIT_RETURN_DIFFER_XML } from './bots/missing-digit-return-differ';
import { TOP_TWO_DIGIT_GAP_DIFFER_XML } from './bots/top-two-digit-gap-differ';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'missing-digit-return-differ-v1',
        title: 'Missing Digit Return DIFFER',
        description:
            'When a digit reappears after being missing for a configurable period (default 20 tips), Differ that digit. Journal shows WHY NO TRADE. Martingale 10.5 with cooldown.',
        tags: ['Differs', 'Missing digit', 'Absence', 'Martingale', 'Cooldown'],
        xml: MISSING_DIGIT_RETURN_DIFFER_XML,
    },
    {
        id: 'top-two-digit-gap-differ-v1',
        title: 'Top Two Digit Gap DIFFER',
        description:
            'Ranks digits 0–9 over the last N ticks (default 1000). When the gap between the most and second-most appearing digits is within 0.5% and the current digit is one of them, Differ the other. Journal shows WHY NO TRADE. Martingale 10.5 with cooldown.',
        tags: ['Differs', 'Top digits', 'Frequency gap', 'Martingale', 'Cooldown'],
        xml: TOP_TWO_DIGIT_GAP_DIFFER_XML,
    },
];
