import {
    applyFddResult,
    createFddState,
    evaluateFddTick,
    extractFirstDecimalDigit,
    fddPlacedLine,
    fddResultLines,
    fddStatusLines,
    fddStopReason,
    fddTickLines,
    fddTradeLines,
    normalizeFddSettings,
    recordFddPurchaseFailure,
} from '../first-decimal-digit-differ';

describe('First Decimal Digit Differ — extraction', () => {
    it.each([
        ['4681.35', 3],
        ['4682.74', 7],
        ['4689.21', 2],
        ['901.26', 2],
        ['75.93', 9],
        ['8.42', 4],
        ['1234.567', 5],
    ])('%s → barrier %i', (price, digit) => {
        expect(extractFirstDecimalDigit(price)).toBe(digit);
    });

    it('keeps trailing zeros from the pip size', () => {
        expect(extractFirstDecimalDigit(4681.05, 2)).toBe(0);
        expect(extractFirstDecimalDigit(4681, 2)).toBe(0);
    });

    it('no decimal digit or invalid → null', () => {
        expect(extractFirstDecimalDigit('4681')).toBeNull();
        expect(extractFirstDecimalDigit('4681.')).toBeNull();
        expect(extractFirstDecimalDigit('abc')).toBeNull();
        expect(extractFirstDecimalDigit(4681, 0)).toBeNull();
        expect(extractFirstDecimalDigit(null, 2)).toBeNull();
    });
});

describe('First Decimal Digit Differ — 10.5 recovery', () => {
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
        const r = evaluateFddTick(state, { quote: '4681.35', epoch: 50, now: 1e9 }, state.settings);
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

describe('First Decimal Digit Differ — tick decisions and journal', () => {
    const settings = normalizeFddSettings({});
    const tick = (quote, epoch, now = epoch * 1000) => ({ quote, epoch, now });

    it('READY on a valid tick with the first decimal digit as barrier', () => {
        const state = createFddState(settings);
        const r = evaluateFddTick(state, tick('4681.35', 1), settings);
        expect(r.decision).toBe('READY');
        expect(state.barrier).toBe(3);
        const lines = fddTickLines({ state, result: r, market: 'Volatility 75 (1s) Index', now: 0 }).join('\n');
        expect(lines).toMatch(/First Decimal Digit: 3 \| Current Barrier: 3/);
        expect(lines).toMatch(/Recovery Level: 0 \| Current Stake: \$2.00/);
        expect(lines).toMatch(/Status: READY — entry conditions satisfied/);
    });

    it('invalid price → no trade', () => {
        const state = createFddState(settings);
        const r = evaluateFddTick(state, tick('4681', 1), settings);
        expect(r.decision).toBe('ERROR');
        const lines = fddTickLines({ state, result: r, market: 'X', now: 0 }).join('\n');
        expect(lines).toMatch(/ERROR — Unable to extract first decimal digit\./);
        expect(lines).toMatch(/WAITING — invalid tick price/);
    });

    it('cooldown, duplicate signal and confirmation', () => {
        const state = createFddState(normalizeFddSettings({ confirmation_ticks: 2 }));
        expect(evaluateFddTick(state, tick('4681.35', 1), state.settings).reason).toMatch(/entry conditions not satisfied/);
        expect(evaluateFddTick(state, tick('4681.31', 2), state.settings).decision).toBe('READY');
        state.last_trade_at = 2000;
        state.last_trade_epoch = 2;
        expect(evaluateFddTick(state, tick('4681.31', 2, 2500), state.settings).reason).toBe('duplicate signal');
        expect(evaluateFddTick(state, tick('4681.31', 3, 3000), state.settings).reason).toMatch(/cooldown active/);
        expect(evaluateFddTick(state, tick('4681.31', 4, 4000), state.settings).decision).toBe('READY');
    });

    it('stop loss / take profit / max trades stop the bot', () => {
        const state = createFddState(settings);
        state.profit = -250;
        expect(evaluateFddTick(state, tick('4681.35', 1), settings).decision).toBe('STOPPED');
    });

    it('never places a trade whose loss would breach the stop loss', () => {
        const state = createFddState(normalizeFddSettings({ stop_loss: 20, max_recovery_level: 3, max_recovery_stake: 5000 }));
        applyFddResult(state, { profit: -2, stake: 2 });
        expect(state.current_stake).toBe(21);
        const r = evaluateFddTick(state, tick('4681.35', 1), state.settings);
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

    it('numeric whole-number quote without a pip size → first decimal 0', () => {
        expect(extractFirstDecimalDigit(4681)).toBe(0);
    });

    it('trade and status lines', () => {
        expect(fddTradeLines({ barrier: 3, stake: 21, duration: 2, duration_unit: 't', recovery_level: 1 })).toEqual([
            'Action: DIFFER 3 | Stake: $21.00 | Duration: 2 ticks | Recovery Level: 1',
            'Submitting trade...',
        ]);
        expect(fddPlacedLine({ barrier: 3, contract_id: 123, buy_price: 21 })).toBe(
            'TRADE PLACED — DIFFER 3 | Trade submitted. Contract ID: 123 | Buy price: $21.00'
        );
        const state = createFddState(settings);
        const status = fddStatusLines(state, 'Volatility 75 (1s) Index').join('\n');
        expect(status).toMatch(/BOT: First Decimal Digit Differ \+ 10.5 Recovery \| STATUS: ANALYZING/);
        expect(status).toMatch(/BASE STAKE: \$2.00 \| CURRENT STAKE: \$2.00 \| RECOVERY MULTIPLIER: 10.5× \| RECOVERY LEVEL: 0/);
        expect(status).toMatch(/LAST RESULT: - \| CONSECUTIVE LOSSES: 0 \| TRADES: 0 \| WINS: 0 \| LOSSES: 0 \| TOTAL P\/L: \+\$0.00/);
    });
});
