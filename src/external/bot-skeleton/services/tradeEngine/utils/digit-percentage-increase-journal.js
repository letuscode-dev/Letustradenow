import { formatTripleHitJournal } from './triple-hit-journal';

export const formatDigitPercentageIncreaseJournal = (event, currency) => {
    const label = 'Digit Percentage Increase';
    if (event.type === 'signal') {
        const state = event.status === 'submitted' ? 'BUY REQUEST SENT — awaiting Deriv confirmation'
            : event.entryPassed ? `SIGNAL SKIPPED — ${event.reason}` : `NO TRADE — ${event.reason}`;
        const date = event.timestamp == null ? null : new Date(Number(event.timestamp) * 1000);
        const timestamp = date && Number.isFinite(date.getTime()) ? date.toISOString() : 'unavailable';
        const stats = event.statistics;
        const totals = stats ? ` | Trades: ${stats.executedTrades}; wins: ${stats.wins}; losses: ${stats.losses}; skipped: ${stats.skippedSignals}` : '';
        return { message: `${label} | ${state} | Volatility 75 (1s), 1HZ75V | Tick: ${timestamp} | Digit: ${event.barrier} | Previous: ${event.previousPercentage.toFixed(1)}% | Current: ${event.currentPercentage.toFixed(1)}% | Increase: ${event.increase.toFixed(1)} percentage points | Threshold: ${event.threshold} percentage points | Window: ${event.windowSize} ticks${event.status === 'submitted' ? ` | Stake: ${event.stake} ${currency}` : ''}${totals}`,
            className: 'journal__text' };
    }
    if (event.type === 'initial_history_ready') {
        return { message: `${label} | Loaded ${event.count} historical ticks; monitoring live changes.`, className: 'journal__text' };
    }
    const result = formatTripleHitJournal(event, currency);
    return { ...result, message: result.message.replace(/^Triple-Hit Concentration/, label) };
};
