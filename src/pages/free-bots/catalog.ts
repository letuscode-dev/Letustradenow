import type { FreeBot } from './types';
import { ODD_PAIR_OVER_XML, EVEN_PAIR_UNDER_XML } from './bots/even-odd-pair-ou';
import { HYBRID_MULTI_SCAN_XML } from './bots/hybrid-multi-scan';
import { PARITY_RUN_DIFFERS_XML } from './bots/parity-run-differs';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'parity-run-differs-v1',
        title: 'Parity-run Differs',
        description:
            'Scans 1s + standard volatilities (Market_group ALL). If the last Run_length digits (default 6) are all even or all odd → Differs the oldest of those digits (the 6th back). Switches to the signaling market. Recovery via Payout% (default 9.6). Set Market_group to 1S, STANDARD, or ALL in Run once at start.',
        tags: ['Differs', 'Even', 'Odd', 'Parity', 'Multi-market', '1s', 'Standard', 'Recovery'],
        xml: PARITY_RUN_DIFFERS_XML,
    },
    {
        id: 'hybrid-multi-scan-v1',
        title: 'Hybrid Multi-Scan',
        description:
            'Runs all free-bot scans on the selected market: Odd Pair Over, Even Pair Under, Pattern Probability, Sequential Differs, and Hot Digit. First match wins (pair → pattern → sequential → hot). Buys Over / Under / Differs via override. Recovery uses Payout_OU% (60) or Payout_Differs% (9.6).',
        tags: ['Hybrid', 'Multi-scan', 'Over', 'Under', 'Differs', 'Pair', 'Pattern', 'Sequential', 'Hot'],
        xml: HYBRID_MULTI_SCAN_XML,
    },
    {
        id: 'odd-pair-over-2-v1',
        title: 'Odd Pair Over 2',
        description:
            'Tick-fast scan: last 2 digits odd and last 3 digits ≥ Digit_min (default 5) → Over 2 on the same tip (no 1s Start sleep). On loss, sizes stake via Payout% (default 60) and trades Over 3 until recovered. Configure Digit_min / Payout% in Run once at start.',
        tags: ['Over 2', 'Odd', 'Pair', 'Recovery', 'Over 3', 'Tick-fast'],
        xml: ODD_PAIR_OVER_XML,
    },
    {
        id: 'even-pair-under-7-v1',
        title: 'Even Pair Under 7',
        description:
            'Tick-fast scan: last 2 digits even and last 3 digits ≤ Digit_max (default 4) → Under 7 on the same tip (no 1s Start sleep). On loss, sizes stake via Payout% (default 60) and trades Under 6 until recovered. Configure Digit_max / Payout% in Run once at start.',
        tags: ['Under 7', 'Even', 'Pair', 'Recovery', 'Under 6', 'Tick-fast'],
        xml: EVEN_PAIR_UNDER_XML,
    },
];
