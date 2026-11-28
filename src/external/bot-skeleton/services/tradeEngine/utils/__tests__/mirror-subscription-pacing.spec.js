import { attachMirrorStreams } from '../mirror-subscription-pacing';

it('paces subscriptions and retries a rate-limited subscription with backoff', async () => {
    const first = { attach: jest.fn().mockResolvedValue() };
    const second = { attach: jest.fn().mockRejectedValueOnce({ error: { code: 'RateLimit' } }).mockResolvedValue() };
    const wait = jest.fn().mockResolvedValue();
    const journal = jest.fn();
    await attachMirrorStreams({ streams: [first, second], symbols: ['1HZ10V', 'R_10'], isCurrent: () => true, wait, journal });
    expect(first.attach).toHaveBeenCalledTimes(1);
    expect(second.attach).toHaveBeenCalledTimes(2);
    expect(wait.mock.calls).toEqual([[250], [2000]]);
    expect(journal).toHaveBeenCalledWith({ type: 'market_subscription_rate_limit', symbol: 'R_10', retryInSeconds: 2 });
});

it('stops subscribing after cancellation and propagates other errors', async () => {
    let active = true;
    const streams = [{ attach: jest.fn().mockResolvedValue() }, { attach: jest.fn() }];
    await attachMirrorStreams({ streams, symbols: ['A', 'B'], isCurrent: () => active, journal: jest.fn(),
        wait: async () => { active = false; } });
    expect(streams[1].attach).not.toHaveBeenCalled();
    const error = new Error('Permission denied');
    await expect(attachMirrorStreams({ streams: [{ attach: jest.fn().mockRejectedValue(error) }], symbols: ['A'],
        isCurrent: () => true, journal: jest.fn(), wait: jest.fn() })).rejects.toBe(error);
});

it('backs off exponentially and stops after repeated rate limits', async () => {
    const stream = { attach: jest.fn().mockRejectedValue({ code: 'RateLimit' }) };
    const wait = jest.fn().mockResolvedValue();
    await expect(attachMirrorStreams({ streams: [stream], symbols: ['R_10'], isCurrent: () => true,
        journal: jest.fn(), wait })).rejects.toMatchObject({ code: 'RateLimit' });
    expect(stream.attach).toHaveBeenCalledTimes(4);
    expect(wait.mock.calls).toEqual([[2000], [4000], [8000]]);
});
