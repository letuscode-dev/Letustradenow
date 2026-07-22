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
        title: localize('Digit Successor Differs'),
        description: localize(
            'Within your tick window, maps what followed each digit 0–9. When the current digit is X and X→Y was seen, places Digit Differs on Y. Uses payout-based recovery (default 9.6%).'
        ),
        tags: [localize('Differs'), localize('Successor'), localize('Recovery')],
        strategy: 'CONSECUTIVE_DIGITS_OVER',
        form: {
            symbol: '1HZ75V',
            tradetype: 'matchesdiffers',
            type: 'DIGITDIFF',
            stake: '1',
            duration: '1',
            durationtype: 't',
            tick_window: '120',
            pattern_threshold: '1',
            payout_percent: '9.6',
            recovery_splits: '1',
            boolean_strategy: true,
            boolean_journal: true,
            profit: '5',
            loss: '5',
        },
    },
];
