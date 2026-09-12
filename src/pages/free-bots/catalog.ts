import type { FreeBot } from './types';
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
            'When the last 3 digits match, places Digit Differs on the digit before that run across multiple volatilities. Load into Bot Builder to set stake, martingale size, take profit, stop loss, and markets.',
        tags: ['Differs', 'Martingale', 'Triple digit', 'Multi-market'],
        xml: TRIPLE_DIGIT_MARTINGALE_XML,
    },
    {
        id: 'double-digit-return-differs-v1',
        title: 'Double Digit → Return Differs Strategy',
        description:
            'Tracks all ten digits independently. Stores Y after X → X → Y, then places Digit Differs Y on the next X → X. Includes risk controls and live state journal — configure everything in Bot Builder.',
        tags: ['Differs', 'Double digit', 'Return pattern'],
        xml: DOUBLE_DIGIT_RETURN_DIFFERS_XML,
    },
    {
        id: 'pattern-switch-v1',
        title: 'Pattern Switch',
        description:
            'Last 4 all odd → Even; last 4 all even → Odd; last 3 all ≤ 3 → Over 4; last 3 all ≥ 6 → Under 5. Martingale on loss with take profit / stop loss — tune in Bot Builder.',
        tags: ['Even', 'Odd', 'Over 4', 'Under 5', 'Pattern'],
        xml: PATTERN_SWITCH_XML,
    },
];
