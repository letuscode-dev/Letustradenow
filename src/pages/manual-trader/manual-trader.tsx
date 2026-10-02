import React, { useMemo, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import {
    clampInt,
    DEFAULT_TICK_WINDOW,
    DIGITS,
    getDigitRanks,
    getDigitStats,
    getPredictionBounds,
    getSideProbability,
    getTradeType,
    MAX_BULK_TRADES,
    MAX_DURATION_TICKS,
    MAX_TICK_WINDOW,
    MIN_TICK_WINDOW,
    TRADE_TYPES,
    type TradeTypeId,
} from './manual-trader-utils';
import { useManualTraderTicks } from './use-manual-trader-ticks';
import { type ManualTrade, useManualTrades } from './use-manual-trades';
import './manual-trader.scss';

const MIN_STAKE = 0.35;
const WINDOW_PRESETS = [50, 120, 500, 1000];
const STAKE_PRESETS = [0.5, 1, 2, 5, 10];
const RECENT_DIGITS = 24;

const RANK_LABELS = {
    most: 'Most',
    second_most: '2nd most',
    second_least: '2nd least',
    least: 'Least',
};

const formatMoney = (value: number | undefined, currency: string) =>
    value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(2)} ${currency}`;

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

const decimalsForPip = (pip?: number) => (pip && pip > 0 ? Math.max(0, Math.round(-Math.log10(pip))) : 2);

const Stepper = ({
    id,
    label,
    value,
    onChange,
    min,
    max,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    min: number;
    max: number;
}) => {
    const current = clampInt(value, min, min, max);
    return (
        <div className='manual-trader__field'>
            <label className='manual-trader__label' htmlFor={id}>
                {label}
            </label>
            <div className='manual-trader__stepper'>
                <button
                    type='button'
                    aria-label={localize('Decrease')}
                    disabled={current <= min}
                    onClick={() => onChange(String(current - 1))}
                >
                    −
                </button>
                <input
                    id={id}
                    inputMode='numeric'
                    max={max}
                    min={min}
                    type='number'
                    value={value}
                    onBlur={() => onChange(String(current))}
                    onChange={event => onChange(event.target.value)}
                />
                <button
                    type='button'
                    aria-label={localize('Increase')}
                    disabled={current >= max}
                    onClick={() => onChange(String(current + 1))}
                >
                    +
                </button>
            </div>
        </div>
    );
};

const TradeRow = ({ trade, currency }: { trade: ManualTrade; currency: string }) => {
    const status_text = {
        buying: localize('Buying'),
        open: localize('Running'),
        won: localize('Won'),
        lost: localize('Lost'),
        error: localize('Failed'),
    }[trade.status];
    return (
        <li className={classNames('manual-trader__trade', `manual-trader__trade--${trade.status}`)}>
            <span className='manual-trader__trade-main'>
                <strong>{trade.label}</strong>
                <small>
                    {trade.symbol}
                    {trade.latency_ms !== undefined && ` · ${(trade.latency_ms / 1000).toFixed(2)}s`}
                </small>
            </span>
            <span className='manual-trader__trade-stake'>{formatMoney(trade.buy_price ?? trade.stake, currency)}</span>
            <span className='manual-trader__trade-exit'>{trade.exit_digit ?? '—'}</span>
            <span className={classNames('manual-trader__pill', `manual-trader__pill--${trade.status}`)}>
                {status_text}
            </span>
            <span className='manual-trader__trade-profit' title={trade.message}>
                {trade.status === 'error'
                    ? trade.message
                    : trade.profit !== undefined && trade.status !== 'buying'
                      ? signed(trade.profit)
                      : '—'}
            </span>
        </li>
    );
};

const ManualTrader = () => {
    const { isAuthorized, authData } = useApiBase();
    const { run_panel } = useStore();
    const { isDesktop } = useDevice();
    const { symbols, symbol, setSymbol, symbol_info, ticks, status, error } = useManualTraderTicks();

    const [window_input, setWindowInput] = useState(String(DEFAULT_TICK_WINDOW));
    const [trade_type_id, setTradeTypeId] = useState<TradeTypeId>('matches_differs');
    const [duration_input, setDurationInput] = useState('1');
    const [prediction, setPrediction] = useState(5);
    const [stake_input, setStakeInput] = useState('0.5');
    const [bulk_input, setBulkInput] = useState('1');

    const trade_type = getTradeType(trade_type_id);
    const tick_window = clampInt(window_input, DEFAULT_TICK_WINDOW, MIN_TICK_WINDOW, MAX_TICK_WINDOW);
    const duration = clampInt(duration_input, 1, 1, MAX_DURATION_TICKS);
    const bulk = clampInt(bulk_input, 1, 1, MAX_BULK_TRADES);
    const stake = Math.round(Number(stake_input) * 100) / 100;
    const stake_valid = Number.isFinite(stake) && stake >= MIN_STAKE;
    const currency =
        authData?.currency || (api_base.account_info as { currency?: string } | undefined)?.currency || 'USD';

    const digits = useMemo(() => ticks.map(t => t.digit), [ticks]);
    const stats = useMemo(() => getDigitStats(digits, tick_window), [digits, tick_window]);
    const ranks = useMemo(() => getDigitRanks(stats), [stats]);
    const most = stats.find(s => ranks[s.digit] === 'most');
    const least = stats.find(s => ranks[s.digit] === 'least');
    const even_pct = stats.filter(s => s.digit % 2 === 0).reduce((total, s) => total + s.pct, 0);
    const last_tick = ticks.length ? ticks[ticks.length - 1] : null;
    const previous_tick = ticks.length > 1 ? ticks[ticks.length - 2] : null;
    const current_digit = last_tick ? last_tick.digit : null;
    const sample_size = Math.min(digits.length, tick_window);
    const recent = digits.slice(-RECENT_DIGITS);
    const price_text = last_tick ? last_tick.quote.toFixed(decimalsForPip(symbol_info?.pip)) : '—';
    const price_direction =
        last_tick && previous_tick ? Math.sign(last_tick.quote - previous_tick.quote) : 0;

    const side_types = trade_type.sides.map(s => s.contract_type) as [string, string];
    const { quotes, trades, buy, clearTrades } = useManualTrades({
        enabled: isAuthorized && !!symbol && stake_valid,
        contract_types: side_types,
        pool_size: bulk,
        params: {
            symbol,
            stake,
            duration,
            currency,
            prediction: trade_type.uses_prediction ? prediction : undefined,
        },
    });

    const settled = trades.filter(t => t.status === 'won' || t.status === 'lost');
    const running = trades.filter(t => t.status === 'open' || t.status === 'buying').length;
    const session_profit = settled.reduce((total, t) => total + (t.profit || 0), 0);
    const wins = settled.filter(t => t.status === 'won').length;
    const win_rate = settled.length ? (wins / settled.length) * 100 : 0;

    const onDigitClick = (digit: number) => {
        if (trade_type.uses_prediction) setPrediction(digit);
    };

    const nudgeStake = (delta: number) => {
        const base = Number.isFinite(stake) ? stake : MIN_STAKE;
        setStakeInput(String(Math.max(MIN_STAKE, Math.round((base + delta) * 100) / 100)));
    };

    return (
        <div
            className={classNames('manual-trader', {
                'manual-trader--with-panel': run_panel.is_drawer_open && isDesktop,
            })}
        >
            <header className='manual-trader__hero'>
                <div className='manual-trader__hero-text'>
                    <h2 className='manual-trader__title'>
                        <Localize i18n_default_text='Manual Trader' />
                    </h2>
                    <p className='manual-trader__subtitle'>
                        <Localize i18n_default_text='Live digit stats with instant one-click execution.' />
                    </p>
                </div>
                <div className='manual-trader__ticker'>
                    <div className='manual-trader__ticker-meta'>
                        <span className='manual-trader__ticker-market'>{symbol_info?.displayName || symbol || '—'}</span>
                        <span className={classNames('manual-trader__live', `manual-trader__live--${status}`)}>
                            {status === 'live'
                                ? localize('Live')
                                : status === 'loading'
                                  ? localize('Loading')
                                  : status === 'error'
                                    ? localize('Offline')
                                    : localize('Connecting')}
                        </span>
                    </div>
                    <span
                        className={classNames('manual-trader__price', {
                            'manual-trader__price--up': price_direction > 0,
                            'manual-trader__price--down': price_direction < 0,
                        })}
                    >
                        {price_text.slice(0, -1)}
                        <em>{price_text.slice(-1)}</em>
                    </span>
                </div>
            </header>

            <div className='manual-trader__layout'>
                <section className='manual-trader__card manual-trader__card--digits'>
                    <div className='manual-trader__card-head'>
                        <div>
                            <h3 className='manual-trader__card-title'>{localize('Digit distribution')}</h3>
                            <span className='manual-trader__hint'>
                                {localize('{{sample}} of {{window}} ticks', { sample: sample_size, window: tick_window })}
                            </span>
                        </div>
                        <div className='manual-trader__window'>
                            <div className='manual-trader__segmented manual-trader__segmented--compact'>
                                {WINDOW_PRESETS.map(size => (
                                    <button
                                        key={size}
                                        type='button'
                                        className={classNames({ 'is-active': tick_window === size })}
                                        onClick={() => setWindowInput(String(size))}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                            <input
                                aria-label={localize('Tick window')}
                                className='manual-trader__window-input'
                                inputMode='numeric'
                                max={MAX_TICK_WINDOW}
                                min={MIN_TICK_WINDOW}
                                type='number'
                                value={window_input}
                                onBlur={() => setWindowInput(String(tick_window))}
                                onChange={event => setWindowInput(event.target.value)}
                            />
                        </div>
                    </div>

                    {error && <p className='manual-trader__error'>{error}</p>}

                    <div className='manual-trader__overview'>
                        <div className='manual-trader__overview-item manual-trader__overview-item--most'>
                            <span>{localize('Most')}</span>
                            <strong>{most ? most.digit : '—'}</strong>
                            <small>{most ? `${most.pct.toFixed(1)}%` : ''}</small>
                        </div>
                        <div className='manual-trader__overview-item manual-trader__overview-item--least'>
                            <span>{localize('Least')}</span>
                            <strong>{least ? least.digit : '—'}</strong>
                            <small>{least ? `${least.pct.toFixed(1)}%` : ''}</small>
                        </div>
                        <div className='manual-trader__overview-item'>
                            <span>{localize('Even')}</span>
                            <strong>{`${even_pct.toFixed(1)}%`}</strong>
                            <i style={{ width: `${even_pct}%` }} />
                        </div>
                        <div className='manual-trader__overview-item'>
                            <span>{localize('Odd')}</span>
                            <strong>{`${(sample_size ? 100 - even_pct : 0).toFixed(1)}%`}</strong>
                            <i style={{ width: `${sample_size ? 100 - even_pct : 0}%` }} />
                        </div>
                    </div>

                    <div className='manual-trader__chart' role='group' aria-label={localize('Digit percentages')}>
                        {stats.map(stat => {
                            const rank = ranks[stat.digit];
                            const is_selected = trade_type.uses_prediction && stat.digit === prediction;
                            const deviation = sample_size ? stat.pct - 10 : 0;
                            return (
                                <button
                                    key={stat.digit}
                                    type='button'
                                    className={classNames('manual-trader__column', {
                                        [`manual-trader__column--${rank}`]: rank,
                                        'manual-trader__column--selected': is_selected,
                                        'manual-trader__column--current': stat.digit === current_digit,
                                    })}
                                    title={`${stat.digit}: ${stat.pct.toFixed(1)}% (${stat.count}/${sample_size})${
                                        rank ? ` · ${localize(RANK_LABELS[rank])}` : ''
                                    }`}
                                    aria-pressed={is_selected}
                                    onClick={() => onDigitClick(stat.digit)}
                                >
                                    <span className='manual-trader__column-digit'>{stat.digit}</span>
                                    <span
                                        className={classNames('manual-trader__column-dev', {
                                            'is-up': deviation > 0.05,
                                            'is-down': deviation < -0.05,
                                        })}
                                    >
                                        {deviation > 0 ? '+' : ''}
                                        {deviation.toFixed(1)}
                                    </span>
                                    <span className='manual-trader__column-caret' aria-hidden='true' />
                                </button>
                            );
                        })}
                    </div>

                    <ul className='manual-trader__legend'>
                        {Object.entries(RANK_LABELS).map(([rank, label]) => (
                            <li key={rank} className={`manual-trader__legend-item manual-trader__legend-item--${rank}`}>
                                {localize(label)}
                            </li>
                        ))}
                        <li className='manual-trader__legend-item manual-trader__legend-item--current'>
                            {localize('Current')}
                        </li>
                        {trade_type.uses_prediction && (
                            <li className='manual-trader__legend-item manual-trader__legend-item--selected'>
                                {localize('Prediction')}
                            </li>
                        )}
                    </ul>

                    <div className='manual-trader__recent'>
                        <span className='manual-trader__label'>{localize('Last {{count}} digits', { count: RECENT_DIGITS })}</span>
                        <div className='manual-trader__recent-strip'>
                            {recent.map((digit, index) => (
                                <span
                                    // Position is the identity of each slot in the rolling strip.
                                    // eslint-disable-next-line react/no-array-index-key
                                    key={`${index}-${digit}`}
                                    className={classNames('manual-trader__recent-digit', {
                                        'is-latest': index === recent.length - 1,
                                        'is-match': trade_type.uses_prediction && digit === prediction,
                                        'is-even': !trade_type.uses_prediction && digit % 2 === 0,
                                        'is-odd': !trade_type.uses_prediction && digit % 2 === 1,
                                    })}
                                >
                                    {digit}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                <section className='manual-trader__card manual-trader__card--ticket'>
                    <div className='manual-trader__field'>
                        <label className='manual-trader__label' htmlFor='manual-trader-market'>
                            {localize('Market')}
                        </label>
                        <select
                            id='manual-trader-market'
                            className='manual-trader__input manual-trader__input--select'
                            value={symbol}
                            onChange={event => setSymbol(event.target.value)}
                        >
                            {symbols.map(s => (
                                <option key={s.symbol} value={s.symbol}>
                                    {s.displayName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className='manual-trader__field'>
                        <span className='manual-trader__label'>{localize('Trade type')}</span>
                        <div className='manual-trader__segmented' role='tablist'>
                            {TRADE_TYPES.map(t => (
                                <button
                                    key={t.id}
                                    type='button'
                                    role='tab'
                                    aria-selected={t.id === trade_type_id}
                                    className={classNames({ 'is-active': t.id === trade_type_id })}
                                    onClick={() => setTradeTypeId(t.id)}
                                >
                                    {localize(t.label)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {trade_type.uses_prediction && (
                        <div className='manual-trader__field'>
                            <span className='manual-trader__label'>{localize('Prediction')}</span>
                            <div className='manual-trader__keypad'>
                                {DIGITS.map(digit => (
                                    <button
                                        key={digit}
                                        type='button'
                                        className={classNames({ 'is-active': digit === prediction })}
                                        onClick={() => setPrediction(digit)}
                                    >
                                        {digit}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className='manual-trader__row'>
                        <Stepper
                            id='manual-trader-duration'
                            label={localize('Ticks')}
                            value={duration_input}
                            onChange={setDurationInput}
                            min={1}
                            max={MAX_DURATION_TICKS}
                        />
                        <Stepper
                            id='manual-trader-bulk'
                            label={localize('Bulk trades')}
                            value={bulk_input}
                            onChange={setBulkInput}
                            min={1}
                            max={MAX_BULK_TRADES}
                        />
                    </div>

                    <div className='manual-trader__field'>
                        <label className='manual-trader__label' htmlFor='manual-trader-stake'>
                            {localize('Stake ({{currency}})', { currency })}
                        </label>
                        <div className={classNames('manual-trader__stepper', { 'is-invalid': !stake_valid })}>
                            <button type='button' aria-label={localize('Decrease stake')} onClick={() => nudgeStake(-0.5)}>
                                −
                            </button>
                            <input
                                id='manual-trader-stake'
                                inputMode='decimal'
                                min={MIN_STAKE}
                                step={0.01}
                                type='number'
                                value={stake_input}
                                onChange={event => setStakeInput(event.target.value)}
                            />
                            <button type='button' aria-label={localize('Increase stake')} onClick={() => nudgeStake(0.5)}>
                                +
                            </button>
                        </div>
                        <div className='manual-trader__chips'>
                            {STAKE_PRESETS.map(value => (
                                <button
                                    key={value}
                                    type='button'
                                    className={classNames({ 'is-active': stake === value })}
                                    onClick={() => setStakeInput(String(value))}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                        {!stake_valid && (
                            <span className='manual-trader__hint manual-trader__hint--danger'>
                                {localize('Minimum stake is {{min}}', { min: MIN_STAKE })}
                            </span>
                        )}
                    </div>

                    {!isAuthorized && (
                        <p className='manual-trader__notice'>
                            <Localize i18n_default_text='Log in to see live payouts and place trades.' />
                        </p>
                    )}

                    <div className='manual-trader__actions'>
                        {trade_type.sides.map((side, index) => {
                            const { min, max } = getPredictionBounds(side.contract_type);
                            const out_of_range = trade_type.uses_prediction && (prediction < min || prediction > max);
                            const quote = quotes[side.contract_type];
                            const probability = getSideProbability(side.contract_type, prediction, stats);
                            const profit =
                                quote?.payout !== undefined && quote?.ask_price !== undefined
                                    ? quote.payout - quote.ask_price
                                    : undefined;
                            const disabled = !isAuthorized || !stake_valid || out_of_range || !symbol;
                            return (
                                <button
                                    key={side.contract_type}
                                    type='button'
                                    className={classNames(
                                        'manual-trader__buy',
                                        index === 0 ? 'manual-trader__buy--first' : 'manual-trader__buy--second'
                                    )}
                                    disabled={disabled}
                                    onClick={() => buy(side.contract_type, localize(side.label), bulk)}
                                >
                                    <span className='manual-trader__buy-head'>
                                        <span className='manual-trader__buy-label'>
                                            {localize(side.label)}
                                            {trade_type.uses_prediction && <em>{prediction}</em>}
                                        </span>
                                        <span className='manual-trader__buy-profit'>
                                            {out_of_range
                                                ? localize('N/A')
                                                : quote?.loading
                                                  ? '…'
                                                  : quote?.error
                                                    ? localize('No quote')
                                                    : profit !== undefined
                                                      ? signed(profit)
                                                      : '—'}
                                        </span>
                                    </span>
                                    <span className='manual-trader__buy-meta'>
                                        <span>
                                            {out_of_range
                                                ? localize('Not available for {{digit}}', { digit: prediction })
                                                : quote?.payout !== undefined
                                                  ? localize('Payout {{payout}}', {
                                                        payout: formatMoney(quote.payout, currency),
                                                    })
                                                  : localize('Window win rate')}
                                        </span>
                                        <strong>{out_of_range ? '—' : `${probability.toFixed(1)}%`}</strong>
                                    </span>
                                    <span className='manual-trader__buy-bar'>
                                        <span style={{ width: `${out_of_range ? 0 : Math.min(100, probability)}%` }} />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className='manual-trader__hint manual-trader__hint--center'>
                        {bulk > 1
                            ? localize('Each click places {{count}} trades · total {{total}}', {
                                  count: bulk,
                                  total: stake_valid ? formatMoney(stake * bulk, currency) : '—',
                              })
                            : localize('Percentages show how often each side won in the tick window.')}
                    </p>
                </section>
            </div>

            <section className='manual-trader__card manual-trader__card--trades'>
                <div className='manual-trader__trades-head'>
                    <h3 className='manual-trader__card-title'>{localize('Session trades')}</h3>
                    {trades.length > 0 && (
                        <button type='button' className='manual-trader__clear' onClick={clearTrades}>
                            {localize('Clear settled')}
                        </button>
                    )}
                </div>
                <div className='manual-trader__stats'>
                    <div className='manual-trader__stat'>
                        <span>{localize('Trades')}</span>
                        <strong>{settled.length}</strong>
                    </div>
                    <div className='manual-trader__stat'>
                        <span>{localize('Running')}</span>
                        <strong>{running}</strong>
                    </div>
                    <div className='manual-trader__stat'>
                        <span>{localize('Win rate')}</span>
                        <strong>{settled.length ? `${win_rate.toFixed(0)}%` : '—'}</strong>
                    </div>
                    <div
                        className={classNames('manual-trader__stat', {
                            'manual-trader__stat--up': session_profit > 0,
                            'manual-trader__stat--down': session_profit < 0,
                        })}
                    >
                        <span>{localize('Profit/Loss')}</span>
                        <strong>{`${signed(session_profit)} ${currency}`}</strong>
                    </div>
                </div>
                {trades.length === 0 ? (
                    <p className='manual-trader__empty'>{localize('Trades you place here will appear with their results.')}</p>
                ) : (
                    <>
                        <div className='manual-trader__trade manual-trader__trade--header'>
                            <span>{localize('Contract')}</span>
                            <span>{localize('Stake')}</span>
                            <span>{localize('Exit')}</span>
                            <span>{localize('Status')}</span>
                            <span>{localize('P/L')}</span>
                        </div>
                        <ul className='manual-trader__trades'>
                            {trades.map(trade => (
                                <TradeRow key={trade.key} trade={trade} currency={currency} />
                            ))}
                        </ul>
                    </>
                )}
            </section>
        </div>
    );
};

export default observer(ManualTrader);
