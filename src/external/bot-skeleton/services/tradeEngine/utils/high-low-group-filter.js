/**
 * Reusable High/Low group filter for Digit Differs strategies.
 *
 * Low digits:  0, 1, 2, 3, 4
 * High digits: 5, 6, 7, 8, 9
 */

export const FILTER_MODE_MATCHING = 0;
export const FILTER_MODE_OPPOSITE = 1;
export const FILTER_MODE_STANDALONE = 2;
export const FILTER_MODE_GROUP_LEADER = 3;

export const THRESHOLD_COUNT = 0;
export const THRESHOLD_PERCENT = 1;

export const TIE_REJECT = 0;
export const TIE_WAIT = 1;
export const TIE_PREFER_PRIMARY = 2;
export const TIE_PREFER_PREVIOUS = 3;

export const LOW_DIGITS = [0, 1, 2, 3, 4];
export const HIGH_DIGITS = [5, 6, 7, 8, 9];

export const isHighDigit = digit => {
    const n = Number(digit);
    return Number.isInteger(n) && n >= 5 && n <= 9;
};

export const isLowDigit = digit => {
    const n = Number(digit);
    return Number.isInteger(n) && n >= 0 && n <= 4;
};

export const getDigitGroup = digit => (isHighDigit(digit) ? 'high' : 'low');

export const getGroupLabel = group => (group === 'high' ? 'High' : 'Low');

const toInt = (value, fallback, min = null) => {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) {
        n = fallback;
    }
    if (min !== null && n < min) {
        n = min;
    }
    return n;
};

const toBool = (value, default_value = false) => {
    if (value === undefined || value === null) {
        return default_value;
    }
    return value === true || value === 1 || value === 'TRUE' || value === 'true';
};

export const normalizeHighLowFilterOptions = (options = {}) => {
    const filter_mode = toInt(options.filter_mode, FILTER_MODE_GROUP_LEADER, 0);
    const threshold_type = toInt(options.threshold_type, THRESHOLD_COUNT, 0);
    const tie_action = toInt(options.tie_action, TIE_REJECT, 0);

    return {
        filter_enabled: options.filter_enabled !== false && options.filter_enabled !== 0,
        analysis_window: Math.max(1, toInt(options.analysis_window ?? options.parity_window, 10, 1)),
        filter_mode,
        threshold_type,
        dominant_group_count: Math.max(1, toInt(options.dominant_group_count ?? options.matching_parity_count, 7, 1)),
        dominance_percent: Math.min(
            100,
            Math.max(1, toInt(options.dominance_percent ?? options.matching_parity_percent, 70, 1))
        ),
        tie_action,
        require_most_frequent: toBool(options.require_most_frequent, true),
        min_target_appearances: Math.max(0, toInt(options.min_target_appearances, 2, 0)),
        min_target_group_share: Math.min(
            100,
            Math.max(0, toInt(options.min_target_group_share, 25, 0))
        ),
        allow_tied_most_frequent: toBool(options.allow_tied_most_frequent, false),
    };
};

/**
 * Analyse High/Low distribution and per-digit frequencies in a rolling window.
 * @param {number[]} digits
 * @param {number} window_size
 */
export const analyzeHighLowWindow = (digits, window_size) => {
    const window = Math.max(1, window_size);
    const slice = Array.isArray(digits) ? digits.slice(-window) : [];
    const frequency = Array(10).fill(0);
    let high_count = 0;
    let low_count = 0;
    const last_index = Array(10).fill(-1);

    for (let i = 0; i < slice.length; i++) {
        const digit = Number(slice[i]);
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
            continue;
        }
        frequency[digit] += 1;
        last_index[digit] = i;
        if (isHighDigit(digit)) {
            high_count += 1;
        } else {
            low_count += 1;
        }
    }

    const total = high_count + low_count;
    const high_percent = total > 0 ? (high_count / total) * 100 : 0;
    const low_percent = total > 0 ? (low_count / total) * 100 : 0;

    const high_frequencies = {};
    const low_frequencies = {};
    HIGH_DIGITS.forEach(d => {
        high_frequencies[d] = frequency[d];
    });
    LOW_DIGITS.forEach(d => {
        low_frequencies[d] = frequency[d];
    });

    return {
        high_count,
        low_count,
        high_percent,
        low_percent,
        total,
        frequency,
        high_frequencies,
        low_frequencies,
        last_index,
        window_size: window,
        sample_size: slice.length,
    };
};

const passesDominanceThreshold = (count, percent, options) => {
    if (options.threshold_type === THRESHOLD_PERCENT) {
        return percent >= options.dominance_percent;
    }
    const required = Math.min(options.dominant_group_count, options.analysis_window);
    return count >= required;
};

/**
 * Resolve which group is dominant given current stats and tie policy.
 * @returns {{ group: 'high'|'low'|null, tied: boolean, reason: string }}
 */
export const resolveDominantGroup = (stats, options, context = {}) => {
    const high_ok = passesDominanceThreshold(stats.high_count, stats.high_percent, options);
    const low_ok = passesDominanceThreshold(stats.low_count, stats.low_percent, options);

    if (high_ok && !low_ok) {
        return { group: 'high', tied: false, reason: 'high_dominates' };
    }
    if (low_ok && !high_ok) {
        return { group: 'low', tied: false, reason: 'low_dominates' };
    }
    if (!high_ok && !low_ok) {
        // Neither side meets threshold — still detect a raw count/percent tie for messaging.
        if (stats.high_count === stats.low_count) {
            return resolveTie(stats, options, context);
        }
        // Prefer the larger side only if it somehow passes; otherwise no dominance.
        if (stats.high_count > stats.low_count && high_ok) {
            return { group: 'high', tied: false, reason: 'high_dominates' };
        }
        if (stats.low_count > stats.high_count && low_ok) {
            return { group: 'low', tied: false, reason: 'low_dominates' };
        }
        return { group: null, tied: false, reason: 'no_dominance' };
    }

    // Both sides meet threshold (unusual) or equal — treat as tie.
    return resolveTie(stats, options, context);
};

const resolveTie = (stats, options, context) => {
    const tie_action = options.tie_action;

    if (tie_action === TIE_PREFER_PRIMARY && context.primary_group) {
        return { group: context.primary_group, tied: true, reason: 'tie_prefer_primary' };
    }
    if (tie_action === TIE_PREFER_PREVIOUS && context.previous_dominant_group) {
        return { group: context.previous_dominant_group, tied: true, reason: 'tie_prefer_previous' };
    }
    if (tie_action === TIE_WAIT) {
        return { group: null, tied: true, reason: 'tie_wait' };
    }
    return { group: null, tied: true, reason: 'tie_reject' };
};

/**
 * Find most frequent digit(s) within a group.
 * @returns {{ leaders: number[], max_count: number }}
 */
export const findGroupLeaders = (stats, group) => {
    const digits = group === 'high' ? HIGH_DIGITS : LOW_DIGITS;
    let max_count = 0;
    const leaders = [];

    for (let i = 0; i < digits.length; i++) {
        const digit = digits[i];
        const count = stats.frequency[digit] || 0;
        if (count > max_count) {
            max_count = count;
            leaders.length = 0;
            leaders.push(digit);
        } else if (count === max_count && count > 0) {
            leaders.push(digit);
        }
    }

    return { leaders, max_count };
};

const formatGroupFrequencies = (stats, group) => {
    const digits = group === 'high' ? HIGH_DIGITS : LOW_DIGITS;
    return digits.map(d => `${d} = ${stats.frequency[d] || 0}`).join('\n');
};

/**
 * Evaluate High/Low confirmation for a target digit.
 * @param {number} target_digit
 * @param {ReturnType<typeof analyzeHighLowWindow>} stats
 * @param {ReturnType<typeof normalizeHighLowFilterOptions>} options
 * @param {{ previous_dominant_group?: string|null, primary_strength?: number }} context
 */
export const evaluateHighLowFilter = (target_digit, stats, options, context = {}) => {
    const group = getDigitGroup(target_digit);
    const group_label = getGroupLabel(group);
    const mode = options.filter_mode;

    const dominance = resolveDominantGroup(stats, options, {
        primary_group: group,
        previous_dominant_group: context.previous_dominant_group,
    });

    const dominant_group = dominance.group;
    const dominant_label = dominant_group ? getGroupLabel(dominant_group) : null;
    const opposite_group = dominant_group === 'high' ? 'low' : dominant_group === 'low' ? 'high' : null;

    const group_total = group === 'high' ? stats.high_count : stats.low_count;
    const appearances = stats.frequency[target_digit] || 0;
    const group_share = group_total > 0 ? (appearances / group_total) * 100 : 0;

    const leaders_info = dominant_group ? findGroupLeaders(stats, dominant_group) : { leaders: [], max_count: 0 };
    const target_group_leaders = findGroupLeaders(stats, group);

    let mode_label = 'Matching-Group Confirmation';
    let group_ok = false;
    let frequency_ok = true;
    let fail_reason = null;

    if (!dominant_group) {
        return {
            passed: false,
            group,
            group_label,
            dominant_group: null,
            dominant_label: null,
            mode_label: modeLabel(mode),
            appearances,
            group_share,
            group_total,
            leaders: leaders_info.leaders,
            most_frequent: leaders_info.leaders[0] ?? -1,
            required_label: requiredLabel(options),
            fail_reason: dominance.tied ? 'no_dominant_group_tie' : 'no_dominant_group',
            dominance,
            stats,
        };
    }

    if (mode === FILTER_MODE_MATCHING) {
        mode_label = 'Matching-Group Confirmation';
        group_ok = group === dominant_group;
        if (!group_ok) {
            fail_reason = 'group_mismatch';
        }
    } else if (mode === FILTER_MODE_OPPOSITE) {
        mode_label = 'Opposite-Group Confirmation';
        group_ok = group === opposite_group;
        if (!group_ok) {
            fail_reason = 'group_mismatch_opposite';
        }
    } else if (mode === FILTER_MODE_STANDALONE) {
        mode_label = 'Standalone Dominant Digit';
        group_ok = group === dominant_group && leaders_info.leaders.includes(target_digit);
        if (!group_ok) {
            fail_reason = leaders_info.leaders.includes(target_digit) ? 'group_mismatch' : 'not_group_leader';
        }
    } else {
        mode_label = 'Primary Signal Plus Group Leader';
        group_ok = group === dominant_group && leaders_info.leaders.includes(target_digit);
        if (group !== dominant_group) {
            fail_reason = 'group_mismatch';
        } else if (!leaders_info.leaders.includes(target_digit)) {
            fail_reason = 'not_group_leader';
        }
        if (leaders_info.leaders.length > 1 && !options.allow_tied_most_frequent) {
            // Prefer target if it is among leaders; otherwise fail.
            if (!leaders_info.leaders.includes(target_digit)) {
                group_ok = false;
                fail_reason = 'tied_leaders';
            }
        }
    }

    if (group_ok) {
        const freq_check = checkFrequencyRules(target_digit, stats, options, group, target_group_leaders);
        frequency_ok = freq_check.ok;
        if (!freq_check.ok) {
            fail_reason = freq_check.reason;
        }
    }

    const passed = Boolean(group_ok && frequency_ok);

    return {
        passed,
        group,
        group_label,
        dominant_group,
        dominant_label,
        mode_label,
        appearances,
        group_share,
        group_total,
        leaders: leaders_info.leaders,
        most_frequent: leaders_info.leaders[0] ?? -1,
        required_label: requiredLabel(options),
        fail_reason: passed ? null : fail_reason,
        dominance,
        stats,
        frequency_text: dominant_group ? formatGroupFrequencies(stats, dominant_group) : '',
    };
};

const modeLabel = mode => {
    if (mode === FILTER_MODE_OPPOSITE) return 'Opposite-Group Confirmation';
    if (mode === FILTER_MODE_STANDALONE) return 'Standalone Dominant Digit';
    if (mode === FILTER_MODE_GROUP_LEADER) return 'Primary Signal Plus Group Leader';
    return 'Matching-Group Confirmation';
};

const requiredLabel = options => {
    if (options.threshold_type === THRESHOLD_PERCENT) {
        return `${options.dominance_percent}%`;
    }
    return `${Math.min(options.dominant_group_count, options.analysis_window)}`;
};

const checkFrequencyRules = (target_digit, stats, options, group, leaders_info) => {
    // When no frequency rules are enabled, skip.
    const any_rule =
        options.require_most_frequent ||
        options.min_target_appearances > 0 ||
        options.min_target_group_share > 0;

    if (!any_rule) {
        return { ok: true, reason: null };
    }

    const appearances = stats.frequency[target_digit] || 0;
    const group_total = group === 'high' ? stats.high_count : stats.low_count;
    const group_share = group_total > 0 ? (appearances / group_total) * 100 : 0;

    if (options.require_most_frequent) {
        const is_leader = leaders_info.leaders.includes(target_digit);
        if (!is_leader) {
            return { ok: false, reason: 'not_most_frequent' };
        }
        if (leaders_info.leaders.length > 1 && !options.allow_tied_most_frequent) {
            // Still allow if target is among tied leaders — caller may apply digit tie-breakers.
            // Reject only when target is not the sole leader and ties are disallowed AND
            // there is more than one leader without a clear preference — keep ok for now.
        }
    }

    if (options.min_target_appearances > 0 && appearances < options.min_target_appearances) {
        return { ok: false, reason: 'weak_appearances' };
    }

    if (options.min_target_group_share > 0 && group_share < options.min_target_group_share) {
        return { ok: false, reason: 'weak_group_share' };
    }

    return { ok: true, reason: null };
};

/**
 * Standalone mode: pick the most frequent digit in the dominant group.
 */
export const selectStandaloneDominantDigit = (stats, options, context = {}) => {
    const dominance = resolveDominantGroup(stats, options, context);
    if (!dominance.group) {
        return {
            digit: -1,
            filter_result: null,
            dominance,
        };
    }

    const { leaders, max_count } = findGroupLeaders(stats, dominance.group);
    if (!leaders.length || max_count <= 0) {
        return { digit: -1, filter_result: null, dominance };
    }

    // Prefer most recent appearance among tied leaders.
    let best = leaders[0];
    let best_last = stats.last_index[best] ?? -1;
    for (let i = 1; i < leaders.length; i++) {
        const d = leaders[i];
        const last = stats.last_index[d] ?? -1;
        if (last > best_last) {
            best = d;
            best_last = last;
        }
    }

    const filter_result = evaluateHighLowFilter(best, stats, options, context);
    return {
        digit: filter_result.passed ? best : -1,
        filter_result,
        dominance,
        leaders,
    };
};

export const formatHighLowDashboard = ({
    options,
    stats,
    target_digit = -1,
    target_group = '',
    filter_result = null,
    primary_source = '',
    signal_age = 0,
    confirmation_count = 0,
    required_confirmations = 1,
    trade_status = 'Idle',
}) => {
    const dominant = filter_result?.dominant_label || '—';
    const most_freq =
        filter_result?.most_frequent != null && filter_result.most_frequent >= 0
            ? String(filter_result.most_frequent)
            : '—';

    const lines = [
        `Analysis window: ${options.analysis_window} ticks`,
        '',
        `High count: ${stats.high_count}`,
        `Low count: ${stats.low_count}`,
        '',
        `High percentage: ${Math.round(stats.high_percent)}%`,
        `Low percentage: ${Math.round(stats.low_percent)}%`,
        '',
        `Dominant group: ${dominant}`,
        `Most frequent ${dominant !== '—' ? dominant : 'group'} digit: ${most_freq}`,
        '',
        `Target digit: ${target_digit >= 0 ? target_digit : '—'}`,
        `Target group: ${target_group || '—'}`,
        '',
        `Target appearances: ${filter_result?.appearances ?? '—'}`,
        `Target group share: ${
            filter_result ? `${Math.round(filter_result.group_share * 10) / 10}%` : '—'
        }`,
        '',
        `Required threshold: ${filter_result?.required_label ?? '—'}`,
        `Filter status: ${filter_result?.passed ? 'Passed' : filter_result ? 'Failed' : '—'}`,
        '',
        `Primary signal source: ${primary_source || '—'}`,
        `Signal age: ${signal_age}`,
        `Confirmation count: ${confirmation_count} / ${required_confirmations}`,
        `Trade status: ${trade_status}`,
    ];
    return lines.join('\n');
};
