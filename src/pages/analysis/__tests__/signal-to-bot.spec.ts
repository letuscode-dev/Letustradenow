import {
    buildSignalBotFormData,
    getSignalBotTargets,
    getSignalContract,
    isActionableSignalDirection,
    shouldBlockSignalBotRun,
} from '../signal-to-bot';
import type { AnalysisIdea, AnalysisSnapshot } from '../analysis-types';

const makeIdea = (overrides: Partial<AnalysisIdea>): AnalysisIdea => ({
    confidence: 70,
    direction: 'rise',
    horizon: '5 ticks',
    id: 'idea',
    invalidation: 'Signal invalidated',
    price: 100,
    reasons: ['Reason'],
    title: 'Signal idea',
    ...overrides,
});

const makeSnapshot = (overrides: Partial<AnalysisSnapshot>): AnalysisSnapshot => ({
    digitStats: null,
    emaFast: null,
    emaSlow: null,
    ideas: [],
    lastPrice: 100,
    momentum: null,
    optionFamily: 'rise_fall',
    rangeRatio: null,
    rsi: null,
    trend: 'mixed',
    volatility: 'stable',
    ...overrides,
});

describe('signal-to-bot bridge', () => {
    it('maps an Over signal into an Over/Under bot with the detected barrier', () => {
        const idea = makeIdea({
            direction: 'over',
            prediction: 'Over 4',
        });

        expect(getSignalContract(idea)).toMatchObject({
            last_digit_prediction: '4',
            tradetype: 'overunder',
            type: 'DIGITOVER',
        });

        expect(
            buildSignalBotFormData({
                action: 'LOAD',
                idea,
                option_family: 'over_under',
                over_under_barrier: 4,
                symbol: 'R_100',
            })
        ).toMatchObject({
            duration: '1',
            durationtype: 't',
            last_digit_prediction: '4',
            symbol: 'R_100',
            tradetype: 'overunder',
            type: 'DIGITOVER',
        });
    });

    it('maps a Fall signal into a Rise/Fall bot', () => {
        expect(
            buildSignalBotFormData({
                action: 'RUN',
                idea: makeIdea({ direction: 'fall' }),
                option_family: 'rise_fall',
                over_under_barrier: 4,
                symbol: 'R_75',
            })
        ).toMatchObject({
            action: 'RUN',
            duration: '1',
            symbol: 'R_75',
            tradetype: 'callput',
            type: 'PUT',
        });
    });

    it('leaves watch-only ideas out of bot generation', () => {
        expect(isActionableSignalDirection('watch')).toBe(false);
        expect(
            buildSignalBotFormData({
                action: 'LOAD',
                idea: makeIdea({ direction: 'watch' }),
                option_family: 'rise_fall',
                over_under_barrier: 4,
                symbol: 'R_50',
            })
        ).toBeNull();
    });

    it('blocks live runs only when volatility guard is enabled during a spike', () => {
        const spike = makeSnapshot({ volatility: 'spike' });

        expect(shouldBlockSignalBotRun(spike, true)).toBe(true);
        expect(shouldBlockSignalBotRun(spike, false)).toBe(false);
        expect(shouldBlockSignalBotRun(makeSnapshot({ volatility: 'stable' }), true)).toBe(false);
    });

    it('always exposes both targets for paired option families', () => {
        const snapshot = makeSnapshot({
            digitStats: {
                barrierCount: 3,
                coldDigit: 2,
                counts: [5, 4, 1, 6, 3, 7, 5, 4, 8, 2],
                evenCount: 22,
                hotDigit: 8,
                lastDigit: 8,
                oddCount: 23,
                overCount: 26,
                sampleSize: 45,
                underCount: 16,
            },
            ideas: [makeIdea({ direction: 'differs', prediction: 'Differs 2' })],
        });

        expect(getSignalBotTargets(snapshot, 'matches_differs', 4).map(target => target.direction)).toEqual([
            'matches',
            'differs',
        ]);
        expect(getSignalBotTargets(snapshot, 'over_under', 4).map(target => target.prediction)).toEqual([
            'Over 4',
            'Under 4',
        ]);
        expect(getSignalBotTargets(snapshot, 'even_odd', 4).map(target => target.direction)).toEqual(['even', 'odd']);
        expect(getSignalBotTargets(snapshot, 'rise_fall', 4).map(target => target.direction)).toEqual(['rise', 'fall']);
    });
});
