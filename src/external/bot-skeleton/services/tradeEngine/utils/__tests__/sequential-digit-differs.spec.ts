import {
    armSequentialDiffersPrediction,
    applySequentialDiffersTradeResult,
    buildSequentialScanResult,
    consumeImmediateLossRetry,
    createSequentialDiffersRuntimeState,
    detectSequentialDigitSignal,
    evaluateSymbolSequentialSignal,
    isSignalAlreadyConsumed,
    makeSignalKey,
    orderSymbolsForScan,
    parseSymbolList,
    pickFirstMatch,
    resolveScanSymbols,
    toMarketGroup,
    VOLATILITY_1S_SYMBOLS,
    VOLATILITY_STANDARD_SYMBOLS,
} from '../sequential-digit-differs';

describe('detectSequentialDigitSignal', () => {
    it('detects ascending 1→2→3 → Differ 4', () => {
        const result = detectSequentialDigitSignal([1, 2, 3]);
        expect(result.matched).toBe(true);
        expect(result.direction).toBe('asc');
        expect(result.barrier).toBe(4);
        expect(result.previous_digit_2).toBe(1);
        expect(result.previous_digit_1).toBe(2);
        expect(result.current_digit).toBe(3);
    });

    it('detects descending 8→7→6 → Differ 5', () => {
        const result = detectSequentialDigitSignal([8, 7, 6]);
        expect(result.matched).toBe(true);
        expect(result.direction).toBe('desc');
        expect(result.barrier).toBe(5);
        expect(result.sequence).toEqual([8, 7, 6]);
    });

    it('uses only the newest three digits', () => {
        expect(detectSequentialDigitSignal([9, 9, 1, 2, 3]).barrier).toBe(4);
        expect(detectSequentialDigitSignal([0, 8, 7, 6]).barrier).toBe(5);
    });

    it('rejects non-consecutive and out-of-range barriers', () => {
        expect(detectSequentialDigitSignal([1, 2, 4]).matched).toBe(false);
        expect(detectSequentialDigitSignal([7, 8, 9]).matched).toBe(false);
        expect(detectSequentialDigitSignal([7, 8, 9]).reason).toBe('asc_barrier_out_of_range');
        expect(detectSequentialDigitSignal([2, 1, 0]).matched).toBe(false);
        expect(detectSequentialDigitSignal([2, 1, 0]).reason).toBe('desc_barrier_out_of_range');
        expect(detectSequentialDigitSignal([1, 2]).reason).toBe('insufficient_digits');
    });
});

describe('resolveScanSymbols / orderSymbolsForScan', () => {
    it('resolves 1s, standard, and all groups', () => {
        expect(resolveScanSymbols({ market_group: '1S' })).toEqual(VOLATILITY_1S_SYMBOLS);
        expect(resolveScanSymbols({ market_group: 'STANDARD' })).toEqual(VOLATILITY_STANDARD_SYMBOLS);
        expect(resolveScanSymbols({ market_group: 'ALL' })).toEqual([
            ...VOLATILITY_1S_SYMBOLS,
            ...VOLATILITY_STANDARD_SYMBOLS,
        ]);
    });

    it('honours explicit symbol lists', () => {
        expect(resolveScanSymbols({ symbols: '1HZ75V, R_50' })).toEqual(['1HZ75V', 'R_50']);
        expect(parseSymbolList(['1HZ10V', '1HZ10V', ''])).toEqual(['1HZ10V']);
        expect(toMarketGroup('standard volatility')).toBe('STANDARD');
    });

    it('scans the active symbol first', () => {
        expect(orderSymbolsForScan(['1HZ10V', '1HZ75V', '1HZ100V'], '1HZ75V')).toEqual([
            '1HZ75V',
            '1HZ10V',
            '1HZ100V',
        ]);
    });
});

describe('makeSignalKey / isSignalAlreadyConsumed', () => {
    it('locks one purchase per tip until the tip advances', () => {
        const match = evaluateSymbolSequentialSignal('1HZ50V', [4, 5, 6]);
        const key = makeSignalKey(match, 1700000001);
        expect(key).toContain('1HZ50V|4,5,6→7');
        expect(isSignalAlreadyConsumed(match, 1700000001, key)).toBe(true);
        expect(isSignalAlreadyConsumed(match, 1700000002, key)).toBe(false);
        expect(
            buildSequentialScanResult({
                match,
                skipped_consumed: true,
                journal_enabled: true,
            }).prediction
        ).toBe(-1);
        expect(
            buildSequentialScanResult({
                match,
                skipped_consumed: true,
                journal_enabled: true,
            }).reason
        ).toBe('signal_consumed');
    });
});

describe('immediate loss retry', () => {
    it('queues the same losing digit once, then returns to analysis', () => {
        const state = createSequentialDiffersRuntimeState();
        armSequentialDiffersPrediction(state, 7);
        applySequentialDiffersTradeResult(state, {
            is_loss: true,
            immediate_loss_retry: true,
            contract_id: 'c1',
        });
        expect(state.pending_retry_digit).toBe(7);

        expect(consumeImmediateLossRetry(state)).toBe(7);
        expect(state.pending_retry_digit).toBeNull();
        expect(state.just_did_immediate_retry).toBe(true);
        expect(state.armed_prediction).toBe(7);

        // Losing the immediate retry must NOT queue another no-analysis trade.
        applySequentialDiffersTradeResult(state, {
            is_loss: true,
            immediate_loss_retry: true,
            contract_id: 'c2',
        });
        expect(state.pending_retry_digit).toBeNull();
        expect(consumeImmediateLossRetry(state)).toBeNull();
    });

    it('can be disabled', () => {
        const state = createSequentialDiffersRuntimeState();
        armSequentialDiffersPrediction(state, 4);
        applySequentialDiffersTradeResult(state, {
            is_loss: true,
            immediate_loss_retry: false,
            contract_id: 'c3',
        });
        expect(state.pending_retry_digit).toBeNull();
    });
});

describe('pickFirstMatch / buildSequentialScanResult', () => {
    it('picks the first matching evaluation', () => {
        const evaluations = [
            evaluateSymbolSequentialSignal('1HZ10V', [1, 3, 5]),
            evaluateSymbolSequentialSignal('1HZ75V', [1, 2, 3]),
            evaluateSymbolSequentialSignal('1HZ100V', [8, 7, 6]),
        ];
        const match = pickFirstMatch(evaluations);
        expect(match.symbol).toBe('1HZ75V');
        expect(match.barrier).toBe(4);

        const result = buildSequentialScanResult({
            market_group: '1S',
            evaluations,
            match,
            journal_enabled: true,
        });
        expect(result.prediction).toBe(4);
        expect(result.matched).toBe(true);
        expect(result.journal_messages[0].className).toBe('success');
    });

    it('reports no match cleanly', () => {
        const evaluations = [evaluateSymbolSequentialSignal('R_75', [4, 4, 4])];
        const result = buildSequentialScanResult({
            market_group: 'STANDARD',
            evaluations,
            match: pickFirstMatch(evaluations),
            journal_enabled: true,
        });
        expect(result.prediction).toBe(-1);
        expect(result.matched).toBe(false);
        expect(result.reason).toBe('no_match');
    });
});
