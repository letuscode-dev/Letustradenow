import { RISE_FALL_SWITCHER_XML } from './bots/rise-fall-switcher';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'rise-fall-switcher-v1',
        title: 'Rise/Fall Switcher',
        description:
            'Starts on RISE, switches side after a loss and stays on the winning side. Martingale 1.25 on loss, reset on win. Step Index 100, $2 stake, 2 ticks.',
        tags: ['Rise/Fall', 'Step Index', 'Side switch', 'Martingale 1.25'],
        xml: RISE_FALL_SWITCHER_XML,
    },
];
