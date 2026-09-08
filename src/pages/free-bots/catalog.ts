import type { FreeBot } from './types';
import { LEAST_FREQUENT_DIFFERS_XML } from './bots/least-frequent-differs';
import { MASTER_AUTO_VOLT_PRO_XML } from './bots/master-auto-volt-pro';
import { MOST_FREQUENT_DIFFERS_XML } from './bots/most-frequent-differs';
import { PATTERN_SWITCH_XML } from './bots/pattern-switch';
import { DOUBLE_DIGIT_RETURN_DIFFERS_XML } from './bots/double-digit-return-differs';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect or run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'double-digit-return-differs-v1',
        title: 'Double Digit → Return Differs Strategy',
        description:
            'Tracks all ten digits independently. Stores Y after X → X → Y, then places Digit Differs Y on the next X → X. Includes a 120-tick minimum analysis window, stake, duration, trade limit, cooldown, simultaneous-trade limit, auto-trading switch, and live state journal.',
        tags: ['Differs', 'Double digit', 'Return pattern', '10-state tracking', 'Configurable window'],
        xml: DOUBLE_DIGIT_RETURN_DIFFERS_XML,
    },
    {
        id: 'pattern-switch-v1',
        title: 'Pattern Switch',
        description:
            'Scans last digits every second until a pattern hits: last 4 all odd → Purchase Even; last 4 all even → Purchase Odd; last 3 all ≤ 3 → Over 4; last 3 all ≥ 6 → Under 5. Martingale on loss (default ×2). After Re Analyse After wins (default 3), clears the signal and re-scans. Stops at Take Profit / Stop Loss.',
        tags: ['Even', 'Odd', 'Over 4', 'Under 5', 'Pattern', 'Martingale', 'Single-market'],
        xml: PATTERN_SWITCH_XML,
    },
    {
        id: 'master-auto-volt-pro-v1',
        title: 'Master Auto Volt Pro',
        description:
            'Digit Over on Volatility 75 (1s): analyses the last 15 digits’ frequency, picks a cold-digit Over barrier, then trades. Supports stake, target profit, stop loss, max consecutive losses, max runs, and martingale-style recovery after losses.',
        tags: ['Digit Over', 'Cold digit', 'Martingale', 'Volatility 75', '1s'],
        xml: MASTER_AUTO_VOLT_PRO_XML,
    },
    {
        id: 'least-frequent-differs-v1',
        title: 'Least Frequent Differs',
        description:
            'Differs on Volatility 10: analyses the last Digits Analyse ticks (default 25), Differs the least frequent digit, then martingales on loss. Stops at Target Profit / Max Loss.',
        tags: ['Differs', 'Least frequent', 'Cold digit', 'Martingale', 'Volatility 10'],
        xml: LEAST_FREQUENT_DIFFERS_XML,
    },
    {
        id: 'most-frequent-differs-v1',
        title: 'Most Frequent Differs',
        description:
            'Differs on Volatility 10: analyses the last Digits Analyse ticks (default 25), Differs the most frequent digit, then martingales on loss. Stops at Target Profit / Max Loss.',
        tags: ['Differs', 'Most frequent', 'Hot digit', 'Martingale', 'Volatility 10'],
        xml: MOST_FREQUENT_DIFFERS_XML,
    },
];
