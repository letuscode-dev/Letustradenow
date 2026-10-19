import { DIFFERS_HOT_XML } from './bots/differs-hot';
import { EVEN_ODD_XML } from './bots/even-odd';
import { EVEN_ONLY_XML } from './bots/even-only';
import { OVER_UNDER_FREQUENCY_XML } from './bots/over-under-frequency';
import { OVER_UNDER_XML } from './bots/over-under';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'over-under-entry-v1',
        title: 'Over/Under Entry',
        description:
            'Buys Under from 5 up and Over from 4 down. The first trade waits for Entry Point, and a loss recovers the lost amount at the payout percent.',
        tags: ['Over/Under', 'Volatility', 'Entry', 'Recovery 40%'],
        xml: OVER_UNDER_XML,
    },
    {
        id: 'even-odd-entry-v1',
        title: 'Even/Odd Frequency',
        description:
            'An even hottest digit trades Odd, and an odd one trades Even. The first trade waits for the rarest digit in that group, and a loss multiplies the stake.',
        tags: ['Even/Odd', 'Volatility', 'Frequency', 'Martingale'],
        xml: EVEN_ODD_XML,
    },
    {
        id: 'over-under-frequency-v1',
        title: 'Over/Under Frequency',
        description:
            'An even hottest digit trades Over 2, and an odd one trades Under 7. A loss switches to Over 3 or Under 6 and recovers the lost amount at the payout percent.',
        tags: ['Over/Under', 'Volatility', 'Frequency', 'Recovery 60%'],
        xml: OVER_UNDER_FREQUENCY_XML,
    },
    {
        id: 'even-only-v1',
        title: 'Odd Only',
        description: 'Buys Odd when the last two digits are both odd. A loss multiplies the stake.',
        tags: ['Odd', 'Volatility', 'Martingale'],
        xml: EVEN_ONLY_XML,
    },
    {
        id: 'differs-hot-v1',
        title: 'Hot Digit Differs',
        description:
            'Buys Differs on the most frequent digit after it misses the newest ticks. A loss recovers the lost amount at the payout percent.',
        tags: ['Differs', 'Volatility', 'Frequency', 'Recovery 9.6%'],
        xml: DIFFERS_HOT_XML,
    },
];
