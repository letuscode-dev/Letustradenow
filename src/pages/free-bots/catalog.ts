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
            'Buys Over 2 when the last N digits are all above 2 (Digits to Check, default 4). One trade per signal, then it checks again. Keeps trading until take profit, stop loss, or you stop it. After a loss the next stake is only the amount lost divided by the payout percent (default 40), rounded up. A win returns to the set stake. Volatility 75 (1s), $1 stake, 2 ticks.',
        tags: ['Over/Under', 'Volatility', 'Digit filter', 'Recovery 40%'],
        xml: OVER_TWO_XML,
    },
    {
        id: 'rise-fall-v1',
        title: 'Rise/Fall Consecutive Ticks',
        description:
            'Fades the streak on Rise Equals and Fall Equals: consecutive up ticks buy Fall Equals, and consecutive down ticks buy Rise Equals (Consecutive Ticks, default 3). Trade Side is 0 for both, 1 for Rise Equals only, or 2 for Fall Equals only. Trades per Signal (default 3) counts losing trades of that signal. A win returns the stake to the initial amount and sets the trades left on that signal to 0, so it stops even when 2 or 3 were set. A loss multiplies the stake by 2 and takes the next trade of the same signal until the count is met. Volatility 50 (1s), $1 stake, 1 tick.',
        tags: ['Rise/Fall', 'Volatility', 'Consecutive ticks', 'Martingale'],
        xml: RISE_FALL_XML,
    },
    {
        id: 'over-under-hedge-v1',
        title: 'Over 5 / Under 4 Hedge',
        description:
            'Buys Over 5 and Under 4 together when 4 and 5 dominate the last 5 ticks. The check uses ticks already in memory. Immediate Loss Hedge: 1 sends the next Over 5 and Under 4 hedge as soon as both sides lose, without another digit check. 0 waits for the digit check. It does not keep a trade unless both sides are bought. Take profit and stop loss use the combined profit of both sides. The stake becomes the bought stake times 2 only when both sides lose. If one side wins, the stake returns to the set amount. Volatility 75 (1s), $1 stake on each side, 1 tick.',
        tags: ['Over/Under', 'Hedge', 'Volatility', 'Recovery x2'],
        xml: OVER_UNDER_HEDGE_XML,
    },
];
