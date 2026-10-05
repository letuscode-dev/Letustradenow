import {
    applyFddResult,
    createFddState,
    evaluateFddTick,
    fddPlacedLine,
    fddResultLines,
    fddStatusLines,
    fddStopReason,
    fddTickLines,
    fddTradeLines,
    normalizeFddSettings,
    readLastTwoDecimals,
    recordFddPurchaseFailure,
} from '../first-decimal-digit-differ';

describe('Double Decimal Digit Differ — last two decimals', () => {
    it.each([
        ['4681.33', 3],
        ['905.77', 7],
        ['12.00', 0],
        ['1234.566', 6],
    ])('%s → same digits, barrier %i', (price, digit) => {
        expect(readLastTwoDecimals(price)).toMatchObject({ pair: digit });
    });

    it.each(['4681.35', '4682.74', '8.42', '1234.565'])('%s → digits differ, no barrier', price => {
        expect(readLastTwoDecimals(price)?.pair).toBeNull();
    });

    it('uses the pip size so trailing zeros count', () => {
        expect(readLastTwoDecimals(4681, 2)).toEqual({ first: 0, second: 0, pair: 0 });
        expect(readLastTwoDecimals(4681.3, 2)).toEqual({ first: 3, second: 0, pair: null });
    });

    it('fewer than two decimals or invalid → null', () => {
        expect(readLastTwoDecimals('4681')).toBeNull();
        expect(readLastTwoDecimals('4681.3')).toBeNull();
        expect(readLastTwoDecimals('abc')).toBeNull();
        expect(readLastTwoDecimals(4681, 0)).toBeNull();
        expect(readLastTwoDecimals(null, 2)).toBeNull();
    });
});
describe('Double Decimal Digit Differ — 10.5 recovery', () => {
    const settings = normalizeFddSettings({ max_recovery_level: 3, max_recovery_stake: 5000, max_consecutive_losses: 10 });

    it('$2 → $21 → $220.50 → $2,315.25 and levels 0 → 3', () => {
        const state = createFddState(settings);
        const stakes = [];
        for (let i = 0; i < 3; i++) {
            const outcome = applyFddResult(state, { profit: -state.current_stake, stake: state.current_stake });
            expect(outcome.event).toBe('RECOVERY');
            stakes.push([state.current_stake, state.recovery_level]);
        }
        expect(stakes).toEqual([
            [21, 1],
            [220.5, 2],
            [2315.25, 3],
        ]);
    });

    it('a recovery win resets to the base stake', () => {
        const state = createFddState(settings);
        applyFddResult(state, { profit: -2, stake: 2 });
        const outcome = applyFddResult(state, { profit: 1.9, stake: 21 });
        expect(outcome).toMatchObject({ won: true, event: 'RECOVERY_SUCCESS', from_stake: 21, next_stake: 2, from_level: 1 });
        expect(state.current_stake).toBe(2);
        expect(state.recovery_level).toBe(0);
        const lines = fddResultLines({ state, outcome, barrier: 7, profit: 1.9, now: 0 }).join('\n');
        expect(lines).toMatch(/RECOVERY SUCCESS — RESETTING STAKE TO BASE STAKE/);
        expect(lines).toMatch(/Resetting stake: \$21.00 → \$2.00 \| Recovery Level: 1 → 0/);
    });

    it('maximum recovery level pauses trading', () => {
        const state = createFddState(normalizeFddSettings({ max_recovery_level: 1, max_recovery_stake: 5000 }));
        applyFddResult(state, { profit: -2, stake: 2 });
        const outcome = applyFddResult(state, { profit: -21, stake: 21 });
        expect(outcome.event).toBe('RECOVERY_LIMIT');
        expect(state.paused).toBe('recovery limit reached');
        expect(state.current_stake).toBe(21);
        expect(fddResultLines({ state, outcome, barrier: 3, profit: -21, now: 0 }).join(' ')).toMatch(
            /RECOVERY LIMIT REACHED — TRADING PAUSED/
        );
        const r = evaluateFddTick(state, { quote: '4681.33', epoch: 50, now: 1e9 }, state.settings);
        expect(r.decision).toBe('WAITING');
        expect(r.reason).toBe('recovery limit reached');
    });

    it('maximum recovery stake pauses trading', () => {
        const state = createFddState(normalizeFddSettings({ max_recovery_level: 5, max_recovery_stake: 20 }));
        const outcome = applyFddResult(state, { profit: -2, stake: 2 });
        expect(outcome.event).toBe('RECOVERY_LIMIT');
        expect(state.paused).toBe('recovery limit reached');
    });

    it('maximum consecutive losses pauses trading', () => {
        const state = createFddState(normalizeFddSettings({ recovery_enabled: false, max_consecutive_losses: 2 }));
        applyFddResult(state, { profit: -2, stake: 2 });
        const outcome = applyFddResult(state, { profit: -2, stake: 2 });
        expect(outcome.event).toBe('LOSS_FLAT');
        expect(outcome.consecutive_limit).toBe(true);
        expect(state.paused).toBe('maximum consecutive losses reached');
        expect(state.current_stake).toBe(2);
    });
});

describe('Double Decimal Digit Differ — tick decisions and journal', () => {
    const settings = normalizeFddSettings({});
    const tick = (quote, epoch, now = epoch * 1000) => ({ quote, epoch, now });

    it('4681.33 → READY, DIFFER 3', () => {
        const state = createFddState(settings);
        const r = evaluateFddTick(state, tick('4681.33', 1), settings);
        expect(r.decision).toBe('READY');
        expect(state.barrier).toBe(3);
        const lines = fddTickLines({ state, result: r, market: 'Volatility 75 (1s) Index', now: 0 }).join('\n');
        expect(lines).toMatch(/Last Two Decimals: 3 3 → SAME \(3\) \| Current Barrier: 3/);
        expect(lines).toMatch(/Recovery Level: 0 \| Current Stake: \$2.00/);
        expect(lines).toMatch(/Status: READY — entry conditions satisfied/);
    });

    it('4681.35 → WAITING, no barrier', () => {
        const state = createFddState(settings);
        const r = evaluateFddTick(state, tick('4681.35', 1), settings);
        expect(r.decision).toBe('WAITING');
        expect(r.reason).toBe('entry conditions not satisfied (last two decimals 3 and 5 are not the same)');
        expect(state.barrier).toBeNull();
        const lines = fddTickLines({ state, result: r, market: 'X', now: 0 }).join('\n');
        expect(lines).toMatch(/Last Two Decimals: 3 5 → NOT THE SAME \| Current Barrier: — \(no repeated pair\)/);
    });

    it('previous barrier is the last repeated digit', () => {
        const state = createFddState(settings);
        evaluateFddTick(state, tick('4681.77', 1), settings);
        evaluateFddTick(state, tick('4681.35', 2), settings);
        evaluateFddTick(state, tick('4681.22', 3), settings);
        expect(state.barrier).toBe(2);
        expect(state.previous_barrier).toBe(7);
    });

    it('invalid price → no trade', () => {
        const state = createFddState(settings);
        const r = evaluateFddTick(state, tick('4681', 1), settings);
        expect(r.decision).toBe('ERROR');
        const lines = fddTickLines({ state, result: r, market: 'X', now: 0 }).join('\n');
        expect(lines).toMatch(/ERROR — Unable to read the last two decimal digits\./);
        expect(lines).toMatch(/WAITING — invalid tick price/);
    });

    it('cooldown, duplicate signal and confirmation', () => {
        const state = createFddState(normalizeFddSettings({ confirmation_ticks: 2 }));
        expect(evaluateFddTick(state, tick('4681.11', 1), state.settings).reason).toMatch(
            /repeated digit 1 seen on 1\/2 consecutive ticks/
        );
        expect(evaluateFddTick(state, tick('4682.11', 2), state.settings).decision).toBe('READY');
        state.last_trade_at = 2000;
        state.last_trade_epoch = 2;
        expect(evaluateFddTick(state, tick('4682.11', 2, 2500), state.settings).reason).toBe('duplicate signal');
        expect(evaluateFddTick(state, tick('4683.11', 3, 3000), state.settings).reason).toMatch(/cooldown active/);
        expect(evaluateFddTick(state, tick('4684.11', 4, 4000), state.settings).decision).toBe('READY');
    });

    it('stop loss / take profit / max trades stop the bot', () => {
        const state = createFddState(settings);
        state.profit = -250;
        expect(evaluateFddTick(state, tick('4681.33', 1), settings).decision).toBe('STOPPED');
    });

    it('never places a trade whose loss would breach the stop loss', () => {
        const state = createFddState(normalizeFddSettings({ stop_loss: 20, max_recovery_level: 3, max_recovery_stake: 5000 }));
        applyFddResult(state, { profit: -2, stake: 2 });
        expect(state.current_stake).toBe(21);
        const r = evaluateFddTick(state, tick('4681.33', 1), state.settings);
        expect(r.decision).toBe('STOPPED');
        expect(r.reason).toMatch(/stop loss would be exceeded if the next \$21.00 trade lost/);
    });

    it('a paused session is not reported as a stop-loss stop', () => {
        const state = createFddState(normalizeFddSettings({}));
        [2, 21, 220.5].forEach(stake => applyFddResult(state, { profit: -stake, stake }));
        expect(state.paused).toBe('recovery limit reached');
        expect(fddStopReason(state, state.settings)).toBeNull();
    });

    it('three purchase failures in a row pause trading; the recovery stake is kept', () => {
        const state = createFddState(settings);
        applyFddResult(state, { profit: -2, stake: 2 });
        expect(recordFddPurchaseFailure(state, 'Insufficient balance')).toBe(false);
        expect(recordFddPurchaseFailure(state, 'Insufficient balance')).toBe(false);
        expect(recordFddPurchaseFailure(state, 'Insufficient balance')).toBe(true);
        expect(state.paused).toMatch(/purchase failed 3 times in a row \(Insufficient balance\)/);
        expect(state.current_stake).toBe(21);
        expect(state.recovery_level).toBe(1);
    });

    it('trade and status lines', () => {
        expect(fddTradeLines({ barrier: 3, stake: 21, duration: 1, duration_unit: 't', recovery_level: 1 })).toEqual([
            'Action: DIFFER 3 | Stake: $21.00 | Duration: 1 tick | Recovery Level: 1',
            'Submitting trade...',
        ]);
        expect(fddPlacedLine({ barrier: 3, contract_id: 123, buy_price: 21 })).toBe(
            'TRADE PLACED — DIFFER 3 | Trade submitted. Contract ID: 123 | Buy price: $21.00'
        );
        const state = createFddState(settings);
        const status = fddStatusLines(state, 'Volatility 75 (1s) Index').join('\n');
        expect(status).toMatch(/BOT: Double Decimal Digit Differ \+ 10.5 Recovery \| STATUS: ANALYZING/);
        expect(status).toMatch(/BASE STAKE: \$2.00 \| CURRENT STAKE: \$2.00 \| RECOVERY MULTIPLIER: 10.5× \| RECOVERY LEVEL: 0/);
        expect(status).toMatch(/LAST RESULT: - \| CONSECUTIVE LOSSES: 0 \| TRADES: 0 \| WINS: 0 \| LOSSES: 0 \| TOTAL P\/L: \+\$0.00/);
    });
});
