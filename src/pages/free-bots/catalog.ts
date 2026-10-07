import { RISE_FALL_TREND_XML } from './bots/rise-fall-trend';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'rise-fall-trend-v1',
        title: 'Rise/Fall Tick Trend',
        description:
            'N ticks up in a row → RISE, N ticks down → FALL, otherwise waits (Consecutive Ticks, default 3). Martingale 1.25 on loss, reset on win. Step Index 500, $2 stake, 2 ticks.',
        tags: ['Rise/Fall', 'Step Index', 'Tick trend', 'Martingale 1.25'],
        xml: RISE_FALL_TREND_XML,
    },
];
