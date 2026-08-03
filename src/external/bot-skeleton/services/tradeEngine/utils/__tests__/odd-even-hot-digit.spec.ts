import {
    computeDigitCounts,
    detectHotOddEvenDiffersSignal,
    evaluateSymbolHotOddEvenDiffers,
    pickBestHotOddEvenDiffersMatch,
    pickHottestAmong,
    pickColdestAmong,
    pickColdestDigit,
    makeHotOddEvenDiffersSignalKey,
    isHotOddEvenDiffersSignalConsumed,
    armHotOddEvenDiffersPrediction,
    clearHotOddEvenDiffersCommit,
    createHotOddEvenDiffersRuntimeState,
    releaseStaleHotOddEvenDiffersCommit,
    ODD_DIGITS,
    EVEN_DIGITS,
} from '../odd-even-hot-digit';

const buildWindow = () => {
    // 100 ticks: odd hot=1 (20), even hot=0 (18), cold=9 (2), tip ends with 1
    const digits = [];
    for (let i = 0; i < 20; i++) digits.push(1);
    for (let i = 0; i < 18; i++) digits.push(0);
    for (let i = 0; i < 12; i++) digits.push(2);
    for (let i = 0; i < 12; i++) digits.push(3);
    for (let i = 0; i < 10; i++) digits.push(4);
    for (let i = 0; i < 10; i++) digits.push(5);
    for (let i = 0; i < 8; i++) digits.push(6);
    for (let i = 0; i < 6; i++) digits.push(7);
    for (let i = 0; i < 2; i++) digits.push(8);
    for (let i = 0; i < 2; i++) digits.push(9);
    // ensure length 100 and tip is hot odd 1
    while (digits.length < 99) digits.push(2);
    digits.push(1);
    return digits.slice(-100);
};

describe('pickHottestAmong / pickColdestAmong', () => {
    it('picks hottest and coldest within odd/even groups', () => {
        const counts = [5, 9, 4, 3, 2, 1, 1, 1, 1, 0];
        expect(pickHottestAmong(counts, ODD_DIGITS).digit).toBe(1);
        expect(pickHottestAmong(counts, EVEN_DIGITS).digit).toBe(0);
        expect(pickColdestDigit(counts).digit).toBe(9);
        expect(pickColdestAmong(counts, ODD_DIGITS).digit).toBe(9);
        expect(pickColdestAmong(counts, EVEN_DIGITS).digit).toBe(6); // 6 and 8 both count 1 → lowest
        expect(pickColdestAmong(counts, ODD_DIGITS, 9).digit).toBe(5);
    });
});

describe('detectHotOddEvenDiffersSignal', () => {
    it('Differs coldest odd when tip is hottest odd', () => {
        const digits = buildWindow();
        const result = detectHotOddEvenDiffersSignal(digits, 100);
        expect(result.matched).toBe(true);
        expect(result.last_digit).toBe(1);
        expect(result.hot_odd).toBe(1);
        expect(result.trigger).toBe('odd');
        expect(result.barrier).toBe(result.cold_digit);
        expect(ODD_DIGITS).toContain(result.barrier);
        expect(result.barrier).not.toBe(1);
    });

    it('Differs coldest even when tip is hottest even', () => {
        const digits = buildWindow();
        digits[digits.length - 1] = 0;
        const result = detectHotOddEvenDiffersSignal(digits, 100);
        expect(result.matched).toBe(true);
        expect(result.last_digit).toBe(0);
        expect(result.trigger).toBe('even');
        expect(EVEN_DIGITS).toContain(result.barrier);
        expect(result.barrier).not.toBe(0);
    });

    it('rejects when tip is not hot odd or hot even', () => {
        const digits = buildWindow();
        digits[digits.length - 1] = 7; // not the hottest odd/even
        const result = detectHotOddEvenDiffersSignal(digits, 100);
        expect(result.matched).toBe(false);
    });

    it('requires full lookback', () => {
        const result = detectHotOddEvenDiffersSignal([1, 2, 3], 100);
        expect(result.matched).toBe(false);
        expect(result.reason).toContain('insufficient_history');
    });
});

describe('pickBest / consume key', () => {
    it('picks highest score and locks one purchase per tip', () => {
        const a = evaluateSymbolHotOddEvenDiffers('1HZ10V', buildWindow(), { lookback: 100 });
        const b = evaluateSymbolHotOddEvenDiffers('1HZ75V', buildWindow().map((d, i, arr) =>
            i === arr.length - 1 ? 0 : d
        ), { lookback: 100 });
        // b tip=0 may match hot even
        const best = pickBestHotOddEvenDiffersMatch([a, b]);
        expect(best).toBeTruthy();
        const key = makeHotOddEvenDiffersSignalKey(best, 100);
        expect(isHotOddEvenDiffersSignalConsumed(best, 100, key)).toBe(true);
        expect(isHotOddEvenDiffersSignalConsumed(best, 101, key)).toBe(false);
    });
});

describe('runtime commit', () => {
    it('arms and releases stale commits', () => {
        const state = createHotOddEvenDiffersRuntimeState();
        armHotOddEvenDiffersPrediction(state, 9);
        expect(state.trade_committed).toBe(true);
        expect(releaseStaleHotOddEvenDiffersCommit(state, 20000)).toBe(false);
        state.signal_issued_at = Date.now() - 25000;
        expect(releaseStaleHotOddEvenDiffersCommit(state, 20000)).toBe(true);
        expect(state.trade_committed).toBe(false);
        clearHotOddEvenDiffersCommit(state);
    });
});
