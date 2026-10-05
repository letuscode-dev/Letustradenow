import { FIRST_DECIMAL_DIGIT_DIFFER_XML } from './bots/first-decimal-digit-differ';
import type { FreeBot } from './types';

/**
 * Free Bots catalog.
 *
 * Add a new bot by appending an entry below.
 * Users can Load it into Bot Builder to inspect, configure, and run it.
 */
export const FREE_BOTS: FreeBot[] = [
    {
        id: 'first-decimal-digit-differ-v1',
        title: 'First Decimal Digit Differ + 10.5 Recovery',
        description:
            'On every new tick, takes the FIRST digit AFTER the decimal point of the price (4681.35 → 3, 8.42 → 4, 1234.567 → 5) and uses it as the automatic DIFFERS barrier — never entered manually. After a loss the next stake is previous stake × Recovery Multiplier (default 10.5: $2 → $21 → $220.50); a win resets to the base stake with "RECOVERY SUCCESS — RESETTING STAKE TO BASE STAKE". Maximum Recovery Level (default 2) and Maximum Recovery Stake (default $250) stop the escalation: "RECOVERY LIMIT REACHED — TRADING PAUSED". Also: recovery on/off, maximum consecutive losses, stop loss (never exceeded by the next stake), take profit, maximum trades, cooldown, confirmation ticks and auto trading ON/OFF. The Journal shows every tick (price, first decimal digit, barrier, recovery level, current stake), the reason for every WAITING decision, each trade with contract ID, results with recovery steps, balance and a status panel. Failed purchases keep the recovery stake and retry; three in a row pause trading. Default Volatility 75 (1s) Index, $2 base stake, 2 ticks.',
        tags: ['Differs', 'First decimal digit', 'Automatic barrier', '10.5× recovery', 'Live journal'],
        xml: FIRST_DECIMAL_DIGIT_DIFFER_XML,
    },
];
