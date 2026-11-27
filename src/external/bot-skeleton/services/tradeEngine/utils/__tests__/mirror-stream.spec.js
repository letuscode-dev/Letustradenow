import { createMirrorStream } from '../mirror-stream';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('mirror tick stream ordering', () => {
    const makeRuntime = () => ({ tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn() });

    it('continues buffering live ticks while the gap is recovered in order', async () => {
        const runtime = makeRuntime();
        let resolveHistory;
        const history = jest.fn(() => new Promise(resolve => { resolveHistory = resolve; }));
        const stream = createMirrorStream({ runtime, history, journal: jest.fn() });
        stream.ingest({ epoch: 1, digit: 7 });
        stream.ingest({ epoch: 3, digit: 7 });
        stream.ingest({ epoch: 4, digit: 4 });
        await Promise.resolve();
        expect(runtime.tick).toHaveBeenCalledTimes(1);
        expect(history).toHaveBeenCalledWith(2, 2);
        resolveHistory([{ epoch: 2, digit: 4 }]);
        await flush();
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 2, false], [7, 3, true], [4, 4, true]]);
    });

    it('stops on missing history and refuses out-of-order ticks', async () => {
        const runtime = makeRuntime();
        const stream = createMirrorStream({ runtime, history: async () => [], journal: jest.fn() });
        stream.ingest({ epoch: 1, digit: 1 });
        stream.ingest({ epoch: 3, digit: 1 });
        await flush();
        expect(runtime.stop).toHaveBeenCalledWith('Tick history did not fully restore the missing sequence');
        expect(runtime.resetWindow).toHaveBeenCalled();
        const other = makeRuntime();
        const second = createMirrorStream({ runtime: other, history: jest.fn(), journal: jest.fn() });
        second.ingest({ epoch: 3, digit: 1 });
        second.ingest({ epoch: 2, digit: 2 });
        expect(other.stop).toHaveBeenCalledWith('Duplicate or out-of-order tick');
    });

    it('retries interrupted history recovery after reconnect without processing ticks early', async () => {
        const runtime = makeRuntime();
        let rejectOldHistory;
        const history = jest.fn()
            .mockImplementationOnce(() => new Promise((_, reject) => { rejectOldHistory = reject; }))
            .mockResolvedValueOnce([{ epoch: 2, digit: 4 }]);
        const stream = createMirrorStream({ runtime, history, journal: jest.fn() });
        stream.ingest({ epoch: 1, digit: 7 });
        stream.ingest({ epoch: 3, digit: 7 });
        await Promise.resolve();
        stream.disconnect();
        stream.ingest({ epoch: 4, digit: 4 });
        rejectOldHistory(new Error('socket closed'));
        await flush();
        expect(runtime.stop).not.toHaveBeenCalled();
        expect(runtime.tick).toHaveBeenCalledTimes(1);
        stream.resume();
        await flush();
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 2, false], [7, 3, true], [4, 4, true]]);
    });

    it('does not treat a different price in the same second as a replayed snapshot', () => {
        const runtime = makeRuntime();
        const stream = createMirrorStream({ runtime, history: jest.fn(), journal: jest.fn() });
        stream.ingest({ epoch: 1, digit: 5, quote: 123.45 });
        stream.ingest({ epoch: 1, digit: 6, quote: 123.46, snapshot: true });
        expect(runtime.stop).toHaveBeenCalledWith('Duplicate or out-of-order tick');
    });

    it('reports readiness only after missing ticks have been restored', async () => {
        const runtime = makeRuntime();
        let resolveHistory;
        const stream = createMirrorStream({ runtime, journal: jest.fn(),
            history: () => new Promise(resolve => { resolveHistory = resolve; }) });
        stream.ingest({ epoch: 1, digit: 7 });
        stream.ingest({ epoch: 3, digit: 7 });
        await Promise.resolve();
        let ready = false;
        const waiting = stream.whenReady().then(() => { ready = true; });
        await Promise.resolve();
        expect(ready).toBe(false);
        resolveHistory([{ epoch: 2, digit: 4 }]);
        await waiting;
        expect(ready).toBe(true);
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 2, false], [7, 3, true]]);
    });

    it('rejects readiness when tick history cannot restore the gap', async () => {
        const runtime = makeRuntime();
        let resolveHistory;
        const stream = createMirrorStream({ runtime, journal: jest.fn(),
            history: () => new Promise(resolve => { resolveHistory = resolve; }) });
        stream.ingest({ epoch: 1, digit: 7 });
        stream.ingest({ epoch: 3, digit: 7 });
        await Promise.resolve();
        const waiting = stream.whenReady();
        resolveHistory([]);
        await expect(waiting).rejects.toThrow('Tick history did not fully restore the missing sequence');
        expect(runtime.stop).toHaveBeenCalledWith('Tick history did not fully restore the missing sequence');
    });
});
