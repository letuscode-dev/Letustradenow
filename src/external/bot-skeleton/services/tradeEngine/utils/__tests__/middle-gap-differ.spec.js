import { middleGapDiffer, middleGapFromNewest, secondsDifferBarrier } from '../middle-gap-differ';

describe('middle digit differs', () => {
    it('trades when two ticks fall by exactly 2', () => {
        expect(middleGapDiffer(8, 6)).toEqual({ trade: true, previous2: 8, previous1: 6 });
        expect(middleGapDiffer(2, 0)).toEqual({ trade: true, previous2: 2, previous1: 0 });
        expect(middleGapDiffer(9, 7)).toEqual({ trade: true, previous2: 9, previous1: 7 });
    });

    it('uses the last digit of the current seconds as the barrier', () => {
        expect(secondsDifferBarrier(new Date(2026, 9, 9, 9, 54, 1))).toBe(1);
        expect(secondsDifferBarrier(new Date(2026, 9, 9, 9, 54, 15))).toBe(5);
        expect(secondsDifferBarrier(new Date(2026, 9, 9, 9, 54, 10))).toBe(0);
        expect(secondsDifferBarrier(new Date(2026, 9, 9, 9, 54, 59))).toBe(9);
        expect(secondsDifferBarrier(new Date(2026, 9, 9, 0, 0, 0))).toBe(0);
        expect(secondsDifferBarrier(new Date(NaN))).toBeNull();
    });

    it('does not trade when the drop is not exactly 2', () => {
        expect(middleGapDiffer(6, 8).trade).toBe(false);
        expect(middleGapDiffer(5, 4).trade).toBe(false);
        expect(middleGapDiffer(4, 4).trade).toBe(false);
        expect(middleGapDiffer(7, 4).trade).toBe(false);
        expect(middleGapDiffer(Number.NaN, 4).trade).toBe(false);
        expect(middleGapDiffer(10, 8).trade).toBe(false);
    });

    it('reads previous_2 and previous_1 from the newest end of the list', () => {
        expect(middleGapFromNewest([1, 9, 7])).toMatchObject({ trade: true, ready: true });
        expect(middleGapFromNewest([9, 7, 1]).trade).toBe(false);
        expect(middleGapFromNewest([5]).ready).toBe(false);
        expect(middleGapFromNewest([3, 5, 3])).toMatchObject({ trade: true, previous2: 5, previous1: 3 });
    });
});
