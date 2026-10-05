import React, { useMemo, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import {
    computeStats,
    dayKey,
    DEFAULT_SETTINGS,
    FALL,
    formatHedgeCard,
    type Hedge,
    type HedgeSettings,
    type HedgeStats,
    type Leg,
    MAX_DURATION,
    normalizeSettings,
    RISE,
} from './hedge-utils';
import { useRiseFallHedge } from './use-rise-fall-hedge';
import './rise-fall-hedge.scss';

const SETTINGS_KEY = 'rise_fall_hedge_settings_v1';
const SESSION_START = Date.now();

type FormState = Record<keyof HedgeSettings, string>;

const toForm = (s: HedgeSettings): FormState =>
    Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as FormState;

const loadForm = (): FormState => {
    try {
        return toForm(normalizeSettings(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}')));
    } catch {
        return toForm(DEFAULT_SETTINGS);
    }
};

const money = (value: number | undefined | null, currency = '$') =>
    value === undefined || value === null || !Number.isFinite(value)
        ? '—'
        : `${value >= 0 ? '+' : '-'}${currency}${Math.abs(value).toFixed(2)}`;

const plain = (value: number | undefined | null) =>
    value === undefined || value === null || !Number.isFinite(value) ? '—' : `$${value.toFixed(2)}`;

const time = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString(undefined, { hour12: false }) + `.${String(ms % 1000).padStart(3, '0')}` : '—');

const NumberField = ({
    label,
    name,
    form,
    onChange,
    step = 1,
}: {
    label: string;
    name: keyof HedgeSettings;
    form: FormState;
    onChange: (name: keyof HedgeSettings, value: string) => void;
    step?: number;
}) => (
    <label className='rf-hedge__field'>
        <span>{label}</span>
        <input type='number' step={step} value={form[name]} onChange={e => onChange(name, e.target.value)} />
    </label>
);

const StatsGrid = ({ title, stats }: { title: string; stats: HedgeStats }) => {
    const pf =
        stats.profit_factor === null ? '—' : stats.profit_factor === Infinity ? '∞' : stats.profit_factor.toFixed(2);
    const rows: [string, string][] = [
        ['Total hedges', String(stats.total)],
        ['Profitable', String(stats.profitable)],
        ['Losing', String(stats.losing)],
        ['Break-even', String(stats.break_even)],
        ['Total staked', plain(stats.total_staked)],
        ['Total payout', plain(stats.total_payout)],
        ['Net P/L', money(stats.net)],
        ['Average hedge P/L', money(stats.average)],
        ['Best hedge', money(stats.best)],
        ['Worst hedge', money(stats.worst)],
        ['Profit factor', pf],
        ['Max consecutive losing', String(stats.max_consecutive_losses)],
        ['Max drawdown', plain(stats.max_drawdown)],
    ];
    return (
        <section className='rf-hedge__panel'>
            <h4>{title}</h4>
            <dl className='rf-hedge__stats'>
                {rows.map(([k, v]) => (
                    <React.Fragment key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                    </React.Fragment>
                ))}
            </dl>
        </section>
    );
};

const LegDetails = ({ label, leg }: { label: string; leg: Leg }) => (
    <tr>
        <td>{label}</td>
        <td>{leg.contract_id ?? '—'}</td>
        <td>{time(leg.order_sent_at)}</td>
        <td>{time(leg.order_confirmed_at)}</td>
        <td>{leg.entry_spot ?? '—'}</td>
        <td>{leg.exit_spot ?? '—'}</td>
        <td>{plain(leg.stake)}</td>
        <td>{leg.payout === undefined ? (leg.quoted_payout ? `(quote ${leg.quoted_payout.toFixed(2)})` : '—') : plain(leg.payout)}</td>
        <td>{leg.status === 'FAILED' ? `FAILED: ${leg.error}` : leg.result ?? leg.status}</td>
        <td>{money(leg.profit)}</td>
    </tr>
);

const HedgeCard = ({ hedge }: { hedge: Hedge }) => (
    <div className={classNames('rf-hedge__card', { 'rf-hedge__card--asym': hedge.asymmetric })}>
        <pre
            className={classNames('rf-hedge__card-text', {
                'rf-hedge__card-text--win': (hedge.net ?? 0) > 0,
                'rf-hedge__card-text--loss': (hedge.net ?? 0) < 0,
            })}
        >
            {formatHedgeCard(hedge)}
        </pre>
        <div className='rf-hedge__flags'>
            <span>{hedge.symbol}</span>
            <span>{hedge.duration} ticks</span>
            <span>{hedge.status}</span>
            {hedge.execution_gap_ms !== undefined && <span>Gap {hedge.execution_gap_ms} ms</span>}
            {hedge.asymmetric && <span className='rf-hedge__flag--warn'>ASYMMETRIC EXECUTION</span>}
            {hedge.return_pct !== undefined && <span>Return {hedge.return_pct.toFixed(2)}%</span>}
        </div>
        {hedge.failure && <p className='rf-hedge__failure'>{hedge.failure}</p>}
        {hedge.policy_applied && <p className='rf-hedge__failure'>{hedge.policy_applied}</p>}
    </div>
);

const RiseFallHedge = () => {
    const { isAuthorized, authData } = useApiBase();
    const currency =
        authData?.currency || (api_base.account_info as { currency?: string } | undefined)?.currency || 'USD';
    const [form, setForm] = useState<FormState>(loadForm);
    const settings = useMemo(() => normalizeSettings(form as unknown as Partial<HedgeSettings>), [form]);

    const onChange = (name: keyof HedgeSettings, value: string) => {
        setForm(prev => {
            const next = { ...prev, [name]: value };
            window.localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify(normalizeSettings(next as unknown as Partial<HedgeSettings>))
            );
            return next;
        });
    };

    const hedge = useRiseFallHedge({ settings, currency, authorized: isAuthorized });
    const symbol_name = hedge.symbols.find(s => s.symbol === settings.symbol)?.displayName || settings.symbol;

    const session_hedges = hedge.hedges.filter(h => h.created_at >= SESSION_START);
    const session = computeStats(session_hedges);
    const today = computeStats(hedge.hedges.filter(h => h.day === dayKey(Date.now())));
    const all = computeStats(hedge.hedges);
    const last = [...hedge.hedges].reverse().find(h => h.net !== undefined);
    const latest = hedge.hedges[hedge.hedges.length - 1];
    const recent = [...hedge.hedges].reverse().slice(0, 20);
    const rise_q = hedge.quotes[RISE];
    const fall_q = hedge.quotes[FALL];
    const can_trade = isAuthorized && !hedge.emergency_stopped;

    return (
        <div className='rf-hedge'>
            {!isAuthorized && <p className='rf-hedge__warn'>Log in to place hedges.</p>}

            <div className='rf-hedge__top'>
                <section className='rf-hedge__panel rf-hedge__dashboard'>
                    <pre>
                        {[
                            symbol_name.toUpperCase(),
                            '-------------------------',
                            `Stake/leg: $${settings.stake.toFixed(2)}`,
                            `Duration: ${settings.duration} ticks`,
                            '',
                            `Rise: $${settings.stake.toFixed(2)}${rise_q?.payout ? `  (payout ${rise_q.payout.toFixed(2)})` : rise_q?.error ? `  (${rise_q.error})` : ''}`,
                            `Fall: $${settings.stake.toFixed(2)}${fall_q?.payout ? `  (payout ${fall_q.payout.toFixed(2)})` : fall_q?.error ? `  (${fall_q.error})` : ''}`,
                            '',
                            `Total Risk: $${(settings.stake * 2).toFixed(2)}`,
                            '',
                            'Last Hedge:',
                            last
                                ? `Rise: ${last.rise.result ?? last.rise.status}\nFall: ${last.fall.result ?? last.fall.status}\nNet: ${money(last.net)}`
                                : 'none yet',
                            '',
                            'Session:',
                            `Hedges: ${session.total}`,
                            `Wins: ${session.profitable}`,
                            `Losses: ${session.losing}`,
                            `Net P/L: ${money(session.net)}`,
                        ].join('\n')}
                    </pre>
                    {hedge.last_quote !== null && <p className='rf-hedge__muted'>Spot: {hedge.last_quote}</p>}
                </section>

                <section className='rf-hedge__panel'>
                    <h4>Trade</h4>
                    <label className='rf-hedge__field'>
                        <span>Symbol</span>
                        <select value={form.symbol} onChange={e => onChange('symbol', e.target.value)}>
                            {!hedge.symbols.some(s => s.symbol === form.symbol) && (
                                <option value={form.symbol}>{form.symbol}</option>
                            )}
                            {hedge.symbols.map(s => (
                                <option key={s.symbol} value={s.symbol}>
                                    {s.displayName}
                                </option>
                            ))}
                        </select>
                    </label>
                    <NumberField label={`Stake per leg (${currency})`} name='stake' form={form} onChange={onChange} step={0.01} />
                    <NumberField label={`Duration (ticks, 1–${MAX_DURATION})`} name='duration' form={form} onChange={onChange} />
                    <label className='rf-hedge__field'>
                        <span>Trigger mode</span>
                        <select value={form.mode} onChange={e => onChange('mode', e.target.value)} disabled={hedge.auto_running}>
                            <option value='MANUAL'>Manual — START HEDGE</option>
                            <option value='AUTO'>Automatic</option>
                        </select>
                    </label>

                    <div className='rf-hedge__actions'>
                        {settings.mode === 'MANUAL' ? (
                            <button
                                type='button'
                                className='rf-hedge__btn rf-hedge__btn--primary'
                                disabled={!can_trade}
                                onClick={() => hedge.fire('MANUAL')}
                            >
                                START HEDGE
                            </button>
                        ) : hedge.auto_running ? (
                            <button type='button' className='rf-hedge__btn' onClick={hedge.stopAuto}>
                                Stop automatic ({hedge.ticks_since_last}/{settings.every_n_ticks} ticks)
                            </button>
                        ) : (
                            <button
                                type='button'
                                className='rf-hedge__btn rf-hedge__btn--primary'
                                disabled={!can_trade}
                                onClick={hedge.startAuto}
                            >
                                Start automatic
                            </button>
                        )}
                        {hedge.emergency_stopped ? (
                            <button type='button' className='rf-hedge__btn' onClick={hedge.resetEmergency}>
                                Reset emergency stop
                            </button>
                        ) : (
                            <button type='button' className='rf-hedge__btn rf-hedge__btn--danger' onClick={hedge.emergencyStop}>
                                EMERGENCY STOP
                            </button>
                        )}
                    </div>
                    {hedge.message && <p className='rf-hedge__message'>{hedge.message}</p>}
                    <p className='rf-hedge__muted'>Flat stake — the stake never increases after a losing hedge.</p>
                </section>
            </div>

            <div className='rf-hedge__row'>
                <section className='rf-hedge__panel'>
                    <h4>Automatic mode</h4>
                    <NumberField label='Fire every N ticks' name='every_n_ticks' form={form} onChange={onChange} />
                    <NumberField label='Cooldown (seconds)' name='cooldown_seconds' form={form} onChange={onChange} />
                    <NumberField label='Max simultaneous hedges' name='max_open_hedges' form={form} onChange={onChange} />
                    <NumberField label='Max daily hedges' name='max_daily_hedges' form={form} onChange={onChange} />
                </section>
                <section className='rf-hedge__panel'>
                    <h4>Risk controls</h4>
                    <NumberField label='Max total stake per hedge' name='max_stake_per_hedge' form={form} onChange={onChange} step={0.01} />
                    <NumberField label='Max daily loss (worst case incl. open hedges)' name='max_daily_loss' form={form} onChange={onChange} step={0.01} />
                    <NumberField label='Daily loss limit (stop when reached)' name='daily_loss_limit' form={form} onChange={onChange} step={0.01} />
                    <NumberField label='Daily profit target (stop when reached)' name='daily_profit_target' form={form} onChange={onChange} step={0.01} />
                    <NumberField label='Max consecutive losing hedges' name='max_consecutive_losses' form={form} onChange={onChange} />
                    <NumberField label='Max number of trades (hedges)' name='max_trades' form={form} onChange={onChange} />
                    <p className='rf-hedge__muted'>0 disables a loss limit or profit target.</p>
                </section>
                <section className='rf-hedge__panel'>
                    <h4>Execution</h4>
                    <NumberField label='Asymmetric execution threshold (ms)' name='asymmetric_threshold_ms' form={form} onChange={onChange} />
                    <label className='rf-hedge__field'>
                        <span>If one leg cannot be bought</span>
                        <select value={form.incomplete_policy} onChange={e => onChange('incomplete_policy', e.target.value)}>
                            <option value='CANCEL_REMAINING'>A) Cancel the remaining leg if possible</option>
                            <option value='LET_REMAINING_RUN'>B) Let the remaining leg proceed</option>
                        </select>
                    </label>
                    <p className='rf-hedge__muted'>
                        Both legs are priced first; if either price is unavailable, nothing is bought.
                    </p>
                </section>
            </div>

            {latest && (
                <section className='rf-hedge__panel'>
                    <h4>Latest hedge</h4>
                    <HedgeCard hedge={latest} />
                    <div className='rf-hedge__table-wrap'>
                        <table className='rf-hedge__table'>
                            <thead>
                                <tr>
                                    <th>Leg</th>
                                    <th>Contract ID</th>
                                    <th>Order sent</th>
                                    <th>Confirmed</th>
                                    <th>Entry spot</th>
                                    <th>Exit spot</th>
                                    <th>Stake</th>
                                    <th>Payout</th>
                                    <th>Result</th>
                                    <th>P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                <LegDetails label='Rise' leg={latest.rise} />
                                <LegDetails label='Fall' leg={latest.fall} />
                                <tr className='rf-hedge__total'>
                                    <td colSpan={6}>Combined</td>
                                    <td>{plain(latest.total_stake ?? latest.rise.stake + latest.fall.stake)}</td>
                                    <td>{plain(latest.total_payout)}</td>
                                    <td>{latest.return_pct !== undefined ? `${latest.return_pct.toFixed(2)}%` : '—'}</td>
                                    <td>{money(latest.net)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <div className='rf-hedge__row'>
                <StatsGrid title='Session' stats={session} />
                <StatsGrid title='Today' stats={today} />
                <StatsGrid title='All stored hedges' stats={all} />
            </div>

            {recent.length > 0 && (
                <section className='rf-hedge__panel'>
                    <div className='rf-hedge__history-head'>
                        <h4>Hedge history</h4>
                        <button type='button' className='rf-hedge__btn rf-hedge__btn--small' onClick={hedge.clearHistory}>
                            Clear finished
                        </button>
                    </div>
                    <div className='rf-hedge__history'>
                        {recent.map(h => (
                            <HedgeCard key={h.id} hedge={h} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default observer(RiseFallHedge);
