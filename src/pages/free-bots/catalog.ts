import { JUMP_DIFFERS_XML } from './bots/jump-differs';
import { MIDDLE_GAP_DIFFERS_XML } from './bots/middle-gap-differ';
import { ONLY_UPS_DOWNS_XML } from './bots/only-ups-downs';
import { OVER_TWO_XML } from './bots/over-two';
import { OVER_UNDER_HEDGE_XML } from './bots/over-under-hedge';
import { QUIET_GAP_HEDGE_XML } from './bots/quiet-gap-hedge';
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
        id: 'over-under-hedge-v1',
        title: 'Over 5 / Under 4 Hedge',
        description:
            'Buys Over and Under together (default Over 5 and Under 4) when those digits dominate the last 5 ticks. Both sides share one tick. A double loss doubles the stake. Volatility 75 (1s), $1 each side, 1 tick.',
        tags: ['Over/Under', 'Hedge', 'Volatility', 'Recovery x2'],
        xml: OVER_UNDER_HEDGE_XML,
    },
    {
        id: 'quiet-gap-hedge-v1',
        title: 'Over 5 + Under 4 Quiet Gap',
        description:
            'Buys Over 5 and Under 4 when the last ticks have no 4 or 5 (default 1). Option 1 recovers immediately after both sides lose. A double loss doubles the stake. Volatility 75 (1s), $1 each side, 1 tick.',
        tags: ['Over/Under', 'Hedge', 'Volatility', 'Recovery x2'],
        xml: QUIET_GAP_HEDGE_XML,
    },
    {
        id: 'only-ups-downs-v1',
        title: 'Only Ups / Only Downs',
        description:
            'Buys Only Ups when the last 4 digits are all below 5, and Only Downs when they are all above 4. A mix does not trade. A loss multiplies the stake by 1.5. Stops at take profit or after 5 losses in a row. Volatility 75 (1s), $1, 2 ticks.',
        tags: ['Only Ups/Downs', 'Volatility', 'Martingale'],
        xml: ONLY_UPS_DOWNS_XML,
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
        title: 'Jump 10 Seconds Differs',
        description:
            'Buys Differs on Jump 10. The barrier is the last digit of the current seconds (09:54:01 differs on 1) and changes as the clock changes. A loss is recovered over the set number of wins using the payout percent. $2, payout 11%, 3 wins, 1 tick.',
        tags: ['Differs', 'Jump 10', 'Split recovery'],
        xml: MIDDLE_GAP_DIFFERS_XML,
    },
];
