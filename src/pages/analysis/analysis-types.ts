export type AnalysisCandle = {
    close: number;
    epoch: number;
    high: number;
    low: number;
    open: number;
};

export type AnalysisSymbol = {
    displayName: string;
    exchangeIsOpen: boolean;
    marketDisplayName: string;
    pip?: number;
    submarketDisplayName: string;
    symbol: string;
};

export type TimeframeOption = {
    granularity: number;
    horizon: string;
    label: string;
};

export type MarketStatus = 'idle' | 'loading' | 'live' | 'error';

export type IdeaDirection = 'rise' | 'fall' | 'wait' | 'watch';

export type AnalysisIdea = {
    confidence: number;
    direction: IdeaDirection;
    horizon: string;
    id: string;
    invalidation: string;
    price: number;
    reasons: string[];
    title: string;
};

export type AnalysisSnapshot = {
    emaFast: number | null;
    emaSlow: number | null;
    ideas: AnalysisIdea[];
    lastPrice: number | null;
    momentum: number | null;
    rangeRatio: number | null;
    rsi: number | null;
    trend: 'up' | 'down' | 'mixed';
    volatility: 'compressed' | 'stable' | 'expanding' | 'spike';
};
