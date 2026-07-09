import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy, tradeOptionToOverrideBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let delayIndex = 0;
let purchase_reference;

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
            throw error;
        }

        purchaseDirect(contract_type, purchase_builder = tradeOptionToBuy) {
            const trade_option = purchase_builder(contract_type, this.tradeOptions);
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

            return this.purchaseDirect(contract_type, tradeOptionToOverrideBuy);
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

                const action = () => api_base.api.send({ buy: id, price: askPrice });

                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: askPrice,
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
