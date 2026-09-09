const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);

const toDigit = value => {
    const digit = Number(value);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

const normalizeTicks = ticks => (Array.isArray(ticks) ? ticks : []).flatMap((item, index) => {
    const digit = toDigit(item && typeof item === 'object' ? item.digit ?? item.quote : item);
    if (digit === null) return [];
    const raw_epoch = item && typeof item === 'object' ? Number(item.epoch) : NaN;
    return [{ digit, epoch: Number.isFinite(raw_epoch) ? raw_epoch : index }];
});

const createRelationship = (trigger, target, index, epoch) => ({
    trigger,
    target,
    first_occurrence_index: index,
    first_occurrence_epoch: epoch,
    last_occurrence_epoch: epoch,
    total_occurrences: 1,
    successes: 0,
    failures: 0,
    secondary_counts: {},
});

const reliability = relationship => {
    const observations = relationship.successes + relationship.failures;
    return observations ? relationship.successes / observations : 0;
};

const strength = successes => successes >= 4 ? 'VERY STRONG' : successes === 3 ? 'STRONG' : successes === 2 ? 'CONFIRMED' : 'CANDIDATE';

const scoreRelationship = (relationship, current_index) => {
    const age = Math.max(0, current_index - relationship.last_occurrence_index);
    const recency = Math.max(0, 1 - age / 2000);
    return reliability(relationship) * 1000 + relationship.successes * 10 + recency + relationship.total_occurrences / 10000;
};

const relationshipSummary = (relationship, current_index, minimum_confirmations, minimum_reliability) => {
    const relationship_reliability = reliability(relationship);
    const observations = relationship.successes + relationship.failures;
    const eligible = relationship.successes >= minimum_confirmations && relationship_reliability * 100 >= minimum_reliability;
    return {
        ...relationship,
        reliability: relationship_reliability,
        reliability_percent: relationship_reliability * 100,
        observations,
        ticks_since_last_occurrence: Math.max(0, current_index - relationship.last_occurrence_index),
        status: strength(relationship.successes),
        eligible,
        secondary_percentages: Object.fromEntries(
            Object.entries(relationship.secondary_counts).map(([digit, count]) => [digit, observations ? (count / relationship.total_occurrences) * 100 : 0])
        ),
    };
};

export const createDoubleRepeatRelationshipState = () => ({
    last_signal_key: '',
    last_window_key: '',
});

export const evaluateDoubleRepeatRelationshipScanner = (
    raw_ticks,
    options = {},
    state = createDoubleRepeatRelationshipState()
) => {
    const ticks = normalizeTicks(raw_ticks).slice(-Math.max(120, Math.floor(Number(options.tick_window)) || 120));
    const minimum_confirmations = Math.max(1, Math.floor(Number(options.minimum_confirmations)) || 2);
    const minimum_reliability = Math.min(100, Math.max(0, Number(options.minimum_reliability) || 70));
    const signal_mode = ['ALL', 'STRONGEST', 'TOP_3'].includes(options.signal_mode) ? options.signal_mode : 'STRONGEST';
    const secondary_analysis = options.secondary_analysis === true;
    const relationships = Array.from({ length: 10 }, () => new Map());
    const patterns = [];

    for (let index = 2; index < ticks.length; index += 1) {
        const trigger = ticks[index - 2].digit;
        if (trigger !== ticks[index - 1].digit) continue;
        const target = ticks[index].digit;
        const secondary_digit = ticks[index + 1]?.digit;
        const key = `${trigger}->${target}`;
        const existing = relationships[trigger];
        existing.forEach(relationship => {
            if (relationship.target !== target) relationship.failures += 1;
        });
        const relationship = existing.get(target);
        if (!relationship) {
            const candidate = createRelationship(trigger, target, index, ticks[index].epoch);
            candidate.last_occurrence_index = index;
            if (secondary_analysis && secondary_digit !== undefined) candidate.secondary_counts[secondary_digit] = 1;
            existing.set(target, candidate);
        } else {
            relationship.total_occurrences += 1;
            relationship.successes += 1;
            relationship.last_occurrence_epoch = ticks[index].epoch;
            relationship.last_occurrence_index = index;
            if (secondary_analysis && secondary_digit !== undefined) {
                relationship.secondary_counts[secondary_digit] = (relationship.secondary_counts[secondary_digit] || 0) + 1;
            }
        }
        patterns.push({ key, trigger, target, index, epoch: ticks[index].epoch });
    }

    const current_index = ticks.length - 1;
    const summaries = DIGITS.flatMap(trigger => Array.from(relationships[trigger].values()).map(relationship =>
        relationshipSummary(relationship, current_index, minimum_confirmations, minimum_reliability)
    ));
    const eligible = summaries
        .filter(item => item.eligible)
        .map(item => ({ ...item, score: scoreRelationship(item, current_index) }))
        .sort((left, right) => right.score - left.score);
    const latest_pattern = patterns[patterns.length - 1];
    const signal_key = latest_pattern ? `${latest_pattern.epoch}:${latest_pattern.trigger}->${latest_pattern.target}` : '';
    const latest_relationship = latest_pattern ? summaries.find(item => item.trigger === latest_pattern.trigger && item.target === latest_pattern.target) : null;
    const latest_eligible = latest_relationship && eligible.find(item => item.trigger === latest_relationship.trigger && item.target === latest_relationship.target);
    const selected = latest_eligible && signal_key !== state.last_signal_key
        ? signal_mode === 'TOP_3' ? eligible.slice(0, 3) : signal_mode === 'ALL' ? eligible : [latest_eligible]
        : [];
    const selected_relationship = selected.find(item => item.trigger === latest_pattern?.trigger && item.target === latest_pattern?.target) || selected[0];
    state.last_signal_key = selected_relationship ? signal_key : state.last_signal_key;
    state.last_window_key = ticks.length ? `${ticks[0].epoch}:${ticks[ticks.length - 1].epoch}` : '';

    return {
        prediction: selected_relationship ? selected_relationship.target : -1,
        allowed: Boolean(selected_relationship),
        signal: selected_relationship || null,
        tick_window: ticks.length,
        current_digit: ticks.length ? ticks[ticks.length - 1].digit : -1,
        relationships: summaries,
        ranked_relationships: eligible,
        dashboard: summaries.map(item => ({
            trigger: item.trigger,
            target: item.target,
            successes: item.successes,
            failures: item.failures,
            reliability_percent: item.reliability_percent,
            status: item.status,
        })),
        journal_messages: selected_relationship ? [{
            className: 'journal__text--success',
            message: `NEW DIFFER SIGNAL: ${selected_relationship.trigger} → ${selected_relationship.trigger} → ${selected_relationship.target}; DIFFER ${selected_relationship.target}; ${selected_relationship.reliability_percent.toFixed(2)}% reliability; ${selected_relationship.status}.`,
        }] : [],
    };
};
