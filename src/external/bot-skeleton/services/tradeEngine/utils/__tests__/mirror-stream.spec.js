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
});
