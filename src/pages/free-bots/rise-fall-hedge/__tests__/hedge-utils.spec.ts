import {
    applyContractToLeg,
    checkRiskGates,
    computeStats,
    dayKey,
    DEFAULT_SETTINGS,
    finalizeHedge,
    formatHedgeCard,
    type Hedge,
    isStepIndex,
    isTemporaryBlock,
    type Leg,
    normalizeSettings,
    shouldAutoFire,
} from '../hedge-utils';

const NOW = new Date(2026, 9, 5, 12, 0, 0).getTime();

const leg = (side: Leg['side'], patch: Partial<Leg> = {}): Leg => ({
    side,
    contract_type: side === 'RISE' ? 'CALL' : 'PUT',
    status: 'OPEN',
    stake: 2,
    ...patch,
});

const won = (contract_id: number, payout: number, stake = 2) => ({
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

const lost = (contract_id: number, payout = 3.8, stake = 2) => ({
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

/** A settled hedge built through the same functions the live hook uses. */
const settledHedge = (id: number, rise_payout: number | null, fall_payout: number | null, created_at = NOW): Hedge => {
    const base: Hedge = {
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
    it('defaults: Step Index 100, $2 per leg, 2 ticks, manual', () => {
        expect(DEFAULT_SETTINGS).toMatchObject({ symbol: 'stpRNG', stake: 2, duration: 2, mode: 'MANUAL' });
    });

    it('clamps stake, duration and limits', () => {
        const s = normalizeSettings({ stake: 0.1, duration: 25, every_n_ticks: 0 });
        expect(s.stake).toBe(0.35);
        expect(s.duration).toBe(10);
        expect(s.every_n_ticks).toBe(1);
    });

    it('recognises Step Indices', () => {
        expect(isStepIndex({ symbol: 'stpRNG' })).toBe(true);
        expect(isStepIndex({ symbol: 'stpRNG3' })).toBe(true);
        expect(isStepIndex({ symbol: 'X', displayName: 'Step Index 200' })).toBe(true);
        expect(isStepIndex({ symbol: 'R_100', displayName: 'Volatility 100 Index' })).toBe(false);
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
        const h = settledHedge(1, 3.8, null);
        expect(h.net).toBe(-0.2);
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
        const s = computeStats(hedges);
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

    it('ignores aborted hedges and open hedges', () => {
        const aborted: Hedge = { ...settledHedge(9, 5.63, null), status: 'ABORTED', net: undefined };
        expect(computeStats([aborted]).total).toBe(0);
    });
});

describe('Rise/Fall Hedge — risk controls and triggers', () => {
    const ctx = (patch: Record<string, unknown> = {}, hedges: Hedge[] = []) => ({
        settings: normalizeSettings({ ...DEFAULT_SETTINGS, cooldown_seconds: 0, ...patch }),
        hedges,
        now: NOW + 10,
        emergency_stopped: false,
    });

    it('allows a hedge when nothing blocks it', () => {
        expect(checkRiskGates(ctx())).toBeNull();
    });

    it('emergency stop blocks everything', () => {
        expect(checkRiskGates({ ...ctx(), emergency_stopped: true })).toMatch(/Emergency/);
    });

    it('max total stake per hedge', () => {
        expect(checkRiskGates(ctx({ stake: 6, max_stake_per_hedge: 10 }))).toMatch(/exceeds the maximum/);
    });

    it('max simultaneous hedges (temporary)', () => {
        const open: Hedge = { ...settledHedge(1, null, null), status: 'OPEN', net: undefined };
        const reason = checkRiskGates(ctx({}, [open])) as string;
        expect(reason).toMatch(/simultaneous/);
        expect(isTemporaryBlock(reason)).toBe(true);
    });

    it('daily loss limit stops trading', () => {
        const losses = [1, 2, 3, 4, 5].map(i => settledHedge(i, null, null, NOW + i));
        expect(checkRiskGates(ctx({ daily_loss_limit: 20, max_consecutive_losses: 99, max_daily_loss: 0 }, losses))).toMatch(
            /Daily loss limit/
        );
    });

    it('max daily loss checks the worst case before firing', () => {
        const losses = [1, 2, 3, 4].map(i => settledHedge(i, null, null, NOW + i)); // -16
        expect(
            checkRiskGates(ctx({ max_daily_loss: 18, daily_loss_limit: 0, max_consecutive_losses: 99 }, losses))
        ).toMatch(/Maximum daily loss/);
    });

    it('daily profit target stops trading', () => {
        const wins = Array.from({ length: 13 }, (_, i) => settledHedge(i + 1, 5.63, null, NOW + i)); // +21.19
        expect(checkRiskGates(ctx({ daily_profit_target: 20 }, wins))).toMatch(/profit target/);
    });

    it('max consecutive losing hedges', () => {
        const losses = [1, 2, 3].map(i => settledHedge(i, 3.8, null, NOW + i));
        expect(checkRiskGates(ctx({ max_consecutive_losses: 3 }, losses))).toMatch(/consecutive/);
    });

    it('max number of trades and max daily hedges', () => {
        const wins = [1, 2].map(i => settledHedge(i, 5.63, null, NOW + i));
        expect(checkRiskGates(ctx({ max_trades: 2 }, wins))).toMatch(/number of trades/);
        expect(checkRiskGates(ctx({ max_daily_hedges: 2 }, wins))).toMatch(/daily hedge count/);
    });

    it('cooldown (temporary)', () => {
        const reason = checkRiskGates({ ...ctx({ cooldown_seconds: 10 }), last_hedge_at: NOW + 5 }) as string;
        expect(reason).toMatch(/Cooldown/);
        expect(isTemporaryBlock(reason)).toBe(true);
    });

    it('automatic mode fires every N ticks only', () => {
        const auto = normalizeSettings({ mode: 'AUTO', every_n_ticks: 5 });
        expect(shouldAutoFire(4, auto)).toBe(false);
        expect(shouldAutoFire(5, auto)).toBe(true);
        expect(shouldAutoFire(5, normalizeSettings({ mode: 'MANUAL', every_n_ticks: 5 }))).toBe(false);
    });
});
