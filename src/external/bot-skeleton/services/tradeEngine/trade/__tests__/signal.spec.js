import * as constants from '../state/constants';
import signal from '../state/reducers';

describe('trade signal', () => {
    it('keeps the tick already on screen when a trade starts, opens, and sells', () => {
        const started = signal(
            { scope: constants.STOP, proposalsReady: true, newTick: 8 },
            { type: constants.START }
        );
        expect(started.scope).toBe(constants.BEFORE_PURCHASE);
        expect(started.newTick).toBe(8);

        const bought = signal(started, { type: constants.PURCHASE_SUCCESSFUL });
        expect(bought.scope).toBe(constants.DURING_PURCHASE);
        expect(bought.newTick).toBe(8);

        const open = signal({ ...bought, newTick: 9 }, { type: constants.OPEN_CONTRACT });
        expect(open.newTick).toBe(9);

        const sold = signal(open, { type: constants.SELL });
        expect(sold.scope).toBe(constants.STOP);
        expect(sold.newTick).toBe(9);

        const next = signal(sold, { type: constants.START });
        expect(next.scope).toBe(constants.BEFORE_PURCHASE);
        expect(next.newTick).toBe(9);
    });
});
