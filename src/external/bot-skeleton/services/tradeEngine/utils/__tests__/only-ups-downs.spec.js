import {
    evaluateOnlyUpsDowns,
    formatOnlyUpsDownsStake,
    nextOnlyUpsDownsStake,
    onlyUpsDownsAnalysisLines,
    onlyUpsDownsResultLines,
    onlyUpsDownsLimitCode,
    ONLY_DOWNS,
    ONLY_NONE,
    ONLY_UPS,
    resolveOnlyUpsDownsCall,
} from '../only-ups-downs';

describe('Only Ups / Only Downs four digits', () => {
    it('buys Only Ups when all four digits are below 5', () => {
        expect(evaluateOnlyUpsDowns([1, 2, 3, 4])).toMatchObject({
            trade: ONLY_UPS,
            condition: 'ALL BELOW 5',
            signal: 'ONLY UPS',
            action: 'TRADE',
            digits: [1, 2, 3, 4],
        });
        expect(evaluateOnlyUpsDowns([0, 1, 4, 2]).trade).toBe(ONLY_UPS);
        expect(evaluateOnlyUpsDowns([4, 3, 1, 0]).trade).toBe(ONLY_UPS);
        expect(evaluateOnlyUpsDowns([4, 4, 4, 4]).trade).toBe(ONLY_UPS);
        expect(evaluateOnlyUpsDowns([2, 4, 1, 3]).trade).toBe(ONLY_UPS);
        expect(evaluateOnlyUpsDowns([9, 0, 1, 2, 3]).digits).toEqual([0, 1, 2, 3]);
    });

    it('buys Only Downs when all four digits are above 4', () => {
        expect(evaluateOnlyUpsDowns([5, 6, 7, 8])).toMatchObject({
            trade: ONLY_DOWNS,
            condition: 'ALL ABOVE 4',
            signal: 'ONLY DOWNS',
            action: 'TRADE',
        });
        expect(evaluateOnlyUpsDowns([9, 5, 6, 8]).trade).toBe(ONLY_DOWNS);
        expect(evaluateOnlyUpsDowns([7, 9, 5, 6]).trade).toBe(ONLY_DOWNS);
        expect(evaluateOnlyUpsDowns([5, 5, 5, 5]).trade).toBe(ONLY_DOWNS);
    });

    it('does not trade when the four digits are mixed or incomplete', () => {
        expect(evaluateOnlyUpsDowns([1, 5, 2, 3])).toMatchObject({
            trade: ONLY_NONE,
            condition: 'MIXED',
            signal: 'NONE',
            action: 'NO TRADE',
        });
        expect(evaluateOnlyUpsDowns([4, 7, 2, 8]).trade).toBe(ONLY_NONE);
        expect(evaluateOnlyUpsDowns([9, 3, 6, 1]).trade).toBe(ONLY_NONE);
        expect(evaluateOnlyUpsDowns([1, 2, 3])).toMatchObject({ trade: ONLY_NONE, condition: 'WAITING', ready: false });
        expect(evaluateOnlyUpsDowns([1, 2, 3, Number.NaN]).trade).toBe(ONLY_NONE);
    });

    it('journals the analysis and does not trade the same tick twice', () => {
        const first = resolveOnlyUpsDownsCall({
            digits: [2, 7, 4, 8],
            epoch: '100',
            seenEpoch: '',
            tradedEpoch: '',
            stake: 1,
            level: 0,
        });
        expect(first.code).toBe(ONLY_NONE);
        expect(first.lines).toEqual([
            '[ANALYSIS]',
            'Latest 4 digits: 2,7,4,8',
            'Condition: MIXED',
            'Signal: NONE',
            'Action: NO TRADE',
        ]);
        expect(onlyUpsDownsAnalysisLines(evaluateOnlyUpsDowns([1, 2, 3, 4]))).toEqual([
            '[ANALYSIS]',
            'Latest 4 digits: 1,2,3,4',
            'Condition: ALL BELOW 5',
            'Signal: ONLY UPS',
            'Action: TRADE',
        ]);
        const trade = resolveOnlyUpsDownsCall({
            digits: [1, 2, 3, 4],
            epoch: '101',
            seenEpoch: first.seenEpoch,
            tradedEpoch: first.tradedEpoch,
            stake: 1,
            level: 0,
        });
        expect(trade.code).toBe(ONLY_UPS);
        expect(trade.lines.slice(0, 5)).toEqual(onlyUpsDownsAnalysisLines(evaluateOnlyUpsDowns([1, 2, 3, 4])));
        expect(trade.lines.slice(5)).toEqual(['[TRADE]', 'Direction: ONLY UPS', 'Stake: $1.00', 'Martingale level: 0']);
        const again = resolveOnlyUpsDownsCall({
            digits: [1, 2, 3, 4],
            epoch: '101',
            seenEpoch: trade.seenEpoch,
            tradedEpoch: trade.tradedEpoch,
            stake: 1,
            level: 0,
        });
        expect(again.code).toBe(ONLY_NONE);
        expect(again.lines).toEqual([]);
        const shifted = resolveOnlyUpsDownsCall({
            digits: [7, 8, 5, 9],
            epoch: '102',
            seenEpoch: trade.seenEpoch,
            tradedEpoch: trade.tradedEpoch,
            stake: 1.5,
            level: 1,
        });
        expect(shifted.code).toBe(ONLY_DOWNS);
        expect(shifted.lines).toContain('Direction: ONLY DOWNS');
        expect(shifted.lines).toContain('Stake: $1.50');
        expect(shifted.lines).toContain('Martingale level: 1');
    });

    it('multiplies a loss by 1.5 and resets a win to the base stake', () => {
        expect(formatOnlyUpsDownsStake(1)).toBe('$1.00');
        expect(formatOnlyUpsDownsStake(1.5)).toBe('$1.50');
        expect(formatOnlyUpsDownsStake(2.25)).toBe('$2.25');
        expect(formatOnlyUpsDownsStake(3.375)).toBe('$3.375');
        let stake = 1;
        stake = nextOnlyUpsDownsStake({ won: false, current: stake, base: 1 });
        expect(stake).toBe(1.5);
        stake = nextOnlyUpsDownsStake({ won: false, current: stake, base: 1 });
        expect(stake).toBe(2.25);
        stake = nextOnlyUpsDownsStake({ won: false, current: stake, base: 1 });
        expect(stake).toBe(3.375);
        expect(onlyUpsDownsResultLines({ won: false, previous: 2.25, next: stake })).toEqual([
            '[RESULT]',
            'Result: LOSS',
            'Previous stake: $2.25',
            'Next stake: $3.375',
            'Martingale multiplier: 1.5',
        ]);
        expect(nextOnlyUpsDownsStake({ won: true, current: stake, base: 1 })).toBe(1);
        expect(onlyUpsDownsResultLines({ won: true, previous: 3.375, next: 1 })[1]).toBe('Result: WIN');
    });

    it('stops at take profit before a loss streak, and stops after 5 losses', () => {
        expect(onlyUpsDownsLimitCode({ total: 10, takeProfit: 10, losses: 0, maxLosses: 5 })).toBe(1);
        expect(onlyUpsDownsLimitCode({ total: '12.5', takeProfit: '10', losses: 5, maxLosses: 5 })).toBe(1);
        expect(onlyUpsDownsLimitCode({ total: 9.99, takeProfit: 10, losses: 4, maxLosses: 5 })).toBe(0);
        expect(onlyUpsDownsLimitCode({ total: 9.99, takeProfit: 10, losses: 5, maxLosses: 5 })).toBe(-1);
        expect(onlyUpsDownsLimitCode({ total: 0, takeProfit: 10, losses: 0, maxLosses: 5 })).toBe(0);
        expect(onlyUpsDownsLimitCode({ total: 0, takeProfit: 0, losses: 5, maxLosses: 0 })).toBe(-1);
        expect(onlyUpsDownsLimitCode({ total: 3, takeProfit: 10, losses: 5, maxLosses: 'nope' })).toBe(-1);
    });
});
