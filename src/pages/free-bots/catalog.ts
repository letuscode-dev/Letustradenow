import type { FreeBot } from './types';
import { DIGIT_PAIR_RETURN_DIFFERS_XML } from './bots/digit-pair-return-differs';
import { DIGIT_PERCENTAGE_DECREASE_XML } from './bots/digit-percentage-decrease';
import { DOUBLE_DIGIT_RETURN_DIFFERS_XML } from './bots/double-digit-return-differs';
import { PATTERN_SWITCH_XML } from './bots/pattern-switch';
import { TRIPLE_DIGIT_MARTINGALE_XML } from './bots/triple-digit-martingale';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'triple-digit-martingale-v1',
        title: 'Triple-Digit Martingale Differs',
        description:
            'Trades Digit Differs when three matching last digits appear. Multi-market ready — set stake, size, TP/SL, symbols, and optional Martingale Off When Profit > Stake in Bot Builder.',
        tags: ['Differs', 'Martingale', 'Multi-market'],
        xml: TRIPLE_DIGIT_MARTINGALE_XML,
    },
    {
        id: 'double-digit-return-differs-v1',
        title: 'Double Digit → Return Differs',
        description:
            'Learns X → X → Y per digit, then Differs Y on the next double. Risk controls include optional Martingale Off When Profit > Stake (default off) in Bot Builder.',
        tags: ['Differs', 'Double digit', 'Return'],
        xml: DOUBLE_DIGIT_RETURN_DIFFERS_XML,
    },
    {
        id: 'digit-pair-return-differs-v1',
        title: 'Digit Pair → Return Differs',
        description:
            'Learns A → B → C → D → E → F for every digit pattern (0–9), then Differs F when A → B → C → D → E reappear as the previous five digits before a new tip. Same risk controls as Double Digit → Return Differs, including optional Martingale Off When Profit > Stake.',
        tags: ['Differs', 'Digit pair', 'Return'],
        xml: DIGIT_PAIR_RETURN_DIFFERS_XML,
    },
    {
        id: 'pattern-switch-v1',
        title: 'Pattern Switch',
        description:
            'Switches between Even, Odd, Over 4, and Under 5 from last-digit patterns, with martingale, stop rules, and optional Martingale Off When Profit > Stake in Bot Builder.',
        tags: ['Even/Odd', 'Over/Under', 'Pattern'],
        xml: PATTERN_SWITCH_XML,
    },
    {
        id: 'digit-percentage-decrease-v1',
        title: 'Digit Percentage Decrease – Differ',
        description:
            'Scans Selected Symbols on every new tick, recomputes digit percentages over a rolling 1000-tick window, and trades Digit Differs on the strongest drop of at least 0.1pp, switching market when needed. Default martingale 10.5; symbols, window, and drop threshold are editable in Bot Builder.',
        tags: ['Differs', 'Percentage', 'Decrease', 'Multi-market', 'Martingale'],
        xml: DIGIT_PERCENTAGE_DECREASE_XML,
    },
];
