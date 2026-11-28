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
export const createMirrorDerivStream = ({ runtime, getApi, journal, onDisconnect, getExistingSubscription = () => null, getInitialTicks = () => [], initialHistoryTicks = 0, symbol = '1HZ75V', initialCachedTicks = 2, monitorContracts = true }) => {
    const tickInterval = symbol.startsWith('R_') ? 2 : 1;
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
    let bootstrapPromise = null;
    let cancelBootstrap = null;
    let bootstrapQueue = [];

    const fetchHistory = async (start, end, precision = pipSize) => {
        const count = (end - start) / tickInterval + 1;
        if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Tick gap is too large to recover safely');
        const api = getApi();
        const response = await api.send({ ticks_history: symbol, start, end: String(end), count, style: 'ticks' });
        if (response?.error) throw new Error(response.error.message || 'Tick history request failed');
        const values = response?.history?.prices;
        const times = response?.history?.times;
        if (!Array.isArray(values) || !Array.isArray(times) || values.length !== times.length) throw new Error('Invalid tick history');
        if (response.pip_size != null && Number(response.pip_size) !== Number(precision)) throw new Error('Tick history precision does not match the live stream');
        return values.map((quote, index) => ({ epoch: times[index] == null || times[index] === '' ? null : Number(times[index]),
            quote, digit: mirrorTickDigit(quote, precision) }));
    };
    const stream = createMirrorStream({ runtime, journal, tickInterval, history: (start, end) => fetchHistory(start, end) });

    const startBootstrap = (tick, precision) => {
        const version = generation;
        bootstrapQueue.push(tick);
        let timer;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Initial tick history timed out')), 5000); });
        const cancelled = new Promise(resolve => { cancelBootstrap = () => resolve(null); });
        bootstrapPromise = Promise.race([
            Promise.resolve().then(() => fetchHistory(tick.epoch - initialHistoryTicks * tickInterval, tick.epoch - tickInterval, precision)),
            timeout, cancelled,
        ]).then(ticks => {
            if (version !== generation || ticks === null) return;
            if (ticks.length !== initialHistoryTicks || ticks[0]?.epoch !== tick.epoch - initialHistoryTicks * tickInterval ||
                ticks[ticks.length - 1]?.epoch !== tick.epoch - tickInterval || !stream.seed(ticks, initialHistoryTicks)) {
                throw new Error('Initial tick history is incomplete or out of order');
            }
            journal({ type: 'initial_history_ready', count: initialHistoryTicks });
        }).catch(error => {
            if (version === generation) journal({ type: 'initial_tick_history_unavailable', reason: `${error?.message || String(error)}; collecting live ticks instead` });
        }).finally(() => {
            clearTimeout(timer);
            if (version !== generation) return;
            bootstrapPromise = null;
            cancelBootstrap = null;
            const buffered = bootstrapQueue;
            bootstrapQueue = [];
            stream.ingestBatch(buffered);
        });
    };

    const close = () => {
        generation += 1;
        disconnected = true;
        stream.disconnect();
        if (bootstrapPromise) {
            cancelBootstrap?.();
            cancelBootstrap = null;
            bootstrapPromise = null;
            const buffered = bootstrapQueue;
            bootstrapQueue = [];
            stream.ingestBatch(buffered);
        }
        onDisconnect();
    };

    const sameTick = (left, right) =>
        Boolean(left?.tick && right?.tick &&
            (left.subscription?.id ?? left.tick.id) === (right.subscription?.id ?? right.tick.id) &&
            left.tick.epoch === right.tick.epoch && left.tick.quote === right.tick.quote);

    const receive = (data, snapshot = false, fromResponse = false) => {
        if (monitorContracts && data?.msg_type === 'proposal_open_contract') runtime.settle(data.proposal_open_contract);
        if (data?.msg_type !== 'tick') return;
        const id = data.subscription?.id ?? data.tick?.id;
        const tickSymbol = data.tick?.symbol;
        if (tickSymbol && tickSymbol !== symbol && id !== tickSubscriptionId) return;
        if (!tickSubscriptionId) {
            if (reuseFirstTick && id && tickSymbol === symbol) tickSubscriptionId = id;
            else if (!reuseFirstTick) { earlyTicks.push(data); return; }
            else return;
        }
        if (id !== tickSubscriptionId) return;
        if (!data.tick || (tickSymbol && tickSymbol !== symbol)) {
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
        const tick = { epoch, quote: data.tick.quote, snapshot, digit: mirrorTickDigit(data.tick.quote, pip),
            receivedAt: initialHistoryTicks > 0 || runtime.staleBufferedAnalysisOnly ? Date.now() : null };
        if (!initialSeedAttempted) {
            initialSeedAttempted = true;
            if (initialHistoryTicks > 0 && Number.isInteger(epoch) && tick.digit !== null) {
                startBootstrap(tick, Number(pip));
                return;
            }
            try {
                const cached = getInitialTicks();
                const list = Array.isArray(cached) ? cached : [];
                let end = list.length;
                while (end > 0 && list[end - 1]?.epoch != null && Number(list[end - 1].epoch) >= epoch) end -= 1;
                const previous = list.slice(Math.max(0, end - initialCachedTicks), end).map(item => ({
                    epoch: item?.epoch == null || item.epoch === '' ? null : Number(item.epoch),
                    quote: item?.quote, digit: mirrorTickDigit(item?.quote, pip),
                }));
                if (previous.length === initialCachedTicks && previous[previous.length - 1].epoch === epoch - tickInterval) stream.seed(previous, initialCachedTicks);
            } catch (error) {
                journal({ type: 'initial_tick_history_unavailable', reason: error?.message || String(error) });
            }
        }
        if (bootstrapPromise) bootstrapQueue.push(tick);
        else stream.ingest(tick);
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
            response = await api.send({ ticks: symbol, subscribe: 1 });
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
            const matchingTick = earlyTicks.find(item => item.tick?.symbol === symbol);
            tickSubscriptionId = getExistingSubscription() || matchingTick?.subscription?.id || matchingTick?.tick?.id || null;
            reuseFirstTick = !tickSubscriptionId;
        } else {
            if (response?.error || !response?.subscription?.id) {
                const error = new Error(response?.error?.message || 'Tick subscription failed');
                error.code = response?.error?.code;
                throw error;
            }
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
        cancelBootstrap?.();
        cancelBootstrap = null;
        bootstrapPromise = null;
        bootstrapQueue = [];
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
    const whenReady = async () => {
        if (bootstrapPromise) await bootstrapPromise;
        return stream.whenReady();
    };
    return { attach, detach, whenReady };
};
