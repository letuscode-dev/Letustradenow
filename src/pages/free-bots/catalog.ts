import { RANK_DROP_DIFFER_XML } from './bots/rank-drop-differ';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'rank-drop-differ-v1',
        title: 'Rank Drop Differs',
        description:
            'Ranks digits 0–9 from highest to lowest frequency over the Analysis Window (default 1000) as it was Lookback Ticks ago (default 100) and as it is now, finds the digit whose rank deteriorated the most (e.g. #1 → #4) and Differs it when the drop is at least the Minimum Rank Drop (default 3). Several digits sharing the biggest drop means no trade — never picks randomly. Optional new-tick confirmation and on/off switch. Journal shows both rankings, the biggest mover and WHY NO TRADE. Take Profit / Stop Loss with the configurable Martingale.',
        tags: ['Differs', 'Rank drop', 'Biggest mover', 'Frequency ranking', 'Confirmation'],
        xml: RANK_DROP_DIFFER_XML,
    },
];
