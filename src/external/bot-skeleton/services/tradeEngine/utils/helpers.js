import { findValueByKeyRecursively, formatTime, getRoundedNumber, isEmptyObject } from '@/components/shared';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { config } from '@/external/bot-skeleton/constants';
import { localize } from '@deriv-com/translations';
import { observer as globalObserver } from '../../../utils/observer';
import { error as logError } from './broadcast';

const DEFAULT_DIGIT_PREDICTION = 5;
const DEFAULT_SELECTED_TICK = 1;
const DEFAULT_BARRIER_OFFSET = '+1';
const DEFAULT_SECOND_BARRIER_OFFSET = '-1';
const DEFAULT_MULTIPLIER = 100;
const DEFAULT_GROWTH_RATE = 0.01;
const DEFAULT_BARRIER_RANGE = 'middle';

const DIGIT_BARRIER_CONTRACT_TYPES = ['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER'];
const SELECTED_TICK_CONTRACT_TYPES = ['TICKHIGH', 'TICKLOW'];
const FIVE_TICK_CONTRACT_TYPES = ['ASIANU', 'ASIAND', 'TICKHIGH', 'TICKLOW', 'ONETOUCH', 'NOTOUCH'];
const TWO_TICK_CONTRACT_TYPES = ['RUNHIGH', 'RUNLOW'];
const SINGLE_BARRIER_CONTRACT_TYPES = ['ONETOUCH', 'NOTOUCH'];
const DOUBLE_BARRIER_CONTRACT_TYPES = ['EXPIRYRANGE', 'EXPIRYMISS', 'RANGE', 'UPORDOWN'];
const RESET_CONTRACT_TYPES = ['RESETCALL', 'RESETPUT'];
const SPREAD_CONTRACT_TYPES = ['CALLSPREAD', 'PUTSPREAD'];
const MULTIPLIER_CONTRACT_TYPES = ['MULTUP', 'MULTDOWN'];
const ACCUMULATOR_CONTRACT_TYPES = ['ACCU'];

const hasValue = value => value !== undefined && value !== null && value !== '';

const removeEmptyFields = obj => {
    Object.keys(obj).forEach(key => {
        if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
            delete obj[key];
        } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            removeEmptyFields(obj[key]);
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        }
    });

    return obj;
};

const toNumber = (value, fallback) => {
    const numeric_value = Number(value);
    return Number.isFinite(numeric_value) ? numeric_value : fallback;
};

const toInteger = (value, fallback) => {
    const numeric_value = Number(value);
    return Number.isFinite(numeric_value) ? Math.trunc(numeric_value) : fallback;
};

const toBarrierString = value => {
    if (!hasValue(value)) {
        return undefined;
    }

    return `${value}`;
};

const getDigitPredictionBounds = contract_type => {
    if (contract_type === 'DIGITUNDER') {
        return { min: 1, max: 9 };
    }
    if (contract_type === 'DIGITOVER') {
        return { min: 0, max: 8 };
    }
    return { min: 0, max: 9 };
};

const durationToTradeOption = duration => {
    const match = `${duration || ''}`.match(/^(\d+)([a-z])$/i);

    if (!match) {
        return {};
    }

    return {
        duration: Number(match[1]),
        duration_unit: match[2],
    };
};

const applyContractDuration = (trade_option, contract_config) => {
    const duration = durationToTradeOption(contract_config?.min_contract_duration);

    if (hasValue(duration.duration) && duration.duration_unit) {
        trade_option.duration = duration.duration;
        trade_option.duration_unit = duration.duration_unit;
    }
};

const getContractBarrier = (contract_config, fallback) =>
    hasValue(contract_config?.barrier) ? contract_config.barrier : fallback;

const getContractHighBarrier = (contract_config, fallback) =>
    hasValue(contract_config?.high_barrier) ? contract_config.high_barrier : fallback;

const getContractLowBarrier = (contract_config, fallback) =>
    hasValue(contract_config?.low_barrier) ? contract_config.low_barrier : fallback;

const getBoundedInteger = (value, fallback, min, max) => {
    const numeric_value = Number(value);

    if (!Number.isFinite(numeric_value)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, Math.floor(numeric_value)));
};

/**
 * Build a DerivWS-safe proposal/buy field set.
 * Schema requires: barrier as string, amount/duration/price as numbers,
 * selected_tick only for TICKHIGH/TICKLOW, and no unknown properties.
 */
const buildContractParameters = (contract_type, trade_option) => {
    const parameters = {
        amount: toNumber(trade_option.amount, undefined),
        basis: trade_option.basis,
        contract_type,
        currency: trade_option.currency,
        duration: toInteger(trade_option.duration, undefined),
        duration_unit: trade_option.duration_unit,
        // Partner DerivWS options endpoint (api.derivws.com/trading/v1/options)
        // requires underlying_symbol and rejects symbol. Public ws.derivws.com is the opposite.
        underlying_symbol: trade_option.symbol,
    };

    if (SELECTED_TICK_CONTRACT_TYPES.includes(contract_type) && hasValue(trade_option.prediction)) {
        parameters.selected_tick = toInteger(trade_option.prediction, DEFAULT_SELECTED_TICK);
    } else if (hasValue(trade_option.prediction)) {
        parameters.barrier = toBarrierString(trade_option.prediction);
    } else if (hasValue(trade_option.barrierOffset)) {
        parameters.barrier = toBarrierString(trade_option.barrierOffset);
    }

    if (hasValue(trade_option.secondBarrierOffset)) {
        parameters.barrier2 = toBarrierString(trade_option.secondBarrierOffset);
    }

    if (MULTIPLIER_CONTRACT_TYPES.includes(contract_type)) {
        parameters.duration = undefined;
        parameters.duration_unit = undefined;
        parameters.multiplier = toNumber(trade_option.multiplier, DEFAULT_MULTIPLIER);
        if (!isEmptyObject(trade_option.limit_order)) {
            parameters.limit_order = trade_option.limit_order;
        }
    }

    if (ACCUMULATOR_CONTRACT_TYPES.includes(contract_type)) {
        parameters.duration = undefined;
        parameters.duration_unit = undefined;
        parameters.growth_rate = toNumber(trade_option.growth_rate, DEFAULT_GROWTH_RATE);
        if (!isEmptyObject(trade_option.limit_order)) {
            parameters.limit_order = trade_option.limit_order;
        }
    }

    return removeEmptyFields(parameters);
};

export const tradeOptionToProposal = (trade_option, purchase_reference) =>
    trade_option.contractTypes.map(type => {
        const parameters = buildContractParameters(type, trade_option);

        return removeEmptyFields({
            ...parameters,
            proposal: 1,
            passthrough: {
                contract_type: type,
                purchase_reference,
            },
        });
    });

export const normalizeTradeOptionForOverride = (contract_type, trade_option, contract_config) => {
    const normalized_trade_option = {
        ...trade_option,
        basis: hasValue(trade_option.basis) ? trade_option.basis : 'stake',
        duration: hasValue(trade_option.duration) ? toInteger(trade_option.duration, 1) : 1,
        duration_unit: hasValue(trade_option.duration_unit) ? trade_option.duration_unit : 't',
        amount: toNumber(trade_option.amount, undefined),
        prediction: undefined,
        barrierOffset: undefined,
        secondBarrierOffset: undefined,
        limit_order: {},
        multiplier: undefined,
        growth_rate: undefined,
        barrier_range: undefined,
    };

    applyContractDuration(normalized_trade_option, contract_config);

    if (!contract_config && FIVE_TICK_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.duration = 5;
        normalized_trade_option.duration_unit = 't';
    }

    if (!contract_config && TWO_TICK_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.duration = 2;
        normalized_trade_option.duration_unit = 't';
    }

    if (DIGIT_BARRIER_CONTRACT_TYPES.includes(contract_type)) {
        const { min, max } = getDigitPredictionBounds(contract_type);
        const fallback = getBoundedInteger(DEFAULT_DIGIT_PREDICTION, DEFAULT_DIGIT_PREDICTION, min, max);
        normalized_trade_option.prediction = `${getBoundedInteger(trade_option.prediction, fallback, min, max)}`;
    } else if (SELECTED_TICK_CONTRACT_TYPES.includes(contract_type)) {
        const selected_tick_max = normalized_trade_option.duration || 5;

        normalized_trade_option.prediction = getBoundedInteger(
            trade_option.prediction,
            DEFAULT_SELECTED_TICK,
            1,
            selected_tick_max
        );
    } else if (DOUBLE_BARRIER_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.barrierOffset = getContractHighBarrier(
            contract_config,
            hasValue(trade_option.barrierOffset) ? trade_option.barrierOffset : DEFAULT_BARRIER_OFFSET
        );
        normalized_trade_option.secondBarrierOffset = getContractLowBarrier(
            contract_config,
            hasValue(trade_option.secondBarrierOffset) ? trade_option.secondBarrierOffset : DEFAULT_SECOND_BARRIER_OFFSET
        );
    } else if (SINGLE_BARRIER_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.barrierOffset = getContractBarrier(
            contract_config,
            hasValue(trade_option.barrierOffset) ? trade_option.barrierOffset : DEFAULT_BARRIER_OFFSET
        );
    } else if (SPREAD_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.basis = 'payout';
        normalized_trade_option.barrier_range = trade_option.barrier_range || DEFAULT_BARRIER_RANGE;
    } else if (RESET_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.barrierOffset = undefined;
    } else if (TWO_TICK_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.barrierOffset = undefined;
    }

    if (MULTIPLIER_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.basis = 'stake';
        normalized_trade_option.duration = undefined;
        normalized_trade_option.duration_unit = undefined;
        normalized_trade_option.limit_order = trade_option.limit_order;
        normalized_trade_option.multiplier = hasValue(trade_option.multiplier)
            ? trade_option.multiplier
            : DEFAULT_MULTIPLIER;
    }

    if (ACCUMULATOR_CONTRACT_TYPES.includes(contract_type)) {
        normalized_trade_option.basis = 'stake';
        normalized_trade_option.duration = undefined;
        normalized_trade_option.duration_unit = undefined;
        normalized_trade_option.limit_order = trade_option.limit_order;
        normalized_trade_option.growth_rate = hasValue(trade_option.growth_rate)
            ? trade_option.growth_rate
            : DEFAULT_GROWTH_RATE;
    }

    return normalized_trade_option;
};

export const tradeOptionToBuy = (contract_type, trade_option) => {
    const parameters = buildContractParameters(contract_type, trade_option);

    return removeEmptyFields({
        buy: '1',
        price: toNumber(trade_option.amount, parameters.amount),
        parameters,
    });
};

export const tradeOptionToOverrideBuy = (contract_type, trade_option, contract_config) =>
    tradeOptionToBuy(contract_type, normalizeTradeOptionForOverride(contract_type, trade_option, contract_config));

export const tradeOptionToOverrideProposal = (contract_type, trade_option, contract_config, purchase_reference) => {
    const normalized = normalizeTradeOptionForOverride(contract_type, trade_option, contract_config);
    return tradeOptionToProposal({ ...normalized, contractTypes: [contract_type] }, purchase_reference)[0];
};

export const getDirection = ticks => {
    const { length } = ticks;
    const [tickOld, tickNew] = ticks.slice(-2);

    let direction = '';
    if (length >= 2) {
        direction = tickOld.quote < tickNew.quote ? 'rise' : direction;
        direction = tickOld.quote > tickNew.quote ? 'fall' : direction;
    }

    return direction;
};

export const getLastDigit = tick => {
    let number_string = tick;
    if (typeof number_string === 'number') {
        number_string = String(number_string);
    }
    return Number(number_string[number_string.length - 1]);
};

export const getLastDigitForList = (tick, pip_size = 0) => {
    const value = Number(tick).toFixed(pip_size);
    return value[value.length - 1];
};

const getBackoffDelayInMs = (error_obj, delay_index) => {
    const base_delay = 2.5;
    const max_delay = 15;
    const next_delay_in_seconds = Math.min(base_delay * delay_index, max_delay);

    const { error = {}, msg_type = '', echo_req = {} } = error_obj;
    const { code = '', message = '' } = error;
    let message_to_print = '';
    const trade_type_block = Blockly.derivWorkspace
        .getAllBlocks(true)
        .find(block => block.type === 'trade_definition_tradetype');
    const selected_trade_type = trade_type_block?.getFieldValue('TRADETYPECAT_LIST') || '';
    const { TRADE_TYPE_CATEGORY_NAMES } = config();

    if (code) {
        const error_details = {
            message_type: error.msg_type,
            delay: next_delay_in_seconds,
            request: echo_req?.req_id,
            message: message || localize('The market is closed'),
            trade_type: TRADE_TYPE_CATEGORY_NAMES?.[selected_trade_type] ?? '',
        };

        switch (code) {
            case 'RateLimit':
                message_to_print = getLocalizedErrorMessage('RateLimit', error_details);
                break;
            case 'DisconnectError':
                message_to_print = getLocalizedErrorMessage('DisconnectError', error_details);
                break;
            case 'MarketIsClosed':
                message_to_print = getLocalizedErrorMessage('MarketIsClosed', error_details);
                break;

            default:
                message_to_print = getLocalizedErrorMessage('RequestFailed', {
                    message_type: msg_type || localize('unknown'),
                    delay: next_delay_in_seconds,
                });
                break;
        }
    } else {
        message_to_print = getLocalizedErrorMessage('RequestFailed', {
            message_type: msg_type || localize('unknown'),
            delay: next_delay_in_seconds,
        });
    }

    logError(message_to_print);

    return next_delay_in_seconds * 1000;
};

const formatInputValidationDetails = details => {
    if (!details || typeof details !== 'object') {
        return '';
    }

    const fields = Object.keys(details);
    if (!fields.length) {
        return '';
    }

    return ` (${fields.join(', ')})`;
};

export const updateErrorMessage = error => {
    if (error.error?.code === 'InputValidationFailed') {
        if (error.error.details?.duration) {
            error.error.message = getLocalizedErrorMessage('DurationValidationFailed');
        } else if (error.error.details?.amount) {
            error.error.message = getLocalizedErrorMessage('AmountValidationFailed');
        } else if (error.error.message && /Properties not allowed|Input validation failed/i.test(error.error.message)) {
            // Keep Deriv's concrete validation message (e.g. rejected field names).
            error.error.message = error.error.message;
        } else {
            error.error.message = `${getLocalizedErrorMessage('InputValidationFailed')}${formatInputValidationDetails(
                error.error.details
            )}`;
        }
    }
};

export const shouldThrowError = (error, errors_to_ignore = []) => {
    if (!error.error) {
        return false;
    }

    const default_errors_to_ignore = [
        'CallError',
        'WrongResponse',
        'GetProposalFailure',
        'RateLimit',
        'DisconnectError',
        'MarketIsClosed',
    ];
    updateErrorMessage(error);
    const is_ignorable_error = errors_to_ignore
        .concat(default_errors_to_ignore)
        .includes(error?.error?.code ?? error?.name);

    return !is_ignorable_error;
};

export const recoverFromError = (promiseFn, recoverFn, errors_to_ignore, delay_index, api_base) => {
    return new Promise((resolve, reject) => {
        const promise = promiseFn();

        if (promise) {
            promise.then(resolve).catch(error => {
                /**
                 * if bot is not running there is no point of recovering from error
                 * `!api_base.is_running` will check the bot status if it is not running it will kick out the control from loop
                 */
                if (shouldThrowError(error, errors_to_ignore) || (api_base && !api_base.is_running)) {
                    // Check if this is a position limit exceeded error
                    if (error?.error?.code === 'OpenPositionLimitExceeded') {
                        // Emit click_stop event to trigger the stopBot method in run-panel-store
                        setTimeout(() => {
                            globalObserver.emit('bot.stop_button_click');
                        }, 500);
                    }

                    reject(error);
                    return;
                }
                recoverFn(
                    error?.error?.code ?? error?.name,
                    () =>
                        new Promise(recoverResolve => {
                            const getGlobalTimeouts = () => globalObserver.getState('global_timeouts') ?? [];

                            const timeout = setTimeout(
                                () => {
                                    const global_timeouts = getGlobalTimeouts();
                                    delete global_timeouts[timeout];
                                    globalObserver.setState(global_timeouts);
                                    recoverResolve();
                                },
                                getBackoffDelayInMs(error, delay_index)
                            );

                            const global_timeouts = getGlobalTimeouts();
                            const cancellable_timeouts = ['buy'];
                            const msg_type = findValueByKeyRecursively(error, 'msg_type');

                            global_timeouts[timeout] = {
                                is_cancellable: cancellable_timeouts.includes(msg_type),
                                msg_type,
                            };

                            globalObserver.setState({ global_timeouts });
                        })
                );
            });
        } else {
            resolve();
        }
    });
};

/**
 * @param {*} promiseFn api call - it could be api call or subscription
 * @param {*} errors_to_ignore list of errors to ignore
 * @param {*} api_base instance of APIBase class to check if the bot is running or not
 * @returns a new promise
 */
export const doUntilDone = (promiseFn, errors_to_ignore, api_base) => {
    let delay_index = 1;

    return new Promise((resolve, reject) => {
        const recoverFn = (error_code, makeDelay) => {
            delay_index++;
            makeDelay().then(repeatFn);
        };

        const repeatFn = () => {
            recoverFromError(promiseFn, recoverFn, errors_to_ignore, delay_index, api_base).then(resolve).catch(reject);
        };

        repeatFn();
    });
};

export const createDetails = contract => {
    const { sell_price: sellPrice, buy_price: buyPrice, currency } = contract;
    const profit = getRoundedNumber(sellPrice - buyPrice, currency);
    const result = profit < 0 ? 'loss' : 'win';

    return [
        contract.transaction_ids.buy,
        +contract.buy_price,
        +contract.sell_price,
        profit,
        contract.contract_type,
        formatTime(parseInt(`${contract.entry_tick_time}000`), 'HH:mm:ss'),
        +contract.entry_tick,
        formatTime(parseInt(`${contract.exit_tick_time}000`), 'HH:mm:ss'),
        +contract.exit_tick,
        +(contract.barrier ? contract.barrier : 0),
        result,
    ];
};

export const getUUID = () => `${new Date().getTime() * Math.random()}`;

const hasBlockOfType = (targetType, workspace) => {
    const allBlocks = workspace.getAllBlocks();
    return allBlocks.some(block => block.type === targetType && !!block.parentBlock_);
};

export const checkBlocksForProposalRequest = () => {
    const workspace = window.Blockly.derivWorkspace;
    const has_payout_block = hasBlockOfType('payout', workspace);

    // Code for the future for case when basis: 'payout':
    // * Since basis : '${block.type === 'trade_definition_tradeoptions' ? 'stake' : 'payout'}'
    // * basis: 'payout' when contract_type: "MULTUP"
    // Uncomment next line later:
    // const is_basis_payout = !hasBlockOfType('trade_definition_tradeoptions', workspace);

    return {
        has_payout_block,
        is_basis_payout: false,
    };
};

export const socket_state = {
    [WebSocket.CONNECTING]: 'Connecting',
    [WebSocket.OPEN]: 'Connected',
    [WebSocket.CLOSING]: 'Closing',
    [WebSocket.CLOSED]: 'Closed',
};
