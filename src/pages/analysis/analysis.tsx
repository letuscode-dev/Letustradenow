import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import classNames from 'classnames';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import { localize } from '@deriv-com/translations';
import { generateAnalysisSnapshot, formatAnalysisPrice } from './analysis-engine';
import type { OptionFamily } from './analysis-types';
import PriceSparkline from './price-sparkline';
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
        () => generateAnalysisSnapshot(candles, ticks, selectedSymbolInfo, timeframe, optionFamily),
        [candles, optionFamily, selectedSymbolInfo, ticks, timeframe]
    );
    const isDigitFamily = optionFamily !== 'rise_fall';
    const digitSampleSize = snapshot.digitStats?.sampleSize || 0;

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

            <div className='analysis__status-row'>
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
                <div className='analysis__stat'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {isDigitFamily ? localize('Sample') : localize('RSI')}
                    </Text>
                    <strong>{isDigitFamily ? digitSampleSize : snapshot.rsi === null ? '-' : Math.round(snapshot.rsi)}</strong>
                </div>
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
                <div className='analysis__chart-panel'>
                    <div className='analysis__chart-header'>
                        <div>
                            <Text as='h2' size='s' weight='bold'>
                                {selectedSymbolInfo?.displayName || selectedSymbol || localize('Market')}
                            </Text>
                            <Text size='xxs' color='less-prominent'>
                                {[selectedSymbolInfo?.marketDisplayName, selectedSymbolInfo?.submarketDisplayName]
                                    .filter(Boolean)
                                    .join(' / ')}
                            </Text>
                        </div>
                        <span className={`analysis__volatility analysis__volatility--${snapshot.volatility}`}>
                            {snapshot.volatility}
                        </span>
                    </div>
                    <PriceSparkline candles={candles} trend={snapshot.trend} />
                    {isDigitFamily && snapshot.digitStats ? (
                        <div className='analysis__digit-grid' aria-label='Last digit distribution'>
                            {snapshot.digitStats.counts.map((count, digit) => (
                                <div className='analysis__digit' key={digit}>
                                    <span>{digit}</span>
                                    <strong>{count}</strong>
                                    <i
                                        style={
                                            {
                                                '--digit-weight': `${Math.max(
                                                    8,
                                                    (count / Math.max(1, digitSampleSize)) * 100
                                                )}%`,
                                            } as CSSProperties
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <div className='analysis__metrics'>
                        {isDigitFamily ? (
                            <>
                                <span>Hot {snapshot.digitStats ? snapshot.digitStats.hotDigit : '-'}</span>
                                <span>Cold {snapshot.digitStats ? snapshot.digitStats.coldDigit : '-'}</span>
                                <span>Ticks {digitSampleSize}</span>
                            </>
                        ) : (
                            <>
                                <span>EMA 9 {formatAnalysisPrice(snapshot.emaFast, selectedSymbolInfo?.pip)}</span>
                                <span>EMA 21 {formatAnalysisPrice(snapshot.emaSlow, selectedSymbolInfo?.pip)}</span>
                                <span>
                                    Range{' '}
                                    {snapshot.rangeRatio === null ? '-' : `${Number(snapshot.rangeRatio).toFixed(2)}x`}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className='analysis__ideas' aria-live='polite'>
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
