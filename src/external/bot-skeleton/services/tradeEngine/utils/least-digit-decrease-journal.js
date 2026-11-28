import { formatTradeEventJournal } from './trade-event-journal';

export const formatLeastDigitDecreaseJournal = (event, currency) => {
    const label = 'Least Digit Decrease Differs';
    if (event.type === 'signal') {
        const state = event.status === 'submitted' ? 'BUY REQUEST SENT — awaiting confirmation' : `SIGNAL SKIPPED — ${event.reason}`;
        return { message: `${label} | ${state} | Market: ${event.symbol} | Digit: ${event.barrier} | Previous: ${event.previousPercentage.toFixed(1)}% | Current: ${event.currentPercentage.toFixed(1)}% | Decrease: ${event.decrease.toFixed(1)} percentage points | Window: ${event.windowSize} ticks${event.status === 'submitted' ? ` | Stake: ${event.stake} ${currency}` : ''}`, className: 'journal__text' };
    }
    if (event.type === 'initial_history_ready') {
        return { message: `${label} | ${event.symbol} | Loaded ${event.count} historical ticks.`, className: 'journal__text' };
    }
    const result = formatTradeEventJournal(event, currency, label);
    const symbol = event.symbol || event.signal?.symbol;
    return { ...result, message: `${result.message}${symbol ? ` | Market: ${symbol}` : ''}` };
};
