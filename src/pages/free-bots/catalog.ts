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
        title: 'Double Decimal Digit Differ + 10.5 Recovery',
        description:
            'On every new tick, compares the LAST TWO digits after the decimal point of the price. Only when they are the same (4681.33, 905.77, 12.00) does it place a DIFFERS trade with that digit as the automatic barrier (DIFFER 3, 7, 0) — never entered manually; 4681.35 means WAITING. After a loss the next stake is previous stake × Recovery Multiplier (default 10.5: $2 → $21 → $220.50); a win resets to the base stake with "RECOVERY SUCCESS — RESETTING STAKE TO BASE STAKE". Maximum Recovery Level (default 2) and Maximum Recovery Stake (default $250) stop the escalation: "RECOVERY LIMIT REACHED — TRADING PAUSED". Also: recovery on/off, maximum consecutive losses, stop loss (never exceeded by the next stake), take profit, maximum trades, cooldown, confirmation ticks and auto trading ON/OFF. The Journal shows every tick (price, last two decimals, barrier, recovery level, current stake), the reason for every WAITING decision, each trade with contract ID, results with recovery steps, balance and a status panel. Failed purchases keep the recovery stake and retry; three in a row pause trading. Default Volatility 75 (1s) Index, $2 base stake, 1 tick duration.',
        tags: ['Differs', 'Repeated last two decimals', 'Automatic barrier', '10.5× recovery', 'Live journal'],
        xml: FIRST_DECIMAL_DIGIT_DIFFER_XML,
    },
];
