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
            'When the last 6 digits are all less than 7, places Over 2. After a loss, immediately enters Over 3 without analysis. If that also loses, starts analysis again (waits for the 6-digit signal). Toggle Enable strategy to turn the feature on or off.'
        ),
        tags: [localize('Over 2'), localize('Over 3'), localize('Analysis'), localize('Recovery')],
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
