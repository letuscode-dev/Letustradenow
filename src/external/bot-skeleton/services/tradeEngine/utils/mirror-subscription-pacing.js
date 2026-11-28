const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Pace large market subscriptions; retry only explicitly rate-limited subscriptions. */
export const attachMirrorStreams = async ({ streams, symbols, isCurrent, journal, wait = delay }) => {
    for (let index = 0; index < streams.length; index += 1) {
        if (index) await wait(250);
        if (!isCurrent()) return;
        let retries = 0;
        for (;;) {
            if (!isCurrent()) return;
            try {
                await streams[index].attach();
                break;
            } catch (error) {
                const code = error?.error?.code ?? error?.code;
                if (!/ratelimit|too.?many.?requests/i.test(String(code || '')) || retries >= 3) throw error;
                const milliseconds = 2000 * 2 ** retries++;
                journal({ type: 'market_subscription_rate_limit', symbol: symbols[index], retryInSeconds: milliseconds / 1000 });
                await wait(milliseconds);
            }
        }
    }
};
