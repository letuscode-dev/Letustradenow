import { createBatchedJournalWriter } from '../batched-journal-writer';

describe('batched journal persistence', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('coalesces frequent updates while retaining the latest messages for each account', () => {
        let stored: Record<string, string[]> = { other: ['keep'] };
        const write = jest.fn((journals: Record<string, string[]>) => { stored = journals; });
        const writer = createBatchedJournalWriter(() => ({ ...stored }), write);
        writer.schedule('A', ['first']);
        writer.schedule('A', ['second', 'first']);
        writer.schedule('B', ['other account']);
        expect(write).not.toHaveBeenCalled();
        jest.advanceTimersByTime(5000);
        expect(write).toHaveBeenCalledTimes(1);
        expect(stored).toEqual({ A: ['second', 'first'], B: ['other account'], other: ['keep'] });
    });

    it('flushes pending messages immediately and cancels the scheduled write', () => {
        const write = jest.fn();
        const writer = createBatchedJournalWriter(() => ({}), write);
        writer.schedule('A', ['message']);
        writer.flush();
        expect(write).toHaveBeenCalledWith({ A: ['message'] });
        jest.advanceTimersByTime(5000);
        expect(write).toHaveBeenCalledTimes(1);
    });
});
