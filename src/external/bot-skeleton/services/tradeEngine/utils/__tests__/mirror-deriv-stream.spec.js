import { createMirrorDerivStream, mirrorTickDigit } from '../mirror-deriv-stream';

describe('Deriv mirror stream', () => {
    it('preserves the rate-limit error code from a rejected subscription response', async () => {
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
            send: jest.fn().mockResolvedValue({ error: { code: 'RateLimit', message: 'Too many requests' } }) };
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn() });
        await expect(stream.attach()).rejects.toMatchObject({ code: 'RateLimit', message: 'Too many requests' });
        stream.detach();
    });
    it('uses the displayed pip precision for the last digit', () => {
        expect(mirrorTickDigit(123.4, 2)).toBe(0);
        expect(mirrorTickDigit(123.45, 2)).toBe(5);
        expect(mirrorTickDigit(123.45, null)).toBeNull();
    });

    it('requests the correct symbol and tick count when recovering a standard market gap', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 'standard' }, tick: { symbol: 'R_10', epoch: 1, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async request => request.ticks ? first : { history: { times: [3], prices: [1.24] }, pip_size: 2 }) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn(), symbol: 'R_10' });
        await stream.attach();
        listener({ data: { ...first, tick: { ...first.tick, epoch: 5, quote: 1.27 } } });
        await stream.whenReady();
        expect(api.send).toHaveBeenCalledWith({ ticks_history: 'R_10', start: 3, end: '3', count: 1, style: 'ticks' });
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 3, false], [7, 5, true]]);
        stream.detach();
    });

    it('accepts only the dedicated subscription and forwards settlement updates', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', tick: { symbol: '1HZ75V', id: 'mine', epoch: 1, quote: 123.4, pip_size: 2 }, subscription: { id: 'mine' } };
        const api = {
            connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async () => { listener({ data: first }); return first; }),
        };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn() });
        await stream.attach();
        listener({ data: { ...first, tick: { ...first.tick, id: 'other', epoch: 2 }, subscription: { id: 'other' } } });
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: { contract_id: 42 } } });
        expect(runtime.tick).toHaveBeenCalledTimes(1);
        expect(runtime.tick).toHaveBeenCalledWith(0, 1, true);
        expect(runtime.settle).toHaveBeenCalledWith({ contract_id: 42 });
        stream.detach();
    });

    it('reuses an existing tick subscription if Deriv reports AlreadySubscribed', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const api = {
            connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn().mockRejectedValue({ error: { code: 'AlreadySubscribed' } }),
        };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn(),
            getExistingSubscription: () => 'existing' });
        await stream.attach();
        listener({ data: { msg_type: 'tick', subscription: { id: 'existing' },
            tick: { symbol: '1HZ75V', epoch: 2, quote: 123.4, pip_size: 2 } } });
        expect(runtime.tick).toHaveBeenCalledWith(0, 2, true);
    });

    it('forgets a subscription that arrives after the bot was stopped', async () => {
        let finishSubscribe;
        const api = {
            connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
            send: jest.fn(request => request.ticks ? new Promise(resolve => { finishSubscribe = resolve; }) : Promise.resolve({})),
        };
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn() });
        const attaching = stream.attach();
        stream.detach();
        finishSubscribe({ subscription: { id: 'late' } });
        await attaching;
        expect(api.send).toHaveBeenCalledWith({ forget: 'late' });
    });

    it('accepts an identical initial snapshot after reconnect without evaluating it twice', async () => {
        let listener;
        let close;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const journal = jest.fn();
        const api = {
            connection: { readyState: 1, addEventListener: (_event, fn) => { close = fn; }, removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async () => {
                const data = { msg_type: 'tick', subscription: { id: 'stream' },
                    tick: { symbol: '1HZ75V', epoch: 10, quote: 123.45, pip_size: 2 } };
                listener({ data });
                return data;
            }),
        };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal, onDisconnect: jest.fn() });
        await stream.attach();
        close();
        await stream.attach();
        listener({ data: { msg_type: 'tick', subscription: { id: 'stream' },
            tick: { symbol: '1HZ75V', epoch: 11, quote: 123.46, pip_size: 2 } } });
        expect(runtime.stop).not.toHaveBeenCalled();
        expect(runtime.tick.mock.calls).toEqual([[5, 10, true], [6, 11, true]]);
        expect(journal).toHaveBeenCalledWith(expect.objectContaining({ type: 'replayed_subscription_snapshot', epoch: 10 }));
    });

    it('processes the subscription response once when its event arrives later', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 's' }, tick: { symbol: '1HZ75V', epoch: 1, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn().mockResolvedValue(first) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn() });
        await stream.attach();
        listener({ data: first });
        listener({ data: { ...first, tick: { ...first.tick, epoch: 2, quote: 1.24 } } });
        expect(runtime.stop).not.toHaveBeenCalled();
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 2, true]]);
    });

    it('ignores the response echo even if a newer tick arrives first', async () => {
        let listener;
        const journal = jest.fn();
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 's' }, tick: { symbol: '1HZ75V', epoch: 1, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn().mockResolvedValue(first) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal, onDisconnect: jest.fn() });
        await stream.attach();
        listener({ data: { ...first, tick: { ...first.tick, epoch: 2, quote: 1.24 } } });
        listener({ data: first });
        listener({ data: { ...first, tick: { ...first.tick, epoch: 3, quote: 1.25 } } });
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 2, true], [5, 3, true]]);
        expect(journal).toHaveBeenCalledWith({ type: 'replayed_subscription_response', epoch: 1 });
        expect(runtime.stop).not.toHaveBeenCalled();
        listener({ data: first });
        expect(runtime.stop).toHaveBeenCalledWith('Duplicate or out-of-order tick');
    });

    it('processes the initial response before later buffered ticks', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 's' }, tick: { symbol: '1HZ75V', epoch: 1, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async () => { listener({ data: { ...first, tick: { ...first.tick, epoch: 2, quote: 1.24 } } }); return first; }) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn() });
        await stream.attach();
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 2, true]]);
    });

    it('processes a tick with an omitted symbol when its subscription identifies the market', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 's' }, tick: { symbol: '1HZ75V', epoch: 1, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async () => { listener({ data: first }); return first; }) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn() });
        await stream.attach();
        listener({ data: { msg_type: 'tick', subscription: { id: 's' }, tick: { epoch: 2, quote: 1.24, pip_size: 2 } } });
        expect(runtime.tick.mock.calls).toEqual([[7, 1, true], [4, 2, true]]);
    });

    it('stops instead of inventing a timestamp for a malformed tick', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 's' }, tick: { symbol: '1HZ75V', epoch: 1, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async () => { listener({ data: first }); return first; }) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn() });
        await stream.attach();
        listener({ data: { ...first, tick: { ...first.tick, epoch: null } } });
        expect(runtime.stop).toHaveBeenCalledWith('Invalid tick; continuity cannot be verified');
        expect(runtime.tick).toHaveBeenCalledTimes(1);
    });

    it('uses the two immediately preceding cached ticks to evaluate the first live tick', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 's' }, tick: { symbol: '1HZ75V', epoch: 3, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async () => { listener({ data: first }); return first; }) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn(),
            getInitialTicks: () => [{ epoch: 1, quote: 1.27 }, { epoch: 2, quote: 1.24 }, { epoch: 3, quote: 1.27 }] });
        await stream.attach();
        expect(runtime.tick.mock.calls).toEqual([[7, 1, false], [4, 2, false], [7, 3, true]]);
    });

    it('does not seed across an invalid cache entry', async () => {
        let listener;
        const runtime = { tick: jest.fn(), resetWindow: jest.fn(), stop: jest.fn(), settle: jest.fn() };
        const first = { msg_type: 'tick', subscription: { id: 's' }, tick: { symbol: '1HZ75V', epoch: 3, quote: 1.27, pip_size: 2 } };
        const api = { connection: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: callback => { listener = callback; return { unsubscribe: jest.fn() }; } }),
            send: jest.fn(async () => { listener({ data: first }); return first; }) };
        const stream = createMirrorDerivStream({ runtime, getApi: () => api, journal: jest.fn(), onDisconnect: jest.fn(),
            getInitialTicks: () => [{ epoch: 1, quote: 1.27 }, { epoch: null, quote: 1.28 }, { epoch: 2, quote: 1.24 }] });
        await stream.attach();
        expect(runtime.tick.mock.calls).toEqual([[7, 3, true]]);
    });
});
