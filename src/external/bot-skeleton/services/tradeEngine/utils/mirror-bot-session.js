import { createMirrorRuntime } from './mirror-runtime';
import { createMirrorDerivStream } from './mirror-deriv-stream';
import { mirrorContractForDisplay } from './mirror-contract-display';

const hasSettlement = contract => {
    const present = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
    return Boolean(contract && (contract.status === 'won' || contract.status === 'lost') &&
        present(contract.profit) && present(contract.sell_price) && Number(contract.sell_price) >= 0);
};

// The account-wide subscription belongs to the connection, not one bot run.
// Keeping it until the socket closes prevents a stopped run from canceling a
// later run's shared stream and avoids a new status request for every trade.
const sharedContractStreams = new WeakMap();

const ensureContractStream = (api, account, subscribe) => {
    let accounts = sharedContractStreams.get(api);
    if (!accounts) { accounts = new Map(); sharedContractStreams.set(api, accounts); }
    if (accounts.has(account)) return accounts.get(account);
    const pending = Promise.resolve().then(subscribe).then(response => {
        if (!response?.subscription?.id) throw new Error('Contract status subscription was not confirmed');
    }).catch(error => {
        const code = error?.error?.code ?? error?.code;
        if (code === 'AlreadySubscribed') {
            // An existing app-owned stream may later be forgotten by the app;
            // probe again on a subsequent run instead of caching its ownership.
            if (accounts.get(account) === pending) accounts.delete(account);
            return;
        }
        if (accounts.get(account) === pending) accounts.delete(account);
        throw error;
    });
    accounts.set(account, pending);
    return pending;
};

/** Connect the isolated mirror runtime to an authenticated Deriv session. */
export const createMirrorBotSession = ({ getApi, account, getAccount, currency, settings, journal, round, onStop, onCleanup = () => {}, onContract = () => {}, getExistingSubscription, getInitialTicks, strategy = null }) => {
    let ended = false;
    let cleaned = false;
    let attached = false;
    let attachVersion = 0;
    const monitorAll = Boolean(strategy?.monitorAllContracts);
    const settlementMonitors = new Map();
    const contractSubscriptions = new Map();
    const confirmedBuys = new Map();
    let resolveStopped;
    const finished = new Promise(resolve => { resolveStopped = resolve; });
    let stream;

    const checkCleanup = () => {
        confirmedBuys.forEach((_buy, id) => {
            if (runtime.tracker.settled.has(id)) confirmedBuys.delete(id);
        });
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
            if (response?.error) {
                const error = new Error(response.error.message || 'Deriv request failed');
                error.code = response.error.code;
                throw error;
            }
            return response;
        });
    };

    // The account-wide stream handles normal settlements. This request is only
    // a fallback if a contract update is delayed or lost.
    const monitorContract = contractId => {
        const id = String(contractId);
        if (settlementMonitors.has(id)) return settlementMonitors.get(id).promise;
        let resolveMonitor;
        let rejectMonitor;
        const monitor = { timer: null, done: false };
        monitor.promise = new Promise((resolve, reject) => { resolveMonitor = resolve; rejectMonitor = reject; });
        const finish = (error, response) => {
            if (monitor.done) return;
            monitor.done = true;
            clearTimeout(monitor.timer);
            settlementMonitors.delete(id);
            if (error) rejectMonitor(error);
            else resolveMonitor(response);
        };
        monitor.finish = finish;
        const check = () => {
            const api = getApi();
            request({ proposal_open_contract: 1, contract_id: contractId }).then(response => {
                if (monitor.done) return;
                const contract = response?.proposal_open_contract;
                if (hasSettlement(contract)) finish(null, response);
                else monitor.timer = setTimeout(check, 5000);
            }).catch(error => {
                if (!attached || getApi() !== api || api?.connection?.readyState > 1) {
                    const interrupted = new Error('Connection interrupted while checking a confirmed contract');
                    interrupted.code = 'MIRROR_CONNECTION_INTERRUPTED';
                    finish(interrupted);
                } else finish(error);
            });
        };
        monitor.timer = setTimeout(check, 5000);
        settlementMonitors.set(id, monitor);
        return monitor.promise;
    };
    const runtime = createMirrorRuntime({ settings, journal, round, strategy, onChange: checkCleanup,
        onPurchase: (buy, signal) => {
            confirmedBuys.set(String(buy.contract_id), buy);
            onContract(mirrorContractForDisplay({ account, currency, buy, signal }));
        },
        onContractUpdate: (contract, signal) => {
            if (monitorAll && hasSettlement(contract)) {
                settlementMonitors.get(String(contract.contract_id))?.finish(null, { proposal_open_contract: contract });
            }
            const buy = confirmedBuys.get(String(contract.contract_id));
            if (buy) onContract(mirrorContractForDisplay({ account, currency, buy, signal, contract }));
        },
        buy: ({ barrier, stake }) => request({ buy: '1', price: stake, parameters: {
            amount: stake, basis: 'stake', contract_type: 'DIGITDIFF', currency,
            duration: 1, duration_unit: 't', underlying_symbol: '1HZ75V', barrier: String(barrier),
        } }),
        refreshContract: async contractId => {
            if (monitorAll) return monitorContract(contractId);
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
    if (monitorAll) runtime.pauseExecution();
    stream = createMirrorDerivStream({ runtime, getApi, journal, getExistingSubscription, getInitialTicks,
        initialHistoryTicks: strategy?.initialHistoryTicks || 0, onDisconnect: () => {
        attachVersion += 1;
        attached = false;
        runtime.pauseExecution();
        contractSubscriptions.clear();
        settlementMonitors.forEach(monitor => {
            const interrupted = new Error('Connection interrupted while checking a confirmed contract');
            interrupted.code = 'MIRROR_CONNECTION_INTERRUPTED';
            monitor.finish(interrupted);
        });
        if (runtime.pendingBuys()) runtime.stop('Connection lost while a purchase was unconfirmed');
    } });

    const attach = async () => {
        if (cleaned || attached) return;
        if (getAccount() !== account) return runtime.stop('The active account changed');
        attached = true;
        const version = ++attachVersion;
        try {
            // Reconcile already-confirmed contracts before accepting new ticks.
            const reconnectingContracts = [...runtime.tracker.active.values()];
            await Promise.all(reconnectingContracts.map(async contract => {
                const response = await request({ proposal_open_contract: 1, contract_id: contract.contract_id });
                runtime.settle(response?.proposal_open_contract);
            }));
            if (cleaned || version !== attachVersion) return;
            // Establish settlement monitoring before processing the initial
            // history and live ticks, so a fresh signal can be sent immediately.
            if (monitorAll && strategy?.initialHistoryTicks) {
                const api = getApi();
                await ensureContractStream(api, account, () => request({ proposal_open_contract: 1, subscribe: 1 }));
                if (cleaned || version !== attachVersion) return;
                runtime.resumeExecution();
            }
            await stream.attach();
            if (cleaned || version !== attachVersion) return;
            if (stream.whenReady) await stream.whenReady();
            if (cleaned || version !== attachVersion) return;
            if (monitorAll) {
                const api = getApi();
                await ensureContractStream(api, account, () => request({ proposal_open_contract: 1, subscribe: 1 }));
                if (cleaned || version !== attachVersion) return;
                reconnectingContracts.filter(contract => runtime.tracker.active.has(String(contract.contract_id))).forEach(contract => {
                    monitorContract(contract.contract_id).then(response => runtime.settle(response?.proposal_open_contract)).catch(error => {
                        if (error?.code !== 'MIRROR_CONNECTION_INTERRUPTED' && runtime.tracker.active.has(String(contract.contract_id))) {
                            runtime.stop('Could not confirm contract settlement; check account before restarting');
                        }
                    });
                });
                runtime.resumeExecution();
                return;
            }
            // Restore each tracked contract subscription when the API connection changes.
            await Promise.all(reconnectingContracts.filter(contract =>
                runtime.tracker.active.has(String(contract.contract_id))
            ).map(async contract => {
                const response = await request({ proposal_open_contract: 1, contract_id: contract.contract_id, subscribe: 1 });
                if (response?.subscription?.id) contractSubscriptions.set(String(contract.contract_id), { api: getApi(), subscriptionId: response.subscription.id });
                runtime.settle(response?.proposal_open_contract);
                checkCleanup();
            }));
            if (!cleaned && version === attachVersion) runtime.resumeExecution();
        } catch (error) {
            if (cleaned || version !== attachVersion) return;
            attached = false;
            runtime.stop(`Unable to restore the Deriv stream: ${error.message}`);
        }
    };
    const stop = reason => runtime.stop(reason || 'Stopped by user');
    return { attach, stop, finished, runtime, isCleaned: () => cleaned };
};
