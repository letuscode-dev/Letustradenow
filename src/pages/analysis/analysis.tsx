import { useMemo } from 'react';
import classNames from 'classnames';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import { localize } from '@deriv-com/translations';
import { generateAnalysisSnapshot, formatAnalysisPrice } from './analysis-engine';
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
    fall: localize('Fall'),
    rise: localize('Rise'),
    wait: localize('Wait'),
    watch: localize('Watch'),
};

const Analysis = () => {
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
        timeframe,
    } = useAnalysisMarketData();

    const snapshot = useMemo(
        () => generateAnalysisSnapshot(candles, selectedSymbolInfo, timeframe),
        [candles, selectedSymbolInfo, timeframe]
    );

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
                        {localize('Trend')}
                    </Text>
                    <strong>{snapshot.trend}</strong>
                </div>
                <div className='analysis__stat'>
                    <Text size='xxs' weight='bold' color='less-prominent'>
                        {localize('RSI')}
                    </Text>
                    <strong>{snapshot.rsi === null ? '-' : Math.round(snapshot.rsi)}</strong>
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
                    <div className='analysis__metrics'>
                        <span>EMA 9 {formatAnalysisPrice(snapshot.emaFast, selectedSymbolInfo?.pip)}</span>
                        <span>EMA 21 {formatAnalysisPrice(snapshot.emaSlow, selectedSymbolInfo?.pip)}</span>
                        <span>
                            Range{' '}
                            {snapshot.rangeRatio === null ? '-' : `${Number(snapshot.rangeRatio).toFixed(2)}x`}
                        </span>
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
