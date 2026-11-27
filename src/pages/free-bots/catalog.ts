import { SIMULTANEOUS_OVER_UNDER_XML } from './bots/simultaneous-over-under';
import { OVER_UNDER_LOSS_SWITCH_XML } from './bots/over-under-loss-switch';
import { THREE_DIGIT_MIRROR_XML } from './bots/three-digit-mirror';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'three-digit-mirror-v1',
        title: 'Three-Digit Mirror Differs',
        description: 'Trades Digit Differs on the middle digit when three consecutive digits form A-B-A. Uses payout-based loss recovery and configurable limits.',
        tags: ['Digit Differs', 'Mirror', 'Recovery', 'Take Profit'],
        xml: THREE_DIGIT_MIRROR_XML,
    },
    {
        id: 'simultaneous-over-under-v1',
        title: 'Simultaneous Over/Under',
        description:
            'Buys Over and Under concurrently with separate stakes and configurable predictions. Pauses after a batch of quote attempts; a double loss applies Martingale to both stakes.',
        tags: ['Over/Under', 'Simultaneous', 'Batch Pause', 'Martingale'],
        xml: SIMULTANEOUS_OVER_UNDER_XML,
    },
    {
        id: 'over-under-loss-switch-v1',
        title: 'Over to Under on Loss',
        description:
            'Starts with Over; after a loss, trades Under and multiplies the stake. A win resets the stake and returns to Over.',
        tags: ['Over/Under', 'Loss Switch', 'Martingale', 'Take Profit'],
        xml: OVER_UNDER_LOSS_SWITCH_XML,
    },
];
