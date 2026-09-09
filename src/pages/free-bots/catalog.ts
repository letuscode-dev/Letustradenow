import type { FreeBot } from './types';
import { DOUBLE_DIGIT_RETURN_DIFFERS_XML } from './bots/double-digit-return-differs';
import { PATTERN_SWITCH_XML } from './bots/pattern-switch';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'double-digit-return-differs-v1',
        title: 'Double Digit → Return Differs Strategy',
        description:
            'Tracks all ten digits independently. Stores Y after X → X → Y, then places Digit Differs Y on the next X → X. Includes a 120-tick minimum window, stake/duration controls, take profit, consecutive-loss stop loss, one-step 10.5x recovery, trade limit, cooldown, auto-trading, and live state journal.',
        tags: ['Differs', 'Double digit', 'Return pattern', '10-state tracking', 'Configurable window'],
        xml: DOUBLE_DIGIT_RETURN_DIFFERS_XML,
    },
    {
        id: 'pattern-switch-v1',
        title: 'Pattern Switch',
        description:
            'Scans last digits every second until a pattern hits: last 4 all odd → Purchase Even; last 4 all even → Purchase Odd; last 3 all ≤ 3 → Over 4; last 3 all ≥ 6 → Under 5. Martingale on loss (default ×2). After Re Analyse After wins (default 3), clears the signal and re-scans. Stops at Take Profit / Stop Loss.',
        tags: ['Even', 'Odd', 'Over 4', 'Under 5', 'Pattern', 'Martingale', 'Single-market'],
        xml: PATTERN_SWITCH_XML,
    },
];
