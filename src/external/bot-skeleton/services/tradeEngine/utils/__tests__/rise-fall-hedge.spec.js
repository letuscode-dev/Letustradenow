import {
    applyContractToLeg,
    checkHedgeRiskGates,
    computeHedgeStats,
    createRiseFallHedgeState,
    dashboardLines,
    dayKey,
    DEFAULT_SETTINGS,
    finalizeHedge,
    formatHedgeCard,
    hedgeResultLines,
    isTemporaryBlock,
    newLeg,
    normalizeHedgeSettings,
} from '../rise-fall-hedge';

const NOW = new Date(2026, 9, 5, 12, 0, 0).getTime();

const leg = (side, patch = {}) => ({ ...newLeg(side, 2), status: 'OPEN', ...patch });

const won = (contract_id, payout, stake = 2) => ({
    contract_id,
    buy_price: stake,
    payout,
    sell_price: payout,
    profit: payout - stake,
    is_sold: 1,
    status: 'won',
    entry_tick_display_value: '8123.4',
    exit_tick_display_value: '8123.5',
});

const lost = (contract_id, payout = 3.8, stake = 2) => ({
    contract_id,
    buy_price: stake,
    payout,
    sell_price: 0,
    profit: -stake,
    is_sold: 1,
    status: 'lost',
    entry_tick_display_value: '8123.4',
    exit_tick_display_value: '8123.5',
});

const settledHedge = (id, rise_payout, fall_payout, created_at = NOW) => {
    const base = {
        id,
        symbol: 'stpRNG',
        day: dayKey(created_at),
        created_at,
        duration: 2,
        status: 'OPEN',
        rise: leg('RISE', { contract_id: id * 10 + 1, order_confirmed_at: created_at + 100 }),
        fall: leg('FALL', { contract_id: id * 10 + 2, order_confirmed_at: created_at + 140 }),
    };
    const rise = applyContractToLeg(base.rise, rise_payout === null ? lost(id * 10 + 1) : won(id * 10 + 1, rise_payout));
    const fall = applyContractToLeg(base.fall, fall_payout === null ? lost(id * 10 + 2) : won(id * 10 + 2, fall_payout));
    return finalizeHedge({ ...base, rise, fall }, 500);
};

describe('Rise/Fall Hedge — settings', () => {
    it('defaults: manual mode, cancel incomplete hedges, no stake progression settings', () => {
        expect(DEFAULT_SETTINGS).toMatchObject({ mode: 'MANUAL', incomplete_policy: 'CANCEL', every_n_ticks: 10 });
        expect(Object.keys(DEFAULT_SETTINGS).some(k => /martingale|multiplier/i.test(k))).toBe(false);
    });

    it('normalizes mode, policy and limits', () => {
        const s = normalizeHedgeSettings({ mode: 'auto', incomplete_policy: 'run', every_n_ticks: 0, max_trades: '' });
        expect(s.mode).toBe('AUTO');
        expect(s.incomplete_policy).toBe('RUN');
        expect(s.every_n_ticks).toBe(1);
        expect(s.max_trades).toBe(DEFAULT_SETTINGS.max_trades);
        expect(normalizeHedgeSettings({ mode: 'x', incomplete_policy: 'x' })).toMatchObject({
            mode: 'MANUAL',
            incomplete_policy: 'CANCEL',
        });
    });

    it('new legs use CALL for Rise and PUT for Fall with the same stake', () => {
        expect(newLeg('RISE', 2)).toMatchObject({ contract_type: 'CALL', stake: 2 });
        expect(newLeg('FALL', 2)).toMatchObject({ contract_type: 'PUT', stake: 2 });
    });
});

describe('Rise/Fall Hedge — P/L from actual Deriv payouts', () => {
    it('example: Rise wins with $5.63 payout, Fall loses → +$1.63 on $4 total', () => {
        const h = settledHedge(123, 5.63, null);
        expect(h.rise).toMatchObject({ result: 'WIN', payout: 5.63, profit: 3.63 });
        expect(h.fall).toMatchObject({ result: 'LOSS', payout: 0, profit: -2 });
        expect(h).toMatchObject({ status: 'SETTLED', total_stake: 4, total_payout: 5.63, net: 1.63 });
        expect(h.return_pct).toBeCloseTo(40.75, 6);
    });

    it('does not assume a profit: a small winning payout gives a losing hedge', () => {
        expect(settledHedge(1, 3.8, null).net).toBe(-0.2);
    });

    it('both legs lose (exit equals entry) → −total stake', () => {
        const h = settledHedge(2, null, null);
        expect(h.net).toBe(-4);
        expect(h.total_payout).toBe(0);
    });

    it('uses the payout Deriv paid (sell_price), not the quote', () => {
        const l = applyContractToLeg(leg('RISE', { quoted_payout: 9.99 }), won(5, 3.91));
        expect(l.payout).toBe(3.91);
        expect(l.profit).toBe(1.91);
    });

    it('a leg sold early records the actual resale value', () => {
        const l = applyContractToLeg(leg('FALL', { status: 'CANCELLED' }), {
            contract_id: 9,
            buy_price: 2,
            sell_price: 1.1,
            profit: -0.9,
            is_sold: 1,
            status: 'sold',
        });
        expect(l).toMatchObject({ status: 'CANCELLED', payout: 1.1, profit: -0.9, result: 'LOSS' });
    });

    it('stays open until both legs have settled', () => {
        const base = settledHedge(3, 5.63, null);
        const half = finalizeHedge({ ...base, net: undefined, status: 'OPEN', fall: leg('FALL', { contract_id: 32 }) }, 500);
        expect(half.net).toBeUndefined();
    });

    it('records entry and exit spots', () => {
        const h = settledHedge(4, 5.63, null);
        expect(h.rise.entry_spot).toBe('8123.4');
        expect(h.rise.exit_spot).toBe('8123.5');
    });
});

describe('Rise/Fall Hedge — execution', () => {
    it('measures the gap between confirmations and flags ASYMMETRIC EXECUTION over the threshold', () => {
        const ok = settledHedge(1, 5.63, null);
        expect(ok.execution_gap_ms).toBe(40);
        expect(ok.asymmetric).toBe(false);
        const slow = finalizeHedge({ ...ok, fall: { ...ok.fall, order_confirmed_at: NOW + 900 } }, 500);
        expect(slow.execution_gap_ms).toBe(800);
        expect(slow.asymmetric).toBe(true);
    });

    it('incomplete hedge: only the bought leg counts', () => {
        const base = settledHedge(7, 5.63, null);
        const h = finalizeHedge(
            { ...base, net: undefined, fall: leg('FALL', { status: 'FAILED', error: 'PriceMoved' }) },
            500
        );
        expect(h).toMatchObject({ status: 'INCOMPLETE', total_stake: 2, net: 3.63 });
    });

    it('nothing bought → aborted', () => {
        const h = finalizeHedge(
            {
                ...settledHedge(8, 5.63, null),
                net: undefined,
                rise: leg('RISE', { status: 'FAILED' }),
                fall: leg('FALL', { status: 'FAILED' }),
            },
            500
        );
        expect(h.status).toBe('ABORTED');
    });

    it('formats the HEDGE card', () => {
        expect(formatHedgeCard(settledHedge(123, 5.63, null))).toBe(
            ['HEDGE #123', 'Rise: WIN   +$3.63', 'Fall: LOSS  -$2.00', '--------------------', 'NET:       +$1.63'].join(
                '\n'
            )
        );
    });
});

describe('Rise/Fall Hedge — statistics', () => {
    it('computes totals, best/worst, profit factor, streaks and drawdown', () => {
        const hedges = [
            settledHedge(1, 5.63, null, NOW), // +1.63
            settledHedge(2, null, null, NOW + 1), // -4
            settledHedge(3, 3.8, null, NOW + 2), // -0.2
            settledHedge(4, 4, null, NOW + 3), // 0
            settledHedge(5, 6, null, NOW + 4), // +2
        ];
        const s = computeHedgeStats(hedges);
        expect(s).toMatchObject({
            total: 5,
            profitable: 2,
            losing: 2,
            break_even: 1,
            total_staked: 20,
            total_payout: 19.43,
            net: -0.57,
            best: 2,
            worst: -4,
            max_consecutive_losses: 2,
            current_consecutive_losses: 0,
            max_drawdown: 4.2,
        });
        expect(s.average).toBe(-0.11);
        expect(s.profit_factor).toBeCloseTo(3.63 / 4.2, 6);
    });

    it('ignores aborted and open hedges', () => {
        const aborted = { ...settledHedge(9, 5.63, null), status: 'ABORTED', net: undefined };
        expect(computeHedgeStats([aborted]).total).toBe(0);
    });
});

describe('Rise/Fall Hedge — risk controls', () => {
    const ctx = (patch = {}, hedges = [], stake = 2) => ({
        settings: normalizeHedgeSettings({ ...DEFAULT_SETTINGS, cooldown_seconds: 0, ...patch }),
        stake,
        hedges,
        now: NOW + 10,
    });

    it('allows a hedge when nothing blocks it', () => {
        expect(checkHedgeRiskGates(ctx())).toBeNull();
    });

    it('max total stake per hedge (both legs)', () => {
        expect(checkHedgeRiskGates(ctx({ max_stake_per_hedge: 10 }, [], 6))).toMatch(/exceeds the maximum/);
        expect(checkHedgeRiskGates(ctx({ max_stake_per_hedge: 10 }, [], 5))).toBeNull();
    });

    it('daily loss limit stops trading', () => {
        const losses = [1, 2, 3, 4, 5].map(i => settledHedge(i, null, null, NOW + i));
        expect(
            checkHedgeRiskGates(ctx({ daily_loss_limit: 20, max_consecutive_losses: 99, max_daily_loss: 0 }, losses))
        ).toMatch(/Daily loss limit/);
    });

    it('max daily loss checks the worst case before firing', () => {
        const losses = [1, 2, 3, 4].map(i => settledHedge(i, null, null, NOW + i)); // -16
        expect(
            checkHedgeRiskGates(ctx({ max_daily_loss: 18, daily_loss_limit: 0, max_consecutive_losses: 99 }, losses))
        ).toMatch(/Maximum daily loss/);
    });

    it('daily profit target stops trading', () => {
        const wins = Array.from({ length: 13 }, (_, i) => settledHedge(i + 1, 5.63, null, NOW + i)); // +21.19
        expect(checkHedgeRiskGates(ctx({ daily_profit_target: 20 }, wins))).toMatch(/profit target/);
    });

    it('max consecutive losing hedges', () => {
        const losses = [1, 2, 3].map(i => settledHedge(i, 3.8, null, NOW + i));
        expect(checkHedgeRiskGates(ctx({ max_consecutive_losses: 3 }, losses))).toMatch(/consecutive/);
    });

    it('max number of trades and max daily hedges', () => {
        const wins = [1, 2].map(i => settledHedge(i, 5.63, null, NOW + i));
        expect(checkHedgeRiskGates(ctx({ max_trades: 2 }, wins))).toMatch(/number of trades/);
        expect(checkHedgeRiskGates(ctx({ max_daily_hedges: 2 }, wins))).toMatch(/daily hedge count/);
    });

    it('cooldown is temporary, hard limits are not', () => {
        const reason = checkHedgeRiskGates({ ...ctx({ cooldown_seconds: 10 }), last_hedge_at: NOW + 5 });
        expect(reason).toMatch(/Cooldown/);
        expect(isTemporaryBlock(reason)).toBe(true);
        expect(isTemporaryBlock('Daily loss limit reached (-20.00).')).toBe(false);
    });
});

describe('Rise/Fall Hedge — journal output', () => {
    it('dashboard and result lines include the hedge details', () => {
        const state = createRiseFallHedgeState(false);
        const h = settledHedge(1, 5.63, null);
        state.hedges = [h];
        expect(dashboardLines({ symbol_name: 'Step Index 100', stake: 2, duration: 2, state }).join('\n')).toMatch(
            /STEP INDEX 100[\s\S]*Total Risk: \$4\.00/
        );
        const text = hedgeResultLines(h, state).join('\n');
        expect(text).toMatch(/HEDGE #1/);
        expect(text).toMatch(/1\.63/);
    });
});
