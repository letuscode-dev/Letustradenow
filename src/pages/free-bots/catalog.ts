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
            'Tick-fast scan: last 2 digits odd and ≤ Odd_max (default 5) → Over 2 on the same tip (no 1s Start sleep). On loss, sizes stake via Payout% (default 60) and trades Over 3 until recovered. Configure Odd_max / Payout% in Run once at start.',
        tags: ['Over 2', 'Odd', 'Pair', 'Recovery', 'Over 3', 'Tick-fast'],
        xml: ODD_PAIR_OVER_XML,
    },
    {
        id: 'even-pair-under-7-v1',
        title: 'Even Pair Under 7',
        description:
            'Tick-fast scan: last 2 digits even and > Even_min (default 4) → Under 7 on the same tip (no 1s Start sleep). On loss, sizes stake via Payout% (default 60) and trades Under 6 until recovered. Configure Even_min / Payout% in Run once at start.',
        tags: ['Under 7', 'Even', 'Pair', 'Recovery', 'Under 6', 'Tick-fast'],
        xml: EVEN_PAIR_UNDER_XML,
    },
];
