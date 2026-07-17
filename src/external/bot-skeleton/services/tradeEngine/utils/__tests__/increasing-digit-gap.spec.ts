import {
    PURCHASE_LEAD_TICKS,
    createTrackerState,
    detectArithmeticProgression,
    evaluateIncreasingDigitGap,
    formatGapHistory,
    openIncreasingDigitGapActiveTrade,
    processDigitTick,
    releaseIncreasingDigitGapActiveTrade,
} from '../increasing-digit-gap';

const buildArithmeticPattern = (digit: number, gaps: number[]) => {
    const other = (digit + 1) % 10;
    const seq: number[] = [digit];
    for (const gap of gaps) {
        for (let i = 0; i < gap; i++) seq.push(other);
        seq.push(digit);
    }
    return seq;
};

const toHistory = (digits: number[]) => digits.map((digit, i) => ({ epoch: i + 1, digit }));

const runUntilFire = (
    history: { epoch: number; digit: number }[],
    digit: number,
    opts: Record<string, unknown>,
    state: ReturnType<typeof createTrackerState>
) => {
    let epoch = history[history.length - 1].epoch;
    let result = evaluateIncreasingDigitGap(history, opts, state);
    const fire_tick = state.digits[digit].fireTick;
    const other = (digit + 1) % 10;

    while (state.tickIndex < fire_tick) {
        epoch += 1;
        history.push({ epoch, digit: other });
        result = evaluateIncreasingDigitGap(history, opts, state);
    }
    return result;
};

describe('detectArithmeticProgression', () => {
    it('detects +1 progression and predicts next gap', () => {
        expect(detectArithmeticProgression([2, 3, 4], 3)).toEqual({
            commonDifference: 1,
            predictedGap: 5,
        });
    });

    it('detects +2 progression', () => {
        expect(detectArithmeticProgression([4, 6, 8], 3)).toEqual({
            commonDifference: 2,
            predictedGap: 10,
        });
    });

    it('returns null when differences differ', () => {
        expect(detectArithmeticProgression([2, 3, 5], 3)).toBeNull();
    });

    it('formats gap history for journal', () => {
        expect(formatGapHistory([2, 3, 4])).toBe('2 → 3 → 4');
    });
});

describe('processDigitTick / increasing gaps', () => {
    const baseOpts = {
        min_gap: 1,
        max_gap: 20,
        min_common_diff: 1,
        max_common_diff: 5,
        gaps_required: 3,
        journal_enabled: false,
    };

    it('schedules after three increasing gaps', () => {
        const state = createTrackerState();
        buildArithmeticPattern(9, [2, 3, 4]).forEach(d => processDigitTick(state, d, baseOpts));

        const ds = state.digits[9];
        expect(ds.schedulePhase).toBe('countdown');
        expect(ds.predictedGap).toBe(5);
        expect(ds.commonDifference).toBe(1);
        expect(ds.targetTick).toBe(state.tickIndex + 5 + 1);
        expect(ds.fireTick).toBe(ds.targetTick - PURCHASE_LEAD_TICKS);
    });

    it('does not schedule when common difference is out of range', () => {
        const state = createTrackerState();
        const opts = { ...baseOpts, max_common_diff: 0 };
        buildArithmeticPattern(9, [2, 3, 4]).forEach(d => processDigitTick(state, d, opts));
        expect(state.digits[9].schedulePhase).toBe('none');
    });

    it('cancels countdown when digit appears early', () => {
        const state = createTrackerState();
        const opts = { ...baseOpts, cancel_early_appearance: true, journal_enabled: true };
        buildArithmeticPattern(9, [2, 3, 4]).forEach(d => processDigitTick(state, d, opts));
        expect(state.digits[9].schedulePhase).toBe('countdown');

        processDigitTick(state, 9, opts);

        expect(state.digits[9].schedulePhase).toBe('none');
        expect(state.digits[9].gapHistory).toEqual([]);
        expect(state.pendingJournal.some(m => String(m.message).includes('Prediction cancelled'))).toBe(true);
    });

    it('keeps countdown when early cancellation is disabled', () => {
        const state = createTrackerState();
        const opts = { ...baseOpts, cancel_early_appearance: false };
        buildArithmeticPattern(9, [2, 3, 4]).forEach(d => processDigitTick(state, d, opts));
        const fire_tick = state.digits[9].fireTick;

        processDigitTick(state, 9, opts);

        expect(state.digits[9].schedulePhase).toBe('countdown');
        expect(state.digits[9].fireTick).toBe(fire_tick);
    });
});

describe('evaluateIncreasingDigitGap', () => {
    const opts = {
        min_gap: 1,
        max_gap: 20,
        min_common_diff: 1,
        max_common_diff: 5,
        gaps_required: 3,
        journal_enabled: false,
        one_active_trade_only: true,
    };

    it('fires DIFFER on the purchase lead tick', () => {
        const state = createTrackerState();
        const history = toHistory(buildArithmeticPattern(9, [2, 3, 4]));
        evaluateIncreasingDigitGap(history, opts, state);

        const result = runUntilFire(history, 9, opts, state);
        expect(result.prediction).toBe(9);
        expect(state.digits[9].schedulePhase).toBe('none');
    });

    it('blocks while an active trade is open', () => {
        const state = createTrackerState();
        const history = toHistory(buildArithmeticPattern(9, [2, 3, 4]));
        const blockOpts = { ...opts, journal_enabled: true };
        evaluateIncreasingDigitGap(history, blockOpts, state);
        runUntilFire(history, 9, blockOpts, state);
        openIncreasingDigitGapActiveTrade(state);

        const result = evaluateIncreasingDigitGap(history, blockOpts, state);
        expect(result.prediction).toBe(-1);
        expect(result.journal_messages.some(m => m.message.includes('Blocked'))).toBe(true);

        releaseIncreasingDigitGapActiveTrade(state);
    });

    it('predicts gap 10 for +2 progression', () => {
        const state = createTrackerState();
        buildArithmeticPattern(4, [4, 6, 8]).forEach(d =>
            processDigitTick(state, d, { ...opts, journal_enabled: false })
        );
        expect(state.digits[4].predictedGap).toBe(10);
    });
});
