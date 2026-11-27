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
export const createMirrorDerivStream = ({ runtime, getApi, journal, onDisconnect, getExistingSubscription = () => null, getInitialTicks = () => [] }) => {
    let subscription = null;
    let tickSubscriptionId = null;
    let connection = null;
    let ownerApi = null;
    let ownsTickSubscription = false;
    let earlyTicks = [];
    let pipSize = null;
    let reuseFirstTick = false;
    let disconnected = false;
    let responseEcho = null;
    let initialSeedAttempted = false;
    let generation = 0;

    const stream = createMirrorStream({ runtime, journal, history: async (start, end) => {
        if (end - start >= 1000) throw new Error('Tick gap is too large to recover safely');
        const api = getApi();
        const response = await api.send({ ticks_history: '1HZ75V', start, end: String(end), count: end - start + 1, style: 'ticks' });
        if (response?.error) throw new Error(response.error.message || 'Tick history request failed');
        const values = response?.history?.prices;
        const times = response?.history?.times;
        if (!Array.isArray(values) || !Array.isArray(times) || values.length !== times.length) throw new Error('Invalid tick history');
        return values.map((quote, index) => ({ epoch: Number(times[index]), quote, digit: mirrorTickDigit(quote, pipSize) }));
    } });

    const close = () => {
        generation += 1;
        disconnected = true;
        stream.disconnect();
        onDisconnect();
    };

    const sameTick = (left, right) =>
        Boolean(left?.tick && right?.tick &&
            (left.subscription?.id ?? left.tick.id) === (right.subscription?.id ?? right.tick.id) &&
            left.tick.epoch === right.tick.epoch && left.tick.quote === right.tick.quote);

    const receive = (data, snapshot = false, fromResponse = false) => {
        if (data?.msg_type === 'proposal_open_contract') runtime.settle(data.proposal_open_contract);
        if (data?.msg_type !== 'tick') return;
        const id = data.subscription?.id ?? data.tick?.id;
        const symbol = data.tick?.symbol;
        if (symbol && symbol !== '1HZ75V' && id !== tickSubscriptionId) return;
        if (!tickSubscriptionId) {
            if (reuseFirstTick && id && symbol === '1HZ75V') tickSubscriptionId = id;
            else if (!reuseFirstTick) { earlyTicks.push(data); return; }
            else return;
        }
        if (id !== tickSubscriptionId) return;
        if (!data.tick || (symbol && symbol !== '1HZ75V')) {
            stream.fail('Invalid tick from the mirror subscription');
            return;
        }
        if (responseEcho && !fromResponse) {
            const replayed = sameTick(data, responseEcho);
            if (replayed) {
                responseEcho = null;
                journal({ type: 'replayed_subscription_response', epoch: data.tick.epoch });
                return;
            }
        }
        const pip = data.tick.pip_size;
        if (pip !== null && pip !== undefined && Number.isInteger(Number(pip))) pipSize = Number(pip);
        const epoch = data.tick.epoch === null || data.tick.epoch === undefined || data.tick.epoch === ''
            ? null : Number(data.tick.epoch);
        if (!initialSeedAttempted) {
            initialSeedAttempted = true;
            try {
                const cached = getInitialTicks();
                const list = Array.isArray(cached) ? cached : [];
                let end = list.length;
                while (end > 0 && list[end - 1]?.epoch != null && Number(list[end - 1].epoch) >= epoch) end -= 1;
                const previous = list.slice(Math.max(0, end - 2), end).map(item => ({
                    epoch: item?.epoch == null || item.epoch === '' ? null : Number(item.epoch),
                    quote: item?.quote, digit: mirrorTickDigit(item?.quote, pip),
                }));
                if (previous.length === 2 && previous[1].epoch === epoch - 1) stream.seed(previous);
            } catch (error) {
                journal({ type: 'initial_tick_history_unavailable', reason: error?.message || String(error) });
            }
        }
        stream.ingest({ epoch, quote: data.tick.quote, snapshot, digit: mirrorTickDigit(data.tick.quote, pip) });
    };

    const attach = async () => {
        generation += 1;
        const current = generation;
        subscription?.unsubscribe();
        connection?.removeEventListener('close', close);
        tickSubscriptionId = null;
        reuseFirstTick = false;
        responseEcho = null;
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
            if (current !== generation) return;
            if (error?.error?.code !== 'AlreadySubscribed' && error?.code !== 'AlreadySubscribed') throw error;
            response = { error: { code: 'AlreadySubscribed' } };
        }
        if (current !== generation) {
            if (response?.subscription?.id && getApi() === api && api.connection?.readyState === 1) {
                Promise.resolve(api.send({ forget: response.subscription.id })).catch(() => {});
            }
            return;
        }
        if (response?.error?.code === 'AlreadySubscribed') {
            const matchingTick = earlyTicks.find(item => item.tick?.symbol === '1HZ75V');
            tickSubscriptionId = getExistingSubscription() || matchingTick?.subscription?.id || matchingTick?.tick?.id || null;
            reuseFirstTick = !tickSubscriptionId;
        } else {
            if (response?.error || !response?.subscription?.id) throw new Error(response?.error?.message || 'Tick subscription failed');
            tickSubscriptionId = response.subscription.id;
            ownsTickSubscription = true;
        }
        const buffered = earlyTicks;
        earlyTicks = [];
        const responseMissing = response?.tick && !buffered.some(item => sameTick(item, response));
        if (responseMissing) {
            buffered.unshift(response);
            responseEcho = response;
        }
        let snapshotMarked = false;
        buffered.forEach(item => {
            const snapshot = disconnected && !snapshotMarked && response?.tick &&
                (item.subscription?.id ?? item.tick?.id) === tickSubscriptionId &&
                item.tick?.epoch === response.tick.epoch && item.tick?.quote === response.tick.quote;
            if (snapshot) snapshotMarked = true;
            receive(item, Boolean(snapshot), responseMissing && item === response);
        });
        disconnected = false;
        stream.resume();
    };

    const detach = () => {
        generation += 1;
        stream.cancelWaiters();
        if (ownsTickSubscription && tickSubscriptionId && getApi() === ownerApi && connection?.readyState === 1) {
            Promise.resolve(ownerApi.send({ forget: tickSubscriptionId })).catch(() => {});
        }
        subscription?.unsubscribe();
        connection?.removeEventListener('close', close);
        subscription = null;
        connection = null;
        ownerApi = null;
    };
    return { attach, detach, whenReady: stream.whenReady };
};
