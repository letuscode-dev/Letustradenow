import {
    FILTER_MODE_MATCHING,
    FILTER_MODE_OPPOSITE,
    THRESHOLD_COUNT,
    analyzeParityWindow,
    evaluateParityFilter,
    getDigitParity,
    isEvenDigit,
} from '../even-odd-parity-filter';
import {
    PRIMARY_SIGNAL_SCORE,
    createTrackerState,
    evaluateConditionalEvenOddDiffers,
    probePrimarySignals,
} from '../conditional-even-odd-differs';

const toHistory = (digits: number[]) => digits.map((digit, i) => ({ epoch: i + 1, digit }));

const baseOpts = {
    filter_enabled: true,
    parity_window: 10,
    filter_mode: FILTER_MODE_MATCHING,
    threshold_type: THRESHOLD_COUNT,
    matching_parity_count: 7,
    required_confirmations: 1,
    max_signal_age: 2,
    primary_signal_source: PRIMARY_SIGNAL_SCORE,
    min_signal_score: 4,
    frequency_window: 10,
    recent_appearance_window: 5,
    journal_enabled: false,
    dashboard_enabled: false,
    one_active_trade_only: true,
};

describe('even-odd-parity-filter', () => {
    it('classifies even and odd digits', () => {
        expect(isEvenDigit(8)).toBe(true);
        expect(isEvenDigit(3)).toBe(false);
        expect(getDigitParity(8)).toBe('even');
        expect(getDigitParity(3)).toBe('odd');
    });

    it('counts parity in the analysis window', () => {
        const stats = analyzeParityWindow([8, 2, 4, 7, 6, 0, 8, 3, 2, 4], 10);
        expect(stats.even_count).toBe(8);
        expect(stats.odd_count).toBe(2);
    });

    it('passes matching-parity dominance for an even target', () => {
        const stats = analyzeParityWindow([8, 2, 4, 7, 6, 0, 8, 3, 2, 4], 10);
        const result = evaluateParityFilter(8, stats, {
            filter_enabled: true,
            parity_window: 10,
            filter_mode: FILTER_MODE_MATCHING,
            threshold_type: THRESHOLD_COUNT,
            matching_parity_count: 7,
            matching_parity_percent: 70,
        });
        expect(result.passed).toBe(true);
    });

    it('fails when matching parity count is too low', () => {
        const stats = analyzeParityWindow([8, 2, 4, 7, 6, 0, 3, 1, 5, 9], 10);
        const result = evaluateParityFilter(8, stats, {
            filter_enabled: true,
            parity_window: 10,
            filter_mode: FILTER_MODE_MATCHING,
            threshold_type: THRESHOLD_COUNT,
            matching_parity_count: 7,
            matching_parity_percent: 70,
        });
        expect(result.passed).toBe(false);
    });

    it('passes opposite-parity dominance for an even target', () => {
        const stats = analyzeParityWindow([1, 3, 5, 7, 9, 1, 3, 5, 8, 1], 10);
        const result = evaluateParityFilter(8, stats, {
            filter_enabled: true,
            parity_window: 10,
            filter_mode: FILTER_MODE_OPPOSITE,
            threshold_type: THRESHOLD_COUNT,
            matching_parity_count: 7,
            matching_parity_percent: 70,
        });
        expect(result.passed).toBe(true);
    });
});

describe('evaluateConditionalEvenOddDiffers', () => {
    it('places DIFFER when primary signal and parity filter both pass', () => {
        const state = createTrackerState();
        const digits = [8, 2, 4, 6, 0, 8, 2, 4, 6, 0, 8, 2, 4, 6, 0];
        const result = evaluateConditionalEvenOddDiffers(toHistory(digits), baseOpts, state);
        expect(result.prediction).toBeGreaterThanOrEqual(0);
    });

    it('does not place trade when parity threshold cannot be met', () => {
        const state = createTrackerState();
        const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4];
        const result = evaluateConditionalEvenOddDiffers(
            toHistory(digits),
            {
                ...baseOpts,
                matching_parity_count: 10,
                primary_signal_source: 'most_frequent',
                journal_enabled: true,
            },
            state
        );
        expect(result.prediction).toBe(-1);
    });

    it('requires consecutive confirmations before trading', () => {
        const state = createTrackerState();
        const digits = [8, 2, 4, 6, 0, 8, 2, 4, 6, 0];
        const opts = {
            ...baseOpts,
            required_confirmations: 2,
            max_signal_age: 10,
            journal_enabled: true,
        };
        const history = toHistory(digits);

        const first = evaluateConditionalEvenOddDiffers(history, opts, state);
        expect(first.prediction).toBe(-1);

        let epoch = history.length;
        epoch += 1;
        history.push({ epoch, digit: 2 });
        const second = evaluateConditionalEvenOddDiffers(history, opts, state);
        expect(second.prediction).toBeGreaterThanOrEqual(0);
    });

    it('probes signal score as a primary source', () => {
        const state = createTrackerState();
        const digits = [7, 1, 7, 2, 7, 3, 7, 4, 7, 5, 7, 6, 7, 8, 7];
        state.tickIndex = digits.length - 1;
        state.recentDigits = digits;
        const candidates = probePrimarySignals(state, toHistory(digits), baseOpts, {});
        expect(candidates.length).toBeGreaterThan(0);
    });
});
