import {
    checkLowHighFlip,
    createLowHighFlipScanState,
    createLowHighFlipState,
    DEFAULT_OPTIONS,
    evaluateLowHighFlip,
    evaluateLowHighFlipScan,
    normalizeLowHighFlipOptions,
    releaseLowHighFlipScanSignal,
    replayLowHighFlip,
    STATUS,
} from '../low-high-flip-under';

const withEpochs = (digits: number[], start = 1000) => digits.map((digit, i) => ({ digit, epoch: start + i }));

describe('low-high-flip-under', () => {
    it('defaults to p3,p2 < 4, p1,current > 5, Under 8', () => {
        expect(normalizeLowHighFlipOptions({})).toEqual(DEFAULT_OPTIONS);
        expect(DEFAULT_OPTIONS).toMatchObject({ low_below: 4, high_above: 5, barrier: 8 });
    });

    it('checks the four conditions with strict inequalities', () => {
        expect(checkLowHighFlip([3, 0, 6, 9], DEFAULT_OPTIONS).matched).toBe(true);
        expect(checkLowHighFlip([4, 0, 6, 9], DEFAULT_OPTIONS).matched).toBe(false);
        expect(checkLowHighFlip([3, 4, 6, 9], DEFAULT_OPTIONS).matched).toBe(false);
        expect(checkLowHighFlip([3, 0, 5, 9], DEFAULT_OPTIONS).matched).toBe(false);
        expect(checkLowHighFlip([3, 0, 6, 5], DEFAULT_OPTIONS).matched).toBe(false);
    });

    it('collects until four digits exist', () => {
        const r = evaluateLowHighFlip(withEpochs([1, 2, 7]), {}, createLowHighFlipState());
        expect(r.status).toBe(STATUS.COLLECTING);
        expect(r.prediction).toBe(-1);
    });

    it('fires Under at the passed barrier on the pattern', () => {
        const r = evaluateLowHighFlip(withEpochs([5, 5, 1, 2, 7, 8]), { barrier: 8 }, createLowHighFlipState());
        expect(r.status).toBe(STATUS.VALID_SIGNAL);
        expect(r.prediction).toBe(8);
        expect(r.contract_type).toBe('DIGITUNDER');
        const recovery = evaluateLowHighFlip(withEpochs([1, 2, 7, 8]), { barrier: 7 }, createLowHighFlipState());
        expect(recovery.prediction).toBe(7);
    });

    it('explains WHY NO TRADE with the failed conditions', () => {
        const r = evaluateLowHighFlip(withEpochs([1, 5, 7, 8]), {}, createLowHighFlipState());
        expect(r.status).toBe(STATUS.NO_PATTERN);
        expect(r.why_no_trade).toContain('previous_2 (5) < 4');
        const text = r.journal_messages.map((m: { message: string }) => m.message).join('\n');
        expect(text).toContain('WHY NO TRADE? NO_PATTERN');
    });

    it('does not re-trade the same tick on a re-poll', () => {
        const state = createLowHighFlipState();
        const ticks = withEpochs([1, 2, 7, 8]);
        expect(evaluateLowHighFlip(ticks, {}, state).matched).toBe(true);
        const again = evaluateLowHighFlip(ticks, {}, state);
        expect(again.matched).toBe(false);
        expect(again.status).toBe(STATUS.SIGNAL_CONSUMED);
    });

    it('settles on the first tick after the signal epoch (win if digit < barrier)', () => {
        const state = createLowHighFlipState();
        evaluateLowHighFlip(withEpochs([1, 2, 7, 8]), { barrier: 8 }, state);
        evaluateLowHighFlip(withEpochs([1, 2, 7, 8, 9]), { barrier: 8 }, state);
        expect(state.live).toMatchObject({ wins: 0, losses: 1 });

        const s2 = createLowHighFlipState();
        evaluateLowHighFlip(withEpochs([1, 2, 7, 8]), { barrier: 8 }, s2);
        // Two ticks arrive between polls: the first one after the signal decides.
        evaluateLowHighFlip(withEpochs([1, 2, 7, 8, 3, 9]), { barrier: 8 }, s2);
        expect(s2.live).toMatchObject({ wins: 1, losses: 0 });
    });

    it('respects the signal cooldown', () => {
        const digits = [1, 2, 7, 8, 1, 2, 7, 8];
        const opts = { signal_cooldown_tips: 5 };
        const state = createLowHighFlipState();
        const results = digits.map((_, i) => evaluateLowHighFlip(withEpochs(digits.slice(0, i + 1)), opts, state));
        expect(results[3].matched).toBe(true);
        expect(results[7].status).toBe(STATUS.COOLDOWN_ACTIVE);
        expect(results[7].matched).toBe(false);
    });

    it('uses custom thresholds', () => {
        expect(checkLowHighFlip([2, 2, 4, 4], { ...DEFAULT_OPTIONS, low_below: 3, high_above: 3 }).matched).toBe(true);
    });

    describe('multi-market scan', () => {
        const market = (symbol: string, digits: number[]) => ({ symbol, ticks: withEpochs(digits) });

        it('picks the first market that fires and reports every market', () => {
            const state = createLowHighFlipScanState();
            const r = evaluateLowHighFlipScan(
                [market('1HZ10V', [1, 5, 7, 8]), market('1HZ25V', [1, 2, 7, 8]), market('1HZ50V', [0, 3, 6, 9])],
                { barrier: 8 },
                state
            );
            expect(r.matched).toBe(true);
            expect(r.symbol).toBe('1HZ25V');
            expect(r.prediction).toBe(8);
            expect(r.evaluations.map((e: { status: string }) => e.status)).toEqual([
                STATUS.NO_PATTERN,
                STATUS.VALID_SIGNAL,
                STATUS.VALID_SIGNAL,
            ]);
            // Only the traded market keeps a pending outcome.
            expect(state.symbols['1HZ25V'].pending_outcome).not.toBeNull();
            expect(state.symbols['1HZ50V'].pending_outcome).toBeNull();
            const text = r.journal_messages.map((m: { message: string }) => m.message).join('\n');
            expect(text).toContain('3 markets');
            expect(text).toContain('1HZ10V 1578 ✗p2 | 1HZ25V 1278 ✓ | 1HZ50V 0369 ✓');
            expect(text).toContain('VALID SIGNAL on 1HZ25V');
        });

        it('explains WHY NO TRADE when no market matches, and stays quiet on re-polls', () => {
            const state = createLowHighFlipScanState();
            const markets = [market('R_10', [1, 5, 7, 8]), market('R_25', [9, 9])];
            const r = evaluateLowHighFlipScan(markets, {}, state);
            expect(r.matched).toBe(false);
            expect(r.why_no_trade).toContain('No market matched');
            expect(r.journal_messages.map((m: { message: string }) => m.message).join('\n')).toContain(
                'R_25 99 COLLECTING'
            );
            expect(evaluateLowHighFlipScan(markets, {}, state).journal_messages).toEqual([]);
        });

        it('does not re-trade a market on the same tick, and settles on that market only', () => {
            const state = createLowHighFlipScanState();
            const markets = [market('A', [1, 2, 7, 8]), market('B', [5, 5, 5, 5])];
            expect(evaluateLowHighFlipScan(markets, {}, state).symbol).toBe('A');
            expect(evaluateLowHighFlipScan(markets, {}, state).matched).toBe(false);
            evaluateLowHighFlipScan([market('A', [1, 2, 7, 8, 3]), market('B', [5, 5, 5, 5, 9])], {}, state);
            expect(state.symbols.A.live).toMatchObject({ wins: 1, losses: 0 });
            expect(state.symbols.B.live.signals).toBe(0);
        });

        it('never trades a stale market, and trades it once its stream is fresh', () => {
            const state = createLowHighFlipScanState();
            const stale = evaluateLowHighFlipScan(
                [market('1HZ10V', [5, 5, 5, 5]), { ...market('1HZ25V', [1, 2, 7, 8]), stale: true }],
                {},
                state
            );
            expect(stale.matched).toBe(false);
            expect(stale.evaluations[1].status).toBe(STATUS.STALE_MARKET);
            expect(stale.why_no_trade).toContain('1 stale');
            expect(state.symbols['1HZ25V'].tip_index).toBe(-1);

            const live = evaluateLowHighFlipScan(
                [market('1HZ10V', [5, 5, 5, 5, 5]), market('1HZ25V', [1, 2, 7, 8])],
                {},
                state
            );
            expect(live.symbol).toBe('1HZ25V');
        });

        it('releases a signal that could not be traded', () => {
            const state = createLowHighFlipScanState();
            evaluateLowHighFlipScan([market('A', [1, 2, 7, 8])], {}, state);
            releaseLowHighFlipScanSignal(state, 'A');
            expect(state.symbols.A.pending_outcome).toBeNull();
        });
    });

    it('replays with Under 8 → Under 7 recovery after a loss', () => {
        // Signal at index 3 (Under 8) loses on 9; next signal at index 8 must use Under 7.
        const digits = [1, 2, 7, 8, 9, 1, 2, 7, 8, 0];
        const r = replayLowHighFlip(digits, { barrier: 8, recovery_barrier: 7, signal_cooldown_tips: 1 });
        expect(r.signals.map((s: { tip: number; barrier: number }) => [s.tip, s.barrier])).toEqual([
            [3, 8],
            [8, 7],
        ]);
        expect(r.losses).toBe(1);
        expect(r.wins).toBe(1);
    });
});
