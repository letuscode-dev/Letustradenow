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
        id: 'complement-digit-differs',
        title: localize('Complement Digit Differs'),
        description: localize(
            'When previous and current last digits are complements (0↔9, 1↔8, 2↔7, 3↔6, 4↔5), places Differs on the previous digit. Optional Martingale. Stops after consecutive losses. Run once calls Complement Digit Numbers then Complement Digit Booleans.'
        ),
        tags: [localize('Martingale'), localize('Differs'), localize('Complement')],
        strategy: 'COMPLEMENT_DIGIT_DIFFERS',
        form: {
            symbol: '1HZ100V',
            tradetype: 'matchesdiffers',
            type: 'DIGITDIFF',
            stake: '1',
            duration: '1',
            durationtype: 't',
            boolean_strategy: true,
            boolean_journal: true,
            boolean_martingale: true,
            profit: '5',
            loss: '5',
            size: '2',
        },
    },
    {
        id: 'martingale-even-odd',
        title: localize('Martingale Even/Odd'),
        description: localize('Martingale recovery on Even/Odd digits. Good starter for digit markets.'),
        tags: [localize('Martingale'), localize('Even/Odd')],
        strategy: 'MARTINGALE',
        form: {
            symbol: '1HZ100V',
            tradetype: 'evenodd',
            type: 'DIGITEVEN',
            stake: '1',
            duration: '1',
            durationtype: 't',
            profit: '5',
            loss: '10',
            size: '2',
            unit: '1',
            max_stake: '25',
            boolean_max_stake: true,
        },
    },
    {
        id: 'adaptive-digit-gap-differs',
        title: localize('Adaptive Digit Gap Differs'),
        description: localize(
            'Tracks an adaptive gap for every digit 0–9. Each digit’s latest completed gap becomes its next Differs trigger. Places Differs when current gap reaches that trigger (one trade per cycle by default). Stops after consecutive losses (not a money amount). Run once calls Adaptive Digit Gap Numbers then Adaptive Digit Gap Booleans.'
        ),
        tags: [localize('Martingale'), localize('Differs'), localize('Adaptive Gap')],
        strategy: 'ADAPTIVE_DIGIT_GAP_DIFFERS',
        form: {
            symbol: '1HZ100V',
            tradetype: 'matchesdiffers',
            type: 'DIGITDIFF',
            stake: '1',
            duration: '1',
            durationtype: 't',
            min_adaptive_gap: '10',
            max_adaptive_gap: '20',
            selection_mode: '0',
            cooldown_after_trade: '0',
            max_trades_per_session: '0',
            boolean_strategy: true,
            boolean_one_trade_per_cycle: true,
            boolean_one_active_trade: true,
            boolean_journal: true,
            boolean_dashboard: false,
            profit: '5',
            loss: '5',
            size: '2',
        },
    },
    {
        id: 'over-zero-gap-filter',
        title: localize('Over 0 Gap Filter'),
        description: localize(
            'Places Over 0 only when the gap since the last digit 0 is within your min/max range. Run once calls Over 0 Gap Numbers (stake, prediction, profit, consecutive-loss stop, gaps) then Over 0 Gap Booleans (Martingale, filter, journal). Optional Martingale and Journal PASS/FAIL logging.'
        ),
        tags: [localize('Martingale'), localize('Over'), localize('Gap Filter')],
        strategy: 'OVER_ZERO_GAP_FILTER',
        form: {
            symbol: '1HZ100V',
            tradetype: 'overunder',
            type: 'DIGITOVER',
            stake: '1',
            duration: '1',
            durationtype: 't',
            last_digit_prediction: '0',
            min_gap: '3',
            max_gap: '10',
            profit: '5',
            loss: '5',
            size: '2',
            boolean_martingale: true,
            boolean_gap_filter: true,
            boolean_gap_journal: true,
        },
    },
];
