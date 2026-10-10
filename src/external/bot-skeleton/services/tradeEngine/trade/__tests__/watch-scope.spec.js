import * as constants from '../state/constants';
import { resetWatchTick, settledBeforeReentry, watchBefore, watchDuring } from '../watch-scope';

const fakeStore = state => {
    let current = state;
    const listeners = new Set();
    return {
        getState: () => current,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        set(next) {
            current = next;
            listeners.forEach(listener => listener());
        },
    };
};

describe('trade watch scope', () => {
    beforeEach(() => {
        resetWatchTick();
    });

    it('treats a sold contract as finished when the before-loop is re-entered', () => {
        expect(settledBeforeReentry(constants.STOP, true)).toBe(true);
        expect(settledBeforeReentry(constants.STOP, false)).toBe(false);
        expect(settledBeforeReentry(constants.BEFORE_PURCHASE, true)).toBe(false);
        expect(settledBeforeReentry(constants.DURING_PURCHASE, true)).toBe(false);
    });

    it('leaves the before-loop immediately once a purchase has started', async () => {
        const store = fakeStore({
            scope: constants.BEFORE_PURCHASE,
            proposalsReady: true,
            newTick: 1,
        });
        const pending = watchBefore(store);
        store.set({ scope: constants.DURING_PURCHASE, proposalsReady: true, newTick: 1 });
        await expect(pending).resolves.toBe(false);
    });

    it('leaves the during-loop when the contract sells on the same tick', async () => {
        const store = fakeStore({
            scope: constants.DURING_PURCHASE,
            openContract: false,
            newTick: 4,
        });
        const pending = watchDuring(store);
        store.set({ scope: constants.STOP, openContract: false, newTick: 4 });
        await expect(pending).resolves.toBe(false);
    });

    it('waits for the next tick before analysing again', async () => {
        const store = fakeStore({
            scope: constants.BEFORE_PURCHASE,
            proposalsReady: false,
            newTick: 1,
        });
        const pending = watchBefore(store);
        let settled = false;
        pending.then(() => {
            settled = true;
        });

        store.set({ scope: constants.BEFORE_PURCHASE, proposalsReady: false, newTick: 1 });
        await Promise.resolve();
        expect(settled).toBe(false);

        store.set({ scope: constants.BEFORE_PURCHASE, proposalsReady: true, newTick: 1 });
        await Promise.resolve();
        expect(settled).toBe(false);

        store.set({ scope: constants.BEFORE_PURCHASE, proposalsReady: true, newTick: 2 });
        await expect(pending).resolves.toBe(true);
    });

    it('analyses the current tick when every-tick mode is on and quotes arrive late', async () => {
        const store = fakeStore({
            scope: constants.BEFORE_PURCHASE,
            proposalsReady: false,
            newTick: 1,
        });
        const pending = watchBefore(store, true);
        store.set({ scope: constants.BEFORE_PURCHASE, proposalsReady: false, newTick: 1 });
        await Promise.resolve();
        store.set({ scope: constants.BEFORE_PURCHASE, proposalsReady: true, newTick: 1 });
        await expect(pending).resolves.toBe(true);
    });

    it('does not analyse the same tick twice in every-tick mode', async () => {
        const store = fakeStore({
            scope: constants.BEFORE_PURCHASE,
            proposalsReady: true,
            newTick: 3,
        });
        await expect(watchBefore(store, true)).resolves.toBe(true);

        const again = watchBefore(store, true);
        let settled = false;
        again.then(() => {
            settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);

        store.set({ scope: constants.BEFORE_PURCHASE, proposalsReady: true, newTick: 4 });
        await expect(again).resolves.toBe(true);
    });
});
