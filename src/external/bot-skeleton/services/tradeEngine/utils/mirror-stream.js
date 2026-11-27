/**
 * Orders the 1-second stream and fills observed epoch gaps before evaluating
 * later ticks. History is analysis-only because those contracts are stale.
 */
export const createMirrorStream = ({ runtime, history, journal }) => {
    let lastEpoch = null;
    let recovering = false;
    let failed = false;
    const queue = [];

    const fail = reason => {
        if (failed) return;
        failed = true;
        runtime.resetWindow();
        journal({ type: 'stream_error', reason });
        runtime.stop(reason);
    };

    const valid = tick => Number.isInteger(tick?.epoch) && Number.isInteger(tick?.digit) && tick.digit >= 0 && tick.digit <= 9;
    const process = (tick, live) => {
        lastEpoch = tick.epoch;
        runtime.tick(tick.digit, tick.epoch, live);
    };

    const drain = () => {
        if (recovering || failed) return;
        while (queue.length) {
            const tick = queue.shift();
            if (!valid(tick)) return fail('Invalid tick; continuity cannot be verified');
            if (lastEpoch !== null && tick.epoch <= lastEpoch) return fail('Duplicate or out-of-order tick');
            if (lastEpoch !== null && tick.epoch > lastEpoch + 1) {
                const start = lastEpoch + 1;
                const end = tick.epoch - 1;
                recovering = true;
                queue.unshift(tick);
                journal({ type: 'tick_gap', start, end });
                Promise.resolve().then(() => history(start, end)).then(ticks => {
                    if (!Array.isArray(ticks) || ticks.length !== end - start + 1 ||
                        !ticks.every((item, index) => valid(item) && item.epoch === start + index)) {
                        throw new Error('Tick history did not fully restore the missing sequence');
                    }
                    ticks.forEach(item => process(item, false));
                    recovering = false;
                    drain();
                }).catch(error => fail(error?.message || 'Unable to recover tick history'));
                return;
            }
            process(tick, true);
        }
    };

    return {
        ingest: tick => { if (!failed) { queue.push(tick); drain(); } },
        disconnect: () => { journal({ type: 'stream_disconnected', lastEpoch }); },
        fail,
        isRecovering: () => recovering,
    };
};
