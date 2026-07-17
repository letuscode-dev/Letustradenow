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
        id: 'cold-digit-differs',
        title: localize('Cold Digit Differs'),
        description: localize(
            'Analysis-style Differs: requests your configured tick sample from Deriv, then continuously updates the cold (least frequent) digit on that exact window as ticks arrive. Confidence stays 62–72%. Configurable runs per signal, stake, Martingale, take-profit, and consecutive-loss stop.'
        ),
        tags: [localize('Martingale'), localize('Differs'), localize('Analysis')],
        strategy: 'COLD_DIGIT_DIFFERS',
        form: {
            symbol: '1HZ75V',
            tradetype: 'matchesdiffers',
            type: 'DIGITDIFF',
            stake: '1',
            duration: '1',
            durationtype: 't',
            tick_sample_size: '100',
            runs_per_signal: '1',
            boolean_strategy: true,
            boolean_journal: true,
            boolean_martingale: true,
            profit: '5',
            loss: '5',
            size: '2',
        },
    },
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
        id: 'adaptive-digit-gap-differs',
        title: localize('Adaptive Digit Gap Differs'),
        description: localize(
            'Tracks gaps between appearances of every digit 0–9. When the same gap repeats twice consecutively within min–max (e.g. 7→5→7→5→7), waits that gap again and places Differs on the expected cycle tick. Cancels if the digit appears early. Recovery stake sizing from payout % and splits. Stops after consecutive losses.'
        ),
        tags: [localize('Recovery'), localize('Differs'), localize('Adaptive Gap')],
        strategy: 'ADAPTIVE_DIGIT_GAP_DIFFERS',
        form: {
            symbol: '1HZ75V',
            tradetype: 'matchesdiffers',
            type: 'DIGITDIFF',
            stake: '1',
            duration: '1',
            durationtype: 't',
            min_adaptive_gap: '10',
            max_adaptive_gap: '15',
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
            payout_percent: '11',
            recovery_splits: '1',
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
            symbol: '1HZ75V',
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
