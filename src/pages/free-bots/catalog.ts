import { FIRST_DECIMAL_DIGIT_DIFFER_XML } from './bots/first-decimal-digit-differ';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'first-decimal-digit-differ-v1',
        title: 'Double Decimal Digit Differ + 10.5 Recovery',
        description:
            'Trades Differs when the last two decimals of the price match (4681.33 → DIFFER 3). 10.5× recovery after a loss, reset to base stake on a win, with recovery and risk limits. Volatility 75 (1s), $2 stake, 1 tick.',
        tags: ['Differs', 'Repeated last two decimals', 'Automatic barrier', '10.5× recovery', 'Live journal'],
        xml: FIRST_DECIMAL_DIGIT_DIFFER_XML,
    },
];
