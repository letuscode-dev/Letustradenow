import { leastDigitDecreaseStrategy as strategy } from '../least-digit-decrease';

const feed = (detector, market, digits) => digits.map((digit, index) => strategy.evaluate(detector, digit, null, market, index));
const initial = () => [...Array(81).fill(0), ...Array(80).fill(1), ...Array.from({ length: 7 }, (_, i) => Array(105).fill(i + 2)).flat(), ...Array(104).fill(9)];

it('buys only when a digit decreases to the lowest count, including a tie', () => {
    const detector = strategy.createDetector();
    expect(initial()).toHaveLength(1000);
    expect(feed(detector, 'A', initial()).every(result => result === null)).toBe(true);
    expect(strategy.evaluate(detector, 9, null, 'A', 1001)).toMatchObject({ barrier: 0,
        previousPercentage: 8.1, currentPercentage: 8, decrease: 0.1, windowSize: 1000, tiedDigits: [0, 1] });
    expect(strategy.evaluate(detector, 0, null, 'A', 1002)).toBeNull();
});

it('ignores decreases of digits that are not least frequent and keeps markets independent', () => {
    const detector = strategy.createDetector();
    const commonFirst = initial();
    [commonFirst[0], commonFirst[200]] = [commonFirst[200], commonFirst[0]];
    feed(detector, 'A', commonFirst);
    feed(detector, 'B', initial());
    expect(strategy.evaluate(detector, 9, null, 'A')).toBeNull();
    expect(strategy.evaluate(detector, 9, null, 'B')).toMatchObject({ barrier: 0, currentPercentage: 8 });
    strategy.reset(detector, 'B');
    expect(strategy.evaluate(detector, 9, null, 'B')).toBeNull();
});

it('matches independent rolling counts across many ticks and market switches', () => {
    const detector = strategy.createDetector();
    const samples = { A: [], B: [] };
    let seed = 12345;
    for (let index = 0; index < 7000; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const market = index % 2 ? 'A' : 'B';
        const digit = (seed >>> 16) % 10;
        const sample = samples[market];
        const prior = sample.length === 1000 ? sample[0] : null;
        const previousCount = prior === null ? 0 : sample.filter(value => value === prior).length;
        sample.push(digit);
        if (sample.length > 1000) sample.shift();
        const counts = Array.from({ length: 10 }, (_, target) => sample.filter(value => value === target).length);
        const expected = prior !== null && counts[prior] < previousCount && counts[prior] === Math.min(...counts) ? prior : null;
        const signal = strategy.evaluate(detector, digit, null, market, index);
        expect(signal?.barrier ?? null).toBe(expected);
    }
});

it('uses the existing 9.6% recovery and stops after the configured consecutive losses', () => {
    const risk = strategy.createRisk({ stake: 5, maxLosses: 2, profitThreshold: 10 });
    const round = value => Math.round(value * 100) / 100;
    strategy.applySettlement(risk, { result: 'lost', profit: -5 }, round);
    expect(risk.stake).toBe(52.08);
    strategy.applySettlement(risk, { result: 'lost', profit: -52.08 }, round);
    expect(risk.stopped).toBe(true);
    expect(risk.stopReason).toBe('Maximum consecutive losses reached');
});
