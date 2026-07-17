import {
    FILTER_MODE_GROUP_LEADER,
    FILTER_MODE_MATCHING,
    FILTER_MODE_OPPOSITE,
    FILTER_MODE_STANDALONE,
    THRESHOLD_COUNT,
    analyzeHighLowWindow,
    evaluateHighLowFilter,
    getDigitGroup,
    isHighDigit,
    isLowDigit,
    selectStandaloneDominantDigit,
} from '../high-low-group-filter';
import {
    PRIMARY_SIGNAL_SCORE,
    createTrackerState,
    evaluateConditionalHighLowDiffers,
} from '../conditional-high-low-differs';

const toHistory = (digits: number[]) => digits.map((digit, i) => ({ epoch: i + 1, digit }));

const baseOpts = {
    filter_enabled: true,
    analysis_window: 10,
    filter_mode: FILTER_MODE_GROUP_LEADER,
    threshold_type: THRESHOLD_COUNT,
    dominant_group_count: 7,
    require_most_frequent: true,
    min_target_appearances: 2,
    min_target_group_share: 0,
    required_confirmations: 1,
    max_signal_age: 2,
    primary_signal_source: 'most_frequent',
    frequency_window: 10,
    journal_enabled: false,
    dashboard_enabled: false,
    one_active_trade_only: true,
};

describe('high-low-group-filter', () => {
    it('classifies high and low digits', () => {
        expect(isHighDigit(7)).toBe(true);
        expect(isLowDigit(3)).toBe(true);
        expect(getDigitGroup(7)).toBe('high');
        expect(getDigitGroup(3)).toBe('low');
    });

    it('counts high/low in the analysis window', () => {
        const stats = analyzeHighLowWindow([7, 8, 3, 6, 7, 9, 2, 7, 5, 8], 10);
        expect(stats.high_count).toBe(8);
        expect(stats.low_count).toBe(2);
        expect(stats.frequency[7]).toBe(3);
    });

    it('passes group-leader confirmation for digit 7', () => {
        const stats = analyzeHighLowWindow([7, 8, 3, 6, 7, 9, 2, 7, 5, 8], 10);
        const result = evaluateHighLowFilter(7, stats, {
            filter_enabled: true,
            analysis_window: 10,
            filter_mode: FILTER_MODE_GROUP_LEADER,
            threshold_type: THRESHOLD_COUNT,
            dominant_group_count: 7,
            dominance_percent: 70,
            tie_action: 0,
            require_most_frequent: true,
            min_target_appearances: 2,
            min_target_group_share: 25,
            allow_tied_most_frequent: false,
        });
        expect(result.passed).toBe(true);
        expect(result.dominant_group).toBe('high');
        expect(result.most_frequent).toBe(7);
    });

    it('rejects a low target when high dominates in matching mode', () => {
        const stats = analyzeHighLowWindow([7, 8, 3, 6, 7, 9, 2, 7, 5, 8], 10);
        const result = evaluateHighLowFilter(3, stats, {
            filter_enabled: true,
            analysis_window: 10,
            filter_mode: FILTER_MODE_MATCHING,
            threshold_type: THRESHOLD_COUNT,
            dominant_group_count: 7,
            dominance_percent: 70,
            tie_action: 0,
            require_most_frequent: false,
            min_target_appearances: 0,
            min_target_group_share: 0,
            allow_tied_most_frequent: false,
        });
        expect(result.passed).toBe(false);
        expect(result.fail_reason).toBe('group_mismatch');
    });

    it('passes opposite-group mode for a low target when high dominates', () => {
        const stats = analyzeHighLowWindow([7, 8, 3, 6, 7, 9, 2, 7, 5, 8], 10);
        const result = evaluateHighLowFilter(3, stats, {
            filter_enabled: true,
            analysis_window: 10,
            filter_mode: FILTER_MODE_OPPOSITE,
            threshold_type: THRESHOLD_COUNT,
            dominant_group_count: 7,
            dominance_percent: 70,
            tie_action: 0,
            require_most_frequent: false,
            min_target_appearances: 1,
            min_target_group_share: 0,
            allow_tied_most_frequent: false,
        });
        expect(result.passed).toBe(true);
    });

    it('selects standalone dominant digit', () => {
        const stats = analyzeHighLowWindow([7, 8, 3, 6, 7, 9, 2, 7, 5, 8], 10);
        const selected = selectStandaloneDominantDigit(stats, {
            filter_enabled: true,
            analysis_window: 10,
            filter_mode: FILTER_MODE_STANDALONE,
            threshold_type: THRESHOLD_COUNT,
            dominant_group_count: 7,
            dominance_percent: 70,
            tie_action: 0,
            require_most_frequent: true,
            min_target_appearances: 2,
            min_target_group_share: 0,
            allow_tied_most_frequent: false,
        });
        expect(selected.digit).toBe(7);
    });

    it('fails weak target frequency', () => {
        const stats = analyzeHighLowWindow([7, 8, 3, 6, 7, 9, 2, 7, 5, 8], 10);
        const result = evaluateHighLowFilter(7, stats, {
            filter_enabled: true,
            analysis_window: 10,
            filter_mode: FILTER_MODE_MATCHING,
            threshold_type: THRESHOLD_COUNT,
            dominant_group_count: 7,
            dominance_percent: 70,
            tie_action: 0,
            require_most_frequent: false,
            min_target_appearances: 5,
            min_target_group_share: 0,
            allow_tied_most_frequent: false,
        });
        expect(result.passed).toBe(false);
        expect(result.fail_reason).toBe('weak_appearances');
    });
});

describe('evaluateConditionalHighLowDiffers', () => {
    it('places DIFFER when primary signal and high/low filter both pass', () => {
        const state = createTrackerState();
        // High-heavy window with 7 as most frequent high digit and overall most frequent.
        const digits = [7, 8, 3, 6, 7, 9, 2, 7, 5, 8];
        const result = evaluateConditionalHighLowDiffers(toHistory(digits), baseOpts, state);
        expect(result.prediction).toBe(7);
    });

    it('does not place trade when dominance threshold cannot be met', () => {
        const state = createTrackerState();
        const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const result = evaluateConditionalHighLowDiffers(
            toHistory(digits),
            {
                ...baseOpts,
                dominant_group_count: 8,
                filter_mode: FILTER_MODE_MATCHING,
                require_most_frequent: false,
                min_target_appearances: 0,
            },
            state
        );
        expect(result.prediction).toBe(-1);
    });

    it('requires consecutive confirmations before trading', () => {
        const state = createTrackerState();
        const digits = [7, 8, 3, 6, 7, 9, 2, 7, 5, 8];
        const opts = {
            ...baseOpts,
            required_confirmations: 2,
            max_signal_age: 10,
            journal_enabled: true,
        };
        const history = toHistory(digits);

        const first = evaluateConditionalHighLowDiffers(history, opts, state);
        expect(first.prediction).toBe(-1);

        let epoch = history.length;
        epoch += 1;
        history.push({ epoch, digit: 7 });
        const second = evaluateConditionalHighLowDiffers(history, opts, state);
        expect(second.prediction).toBeGreaterThanOrEqual(0);
    });

    it('supports standalone dominant digit mode', () => {
        const state = createTrackerState();
        const digits = [7, 8, 3, 6, 7, 9, 2, 7, 5, 8];
        const result = evaluateConditionalHighLowDiffers(
            toHistory(digits),
            {
                ...baseOpts,
                filter_mode: FILTER_MODE_STANDALONE,
                primary_signal_source: PRIMARY_SIGNAL_SCORE,
            },
            state
        );
        expect(result.prediction).toBe(7);
    });
});
