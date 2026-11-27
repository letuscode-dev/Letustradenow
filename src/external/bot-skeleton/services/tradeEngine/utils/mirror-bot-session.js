import { createMirrorRuntime } from './mirror-runtime';
import { createMirrorDerivStream } from './mirror-deriv-stream';

/** Connect the isolated mirror runtime to an authenticated Deriv session. */
export const createMirrorBotSession = ({ getApi, account, getAccount, currency, settings, journal, round, onStop, onCleanup = () => {}, getExistingSubscription, getInitialTicks }) => {
    let ended = false;
    let cleaned = false;
    let attached = false;
    const contractSubscriptions = new Map();
    let resolveStopped;
    const finished = new Promise(resolve => { resolveStopped = resolve; });
    let stream;

    const checkCleanup = () => {
        contractSubscriptions.forEach((entry, id) => {
            if (!runtime.tracker.settled.has(id)) return;
            contractSubscriptions.delete(id);
            if (getApi() === entry.api && entry.api.connection?.readyState === 1) {
                Promise.resolve(entry.api.send({ forget: entry.subscriptionId })).catch(() => {});
            }
        });
        if (!ended || cleaned || runtime.pendingBuys() || runtime.tracker.active.size) return;
        cleaned = true;
        stream.detach();
        onCleanup();
    };
    const request = body => {
        const api = getApi();
        if (!api || getAccount() !== account) return Promise.reject(new Error('The active account or connection changed'));
        return api.send(body).then(response => {
            if (response?.error) throw new Error(response.error.message || 'Deriv request failed');
            return response;
        });
    };
    const runtime = createMirrorRuntime({ settings, journal, round, onChange: checkCleanup,
        buy: ({ barrier, stake }) => request({ buy: '1', price: stake, parameters: {
            amount: stake, basis: 'stake', contract_type: 'DIGITDIFF', currency,
            duration: 1, duration_unit: 't', underlying_symbol: '1HZ75V', barrier: String(barrier),
        } }),
        refreshContract: async contractId => {
            const api = getApi();
            let response;
            try {
                response = await request({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
            } catch (error) {
                if (!attached || getApi() !== api || api?.connection?.readyState > 1) {
                    const interrupted = new Error('Connection interrupted while checking a confirmed contract');
                    interrupted.code = 'MIRROR_CONNECTION_INTERRUPTED';
                    throw interrupted;
                }
                throw error;
            }
            if (response?.subscription?.id) contractSubscriptions.set(String(contractId), { api, subscriptionId: response.subscription.id });
            checkCleanup();
            return response;
        },
        onStop: reason => {
            ended = true;
            resolveStopped();
            onStop(reason);
            checkCleanup();
        },
    });
    stream = createMirrorDerivStream({ runtime, getApi, journal, getExistingSubscription, getInitialTicks, onDisconnect: () => {
        attached = false;
        contractSubscriptions.clear();
        if (runtime.pendingBuys()) runtime.stop('Connection lost while a purchase was unconfirmed');
    } });

    const attach = async () => {
        if (cleaned || attached) return;
        if (getAccount() !== account) return runtime.stop('The active account changed');
        attached = true;
        try {
            // Reconcile already-confirmed contracts before accepting new ticks.
            await Promise.all([...runtime.tracker.active.values()].map(async contract => {
                const response = await request({ proposal_open_contract: 1, contract_id: contract.contract_id });
                runtime.settle(response?.proposal_open_contract);
            }));
            if (cleaned) return;
            await stream.attach();
            // Restore each tracked contract subscription when the API connection changes.
            await Promise.all([...runtime.tracker.active.values()].map(async contract => {
                const response = await request({ proposal_open_contract: 1, contract_id: contract.contract_id, subscribe: 1 });
                if (response?.subscription?.id) contractSubscriptions.set(String(contract.contract_id), { api: getApi(), subscriptionId: response.subscription.id });
                runtime.settle(response?.proposal_open_contract);
                checkCleanup();
            }));
        } catch (error) {
            attached = false;
            runtime.stop(`Unable to restore the Deriv stream: ${error.message}`);
        }
    };
    const stop = reason => runtime.stop(reason || 'Stopped by user');
    return { attach, stop, finished, runtime, isCleaned: () => cleaned };
};
