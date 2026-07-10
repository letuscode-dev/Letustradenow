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
    // Placeholder starters so the tab is usable until you add your own ideas.
    {
        id: 'martingale-rise-fall',
        title: localize('Martingale Rise/Fall'),
        description: localize('Classic Martingale on Rise/Fall for Volatility 100 (1s). Load it, tweak, or run as-is.'),
        tags: [localize('Martingale'), localize('Rise/Fall')],
        strategy: 'MARTINGALE',
        form: {
            symbol: '1HZ100V',
            tradetype: 'callput',
            type: 'CALL',
            stake: '1',
            duration: '5',
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
        id: 'martingale-differs',
        title: localize('Martingale Differs'),
        description: localize('Martingale on Digits Differs with a default prediction of 5.'),
        tags: [localize('Martingale'), localize('Differs')],
        strategy: 'MARTINGALE',
        form: {
            symbol: '1HZ100V',
            tradetype: 'matchesdiffers',
            type: 'DIGITDIFF',
            stake: '1',
            duration: '1',
            durationtype: 't',
            profit: '5',
            loss: '10',
            size: '2',
            unit: '1',
            max_stake: '25',
            boolean_max_stake: true,
            last_digit_prediction: '5',
        },
    },
];
