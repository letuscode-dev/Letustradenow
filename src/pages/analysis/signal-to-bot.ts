import type { TFormData } from '../bot-builder/quick-strategy/types';
import type { AnalysisIdea, AnalysisSnapshot, IdeaDirection, OptionFamily } from './analysis-types';

export type SignalBotAction = 'LOAD' | 'RUN';

export type SignalBotStrategy =
    | 'MARTINGALE'
    | 'D_ALEMBERT'
    | 'REVERSE_MARTINGALE'
    | 'REVERSE_D_ALEMBERT'
    | 'OSCARS_GRIND'
    | 'STRATEGY_1_3_2_6';

type TSignalContract = {
    last_digit_prediction?: string;
    tradetype: string;
    type: string;
};

const SIGNAL_CONTRACTS_BY_DIRECTION: Partial<Record<IdeaDirection, TSignalContract>> = {
    differs: {
        tradetype: 'matchesdiffers',
        type: 'DIGITDIFF',
    },
    even: {
        last_digit_prediction: '0',
        tradetype: 'evenodd',
        type: 'DIGITEVEN',
    },
    fall: {
        tradetype: 'callput',
        type: 'PUT',
    },
    matches: {
        tradetype: 'matchesdiffers',
        type: 'DIGITMATCH',
    },
    odd: {
        last_digit_prediction: '1',
        tradetype: 'evenodd',
        type: 'DIGITODD',
    },
    over: {
        tradetype: 'overunder',
        type: 'DIGITOVER',
    },
    rise: {
        tradetype: 'callput',
        type: 'CALL',
    },
    under: {
        tradetype: 'overunder',
        type: 'DIGITUNDER',
    },
};

const clampDigit = (digit: number) => Math.max(0, Math.min(9, Math.round(digit)));

export const isActionableSignalDirection = (direction: IdeaDirection) =>
    Object.prototype.hasOwnProperty.call(SIGNAL_CONTRACTS_BY_DIRECTION, direction);

export const getSignalDigitPrediction = (idea: AnalysisIdea, fallback_digit = 0) => {
    const digit_match = idea.prediction?.match(/\d/);

    return digit_match ? digit_match[0] : String(clampDigit(fallback_digit));
};

export const getSignalContract = (idea: AnalysisIdea, fallback_digit = 0): TSignalContract | null => {
    const contract = SIGNAL_CONTRACTS_BY_DIRECTION[idea.direction];

    if (!contract) return null;

    const needs_prediction = ['differs', 'matches', 'over', 'under'].includes(idea.direction);

    return {
        ...contract,
        last_digit_prediction: needs_prediction
            ? getSignalDigitPrediction(idea, fallback_digit)
            : contract.last_digit_prediction,
    };
};

export const shouldBlockSignalBotRun = (snapshot: AnalysisSnapshot, use_volatility_guard: boolean) =>
    use_volatility_guard && snapshot.volatility === 'spike';

export const buildSignalBotFormData = ({
    action,
    idea,
    option_family,
    over_under_barrier,
    symbol,
}: {
    action: SignalBotAction;
    idea: AnalysisIdea;
    option_family: OptionFamily;
    over_under_barrier: number;
    symbol: string;
}): TFormData | null => {
    const contract = getSignalContract(idea, over_under_barrier);

    if (!contract) return null;

    const is_digit_contract = option_family !== 'rise_fall';

    return {
        action,
        boolean_max_stake: true,
        duration: is_digit_contract ? '1' : '5',
        durationtype: 't',
        last_digit_prediction: contract.last_digit_prediction ?? String(clampDigit(over_under_barrier)),
        loss: '10',
        max_stake: '25',
        profit: '5',
        size: '2',
        stake: '1',
        symbol,
        tradetype: contract.tradetype,
        type: contract.type,
        unit: '1',
    };
};
