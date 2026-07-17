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
        id: 'increasing-gap-differs',
        title: localize('Increasing Gap Differs'),
        description: localize(
            'Tracks each digit 0–9 for arithmetic gap progressions (e.g. 2→3→4 predicts gap 5). Waits the predicted gap, then Differs that digit. Optional early cancellation, cooldown, and Martingale.'
        ),
        tags: [localize('Differs'), localize('Gap'), localize('Progression')],
        strategy: 'INCREASING_GAP_DIFFERS',
        form: {
            symbol: '1HZ75V',
            tradetype: 'matchesdiffers',
            type: 'DIGITDIFF',
            stake: '1',
            duration: '1',
            durationtype: 't',
            min_gap: '1',
            max_gap: '20',
            min_common_diff: '1',
            max_common_diff: '5',
            gaps_required: '3',
            cooldown_after_trade: '0',
            max_trades_per_session: '0',
            boolean_strategy: true,
            boolean_journal: true,
            boolean_cancel_early: true,
            boolean_one_trade_per_cycle: true,
            boolean_one_active_trade: true,
            boolean_martingale: true,
            profit: '5',
            loss: '5',
            size: '2',
        },
    },
];
