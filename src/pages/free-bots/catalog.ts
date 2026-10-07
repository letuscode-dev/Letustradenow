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
        title: 'Rise/Fall Two-Tick Trend',
        description:
            'Two ticks up in a row → RISE, two ticks down in a row → FALL, otherwise waits. Martingale 1.25 on loss, reset on win. Step Index 500, $2 stake, 2 ticks.',
        tags: ['Rise/Fall', 'Step Index', 'Two-tick trend', 'Martingale 1.25'],
        xml: RISE_FALL_TREND_XML,
    },
];
