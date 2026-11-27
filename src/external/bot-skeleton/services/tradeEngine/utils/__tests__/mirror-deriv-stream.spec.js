import { createMirrorDerivStream, mirrorTickDigit } from '../mirror-deriv-stream';

describe('Deriv mirror stream', () => {
    it('uses the displayed pip precision for the last digit', () => {
        expect(mirrorTickDigit(123.4, 2)).toBe(0);
        expect(mirrorTickDigit(123.45, 2)).toBe(5);
        expect(mirrorTickDigit(123.45, null)).toBeNull();
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
});
