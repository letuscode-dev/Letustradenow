import { useMemo, useState } from 'react';
import classNames from 'classnames';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { observer } from 'mobx-react-lite';
import { formatAnalysisPrice } from './analysis-engine';
import { computeDigitDistribution, DEFAULT_DIGIT_TICKS, DIGIT_TICK_OPTIONS, OVER_DIGIT, UNDER_DIGIT } from './digit-distribution';
import { useAnalysisMarketData } from './use-analysis-market-data';
import './analysis.scss';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const splitLabel = (left: string, right: string, leftPercent: number, rightPercent: number) => (
    <div className='digits__split'>
        <div className='digits__split-labels'>
            <span>
                {left} {formatPercent(leftPercent)}
            </span>
            <span>
                {right} {formatPercent(rightPercent)}
            </span>
        </div>
        <div className='digits__track' aria-hidden='true'>
            <span className='digits__track-left' style={{ width: `${leftPercent}%` }} />
            <span className='digits__track-right' style={{ width: `${rightPercent}%` }} />
        </div>
    </div>
);

const Analysis = () => {
    const store = useStore();
    const [tickSampleSize, setTickSampleSize] = useState(DEFAULT_DIGIT_TICKS);
    const { error, selectedSymbol, selectedSymbolInfo, setSelectedSymbol, status, symbols, ticks } =
        useAnalysisMarketData();

    const board = useMemo(
        () => computeDigitDistribution(ticks, tickSampleSize),
        [tickSampleSize, ticks]
    );

    const closePanel = () => {
        store?.dashboard?.setActiveTab(DBOT_TABS.DASHBOARD);
    };

    return (
        <section className='digits'>
            <header className='digits__header'>
                <div className='digits__heading'>
                    <p className='digits__kicker'>{localize('Live analysis')}</p>
                    <h2 className='digits__title'>{localize('Digit Distribution')}</h2>
                </div>
                <div className='digits__header-actions'>
                    <label className='digits__ticks' htmlFor='digits-ticks'>
                        <span>{localize('Ticks')}</span>
                        <select
                            id='digits-ticks'
                            value={tickSampleSize}
                            onChange={event => setTickSampleSize(Number(event.target.value))}
                        >
                            {DIGIT_TICK_OPTIONS.map(sampleSize => (
                                <option key={sampleSize} value={sampleSize}>
                                    {sampleSize}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className='digits__close' type='button' aria-label={localize('Close')} onClick={closePanel}>
                        ×
                    </button>
                </div>
            </header>

            <div className='digits__body'>
                <div className='digits__summary'>
                    <label className='digits__market' htmlFor='digits-market'>
                        <span className='digits__eyebrow'>{localize('Selected market')}</span>
                        <select
                            id='digits-market'
                            className='digits__market-select'
                            value={selectedSymbol}
                            onChange={event => setSelectedSymbol(event.target.value)}
                        >
                            {symbols.map(symbol => (
                                <option key={symbol.symbol} value={symbol.symbol}>
                                    {symbol.displayName}
                                </option>
                            ))}
                        </select>
                        <strong className='digits__code'>{selectedSymbol || '—'}</strong>
                    </label>
                    <div className='digits__price'>
                        <span className='digits__eyebrow'>{localize('Current price')}</span>
                        <strong>{status === 'loading' ? '…' : formatAnalysisPrice(board.lastPrice, selectedSymbolInfo?.pip)}</strong>
                    </div>
                </div>

                {error ? <p className='digits__error'>{error}</p> : null}

                <div className='digits__grid' role='list' aria-label={localize('Digit percentages')}>
                    {board.percents.map((percent, digit) => {
                        const isHot = digit === board.hotDigit;
                        return (
                            <div
                                key={digit}
                                role='listitem'
                                className={classNames('digits__cell', { 'digits__cell--hot': isHot })}
                            >
                                <span className='digits__bubble' aria-current={isHot ? 'true' : undefined}>
                                    <span className='digits__digit'>{digit}</span>
                                    <span className='digits__percent'>{formatPercent(percent)}</span>
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className='digits__recent' aria-label={localize('Latest digits')}>
                    {board.recentDigits.map((digit, index) => {
                        const isLatest = index === board.recentDigits.length - 1;
                        return (
                            <span
                                key={`${digit}-${index}`}
                                className={classNames('digits__chip', { 'digits__chip--latest': isLatest })}
                            >
                                {digit}
                            </span>
                        );
                    })}
                </div>

                <div className='digits__bars'>
                    {splitLabel(localize('Even'), localize('Odd'), board.evenPercent, board.oddPercent)}
                    {splitLabel(localize('Rise'), localize('Fall'), board.risePercent, board.fallPercent)}
                    {splitLabel(
                        `${localize('Over')} ${OVER_DIGIT}`,
                        `${localize('Under')} ${UNDER_DIGIT}`,
                        board.overPercent,
                        board.underPercent
                    )}
                </div>
            </div>
        </section>
    );
};

export default observer(Analysis);
