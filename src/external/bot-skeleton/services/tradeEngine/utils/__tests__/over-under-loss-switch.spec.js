import { validOverUnderSwitchSettings } from '../over-under-loss-switch';
import { tradeOptionToBuy } from '../helpers';

describe('Over to Under loss switch', () => {
    it('accepts only supported digit predictions and positive inputs', () => {
        expect(validOverUnderSwitchSettings(2, 7, 1, 2, 10)).toBe(true);
        expect(validOverUnderSwitchSettings(0, 9, 1, 1.5, 10)).toBe(true);
        for (const args of [
            [9, 7, 1, 2, 10], [2, 0, 1, 2, 10], [2.5, 7, 1, 2, 10],
            [2, 7, 0, 2, 10], [2, 7, 1, 0, 10], [2, 7, 1, 2, 0],
            [null, 7, 1, 2, 10], [2, 7, 1, Infinity, 10],
        ]) expect(validOverUnderSwitchSettings(...args)).toBe(false);
    });

    it('builds a direct buy for the current side, stake and prediction', () => {
        const base = { symbol: '1HZ75V', currency: 'USD', duration: 1, duration_unit: 't', basis: 'stake' };
        const over = tradeOptionToBuy('DIGITOVER', { ...base, amount: 1, prediction: 2 });
        const under = tradeOptionToBuy('DIGITUNDER', { ...base, amount: 2, prediction: 7 });
        expect(over).toMatchObject({ buy: '1', price: 1, parameters: { contract_type: 'DIGITOVER', barrier: '2', amount: 1 } });
        expect(under).toMatchObject({ buy: '1', price: 2, parameters: { contract_type: 'DIGITUNDER', barrier: '7', amount: 2 } });
    });
});
