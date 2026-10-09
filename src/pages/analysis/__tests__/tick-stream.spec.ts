import {
    appendAnalysisTick,
    FIRST_TICK_WAIT_MS,
    mergeTickHistory,
    nextTickPace,
    TICK_STALL_CEILING_MS,
    TICK_STALL_FLOOR_MS,
    tickStallLimitMs,
} from '../use-analysis-market-data';
import type { AnalysisTick } from '../analysis-types';

const tick = (epoch: number, quote = epoch): AnalysisTick => ({ digit: epoch % 10, epoch, quote });

describe('tick stream recovery', () => {
    it('waits longer before the pace is known, then follows the market gap', () => {
        expect(tickStallLimitMs(0, 0)).toBe(FIRST_TICK_WAIT_MS);
        expect(tickStallLimitMs(0, 1)).toBe(FIRST_TICK_WAIT_MS);
        expect(tickStallLimitMs(1000, 2)).toBe(TICK_STALL_FLOOR_MS);
        expect(tickStallLimitMs(20000, 4)).toBe(TICK_STALL_CEILING_MS);
    });

    it('learns a one-second pace and keeps it when a later gap is a stall', () => {
        const first = nextTickPace({ lastGapMs: 0, tickCount: 0 }, null);
        const second = nextTickPace(first, 1000);
        const third = nextTickPace(second, 1000);
        const afterStall = nextTickPace(third, 20000);

        expect(second.tickCount).toBe(2);
        expect(third.lastGapMs).toBe(1000);
        expect(afterStall).toEqual(third);
    });

    it('learns a slow market from the first two ticks instead of treating that gap as a stall', () => {
        const first = nextTickPace({ lastGapMs: 0, tickCount: 0 }, null);
        const second = nextTickPace(first, 20000);

        expect(second.tickCount).toBe(2);
        expect(second.lastGapMs).toBe(20000);
        expect(tickStallLimitMs(second.lastGapMs, second.tickCount)).toBe(TICK_STALL_CEILING_MS);
    });

    it('drops a repeated quote and keeps ticks that arrived after the history snapshot', () => {
        const history = [tick(1), tick(2)];
        const current = [tick(2), tick(3)];

        expect(appendAnalysisTick(history, tick(2))).toBe(history);
        expect(mergeTickHistory(history, current)).toEqual([tick(1), tick(2), tick(3)]);
    });
});
