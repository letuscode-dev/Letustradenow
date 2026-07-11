import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import {
    doUntilDone,
    getUUID,
    recoverFromError,
    toBuyPrice,
    tradeOptionToBuy,
    tradeOptionToOverrideBuy,
    tradeOptionToOverrideProposal,
} from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';
import { createError } from '../../../utils/error';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import {
    openAdaptiveDigitGapActiveTrade,
    releaseAdaptiveDigitGapActiveTrade,
} from '../utils/adaptive-digit-gap';

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
            this.store.dispatch(purchaseSuccessful());
            openAdaptiveDigitGapActiveTrade(this.adaptiveDigitGapState);

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
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
