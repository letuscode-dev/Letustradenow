import { EVEN_ODD_XML } from './bots/even-odd';
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
            'You choose both predictions. The first trade waits until the last digit equals Entry Point, and that entry stays open until the trade is bought. After that, 5 or higher buys Under and 4 or lower buys Over on the active prediction. Every tick is 1 so the digit already on screen is not skipped, including after a contract settles; set it to 0 for normal speed. A loss switches to the after-loss prediction and sets the next stake so the profit at the payout percent pays back all the money lost. At 40% a $1 loss becomes $2.50, and the win profit is $1. A win returns to the initial stake. Volatility 75 (1s), $1, 1 tick.',
        tags: ['Over/Under', 'Volatility', 'Entry', 'Recovery 40%'],
        xml: OVER_UNDER_XML,
    },
    {
        id: 'even-odd-entry-v1',
        title: 'Even/Odd Entry',
        description:
            'The first trade waits until the last digit equals Entry Point. Later trades do not wait. Choose Even or Odd on the Purchase block; it starts on Even. It analyses every tick already on screen, so a tick is not skipped. A loss multiplies the stake by the martingale (default 1.5). A win returns to the stake. Stops at take profit or stop loss. Volatility 75 (1s), $1, 1 tick.',
        tags: ['Even/Odd', 'Volatility', 'Entry', 'Martingale'],
        xml: EVEN_ODD_XML,
    },
];
