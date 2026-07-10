// @ts-nocheck -- this page bridges typed React code with vendored Blockly/runtime APIs.
import React from 'react';
import { observer } from 'mobx-react-lite';
import Button from '@/components/shared_ui/button';
import { ApiHelpers } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import './automated-strategies.scss';

const ASSETS = [
    { text: 'Volatility 100 (1s) Index', value: '1HZ100V' },
    { text: 'Volatility 75 (1s) Index', value: '1HZ75V' },
    { text: 'Volatility 50 (1s) Index', value: '1HZ50V' },
    { text: 'Volatility 25 (1s) Index', value: '1HZ25V' },
    { text: 'Volatility 100 Index', value: 'R_100' },
    { text: 'Volatility 75 Index', value: 'R_75' },
    { text: 'Volatility 50 Index', value: 'R_50' },
    { text: 'Volatility 25 Index', value: 'R_25' },
];

const OPTION_CONTRACT_TYPES = [
    { text: localize('Rise/Fall'), value: 'callput', ready: true },
    { text: localize('Rise/Fall Equal'), value: 'callputequal', ready: true },
    { text: localize('Asians'), value: 'asians', ready: true },
    { text: localize('Matches/Differs'), value: 'matchesdiffers', ready: true },
    { text: localize('Even/Odd'), value: 'evenodd', ready: true },
    { text: localize('Over/Under'), value: 'overunder', ready: true },
    { text: localize('Reset Call/Reset Put'), value: 'reset', ready: true },
    { text: localize('Only Ups/Only Downs'), value: 'runs', ready: true },
    { text: localize('Higher/Lower'), value: 'higherlower', ready: true },
    { text: localize('Touch/No Touch'), value: 'touchnotouch', ready: true },
    { text: localize('Ends In/Out'), value: 'endsinout', ready: true },
    { text: localize('Stays In/Out'), value: 'staysinout', ready: true },
    { text: localize('High/Low Ticks'), value: 'highlowticks', ready: false },
    { text: localize('Call Spread/Put Spread'), value: 'callputspread', ready: false },
];

const DEFAULT_PURCHASE_OPTIONS = {
    callput: [
        { text: localize('Rise'), value: 'CALL' },
        { text: localize('Fall'), value: 'PUT' },
    ],
    callputequal: [
        { text: localize('Rise Equals'), value: 'CALLE' },
        { text: localize('Fall Equals'), value: 'PUTE' },
    ],
    asians: [
        { text: localize('Asian Up'), value: 'ASIANU' },
        { text: localize('Asian Down'), value: 'ASIAND' },
    ],
    matchesdiffers: [
        { text: localize('Matches'), value: 'DIGITMATCH' },
        { text: localize('Differs'), value: 'DIGITDIFF' },
    ],
    evenodd: [
        { text: localize('Even'), value: 'DIGITEVEN' },
        { text: localize('Odd'), value: 'DIGITODD' },
    ],
    overunder: [
        { text: localize('Over'), value: 'DIGITOVER' },
        { text: localize('Under'), value: 'DIGITUNDER' },
    ],
    higherlower: [
        { text: localize('Higher'), value: 'CALL' },
        { text: localize('Lower'), value: 'PUT' },
    ],
    touchnotouch: [
        { text: localize('Touch'), value: 'ONETOUCH' },
        { text: localize('No Touch'), value: 'NOTOUCH' },
    ],
    endsinout: [
        { text: localize('Ends Between'), value: 'EXPIRYRANGE' },
        { text: localize('Ends Outside'), value: 'EXPIRYMISS' },
    ],
    staysinout: [
        { text: localize('Stays Between'), value: 'RANGE' },
        { text: localize('Goes Outside'), value: 'UPORDOWN' },
    ],
    reset: [
        { text: localize('Reset Call'), value: 'RESETCALL' },
        { text: localize('Reset Put'), value: 'RESETPUT' },
    ],
    runs: [
        { text: localize('Only Ups'), value: 'RUNHIGH' },
        { text: localize('Only Downs'), value: 'RUNLOW' },
    ],
};

const STRATEGIES = [
    { text: localize('Martingale'), value: 'MARTINGALE' },
    { text: localize("D'Alembert"), value: 'D_ALEMBERT' },
    { text: localize('Reverse Martingale'), value: 'REVERSE_MARTINGALE' },
    { text: localize("Reverse D'Alembert"), value: 'REVERSE_D_ALEMBERT' },
    { text: localize("Oscar's Grind"), value: 'OSCARS_GRIND' },
    { text: localize('1-3-2-6'), value: 'STRATEGY_1_3_2_6' },
];

const DIGIT_CONTRACT_TYPES = ['matchesdiffers', 'overunder'];
const SINGLE_BARRIER_CONTRACT_TYPES = ['higherlower', 'touchnotouch'];
const DOUBLE_BARRIER_CONTRACT_TYPES = ['endsinout', 'staysinout'];
const BARRIER_TYPE_OPTIONS = [
    { text: localize('Offset +'), value: '+' },
    { text: localize('Offset -'), value: '-' },
    { text: localize('Absolute'), value: 'absolute' },
];

const AutomatedStrategies = () => {
    const { dashboard, quick_strategy, run_panel } = useStore();
    const [symbol, setSymbol] = React.useState('1HZ100V');
    const [tradeType, setTradeType] = React.useState('callput');
    const [purchaseType, setPurchaseType] = React.useState('CALL');
    const [strategy, setStrategy] = React.useState('MARTINGALE');
    const [stake, setStake] = React.useState('1');
    const [duration, setDuration] = React.useState('5');
    const [durationType, setDurationType] = React.useState('t');
    const [profit, setProfit] = React.useState('5');
    const [loss, setLoss] = React.useState('10');
    const [progressionSize, setProgressionSize] = React.useState('2');
    const [unit, setUnit] = React.useState('1');
    const [maxStake, setMaxStake] = React.useState('25');
    const [lastDigitPrediction, setLastDigitPrediction] = React.useState('5');
    const [barrierOffset, setBarrierOffset] = React.useState('1');
    const [barrierOffsetType, setBarrierOffsetType] = React.useState('+');
    const [secondBarrierOffset, setSecondBarrierOffset] = React.useState('1');
    const [secondBarrierOffsetType, setSecondBarrierOffsetType] = React.useState('-');
    const [purchaseOptions, setPurchaseOptions] = React.useState(DEFAULT_PURCHASE_OPTIONS.callput);
    const [status, setStatus] = React.useState('');

    const selectedContractType = OPTION_CONTRACT_TYPES.find(contract => contract.value === tradeType);
    const isDigitContract = DIGIT_CONTRACT_TYPES.includes(tradeType);
    const hasSingleBarrier = SINGLE_BARRIER_CONTRACT_TYPES.includes(tradeType);
    const hasDoubleBarrier = DOUBLE_BARRIER_CONTRACT_TYPES.includes(tradeType);
    const hasBarrier = hasSingleBarrier || hasDoubleBarrier;

    React.useEffect(() => {
        let should_update = true;

        const loadPurchaseOptions = async () => {
            const fallback = DEFAULT_PURCHASE_OPTIONS[tradeType] || [];
            const contracts_for = ApiHelpers?.instance?.contracts_for;

            try {
                const api_options = await contracts_for?.getContractTypes?.(tradeType);
                const next_options = api_options?.length ? api_options : fallback;

                if (!should_update) return;

                setPurchaseOptions(next_options);
                if (!next_options.some(option => option.value === purchaseType)) {
                    setPurchaseType(next_options[0]?.value || '');
                }
            } catch (error) {
                if (!should_update) return;
                setPurchaseOptions(fallback);
                setPurchaseType(fallback[0]?.value || '');
            }
        };

        loadPurchaseOptions();

        return () => {
            should_update = false;
        };
    }, [purchaseType, tradeType]);

    React.useEffect(() => {
        if (!hasBarrier) return undefined;

        let should_update = true;

        const loadBarrierDefaults = async () => {
            const contracts_for = ApiHelpers?.instance?.contracts_for;

            try {
                const barriers = await contracts_for?.getBarriers?.(symbol, tradeType, durationType, [
                    barrierOffsetType,
                    secondBarrierOffsetType,
                ]);

                if (!should_update || !barriers?.values?.length) return;

                const [first_barrier, second_barrier] = barriers.values;
                if (first_barrier !== undefined && first_barrier !== false) {
                    setBarrierOffset(String(first_barrier));
                }
                if (hasDoubleBarrier && second_barrier !== undefined && second_barrier !== false) {
                    setSecondBarrierOffset(String(second_barrier));
                }
            } catch {
                // Keep the current editable defaults when the API cannot provide barrier hints.
            }
        };

        loadBarrierDefaults();

        return () => {
            should_update = false;
        };
    }, [barrierOffsetType, durationType, hasBarrier, hasDoubleBarrier, secondBarrierOffsetType, symbol, tradeType]);

    const submitStrategy = async (action: 'RUN' | 'LOAD') => {
        const selected_strategy = STRATEGIES.find(item => item.value === strategy);

        if (!selectedContractType?.ready) {
            setStatus(localize('This contract type is queued for the next strategy engine expansion.'));
            return;
        }

        if (!purchaseType) {
            setStatus(localize('Select a purchase condition first.'));
            return;
        }

        if (action === 'RUN' && run_panel.is_running) {
            setStatus(localize('Stop the running bot before starting another automated strategy.'));
            return;
        }

        try {
            setStatus(action === 'RUN' ? localize('Preparing automated strategy...') : localize('Loading strategy...'));
            quick_strategy.setSelectedStrategy(strategy);
            await quick_strategy.onSubmit({
                action,
                symbol,
                tradetype: tradeType,
                type: purchaseType,
                stake,
                duration,
                durationtype: durationType,
                profit,
                loss,
                size: progressionSize,
                unit,
                max_stake: maxStake,
                boolean_max_stake: true,
                last_digit_prediction: lastDigitPrediction,
                barrieroffset: barrierOffset,
                barrieroffsettype: barrierOffsetType,
                secondbarrieroffset: secondBarrierOffset,
                secondbarrieroffsettype: secondBarrierOffsetType,
            });

            if (action === 'LOAD') {
                dashboard.setActiveTab(1);
            }

            setStatus(
                action === 'RUN'
                    ? localize('{{strategy}} is running.', { strategy: selected_strategy?.text || '' })
                    : localize('{{strategy}} loaded in Bot Builder.', { strategy: selected_strategy?.text || '' })
            );
        } catch (error) {
            const message = error?.message || error?.error?.message || localize('Could not prepare this strategy.');
            setStatus(message);
        }
    };

    return (
        <div className='automated-strategies'>
            <div className='automated-strategies__panel'>
                <div className='automated-strategies__grid'>
                    <label className='automated-strategies__control automated-strategies__control--wide'>
                        <span>{localize('Asset')}</span>
                        <select value={symbol} onChange={event => setSymbol(event.target.value)}>
                            {ASSETS.map(asset => (
                                <option key={asset.value} value={asset.value}>
                                    {asset.text}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className='automated-strategies__control automated-strategies__control--wide'>
                        <span>{localize('Contract type')}</span>
                        <select value={tradeType} onChange={event => setTradeType(event.target.value)}>
                            {OPTION_CONTRACT_TYPES.map(contract => (
                                <option key={contract.value} value={contract.value} disabled={!contract.ready}>
                                    {contract.ready ? contract.text : `${contract.text} (${localize('next')})`}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('Purchase')}</span>
                        <select value={purchaseType} onChange={event => setPurchaseType(event.target.value)}>
                            {purchaseOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.text}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className='automated-strategies__control automated-strategies__control--wide'>
                        <span>{localize('Strategy')}</span>
                        <select value={strategy} onChange={event => setStrategy(event.target.value)}>
                            {STRATEGIES.map(item => (
                                <option key={item.value} value={item.value}>
                                    {item.text}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('Stake')}</span>
                        <input min='0.35' step='0.01' type='number' value={stake} onChange={event => setStake(event.target.value)} />
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('Duration')}</span>
                        <input min='1' step='1' type='number' value={duration} onChange={event => setDuration(event.target.value)} />
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('Unit')}</span>
                        <select value={durationType} onChange={event => setDurationType(event.target.value)}>
                            <option value='t'>{localize('Ticks')}</option>
                            <option value='s'>{localize('Seconds')}</option>
                            <option value='m'>{localize('Minutes')}</option>
                        </select>
                    </label>

                    {isDigitContract && (
                        <label className='automated-strategies__control'>
                            <span>{localize('Digit')}</span>
                            <select value={lastDigitPrediction} onChange={event => setLastDigitPrediction(event.target.value)}>
                                {Array.from({ length: 10 }, (_, digit) => (
                                    <option key={digit} value={digit}>
                                        {digit}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {hasBarrier && (
                        <>
                            <label className='automated-strategies__control'>
                                <span>{hasDoubleBarrier ? localize('High barrier type') : localize('Barrier type')}</span>
                                <select value={barrierOffsetType} onChange={event => setBarrierOffsetType(event.target.value)}>
                                    {BARRIER_TYPE_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.text}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className='automated-strategies__control'>
                                <span>{hasDoubleBarrier ? localize('High barrier') : localize('Barrier')}</span>
                                <input
                                    min='0'
                                    step='0.01'
                                    type='number'
                                    value={barrierOffset}
                                    onChange={event => setBarrierOffset(event.target.value)}
                                />
                            </label>
                        </>
                    )}

                    {hasDoubleBarrier && (
                        <>
                            <label className='automated-strategies__control'>
                                <span>{localize('Low barrier type')}</span>
                                <select
                                    value={secondBarrierOffsetType}
                                    onChange={event => setSecondBarrierOffsetType(event.target.value)}
                                >
                                    {BARRIER_TYPE_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.text}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className='automated-strategies__control'>
                                <span>{localize('Low barrier')}</span>
                                <input
                                    min='0'
                                    step='0.01'
                                    type='number'
                                    value={secondBarrierOffset}
                                    onChange={event => setSecondBarrierOffset(event.target.value)}
                                />
                            </label>
                        </>
                    )}

                    <label className='automated-strategies__control'>
                        <span>{localize('Profit stop')}</span>
                        <input min='1' step='0.01' type='number' value={profit} onChange={event => setProfit(event.target.value)} />
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('Loss stop')}</span>
                        <input min='1' step='0.01' type='number' value={loss} onChange={event => setLoss(event.target.value)} />
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('Progression')}</span>
                        <input min='1' step='1' type='number' value={progressionSize} onChange={event => setProgressionSize(event.target.value)} />
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('D\'Alembert unit')}</span>
                        <input min='1' step='1' type='number' value={unit} onChange={event => setUnit(event.target.value)} />
                    </label>

                    <label className='automated-strategies__control'>
                        <span>{localize('Max stake')}</span>
                        <input min='1' step='0.01' type='number' value={maxStake} onChange={event => setMaxStake(event.target.value)} />
                    </label>
                </div>

                <div className='automated-strategies__actions'>
                    <Button
                        className='automated-strategies__button'
                        is_disabled={run_panel.is_running}
                        onClick={() => submitStrategy('RUN')}
                        primary
                        type='button'
                    >
                        {localize('Run strategy')}
                    </Button>
                    <Button
                        className='automated-strategies__button'
                        onClick={() => submitStrategy('LOAD')}
                        secondary
                        type='button'
                    >
                        {localize('Load in Bot Builder')}
                    </Button>
                    {status && <div className='automated-strategies__status'>{status}</div>}
                </div>
            </div>

        </div>
    );
};

export default observer(AutomatedStrategies);
