import { FREQUENCY_GAP_DIFFER_XML } from './bots/frequency-gap-differ';
import { HIGH_LOW_TIE_DIFFER_XML } from './bots/high-low-tie-differ';
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
        id: 'high-low-tie-differ-v1',
        title: 'High-Low Tie Differs',
        description:
            'Calculates digit 0–9 occurrence % over the Analysis Window (default 200, min 100), finds HIGH ties (digits sharing the highest %) and LOW ties (digits sharing the lowest %), targets the tied digit appearing most in the last Recent Ticks (default 50; then count → repetition → recency) and Differs it after confirming on the next tick. Mode HIGH / LOW / AUTO, configurable tie tolerance and cooldown. Never picks randomly. Journal shows every count and percentage, the tie-break reason and WHY NO TRADE. Take Profit / Stop Loss with the configurable Martingale.',
        tags: ['Differs', 'High tie', 'Low tie', 'Tie-breakers', 'Percentages', 'Cooldown'],
        xml: HIGH_LOW_TIE_DIFFER_XML,
    },
    {
        id: 'frequency-gap-differ-v1',
        title: 'Frequency Gap Differs',
        description:
            'Calculates digit 0–9 frequency % over a single Analysis Window (default 1000, min 50), finds the unique dominant (highest %) and unique weakest (lowest %) digit and Differs the dominant digit when dominant % − weakest % is at least the Minimum Frequency Gap (default 4%, inclusive). Tied dominant, tied weakest or all-equal digits mean no trade — never picks randomly. Optional new-tick confirmation and on/off switch. Journal shows dominant and weakest count and %, the gap, the condition and WHY NO TRADE. Take Profit / Stop Loss with the configurable Martingale.',
        tags: ['Differs', 'Frequency gap', 'Dominant digit', 'Percentages', 'Confirmation'],
        xml: FREQUENCY_GAP_DIFFER_XML,
    },
    {
        id: 'rank-drop-differ-v1',
        title: 'Rank Drop Differs',
        description:
            'Ranks digits 0–9 from highest to lowest frequency over the Analysis Window (default 1000) as it was Lookback Ticks ago (default 100) and as it is now, finds the digit whose rank deteriorated the most (e.g. #1 → #4) and Differs it when the drop is at least the Minimum Rank Drop (default 3). Several digits sharing the biggest drop means no trade — never picks randomly. Optional new-tick confirmation and on/off switch. Journal shows both rankings, the biggest mover and WHY NO TRADE. Take Profit / Stop Loss with the configurable Martingale.',
        tags: ['Differs', 'Rank drop', 'Biggest mover', 'Frequency ranking', 'Confirmation'],
        xml: RANK_DROP_DIFFER_XML,
    },
];
