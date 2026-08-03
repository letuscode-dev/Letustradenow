/* eslint-disable no-confusing-arrow */
import { Map } from 'immutable';
import { getLast, historyToTicks } from '../../utils/binary-utils';
import { observer as globalObserver } from '../../utils/observer';
import { doUntilDone, getUUID } from '../tradeEngine/utils/helpers';
import { api_base } from './api-base';

const parseTick = tick => ({
    epoch: +tick.epoch,
    quote: +tick.quote,
});

const parseOhlc = ohlc => ({
    open: +ohlc.open,
    high: +ohlc.high,
    low: +ohlc.low,
    close: +ohlc.close,
    epoch: +(ohlc.open_time || ohlc.epoch),
});

const parseCandles = candles => candles.map(t => parseOhlc(t));

const updateTicks = (ticks, newTick) => {
    if (!Array.isArray(ticks) || ticks.length === 0) {
        return [newTick];
    }
    if (getLast(ticks).epoch >= newTick.epoch) {
        return ticks;
    }
    // Grow until the Deriv history cap so a short AlreadySubscribed buffer can recover.
    if (ticks.length < 1000) {
        return [...ticks, newTick];
    }
    return [...ticks.slice(1), newTick];
};

const updateCandles = (candles, ohlc) => {
    const lastCandle = getLast(candles);
    if (
        (lastCandle.open === ohlc.open &&
            lastCandle.high === ohlc.high &&
            lastCandle.low === ohlc.low &&
            lastCandle.close === ohlc.close &&
            lastCandle.epoch === ohlc.epoch) ||
        lastCandle.epoch > ohlc.epoch
    ) {
        return candles;
    }
    const prevCandles = lastCandle.epoch === ohlc.epoch ? candles.slice(0, -1) : candles.slice(1);
    return [...prevCandles, ohlc];
};

const getType = isCandle => (isCandle ? 'candles' : 'ticks');

export default class TicksService {
    constructor() {
        this.ticks = new Map();
        this.candles = new Map();
        this.tickListeners = new Map();
        this.ohlcListeners = new Map();
        this.subscriptions = new Map();
        this.ticks_history_promise = null;
        this.active_symbols_promise = null;
        this.candles_promise = null;

        this.observe();
    }

    getCachedData(options) {
        const { symbol, granularity } = options;
        const style = getType(granularity);

        if (style === 'ticks' && this.ticks.has(symbol)) {
            return this.ticks.get(symbol);
        }

        if (style === 'candles' && this.candles.hasIn([symbol, Number(granularity)])) {
            return this.candles.getIn([symbol, Number(granularity)]);
        }

        return undefined;
    }

    getCachedTicks(symbol) {
        return this.ticks.get(symbol);
    }

    getLatestTick(symbol) {
        const ticks = this.getCachedTicks(symbol);

        return ticks?.length ? getLast(ticks) : undefined;
    }

    requestPipSizes() {
        if (this.pipSizes) {
            return Promise.resolve(this.pipSizes);
        }

        if (!this.active_symbols_promise) {
            this.active_symbols_promise = new Promise(resolve => {
                this.pipSizes = api_base.pip_sizes;
                resolve(this.pipSizes);
            });
        }
        return this.active_symbols_promise;
    }

    async request(options) {
        const { granularity } = options;
        const style = getType(granularity);
        const cached_data = this.getCachedData(options);

        if (cached_data !== undefined) {
            return cached_data;
        }

        return this.requestStream({ ...options, style });
    }

    monitor(options) {
        return new Promise((resolve, reject) => {
            const { symbol, granularity, callback } = options;

            const type = getType(granularity);

            const key = getUUID();
            this.request(options)
                .then(() => {
                    if (type === 'ticks') {
                        this.tickListeners = this.tickListeners.setIn([symbol, key], callback);
                        globalObserver.emit('bot.bot_ready');
                        api_base.toggleRunButton(false);
                    } else {
                        this.ohlcListeners = this.ohlcListeners.setIn([symbol, Number(granularity), key], callback);
                    }
                    resolve(key);
                })
                .catch(e => {
                    globalObserver.emit('Error', e);
                    this.ticks_history_promise = null;
                    api_base.toggleRunButton(false);
                    reject(e);
                });
        });
    }

    async stopMonitor(options) {
        const { symbol, granularity, key } = options;
        const type = getType(granularity);

        if (type === 'ticks' && this.tickListeners.hasIn([symbol, key])) {
            this.tickListeners = this.tickListeners.deleteIn([symbol, key]);
        }

        if (type === 'candles' && this.ohlcListeners.hasIn([symbol, Number(granularity), key])) {
            this.ohlcListeners = this.ohlcListeners.deleteIn([symbol, Number(granularity), key]);
        }

        await this.unsubscribeIfEmptyListeners(options);
    }

    async unsubscribeIfEmptyListeners(options) {
        const { symbol, granularity } = options;

        let needToUnsubscribe = false;

        const tickListener = this.tickListeners.get(symbol);

        if (tickListener && !tickListener.size) {
            this.tickListeners = this.tickListeners.delete(symbol);
            this.ticks = this.ticks.delete(symbol);
            needToUnsubscribe = true;
        }

        const ohlcListener = this.ohlcListeners.getIn([symbol, Number(granularity)]);

        if (ohlcListener && !ohlcListener.size) {
            this.ohlcListeners = this.ohlcListeners.deleteIn([symbol, Number(granularity)]);
            this.candles = this.candles.deleteIn([symbol, Number(granularity)]);
            needToUnsubscribe = true;
        }

        if (needToUnsubscribe) {
            await this.unsubscribeAllAndSubscribeListeners(symbol);
        }
    }

    unsubscribeAllAndSubscribeListeners(symbol) {
        const ohlcSubscriptions = this.subscriptions.getIn(['ohlc', symbol]);

        const subscription = [...(ohlcSubscriptions ? Array.from(ohlcSubscriptions.values()) : [])];

        Promise.all(subscription.map(id => doUntilDone(() => api_base.api.forget(id))));

        this.subscriptions = new Map();
    }

    updateTicksAndCallListeners(symbol, ticks) {
        if (this.ticks.get(symbol) === ticks) {
            return;
        }
        this.ticks = this.ticks.set(symbol, ticks);

        const listeners = this.tickListeners.get(symbol);

        if (listeners) {
            listeners.forEach(callback => callback(ticks));
        }
    }

    updateCandlesAndCallListeners(address, candles) {
        if (this.ticks.getIn(address) === candles) {
            return;
        }
        this.candles = this.candles.setIn(address, candles);

        const listeners = this.ohlcListeners.getIn(address);

        if (listeners) {
            listeners.forEach(callback => callback(candles));
        }
    }

    observe() {
        if (api_base.api) {
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'tick') {
                    const { tick } = data;
                    const { symbol, id } = tick;
                    if (this.ticks.has(symbol)) {
                        this.subscriptions = this.subscriptions.setIn(['tick', symbol], id);
                        this.updateTicksAndCallListeners(symbol, updateTicks(this.ticks.get(symbol), parseTick(tick)));
                    }
                }

                if (data.msg_type === 'ohlc') {
                    const { ohlc } = data;
                    const { symbol, granularity, id } = ohlc;
                    if (this.candles.hasIn([symbol, Number(granularity)])) {
                        this.subscriptions = this.subscriptions.setIn(['ohlc', symbol, Number(granularity)], id);
                        const address = [symbol, Number(granularity)];
                        this.updateCandlesAndCallListeners(
                            address,
                            updateCandles(this.candles.getIn(address), parseOhlc(ohlc))
                        );
                    }
                }
            });
            api_base.pushSubscription(subscription);
        }
    }

    requestStream(options) {
        const { style } = options;
        const stringified_options = JSON.stringify(options);

        if (style === 'ticks') {
            // Check if we already have a promise for these exact options
            if (!this.ticks_history_promise || this.ticks_history_promise.stringified_options !== stringified_options) {
                this.ticks_history_promise = {
                    promise: this.requestPipSizes().then(() => this.requestTicks(options)),
                    stringified_options,
                };
            }

            return this.ticks_history_promise.promise;
        }

        if (style === 'candles') {
            // Check if we already have a promise for these exact options
            if (!this.candles_promise || this.candles_promise.stringified_options !== stringified_options) {
                this.candles_promise = {
                    promise: this.requestPipSizes().then(() => this.requestTicks(options)),
                    stringified_options,
                };
            }

            return this.candles_promise.promise;
        }

        return [];
    }

    requestTicks(options) {
        const { symbol, granularity, style } = options;
        const request_object = {
            ticks_history: symbol === 'na' ? 'R_100' : symbol,
            subscribe: 1,
            end: 'latest',
            count: 1000,
            granularity: granularity ? Number(granularity) : undefined,
            style,
        };
        return new Promise((resolve, reject) => {
            if (!api_base.api) resolve([]);
            doUntilDone(() => api_base.api.send(request_object), ['AlreadySubscribed'], api_base)
                .then(r => {
                    if (style === 'ticks') {
                        const ticks = historyToTicks(r.history);

                        this.updateTicksAndCallListeners(symbol, ticks);
                        resolve(ticks);
                    } else {
                        const candles = parseCandles(r.candles);

                        this.updateCandlesAndCallListeners([symbol, Number(granularity)], candles);

                        resolve(candles);
                    }
                })
                .catch(error => {
                    // Handle AlreadySubscribed errors gracefully - they're not fatal
                    if (error?.error?.code === 'AlreadySubscribed') {
                        // For AlreadySubscribed errors, we can still resolve with existing data
                        if (style === 'ticks' && this.ticks.has(symbol)) {
                            resolve(this.ticks.get(symbol));
                        } else if (style === 'candles' && this.candles.hasIn([symbol, Number(granularity)])) {
                            resolve(this.candles.getIn([symbol, Number(granularity)]));
                        } else {
                            resolve([]);
                        }
                        return;
                    }
                    // Don't clear auth data for InvalidSymbol errors as it causes unwanted logouts
                    // InvalidSymbol errors can occur for various reasons and don't necessarily mean the user is unauthorized
                    reject(error);
                });
        });
    }

    /**
     * One-shot ticks_history fill (no subscribe, no retry loop).
     * Used when the live cache is shorter than a strategy window.
     * Concurrent callers share one in-flight promise; failed/short results
     * cool down so we do not spam Deriv with ticks_history retries.
     *
     * @param {string} symbol
     * @param {number} count
     * @returns {Promise<Array<{epoch:number, quote:number}>>}
     */
    requestHistoryFill(symbol, count = 1000) {
        const required = Math.max(1, Math.min(1000, Math.floor(Number(count)) || 1000));
        const cached = this.getCachedTicks(symbol);

        if (cached?.length >= required) {
            return Promise.resolve(cached);
        }

        if (!this._history_fill_promises) {
            this._history_fill_promises = new Map();
        }
        if (!this._history_fill_attempt_at) {
            this._history_fill_attempt_at = new Map();
        }

        const in_flight = this._history_fill_promises.get(symbol);
        if (in_flight) {
            return in_flight;
        }

        // Avoid hammering ticks_history when a recent fill already failed or returned short.
        const last_attempt_at = this._history_fill_attempt_at.get(symbol) || 0;
        if (Date.now() - last_attempt_at < 15000) {
            return Promise.resolve(cached || []);
        }

        if (!api_base.api) {
            return Promise.resolve(cached || []);
        }

        this._history_fill_attempt_at.set(symbol, Date.now());

        const request_object = {
            ticks_history: symbol === 'na' ? 'R_100' : symbol,
            end: 'latest',
            count: 1000,
            style: 'ticks',
        };

        const fill_promise = api_base.api
            .send(request_object)
            .then(r => {
                const history = historyToTicks(r.history);
                const existing = this.getCachedTicks(symbol) || [];

                if (!Array.isArray(history) || history.length === 0) {
                    return existing;
                }

                const last_history_epoch = Number(history[history.length - 1]?.epoch);
                const newer_live = Array.isArray(existing)
                    ? existing.filter(tick => Number(tick?.epoch) > last_history_epoch)
                    : [];
                const merged = [...history, ...newer_live].slice(-1000);
                this.updateTicksAndCallListeners(symbol, merged);
                return merged;
            })
            .catch(() => this.getCachedTicks(symbol) || [])
            .finally(() => {
                this._history_fill_promises.delete(symbol);
            });

        this._history_fill_promises.set(symbol, fill_promise);
        return fill_promise;
    }

    /**
     * Always fetch the newest `count` ticks for a symbol (no subscribe).
     * Used when a scan symbol cache is empty or its tip has gone stale.
     * Throttled to avoid RateLimit / RequestFailed storms.
     *
     * @param {string} symbol
     * @param {number} [count=5]
     * @param {number} [min_interval_ms=5000]
     * @param {boolean} [force=false] — refresh even if we think a live stream exists
     * @returns {Promise<Array<{epoch:number, quote:number}>>}
     */
    requestFreshTicks(symbol, count = 5, min_interval_ms = 5000, force = false) {
        const required = Math.max(1, Math.min(50, Math.floor(Number(count)) || 5));
        const cached = this.getCachedTicks(symbol) || [];

        // Live stream updating this cache — skip history unless forced (stale tip).
        if (!force && this.hasTickSubscription(symbol) && cached.length >= required) {
            return Promise.resolve(cached);
        }

        if (!this._fresh_tick_promises) {
            this._fresh_tick_promises = new Map();
        }
        if (!this._fresh_tick_at) {
            this._fresh_tick_at = new Map();
        }

        const in_flight = this._fresh_tick_promises.get(symbol);
        if (in_flight) {
            return in_flight;
        }

        const last_at = this._fresh_tick_at.get(symbol) || 0;
        const interval = Math.max(force ? 1200 : 2000, Math.floor(Number(min_interval_ms)) || 5000);
        if (Date.now() - last_at < interval) {
            return Promise.resolve(cached);
        }

        if (!api_base.api) {
            return Promise.resolve(cached);
        }

        this._fresh_tick_at.set(symbol, Date.now());

        const request_object = {
            ticks_history: symbol === 'na' ? 'R_100' : symbol,
            end: 'latest',
            count: required,
            style: 'ticks',
        };

        const fresh_promise = api_base.api
            .send(request_object)
            .then(r => {
                const history = historyToTicks(r.history);
                if (!Array.isArray(history) || history.length === 0) {
                    return this.getCachedTicks(symbol) || [];
                }

                const existing = this.getCachedTicks(symbol) || [];
                const last_history_epoch = Number(history[history.length - 1]?.epoch);
                const newer_live = Array.isArray(existing)
                    ? existing.filter(tick => Number(tick?.epoch) > last_history_epoch)
                    : [];
                const merged = [...history, ...newer_live].slice(-1000);
                this.updateTicksAndCallListeners(symbol, merged);
                this._noteScanTip(symbol);
                return merged;
            })
            .catch(() => this.getCachedTicks(symbol) || [])
            .finally(() => {
                this._fresh_tick_promises.delete(symbol);
            });

        this._fresh_tick_promises.set(symbol, fresh_promise);
        return fresh_promise;
    }

    _getTipEpoch(symbol) {
        const ticks = this.getCachedTicks(symbol);
        if (!ticks?.length) {
            return null;
        }
        const tip = ticks[ticks.length - 1];
        if (tip?.epoch != null && Number.isFinite(Number(tip.epoch))) {
            return Number(tip.epoch);
        }
        return tip ? `q:${tip.quote}` : null;
    }

    _noteScanTip(symbol) {
        if (!this._scan_tip_epoch) {
            this._scan_tip_epoch = new Map();
        }
        if (!this._scan_tip_seen_at) {
            this._scan_tip_seen_at = new Map();
        }
        const tip = this._getTipEpoch(symbol);
        if (tip == null) {
            return;
        }
        const prev = this._scan_tip_epoch.get(symbol);
        if (prev !== tip) {
            this._scan_tip_epoch.set(symbol, tip);
            this._scan_tip_seen_at.set(symbol, Date.now());
        } else if (!this._scan_tip_seen_at.has(symbol)) {
            this._scan_tip_seen_at.set(symbol, Date.now());
        }
    }

    /**
     * True when this symbol's tip advanced recently (live stream healthy).
     * @param {string} symbol
     * @param {number} [max_age_ms=2500]
     */
    isScanTipFresh(symbol, max_age_ms = 2500) {
        const tip = this._getTipEpoch(symbol);
        if (tip == null) {
            return false;
        }
        const prev = this._scan_tip_epoch?.get(symbol);
        if (prev !== tip) {
            this._noteScanTip(symbol);
            return true;
        }
        const seen_at = this._scan_tip_seen_at?.get(symbol);
        if (!seen_at) {
            this._noteScanTip(symbol);
            return false;
        }
        return Date.now() - seen_at < Math.max(1000, max_age_ms);
    }

    /**
     * Round-robin force-refresh for scan symbols whose tips stopped advancing.
     * At most one history call per invoke to stay under Deriv rate limits.
     *
     * @param {string[]} symbols
     * @param {string} [active_symbol]
     * @returns {Promise<void>}
     */
    refreshStaleScanCaches(symbols, active_symbol = '') {
        const list = Array.isArray(symbols) ? [...new Set(symbols.filter(Boolean))] : [];
        if (!list.length) {
            return Promise.resolve();
        }

        const now = Date.now();
        const stale = [];
        list.forEach(symbol => {
            if (symbol === active_symbol) {
                this._noteScanTip(symbol);
                return;
            }
            const ticks = this.getCachedTicks(symbol);
            if (!ticks?.length) {
                stale.push(symbol);
                return;
            }
            const tip = this._getTipEpoch(symbol);
            const prev = this._scan_tip_epoch?.get(symbol);
            if (tip != null && tip !== prev) {
                this._noteScanTip(symbol);
                return;
            }
            const seen_at = this._scan_tip_seen_at?.get(symbol) || 0;
            // 1s markets should move every ~1s; allow 2s before treating as stale.
            if (!seen_at || now - seen_at > 2000) {
                stale.push(symbol);
            }
        });

        if (!stale.length) {
            return Promise.resolve();
        }

        if (this._stale_rr == null) {
            this._stale_rr = 0;
        }
        const symbol = stale[this._stale_rr % stale.length];
        this._stale_rr += 1;

        if (!this._stale_refresh_tail) {
            this._stale_refresh_tail = Promise.resolve();
        }
        this._stale_refresh_tail = this._stale_refresh_tail
            .then(() => this.requestFreshTicks(symbol, 5, 1200, true))
            .then(() => {
                this._noteScanTip(symbol);
            })
            .catch(() => {});

        return this._stale_refresh_tail;
    }

    /**
     * Serially subscribe scan symbols so their tick caches keep updating without
     * firing a parallel ticks_history burst (which triggers RateLimit/RequestFailed).
     *
     * @param {string[]} symbols
     * @returns {Promise<void>}
     */
    warmScanStreams(symbols) {
        const list = Array.isArray(symbols) ? [...new Set(symbols.filter(Boolean))] : [];
        if (!list.length) {
            return Promise.resolve();
        }

        if (!this._scan_stream_keys) {
            this._scan_stream_keys = new Map();
        }
        if (!this._scan_warm_tail) {
            this._scan_warm_tail = Promise.resolve();
        }

        list.forEach(symbol => {
            // Skip only when we have a marked stream AND the tip is still advancing.
            if (this._scan_stream_keys.has(symbol) && this.isScanTipFresh(symbol, 3000)) {
                return;
            }
            // Dead "warmed" mark — clear so we can re-subscribe / recover.
            if (this._scan_stream_keys.has(symbol) && !this.isScanTipFresh(symbol, 3000)) {
                const dead_key = this._scan_stream_keys.get(symbol);
                if (dead_key && this.tickListeners.hasIn([symbol, dead_key])) {
                    this.tickListeners = this.tickListeners.deleteIn([symbol, dead_key]);
                }
                this._scan_stream_keys.delete(symbol);
            }
            this._scan_warm_tail = this._scan_warm_tail
                .then(() => this._warmOneScanStream(symbol))
                .catch(() => {});
        });

        return this._scan_warm_tail;
    }

    /**
     * @param {string} symbol
     * @returns {Promise<Array<{epoch:number, quote:number}>>}
     */
    async _warmOneScanStream(symbol) {
        if (!symbol) {
            return [];
        }
        if (this._scan_stream_keys?.has(symbol) && this.isScanTipFresh(symbol, 3000)) {
            return this.getCachedTicks(symbol) || [];
        }

        // Stagger subscriptions — Deriv rate-limits parallel ticks_history.
        await new Promise(resolve => setTimeout(resolve, 400));

        if (!api_base.api) {
            return this.getCachedTicks(symbol) || [];
        }

        const request_object = {
            ticks_history: symbol === 'na' ? 'R_100' : symbol,
            subscribe: 1,
            end: 'latest',
            count: 25,
            style: 'ticks',
        };

        let subscribed = false;
        try {
            const response = await api_base.api.send(request_object);
            const history = historyToTicks(response?.history);
            if (Array.isArray(history) && history.length) {
                this.updateTicksAndCallListeners(symbol, history);
            }
            if (response?.subscription?.id) {
                this.subscriptions = this.subscriptions.setIn(['tick', symbol], response.subscription.id);
                subscribed = true;
            }
        } catch (e) {
            // AlreadySubscribed / RateLimit — do not pretend we own a live stream.
            const code = e?.error?.code || e?.code;
            if (code === 'AlreadySubscribed' && this.subscriptions.getIn(['tick', symbol])) {
                subscribed = true;
            }
        }

        // Seed cache with a one-shot if subscribe did not populate ticks.
        if (!(this.getCachedTicks(symbol)?.length)) {
            try {
                await this.requestFreshTicks(symbol, 5, 0, true);
            } catch (e) {
                // ignore
            }
        }

        const has_cache = Boolean(this.getCachedTicks(symbol)?.length);
        // Only mark warmed when we truly subscribed or at least seeded a cache.
        // Failed marks caused permanent frozen tips (e.g. 1HZ100V stuck).
        if (!subscribed && !has_cache) {
            return [];
        }

        const key = getUUID();
        this.tickListeners = this.tickListeners.setIn([symbol, key], () => {});
        if (!this._scan_stream_keys) {
            this._scan_stream_keys = new Map();
        }
        this._scan_stream_keys.set(symbol, key);
        this._noteScanTip(symbol);

        return this.getCachedTicks(symbol) || [];
    }

    /**
     * True when we already track a live tick subscription id for this symbol,
     * or when the bot/chart already registered tick listeners (stream is owned elsewhere).
     * @param {string} symbol
     * @returns {boolean}
     */
    hasTickSubscription(symbol) {
        if (this._scan_stream_keys?.has(symbol)) {
            return true;
        }
        if (this.subscriptions.getIn(['tick', symbol])) {
            return true;
        }
        const listeners = this.tickListeners.get(symbol);
        return Boolean(listeners && listeners.size);
    }

    /**
     * Ensure a live ticks stream is active. Safe to call often — no-ops when a
     * subscription or monitor listener already exists. Never retries in a loop.
     *
     * @param {string} symbol
     * @returns {Promise<Array<{epoch:number, quote:number}>>}
     */
    ensureTickSubscription(symbol) {
        if (!symbol) {
            return Promise.resolve([]);
        }

        if (this.hasTickSubscription(symbol)) {
            return Promise.resolve(this.getCachedTicks(symbol) || []);
        }

        if (!this._ensure_sub_promises) {
            this._ensure_sub_promises = new Map();
        }
        const in_flight = this._ensure_sub_promises.get(symbol);
        if (in_flight) {
            return in_flight;
        }

        const sub_promise = this.requestTicks({ symbol, style: 'ticks' })
            .then(() => this.getCachedTicks(symbol) || [])
            .catch(() => this.getCachedTicks(symbol) || [])
            .finally(() => {
                this._ensure_sub_promises.delete(symbol);
            });

        this._ensure_sub_promises.set(symbol, sub_promise);
        return sub_promise;
    }

    forget = () => {
        return new Promise((resolve, reject) => {
            if (api_base?.api) {
                try {
                    api_base.api
                        .forgetAll('ticks')
                        .then(() => {
                            resolve();
                        })
                        .catch(reject);
                } catch (e) {
                    console.log('Error in forget ticks', e);
                }
            } else {
                resolve();
            }
        });
    };

    forgetCandleSubscription = () => {
        return new Promise((resolve, reject) => {
            if (api_base?.api) {
                try {
                    api_base.api
                        .forgetAll('candles')
                        .then(() => {
                            resolve();
                        })
                        .catch(reject);
                } catch (e) {
                    console.log('Error in forget candles', e);
                }
            } else {
                resolve();
            }
        });
    };

    unsubscribeFromTicksService() {
        return new Promise((resolve, reject) => {
            this.forget()
                .then(() => {
                    try {
                        this.forgetCandleSubscription()
                            .then(() => {
                                resolve();
                            })
                            .catch(reject);
                    } catch (e) {
                        console.log('Error in unsubscribeFromTicksService', e);
                    }
                })
                .catch(reject);
            this.ticks_history_promise = null;
        });
    }
}
