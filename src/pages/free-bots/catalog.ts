import { LEAST_DIGIT_DECREASE_XML } from './bots/least-digit-decrease';
import { ALTERNATING_OVER_UNDER_XML } from './bots/alternating-over-under';
import type { FreeBot } from './types';

/** Bots available to load into Bot Builder. */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'least-digit-decrease-v1',
        title: 'Least Digit Decrease Differs',
        description: 'Scans all available Volatility markets and trades Differs when a least-frequent digit decreases in a rolling 1,000-tick window.',
        tags: ['Digit Differs', 'Multi-Market', '1,000 Ticks', 'Recovery', 'Take Profit'],
        xml: LEAST_DIGIT_DECREASE_XML,
    },
    {
        id: 'alternating-over-under-v1',
        title: 'Alternating Over/Under',
        description: 'Starts with Over and alternates with Under after each settled trade. Configure both predictions, optional Martingale, take profit and stop loss.',
        tags: ['Over/Under', 'Alternating', 'Martingale', 'Take Profit', 'Stop Loss'],
        xml: ALTERNATING_OVER_UNDER_XML,
    },
];
