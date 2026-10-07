import { OVER_TWO_XML } from './bots/over-two';
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
            'Buys Over 2 when the last N digits are all above 2 (Digits to Check, default 4). One trade per signal, then it checks again. Keeps trading until take profit, stop loss, or you stop it. After a loss the next stake recovers the full amount lost at a 40% payout, rounded up. Two losses in a row add 0.05 to the multiplier and that scales the recovery stake until a win restores it. Volatility 75 (1s), $1 stake, 1 tick.',
        tags: ['Over/Under', 'Volatility', 'Digit filter', 'Recovery 40%'],
        xml: OVER_TWO_XML,
    },
    {
        id: 'rise-fall-v1',
        title: 'Rise/Fall Consecutive Ticks',
        description:
            'Buys Rise after consecutive up ticks and Fall after consecutive down ticks (Consecutive Ticks, default 3). Trade Side is 0 for both sides, 1 for Rise only, or 2 for Fall only. Each signal takes Trades per Signal contracts of that side (default 3), then checks again. A loss multiplies the stake by 2. A win returns to the initial stake. Keeps trading until take profit, stop loss, or you stop it. Volatility 50 (1s), $1 stake, 3 ticks.',
        tags: ['Rise/Fall', 'Volatility', 'Consecutive ticks', 'Martingale'],
        xml: RISE_FALL_XML,
    },
];
