import { applyMiddleware, createStore } from 'redux';
import { thunk } from 'redux-thunk';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { createError } from '../../../utils/error';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { checkBlocksForProposalRequest, doUntilDone } from '../utils/helpers';
import { HEDGE_LIMIT_NONE } from '../utils/digit-hedge';
import { expectInitArg } from '../utils/sanitize';
import { proposalsReady, start } from './state/actions';
import rootReducer from './state/reducers';
import Balance from './Balance';
import OpenContract from './OpenContract';
import Proposal from './Proposal';
import Purchase from './Purchase';
import Sell from './Sell';
import Ticks from './Ticks';
import Total from './Total';
import { resetWatchTick, settledBeforeReentry, watchBefore, watchDuring } from './watch-scope';
import { BEFORE_PURCHASE } from './state/constants';

export default class TradeEngine extends Balance(Purchase(Sell(OpenContract(Proposal(Ticks(Total(class {}))))))) {
    constructor($scope) {
        super();
        this.observer = $scope.observer;
        this.$scope = $scope;
        this.observe();
        this.data = {
            contract: {},
            proposals: [],
        };
        this.subscription_id_for_accumulators = null;
        this.is_proposal_requested_for_accumulators = false;
        this.store = createStore(rootReducer, applyMiddleware(thunk));
    }

    init(...args) {
        const [token, options] = expectInitArg(args);
        const { symbol } = options;

        this.initArgs = args;
        this.options = options;
        this.digitHedgeHalt = false;
        this.digitHedgeLimitAction = HEDGE_LIMIT_NONE;
        this.digitHedgeImmediate = false;
        this.digitHedgeImmediateUsed = false;
        this.catchEveryTick = false;
        resetWatchTick();
        this.digitHedgeOverBarrier = 5;
        this.digitHedgeUnderBarrier = 4;
        this.onlyUpsDownsTip = '';
        this.onlyUpsDownsTradedTip = '';
        this.startPromise = this.loginAndGetBalance(token);

        if (!this.checkTicksPromiseExists()) this.watchTicks(symbol);
    }

    start(tradeOptions) {
        if (!this.options) {
            throw createError('NotInitialized', getLocalizedErrorMessage('NotInitialized'));
        }

        globalObserver.emit('bot.running');

        const validated_trade_options = this.validateTradeOptions(tradeOptions);

        this.tradeOptions = { ...validated_trade_options, symbol: this.options.symbol };
        this.resetPurchaseAttempt?.();
        this.isSold = false;
        this.store.dispatch(start());
        this.checkLimits(validated_trade_options);

        this.makeDirectPurchaseDecision();
    }

    loginAndGetBalance(token) {
        if (this.token === token) {
            return Promise.resolve();
        }
        // for strategies using total runs, GetTotalRuns function is trying to get loginid and it gets called before Proposals calls.
        // the below required loginid to be set in Proposal calls where loginAndGetBalance gets resolved.
        // Earlier this used to happen as soon as we get ticks_history response and by the time GetTotalRuns gets called we have required info.
        this.accountInfo = api_base.account_info;
        this.token = api_base.token;
        if (!api_base.api) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            // Try to recover from a situation where API doesn't give us a correct response on
            // "proposal_open_contract" which would make the bot run forever. When there's a "sell"
            // event, wait a couple seconds for the API to give us the correct "proposal_open_contract"
            // response, if there's none after x seconds. Send an explicit request, which _should_
            // solve the issue. This is a backup!
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'transaction' && data.transaction.action === 'sell') {
                    this.transaction_recovery_timeout = setTimeout(() => {
                        const { contract } = this.data;
                        const is_same_contract = contract.contract_id === data.transaction.contract_id;
                        const is_open_contract = contract.status === 'open';
                        if (is_same_contract && is_open_contract) {
                            doUntilDone(() => {
                                api_base.api.send({ proposal_open_contract: 1, contract_id: contract.contract_id });
                            }, ['PriceMoved']);
                        }
                    }, 1500);
                }
            });
            api_base.pushSubscription(subscription);
            resolve();
        });
    }

    observe() {
        this.observeOpenContract();
        this.observeBalance();
        this.observeProposals();
    }

    watch(watchName) {
        if (watchName === 'before') {
            const { scope } = this.store.getState();
            if (settledBeforeReentry(scope, this.isSold)) {
                return Promise.resolve(false);
            }
            // A both-sides loss can buy again without waiting for the next tick.
            if (scope === BEFORE_PURCHASE && this.digitHedgeImmediate && !this.digitHedgeImmediateUsed && !this.digitHedgeHalt) {
                this.digitHedgeImmediateUsed = true;
                return Promise.resolve(true);
            }
            return watchBefore(this.store, this.catchEveryTick);
        }
        return watchDuring(this.store);
    }

    makeDirectPurchaseDecision() {
        const { has_payout_block, is_basis_payout } = checkBlocksForProposalRequest();
        this.is_proposal_subscription_required = has_payout_block || is_basis_payout;

        if (this.is_proposal_subscription_required) {
            this.makeProposals({ ...this.options, ...this.tradeOptions });
            this.checkProposalReady();
        } else {
            this.store.dispatch(proposalsReady());
        }
    }
}
