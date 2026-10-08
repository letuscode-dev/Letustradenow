import { DIGIT_HEDGE_FILTER_XML } from './bots/digit-hedge-filter';
import { OVER_TWO_XML } from './bots/over-two';
import { OVER_UNDER_HEDGE_XML } from './bots/over-under-hedge';
import { RISE_FALL_XML } from './bots/rise-fall';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'over-two-v1',
        title: 'Over 2 Digit Filter',
        description:
            'Buys Over 2 when the last digits are all above 2 (default 4). A loss sizes the next stake from the payout percent. A win returns to the set stake. Volatility 75 (1s), $1, 2 ticks.',
        tags: ['Over/Under', 'Volatility', 'Digit filter', 'Recovery 40%'],
        xml: OVER_TWO_XML,
    },
    {
        id: 'rise-fall-v1',
        title: 'Rise/Fall Consecutive Ticks',
        description:
            'Up ticks buy Fall Equals. Down ticks buy Rise Equals (default 3 in a row). Extra trades run only after a loss. A win resets the stake. Volatility 50 (1s), $1, 1 tick.',
        tags: ['Rise/Fall', 'Volatility', 'Consecutive ticks', 'Martingale'],
        xml: RISE_FALL_XML,
    },
    {
        id: 'over-under-hedge-v1',
        title: 'Over 5 / Under 4 Hedge',
        description:
            'Buys Over and Under together (default Over 5 and Under 4) when those digits dominate the last 5 ticks. Both sides share one tick. A double loss doubles the stake. Volatility 75 (1s), $1 each side, 1 tick.',
        tags: ['Over/Under', 'Hedge', 'Volatility', 'Recovery x2'],
        xml: OVER_UNDER_HEDGE_XML,
    },
    {
        id: 'digit-hedge-filter-v1',
        title: 'Over 5 + Under 4 Digit Hedge',
        description:
            'Buys Over 5 and Under 4 together when 4 and 5 stay quiet on the last 100 ticks, 0–3 and 6–9 are each at least 40%, the recent gap is not rising, and no repeated pattern points at 4 or 5. Volatility 75 (1s), $1 each side, 1 tick.',
        tags: ['Over/Under', 'Hedge', 'Volatility', 'Digit filter'],
        xml: DIGIT_HEDGE_FILTER_XML,
    },
];
