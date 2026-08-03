/* eslint-disable no-promise-executor-return */
import debounce from 'lodash.debounce';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { localize } from '@deriv-com/translations';
import { getLast } from '../../../utils/binary-utils';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { getDirection, getLastDigit } from '../utils/helpers';
import { expectPositiveInteger } from '../utils/sanitize';
import * as constants from './state/constants';

let tickListenerKey;

export default Engine =>
    class Ticks extends Engine {
        async watchTicks(symbol) {
            if (symbol && this.symbol !== symbol) {
                this.symbol = symbol;
                const { ticksService } = this.$scope;

                await ticksService.stopMonitor({
                    symbol,
                    key: tickListenerKey,
                });
                const callback = ticks => {
                    if (this.is_proposal_subscription_required) {
                        this.checkProposalReady();
                    }
                    const lastTick = getLast(ticks);
                    const { epoch } = lastTick;
                    this.store.dispatch({ type: constants.NEW_TICK, payload: epoch });
                };

                const key = await ticksService.monitor({ symbol, callback });
                tickListenerKey = key;
            }
        }

        checkTicksPromiseExists() {
            return this.$scope.ticksService.ticks_history_promise;
        }

        getTicks(toString = false) {
            if (!this.symbol) {
                return Promise.resolve([]);
            }

            return this.$scope.ticksService.request({ symbol: this.symbol }).then(ticks => {
                return ticks.map(tick => {
                    if (toString) {
                        return tick.quote.toFixed(this.getPipSize());
                    }
                    return tick.quote;
                });
            });
        }

        getLastTick(raw, toString = false) {
            const formatTick = tick => {
                let last_tick = raw ? tick : tick.quote;
                if (!raw && toString) {
                    last_tick = last_tick.toFixed(this.getPipSize());
                }
                return last_tick;
            };
            const latest_tick = this.$scope.ticksService.getLatestTick(this.symbol);

            if (latest_tick) {
                return Promise.resolve(formatTick(latest_tick));
            }

            return this.$scope.ticksService
                .request({ symbol: this.symbol })
                .then(ticks => formatTick(getLast(ticks)))
                .catch(e => {
                    if (e.code === 'MarketIsClosed') {
                        const localizedError = {
                            ...e,
                            message: getLocalizedErrorMessage(e.code, e.details),
                        };
                        globalObserver.emit('Error', localizedError);
                        return e.code;
                    }
                    throw e;
                });
        }

        getLastDigit() {
            return new Promise(resolve => this.getLastTick(false, true).then(tick => resolve(getLastDigit(tick))));
        }

        requestLastDigitList() {
            if (!this.symbol) {
                return Promise.resolve([]);
            }

            return new Promise(resolve => this.getTicks().then(ticks => resolve(this.getLastDigitsFromList(ticks))));
        }

        getLastDigitList() {
            const cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);

            if (cached_ticks?.length) {
                return Promise.resolve(this.getLastDigitsFromList(cached_ticks));
            }

            return this.requestLastDigitList();
        }

        getLiveLastDigitList(minimum_tick_count = 1) {
            const cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);
            const requested_tick_count = Math.floor(Number(minimum_tick_count));
            const required_tick_count = Number.isFinite(requested_tick_count) ? Math.max(1, requested_tick_count) : 1;

            if (cached_ticks?.length >= required_tick_count) {
                return Promise.resolve(this.getLastDigitsFromList(cached_ticks));
            }

            return Promise.resolve([]);
        }

        getCachedLastDigitList(minimum_tick_count = 1) {
            const cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);
            const requested_tick_count = Math.floor(Number(minimum_tick_count));
            const required_tick_count = Number.isFinite(requested_tick_count) ? Math.max(1, requested_tick_count) : 1;

            if (cached_ticks?.length >= required_tick_count) {
                return this.getLastDigitsFromList(cached_ticks);
            }

            return [];
        }

        /**
         * Ensure at least `minimum_tick_count` ticks are available.
         * Uses the live cache when it is already long enough (no API call).
         * Only requests a one-shot history fill when the buffer is short.
         * Does not re-subscribe on every call — the bot's watchTicks owns the stream.
         *
         * @param {number} minimum_tick_count
         * @returns {Promise<number[]>} last-digit list (oldest → newest)
         */
        async ensureTickHistory(minimum_tick_count = 100) {
            if (!this.symbol) {
                return [];
            }

            const required = Math.max(1, Math.min(1000, Math.floor(Number(minimum_tick_count)) || 100));
            let cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);

            if (cached_ticks?.length >= required) {
                return this.getLastDigitsFromList(cached_ticks);
            }

            if (typeof this.$scope.ticksService.requestHistoryFill === 'function') {
                cached_ticks = await this.$scope.ticksService.requestHistoryFill(this.symbol, required);
            } else {
                const ticks = await this.$scope.ticksService.requestTicks({
                    symbol: this.symbol,
                    style: 'ticks',
                });
                if (Array.isArray(ticks) && ticks.length) {
                    cached_ticks = ticks;
                }
            }

            const refreshed = this.$scope.ticksService.getCachedTicks(this.symbol) || cached_ticks;
            return refreshed?.length ? this.getLastDigitsFromList(refreshed) : [];
        }

        /**
         * All currently cached last digits for the active symbol (may be shorter
         * than a requested window). Unlike getCachedLastDigitList, never returns
         * [] solely because the buffer is still growing.
         *
         * When `limit` is set, only the newest `limit` ticks are mapped — avoids
         * remapping a full 1000-tick cache on every block evaluation.
         *
         * @param {number} [limit]
         * @returns {number[]}
         */
        getAvailableLastDigitList(limit) {
            const cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);
            if (!cached_ticks?.length) {
                return [];
            }
            const n = Math.floor(Number(limit));
            const ticks =
                Number.isFinite(n) && n > 0 ? cached_ticks.slice(-Math.min(n, cached_ticks.length)) : cached_ticks;
            return this.getLastDigitsFromList(ticks);
        }

        /**
         * Cheap tip identity for digit-percentage snapshotting (epoch of newest tick).
         * @returns {string}
         */
        getLatestTickTipKey() {
            const latest = this.$scope.ticksService.getLatestTick(this.symbol);
            if (latest && latest.epoch != null) {
                return String(latest.epoch);
            }
            const cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);
            return cached_ticks?.length ? `len:${cached_ticks.length}` : 'empty';
        }

        /**
         * Digits paired with tick epochs — needed for sliding-window caches
         * where array length stops growing after history fills.
         */
        getCachedDigitTicks() {
            const cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);
            if (!cached_ticks?.length) {
                return [];
            }

            const pip_size = this.getPipSize();
            return cached_ticks.map(tick => {
                const quote = typeof tick === 'object' && tick !== null ? tick.quote : tick;
                const numeric_quote = Number(quote);
                const epoch = typeof tick === 'object' && tick !== null ? Number(tick.epoch) : NaN;

                return {
                    epoch,
                    digit: Number.isFinite(numeric_quote)
                        ? getLastDigit(numeric_quote.toFixed(pip_size))
                        : NaN,
                };
            });
        }
        getLastDigitsFromList(ticks) {
            const digits = ticks.map(tick => {
                const quote = typeof tick === 'object' && tick !== null ? tick.quote : tick;
                const numeric_quote = Number(quote);

                if (!Number.isFinite(numeric_quote)) {
                    return NaN;
                }

                return getLastDigit(numeric_quote.toFixed(this.getPipSize()));
            });
            return digits;
        }

        /**
         * Last digits for an arbitrary symbol (does not change the active stream).
         * Uses that symbol's pip size when known; otherwise the quote's last char.
         *
         * @param {Array<{quote?:number,epoch?:number}|number>} ticks
         * @param {string} symbol
         * @returns {number[]}
         */
        getLastDigitsFromListForSymbol(ticks, symbol) {
            if (!Array.isArray(ticks) || !ticks.length) {
                return [];
            }
            const pip_raw = this.$scope?.ticksService?.pipSizes?.[symbol];
            const pip_size = Number.isFinite(Number(pip_raw)) ? Number(pip_raw) : null;

            return ticks.map(tick => {
                const quote = typeof tick === 'object' && tick !== null ? tick.quote : tick;
                const numeric_quote = Number(quote);
                if (!Number.isFinite(numeric_quote)) {
                    return NaN;
                }
                if (pip_size !== null) {
                    return getLastDigit(numeric_quote.toFixed(pip_size));
                }
                return getLastDigit(String(numeric_quote));
            });
        }

        /**
         * Ensure at least `count` digits are available for `symbol` (one-shot fill).
         * Does not switch the bot's active trading symbol.
         *
         * @param {string} symbol
         * @param {number} [count=5]
         * @returns {Promise<number[]>}
         */
        async getDigitsForSymbol(symbol, count = 5) {
            if (!symbol) {
                return [];
            }
            const required = Math.max(1, Math.min(1000, Math.floor(Number(count)) || 5));
            let ticks = this.$scope.ticksService.getCachedTicks(symbol);

            if (!ticks?.length || ticks.length < required) {
                if (typeof this.$scope.ticksService.requestHistoryFill === 'function') {
                    ticks = await this.$scope.ticksService.requestHistoryFill(symbol, required);
                } else {
                    ticks = await this.$scope.ticksService.requestTicks({
                        symbol,
                        style: 'ticks',
                    });
                }
            }

            const refreshed = this.$scope.ticksService.getCachedTicks(symbol) || ticks || [];
            const digits = this.getLastDigitsFromListForSymbol(refreshed, symbol);
            return digits.length > required ? digits.slice(-required) : digits;
        }

        /**
         * Switch the active trading symbol (options + live tick watch).
         * Updates the Trade Definition market dropdown when Blockly is present.
         *
         * @param {string} symbol
         * @returns {Promise<string>}
         */
        async switchTradeSymbol(symbol) {
            const next = String(symbol || '').trim();
            if (!next) {
                return this.symbol || '';
            }
            if (this.options) {
                this.options = { ...this.options, symbol: next };
            }
            if (this.data) {
                this.data.proposals = [];
            }
            await this.watchTicks(next);

            try {
                const Blockly = typeof window !== 'undefined' ? window.Blockly : null;
                const workspace = Blockly?.derivWorkspace;
                if (workspace) {
                    const market_block = workspace
                        .getAllBlocks(true)
                        .find(block => block.type === 'trade_definition_market');
                    if (market_block?.getField('SYMBOL_LIST')) {
                        market_block.setFieldValue(next, 'SYMBOL_LIST');
                    }
                }
            } catch (e) {
                // UI update is best-effort — trading uses options.symbol.
            }

            return next;
        }

        checkDirection(dir) {
            const cached_ticks = this.$scope.ticksService.getCachedTicks(this.symbol);

            if (cached_ticks?.length >= 2) {
                return Promise.resolve(getDirection(cached_ticks) === dir);
            }

            return this.$scope.ticksService.request({ symbol: this.symbol }).then(ticks => getDirection(ticks) === dir);
        }

        getOhlc(args) {
            const { granularity = this.options.candleInterval || 60, field } = args || {};

            return new Promise(resolve =>
                this.$scope.ticksService
                    .request({ symbol: this.symbol, granularity })
                    .then(ohlc => resolve(field ? ohlc.map(o => o[field]) : ohlc))
            );
        }

        getOhlcFromEnd(args) {
            const { index: i = 1 } = args || {};

            const index = expectPositiveInteger(Number(i), localize('Index must be a positive integer'));

            return new Promise(resolve => this.getOhlc(args).then(ohlc => resolve(ohlc.slice(-index)[0])));
        }

        getPipSize() {
            return this.$scope.ticksService.pipSizes?.[this.symbol] ?? 0;
        }

        async requestAccumulatorStats() {
            const subscription_id = this.subscription_id_for_accumulators;
            const is_proposal_requested = this.is_proposal_requested_for_accumulators;
            const proposal_request = {
                ...window.Blockly.accumulators_request,
                amount: this?.tradeOptions?.amount,
                basis: this?.tradeOptions?.basis,
                contract_type: 'ACCU',
                currency: this?.tradeOptions?.currency,
                growth_rate: this?.tradeOptions?.growth_rate,
                proposal: 1,
                subscribe: 1,
                underlying_symbol: this?.tradeOptions?.symbol,
            };
            if (!subscription_id && !is_proposal_requested) {
                this.is_proposal_requested_for_accumulators = true;
                if (proposal_request) {
                    await api_base?.api?.send(proposal_request);
                }
            }
        }

        async handleOnMessageForAccumulators() {
            let ticks_stayed_in_list = [];
            return new Promise(resolve => {
                const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                    if (data.msg_type === 'proposal') {
                        try {
                            this.subscription_id_for_accumulators = data.subscription.id;
                            // this was done because we can multile arrays in the respone and the list comes in reverse order
                            const stat_list = (data.proposal.contract_details.ticks_stayed_in || []).flat().reverse();
                            ticks_stayed_in_list = [...stat_list, ...ticks_stayed_in_list];
                            if (ticks_stayed_in_list.length > 0) resolve(ticks_stayed_in_list);
                        } catch (error) {
                            globalObserver.emit('Unexpected message type or no proposal found:', error);
                        }
                    }
                });
                api_base.pushSubscription(subscription);
            });
        }

        async fetchStatsForAccumulators() {
            try {
                // request stats for accumulators
                const debouncedAccumulatorsRequest = debounce(() => this.requestAccumulatorStats(), 300);
                debouncedAccumulatorsRequest();
                // wait for proposal response
                const ticks_stayed_in_list = await this.handleOnMessageForAccumulators();
                return ticks_stayed_in_list;
            } catch (error) {
                globalObserver.emit('Error in subscription promise:', error);
                throw error;
            } finally {
                // forget all proposal subscriptions so we can fetch new stats data on new call
                await api_base?.api?.send({ forget_all: 'proposal' });
                this.is_proposal_requested_for_accumulators = false;
                this.subscription_id_for_accumulators = null;
            }
        }

        async getCurrentStat() {
            try {
                const ticks_stayed_in = await this.fetchStatsForAccumulators();
                return ticks_stayed_in?.[0];
            } catch (error) {
                globalObserver.emit('Error fetching current stat:', error);
            }
        }

        async getStatList() {
            try {
                const ticks_stayed_in = await this.fetchStatsForAccumulators();
                // we need to send only lastest 100 ticks
                return ticks_stayed_in?.slice(0, 100);
            } catch (error) {
                globalObserver.emit('Error fetching current stat:', error);
            }
        }

        async getDelayTickValue(tick_value) {
            return new Promise((resolve, reject) => {
                try {
                    const ticks = [];
                    const symbol = this.symbol;

                    const resolveAndExit = () => {
                        this.$scope.ticksService.stopMonitor({
                            symbol,
                            key: '',
                        });
                        resolve(ticks);
                        ticks.length = 0;
                    };

                    const watchTicks = tick_list => {
                        ticks.push(tick_list);
                        const current_tick = ticks.length;
                        if (current_tick === tick_value) {
                            resolveAndExit();
                        }
                    };

                    const delayExecution = tick_list => watchTicks(tick_list);

                    if (Number(tick_value) <= 0) resolveAndExit();
                    this.$scope.ticksService.monitor({ symbol, callback: delayExecution });
                } catch (error) {
                    reject(new Error(`Failed to start tick monitoring: ${error.message}`));
                }
            });
        }
    };
