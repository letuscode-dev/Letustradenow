import { SIMULTANEOUS_OVER_UNDER_XML } from './bots/simultaneous-over-under';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'simultaneous-over-under-v1',
        title: 'Simultaneous Over/Under',
        description:
            'Buys Over and Under concurrently with separate stakes and configurable predictions. Pauses after a batch of quote attempts; a double loss applies Martingale to both stakes.',
        tags: ['Over/Under', 'Simultaneous', 'Batch Pause', 'Martingale'],
        xml: SIMULTANEOUS_OVER_UNDER_XML,
    },
];
