import { createMirrorStream } from './mirror-stream';

/** Extract the displayed last digit without losing trailing zeroes. */
export const mirrorTickDigit = (quote, pipSize) => {
    const n = Number(quote);
    const pip = Number(pipSize);
    if (quote === null || quote === undefined || quote === '' || pipSize === null || pipSize === undefined || pipSize === '' || !Number.isFinite(n) || n < 0 ||
        !Number.isInteger(pip) || pip < 0 || pip > 20) return null;
    const text = n.toFixed(pip);
    return Number(text[text.length - 1]);
};

/** Attach to a Deriv connection; the caller reattaches after reconnection. */
export const createMirrorDerivStream = ({ runtime, getApi, journal, onDisconnect, getExistingSubscription = () => null }) => {
    let subscription = null;
    let tickSubscriptionId = null;
    let connection = null;
    let ownerApi = null;
    let ownsTickSubscription = false;
    let earlyTicks = [];
    let pipSize = null;
    let reuseFirstTick = false;
    let generation = 0;

    const stream = createMirrorStream({ runtime, journal, history: async (start, end) => {
        if (end - start >= 1000) throw new Error('Tick gap is too large to recover safely');
        const api = getApi();
        const response = await api.send({ ticks_history: '1HZ75V', start, end: String(end), count: end - start + 1, style: 'ticks' });
        if (response?.error) throw new Error(response.error.message || 'Tick history request failed');
        const values = response?.history?.prices;
        const times = response?.history?.times;
        if (!Array.isArray(values) || !Array.isArray(times) || values.length !== times.length) throw new Error('Invalid tick history');
        return values.map((quote, index) => ({ epoch: Number(times[index]), digit: mirrorTickDigit(quote, pipSize) }));
    } });

    const close = () => {
        stream.disconnect();
        onDisconnect();
    };

    const receive = data => {
        if (data?.msg_type === 'proposal_open_contract') runtime.settle(data.proposal_open_contract);
        if (data?.msg_type !== 'tick' || data.tick?.symbol !== '1HZ75V') return;
        const id = data.subscription?.id ?? data.tick.id;
        if (!tickSubscriptionId) {
            if (reuseFirstTick && id) tickSubscriptionId = id;
            else { earlyTicks.push(data); return; }
        }
        if (id !== tickSubscriptionId) return;
        const pip = data.tick.pip_size;
        if (pip !== null && pip !== undefined && Number.isInteger(Number(pip))) pipSize = Number(pip);
        stream.ingest({ epoch: Number(data.tick.epoch), digit: mirrorTickDigit(data.tick.quote, pip) });
    };

    const attach = async () => {
        generation += 1;
        const current = generation;
        subscription?.unsubscribe();
        connection?.removeEventListener('close', close);
        tickSubscriptionId = null;
        reuseFirstTick = false;
        earlyTicks = [];
        const api = getApi();
        ownerApi = api;
        ownsTickSubscription = false;
        connection = api.connection;
        connection.addEventListener('close', close);
        subscription = api.onMessage().subscribe(({ data }) => receive(data));
        let response;
        try {
            response = await api.send({ ticks: '1HZ75V', subscribe: 1 });
        } catch (error) {
            if (error?.error?.code !== 'AlreadySubscribed' && error?.code !== 'AlreadySubscribed') throw error;
            response = { error: { code: 'AlreadySubscribed' } };
        }
        if (current !== generation) return;
        if (response?.error?.code === 'AlreadySubscribed') {
            tickSubscriptionId = getExistingSubscription() || earlyTicks[0]?.subscription?.id || earlyTicks[0]?.tick?.id || null;
            reuseFirstTick = !tickSubscriptionId;
        } else {
            if (response?.error || !response?.subscription?.id) throw new Error(response?.error?.message || 'Tick subscription failed');
            tickSubscriptionId = response.subscription.id;
            ownsTickSubscription = true;
        }
        const buffered = earlyTicks;
        earlyTicks = [];
        if (response?.tick && !buffered.some(item => (item.subscription?.id ?? item.tick?.id) === tickSubscriptionId)) buffered.push(response);
        buffered.forEach(receive);
    };

    const detach = () => {
        generation += 1;
        if (ownsTickSubscription && tickSubscriptionId && getApi() === ownerApi && connection?.readyState === 1) {
            Promise.resolve(ownerApi.send({ forget: tickSubscriptionId })).catch(() => {});
        }
        subscription?.unsubscribe();
        connection?.removeEventListener('close', close);
        subscription = null;
        connection = null;
        ownerApi = null;
    };
    return { attach, detach };
};
