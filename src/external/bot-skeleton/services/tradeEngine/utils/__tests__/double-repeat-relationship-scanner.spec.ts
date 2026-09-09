import {
    createDoubleRepeatRelationshipState,
    evaluateDoubleRepeatRelationshipScanner,
} from '../double-repeat-relationship-scanner';

describe('double repeat relationship scanner', () => {
    it('tracks success, failure, reliability, and eligibility', () => {
        const state = createDoubleRepeatRelationshipState();
        const result = evaluateDoubleRepeatRelationshipScanner(
            [2, 2, 7, 2, 2, 4, 2, 2, 7, 2, 2, 7, 2, 2, 7],
            { minimum_confirmations: 2, minimum_reliability: 70 },
            state
        );
        const relationship = result.relationships.find(item => item.trigger === 2 && item.target === 7);
        expect(relationship).toMatchObject({ successes: 3, failures: 1, total_occurrences: 4, eligible: true });
        expect(result.prediction).toBe(7);
    });

    it('keeps target relationships independent for all trigger digits', () => {
        const result = evaluateDoubleRepeatRelationshipScanner(
            [0, 0, 5, 1, 1, 8, 0, 0, 5, 1, 1, 8],
            { minimum_confirmations: 1, minimum_reliability: 50 }
        );
        expect(result.relationships.find(item => item.trigger === 0 && item.target === 5)?.successes).toBe(1);
        expect(result.relationships.find(item => item.trigger === 1 && item.target === 8)?.successes).toBe(1);
    });

    it('does not repeat the same signal event', () => {
        const state = createDoubleRepeatRelationshipState();
        const ticks = [2, 2, 7, 2, 2, 7];
        const first = evaluateDoubleRepeatRelationshipScanner(ticks, { minimum_confirmations: 1 }, state);
        const second = evaluateDoubleRepeatRelationshipScanner(ticks, { minimum_confirmations: 1 }, state);
        expect(first.prediction).toBe(7);
        expect(second.prediction).toBe(-1);
    });
});
