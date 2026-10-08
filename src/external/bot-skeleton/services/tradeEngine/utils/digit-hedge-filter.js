/**
 * Selective Over 5 + Under 4 hedge.
 *
 * The last `window` completed digits must show a quiet 4/5 gap and active
 * 0–3 and 6–9 groups. The latest `recent` ticks must not contain more 4s and
 * 5s than the `recent` ticks before them. A 3-digit sequence is a warning
 * only after it has been followed by 4 or 5 at least `patternThreshold` times
 * and that digit is strictly the most common follower. One occurrence is not
 * enough. Every condition has to pass.
 */

const PATTERN_LENGTH = 3;

const roundPct = value => Math.round(Number(value) * 100) / 100;

export const formatFilterPct = value => {
    const rounded = roundPct(value);
    if (!Number.isFinite(rounded)) return '0%';
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
    return `${text}%`;
};

const clampInt = (value, min, max, fallback) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

const clampPct = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

export const normalizeDigitHedgeFilter = (options = {}) => ({
    window: clampInt(options.window, 10, 1000, 100),
    recent: clampInt(options.recent, 5, 500, 20),
    maxGap: clampPct(options.maxGap, 0, 100, 10),
    minLow: clampPct(options.minLow, 0, 100, 40),
    minHigh: clampPct(options.minHigh, 0, 100, 40),
    maxDigit4: clampPct(options.maxDigit4, 0, 100, 7),
    maxDigit5: clampPct(options.maxDigit5, 0, 100, 7),
    // A single follow-up is never a strong pattern.
    patternThreshold: clampInt(options.patternThreshold, 2, 50, 3),
    market: options.market ? String(options.market) : '',
    alreadyEntered: Boolean(options.alreadyEntered),
});

const isDigit = digit => Number.isInteger(digit) && digit >= 0 && digit <= 9;

/** Newest ticks first, stopping at the first quote that is not a digit. */
const trailingDigits = raw => {
    const digits = [];
    for (let index = raw.length - 1; index >= 0; index -= 1) {
        if (!isDigit(raw[index])) break;
        digits.push(raw[index]);
    }
    return digits.reverse();
};

const share = (count, total) => (total > 0 ? (count / total) * 100 : 0);

const gapShare = digits => {
    if (!digits.length) return null;
    const gaps = digits.filter(digit => digit === 4 || digit === 5).length;
    return roundPct(share(gaps, digits.length));
};

/**
 * How often the latest 3 digits were followed by each digit earlier in the window.
 * The latest 3 have no follower yet, so they are the pattern being tested.
 */
const followerCounts = (sample, length) => {
    const counts = Array(10).fill(0);
    if (sample.length <= length) return { sequence: [], counts, total: 0 };
    const sequence = sample.slice(-length);
    const key = sequence.join(',');
    for (let index = 0; index + length < sample.length; index += 1) {
        if (sample.slice(index, index + length).join(',') !== key) continue;
        const next = sample[index + length];
        if (next >= 0 && next <= 9) counts[next] += 1;
    }
    return { sequence, counts, total: counts.reduce((sum, count) => sum + count, 0) };
};

const patternResult = (sample, threshold) => {
    const { sequence, counts, total } = followerCounts(sample, PATTERN_LENGTH);
    const four = counts[4];
    const five = counts[5];
    const bestOther = counts.reduce(
        (best, count, digit) => (digit === 4 || digit === 5 ? best : Math.max(best, count)),
        0
    );
    const gapCount = four + five;
    const otherCount = total - gapCount;
    // A tie still leaves 4 or 5 as a most-likely next digit. Split 4s and 5s
    // are one threat: both digits lose the hedge.
    const both = four >= threshold && five >= threshold && four === five && four >= bestOther;
    const strong4 = four >= threshold && four > five && four >= bestOther;
    const strong5 = five >= threshold && five > four && five >= bestOther;
    const gapMajority = gapCount >= threshold && gapCount > otherCount;
    if (both || (!strong4 && !strong5 && gapMajority)) {
        return {
            pass: false,
            digit: null,
            sequence,
            four,
            five,
            line: 'PATTERN WARNING: Repeated sequence indicates elevated probability of digit 4 or 5 - NO TRADE',
        };
    }
    if (strong4) {
        return {
            pass: false,
            digit: 4,
            sequence,
            four,
            five,
            line: 'PATTERN WARNING: Repeated sequence indicates elevated probability of digit 4 - NO TRADE',
        };
    }
    if (strong5) {
        return {
            pass: false,
            digit: 5,
            sequence,
            four,
            five,
            line: 'PATTERN WARNING: Repeated sequence indicates elevated probability of digit 5 - NO TRADE',
        };
    }
    return {
        pass: true,
        digit: null,
        sequence,
        four,
        five,
        line: 'PATTERN CHECK: No strong 4/5 pattern detected - PASS',
    };
};

const mark = ok => (ok ? 'PASS' : 'FAIL');

/**
 * @param {number[]} digits oldest → newest completed last digits
 * @returns the decision and the journal lines for this cycle
 */
export const evaluateDigitHedgeFilter = (digits, options = {}) => {
    const settings = normalizeDigitHedgeFilter(options);
    const raw = (Array.isArray(digits) ? digits : []).map(digit => Number(digit));
    const sample = raw.slice(-settings.window);
    const windowComplete = raw.length >= settings.window && sample.length === settings.window && sample.every(isDigit);
    const counts = Array(10).fill(0);
    sample.forEach(digit => {
        if (isDigit(digit)) counts[digit] += 1;
    });
    const total = windowComplete ? sample.length : counts.reduce((sum, count) => sum + count, 0);
    const digitPct = counts.map(count => roundPct(share(count, total)));
    const low = roundPct(share(counts[0] + counts[1] + counts[2] + counts[3], total));
    const gap = roundPct(share(counts[4] + counts[5], total));
    const high = roundPct(share(counts[6] + counts[7] + counts[8] + counts[9], total));

    const latest = raw.slice(-settings.recent);
    const previous = raw.slice(-2 * settings.recent, -settings.recent);
    const recentReady =
        latest.length === settings.recent &&
        previous.length === settings.recent &&
        latest.every(isDigit) &&
        previous.every(isDigit);
    const recentGap = recentReady ? gapShare(latest) : null;
    const previousGap = recentReady ? gapShare(previous) : null;
    const recentGaps = recentReady ? latest.filter(digit => digit === 4 || digit === 5).length : null;
    const previousGaps = recentReady ? previous.filter(digit => digit === 4 || digit === 5).length : null;
    let trend = 'INCOMPLETE';
    if (recentReady) {
        if (recentGaps > previousGaps) trend = 'INCREASING';
        else if (recentGaps < previousGaps) trend = 'DECREASING';
        else trend = 'STABLE';
    }
    const gapIncreasing = trend === 'INCREASING';
    const gapPass = recentReady && !gapIncreasing;
    const gapLine = gapIncreasing
        ? 'RECENT GAP TREND: INCREASING - NO TRADE'
        : gapPass
          ? 'RECENT GAP TREND: DECREASING/STABLE - PASS'
          : 'RECENT GAP TREND: NOT ENOUGH TICKS - NO TRADE';

    const pattern = patternResult(trailingDigits(raw), settings.patternThreshold);
    const patternLine = windowComplete
        ? pattern.line
        : 'PATTERN CHECK: waiting for the full analysis window - NO TRADE';
    const gapOk = windowComplete && gap <= settings.maxGap;
    const lowOk = windowComplete && low >= settings.minLow;
    const highOk = windowComplete && high >= settings.minHigh;
    const digit4Ok = windowComplete && digitPct[4] <= settings.maxDigit4;
    const digit5Ok = windowComplete && digitPct[5] <= settings.maxDigit5;
    const patternOk = windowComplete && pattern.pass;
    const sameTickOk = !settings.alreadyEntered;
    const trade =
        windowComplete && sameTickOk && gapOk && lowOk && highOk && digit4Ok && digit5Ok && gapPass && patternOk;

    const lines = [
        '--------------------------------',
        'HEDGE ANALYSIS',
        '--------------------------------',
        'Market:',
        settings.market || '—',
        'Analysis Window:',
        `${settings.window} ticks`,
        'Completed ticks:',
        `${windowComplete ? settings.window : total} / ${settings.window}`,
        'Window complete:',
        mark(windowComplete),
        'Digit frequencies:',
        ...digitPct.map((pct, digit) => `${digit} = ${counts[digit]} (${formatFilterPct(pct)})`),
        'LOW GROUP (0–3):',
        formatFilterPct(low),
        'GAP GROUP (4–5):',
        formatFilterPct(gap),
        'HIGH GROUP (6–9):',
        formatFilterPct(high),
        '--------------------------------',
        'ENTRY FILTERS',
        '--------------------------------',
        `4 + 5 <= ${formatFilterPct(settings.maxGap)}:`,
        mark(gapOk),
        `0–3 >= ${formatFilterPct(settings.minLow)}:`,
        mark(lowOk),
        `6–9 >= ${formatFilterPct(settings.minHigh)}:`,
        mark(highOk),
        `4 <= ${formatFilterPct(settings.maxDigit4)}:`,
        mark(digit4Ok),
        `5 <= ${formatFilterPct(settings.maxDigit5)}:`,
        mark(digit5Ok),
        `Previous ${settings.recent}-tick gap:`,
        previousGap == null ? '—' : formatFilterPct(previousGap),
        `Recent ${settings.recent}-tick gap:`,
        recentGap == null ? '—' : formatFilterPct(recentGap),
        'Gap trend:',
        trend === 'INCOMPLETE' ? 'NOT ENOUGH TICKS' : trend,
        gapLine,
        'Recent gap filter:',
        mark(gapPass),
        'Pattern analysis:',
        mark(patternOk),
        pattern.sequence.length
            ? `Sequence ${pattern.sequence.join('-')} followed by 4 x ${pattern.four}, 5 x ${pattern.five}`
            : 'Sequence: not enough ticks',
        patternLine,
        'Same tick:',
        mark(sameTickOk),
        '--------------------------------',
        'FINAL DECISION',
        '--------------------------------',
    ];
    if (settings.alreadyEntered) {
        lines.push('NO TRADE - this tick already has a hedge');
    }
    lines.push(
        trade
            ? 'ALL CONDITIONS PASSED - EXECUTING OVER 5 + UNDER 4 HEDGE'
            : 'NO TRADE - ENTRY CONDITIONS NOT FULLY SATISFIED'
    );

    return {
        trade,
        lines,
        trend,
        windowComplete,
        patternDigit: pattern.digit,
        patternPass: pattern.pass,
        counts,
        percentages: {
            digits: digitPct,
            low,
            gap,
            high,
            recentGap,
            previousGap,
        },
    };
};
