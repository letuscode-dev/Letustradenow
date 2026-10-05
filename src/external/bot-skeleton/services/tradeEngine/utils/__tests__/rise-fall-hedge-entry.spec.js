import { dayKey } from '../rise-fall-hedge';
import {
    analyzeHedgeEntry,
    decideHedgeEntry,
    ENTRY_DEFAULTS,
    entryFiredLines,
    entryNoTradeLine,
    entryRecord,
    hedgeEconomics,
    MAX_ENTRY_SCORE,
    normalizeEntrySettings,
    parseEntryMode,
    patternStats,
    priceMoves,
    readHedgePayouts,
    requiredEntryScore,
    strategyBreakdown,
    tickDirections,
    windowStats,
} from '../rise-fall-hedge-entry';

/** Build prices from a direction string (U/D/F) with a fixed step. */
const pricesFrom = (dirs, step = 0.1, start = 8000) => {
    const prices = [start];
    dirs.split('').forEach(d => {
        const last = prices[prices.length - 1];
        prices.push(Math.round((last + (d === 'U' ? step : d === 'D' ? -step : 0)) * 10) / 10);
    });
    return prices;
};

const alternating = n => 'UD'.repeat(Math.ceil(n / 2)).slice(0, n);

const PAYOUTS_OK = { rise: 3.9, fall: 3.88, available: true, problem: '' };

describe('Entry Engine — settings', () => {
    it('loosened defaults (fire about every 10 ticks on a random walk)', () => {
        expect(ENTRY_DEFAULTS).toMatchObject({
            mode: 'MULTI_CONFIRMATION',
            min_score: 5,
            min_bias: 60,
            lookback: 50,
            short_window: 10,
            medium_window: 20,
            long_window: 50,
            acceleration_threshold: 15,
            strength_ratio: 1.2,
            pattern_length: 4,
            min_pattern_samples: 10,
            pattern_threshold: 58,
            exhaustion_run: 4,
            max_simultaneous: 1,
        });
        expect(MAX_ENTRY_SCORE).toBe(13);
    });

    it('parses entry modes by letter or name', () => {
        expect(parseEntryMode('A')).toBe('MOMENTUM');
        expect(parseEntryMode('Momentum Acceleration')).toBe('ACCELERATION');
        expect(parseEntryMode('pattern repetition')).toBe('PATTERN');
        expect(parseEntryMode('Reversal/Exhaustion')).toBe('REVERSAL');
        expect(parseEntryMode('MULTI-CONFIRMATION')).toBe('MULTI_CONFIRMATION');
        expect(parseEntryMode('F')).toBe('ADAPTIVE');
        expect(parseEntryMode('nonsense')).toBe('MULTI_CONFIRMATION');
    });

    it('clamps lookback (min 20) and pattern length (3–10)', () => {
        const s = normalizeEntrySettings({ lookback: 5, pattern_length: 15, enabled: 'FALSE' });
        expect(s.lookback).toBe(20);
        expect(s.pattern_length).toBe(10);
        expect(s.enabled).toBe(false);
        expect(normalizeEntrySettings({ pattern_length: 1 }).pattern_length).toBe(3);
    });
});

describe('Entry Engine — momentum statistics', () => {
    it('counts UP/DOWN, percentages and sequences (example: 14 up / 6 down)', () => {
        const dirs = tickDirections(priceMoves(pricesFrom('UUUDUUUUDDUUDUUUUDDU')));
        const s = windowStats(dirs);
        expect(s).toMatchObject({ up: 14, down: 6, longest_up: 4, longest_down: 2 });
        expect(s.up_pct).toBe(70);
        expect(s.down_pct).toBe(30);
        expect(s.current).toEqual({ dir: 'U', length: 1 });
    });

    it('unchanged ticks are flat, not up or down', () => {
        expect(tickDirections(priceMoves([1, 1, 2, 1]))).toEqual(['F', 'U', 'D']);
    });
});

describe('Entry Engine — components', () => {
    const settings = normalizeEntrySettings({ pattern_history: 200 });

    it('waits for enough ticks', () => {
        const a = analyzeHedgeEntry(pricesFrom('UUU'), settings);
        expect(a.status).toBe('COLLECTING');
        expect(a.need).toBe(51);
    });

    it('momentum +2 when either direction reaches the bias', () => {
        const dirs = `${alternating(30)}${'UUUUUUUUUD'.repeat(2)}`; // last 50: 33 up = 66%
        const a = analyzeHedgeEntry(pricesFrom(dirs), settings);
        expect(a.components.momentum.lean.dir).toBe('UP');
        expect(a.components.momentum.score).toBe(2);
        const down = analyzeHedgeEntry(pricesFrom(dirs.replace(/U/g, 'x').replace(/D/g, 'U').replace(/x/g, 'D')), settings);
        expect(down.components.momentum.lean.dir).toBe('DOWN');
        expect(down.components.momentum.score).toBe(2);
    });

    it('acceleration: previous 10 at 50% UP, current 10 at 80% UP → +2', () => {
        const dirs = `${alternating(40)}UDUDUDUDUD${'UUUUDUUUDU'}`;
        const a = analyzeHedgeEntry(pricesFrom(dirs), settings);
        expect(a.components.acceleration.prev.up_pct).toBe(50);
        expect(a.components.acceleration.cur.up_pct).toBe(80);
        expect(a.components.acceleration.score).toBe(2);
    });

    it('tick strength: equal step sizes are neutral (0), stronger moves score +2', () => {
        const flat = analyzeHedgeEntry(pricesFrom(alternating(60)), settings);
        expect(flat.components.strength.available).toBe(true);
        expect(flat.components.strength.score).toBe(0);

        const prices = pricesFrom(alternating(50));
        let p = prices[prices.length - 1];
        for (let i = 0; i < 10; i++) {
            p = Math.round((p + (i % 2 ? -0.1 : 0.5)) * 10) / 10;
            prices.push(p);
        }
        const strong = analyzeHedgeEntry(prices, settings);
        expect(strong.components.strength.dir).toBe('UP');
        expect(strong.components.strength.score).toBe(2);
    });

    it('tick strength: a window with moves on only one side counts for that side (UP or DOWN)', () => {
        const up = analyzeHedgeEntry(pricesFrom(`${alternating(50)}UUUUUUUUUU`), settings);
        expect(up.components.strength).toMatchObject({ score: 2, dir: 'UP' });
        const down = analyzeHedgeEntry(pricesFrom(`${alternating(50)}DDDDDDDDDD`), settings);
        expect(down.components.strength).toMatchObject({ score: 2, dir: 'DOWN' });
    });

    it('side scores: UP points count for Rise, DOWN points for Fall, symmetrically', () => {
        const up = analyzeHedgeEntry(pricesFrom(`${alternating(30)}${'UUUUUUUUUD'.repeat(2)}`), settings);
        const flipped = `${alternating(30)}${'UUUUUUUUUD'.repeat(2)}`
            .replace(/U/g, 'x')
            .replace(/D/g, 'U')
            .replace(/x/g, 'D');
        const down = analyzeHedgeEntry(pricesFrom(flipped), settings);
        expect(up.side_scores.RISE).toBeGreaterThan(0);
        expect(down.side_scores.FALL).toBe(up.side_scores.RISE);
        expect(down.side_scores.RISE).toBe(up.side_scores.FALL);
        expect(down.score).toBe(up.score);
    });

    it('tick strength is not scored without price data', () => {
        const prices = pricesFrom(alternating(60));
        prices[prices.length - 3] = Number.NaN;
        expect(analyzeHedgeEntry(prices, settings).components.strength).toMatchObject({ available: false, score: 0 });
    });

    it('pattern repetition: counts occurrences and the next 2 ticks', () => {
        // "UUDUD" followed by UU every time, repeated 25 times.
        const dirs = `${'UUDUDUU'.repeat(25)}UUDUD`;
        const moves = priceMoves(pricesFrom(dirs));
        const p = patternStats(tickDirections(moves), moves, 5);
        expect(p.pattern).toBe('UUDUD');
        expect(p.up).toBe(25);
        expect(p.down).toBe(0);
        expect(p.up_pct).toBe(100);
        const a = analyzeHedgeEntry(pricesFrom(dirs), normalizeEntrySettings({ pattern_history: 1000, pattern_length: 5, min_pattern_samples: 20 }));
        expect(a.components.pattern.score).toBe(3);
    });

    it('pattern with too few samples never scores', () => {
        const dirs = `${'UUDUDUU'.repeat(10)}UUDUD`;
        const a = analyzeHedgeEntry(pricesFrom(dirs), normalizeEntrySettings({ pattern_history: 1000, pattern_length: 5, min_pattern_samples: 20 }));
        expect(a.components.pattern.samples).toBe(10);
        expect(a.components.pattern.enough).toBe(false);
        expect(a.components.pattern.score).toBe(0);
    });

    it('reversal: a long run alone is not enough', () => {
        const a = analyzeHedgeEntry(pricesFrom(`${alternating(50)}UUUUUUUU`), settings);
        expect(a.components.reversal.score).toBe(0);
    });

    it('reversal: long run + opposite ticks + confirmation → +2', () => {
        const a = analyzeHedgeEntry(pricesFrom(`${'UUUUUUUUUU'.repeat(5)}UUUUUUDD`), settings);
        expect(a.components.reversal.score).toBe(2);
        expect(a.components.reversal.confirmations.join(' ')).toMatch(/weakening/);
    });

    it('multi-window: all three agree → +2; disagreement → 0', () => {
        // long 50 ≈ 64% up, medium 20 = 70% up, short 10 = 80% up
        const agree = `${'UUDUDUUDUD'.repeat(3)}${'UUUDUDUUDU'}UUUUDUUDUU`;
        const a = analyzeHedgeEntry(pricesFrom(agree), settings);
        expect(a.components.multi_window.windows.map(w => w.dir)).toEqual(['UP', 'UP', 'UP']);
        expect(a.components.multi_window.score).toBe(2);

        const disagree = `${'DDUDD'.repeat(8)}UUUUUUUUDU`;
        const b = analyzeHedgeEntry(pricesFrom(disagree), settings);
        expect(b.components.multi_window.score).toBe(0);
    });

    it('score is the sum of the components and never exceeds 13', () => {
        const a = analyzeHedgeEntry(pricesFrom(`${alternating(30)}${'UUUDUUUDUU'.repeat(2)}`), settings);
        const sum = Object.values(a.components).reduce((s, c) => s + c.score, 0);
        expect(a.score).toBe(sum);
        expect(a.score).toBeLessThanOrEqual(13);
        expect(Object.values(a.components).reduce((s, c) => s + c.max, 0)).toBe(13);
    });
});

describe('Entry Engine — approval', () => {
    const settings = normalizeEntrySettings({});
    const analysis = (score, patch = {}) => ({
        score,
        bias: { dir: 'UP', pct: 70 },
        components: {
            momentum: { score: 2 },
            acceleration: { score: 2 },
            pattern: { score: 3, samples: 40, enough: true, pattern: 'UDUUD' },
            strength: { score: 0 },
            reversal: { score: 0 },
            multi_window: { score: 2 },
            ...patch,
        },
    });

    it('approves when every condition passes', () => {
        const d = decideHedgeEntry({ analysis: analysis(9), settings, required_score: 8, payouts: PAYOUTS_OK });
        expect(d.approved).toBe(true);
        expect(d.passed.length).toBeGreaterThan(5);
    });

    it('NO TRADE: insufficient entry score', () => {
        const d = decideHedgeEntry({ analysis: analysis(6), settings, required_score: 8, payouts: PAYOUTS_OK });
        expect(d.approved).toBe(false);
        expect(d.reason).toMatch(/Insufficient entry score/);
    });

    it('NO TRADE: payout below threshold (actual quoted payouts)', () => {
        const d = decideHedgeEntry({
            analysis: analysis(10),
            settings: normalizeEntrySettings({ min_payout: 5.2 }),
            required_score: 8,
            payouts: { rise: 4.7, fall: 4.68, available: true, problem: '' },
        });
        expect(d.reason).toMatch(/Payout below threshold on both sides/);
    });

    it('fires when either side meets the payout minimum', () => {
        const settings_min = normalizeEntrySettings({ min_payout: 3.89 });
        const rise_only = decideHedgeEntry({
            analysis: analysis(10),
            settings: settings_min,
            required_score: 8,
            payouts: { rise: 3.9, fall: 3.85, available: true, problem: '' },
        });
        expect(rise_only.approved).toBe(true);
        expect(rise_only.passed.join(' ')).toMatch(/\(Rise\)/);
        const fall_only = decideHedgeEntry({
            analysis: analysis(10),
            settings: settings_min,
            required_score: 8,
            payouts: { rise: 3.8, fall: 3.95, available: true, problem: '' },
        });
        expect(fall_only.approved).toBe(true);
        expect(fall_only.passed.join(' ')).toMatch(/\(Fall\)/);
    });

    it('NO TRADE: a contract is not available', () => {
        const d = decideHedgeEntry({
            analysis: analysis(10),
            settings,
            required_score: 8,
            payouts: { rise: 3.9, fall: null, available: false, problem: 'Fall has no live price' },
        });
        expect(d.reason).toMatch(/not available/);
    });

    it('NO TRADE: cooldown and open hedge', () => {
        expect(
            decideHedgeEntry({
                analysis: analysis(10),
                settings,
                required_score: 8,
                payouts: PAYOUTS_OK,
                temporary_block: 'Cooldown: 4s left.',
            }).reason
        ).toMatch(/Cooldown/);
        expect(
            decideHedgeEntry({ analysis: analysis(10), settings, required_score: 8, payouts: PAYOUTS_OK, open_hedges: 1 })
                .reason
        ).toMatch(/simultaneous/);
    });

    it('mode signals: multi-confirmation needs windows + momentum; pattern mode needs samples', () => {
        expect(
            decideHedgeEntry({
                analysis: analysis(9, { multi_window: { score: 0 } }),
                settings,
                required_score: 8,
                payouts: PAYOUTS_OK,
            }).reason
        ).toMatch(/Multi-Confirmation/);
        expect(
            decideHedgeEntry({
                analysis: analysis(9, { pattern: { score: 0, samples: 5, enough: false, pattern: 'UUUUU' } }),
                settings: normalizeEntrySettings({ mode: 'PATTERN' }),
                required_score: 8,
                payouts: PAYOUTS_OK,
            }).approved
        ).toBe(false);
    });

    it('the decision never names a side to buy', () => {
        const d = decideHedgeEntry({ analysis: analysis(11), settings, required_score: 8, payouts: PAYOUTS_OK });
        expect(Object.keys(d)).toEqual(['approved', 'reason', 'passed', 'conditions']);
    });

    it('Combined Adaptive raises the minimum score after losing adaptive hedges', () => {
        const adaptive = normalizeEntrySettings({ mode: 'ADAPTIVE' });
        const loss = i => ({ id: i, created_at: i, day: dayKey(i), net: -0.1, entry: { mode: 'ADAPTIVE' } });
        expect(requiredEntryScore(adaptive, [])).toBe(5);
        expect(requiredEntryScore(adaptive, [loss(1), loss(2)])).toBe(7);
        expect(requiredEntryScore(adaptive, [1, 2, 3, 4, 5].map(loss))).toBe(8);
        expect(requiredEntryScore(settings, [loss(1), loss(2)])).toBe(5);
    });
});

describe('Entry Engine — trade frequency with default settings', () => {
    const walk = (n, seed = 7) => {
        let s = seed;
        const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
        const prices = [8000];
        for (let i = 1; i < n; i++) prices.push(Math.round((prices[i - 1] + (rnd() < 0.5 ? 0.1 : -0.1)) * 10) / 10);
        return prices;
    };

    it('approves an entry roughly every 5–20 ticks on a Step-Index-like random walk', () => {
        const settings = normalizeEntrySettings({});
        const prices = walk(2000);
        let checked = 0;
        let fired = 0;
        for (let i = 1001; i < prices.length; i++) {
            const a = analyzeHedgeEntry(prices.slice(i - 1001, i), settings);
            checked += 1;
            if (decideHedgeEntry({ analysis: a, settings, required_score: settings.min_score, payouts: PAYOUTS_OK }).approved) {
                fired += 1;
            }
        }
        const ticks_per_entry = checked / fired;
        expect(ticks_per_entry).toBeGreaterThan(5);
        expect(ticks_per_entry).toBeLessThan(20);
    });
});

describe('Entry Engine — payouts, economics and logs', () => {
    it('reads live CALL/PUT payouts and flags errors', () => {
        const ok = readHedgePayouts([
            { contract_type: 'CALL', payout: 3.9, ask_price: 2, purchase_reference: 1 },
            { contract_type: 'PUT', payout: 3.88, ask_price: 2, purchase_reference: 1 },
        ]);
        expect(ok).toMatchObject({ rise: 3.9, fall: 3.88, available: true });
        const bad = readHedgePayouts([
            { contract_type: 'CALL', payout: 3.9 },
            { contract_type: 'PUT', error: { message: 'Market closed' } },
        ]);
        expect(bad.available).toBe(false);
        expect(bad.problem).toMatch(/Market closed/);
    });

    it('economics example: $2 per leg, Rise payout $5.63 → +$1.63 if Rise wins', () => {
        expect(hedgeEconomics(2, { rise: 5.63, fall: 5.6 })).toEqual({
            total_stake: 4,
            rise_wins: 1.63,
            fall_wins: 1.6,
            both_lose: -4,
        });
        expect(hedgeEconomics(2, { rise: 3.9, fall: 3.88 }).rise_wins).toBe(-0.1);
    });

    it('logs fired and no-trade decisions', () => {
        const settings = normalizeEntrySettings({});
        const a = analyzeHedgeEntry(
            pricesFrom(`${'UUDUDUUDUD'.repeat(3)}${'UUUDUDUUDU'}UUUUDUUDUU`),
            normalizeEntrySettings({ pattern_history: 200 })
        );
        const no = decideHedgeEntry({ analysis: a, settings, required_score: 13, payouts: PAYOUTS_OK });
        const rec = entryRecord({
            now: 0,
            market: 'Step Index 100',
            settings,
            analysis: a,
            required_score: 13,
            payouts: PAYOUTS_OK,
            decision: no,
        });
        expect(rec.decision).toBe('NO TRADE');
        expect(entryNoTradeLine(rec)).toMatch(/NO TRADE — Insufficient entry score/);

        const yes = { ...rec, decision: 'HEDGE FIRED', reason: null, passed: ['Entry score'] };
        const lines = entryFiredLines({
            record: yes,
            analysis: a,
            stake: 2,
            duration: 2,
            economics: hedgeEconomics(2, PAYOUTS_OK),
        }).join('\n');
        expect(lines).toMatch(/ENTRY SCORE: \d+\/13/);
        expect(lines).toMatch(/Rise payout: \$3\.90 \| Fall payout: \$3\.88/);
        expect(lines).toMatch(/DECISION: HEDGE FIRED — Rise \$2\.00 \+ Fall \$2\.00, 2 ticks/);
    });

    it('performance breakdown per entry strategy', () => {
        const h = (id, net, strategy) => ({ id, created_at: id, day: 'd', net, total_stake: 4, total_payout: 4 + net, entry: strategy ? { strategy } : null });
        const groups = strategyBreakdown([h(1, 1.6, 'MOMENTUM'), h(2, -4, 'MOMENTUM'), h(3, 1.6, 'PATTERN REPETITION'), h(4, -0.1)]);
        const by = Object.fromEntries(groups.map(g => [g.strategy, g.stats]));
        expect(by.MOMENTUM).toMatchObject({ total: 2, profitable: 1, losing: 1, net: -2.4 });
        expect(by['PATTERN REPETITION']).toMatchObject({ total: 1, net: 1.6 });
        expect(by['NO ENTRY ENGINE'].total).toBe(1);
    });
});
