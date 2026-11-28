import { SIMULTANEOUS_OVER_UNDER_XML } from './bots/simultaneous-over-under';
import { OVER_UNDER_LOSS_SWITCH_XML } from './bots/over-under-loss-switch';
import { THREE_DIGIT_MIRROR_XML } from './bots/three-digit-mirror';
import { FIXED_DIGIT_DIFFERS_XML } from './bots/fixed-digit-differs';
import { TRIPLE_HIT_CONCENTRATION_XML } from './bots/triple-hit-concentration';
import { DIGIT_PERCENTAGE_INCREASE_XML } from './bots/digit-percentage-increase';
import { ALTERNATING_OVER_UNDER_XML } from './bots/alternating-over-under';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'alternating-over-under-v1',
        title: 'Alternating Over/Under',
        description: 'Starts with Over and alternates with Under after each settled trade. Configure both predictions, optional Martingale, take profit and stop loss.',
        tags: ['Over/Under', 'Alternating', 'Martingale', 'Take Profit', 'Stop Loss'],
        xml: ALTERNATING_OVER_UNDER_XML,
    },
    {
        id: 'digit-percentage-increase-v1',
        title: 'Digit Percentage Increase Differs',
        description: 'Trades one-tick Digit Differs when a digit’s share rises by the configured percentage points between consecutive 1,000-tick windows. Includes recovery, profit and loss limits.',
        tags: ['Digit Differs', '1,000 Ticks', 'Recovery', 'Take Profit', 'Stop Loss'],
        xml: DIGIT_PERCENTAGE_INCREASE_XML,
    },
    {
        id: 'triple-hit-concentration-v1',
        title: 'Triple-Hit Concentration',
        description: 'Trades one-tick Digit Differs when the latest digit is the unique most frequent digit in the last 10 ticks and occurs at least three times. Skips signals while a contract is unsettled.',
        tags: ['Digit Differs', '10-Tick Frequency', 'Recovery', 'Take Profit'],
        xml: TRIPLE_HIT_CONCENTRATION_XML,
    },
    {
        id: 'fixed-digit-differs-v1',
        title: 'Digit Differs — Fixed Prediction',
        description: 'Trades one-tick Digit Differs on Volatility 75 (1s) with your prediction, 9.6% loss recovery, take profit, and stop loss. Signals wait for the previous contract to settle.',
        tags: ['Digit Differs', 'Fixed Prediction', 'Recovery', 'Take Profit', 'Stop Loss'],
        xml: FIXED_DIGIT_DIFFERS_XML,
    },
    {
        id: 'three-digit-mirror-v1',
        title: 'Least Digit Decrease Differs',
        description: 'Scans all available Volatility markets and trades Differs when a least-frequent digit decreases in a rolling 1,000-tick window.',
        tags: ['Digit Differs', 'Multi-Market', '1,000 Ticks', 'Recovery', 'Take Profit'],
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
