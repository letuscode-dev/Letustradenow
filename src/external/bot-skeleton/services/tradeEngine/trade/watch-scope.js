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
/* The tick purchase conditions already analysed. A during-watch must not count as that. */
let beforeAnalysedTick;

export const resetWatchTick = () => {
    prevTick = undefined;
    beforeAnalysedTick = undefined;
};

const isReady = (state, passScope, passFlag) => state.scope === passScope && state[passFlag];

const hasTick = tick => tick !== undefined && tick !== null;

const shouldCatch = (state, passScope, passFlag, catchCurrentTick) =>
    catchCurrentTick &&
    isReady(state, passScope, passFlag) &&
    hasTick(state.newTick) &&
    state.newTick !== beforeAnalysedTick;

export const watchScope = ({ store, stopScope, passScope, passFlag, catchCurrentTick = false }) => {
    if (store.getState().scope === stopScope) {
        return Promise.resolve(false);
    }

    // The tick is already on screen. Analyse it once, even if the open contract just used it.
    if (shouldCatch(store.getState(), passScope, passFlag, catchCurrentTick)) {
        const now = store.getState();
        beforeAnalysedTick = now.newTick;
        prevTick = now.newTick;
        return Promise.resolve(true);
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
                // Quotes arrived on a tick purchase conditions have not analysed yet.
                // Normal speed skips it. A tick already analysed is not analysed again.
                if (shouldCatch(newState, passScope, passFlag, catchCurrentTick)) {
                    beforeAnalysedTick = newState.newTick;
                    unsubscribe();
                    resolve(true);
                }
                return;
            }
            prevTick = newState.newTick;

            if (isReady(newState, passScope, passFlag)) {
                if (catchCurrentTick) beforeAnalysedTick = newState.newTick;
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
