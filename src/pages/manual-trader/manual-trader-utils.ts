export const DEFAULT_TICK_WINDOW = 120;
export const MIN_TICK_WINDOW = 10;
export const MAX_TICK_WINDOW = 1000;
export const MAX_BULK_TRADES = 10;
export const MAX_DURATION_TICKS = 10;
export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export type TradeTypeId = 'matches_differs' | 'over_under' | 'even_odd';

export type TradeSide = {
    contract_type: string;
    label: string;
};

export type TradeTypeConfig = {
    id: TradeTypeId;
    label: string;
    uses_prediction: boolean;
    sides: [TradeSide, TradeSide];
};

export const TRADE_TYPES: TradeTypeConfig[] = [
    {
        id: 'matches_differs',
        label: 'Matches/Differs',
        uses_prediction: true,
        sides: [
            { contract_type: 'DIGITMATCH', label: 'Matches' },
            { contract_type: 'DIGITDIFF', label: 'Differs' },
        ],
    },
    {
        id: 'over_under',
        label: 'Over/Under',
        uses_prediction: true,
        sides: [
            { contract_type: 'DIGITOVER', label: 'Over' },
            { contract_type: 'DIGITUNDER', label: 'Under' },
        ],
    },
    {
        id: 'even_odd',
        label: 'Even/Odd',
        uses_prediction: false,
        sides: [
            { contract_type: 'DIGITEVEN', label: 'Even' },
            { contract_type: 'DIGITODD', label: 'Odd' },
        ],
    },
];

export const getTradeType = (id: TradeTypeId) => TRADE_TYPES.find(t => t.id === id) || TRADE_TYPES[0];

export type DigitStat = { digit: number; count: number; pct: number };

/** Appearance % of digits 0–9 over the last `window` digits. */
export const getDigitStats = (digits: number[], window: number): DigitStat[] => {
    const sample = digits.slice(-Math.max(1, window));
    const counts = DIGITS.map(d => sample.filter(x => x === d).length);
    return DIGITS.map(digit => ({
        digit,
        count: counts[digit],
        pct: sample.length ? (counts[digit] / sample.length) * 100 : 0,
    }));
};

export type DigitRank = 'most' | 'second_most' | 'least' | 'second_least';

/** Highest, second-highest, lowest and second-lowest digits (ties go to the smaller digit). */
export const getDigitRanks = (stats: DigitStat[]): Partial<Record<number, DigitRank>> => {
    if (!stats.some(s => s.count > 0)) return {};
    const desc = [...stats].sort((a, b) => b.pct - a.pct || a.digit - b.digit);
    const asc = [...stats].sort((a, b) => a.pct - b.pct || a.digit - b.digit);
    const ranks: Partial<Record<number, DigitRank>> = {};
    ranks[asc[1].digit] = 'second_least';
    ranks[asc[0].digit] = 'least';
    ranks[desc[1].digit] = 'second_most';
    ranks[desc[0].digit] = 'most';
    return ranks;
};

/** Allowed prediction range per contract (Over 0–8, Under 1–9, others 0–9). */
export const getPredictionBounds = (contract_type: string) => {
    if (contract_type === 'DIGITOVER') return { min: 0, max: 8 };
    if (contract_type === 'DIGITUNDER') return { min: 1, max: 9 };
    return { min: 0, max: 9 };
};

/** Share of the window (%) on which the side would have won. */
export const getSideProbability = (contract_type: string, prediction: number, stats: DigitStat[]) => {
    const sum = (filter: (digit: number) => boolean) =>
        stats.filter(s => filter(s.digit)).reduce((total, s) => total + s.pct, 0);
    switch (contract_type) {
        case 'DIGITMATCH':
            return sum(d => d === prediction);
        case 'DIGITDIFF':
            return sum(d => d !== prediction);
        case 'DIGITOVER':
            return sum(d => d > prediction);
        case 'DIGITUNDER':
            return sum(d => d < prediction);
        case 'DIGITEVEN':
            return sum(d => d % 2 === 0);
        case 'DIGITODD':
            return sum(d => d % 2 === 1);
        default:
            return 0;
    }
};

export const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

/** Digit contracts are offered on the continuous volatility indices only. */
export const isDigitMarket = (symbol: string) => /^(R_\d+|1HZ\d+V)$/.test(symbol);

export type ProposalRequestInput = {
    contract_type: string;
    symbol: string;
    stake: number;
    duration: number;
    currency: string;
    prediction?: number;
};

export const buildProposalRequest = ({
    contract_type,
    symbol,
    stake,
    duration,
    currency,
    prediction,
}: ProposalRequestInput) => {
    const request: Record<string, unknown> = {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type,
        currency,
        duration,
        duration_unit: 't',
        underlying_symbol: symbol,
    };
    if (prediction !== undefined && contract_type !== 'DIGITEVEN' && contract_type !== 'DIGITODD') {
        request.barrier = String(prediction);
    }
    return request;
};
