/**
 * Orders the 1-second stream and fills observed epoch gaps before evaluating
 * later ticks. History is analysis-only because those contracts are stale.
 */
export const createMirrorStream = ({ runtime, history, journal }) => {
    let lastEpoch = null;
    let lastQuote = null;
    let recovering = false;
    let failed = false;
    let paused = false;
    let generation = 0;
    const queue = [];
    let waiters = [];
    let failureReason = '';

    const rejectWaiters = reason => {
        const pending = waiters;
        waiters = [];
        pending.forEach(({ reject }) => reject(new Error(reason)));
    };

    const resolveWaiters = () => {
        if (paused || recovering || failed || queue.length) return;
        const pending = waiters;
        waiters = [];
        pending.forEach(({ resolve }) => resolve());
    };

    const fail = reason => {
        if (failed) return;
        failed = true;
        failureReason = reason;
        rejectWaiters(reason);
        runtime.resetWindow();
        journal({ type: 'stream_error', reason });
        runtime.stop(reason);
    };

    const valid = tick => Number.isInteger(tick?.epoch) && Number.isInteger(tick?.digit) && tick.digit >= 0 && tick.digit <= 9;
    const process = (tick, live) => {
        lastEpoch = tick.epoch;
        lastQuote = tick.quote === undefined || tick.quote === null ? null : Number(tick.quote);
        runtime.tick(tick.digit, tick.epoch, live);
    };

    const drain = () => {
        if (recovering || failed || paused) return;
        while (queue.length) {
            const tick = queue.shift();
            if (!valid(tick)) return fail('Invalid tick; continuity cannot be verified');
            if (tick.snapshot && tick.epoch === lastEpoch && lastQuote !== null && Number(tick.quote) === lastQuote) {
                journal({ type: 'replayed_subscription_snapshot', epoch: tick.epoch });
                continue;
            }
            if (lastEpoch !== null && tick.epoch <= lastEpoch) return fail('Duplicate or out-of-order tick');
            if (lastEpoch !== null && tick.epoch > lastEpoch + 1) {
                const start = lastEpoch + 1;
                const end = tick.epoch - 1;
                const recoveryGeneration = generation;
                recovering = true;
                queue.unshift(tick);
                journal({ type: 'tick_gap', start, end });
                Promise.resolve().then(() => history(start, end)).then(ticks => {
                    if (recoveryGeneration !== generation || failed) return;
                    if (!Array.isArray(ticks) || ticks.length !== end - start + 1 ||
                        !ticks.every((item, index) => valid(item) && item.epoch === start + index)) {
                        throw new Error('Tick history did not fully restore the missing sequence');
                    }
                    ticks.forEach(item => process(item, false));
                    recovering = false;
                    drain();
                }).catch(error => {
                    if (recoveryGeneration === generation && !failed) fail(error?.message || 'Unable to recover tick history');
                });
                return;
            }
            // During gap recovery later ticks may already be buffered. Analyze
            // each in order, but only the latest can still be an immediate entry.
            const stale = tick.receivedAt != null && Date.now() - tick.receivedAt >= 1000;
            process(tick, !(runtime.staleBufferedAnalysisOnly && (queue.length || stale)));
        }
        resolveWaiters();
    };

    return {
        seed: (ticks, expected = 2) => {
            if (lastEpoch !== null || queue.length || recovering || failed || !Array.isArray(ticks) ||
                !Number.isInteger(expected) || expected < 1 || ticks.length !== expected ||
                !ticks.every((tick, index) => valid(tick) && (index === 0 || tick.epoch === ticks[index - 1].epoch + 1))) return false;
            ticks.forEach(tick => process(tick, false));
            return true;
        },
        ingest: tick => { if (!failed) { queue.push(tick); drain(); } },
        ingestBatch: ticks => { if (!failed) { queue.push(...ticks); drain(); } },
        disconnect: () => {
            generation += 1;
            paused = true;
            recovering = false;
            rejectWaiters('Connection interrupted while restoring tick history');
            journal({ type: 'stream_disconnected', lastEpoch });
        },
        resume: () => { if (!failed) { paused = false; drain(); } },
        whenReady: () => {
            if (failed) return Promise.reject(new Error(failureReason));
            if (!paused && !recovering && !queue.length) return Promise.resolve();
            return new Promise((resolve, reject) => { waiters.push({ resolve, reject }); });
        },
        cancelWaiters: () => rejectWaiters('Tick stream stopped'),
        fail,
        isRecovering: () => recovering,
    };
};
