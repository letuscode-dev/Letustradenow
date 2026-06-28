import { useMemo, useState } from 'react';
import classNames from 'classnames';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import { localize } from '@deriv-com/translations';
import {
    DEFAULT_OVER_UNDER_BARRIER,
    DEFAULT_TICK_SAMPLE_SIZE,
    OVER_UNDER_BARRIER_OPTIONS,
    TICK_SAMPLE_OPTIONS,
} from './analysis-constants';
import { generateAnalysisSnapshot, formatAnalysisPrice } from './analysis-engine';
import type { OptionFamily } from './analysis-types';
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

const Analysis = () => {
    const [optionFamily, setOptionFamily] = useState<OptionFamily>('rise_fall');
    const [overUnderBarrier, setOverUnderBarrier] = useState(DEFAULT_OVER_UNDER_BARRIER);
    const [tickSampleSize, setTickSampleSize] = useState(DEFAULT_TICK_SAMPLE_SIZE);
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

    const updatedAt = lastUpdated
        ? new Intl.DateTimeFormat(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
          }).format(lastUpdated)
        : '-';

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

            <div className='analysis__body'>
                <div
                    className={classNames('analysis__ideas', {
                        'analysis__ideas--compact': isDigitFamily,
                    })}
                    aria-live='polite'
                >
                    {snapshot.ideas.map(idea => (
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
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Analysis;
