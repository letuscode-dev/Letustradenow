import {
    applyLtdResult,
    createLtdState,
    evaluateLtdTick,
    extractDigitBeforeDecimal,
    ltdStopReason,
    normalizeLtdSettings,
    resultLines,
    statusLines,
    tickLines,
    tradeLines,
} from '../last-tick-price-digit-differ';

describe('Last-Tick Price Digit Differ — digit extraction', () => {
    it.each([
        ['4681.35', 1],
        ['5237.84', 7],
        ['901.26', 1],
        ['75.93', 5],
        ['8.42', 8],
    ])('%s → barrier %i', (price, digit) => {
        expect(extractDigitBeforeDecimal(price)).toBe(digit);
    });

    it('uses the pip size so numeric quotes keep their decimals', () => {
        expect(extractDigitBeforeDecimal(4681.3, 1)).toBe(1);
        expect(extractDigitBeforeDecimal(4680, 2)).toBe(0);
        expect(extractDigitBeforeDecimal(5237.84, 2)).toBe(7);
    });

    it('never uses the first decimal or the last digit', () => {
        expect(extractDigitBeforeDecimal('4681.35')).not.toBe(3);
        expect(extractDigitBeforeDecimal('4681.35')).not.toBe(5);
    });

    it('invalid price or no decimal point → null', () => {
        expect(extractDigitBeforeDecimal('abc')).toBeNull();
        expect(extractDigitBeforeDecimal('4681')).toBeNull();
        expect(extractDigitBeforeDecimal(4681, 0)).toBeNull();
        expect(extractDigitBeforeDecimal(Number.NaN, 2)).toBeNull();
        expect(extractDigitBeforeDecimal(null, 2)).toBeNull();
        expect(extractDigitBeforeDecimal('.35')).toBeNull();
    });
});

describe('Last-Tick Price Digit Differ — entry conditions', () => {
    const settings = normalizeLtdSettings({});
    const tick = (quote, epoch, now = epoch * 1000) => ({ quote, epoch, now });

    it('defaults', () => {
        expect(settings).toMatchObject({
            auto_trading: true,
            confirmation_ticks: 2,
            cooldown_seconds: 2,
            max_trades: 50,
            max_consecutive_losses: 3,
        });
    });

    it('waits for confirmation, then is READY with the barrier from the latest tick', () => {
        const state = createLtdState();
        const first = evaluateLtdTick(state, tick('4681.35', 1), settings);
        expect(first.decision).toBe('WAITING');
        expect(first.reason).toMatch(/confirmation not satisfied/);
        expect(state.barrier).toBe(1);

        const second = evaluateLtdTick(state, tick('4681.74', 2), settings);
        expect(second.decision).toBe('READY');
        expect(state.barrier).toBe(1);
        expect(state.previous_barrier).toBe(1);
        expect(state.tick_count).toBe(2);
    });

    it('the barrier follows the latest tick and resets confirmation when it changes', () => {
        const state = createLtdState();
        evaluateLtdTick(state, tick('4681.35', 1), settings);
        const r = evaluateLtdTick(state, tick('4682.74', 2), settings);
        expect(state.barrier).toBe(2);
        expect(state.previous_barrier).toBe(1);
        expect(r.decision).toBe('WAITING');
    });

    it('cooldown and duplicate signal', () => {
        const state = createLtdState();
        state.last_trade_at = 10_000;
        state.last_trade_epoch = 10;
        state.barrier = 1;
        state.stable_ticks = 5;
        expect(evaluateLtdTick(state, tick('4681.35', 10, 10_500), settings).reason).toBe('duplicate signal');
        expect(evaluateLtdTick(state, tick('4681.35', 11, 11_000), settings).reason).toMatch(/cooldown active/);
        expect(evaluateLtdTick(state, tick('4681.35', 13, 13_000), settings).decision).toBe('READY');
    });

    it('auto trading OFF analyses only', () => {
        const state = createLtdState();
        state.barrier = 1;
        state.stable_ticks = 5;
        const r = evaluateLtdTick(state, tick('4681.35', 1), normalizeLtdSettings({ auto_trading: false }));
        expect(r.decision).toBe('WAITING');
        expect(r.reason).toMatch(/auto trading is OFF/);
    });

    it('invalid price → ERROR, no trade', () => {
        const state = createLtdState();
        const r = evaluateLtdTick(state, tick('bad', 1), settings);
        expect(r.decision).toBe('ERROR');
        expect(tickLines({ state, result: r, market: 'Step Index 100', now: 0 }).join(' ')).toMatch(
            /ERROR — Unable to extract barrier from latest tick/
        );
    });

    it('limits stop the bot', () => {
        const state = createLtdState();
        state.consecutive_losses = 3;
        expect(evaluateLtdTick(state, tick('4681.35', 1), settings).decision).toBe('STOPPED');
        expect(ltdStopReason({ ...createLtdState(), trades: 50 }, settings)).toMatch(/maximum trades/);
        expect(ltdStopReason({ ...createLtdState(), profit: 10 }, settings)).toMatch(/take profit/);
        expect(ltdStopReason({ ...createLtdState(), profit: -20 }, settings)).toMatch(/stop loss/);
    });
});

describe('Last-Tick Price Digit Differ — results and journal', () => {
    it('tracks wins, losses, streaks and P/L', () => {
        const state = createLtdState();
        expect(applyLtdResult(state, { profit: 0.19 })).toBe(true);
        expect(applyLtdResult(state, { profit: -2 })).toBe(false);
        expect(applyLtdResult(state, { profit: -2 })).toBe(false);
        expect(state).toMatchObject({ trades: 3, wins: 1, losses: 2, consecutive_losses: 2, consecutive_wins: 0 });
        expect(state.profit).toBe(-3.81);
    });

    it('journal lines carry the required details', () => {
        const state = createLtdState();
        const r = evaluateLtdTick(state, { quote: '4681.35', epoch: 1, now: 0 }, normalizeLtdSettings({}));
        const lines = tickLines({ state, result: r, market: 'Step Index 100', now: 0 }).join('\n');
        expect(lines).toMatch(/NEW TICK RECEIVED #1/);
        expect(lines).toMatch(/Symbol: Step Index 100/);
        expect(lines).toMatch(/Price: 4681.35/);
        expect(lines).toMatch(/Extracted digit before decimal: 1/);
        expect(lines).toMatch(/Status: WAITING — entry confirmation not satisfied/);

        expect(tradeLines({ barrier: 7, stake: 2, duration: 2, duration_unit: 't' }).join(' ')).toMatch(
            /TRADE PLACED — DIFFER 7 \| Stake: \$2.00 \| Duration: 2 ticks/
        );

        applyLtdResult(state, { profit: 0.19 });
        const result = resultLines({ state, barrier: 2, won: true, profit: 0.19, contract_id: 123, balance: '10,000.19 USD', now: 0 }).join(
            '\n'
        );
        expect(result).toMatch(/CONTRACT RESULT \| Contract ID: 123 \| Barrier: 2 \| Result: WON \| Profit: \+\$0.19/);
        expect(result).toMatch(/Consecutive wins: 1 \| Consecutive losses: 0/);

        const status = statusLines(state, 'Step Index 100').join('\n');
        expect(status).toMatch(/BOT: Last-Tick Price Digit Differ \| STATUS: ANALYZING \| MARKET: Step Index 100/);
        expect(status).toMatch(/TRADES: 1 \| WINS: 1 \| LOSSES: 0 \| PROFIT\/LOSS: \+\$0.19/);
    });
});
