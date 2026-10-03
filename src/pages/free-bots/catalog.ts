import { HIGH_LOW_TIE_DIFFER_XML } from './bots/high-low-tie-differ';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'high-low-tie-differ-v1',
        title: 'High-Low Tie Differs',
        description:
            'Calculates digit 0–9 occurrence % over the Analysis Window (default 200, min 100), finds HIGH ties (digits sharing the highest %) and LOW ties (digits sharing the lowest %), targets the tied digit appearing most in the last Recent Ticks (default 50; then count → repetition → recency) and Differs it after confirming on the next tick. Mode HIGH / LOW / AUTO, configurable tie tolerance and cooldown. Never picks randomly. Journal shows every count and percentage, the tie-break reason and WHY NO TRADE. Take Profit / Stop Loss with the configurable Martingale.',
        tags: ['Differs', 'High tie', 'Low tie', 'Tie-breakers', 'Percentages', 'Cooldown'],
        xml: HIGH_LOW_TIE_DIFFER_XML,
    },
];
