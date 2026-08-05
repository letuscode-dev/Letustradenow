import type { FreeBot } from './types';
import { ODD_PAIR_OVER_XML, EVEN_PAIR_UNDER_XML } from './bots/even-odd-pair-ou';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'odd-pair-over-2-v1',
        title: 'Odd Pair Over 2',
        description:
            'Scans last 2 digits: both odd and ≤ Odd_max (default 5) → Over 2 immediately. On loss, sizes stake via Payout% (default 60) to fully recover and trades Over 3 until recovered, then resets to base Stake. Configure Odd_max / Payout% in Run once at start.',
        tags: ['Over 2', 'Odd', 'Pair', 'Recovery', 'Over 3'],
        xml: ODD_PAIR_OVER_XML,
    },
    {
        id: 'even-pair-under-7-v1',
        title: 'Even Pair Under 7',
        description:
            'Scans last 2 digits: both even and > Even_min (default 4) → Under 7 immediately. On loss, sizes stake via Payout% (default 60) to fully recover and trades Under 6 until recovered, then resets to base Stake. Configure Even_min / Payout% in Run once at start.',
        tags: ['Under 7', 'Even', 'Pair', 'Recovery', 'Under 6'],
        xml: EVEN_PAIR_UNDER_XML,
    },
];
