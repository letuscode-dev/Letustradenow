import { useMemo, useState } from 'react';
import classNames from 'classnames';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { observer } from 'mobx-react-lite';
import {
    DEFAULT_OVER_UNDER_BARRIER,
    DEFAULT_TICK_SAMPLE_SIZE,
    OVER_UNDER_BARRIER_OPTIONS,
    TICK_SAMPLE_OPTIONS,
} from './analysis-constants';
import { generateAnalysisSnapshot, formatAnalysisPrice } from './analysis-engine';
import type { AnalysisIdea, OptionFamily } from './analysis-types';
import {
    buildSignalBotFormData,
    getSignalBotTargets,
    isActionableSignalDirection,
    shouldBlockSignalBotRun,
    type SignalBotAction,
    type SignalBotStrategy,
} from './signal-to-bot';
import { TIMEFRAME_OPTIONS, useAnalysisMarketData } from './use-analysis-market-data';
import './analysis.scss';

const statusLabel = {
    error: localize('Offline'),
    idle: localize('Idle'),
    live: localize('Live'),
    loading: localize('Loading'),
};

const directionLabel = {
    differs: localize('Differs'),
    even: localize('Even'),
    fall: localize('Fall'),
    matches: localize('Matches'),
    odd: localize('Odd'),
    over: localize('Over'),
    rise: localize('Rise'),
    under: localize('Under'),
    wait: localize('Wait'),
    watch: localize('Watch'),
};

const OPTION_FAMILIES: Array<{ label: string; value: OptionFamily }> = [
    { label: localize('Rise/Fall'), value: 'rise_fall' },
    { label: localize('Matches/Differs'), value: 'matches_differs' },
    { label: localize('Over/Under'), value: 'over_under' },
    { label: localize('Even/Odd'), value: 'even_odd' },
];

const SIGNAL_BOT_STRATEGIES: Array<{ label: string; value: SignalBotStrategy }> = [
    { label: localize('Martingale'), value: 'MARTINGALE' },
    { label: localize("D'Alembert"), value: 'D_ALEMBERT' },
    { label: localize('Reverse Martingale'), value: 'REVERSE_MARTINGALE' },
    { label: localize("Reverse D'Alembert"), value: 'REVERSE_D_ALEMBERT' },
    { label: localize("Oscar's Grind"), value: 'OSCARS_GRIND' },
    { label: localize('1-3-2-6'), value: 'STRATEGY_1_3_2_6' },
];

const Analysis = () => {
    const store = useStore();
    const [optionFamily, setOptionFamily] = useState<OptionFamily>('rise_fall');
    const [overUnderBarrier, setOverUnderBarrier] = useState(DEFAULT_OVER_UNDER_BARRIER);
    const [signalBotStatus, setSignalBotStatus] = useState('');
    const [signalBotStrategy, setSignalBotStrategy] = useState<SignalBotStrategy>('MARTINGALE');
    const [tickSampleSize, setTickSampleSize] = useState(DEFAULT_TICK_SAMPLE_SIZE);
    const [useVolatilityGuard, setUseVolatilityGuard] = useState(true);
    const {
        candles,
        error,
        lastUpdated,
        refresh,
        selectedSymbol,
        selectedSymbolInfo,
        setSelectedSymbol,
        setTimeframe,
        status,
        symbols,
        ticks,
        timeframe,
    } = useAnalysisMarketData();

    const snapshot = useMemo(
        () =>
            generateAnalysisSnapshot(
                candles,
                ticks,
                selectedSymbolInfo,
                timeframe,
                optionFamily,
                tickSampleSize,
                overUnderBarrier
            ),
        [candles, optionFamily, overUnderBarrier, selectedSymbolInfo, tickSampleSize, ticks, timeframe]
    );
    const isDigitFamily = optionFamily !== 'rise_fall';
    const isOverUnderFamily = optionFamily === 'over_under';
    const isVolatilityRunBlocked = shouldBlockSignalBotRun(snapshot, useVolatilityGuard);
    const signalBotTargets = useMemo(
        () => getSignalBotTargets(snapshot, optionFamily, overUnderBarrier),
        [optionFamily, overUnderBarrier, snapshot]
    );
    const displayIdeas = useMemo(() => {
        const paired_directions = new Set(signalBotTargets.map(target => target.direction));
        const supporting_ideas = snapshot.ideas.filter(idea => !paired_directions.has(idea.direction));

        return [...signalBotTargets, ...supporting_ideas];
    }, [signalBotTargets, snapshot.ideas]);

    const updatedAt = lastUpdated
        ? new Intl.DateTimeFormat(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
          }).format(lastUpdated)
        : '-';

    const handleSignalBotAction = async (idea: AnalysisIdea, action: SignalBotAction) => {
        const form_data = buildSignalBotFormData({
            action,
            idea,
            option_family: optionFamily,
            over_under_barrier: overUnderBarrier,
            symbol: selectedSymbol,
        });

        if (!form_data) {
            setSignalBotStatus(localize('This signal is watch-only and cannot be converted into a bot yet.'));
            return;
        }

        if (!store?.quick_strategy || !store?.dashboard || !store?.run_panel) {
            setSignalBotStatus(localize('Bot Builder is still getting ready. Try again in a moment.'));
            return;
        }

        if (action === 'RUN' && store.run_panel.is_running) {
            setSignalBotStatus(localize('Stop the running bot before starting another signal bot.'));
            return;
        }

        if (action === 'RUN' && isVolatilityRunBlocked) {
            setSignalBotStatus(localize('Volatility guard blocked the live run while the recent range is spiking.'));
            return;
        }

        try {
            setSignalBotStatus(action === 'RUN' ? localize('Preparing signal bot...') : localize('Loading signal bot...'));
            store.quick_strategy.setSelectedStrategy(signalBotStrategy);
            await store.quick_strategy.onSubmit(form_data);

            if (action === 'LOAD') {
                store.dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            }

            setSignalBotStatus(
                action === 'RUN'
                    ? localize('{{title}} is running as a bot.', { title: idea.title })
                    : localize('{{title}} loaded in Bot Builder.', { title: idea.title })
            );
        } catch (bot_error) {
            const message =
                bot_error?.message || bot_error?.error?.message || localize('Could not create a bot from this signal.');
            setSignalBotStatus(message);
        }
    };

    return (
        <section className='analysis'>
            <div className='analysis__toolbar'>
                <div className='analysis__control analysis__control--market'>
                    <Text as='label' size='xxs' weight='bold' color='less-prominent' htmlFor='analysis-market'>
                        {localize('Market')}
                    </Text>
                    <select
                        id='analysis-market'
                        className='analysis__select'
                        value={selectedSymbol}
                        onChange={event => setSelectedSymbol(event.target.value)}
                    >
                        {symbols.map(symbol => (
                            <option key={symbol.symbol} value={symbol.symbol}>
                                {symbol.displayName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className='analysis__control'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {localize('Option')}
                    </Text>
                    <div
                        className='analysis__segments analysis__segments--families'
                        role='group'
                        aria-label='Derived option family'
                    >
                        {OPTION_FAMILIES.map(option => (
                            <button
                                key={option.value}
                                className={classNames('analysis__segment', {
                                    'analysis__segment--active': option.value === optionFamily,
                                })}
                                type='button'
                                onClick={() => setOptionFamily(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {isDigitFamily ? (
                    <div className='analysis__control analysis__control--compact'>
                        <Text as='label' size='xxs' weight='bold' color='less-prominent' htmlFor='analysis-sample'>
                            {localize('Tick sample')}
                        </Text>
                        <select
                            id='analysis-sample'
                            className='analysis__select'
                            value={tickSampleSize}
                            onChange={event => setTickSampleSize(Number(event.target.value))}
                        >
                            {TICK_SAMPLE_OPTIONS.map(sampleSize => (
                                <option key={sampleSize} value={sampleSize}>
                                    {sampleSize}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}

                {isOverUnderFamily ? (
                    <div className='analysis__control analysis__control--compact'>
                        <Text as='label' size='xxs' weight='bold' color='less-prominent' htmlFor='analysis-barrier'>
                            {localize('Barrier')}
                        </Text>
                        <select
                            id='analysis-barrier'
                            className='analysis__select'
                            value={overUnderBarrier}
                            onChange={event => setOverUnderBarrier(Number(event.target.value))}
                        >
                            {OVER_UNDER_BARRIER_OPTIONS.map(barrier => (
                                <option key={barrier} value={barrier}>
                                    {barrier}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}

                <div className='analysis__control'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {localize('Timeframe')}
                    </Text>
                    <div className='analysis__segments' role='group' aria-label='Timeframe'>
                        {TIMEFRAME_OPTIONS.map(option => (
                            <button
                                key={option.granularity}
                                className={classNames('analysis__segment', {
                                    'analysis__segment--active': option.granularity === timeframe.granularity,
                                })}
                                type='button'
                                onClick={() => setTimeframe(option)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className='analysis__control analysis__control--bot-style'>
                    <Text as='label' size='xxs' weight='bold' color='less-prominent' htmlFor='analysis-bot-style'>
                        {localize('Bot style')}
                    </Text>
                    <select
                        id='analysis-bot-style'
                        className='analysis__select'
                        value={signalBotStrategy}
                        onChange={event => setSignalBotStrategy(event.target.value as SignalBotStrategy)}
                    >
                        {SIGNAL_BOT_STRATEGIES.map(strategy => (
                            <option key={strategy.value} value={strategy.value}>
                                {strategy.label}
                            </option>
                        ))}
                    </select>
                </div>

                <label className='analysis__toggle'>
                    <input
                        checked={useVolatilityGuard}
                        onChange={event => setUseVolatilityGuard(event.target.checked)}
                        type='checkbox'
                    />
                    <span>{localize('Volatility guard')}</span>
                </label>

                <Button className='analysis__refresh' tertiary type='button' onClick={refresh}>
                    {localize('Refresh')}
                </Button>
            </div>

            <div
                className={classNames('analysis__status-row', {
                    'analysis__status-row--compact': isDigitFamily,
                })}
            >
                <div className='analysis__stat'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {localize('Status')}
                    </Text>
                    <span className={classNames('analysis__status', `analysis__status--${status}`)}>
                        {statusLabel[status]}
                    </span>
                </div>
                <div className='analysis__stat'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {localize('Last price')}
                    </Text>
                    <strong>{formatAnalysisPrice(snapshot.lastPrice, selectedSymbolInfo?.pip)}</strong>
                </div>
                <div className='analysis__stat'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {isDigitFamily ? localize('Last digit') : localize('Trend')}
                    </Text>
                    <strong>{isDigitFamily ? snapshot.digitStats?.lastDigit ?? '-' : snapshot.trend}</strong>
                </div>
                {!isDigitFamily ? (
                    <div className='analysis__stat'>
                        <Text size='xxs' weight='bold' color='less-prominent'>
                            {localize('RSI')}
                        </Text>
                        <strong>{snapshot.rsi === null ? '-' : Math.round(snapshot.rsi)}</strong>
                    </div>
                ) : null}
                <div className='analysis__stat'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {localize('Updated')}
                    </Text>
                    <strong>{updatedAt}</strong>
                </div>
            </div>

            {error ? (
                <div className='analysis__error'>
                    <Text size='xs' weight='bold'>
                        {error}
                    </Text>
                </div>
            ) : null}

            {signalBotStatus ? (
                <div className='analysis__signal-status'>
                    <Text size='xs' weight='bold'>
                        {signalBotStatus}
                    </Text>
                </div>
            ) : null}

            <div className='analysis__body'>
                {isVolatilityRunBlocked ? (
                    <div className='analysis__guard-note'>
                        <span>{localize('Volatility guard active')}</span>
                    </div>
                ) : null}
                <div
                    className={classNames('analysis__ideas', {
                        'analysis__ideas--compact': isDigitFamily,
                    })}
                    aria-live='polite'
                >
                    {displayIdeas.map(idea => {
                        const is_actionable = isActionableSignalDirection(idea.direction);
                        const is_run_disabled =
                            Boolean(store?.run_panel?.is_running) || Boolean(isVolatilityRunBlocked);

                        return (
                            <article
                                className={classNames('analysis-idea', `analysis-idea--${idea.direction}`)}
                                key={idea.id}
                            >
                                <div className='analysis-idea__header'>
                                    <span className='analysis-idea__direction'>{directionLabel[idea.direction]}</span>
                                    <span className='analysis-idea__confidence'>{idea.confidence}%</span>
                                </div>
                                <Text as='h3' size='s' weight='bold'>
                                    {idea.title}
                                </Text>
                                <div className='analysis-idea__meta'>
                                    <span>{formatAnalysisPrice(idea.price, selectedSymbolInfo?.pip)}</span>
                                    {idea.prediction ? <span>{idea.prediction}</span> : null}
                                    <span>{idea.horizon}</span>
                                </div>
                                <div className='analysis-idea__reasons'>
                                    {idea.reasons.map(reason => (
                                        <span key={reason}>{reason}</span>
                                    ))}
                                </div>
                                <Text size='xxs' color='less-prominent'>
                                    {idea.invalidation}
                                </Text>
                                {is_actionable ? (
                                    <div className='analysis-idea__actions'>
                                        <Button
                                            className='analysis-idea__button'
                                            onClick={() => handleSignalBotAction(idea, 'LOAD')}
                                            secondary
                                            small
                                            type='button'
                                        >
                                            {localize('Load bot')}
                                        </Button>
                                        <Button
                                            className='analysis-idea__button'
                                            is_disabled={is_run_disabled}
                                            onClick={() => handleSignalBotAction(idea, 'RUN')}
                                            primary
                                            small
                                            type='button'
                                        >
                                            {localize('Run bot')}
                                        </Button>
                                    </div>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default observer(Analysis);
