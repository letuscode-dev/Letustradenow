import * as constants from './state/constants';

/**
 * A 1-tick contract can be bought and sold before the interpreter returns to
 * watch('before'). Scope is already STOP, which is not that watch's stop
 * scope (DURING), so the run loop would wait forever and never reach
 * after-purchase / trade again.
 */
export const settledBeforeReentry = (scope, isSold) => scope === constants.STOP && Boolean(isSold);

/* Isolated so a new watch() call cannot clear the last tick the previous watch saw. */
let prevTick;

export const resetWatchTick = () => {
    prevTick = undefined;
};

const isReady = (state, passScope, passFlag) => state.scope === passScope && state[passFlag];

export const watchScope = ({ store, stopScope, passScope, passFlag, catchCurrentTick = false }) => {
    if (store.getState().scope === stopScope) {
        return Promise.resolve(false);
    }

    // The tick is already on screen. Analyse it now instead of waiting for the next one.
    if (catchCurrentTick) {
        const now = store.getState();
        if (isReady(now, passScope, passFlag) && now.newTick !== prevTick) {
            prevTick = now.newTick;
            return Promise.resolve(true);
        }
    }

    return new Promise(resolve => {
        const unsubscribe = store.subscribe(() => {
            const newState = store.getState();

            // Purchase started or the contract sold. Do not wait for another
            // tick — a same-tick sell would otherwise leave the bot stuck.
            if (newState.scope === stopScope) {
                unsubscribe();
                resolve(false);
                return;
            }

            if (newState.newTick === prevTick) {
                // Quotes arrived on the tick already seen. Normal speed skips it.
                if (catchCurrentTick && isReady(newState, passScope, passFlag)) {
                    unsubscribe();
                    resolve(true);
                }
                return;
            }
            prevTick = newState.newTick;

            if (isReady(newState, passScope, passFlag)) {
                unsubscribe();
                resolve(true);
            }
        });
    });
};

export const watchBefore = (store, catchCurrentTick = false) =>
    watchScope({
        store,
        stopScope: constants.DURING_PURCHASE,
        passScope: constants.BEFORE_PURCHASE,
        passFlag: 'proposalsReady',
        catchCurrentTick,
    });

export const watchDuring = store =>
    watchScope({
        store,
        stopScope: constants.STOP,
        passScope: constants.DURING_PURCHASE,
        passFlag: 'openContract',
    });
