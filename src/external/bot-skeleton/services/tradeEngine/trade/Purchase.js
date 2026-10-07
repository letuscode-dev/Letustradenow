import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { observer as globalObserver } from '../../../utils/observer';
import { LogTypes } from '../../../constants/messages';
import { createError } from '../../../utils/error';
import { api_base } from '../../api/api-base';
import {
    openAdaptiveDigitGapActiveTrade,
    releaseAdaptiveDigitGapActiveTrade,
} from '../utils/adaptive-digit-gap';
import { contractStatus, info, log, notify } from '../utils/broadcast';
import {
    buildDigitOverProposal,
    buildDigitUnderProposal,
    canAffordBothLegs,
    DIGIT_HEDGE_OPEN,
    planDigitHedgeBuys,
} from '../utils/digit-hedge';
import {
    openConditionalEvenOddActiveTrade,
    releaseConditionalEvenOddActiveTrade,
} from '../utils/conditional-even-odd-differs';
import {
    openConditionalHighLowActiveTrade,
    releaseConditionalHighLowActiveTrade,
} from '../utils/conditional-high-low-differs';
import {
    doUntilDone,
    getUUID,
    recoverFromError,
    toBuyPrice,
    tradeOptionToBuy,
    tradeOptionToOverrideBuy,
    tradeOptionToOverrideProposal,
} from '../utils/helpers';
import {
    openIncreasingDigitGapActiveTrade,
    releaseIncreasingDigitGapActiveTrade,
} from '../utils/increasing-digit-gap';
import {
    openLongAbsenceReturnActiveTrade,
    releaseLongAbsenceReturnActiveTrade,
} from '../utils/long-absence-return-differs';
import {
    createRiseFallHedgeState,
    dayKey,
    FALL,
    newLeg,
    RISE,
} from '../utils/rise-fall-hedge';
import { notifyHedge, settleHedgeInBackground } from '../utils/rise-fall-hedge-runtime';
import {
    openSignalScoreDiffersActiveTrade,
    releaseSignalScoreDiffersActiveTrade,
} from '../utils/signal-score-differs';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let delayIndex = 0;
let purchase_reference;

const DURATION_UNIT_ORDER = {
    t: 0,
    s: 1,
    m: 2,
    h: 3,
    d: 4,
};

const SINGLE_BARRIER_OVERRIDE_CONTRACT_TYPES = ['ONETOUCH', 'NOTOUCH'];
const DOUBLE_BARRIER_OVERRIDE_CONTRACT_TYPES = ['EXPIRYRANGE', 'EXPIRYMISS', 'RANGE', 'UPORDOWN'];

const parseDuration = duration => {
    const match = `${duration || ''}`.match(/^(\d+)([a-z])$/i);

    if (!match) {
        return { value: Number.MAX_SAFE_INTEGER, unit: 'z' };
    }

    return {
        value: Number(match[1]),
        unit: match[2],
    };
};

const getExpectedBarrierCount = contract_type => {
    if (SINGLE_BARRIER_OVERRIDE_CONTRACT_TYPES.includes(contract_type)) {
        return 1;
    }

    if (DOUBLE_BARRIER_OVERRIDE_CONTRACT_TYPES.includes(contract_type)) {
        return 2;
    }

    return undefined;
};

const getDurationScore = contract => {
    const { value, unit } = parseDuration(contract.min_contract_duration);
    const unit_order = DURATION_UNIT_ORDER[unit] ?? Number.MAX_SAFE_INTEGER;

    return unit_order * 100000 + value;
};

const selectOverrideContractConfig = (contract_type, contracts = []) => {
    const candidates = contracts.filter(contract => contract.contract_type === contract_type);
    const expected_barrier_count = getExpectedBarrierCount(contract_type);

    return candidates.sort((a, b) => {
        const a_barrier_score =
            expected_barrier_count === undefined || Number(a.barriers) === expected_barrier_count ? 0 : 1;
        const b_barrier_score =
            expected_barrier_count === undefined || Number(b.barriers) === expected_barrier_count ? 0 : 1;

        return a_barrier_score - b_barrier_score || getDurationScore(a) - getDurationScore(b);
    })[0];
};

export default Engine =>
    class Purchase extends Engine {
        handlePurchaseSuccess(response, contract_type) {
            // Don't unnecessarily send a forget request for a purchased contract.
            const { buy } = response;

            contractStatus({
                id: 'contract.purchase_received',
                data: buy.transaction_id,
                buy,
            });

            this.contractId = buy.contract_id;
            this.last_buy = buy;
            this.store.dispatch(purchaseSuccessful());
            openAdaptiveDigitGapActiveTrade(this.adaptiveDigitGapState);
            openIncreasingDigitGapActiveTrade(this.increasingDigitGapState);
            openSignalScoreDiffersActiveTrade(this.signalScoreDiffersState);
            openLongAbsenceReturnActiveTrade(this.longAbsenceReturnState);
            openConditionalEvenOddActiveTrade(this.conditionalEvenOddState);
            openConditionalHighLowActiveTrade(this.conditionalHighLowState);

            if (this.is_proposal_subscription_required) {
                this.renewProposalsOnPurchase();
            }

            delayIndex = 0;
            log(LogTypes.PURCHASE, {
                longcode: buy.longcode,
                transaction_id: buy.transaction_id,
            });
            info({
                accountID: this.accountInfo.loginid,
                totalRuns: this.updateAndReturnTotalRuns(),
                transaction_ids: { buy: buy.transaction_id },
                contract_type,
                buy_price: buy.buy_price,
            });
        }

        resetPurchaseAttempt() {
            this.is_purchase_attempt_in_progress = false;
        }

        canAttemptPurchase(contract_type) {
            return (
                !!contract_type &&
                this.store.getState().scope === BEFORE_PURCHASE &&
                !this.is_purchase_attempt_in_progress
            );
        }

        markPurchaseAttempt() {
            this.is_purchase_attempt_in_progress = true;
        }

        resetPurchaseAttemptOnError(error) {
            this.resetPurchaseAttempt();
            // Purchase never opened — free Adaptive Digit Gap to signal again.
            releaseAdaptiveDigitGapActiveTrade(this.adaptiveDigitGapState);
            releaseIncreasingDigitGapActiveTrade(this.increasingDigitGapState);
            releaseSignalScoreDiffersActiveTrade(this.signalScoreDiffersState);
            releaseLongAbsenceReturnActiveTrade(this.longAbsenceReturnState);
            releaseConditionalEvenOddActiveTrade(this.conditionalEvenOddState);
            releaseConditionalHighLowActiveTrade(this.conditionalHighLowState);
            throw error;
        }

        getOverrideContractConfig(contract_type) {
            const symbol = this.tradeOptions?.symbol || this.options?.symbol;

            if (!api_base.api || !symbol) {
                return Promise.resolve();
            }

            if (!this.override_contracts_for_symbol || this.override_contracts_for_symbol.symbol !== symbol) {
                this.override_contracts_for_symbol = {
                    symbol,
                    promise: api_base.api
                        .send({ contracts_for: symbol })
                        .then(response => response?.contracts_for?.available || [])
                        .catch(error => {
                            if (this.override_contracts_for_symbol?.symbol === symbol) {
                                this.override_contracts_for_symbol = null;
                            }
                            throw error;
                        }),
                };
            }

            return this.override_contracts_for_symbol.promise.then(contracts =>
                selectOverrideContractConfig(contract_type, contracts)
            );
        }

        purchaseDirect(contract_type, purchase_builder = tradeOptionToBuy, purchase_builder_options) {
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                this.resetPurchaseAttempt();
                return Promise.resolve();
            }

            const trade_option = purchase_builder(contract_type, this.tradeOptions, purchase_builder_options);
            const action = () => api_base.api.send(trade_option);

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: this.tradeOptions.amount,
            });

            if (!this.options.timeMachineEnabled) {
                return doUntilDone(action)
                    .then(response => this.handlePurchaseSuccess(response, contract_type))
                    .catch(error => this.resetPurchaseAttemptOnError(error));
            }

            return recoverFromError(
                action,
                (errorCode, makeDelay) => {
                    if (errorCode === 'DisconnectError') {
                        this.clearProposals();
                    }
                    this.resetPurchaseAttempt();
                    const unsubscribe = this.store.subscribe(() => {
                        const { scope } = this.store.getState();
                        if (scope === BEFORE_PURCHASE) {
                            makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                            unsubscribe();
                        }
                    });
                },
                ['PriceMoved', 'InvalidContractProposal'],
                delayIndex++
            )
                .then(response => this.handlePurchaseSuccess(response, contract_type))
                .catch(error => this.resetPurchaseAttemptOnError(error));
        }

        purchaseOverrideContractType(contract_type) {
            if (!this.canAttemptPurchase(contract_type)) {
                return Promise.resolve();
            }

            this.markPurchaseAttempt();

            return this.getOverrideContractConfig(contract_type)
                .catch(() => undefined)
                .then(contract_config => {
                    // Prefer proposal → buy(id). Direct buy(parameters) is stricter and
                    // was rejecting digit overrides (Under/Over/etc.) with InputValidationFailed.
                    const proposal_request = tradeOptionToOverrideProposal(
                        contract_type,
                        this.tradeOptions,
                        contract_config,
                        this.getPurchaseReference()
                    );

                    if (!proposal_request?.underlying_symbol || !proposal_request?.currency) {
                        return this.purchaseDirect(contract_type, tradeOptionToOverrideBuy, contract_config);
                    }

                    if (this.store.getState().scope !== BEFORE_PURCHASE) {
                        this.resetPurchaseAttempt();
                        return Promise.resolve();
                    }

                    this.isSold = false;
                    contractStatus({
                        id: 'contract.purchase_sent',
                        data: this.tradeOptions.amount,
                    });

                    const action = () =>
                        api_base.api.send(proposal_request).then(proposal_response => {
                            if (proposal_response?.error) {
                                throw proposal_response;
                            }

                            const proposal = proposal_response?.proposal;
                            if (!proposal?.id) {
                                throw proposal_response || new Error('InvalidContractProposal');
                            }

                            const price = toBuyPrice(
                                proposal.ask_price,
                                proposal.display_value,
                                this.tradeOptions?.amount
                            );

                            if (price === undefined) {
                                throw createError(
                                    'InputValidationFailed',
                                    getLocalizedErrorMessage('AmountValidationFailed')
                                );
                            }

                            return api_base.api.send({
                                buy: proposal.id,
                                price,
                            });
                        });

                    return doUntilDone(action)
                        .then(response => this.handlePurchaseSuccess(response, contract_type))
                        .catch(error => this.resetPurchaseAttemptOnError(error));
                });
        }

        purchase(contract_type) {
            if (!this.canAttemptPurchase(contract_type)) {
                return Promise.resolve();
            }

            this.markPurchaseAttempt();

            if (this.is_proposal_subscription_required) {
                let proposal;

                try {
                    proposal = this.selectProposal(contract_type);
                } catch (error) {
                    this.resetPurchaseAttempt();
                    return Promise.reject(error);
                }

                const { id, askPrice } = proposal;
                const price = toBuyPrice(askPrice, this.tradeOptions?.amount);

                if (price === undefined) {
                    this.resetPurchaseAttempt();
                    return Promise.reject(
                        createError('InputValidationFailed', getLocalizedErrorMessage('AmountValidationFailed'))
                    );
                }

                const action = () => api_base.api.send({ buy: id, price });

                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: price,
                });

                if (!this.options.timeMachineEnabled) {
                    return doUntilDone(action)
                        .then(response => this.handlePurchaseSuccess(response, contract_type))
                        .catch(error => this.resetPurchaseAttemptOnError(error));
                }

                return recoverFromError(
                    action,
                    (errorCode, makeDelay) => {
                        // if disconnected no need to resubscription (handled by live-api)
                        if (errorCode !== 'DisconnectError') {
                            this.renewProposalsOnPurchase();
                        } else {
                            this.clearProposals();
                        }

                        this.resetPurchaseAttempt();
                        const unsubscribe = this.store.subscribe(() => {
                            const { scope, proposalsReady } = this.store.getState();
                            if (scope === BEFORE_PURCHASE && proposalsReady) {
                                makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                                unsubscribe();
                            }
                        });
                    },
                    ['PriceMoved', 'InvalidContractProposal'],
                    delayIndex++
                )
                    .then(response => this.handlePurchaseSuccess(response, contract_type))
                    .catch(error => this.resetPurchaseAttemptOnError(error));
            }

            return this.purchaseDirect(contract_type);
        }
        /**
         * Rise/Fall Hedge: Rise goes through the normal purchase (tracked by the engine,
         * After Purchase runs when it settles) and Fall is bought from the live PUT
         * proposal in the same instant. Neither order waits for the other.
         */
        purchaseRiseFallHedge() {
            if (!this.canAttemptPurchase(RISE)) {
                return Promise.resolve();
            }
            if (!this.riseFallHedgeState) this.riseFallHedgeState = createRiseFallHedgeState();
            const state = this.riseFallHedgeState;
            const stake = Number(this.tradeOptions?.amount);

            let fall_proposal;
            try {
                this.selectProposal(RISE);
                fall_proposal = this.selectProposal(FALL);
            } catch (error) {
                return Promise.reject(error);
            }
            const quote = type =>
                Number(
                    this.data.proposals.find(
                        p => p.contract_type === type && p.purchase_reference === this.getPurchaseReference()
                    )?.payout
                );

            const now = Date.now();
            const hedge = {
                id: state.hedges.reduce((m, h) => Math.max(m, h.id), 0) + 1,
                symbol: this.tradeOptions?.symbol,
                day: dayKey(now),
                created_at: now,
                duration: Number(this.tradeOptions?.duration),
                status: 'BUYING',
                rise: { ...newLeg('RISE', stake), quoted_payout: quote(RISE) },
                fall: { ...newLeg('FALL', stake), quoted_payout: quote(FALL) },
                entry: state.pending_entry || null,
            };
            state.pending_entry = null;
            state.current = hedge;
            state.last_hedge_at = now;
            state.ticks_since_last = 0;

            const message = e => e?.error?.message || e?.message || 'Purchase failed.';
            this.last_buy = null;

            hedge.rise.order_sent_at = Date.now();
            const rise_promise = this.purchase(RISE).then(
                () => {
                    const buy = this.last_buy;
                    if (!buy) {
                        Object.assign(hedge.rise, { status: 'FAILED', error: 'Rise was not bought.' });
                        return new Error('Rise was not bought.');
                    }
                    Object.assign(hedge.rise, {
                        status: 'OPEN',
                        order_confirmed_at: Date.now(),
                        contract_id: buy.contract_id,
                        purchase_time: buy.start_time,
                        stake: Number(buy.buy_price ?? stake),
                        quoted_payout: Number(buy.payout ?? hedge.rise.quoted_payout),
                    });
                    return true;
                },
                error => {
                    Object.assign(hedge.rise, { status: 'FAILED', order_confirmed_at: Date.now(), error: message(error) });
                    return error;
                }
            );

            hedge.fall.order_sent_at = Date.now();
            const fall_promise = api_base.api
                .send({ buy: fall_proposal.id, price: toBuyPrice(fall_proposal.askPrice, stake) })
                .then(response => {
                    if (response?.error || !response?.buy) {
                        throw response?.error ? response : new Error('Fall purchase was not confirmed.');
                    }
                    Object.assign(hedge.fall, {
                        status: 'OPEN',
                        order_confirmed_at: Date.now(),
                        contract_id: response.buy.contract_id,
                        purchase_time: response.buy.start_time,
                        stake: Number(response.buy.buy_price ?? stake),
                        quoted_payout: Number(response.buy.payout ?? hedge.fall.quoted_payout),
                    });
                    return true;
                })
                .catch(error => {
                    Object.assign(hedge.fall, { status: 'FAILED', order_confirmed_at: Date.now(), error: message(error) });
                    return false;
                });

            return Promise.all([rise_promise, fall_promise]).then(async ([rise_result, fall_ok]) => {
                const rise_ok = rise_result === true;
                if (rise_ok && fall_ok) {
                    hedge.status = 'OPEN';
                    notifyHedge(
                        `HEDGE #${hedge.id} OPEN — Rise ${hedge.rise.contract_id} + Fall ${hedge.fall.contract_id} | gap ${Math.abs(
                            hedge.rise.order_confirmed_at - hedge.fall.order_confirmed_at
                        )} ms`
                    );
                    return;
                }
                if (!rise_ok && !fall_ok) {
                    hedge.status = 'ABORTED';
                    hedge.failure = `Both legs failed — Rise: ${hedge.rise.error} | Fall: ${hedge.fall.error}`;
                    state.hedges.push(hedge);
                    state.current = null;
                    notifyHedge(`HEDGE #${hedge.id} FAILED — ${hedge.failure}`, 'journal__text--error');
                    throw rise_result;
                }

                const live_label = rise_ok ? 'Rise' : 'Fall';
                const live = rise_ok ? hedge.rise : hedge.fall;
                hedge.failure = `${rise_ok ? 'Fall' : 'Rise'} leg failed: ${(rise_ok ? hedge.fall : hedge.rise).error}`;
                hedge.policy_applied = `${live_label} allowed to run (policy B).`;
                if (state.settings.incomplete_policy === 'CANCEL') {
                    try {
                        const sold = await api_base.api.send({ sell: live.contract_id, price: 0 });
                        if (sold?.error) throw sold;
                        live.status = 'CANCELLED';
                        live.note = 'cancelled after the other leg failed';
                        hedge.policy_applied = `${live_label} cancelled (sold for ${Number(sold.sell?.sold_for ?? 0).toFixed(2)}).`;
                    } catch (error) {
                        hedge.policy_applied = `${live_label} could not be cancelled (${message(error)}) — it runs to expiry.`;
                    }
                }
                hedge.status = 'OPEN';
                notifyHedge(`HEDGE #${hedge.id} INCOMPLETE — ${hedge.failure}. ${hedge.policy_applied}`, 'journal__text--warn');

                if (!rise_ok) {
                    // The engine bought nothing, so After Purchase will not run: settle Fall here.
                    settleHedgeInBackground(state);
                    throw rise_result;
                }
            });
        }

        /**
         * Over 5 and Under 4 are one trade. Both are quoted first. Neither buy is
         * sent unless both quotes exist and the balance covers both. A hedge is
         * registered only when both buys return a contract. A single fill is
         * sold off. If that sell fails, the bot stops instead of trading on one side.
         */
        purchaseDigitHedge() {
            if (this.digitHedgeHalt || this.digitHedgeLimitAction === 'take_profit' || this.digitHedgeLimitAction === 'stop_loss') {
                return Promise.resolve();
            }
            if (!this.canAttemptPurchase('DIGITOVER')) {
                return Promise.resolve();
            }

            this.markPurchaseAttempt();
            this.digitHedge = null;
            this.last_buy = null;
            this.isSold = false;

            const stake = Number(this.tradeOptions?.amount);
            const trade = {
                ...this.tradeOptions,
                currency: this.tradeOptions?.currency || api_base.account_info?.currency,
            };
            const message = error => error?.error?.message || error?.message || 'Purchase failed.';
            const release = note => {
                this.digitHedge = null;
                this.resetPurchaseAttempt();
                if (note) notify('journal__text--warn', note);
            };
            const halt = note => {
                this.digitHedge = null;
                this.digitHedgeHalt = true;
                this.resetPurchaseAttempt();
                notify('journal__text--error', note);
                globalObserver.emit('bot.stop_button_click');
            };

            if (!Number.isFinite(stake) || stake <= 0) {
                release(`Hedge was not sent. Stake ${this.tradeOptions?.amount} is not a positive amount.`);
                return Promise.resolve();
            }

            const over_request = buildDigitOverProposal(trade);
            const under_request = buildDigitUnderProposal(trade);
            if (
                over_request.contract_type !== 'DIGITOVER' ||
                String(over_request.barrier) !== '5' ||
                under_request.contract_type !== 'DIGITUNDER' ||
                String(under_request.barrier) !== '4'
            ) {
                release('Hedge was not sent. Over 5 and Under 4 must be bought together.');
                return Promise.resolve();
            }

            const quote = request =>
                doUntilDone(() => api_base.api.send(request)).then(response => {
                    const proposal = response?.proposal;
                    if (response?.error || !proposal?.id) {
                        throw response?.error ? response : new Error('Proposal was not quoted.');
                    }
                    const price = toBuyPrice(proposal.ask_price, proposal.display_value, stake);
                    if (price === undefined) {
                        throw new Error('Price was not quoted.');
                    }
                    return { id: proposal.id, price };
                });
            const buyQuoted = quoted =>
                api_base.api.send({ buy: quoted.id, price: quoted.price }).then(response => {
                    if (response?.error || !response?.buy?.contract_id) {
                        throw response?.error ? response : new Error('Contract was not bought.');
                    }
                    return response;
                });
            const cancelIds = async ids => {
                const failed = [];
                for (const contract_id of ids) {
                    try {
                        const sold = await api_base.api.send({ sell: contract_id, price: 0 });
                        if (sold?.error) throw sold.error;
                    } catch (error) {
                        failed.push(`${contract_id} (${message(error)})`);
                    }
                }
                return failed;
            };
            const abandon = async (plan, why) => {
                const failed = await cancelIds(plan.cancel_ids);
                if (failed.length) {
                    halt(
                        `Hedge stopped. A one-sided contract could not be cancelled (${failed.join(
                            ', '
                        )}). No further trades will be sent.`
                    );
                    return;
                }
                const closed = plan.cancel_ids.length
                    ? 'The filled side was closed. Stake unchanged.'
                    : 'Nothing was bought. Stake unchanged.';
                release(`Hedge was not opened on both sides. ${closed} ${why}`);
            };

            return Promise.all([
                quote(over_request).then(
                    quoted => ({ ok: true, quoted }),
                    error => ({ ok: false, error })
                ),
                quote(under_request).then(
                    quoted => ({ ok: true, quoted }),
                    error => ({ ok: false, error })
                ),
            ]).then(async ([over_quote, under_quote]) => {
                if (!over_quote.ok || !under_quote.ok) {
                    await abandon(
                        planDigitHedgeBuys({
                            over_quoted: false,
                            under_quoted: false,
                            over_contract_id: null,
                            under_contract_id: null,
                        }),
                        `${over_quote.ok ? '' : `Over 5 was not quoted (${message(over_quote.error)}). `}${
                            under_quote.ok ? '' : `Under 4 was not quoted (${message(under_quote.error)}).`
                        }`
                    );
                    return;
                }

                let balance;
                try {
                    balance = this.getBalance?.();
                } catch {
                    balance = undefined;
                }
                if (!canAffordBothLegs(balance, over_quote.quoted.price, under_quote.quoted.price)) {
                    release(
                        `Hedge was not sent. Balance ${balance} does not cover Over 5 (${over_quote.quoted.price}) and Under 4 (${under_quote.quoted.price}) together.`
                    );
                    return;
                }

                const [over_buy, under_buy] = await Promise.all([
                    buyQuoted(over_quote.quoted).then(
                        response => ({ ok: true, response }),
                        error => ({ ok: false, error })
                    ),
                    buyQuoted(under_quote.quoted).then(
                        response => ({ ok: true, response }),
                        error => ({ ok: false, error })
                    ),
                ]);
                const plan = planDigitHedgeBuys({
                    over_quoted: true,
                    under_quoted: true,
                    over_contract_id: over_buy.ok ? over_buy.response.buy.contract_id : null,
                    under_contract_id: under_buy.ok ? under_buy.response.buy.contract_id : null,
                });
                if (plan.action !== DIGIT_HEDGE_OPEN) {
                    await abandon(
                        plan,
                        `Over: ${over_buy.ok ? 'bought' : message(over_buy.error)}. Under: ${
                            under_buy.ok ? 'bought' : message(under_buy.error)
                        }.`
                    );
                    return;
                }

                this.digitHedge = {
                    under_bought: true,
                    under_contract_id: plan.under_contract_id,
                    over_contract_id: plan.over_contract_id,
                    stake,
                    over_error: '',
                    under_error: '',
                };
                this.handlePurchaseSuccess(over_buy.response, 'DIGITOVER');
                this.digitHedgeImmediate = false;
                this.digitHedgeImmediateUsed = false;
                // A 1-tick contract can sell before this id is tracked. Ask for it
                // now so After Purchase still runs if that push was missed.
                api_base.api.send({ proposal_open_contract: 1, contract_id: plan.over_contract_id }).catch(() => {});
                notify(
                    'journal__text--success',
                    `HEDGE OPEN — Over 5 ${plan.over_contract_id} + Under 4 ${plan.under_contract_id} | stake ${stake} each`
                );
            });
        }

        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
