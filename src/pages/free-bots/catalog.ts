import { RANK_DROP_DIFFER_XML } from './bots/rank-drop-differ';
import { RISE_FALL_HEDGE_XML } from './bots/rise-fall-hedge';
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
    {
        id: 'rise-fall-hedge-v1',
        title: 'Rise/Fall Hedge (Step Indices)',
        description:
            'Buys a Rise and a Fall contract at the same time on Step Index 100 (change the symbol for any Step Index) with the same stake (default $2 each) and duration (default 2 ticks), treated as one hedge. Mode MANUAL fires one hedge per Run; AUTO fires every N ticks with cooldown and daily hedge limit. Journal shows each leg, the combined stake/payout/P/L and % return from the actual Deriv payouts, execution gap with an ASYMMETRIC EXECUTION flag, incomplete-hedge handling (CANCEL or RUN) and full statistics. Risk limits stop the bot automatically; Stop is the emergency stop. Flat stake — no martingale. Intelligent Entry Engine decides WHEN to fire (never which side): entry score 0–13 from momentum, acceleration, pattern repetition, tick strength, reversal/exhaustion and multi-window confirmation (modes A–F, default Multi-Confirmation, minimum 8), live payout filter, hedge economics before execution, an entry log for every fired and NO TRADE decision, and performance per entry strategy.',
        tags: ['Rise/Fall', 'Hedge', 'Step Index', 'Entry Engine', 'Manual & Auto', 'Risk controls'],
        xml: RISE_FALL_HEDGE_XML,
    },
];
