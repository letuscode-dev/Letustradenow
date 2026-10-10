import { JUMP_DIFFERS_XML } from './bots/jump-differs';
import { MIDDLE_GAP_DIFFERS_XML } from './bots/middle-gap-differ';
import { OVER_TWO_XML } from './bots/over-two';
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
        id: 'over-two-v1',
        title: 'Over 2 Digit Filter',
        description:
            'Buys Over 2 when the last digits are all above 2 (default 4). A loss sizes the next stake from the payout percent. A win returns to the set stake. Volatility 75 (1s), $1, 2 ticks.',
        tags: ['Over/Under', 'Volatility', 'Digit filter', 'Recovery 40%'],
        xml: OVER_TWO_XML,
    },
    {
        id: 'jump-differs-v1',
        title: 'Jump 10 Differs',
        description:
            'Buys Differs on Jump 10. The digit is the last digit plus 1, or minus 1 when the last digit is 8 or 9. A win returns to the stake. A loss sets the stake times 10.5. $2, 1 tick.',
        tags: ['Differs', 'Jump 10', 'Martingale'],
        xml: JUMP_DIFFERS_XML,
    },
    {
        id: 'middle-gap-differs-v1',
        title: 'Seconds Differs',
        description:
            'Buys Differs on Volatility 75 (1s). The barrier is the last digit of the current seconds (09:54:01 differs on 1). A loss is recovered in 1 win at 9.6% payout. Stops at $5 take profit or after 5 losses in a row. $2, 1 tick.',
        tags: ['Differs', 'Volatility', 'Recovery'],
        xml: MIDDLE_GAP_DIFFERS_XML,
    },
    {
        id: 'over-under-entry-v1',
        title: 'Over/Under Entry',
        description:
            'You choose both predictions. The first trade waits until the last digit equals Entry Point. After that, 5 or higher buys Under and 4 or lower buys Over on the active prediction. Every tick is 1 so the current digit is not skipped; set it to 0 for normal speed. A loss switches to the after-loss prediction and sets the next stake to the lost amount divided by the payout percent, plus the initial stake. At 40% a $1 loss becomes $3.50. A win returns to the initial stake. Volatility 75 (1s), $1, 1 tick.',
        tags: ['Over/Under', 'Volatility', 'Entry', 'Recovery 40%'],
        xml: OVER_UNDER_XML,
    },
];
