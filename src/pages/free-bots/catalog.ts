import { ASCENDING_RANK_NEXT_DIFFER_XML } from './bots/ascending-rank-next-differ';
import { MISSING_DIGIT_RETURN_DIFFER_XML } from './bots/missing-digit-return-differ';
import { TOP_TWO_DIGIT_GAP_DIFFER_XML } from './bots/top-two-digit-gap-differ';
import { ZERO_ONE_RISE_OVER_XML } from './bots/zero-one-rise-over';
import type { FreeBot } from './types';

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
            'Ranks digits 0–9 over the last N ticks (default 1000). When the gap between the most and second-most appearing digits is greater than 0.3% (configurable) and the current digit is one of them, Differ the other. Journal shows WHY NO TRADE. Martingale 10.5 with cooldown.',
        tags: ['Differs', 'Top digits', 'Frequency gap', 'Martingale', 'Cooldown'],
        xml: TOP_TWO_DIGIT_GAP_DIFFER_XML,
    },
    {
        id: 'ascending-rank-next-differ-v1',
        title: 'Ascending Rank Next Digit DIFFER',
        description:
            'Ranks digits 0–9 by appearance % over the last N ticks (default 1000) in ascending order, updating on every tick. Differs the digit ranked just above the current digit. Journal shows WHY NO TRADE. Martingale 10.5 with cooldown.',
        tags: ['Differs', 'Ranking', 'Percentages', 'Martingale', 'Cooldown'],
        xml: ASCENDING_RANK_NEXT_DIFFER_XML,
    },
    {
        id: 'zero-one-rise-over-v1',
        title: 'Digit Rise OVER 1',
        description:
            'Tracks the % of your Target Digits (comma-separated, up to 9, default 0) over the last N ticks (default 120), updating on every tick. When any target % increases, enters OVER 1. After a loss, recovers with OVER 2, sizing the stake so one win pays back every unrecovered loss (uses the real Over 2 payout rate). Journal shows WHY NO TRADE.',
        tags: ['Over 1', 'Target digits', 'Over 2 recovery', 'Percentages', 'Full loss recovery', 'Cooldown'],
        xml: ZERO_ONE_RISE_OVER_XML,
    },
];
