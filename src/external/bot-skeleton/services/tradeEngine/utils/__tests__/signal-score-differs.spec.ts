import {
    buildScoreContext,
    createTrackerState,
    evaluateSignalScoreDiffers,
    formatScoreDashboard,
    openSignalScoreDiffersActiveTrade,
    processDigitTick,
    releaseSignalScoreDiffersActiveTrade,
    scoreDigit,
    selectWinningDigit,
    syncTrackerWithDigits,
} from '../signal-score-differs';

const toHistory = (digits: number[]) => digits.map((digit, i) => ({ epoch: i + 1, digit }));

const buildEqualGapPattern = (digit: number, gap: number) => {
    const other = (digit + 1) % 10;
    const seq = [digit];
    for (let i = 0; i < gap; i++) seq.push(other);
    seq.push(digit);
    for (let i = 0; i < gap; i++) seq.push(other);
    seq.push(digit);
    return seq;
};

/** Digits that reach min score for 7 without consecutive same-digit ticks (which reset gap state). */
const qualifyingDigits = () => [...buildEqualGapPattern(7, 2), 8, 1, 0, 2, 7, 8, 8, 7];

const baseOpts = {
    min_signal_score: 6,
    frequency_window: 10,
    recent_appearance_window: 5,
    long_absence_threshold: 20,
    spike_recent_window: 5,
    spike_historical_window: 10,
    min_gap: 2,
    max_gap: 10,
    most_frequent_enabled: true,
    most_frequent_score: 2,
    repeated_gap_enabled: true,
    repeated_gap_score: 3,
    recent_double_enabled: true,
    recent_double_score: 2,
    frequency_spike_enabled: true,
    frequency_spike_score: 2,
    long_absence_enabled: true,
    long_absence_score: -1,
    journal_enabled: false,
    dashboard_enabled: false,
    one_active_trade_only: true,
};

describe('scoreDigit / modular conditions', () => {
    it('sums enabled condition scores for a digit', () => {
        const state = createTrackerState();
        syncTrackerWithDigits(state, [7, 1, 7, 2, 7, 3, 7, 4, 7, 5], baseOpts);
        buildEqualGapPattern(7, 2).forEach(d => processDigitTick(state, d, baseOpts));
        const ctx = buildScoreContext(state, baseOpts);
        const entry = scoreDigit(7, ctx, baseOpts);
        expect(entry.total).toBeGreaterThanOrEqual(6);
        expect(entry.breakdown.some(row => row.id === 'recent_double' && row.applies)).toBe(true);
    });
});

describe('selectWinningDigit', () => {
    it('picks the highest score above the minimum', () => {
        const state = createTrackerState();
        const scored = [
            { digit: 2, total: 5, breakdown: [] },
            { digit: 7, total: 8, breakdown: [] },
            { digit: 5, total: 6, breakdown: [] },
        ];
        expect(selectWinningDigit(scored, 6, state)).toBe(7);
    });

    it('skips the excluded digit and picks the next best signal', () => {
        const state = createTrackerState();
        const scored = [
            { digit: 2, total: 5, breakdown: [] },
            { digit: 7, total: 8, breakdown: [] },
            { digit: 5, total: 6, breakdown: [] },
        ];
        expect(selectWinningDigit(scored, 6, state, { excludeDigit: 7 })).toBe(5);
    });

    it('returns -1 when no digit meets the minimum', () => {
        const state = createTrackerState();
        const scored = [
            { digit: 2, total: 4, breakdown: [] },
            { digit: 7, total: 5, breakdown: [] },
        ];
        expect(selectWinningDigit(scored, 6, state)).toBe(-1);
    });
});

describe('evaluateSignalScoreDiffers', () => {
    it('generates DIFFER for a qualifying digit', () => {
        const state = createTrackerState();
        const result = evaluateSignalScoreDiffers(toHistory(qualifyingDigits()), baseOpts, state);
        expect(result.prediction).toBe(7);
        expect(result.scores[7]).toBeGreaterThanOrEqual(6);
    });

    it('blocks the same digit and scans for another signal', () => {
        const state = createTrackerState();
        const history = toHistory(qualifyingDigits());
        const first = evaluateSignalScoreDiffers(history, baseOpts, state);
        expect(first.prediction).toBe(7);
        expect(state.lastTradedDigit).toBe(7);

        releaseSignalScoreDiffersActiveTrade(state);

        const second = evaluateSignalScoreDiffers(history, { ...baseOpts, journal_enabled: true }, state);
        expect(second.prediction).not.toBe(7);
        if (second.prediction < 0) {
            expect(second.journal_messages.some(m => String(m.message).includes('Scanning for another signal'))).toBe(
                true
            );
        }
    });

    it('renders a score dashboard with the leader highlighted', () => {
        const scored = Array.from({ length: 10 }, (_, digit) => ({
            digit,
            total: digit === 7 ? 8 : digit,
            breakdown: [],
        }));
        const table = formatScoreDashboard(scored, 7);
        expect(table).toContain('▶ 7 : 8');
        expect(table).toContain('0 : 0');
    });

    it('blocks while an open trade is active', () => {
        const state = createTrackerState();
        const history = toHistory(qualifyingDigits());
        const opts = { ...baseOpts, journal_enabled: true };
        evaluateSignalScoreDiffers(history, opts, state);
        openSignalScoreDiffersActiveTrade(state);
        const result = evaluateSignalScoreDiffers(history, opts, state);
        expect(result.prediction).toBe(-1);
        expect(result.journal_messages.some(m => m.message.includes('Blocked'))).toBe(true);
        releaseSignalScoreDiffersActiveTrade(state);
    });

    it('does not flood journal when syncing a large tick window', () => {
        const state = createTrackerState();
        const digits = Array.from({ length: 120 }, (_, i) => i % 10);
        const result = evaluateSignalScoreDiffers(
            digits,
            { ...baseOpts, journal_enabled: true },
            state
        );
        expect(result.journal_messages.length).toBeLessThanOrEqual(8);
        expect(state.tickIndex).toBe(119);
    });
});
