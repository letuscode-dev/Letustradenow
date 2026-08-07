import type { FreeBot } from './types';
import { PATTERN_SWITCH_XML } from './bots/pattern-switch';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'pattern-switch-v1',
        title: 'Pattern Switch',
        description:
            'Scans last digits every second until a pattern hits: last 4 all odd → Purchase Even; last 4 all even → Purchase Odd; last 3 all ≤ 3 → Over 4; last 3 all ≥ 6 → Under 5. Martingale on loss (default ×2). After Re Analyse After wins (default 3), clears the signal and re-scans. Stops at Take Profit / Stop Loss.',
        tags: ['Even', 'Odd', 'Over 4', 'Under 5', 'Pattern', 'Martingale', 'Single-market'],
        xml: PATTERN_SWITCH_XML,
    },
];
