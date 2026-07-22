import { config as qs_config } from '@/external/bot-skeleton';
import {
    localize1326,
    localizeDAlembergOnStatReset,
    localizeDAlembert,
    localizeMartingale,
    localizeMartingaleOnStatReset,
    localizeOscarsGrind,
    localizeReverseDAlembergOnStatReset,
    localizeReverseDAlembert,
    localizeReverseMartingale,
    localizeReverseMartingaleOnStatReset,
} from '@/utils/conditional-localize';
import { localize } from '@deriv-com/translations';
import {
    D_ALEMBERT,
    MARTINGALE,
    OSCARS_GRIND,
    REVERSE_D_ALEMBERT,
    REVERSE_MARTINGALE,
    STRATEGY_1_3_2_6,
} from '../../../constants/quick-strategies';
import { LocalizeHTMLForSellConditions } from './localize_html';
import { TConfigItem, TStrategies, TValidationItem } from './types';

// Block ID constants for better maintainability and readability
export const RESET_STRATEGIES_BLOCK_IDS = [
    'YBm3.OP{L7y^WWz%GM#R',
    'Ym$v.ix]r{xp0?1EOEDP',
    'M(`gZ)-p}|aY(Aj2111K',
    '=},I)bcka#FK`KQ3PQ%5',
];
export const RESET_STRATEGIES = [
    'accumulators_martingale_on_stat_reset',
    'accumulators_dalembert_on_stat_reset',
    'accumulators_reverse_martingale_on_stat_reset',
    'accumulators_reverse_dalembert_on_stat_reset',
];

export const FORM_TABS = () => [
    {
        label: localize('Trade parameters'),
        value: 'TRADE_PARAMETERS',
    },
    {
        label: localize('Learn more'),
        value: 'LEARN_MORE',
        disabled: true,
    },
];

const SELL_CONDITIONS_TYPE_INFO = (): TConfigItem => ({
    type: 'label',
    label: localize('Sell conditions'),
    description: LocalizeHTMLForSellConditions,
});

const LABEL_ACCUMULAORTS_SIZE = (): TConfigItem => ({
    type: 'label',
    label: localize('Size'),
    description: localize('The size used to multiply the stake after a losing trade for the next trade.'),
});

// This will trigger the boolean_tick_count value to render the take profit and tick count fields
const SELL_CONDITIONS_TYPE = (): TConfigItem => ({
    type: 'sell_conditions',
    name: 'sell_conditions',
});

const GROWTH_RATE = (): TConfigItem => ({
    type: 'label',
    label: localize('Growth rate'),
    description: localize(
        'Your stake will grow at the specified growth rate per tick as long as the current spot price remains within the range of the previous spot price.'
    ),
});

const GROWTH_RATE_VALUE = (): TConfigItem => ({
    type: 'growth_rate',
    name: 'growth_rate',
    attached: true,
    validation: ['number', 'required', 'ceil'],
});

const LABEL_ACCUMULAORTS_UNIT = (): TConfigItem => ({
    type: 'label',
    label: localize('Unit'),
    description: localize('The unit used to multiply the stake after a losing trade for the next trade.'),
});

const TAKE_PROFIT = (): TConfigItem => ({
    type: 'number',
    name: 'take_profit',
    should_have: [{ key: 'boolean_tick_count', value: false }],
    hide_without_should_have: true,
    attached: true,
    has_currency_unit: true,
    validation: [
        'number',
        'required',
        'ceil',
        {
            type: 'min',
            value: 0.35,
            getMessage: (min: string | number) => localize('Minimum take profit allowed is {{ min }}', { min }),
        },
    ],
});

const TICK_COUNT = (): TConfigItem => ({
    type: 'number',
    name: 'tick_count',
    should_have: [{ key: 'boolean_tick_count', value: true }],
    hide_without_should_have: true,
    attached: true,
    has_currency_unit: false,
    validation: [
        'number',
        'required',
        'ceil',
        {
            type: 'min',
            value: 1,
            getMessage: (min: string | number) => localize('Minimum tick count allowed is {{ min }}', { min }),
        },
    ],
});

const NUMBER_DEFAULT_VALIDATION = (): TValidationItem => ({
    type: 'min',
    value: 1,
    getMessage: (min: string | number) => localize('Must be a number higher than {{ min }}', { min: Number(min) - 1 }),
});

const LABEL_SYMBOL = (): TConfigItem => ({
    type: 'label',
    label: localize('Asset'),
    description: localize('The underlying market your bot will trade with this strategy.'),
});

const SYMBOL = (): TConfigItem => ({
    type: 'symbol',
    name: 'symbol',
});

const LABEL_TRADETYPE = (): TConfigItem => ({
    type: 'label',
    label: localize('Contract type'),
    description: localize('Your bot will use this contract type for every run'),
});

const TRADETYPE = (): TConfigItem => ({
    type: 'tradetype',
    name: 'tradetype',
    dependencies: ['symbol'],
});

const LABEL_PURCHASE_TYPE = (): TConfigItem => ({
    type: 'label',
    label: localize('Purchase condition'),
    description: localize('Your bot uses a single trade type for each run.'),
});

const PURCHASE_TYPE = (): TConfigItem => ({
    type: 'contract_type',
    name: 'type',
    dependencies: ['symbol', 'tradetype'],
});

const LABEL_STAKE = (): TConfigItem => ({
    type: 'label',
    label: localize('Initial stake'),
    description: localize('The amount that you stake for the first trade. Note that this is the minimum stake amount.'),
});

const STAKE = (): TConfigItem => ({
    type: 'number',
    name: 'stake',
    validation: ['number', 'required', 'ceil'],
    has_currency_unit: true,
});

const LABEL_DURATION = (): TConfigItem => ({
    type: 'label',
    label: localize('Duration'),
    description: localize('How long each trade takes to expire.'),
});

const DURATION_TYPE = (): TConfigItem => ({
    type: 'durationtype',
    name: 'durationtype',
    dependencies: ['symbol', 'tradetype'],
    attached: true,
});

const DURATION = (): TConfigItem => ({
    type: 'number',
    name: 'duration',
    attached: true,
    validation: ['number', 'required', 'min', 'max', 'integer'],
});

const LABEL_PROFIT = (): TConfigItem => ({
    type: 'label',
    label: localize('Profit threshold'),
    description: localize('The bot will stop trading if your total profit exceeds this amount.'),
});

const PROFIT = (): TConfigItem => ({
    type: 'number',
    name: 'profit',
    validation: ['number', 'required', 'ceil', NUMBER_DEFAULT_VALIDATION()],
    has_currency_unit: true,
});

const LABEL_LOSS = (): TConfigItem => ({
    type: 'label',
    label: localize('Loss threshold'),
    description: localize('The bot will stop trading if your total loss exceeds this amount.'),
});

const LOSS = (): TConfigItem => ({
    type: 'number',
    name: 'loss',
    validation: ['number', 'required', 'ceil', NUMBER_DEFAULT_VALIDATION()],
    has_currency_unit: true,
});

const LABEL_CONSECUTIVE_LOSS = (): TConfigItem => ({
    type: 'label',
    label: localize('Consecutive losses'),
    description: localize('The bot will stop trading after this many consecutive losing trades.'),
});

const CONSECUTIVE_LOSS = (): TConfigItem => ({
    type: 'number',
    name: 'loss',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MARTINGALE_SIZE = (): TConfigItem => ({
    type: 'label',
    label: localize('Size'),
    description: localize('The size used to multiply the stake after a losing trade for the next trade.'),
});

const LABEL_PAYOUT_PERCENT = (): TConfigItem => ({
    type: 'label',
    label: localize('Payout %'),
    description: localize(
        'Win profit as a percent of stake. Digit Differs is usually ~10–12 (not 95). Example: 11 means a $1 stake pays about $0.11 profit. You can also enter 0.11. Used to size recovery stakes.'
    ),
});

const PAYOUT_PERCENT = (): TConfigItem => ({
    type: 'number',
    name: 'payout_percent',
    validation: [
        'number',
        'required',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
        {
            type: 'max',
            value: 1000,
            getMessage: (max: string | number) =>
                localize('The value must be equal or less than {{ max }}', { max }),
        },
    ],
});

const LABEL_RECOVERY_SPLITS = (): TConfigItem => ({
    type: 'label',
    label: localize('Recovery splits'),
    description: localize(
        'How many winning runs should fully recover the lost amount. Enter 1 to recover in a single win, or N to spread recovery over N wins.'
    ),
});

const RECOVERY_SPLITS = (): TConfigItem => ({
    type: 'number',
    name: 'recovery_splits',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_TICK_SAMPLE = (): TConfigItem => ({
    type: 'label',
    label: localize('Tick sample'),
    description: localize(
        'How many recent last digits to count when finding the cold (least frequent) digit. Same idea as the Analysis tool (default 100).'
    ),
});

const TICK_SAMPLE = (): TConfigItem => ({
    type: 'number',
    name: 'tick_sample_size',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '30',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
        {
            type: 'max',
            value: 500,
            getMessage: (max: string | number) =>
                localize('The value must be equal or less than {{ max }}', { max }),
        },
    ],
});

const LABEL_RUNS_PER_SIGNAL = (): TConfigItem => ({
    type: 'label',
    label: localize('Runs per signal'),
    description: localize(
        'How many Differs trades to place on the same cold digit before picking a new one. Enter 1 to recompute after every trade.'
    ),
});

const RUNS_PER_SIGNAL = (): TConfigItem => ({
    type: 'number',
    name: 'runs_per_signal',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_TICK_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('Tick window'),
    description: localize(
        'Number of recent ticks used to find what digit followed each of 0–9. The Differs barrier comes from that window. Default is 5.'
    ),
});

const TICK_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'tick_window',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '2',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_PATTERN_THRESHOLD = (): TConfigItem => ({
    type: 'label',
    label: localize('Pattern threshold'),
    description: localize(
        'Minimum times a digit→next transition must appear in the tick window before Differs is placed on that next digit.'
    ),
});

const PATTERN_THRESHOLD = (): TConfigItem => ({
    type: 'number',
    name: 'pattern_threshold',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MIN_ADAPTIVE_GAP = (): TConfigItem => ({
    type: 'label',
    label: localize('Minimum adaptive gap'),
    description: localize(
        'Only accept repeated equal gaps that are at least this many ticks between digit appearances.'
    ),
});

const MIN_ADAPTIVE_GAP = (): TConfigItem => ({
    type: 'number',
    name: 'min_adaptive_gap',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MAX_ADAPTIVE_GAP = (): TConfigItem => ({
    type: 'label',
    label: localize('Maximum adaptive gap'),
    description: localize(
        'Only accept repeated equal gaps that are at most this many ticks between digit appearances.'
    ),
});

const MAX_ADAPTIVE_GAP = (): TConfigItem => ({
    type: 'number',
    name: 'max_adaptive_gap',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_TRADE_WAIT = (): TConfigItem => ({
    type: 'label',
    label: localize('Trade wait (ticks)'),
    description: localize(
        'After two equal gaps are confirmed, wait this many ticks before placing Differs (independent of the confirmed gap size).'
    ),
});

const TRADE_WAIT = (): TConfigItem => ({
    type: 'number',
    name: 'trade_wait',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_SELECTION_MODE = (): TConfigItem => ({
    type: 'label',
    label: localize('Selection mode'),
    description: localize(
        'When several digits are eligible: 0 = first digit, 1 = largest adaptive gap, 2 = highest gap excess, 3 = largest current gap.'
    ),
});

const SELECTION_MODE = (): TConfigItem => ({
    type: 'number',
    name: 'selection_mode',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
        {
            type: 'max',
            value: '3',
            getMessage: (max: string | number) =>
                localize('The value must be equal or less than {{ max }}', { max }),
        },
    ],
});

const LABEL_COOLDOWN = (): TConfigItem => ({
    type: 'label',
    label: localize('Cooldown after trade'),
    description: localize('Wait this many ticks after a trade signal before allowing another.'),
});

const COOLDOWN_AFTER_TRADE = (): TConfigItem => ({
    type: 'number',
    name: 'cooldown_after_trade',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_LOSING_LOOKBACK = (): TConfigItem => ({
    type: 'label',
    label: localize('Losing-range lookback'),
    description: localize(
        'Number of previous ticks (excluding current) checked for Losing digits 0–1. Default is 2.'
    ),
});

const LOSING_LOOKBACK = (): TConfigItem => ({
    type: 'number',
    name: 'losing_lookback',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MAX_TRADES_SESSION = (): TConfigItem => ({
    type: 'label',
    label: localize('Max trades per session'),
    description: localize('Stop signaling after this many trades (0 = unlimited).'),
});

const MAX_TRADES_SESSION = (): TConfigItem => ({
    type: 'number',
    name: 'max_trades_per_session',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const CHECKBOX_STRATEGY = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_strategy',
    label: localize('Enable strategy'),
    description: localize('When off, no Differs signals are produced.'),
});

const CHECKBOX_ONE_TRADE_PER_CYCLE = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_one_trade_per_cycle',
    label: localize('One trade per digit cycle'),
    description: localize(
        'After a scheduled Differs is placed or cancelled for a digit, do not reuse that same confirmation — keep tracking new gaps.'
    ),
});

const CHECKBOX_ONE_ACTIVE_TRADE = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_one_active_trade',
    label: localize('One active trade only'),
    description: localize(
        'Allow only one open Differs at a time. After a signal, block further purchases until that contract settles.'
    ),
});

const CHECKBOX_JOURNAL = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_journal',
    label: localize('Journal logging'),
    description: localize('Log short trade signals and blocks only (no per-tick spam).'),
});

const CHECKBOX_NOTIFY = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_notify',
    label: localize('Signal notifications'),
    description: localize('Show a short notification when an Over 1 momentum signal is generated.'),
});

const CHECKBOX_DASHBOARD = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_dashboard',
    label: localize('Live gap dashboard'),
    description: localize('Write a compact per-digit gap line to the Journal when it changes.'),
});

const LABEL_MIN_GAP = (): TConfigItem => ({
    type: 'label',
    label: localize('Minimum gap'),
    description: localize(
        'Minimum consecutive non-zero last digits since the last 0 before an Over 0 trade is allowed.'
    ),
});

const MIN_GAP = (): TConfigItem => ({
    type: 'number',
    name: 'min_gap',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MAX_GAP = (): TConfigItem => ({
    type: 'label',
    label: localize('Maximum gap'),
    description: localize(
        'Maximum consecutive non-zero last digits since the last 0. Trades are blocked when the gap exceeds this value.'
    ),
});

const MAX_GAP = (): TConfigItem => ({
    type: 'number',
    name: 'max_gap',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MIN_COMMON_DIFF = (): TConfigItem => ({
    type: 'label',
    label: localize('Minimum common difference'),
    description: localize('Smallest allowed step between consecutive gaps in an arithmetic progression.'),
});

const MIN_COMMON_DIFF = (): TConfigItem => ({
    type: 'number',
    name: 'min_common_diff',
    validation: ['number', 'required', 'floor'],
});

const LABEL_MAX_COMMON_DIFF = (): TConfigItem => ({
    type: 'label',
    label: localize('Maximum common difference'),
    description: localize('Largest allowed step between consecutive gaps in an arithmetic progression.'),
});

const MAX_COMMON_DIFF = (): TConfigItem => ({
    type: 'number',
    name: 'max_common_diff',
    validation: ['number', 'required', 'floor'],
});

const LABEL_GAPS_REQUIRED = (): TConfigItem => ({
    type: 'label',
    label: localize('Gaps required'),
    description: localize('Number of consecutive gaps that must form an arithmetic progression before signaling (default 3).'),
});

const GAPS_REQUIRED = (): TConfigItem => ({
    type: 'number',
    name: 'gaps_required',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '2',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const CHECKBOX_CANCEL_EARLY = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_cancel_early',
    label: localize('Cancel on early appearance'),
    description: localize(
        'When on, cancels the scheduled Differs if the digit appears before the predicted gap is reached.'
    ),
});

const LABEL_MIN_SIGNAL_SCORE = (): TConfigItem => ({
    type: 'label',
    label: localize('Minimum signal score'),
    description: localize('A digit must reach at least this total score before a Differs trade is placed.'),
});

const MIN_SIGNAL_SCORE = (): TConfigItem => ({
    type: 'number',
    name: 'min_signal_score',
    validation: ['number', 'required', 'floor'],
});

const LABEL_FREQUENCY_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('Rolling frequency window'),
    description: localize('Tick window used for Most Frequent and frequency comparisons.'),
});

const FREQUENCY_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'frequency_window',
    validation: ['number', 'required', 'floor'],
});

const LABEL_RECENT_APPEARANCE_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('Recent appearance window'),
    description: localize('Ticks to scan for Recent Double Appearance scoring.'),
});

const RECENT_APPEARANCE_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'recent_appearance_window',
    validation: ['number', 'required', 'floor'],
});

const LABEL_LONG_ABSENCE_THRESHOLD = (): TConfigItem => ({
    type: 'label',
    label: localize('Long absence threshold'),
    description: localize('Apply the Long Absence penalty when a digit has been absent longer than this.'),
});

const LONG_ABSENCE_THRESHOLD = (): TConfigItem => ({
    type: 'number',
    name: 'long_absence_threshold',
    validation: ['number', 'required', 'floor'],
});

const LABEL_MIN_ABSENCE_THRESHOLD = (): TConfigItem => ({
    type: 'label',
    label: localize('Minimum absence threshold'),
    description: localize('Minimum consecutive ticks a digit must be absent before its return qualifies.'),
});

const MIN_ABSENCE_THRESHOLD = (): TConfigItem => ({
    type: 'number',
    name: 'min_absence_threshold',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MAX_ABSENCE_THRESHOLD = (): TConfigItem => ({
    type: 'label',
    label: localize('Maximum absence threshold'),
    description: localize('Optional upper absence cap (0 = disabled). Returns above this are ignored.'),
});

const MAX_ABSENCE_THRESHOLD = (): TConfigItem => ({
    type: 'number',
    name: 'max_absence_threshold',
    validation: ['number', 'required', 'floor'],
});

const LABEL_RETURN_DELAY = (): TConfigItem => ({
    type: 'label',
    label: localize('Return delay'),
    description: localize('Ticks to wait after a qualifying return before placing Differs.'),
});

const RETURN_DELAY = (): TConfigItem => ({
    type: 'number',
    name: 'return_delay',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_REQUIRED_RETURN_CONFIRMATIONS = (): TConfigItem => ({
    type: 'label',
    label: localize('Required return confirmations'),
    description: localize('Number of appearances required after a long absence before the delay starts.'),
});

const REQUIRED_RETURN_CONFIRMATIONS = (): TConfigItem => ({
    type: 'number',
    name: 'required_return_confirmations',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_CONFIRMATION_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('Confirmation window'),
    description: localize('Ticks allowed for additional return confirmations when required > 1.'),
});

const CONFIRMATION_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'confirmation_window',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '1',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_MAX_SIGNAL_AGE = (): TConfigItem => ({
    type: 'label',
    label: localize('Maximum signal age'),
    description: localize('Expire a scheduled signal after this many ticks (0 = disabled).'),
});

const MAX_SIGNAL_AGE = (): TConfigItem => ({
    type: 'number',
    name: 'max_signal_age',
    validation: ['number', 'required', 'floor'],
});

const CHECKBOX_CANCEL_ON_REAPPEARANCE = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_cancel_early',
    label: localize('Cancel if digit reappears during delay'),
    description: localize(
        'When on, cancels the scheduled Differs if the returned digit appears again before the delay completes.'
    ),
});

const CHECKBOX_EVEN_ODD_FILTER = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_even_odd_filter',
    label: localize('Enable even/odd filter'),
    description: localize('Require parity confirmation before placing a Digit Differs trade.'),
});

const LABEL_PARITY_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('Even/odd analysis window'),
    description: localize('Number of recent ticks used for even/odd distribution analysis.'),
});

const PARITY_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'parity_window',
    validation: ['number', 'required', 'floor'],
});

const LABEL_FILTER_MODE = (): TConfigItem => ({
    type: 'label',
    label: localize('Filter mode'),
    description: localize('0 = matching parity, 1 = opposite parity, 2 = any strong imbalance.'),
});

const FILTER_MODE = (): TConfigItem => ({
    type: 'number',
    name: 'filter_mode',
    validation: ['number', 'required', 'floor'],
});

const LABEL_THRESHOLD_TYPE = (): TConfigItem => ({
    type: 'label',
    label: localize('Threshold type'),
    description: localize('0 = count-based, 1 = percentage-based.'),
});

const THRESHOLD_TYPE = (): TConfigItem => ({
    type: 'number',
    name: 'threshold_type',
    validation: ['number', 'required', 'floor'],
});

const LABEL_MATCHING_PARITY_COUNT = (): TConfigItem => ({
    type: 'label',
    label: localize('Required matching parity count'),
    description: localize('Minimum even or odd ticks required when using count-based threshold.'),
});

const MATCHING_PARITY_COUNT = (): TConfigItem => ({
    type: 'number',
    name: 'matching_parity_count',
    validation: ['number', 'required', 'floor'],
});

const LABEL_MATCHING_PARITY_PERCENT = (): TConfigItem => ({
    type: 'label',
    label: localize('Required matching parity percentage'),
    description: localize('Minimum even or odd percentage required when using percentage threshold.'),
});

const MATCHING_PARITY_PERCENT = (): TConfigItem => ({
    type: 'number',
    name: 'matching_parity_percent',
    validation: ['number', 'required', 'floor'],
});

const LABEL_REQUIRED_CONFIRMATIONS = (): TConfigItem => ({
    type: 'label',
    label: localize('Required consecutive confirmations'),
    description: localize('Even/odd filter must pass this many ticks in a row before trading.'),
});

const REQUIRED_CONFIRMATIONS = (): TConfigItem => ({
    type: 'number',
    name: 'required_confirmations',
    validation: ['number', 'required', 'floor'],
});

const LABEL_PRIMARY_SIGNAL_SOURCE = (): TConfigItem => ({
    type: 'label',
    label: localize('Primary signal source'),
    description: localize(
        'signal_score, increasing_gap, long_absence_return, repeated_gap, most_frequent, recent_double, frequency_spike'
    ),
});

const PRIMARY_SIGNAL_SOURCE = (): TConfigItem => ({
    type: 'text',
    name: 'primary_signal_source',
    validation: ['required'],
});

const CHECKBOX_HIGH_LOW_FILTER = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_high_low_filter',
    label: localize('Enable High/Low filter'),
    description: localize('Require High/Low group confirmation before placing a Digit Differs trade.'),
});

const LABEL_HIGH_LOW_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('High/Low analysis window'),
    description: localize('Number of recent ticks used for High/Low distribution analysis.'),
});

const HIGH_LOW_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'analysis_window',
    validation: ['number', 'required', 'floor'],
});

const LABEL_HL_FILTER_MODE = (): TConfigItem => ({
    type: 'label',
    label: localize('High/Low filter mode'),
    description: localize(
        '0 = matching group, 1 = opposite group, 2 = standalone dominant digit, 3 = primary + group leader (default).'
    ),
});

const HL_FILTER_MODE = (): TConfigItem => ({
    type: 'number',
    name: 'filter_mode',
    validation: ['number', 'required', 'floor'],
});

const LABEL_DOMINANT_GROUP_COUNT = (): TConfigItem => ({
    type: 'label',
    label: localize('Required dominant-group count'),
    description: localize('Minimum High or Low ticks required when using count-based dominance.'),
});

const DOMINANT_GROUP_COUNT = (): TConfigItem => ({
    type: 'number',
    name: 'dominant_group_count',
    validation: ['number', 'required', 'floor'],
});

const LABEL_DOMINANCE_PERCENT = (): TConfigItem => ({
    type: 'label',
    label: localize('Required dominance percentage'),
    description: localize('Minimum High or Low percentage required when using percentage threshold.'),
});

const DOMINANCE_PERCENT = (): TConfigItem => ({
    type: 'number',
    name: 'dominance_percent',
    validation: ['number', 'required', 'floor'],
});

const CHECKBOX_REQUIRE_MOST_FREQUENT = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_require_most_frequent',
    label: localize('Require most frequent in group'),
    description: localize('Target digit must be the most frequent digit in its High/Low group.'),
});

const LABEL_MIN_TARGET_APPEARANCES = (): TConfigItem => ({
    type: 'label',
    label: localize('Minimum target appearances'),
    description: localize('Minimum times the target digit must appear in the analysis window.'),
});

const MIN_TARGET_APPEARANCES = (): TConfigItem => ({
    type: 'number',
    name: 'min_target_appearances',
    validation: ['number', 'required', 'floor'],
});

const LABEL_MIN_TARGET_GROUP_SHARE = (): TConfigItem => ({
    type: 'label',
    label: localize('Minimum target group share (%)'),
    description: localize('Minimum share of the dominant group that the target digit must represent.'),
});

const MIN_TARGET_GROUP_SHARE = (): TConfigItem => ({
    type: 'number',
    name: 'min_target_group_share',
    validation: ['number', 'required', 'floor'],
});

const LABEL_TIE_ACTION = (): TConfigItem => ({
    type: 'label',
    label: localize('High/Low tie action'),
    description: localize('0 = reject, 1 = wait, 2 = prefer primary group, 3 = prefer previous window.'),
});

const TIE_ACTION = (): TConfigItem => ({
    type: 'number',
    name: 'tie_action',
    validation: ['number', 'required', 'floor'],
});

const LABEL_SPIKE_RECENT_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('Spike recent window'),
    description: localize('Recent tick window for Frequency Spike detection.'),
});

const SPIKE_RECENT_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'spike_recent_window',
    validation: ['number', 'required', 'floor'],
});

const LABEL_SPIKE_HISTORICAL_WINDOW = (): TConfigItem => ({
    type: 'label',
    label: localize('Spike historical window'),
    description: localize('Historical tick window immediately before the spike recent window.'),
});

const SPIKE_HISTORICAL_WINDOW = (): TConfigItem => ({
    type: 'number',
    name: 'spike_historical_window',
    validation: ['number', 'required', 'floor'],
});

const scoreField = (name: string, label: string): TConfigItem => ({
    type: 'number',
    name,
    validation: ['number', 'required'],
});

const scoreToggle = (name: string, label: string): TConfigItem => ({
    type: 'checkbox',
    name,
    label: localize(label),
});

const CHECKBOX_GAP_FILTER = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_gap_filter',
    label: localize('Enable gap filter'),
    description: localize('When off, Over 0 trades are allowed without checking the gap.'),
});

const CHECKBOX_GAP_JOURNAL = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_gap_journal',
    label: localize('Gap filter journal'),
    description: localize('Log PASSED/FAILED gap filter evaluations to the Journal.'),
});

const LABEL_PERCENTAGE_THRESHOLD = (): TConfigItem => ({
    type: 'label',
    label: localize('Over 2 percentage threshold'),
    description: localize(
        'Minimum share of digits 3–9 in the last 100 ticks required before an Over 2 trade is allowed. Example: 75 means at least 75 winning digits out of 100.'
    ),
});

const PERCENTAGE_THRESHOLD = (): TConfigItem => ({
    type: 'number',
    name: 'percentage_threshold',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: '0',
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
        {
            type: 'max',
            value: 100,
            getMessage: (max: string | number) =>
                localize('The value must be equal or less than {{ max }}', { max }),
        },
    ],
});

const CHECKBOX_PERCENTAGE_FILTER = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_percentage_filter',
    label: localize('Enable percentage filter'),
    description: localize('When off, Over 2 trades are allowed without checking the percentage threshold.'),
});

const CHECKBOX_PERCENTAGE_JOURNAL = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_percentage_journal',
    label: localize('Percentage filter journal'),
    description: localize('Log collecting / passed / failed percentage filter evaluations to the Journal.'),
});

const CHECKBOX_MARTINGALE = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_martingale',
    label: localize('Enable Martingale'),
    description: localize('When off, the stake multiplier stays at 1 (no Martingale recovery).'),
});

const LABEL_REVERSE_MARTINGALE_SIZE = (): TConfigItem => ({
    type: 'label',
    label: localize('Size'),
    description: localize('The size used to multiply the stake after a successful trade for the next trade.'),
});

const SIZE = (): TConfigItem => ({
    type: 'number',
    name: 'size',
    validation: [
        'number',
        'required',
        'floor',
        {
            type: 'min',
            value: String(qs_config().QUICK_STRATEGY.DEFAULT.size),
            getMessage: (min: string | number) =>
                localize('The value must be equal or greater than {{ min }}', { min }),
        },
    ],
});

const LABEL_DALEMBERT_UNIT = (): TConfigItem => ({
    type: 'label',
    label: localize('Unit'),
    description: localize(
        'Number of unit(s) to be added to the next trade after a losing trade. One unit is equivalent to the amount of initial stake.'
    ),
});

const LABEL_REVERSE_DALEMBERT_UNIT = (): TConfigItem => ({
    type: 'label',
    label: localize('Unit'),
    description: localize(
        'Number of unit(s) to be added to the next trade after a successful trade. One unit is equivalent to the amount of initial stake.'
    ),
});

const UNIT = (): TConfigItem => ({
    type: 'number',
    name: 'unit',
    validation: ['number', 'required', 'ceil', NUMBER_DEFAULT_VALIDATION()],
});

const CHECKBOX_MAX_STAKE = (): TConfigItem => ({
    type: 'checkbox',
    name: 'boolean_max_stake',
    label: localize('Max stake'),
    description: localize('The stake for your next trade will reset to the initial stake if it exceeds this value.'),
    attached: true,
});

const MAX_STAKE = (): TConfigItem => ({
    type: 'number',
    name: 'max_stake',
    validation: ['number', 'required', 'ceil', 'min'],
    should_have: [{ key: 'boolean_max_stake', value: true }],
    hide_without_should_have: true,
    attached: true,
    has_currency_unit: true,
});

const LABEL_LAST_DIGIT_PREDICTION = (): TConfigItem => ({
    type: 'label',
    name: 'label_last_digit_prediction',
    label: localize('Last Digit Prediction'),
    description: localize('Your prediction of the last digit of the asset price.'),
    should_have: [{ key: 'tradetype', value: '', multiple: ['matchesdiffers', 'overunder'] }],
    hide_without_should_have: true,
});

const LAST_DIGIT_PREDICTION = (): TConfigItem => ({
    type: 'number',
    name: 'last_digit_prediction',
    validation: ['number', 'required', 'min', 'max', 'integer'],
    should_have: [{ key: 'tradetype', value: '', multiple: ['matchesdiffers', 'overunder'] }],
    hide_without_should_have: true,
});

export const STRATEGIES = (): TStrategies => ({
    MARTINGALE: {
        name: 'martingale_max-stake',
        label: localizeMartingale(),
        rs_strategy_name: 'martingale',
        description: MARTINGALE(),
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_TRADETYPE(),
                TRADETYPE(),
                LABEL_PURCHASE_TYPE(),
                PURCHASE_TYPE(),
                LABEL_LAST_DIGIT_PREDICTION(),
                LAST_DIGIT_PREDICTION(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_DURATION(),
                DURATION_TYPE(),
                DURATION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_MARTINGALE_SIZE(),
                SIZE(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    RANGE_MOMENTUM_OVER_ONE: {
        name: 'range_momentum_over_one',
        label: localize('Range Momentum Over 1'),
        rs_strategy_name: 'range momentum over 1',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Places Over 1 when last digits show Lower(2–5)→Higher(6–9) momentum and no Losing(0–1) digits in the lookback window. Optional cooldown, Martingale, and consecutive-loss stop. Run once sets Range Momentum Numbers then Range Momentum Booleans.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_COOLDOWN(),
                COOLDOWN_AFTER_TRADE(),
                LABEL_LOSING_LOOKBACK(),
                LOSING_LOOKBACK(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                LABEL_MARTINGALE_SIZE(),
                SIZE(),
                CHECKBOX_STRATEGY(),
                CHECKBOX_JOURNAL(),
                CHECKBOX_NOTIFY(),
                CHECKBOX_MARTINGALE(),
            ],
        ],
    },
    INCREASING_GAP_DIFFERS: {
        name: 'increasing_gap_differs',
        label: localize('Increasing Gap Differs'),
        rs_strategy_name: 'increasing gap differs',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Tracks each digit 0–9. When recent gaps increase by a constant step (e.g. 2→3→4), waits the predicted next gap and places Digit Differs. Optional early-appearance cancellation, cooldown, Martingale, and consecutive-loss stop.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_MIN_GAP(),
                MIN_GAP(),
                LABEL_MAX_GAP(),
                MAX_GAP(),
                LABEL_MIN_COMMON_DIFF(),
                MIN_COMMON_DIFF(),
            ],
            [
                LABEL_MAX_COMMON_DIFF(),
                MAX_COMMON_DIFF(),
                LABEL_GAPS_REQUIRED(),
                GAPS_REQUIRED(),
                LABEL_COOLDOWN(),
                COOLDOWN_AFTER_TRADE(),
                LABEL_MAX_TRADES_SESSION(),
                MAX_TRADES_SESSION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                LABEL_MARTINGALE_SIZE(),
                SIZE(),
                CHECKBOX_STRATEGY(),
                CHECKBOX_JOURNAL(),
                CHECKBOX_CANCEL_EARLY(),
                CHECKBOX_ONE_TRADE_PER_CYCLE(),
                CHECKBOX_ONE_ACTIVE_TRADE(),
                CHECKBOX_MARTINGALE(),
            ],
        ],
    },
    SIGNAL_SCORE_DIFFERS: {
        name: 'signal_score_differs',
        label: localize('Signal Score Differs'),
        rs_strategy_name: 'signal score differs',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Scores each digit 0–9 from modular conditions (Most Frequent, Repeated Gap, Recent Double, Frequency Spike, Long Absence). Trades the highest scorer when total score meets your minimum. Live score dashboard and detailed journal output.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_MIN_SIGNAL_SCORE(),
                MIN_SIGNAL_SCORE(),
                LABEL_FREQUENCY_WINDOW(),
                FREQUENCY_WINDOW(),
                LABEL_RECENT_APPEARANCE_WINDOW(),
                RECENT_APPEARANCE_WINDOW(),
            ],
            [
                LABEL_LONG_ABSENCE_THRESHOLD(),
                LONG_ABSENCE_THRESHOLD(),
                LABEL_SPIKE_RECENT_WINDOW(),
                SPIKE_RECENT_WINDOW(),
                LABEL_SPIKE_HISTORICAL_WINDOW(),
                SPIKE_HISTORICAL_WINDOW(),
                LABEL_MIN_GAP(),
                MIN_GAP(),
                LABEL_MAX_GAP(),
                MAX_GAP(),
            ],
            [
                scoreField('most_frequent_score', 'Most Frequent score'),
                scoreToggle('boolean_most_frequent', 'Most Frequent'),
                scoreField('repeated_gap_score', 'Repeated Gap score'),
                scoreToggle('boolean_repeated_gap', 'Repeated Gap'),
                scoreField('recent_double_score', 'Recent Double score'),
                scoreToggle('boolean_recent_double', 'Recent Double'),
            ],
            [
                scoreField('frequency_spike_score', 'Frequency Spike score'),
                scoreToggle('boolean_frequency_spike', 'Frequency Spike'),
                scoreField('long_absence_score', 'Long Absence penalty'),
                scoreToggle('boolean_long_absence', 'Long Absence'),
                LABEL_COOLDOWN(),
                COOLDOWN_AFTER_TRADE(),
                LABEL_MAX_TRADES_SESSION(),
                MAX_TRADES_SESSION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                LABEL_MARTINGALE_SIZE(),
                SIZE(),
                CHECKBOX_STRATEGY(),
                CHECKBOX_JOURNAL(),
                CHECKBOX_DASHBOARD(),
                CHECKBOX_ONE_ACTIVE_TRADE(),
                CHECKBOX_MARTINGALE(),
            ],
        ],
    },
    LONG_ABSENCE_RETURN_DIFFERS: {
        name: 'long_absence_return_differs',
        label: localize('Long-Absence Return Differs'),
        rs_strategy_name: 'long absence return differs',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Tracks absence per digit 0–9. When a digit returns after a long absence, waits a configurable delay, then Differs that digit. Optional confirmation mode, early-reappearance cancellation, signal expiry, live dashboard, and Martingale.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_MIN_ABSENCE_THRESHOLD(),
                MIN_ABSENCE_THRESHOLD(),
                LABEL_MAX_ABSENCE_THRESHOLD(),
                MAX_ABSENCE_THRESHOLD(),
                LABEL_RETURN_DELAY(),
                RETURN_DELAY(),
            ],
            [
                LABEL_REQUIRED_RETURN_CONFIRMATIONS(),
                REQUIRED_RETURN_CONFIRMATIONS(),
                LABEL_CONFIRMATION_WINDOW(),
                CONFIRMATION_WINDOW(),
                LABEL_MAX_SIGNAL_AGE(),
                MAX_SIGNAL_AGE(),
                LABEL_COOLDOWN(),
                COOLDOWN_AFTER_TRADE(),
                LABEL_MAX_TRADES_SESSION(),
                MAX_TRADES_SESSION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                LABEL_MARTINGALE_SIZE(),
                SIZE(),
                CHECKBOX_STRATEGY(),
                CHECKBOX_JOURNAL(),
                CHECKBOX_CANCEL_ON_REAPPEARANCE(),
                CHECKBOX_DASHBOARD(),
                CHECKBOX_ONE_ACTIVE_TRADE(),
                CHECKBOX_MARTINGALE(),
            ],
        ],
    },
    CONDITIONAL_EVEN_ODD_DIFFERS: {
        name: 'conditional_even_odd_differs',
        label: localize('Conditional Differs With Even/Odd Filter'),
        rs_strategy_name: 'conditional even odd differs',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Combines a primary Digit Differs signal with an even/odd parity confirmation filter. Trades only when both the target digit signal and the configured parity threshold pass. Supports matching, opposite, and imbalance modes with live dashboard and journal output.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                CHECKBOX_EVEN_ODD_FILTER(),
                LABEL_PARITY_WINDOW(),
                PARITY_WINDOW(),
                LABEL_FILTER_MODE(),
                FILTER_MODE(),
                LABEL_THRESHOLD_TYPE(),
                THRESHOLD_TYPE(),
            ],
            [
                LABEL_MATCHING_PARITY_COUNT(),
                MATCHING_PARITY_COUNT(),
                LABEL_MATCHING_PARITY_PERCENT(),
                MATCHING_PARITY_PERCENT(),
                LABEL_REQUIRED_CONFIRMATIONS(),
                REQUIRED_CONFIRMATIONS(),
                LABEL_MAX_SIGNAL_AGE(),
                MAX_SIGNAL_AGE(),
                LABEL_PRIMARY_SIGNAL_SOURCE(),
                PRIMARY_SIGNAL_SOURCE(),
            ],
            [
                LABEL_COOLDOWN(),
                COOLDOWN_AFTER_TRADE(),
                LABEL_MAX_TRADES_SESSION(),
                MAX_TRADES_SESSION(),
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                LABEL_MARTINGALE_SIZE(),
                SIZE(),
            ],
            [
                CHECKBOX_STRATEGY(),
                CHECKBOX_JOURNAL(),
                CHECKBOX_DASHBOARD(),
                CHECKBOX_ONE_ACTIVE_TRADE(),
                CHECKBOX_MARTINGALE(),
            ],
        ],
    },
    CONDITIONAL_HIGH_LOW_DIFFERS: {
        name: 'conditional_high_low_differs',
        label: localize('Conditional Differs With High/Low Filter'),
        rs_strategy_name: 'conditional high low differs',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Combines a primary Digit Differs signal with a High/Low group confirmation filter. Trades only when the target belongs to the required group and meets frequency rules. Supports matching, opposite, standalone, and group-leader modes with live dashboard and journal output.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                CHECKBOX_HIGH_LOW_FILTER(),
                LABEL_HIGH_LOW_WINDOW(),
                HIGH_LOW_WINDOW(),
                LABEL_HL_FILTER_MODE(),
                HL_FILTER_MODE(),
                LABEL_THRESHOLD_TYPE(),
                THRESHOLD_TYPE(),
            ],
            [
                LABEL_DOMINANT_GROUP_COUNT(),
                DOMINANT_GROUP_COUNT(),
                LABEL_DOMINANCE_PERCENT(),
                DOMINANCE_PERCENT(),
                CHECKBOX_REQUIRE_MOST_FREQUENT(),
                LABEL_MIN_TARGET_APPEARANCES(),
                MIN_TARGET_APPEARANCES(),
                LABEL_MIN_TARGET_GROUP_SHARE(),
                MIN_TARGET_GROUP_SHARE(),
                LABEL_TIE_ACTION(),
                TIE_ACTION(),
            ],
            [
                LABEL_REQUIRED_CONFIRMATIONS(),
                REQUIRED_CONFIRMATIONS(),
                LABEL_MAX_SIGNAL_AGE(),
                MAX_SIGNAL_AGE(),
                LABEL_PRIMARY_SIGNAL_SOURCE(),
                PRIMARY_SIGNAL_SOURCE(),
                LABEL_COOLDOWN(),
                COOLDOWN_AFTER_TRADE(),
                LABEL_MAX_TRADES_SESSION(),
                MAX_TRADES_SESSION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                LABEL_MARTINGALE_SIZE(),
                SIZE(),
                CHECKBOX_STRATEGY(),
                CHECKBOX_JOURNAL(),
                CHECKBOX_DASHBOARD(),
                CHECKBOX_ONE_ACTIVE_TRADE(),
                CHECKBOX_MARTINGALE(),
            ],
        ],
    },
    CONSECUTIVE_DIGITS_OVER: {
        name: 'consecutive_digits_over',
        label: localize('Digit Successor Differs'),
        rs_strategy_name: 'digit successor differs',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Within your configured tick window, maps what digit followed each of 0–9. When the current last digit is X and X→Y was observed in that window, places Digit Differs on Y (the barrier). Uses payout-based recovery (default 9.6%). Turn off “Enable strategy” to disable.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_TICK_WINDOW(),
                TICK_WINDOW(),
                LABEL_PATTERN_THRESHOLD(),
                PATTERN_THRESHOLD(),
            ],
            [
                LABEL_PAYOUT_PERCENT(),
                PAYOUT_PERCENT(),
                LABEL_RECOVERY_SPLITS(),
                RECOVERY_SPLITS(),
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                {
                    type: 'checkbox',
                    name: 'boolean_strategy',
                    label: localize('Enable strategy'),
                    description: localize(
                        'Turn this feature on or off. When off, no Digit Successor Differs signals are produced.'
                    ),
                },
                CHECKBOX_JOURNAL(),
            ],
        ],
    },
    WINDOW_INDEX_DIFFERS: {
        name: 'window_index_differs',
        label: localize('Window Index Differs'),
        rs_strategy_name: 'window index differs',
        description: [
            {
                type: 'text',
                content: [
                    localize(
                        'Collects n digits as a reference window (indexes 1..n). In the next window of n ticks, Differs each index against the digit that was at the same index in the previous window, then rolls forward. Uses the same payout-based recovery as Digit Successor Differs (default 9.6%). Stops at your profit or consecutive-loss threshold.'
                    ),
                ],
            },
        ],
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_TICK_WINDOW(),
                TICK_WINDOW(),
            ],
            [
                LABEL_PAYOUT_PERCENT(),
                PAYOUT_PERCENT(),
                LABEL_RECOVERY_SPLITS(),
                RECOVERY_SPLITS(),
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_CONSECUTIVE_LOSS(),
                CONSECUTIVE_LOSS(),
                {
                    type: 'checkbox',
                    name: 'boolean_strategy',
                    label: localize('Enable strategy'),
                    description: localize(
                        'Turn this feature on or off. When off, no Window Index Differs signals are produced.'
                    ),
                },
                CHECKBOX_JOURNAL(),
            ],
        ],
    },
    D_ALEMBERT: {
        name: 'dalembert_max-stake',
        label: localizeDAlembert(),
        rs_strategy_name: `d'alembert`,
        description: D_ALEMBERT(),
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_TRADETYPE(),
                TRADETYPE(),
                LABEL_PURCHASE_TYPE(),
                PURCHASE_TYPE(),
                LABEL_LAST_DIGIT_PREDICTION(),
                LAST_DIGIT_PREDICTION(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_DURATION(),
                DURATION_TYPE(),
                DURATION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_DALEMBERT_UNIT(),
                UNIT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    OSCARS_GRIND: {
        name: 'oscars_grind_max-stake',
        label: localizeOscarsGrind(),
        rs_strategy_name: `oscar's-grind`,
        description: OSCARS_GRIND(),
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_TRADETYPE(),
                TRADETYPE(),
                LABEL_PURCHASE_TYPE(),
                PURCHASE_TYPE(),
                LABEL_LAST_DIGIT_PREDICTION(),
                LAST_DIGIT_PREDICTION(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_DURATION(),
                DURATION_TYPE(),
                DURATION(),
            ],
            [LABEL_PROFIT(), PROFIT(), LABEL_LOSS(), LOSS(), CHECKBOX_MAX_STAKE(), MAX_STAKE()],
        ],
    },
    REVERSE_MARTINGALE: {
        name: 'reverse_martingale',
        label: localizeReverseMartingale(),
        rs_strategy_name: 'reverse martingale',
        description: REVERSE_MARTINGALE(),
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_TRADETYPE(),
                TRADETYPE(),
                LABEL_PURCHASE_TYPE(),
                PURCHASE_TYPE(),
                LABEL_LAST_DIGIT_PREDICTION(),
                LAST_DIGIT_PREDICTION(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_DURATION(),
                DURATION_TYPE(),
                DURATION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_REVERSE_MARTINGALE_SIZE(),
                SIZE(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    REVERSE_D_ALEMBERT: {
        name: 'reverse_dalembert',
        label: localizeReverseDAlembert(),
        rs_strategy_name: `reverse d'alembert`,
        description: REVERSE_D_ALEMBERT(),
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_TRADETYPE(),
                TRADETYPE(),
                LABEL_PURCHASE_TYPE(),
                PURCHASE_TYPE(),
                LABEL_LAST_DIGIT_PREDICTION(),
                LAST_DIGIT_PREDICTION(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_DURATION(),
                DURATION_TYPE(),
                DURATION(),
            ],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_REVERSE_DALEMBERT_UNIT(),
                UNIT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    STRATEGY_1_3_2_6: {
        name: '1_3_2_6',
        label: localize1326(),
        rs_strategy_name: '1-3-2-6',
        description: STRATEGY_1_3_2_6(),
        fields: [
            [
                LABEL_SYMBOL(),
                SYMBOL(),
                LABEL_TRADETYPE(),
                TRADETYPE(),
                LABEL_PURCHASE_TYPE(),
                PURCHASE_TYPE(),
                LABEL_LAST_DIGIT_PREDICTION(),
                LAST_DIGIT_PREDICTION(),
                LABEL_STAKE(),
                STAKE(),
                LABEL_DURATION(),
                DURATION_TYPE(),
                DURATION(),
            ],
            [LABEL_PROFIT(), PROFIT(), LABEL_LOSS(), LOSS()],
        ],
    },
    ACCUMULATORS_MARTINGALE: {
        name: 'accumulators_martingale',
        label: localizeMartingale(),
        rs_strategy_name: 'accumulators_martingale',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_SIZE(),
                SIZE(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    ACCUMULATORS_DALEMBERT: {
        name: 'accumulators_dalembert',
        label: localizeDAlembert(),
        rs_strategy_name: 'accumulators_dalembert',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_UNIT(),
                UNIT(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    ACCUMULATORS_MARTINGALE_ON_STAT_RESET: {
        name: 'accumulators_martingale_on_stat_reset',
        label: localizeMartingaleOnStatReset(),
        rs_strategy_name: 'accumulators_martingale_on_stat_reset',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_SIZE(),
                SIZE(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    ACCUMULATORS_DALEMBERT_ON_STAT_RESET: {
        name: 'accumulators_dalembert_on_stat_reset',
        label: localizeDAlembergOnStatReset(),
        rs_strategy_name: 'accumulators_dalembert_on_stat_reset',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_UNIT(),
                UNIT(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    ACCUMULATORS_REVERSE_MARTINGALE: {
        name: 'accumulators_reverse_martingale',
        label: localizeReverseMartingale(),
        rs_strategy_name: 'accumulators_reverse_martingale',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_SIZE(),
                SIZE(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    ACCUMULATORS_REVERSE_MARTINGALE_ON_STAT_RESET: {
        name: 'accumulators_reverse_martingale_on_stat_reset',
        label: localizeReverseMartingaleOnStatReset(),
        rs_strategy_name: 'accumulators_reverse_martingale_on_stat_reset',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_SIZE(),
                SIZE(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    ACCUMULATORS_REVERSE_DALEMBERT: {
        name: 'accumulators_reverse_dalembert',
        label: localizeReverseDAlembert(),
        rs_strategy_name: 'accumulators_reverse_dalembert',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_UNIT(),
                UNIT(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
    ACCUMULATORS_REVERSE_DALEMBERT_ON_STAT_RESET: {
        name: 'accumulators_reverse_dalembert_on_stat_reset',
        label: localizeReverseDAlembergOnStatReset(),
        rs_strategy_name: 'accumulators_reverse_dalembert_on_stat_reset',
        description: [],
        fields: [
            [LABEL_SYMBOL(), SYMBOL(), LABEL_STAKE(), STAKE(), GROWTH_RATE(), GROWTH_RATE_VALUE()],
            [
                LABEL_PROFIT(),
                PROFIT(),
                LABEL_LOSS(),
                LOSS(),
                LABEL_ACCUMULAORTS_UNIT(),
                UNIT(),
                SELL_CONDITIONS_TYPE_INFO(),
                SELL_CONDITIONS_TYPE(),
                TAKE_PROFIT(),
                TICK_COUNT(),
                CHECKBOX_MAX_STAKE(),
                MAX_STAKE(),
            ],
        ],
    },
});
