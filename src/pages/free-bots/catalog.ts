import type { FreeBot } from './types';
import { localize } from '@deriv-com/translations';

/**
 * Free Bots catalog.
 *
 * The Free Bots tab remains available. Add a new bot by appending an entry below.
 * Users can Run it immediately or Load it into Bot Builder.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'consecutive-digits-over',
        title: localize('Consecutive Digits Over 2'),
        description: localize(
            'When the last 3 digits are all >= 3, places Over 2. After a loss, the same signal places Over 3 with a 63% payout recovery stake to recover the full loss, then returns to the base stake.'
        ),
        tags: [localize('Over 2'), localize('Over 3'), localize('Recovery')],
        strategy: 'CONSECUTIVE_DIGITS_OVER',
        form: {
            symbol: '1HZ75V',
            tradetype: 'overunder',
            type: 'DIGITOVER',
            stake: '1',
            duration: '1',
            durationtype: 't',
            payout_percent: '63',
            recovery_splits: '1',
            boolean_strategy: true,
            boolean_journal: true,
            profit: '5',
            loss: '5',
        },
    },
];
