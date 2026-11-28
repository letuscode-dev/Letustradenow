import { createFourDigitMirrorState, createFourDigitMarketScanner, parseMirrorMarkets, processFourDigitMirrorTick, resetFourDigitMirrorWindow } from '../four-digit-mirror';

it('validates and deduplicates selected Volatility markets', () => {
    expect(parseMirrorMarkets('1hz10v, 1HZ75V, 1HZ10V, R_10')).toEqual(['1HZ10V', '1HZ75V', 'R_10']);
    expect(parseMirrorMarkets(null)).toHaveLength(5);
    for (const invalid of ['', 'R_11', '1HZ10V,', '1HZ10V, BAD']) expect(() => parseMirrorMarkets(invalid)).toThrow();
    expect(() => parseMirrorMarkets(Array.from({ length: 11 }, (_, i) => `1HZ${i}V`).join(','))).toThrow('at most 10');
});

it('detects overlapping four-digit mirrors and exposes both candidate predictions', () => {
    const detector = createFourDigitMirrorState();
    expect([4, 7, 4].map(digit => processFourDigitMirrorTick(detector, digit))).toEqual([null, null, null]);
    expect(processFourDigitMirrorTick(detector, 7)).toMatchObject({ first: 4, second: 7, third: 4, fourth: 7 });
    expect(processFourDigitMirrorTick(detector, 4)).toMatchObject({ first: 7, second: 4, third: 7, fourth: 4 });
});

it('scans interleaved markets without mixing them or counting duplicate messages', () => {
    const scanner = createFourDigitMarketScanner();
    expect(scanner.tick('A', 1, 1)).toBeNull();
    expect(scanner.tick('B', 8, 1)).toBeNull();
    expect(scanner.tick('A', 2, 2)).toBeNull();
    expect(scanner.tick('A', 2, 2)).toBeNull();
    expect(scanner.tick('B', 9, 3)).toBeNull();
    expect(scanner.tick('A', 1, 3)).toBeNull();
    expect(scanner.tick('B', 8, 5)).toBeNull();
    expect(scanner.tick('A', 2, 4)).toMatchObject({ symbol: 'A', first: 1, second: 2 });
    expect(scanner.tick('B', 9, 7)).toMatchObject({ symbol: 'B', first: 8, second: 9 });
    scanner.reset('A');
    expect(scanner.tick('A', 1, 5)).toBeNull();
});

it('discards conflicting and out-of-order ticks instead of forming a false pattern', () => {
    const scanner = createFourDigitMarketScanner();
    scanner.tick('A', 1, 1);
    scanner.tick('A', 2, 2);
    scanner.tick('A', 9, 2);
    expect(scanner.tick('A', 1, 3)).toBeNull();
    expect(scanner.tick('A', 2, 4)).toBeNull();
    expect(scanner.tick('A', 1, 1)).toBeNull();
    expect(scanner.tick('A', 2, 5)).toBeNull();
});

it('keeps each market separate and clears a broken digit sequence', () => {
    const a = createFourDigitMirrorState();
    const b = createFourDigitMirrorState();
    [1, 2, 1].forEach(digit => processFourDigitMirrorTick(a, digit));
    [8, 9, 8].forEach(digit => processFourDigitMirrorTick(b, digit));
    expect(processFourDigitMirrorTick(a, 2)).toMatchObject({ first: 1, second: 2 });
    expect(processFourDigitMirrorTick(b, 9)).toMatchObject({ first: 8, second: 9 });
    expect(processFourDigitMirrorTick(a, NaN)).toBeNull();
    expect(processFourDigitMirrorTick(a, 2)).toBeNull();
    resetFourDigitMirrorWindow(b);
    expect(processFourDigitMirrorTick(b, 9)).toBeNull();
});
