import React, { useMemo, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { Localize, localize } from '@deriv-com/translations';
import {
    clampInt,
    DEFAULT_TICK_WINDOW,
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

const RANK_LABELS = {
    most: 'Most frequent',
    second_most: '2nd most',
    second_least: '2nd least',
    least: 'Least frequent',
};

const formatMoney = (value: number | undefined, currency: string) =>
    value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(2)} ${currency}`;

const NumberField = ({
    id,
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    hint,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    min: number;
    max: number;
    step?: number;
    hint?: string;
}) => (
    <div className='manual-trader__field'>
        <label className='manual-trader__label' htmlFor={id}>
            {label}
        </label>
        <input
            id={id}
            className='manual-trader__input'
            inputMode='decimal'
            max={max}
            min={min}
            step={step}
            type='number'
            value={value}
            onChange={event => onChange(event.target.value)}
        />
        {hint && <span className='manual-trader__hint'>{hint}</span>}
    </div>
);

const TradeRow = ({ trade, currency }: { trade: ManualTrade; currency: string }) => {
    const status_text = {
        buying: localize('Buying…'),
        open: localize('Open'),
        won: localize('Won'),
        lost: localize('Lost'),
        error: localize('Failed'),
    }[trade.status];
    return (
        <li className={classNames('manual-trader__trade', `manual-trader__trade--${trade.status}`)}>
            <span className='manual-trader__trade-label'>
                {trade.label}
                <small>{trade.symbol}</small>
            </span>
            <span className='manual-trader__trade-stake'>{formatMoney(trade.buy_price ?? trade.stake, currency)}</span>
            <span className='manual-trader__trade-status'>{status_text}</span>
            <span className='manual-trader__trade-profit'>
                {trade.status === 'error'
                    ? trade.message
                    : trade.profit !== undefined && trade.status !== 'buying'
                      ? `${trade.profit > 0 ? '+' : ''}${formatMoney(trade.profit, currency)}`
                      : '—'}
            </span>
        </li>
    );
};

const ManualTrader = () => {
    const { isAuthorized, authData } = useApiBase();
    const { symbols, symbol, setSymbol, ticks, status, error } = useManualTraderTicks();

    const [window_input, setWindowInput] = useState(String(DEFAULT_TICK_WINDOW));
    const [trade_type_id, setTradeTypeId] = useState<TradeTypeId>('matches_differs');
    const [duration_input, setDurationInput] = useState('1');
    const [prediction_input, setPredictionInput] = useState('5');
    const [stake_input, setStakeInput] = useState('0.5');
    const [bulk_input, setBulkInput] = useState('1');
    const [buying, setBuying] = useState<string | null>(null);

    const trade_type = getTradeType(trade_type_id);
    const tick_window = clampInt(window_input, DEFAULT_TICK_WINDOW, MIN_TICK_WINDOW, MAX_TICK_WINDOW);
    const duration = clampInt(duration_input, 1, 1, MAX_DURATION_TICKS);
    const prediction = clampInt(prediction_input, 5, 0, 9);
    const bulk = clampInt(bulk_input, 1, 1, MAX_BULK_TRADES);
    const stake = Math.round(Number(stake_input) * 100) / 100;
    const stake_valid = Number.isFinite(stake) && stake >= MIN_STAKE;
    const currency =
        authData?.currency || (api_base.account_info as { currency?: string } | undefined)?.currency || 'USD';

    const digits = useMemo(() => ticks.map(t => t.digit), [ticks]);
    const stats = useMemo(() => getDigitStats(digits, tick_window), [digits, tick_window]);
    const ranks = useMemo(() => getDigitRanks(stats), [stats]);
    const current_digit = digits.length ? digits[digits.length - 1] : null;
    const sample_size = Math.min(digits.length, tick_window);

    const side_types = trade_type.sides.map(s => s.contract_type) as [string, string];
    const { quotes, trades, buy, clearTrades } = useManualTrades({
        enabled: isAuthorized && !!symbol && stake_valid,
        contract_types: side_types,
        params: {
            symbol,
            stake,
            duration,
            currency,
            prediction: trade_type.uses_prediction ? prediction : undefined,
        },
    });

    const settled = trades.filter(t => t.status === 'won' || t.status === 'lost');
    const session_profit = settled.reduce((total, t) => total + (t.profit || 0), 0);
    const wins = settled.filter(t => t.status === 'won').length;

    const onDigitClick = (digit: number) => {
        if (trade_type.uses_prediction) setPredictionInput(String(digit));
    };

    const onBuy = async (contract_type: string, label: string) => {
        setBuying(contract_type);
        try {
            await buy(contract_type, label, bulk);
        } finally {
            setBuying(null);
        }
    };

    return (
        <div className='manual-trader'>
            <header className='manual-trader__header'>
                <div>
                    <h2 className='manual-trader__title'>
                        <Localize i18n_default_text='Manual Trader' />
                    </h2>
                    <p className='manual-trader__subtitle'>
                        <Localize i18n_default_text='Watch live digit percentages, pick your digit, and place digit trades in one click.' />
                    </p>
                </div>
                <span className={classNames('manual-trader__live', `manual-trader__live--${status}`)}>
                    {status === 'live'
                        ? localize('Live')
                        : status === 'loading'
                          ? localize('Loading ticks…')
                          : status === 'error'
                            ? localize('Offline')
                            : localize('Connecting…')}
                </span>
            </header>

            <div className='manual-trader__layout'>
                <section className='manual-trader__card manual-trader__card--digits'>
                    <div className='manual-trader__card-head'>
                        <NumberField
                            id='manual-trader-window'
                            label={localize('Tick window')}
                            value={window_input}
                            onChange={setWindowInput}
                            min={MIN_TICK_WINDOW}
                            max={MAX_TICK_WINDOW}
                            hint={localize('{{sample}} of {{window}} ticks analysed', {
                                sample: sample_size,
                                window: tick_window,
                            })}
                        />
                        <div className='manual-trader__current'>
                            <span className='manual-trader__label'>{localize('Current digit')}</span>
                            <span className='manual-trader__current-digit'>{current_digit ?? '—'}</span>
                        </div>
                    </div>

                    {error && <p className='manual-trader__error'>{error}</p>}

                    <div className='manual-trader__digits' role='group' aria-label={localize('Digit percentages')}>
                        {stats.map(stat => {
                            const rank = ranks[stat.digit];
                            const is_selected = trade_type.uses_prediction && stat.digit === prediction;
                            return (
                                <button
                                    key={stat.digit}
                                    type='button'
                                    className={classNames('manual-trader__digit', {
                                        [`manual-trader__digit--${rank}`]: rank,
                                        'manual-trader__digit--selected': is_selected,
                                        'manual-trader__digit--current': stat.digit === current_digit,
                                    })}
                                    title={rank ? localize(RANK_LABELS[rank]) : undefined}
                                    aria-pressed={is_selected}
                                    onClick={() => onDigitClick(stat.digit)}
                                >
                                    <span className='manual-trader__digit-value'>{stat.digit}</span>
                                    <span className='manual-trader__digit-pct'>{stat.pct.toFixed(1)}%</span>
                                    <span className='manual-trader__digit-bar' />
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
                            {localize('Current digit')}
                        </li>
                    </ul>
                </section>

                <section className='manual-trader__card manual-trader__card--trade'>
                    <div className='manual-trader__form'>
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
                            <label className='manual-trader__label' htmlFor='manual-trader-type'>
                                {localize('Trade type')}
                            </label>
                            <select
                                id='manual-trader-type'
                                className='manual-trader__input manual-trader__input--select'
                                value={trade_type_id}
                                onChange={event => setTradeTypeId(event.target.value as TradeTypeId)}
                            >
                                {TRADE_TYPES.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {localize(t.label)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <NumberField
                            id='manual-trader-duration'
                            label={localize('Duration (ticks)')}
                            value={duration_input}
                            onChange={setDurationInput}
                            min={1}
                            max={MAX_DURATION_TICKS}
                        />
                        {trade_type.uses_prediction ? (
                            <NumberField
                                id='manual-trader-prediction'
                                label={localize('Prediction')}
                                value={prediction_input}
                                onChange={setPredictionInput}
                                min={0}
                                max={9}
                                hint={localize('Tip: tap a digit above')}
                            />
                        ) : (
                            <div className='manual-trader__field manual-trader__field--placeholder' />
                        )}
                        <NumberField
                            id='manual-trader-stake'
                            label={localize('Stake ({{currency}})', { currency })}
                            value={stake_input}
                            onChange={setStakeInput}
                            min={MIN_STAKE}
                            max={50000}
                            step={0.01}
                            hint={stake_valid ? undefined : localize('Minimum stake is {{min}}', { min: MIN_STAKE })}
                        />
                        <NumberField
                            id='manual-trader-bulk'
                            label={localize('Bulk trades')}
                            value={bulk_input}
                            onChange={setBulkInput}
                            min={1}
                            max={MAX_BULK_TRADES}
                        />
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
                            const disabled =
                                !isAuthorized || !stake_valid || out_of_range || !symbol || buying !== null;
                            return (
                                <button
                                    key={side.contract_type}
                                    type='button'
                                    className={classNames(
                                        'manual-trader__buy',
                                        index === 0 ? 'manual-trader__buy--first' : 'manual-trader__buy--second'
                                    )}
                                    disabled={disabled}
                                    onClick={() => onBuy(side.contract_type, localize(side.label))}
                                >
                                    <span className='manual-trader__buy-top'>
                                        <span className='manual-trader__buy-label'>
                                            {buying === side.contract_type ? localize('Buying…') : localize(side.label)}
                                            {trade_type.uses_prediction && !out_of_range && (
                                                <small> {prediction}</small>
                                            )}
                                        </span>
                                        <span className='manual-trader__buy-payout'>
                                            {out_of_range
                                                ? localize('Not available for {{digit}}', { digit: prediction })
                                                : quote?.loading
                                                  ? '…'
                                                  : quote?.error
                                                    ? localize('No quote')
                                                    : profit !== undefined
                                                      ? `+${profit.toFixed(2)}`
                                                      : '—'}
                                        </span>
                                    </span>
                                    <span className='manual-trader__buy-bottom'>
                                        <span>{localize('Window win rate')}</span>
                                        <strong>{out_of_range ? '—' : `${probability.toFixed(2)}%`}</strong>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {bulk > 1 && (
                        <p className='manual-trader__hint manual-trader__hint--center'>
                            {localize('Each click places {{count}} trades of {{stake}} {{currency}}.', {
                                count: bulk,
                                stake: stake_valid ? stake.toFixed(2) : '—',
                                currency,
                            })}
                        </p>
                    )}
                </section>
            </div>

            <section className='manual-trader__card manual-trader__card--trades'>
                <div className='manual-trader__trades-head'>
                    <h3 className='manual-trader__card-title'>{localize('Session trades')}</h3>
                    <div className='manual-trader__summary'>
                        <span>
                            {localize('Won {{wins}} / {{total}}', { wins, total: settled.length })}
                        </span>
                        <span
                            className={classNames('manual-trader__pl', {
                                'manual-trader__pl--up': session_profit > 0,
                                'manual-trader__pl--down': session_profit < 0,
                            })}
                        >
                            {`${session_profit > 0 ? '+' : ''}${session_profit.toFixed(2)} ${currency}`}
                        </span>
                        {trades.length > 0 && (
                            <button type='button' className='manual-trader__clear' onClick={clearTrades}>
                                {localize('Clear')}
                            </button>
                        )}
                    </div>
                </div>
                {trades.length === 0 ? (
                    <p className='manual-trader__empty'>{localize('Trades you place here will appear with their results.')}</p>
                ) : (
                    <ul className='manual-trader__trades'>
                        {trades.map(trade => (
                            <TradeRow key={trade.key} trade={trade} currency={currency} />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default observer(ManualTrader);
