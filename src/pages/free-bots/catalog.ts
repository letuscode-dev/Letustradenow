import { localize } from '@deriv-com/translations';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below, then push.
 * Users can Run it immediately or Load it into Bot Builder.
 *
 * Tip: keep stakes/demo-friendly defaults. Custom Blockly XML bots can be
 * added later as a separate kind once you share the ideas.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'range-momentum-over-one',
        title: localize('Range Momentum Over 1'),
        description: localize(
            'Places Over 1 when digits move Lower(2–5)→Higher(6–9) with no Losing(0–1) digits in the lookback window. Optional cooldown, Martingale, and consecutive-loss stop. Run once calls Range Momentum Numbers then Range Momentum Booleans.'
        ),
        tags: [localize('Over 1'), localize('Momentum'), localize('Range')],
        strategy: 'RANGE_MOMENTUM_OVER_ONE',
        form: {
            symbol: '1HZ75V',
            tradetype: 'overunder',
            type: 'DIGITOVER',
            stake: '1',
            duration: '1',
            durationtype: 't',
            cooldown_after_trade: '0',
            losing_lookback: '2',
            boolean_strategy: true,
            boolean_journal: true,
            boolean_notify: true,
            boolean_martingale: true,
            profit: '5',
            loss: '5',
            size: '2',
        },
    },
    {
        id: 'percentage-filter',
        title: localize('Percentage Filter'),
        description: localize(
            'Places Over 2 only when digits 3–9 are at least your threshold percent of the last 100 ticks (default 75%). Loads tick history from Deriv immediately, then updates on each new tick. Journal shows pass/fail reasons. Optional Martingale and consecutive-loss stop. Run once calls Percentage Filter Numbers then Percentage Filter Booleans.'
        ),
        tags: [localize('Martingale'), localize('Over 2'), localize('Percentage')],
        strategy: 'PERCENTAGE_FILTER',
        form: {
            symbol: '1HZ75V',
            tradetype: 'overunder',
            type: 'DIGITOVER',
            stake: '1',
            duration: '1',
            durationtype: 't',
            last_digit_prediction: '2',
            percentage_threshold: '75',
            profit: '5',
            loss: '5',
            size: '2',
            boolean_martingale: true,
            boolean_percentage_filter: true,
            boolean_percentage_journal: true,
        },
    },
];
