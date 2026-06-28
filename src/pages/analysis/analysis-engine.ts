import type { AnalysisCandle, AnalysisIdea, AnalysisSnapshot, AnalysisSymbol, TimeframeOption } from './analysis-types';

const formatPrice = (value: number | null, pip?: number) => {
    if (value === null || Number.isNaN(value)) return '-';

    const decimals = pip ? Math.max(0, Math.min(8, String(pip).split('.')[1]?.length ?? 2)) : 2;
    return value.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
    });
};

const calculateEma = (values: number[], period: number): number | null => {
    if (values.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

    for (let index = period; index < values.length; index++) {
        ema = (values[index] - ema) * multiplier + ema;
    }

    return ema;
};

const calculateRsi = (values: number[], period = 14): number | null => {
    if (values.length <= period) return null;

    let gains = 0;
    let losses = 0;

    for (let index = values.length - period; index < values.length; index++) {
        const change = values[index] - values[index - 1];
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }

    if (losses === 0) return 100;

    const relativeStrength = gains / period / (losses / period);
    return 100 - 100 / (1 + relativeStrength);
};

const average = (values: number[]) => {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getRangeRatio = (candles: AnalysisCandle[]) => {
    if (candles.length < 30) return null;

    const ranges = candles.map(candle => Math.max(0, candle.high - candle.low));
    const recent = average(ranges.slice(-10));
    const baseline = average(ranges.slice(-30, -10));

    if (!recent || !baseline) return null;
    return recent / baseline;
};

const classifyVolatility = (rangeRatio: number | null): AnalysisSnapshot['volatility'] => {
    if (rangeRatio === null) return 'stable';
    if (rangeRatio >= 1.75) return 'spike';
    if (rangeRatio >= 1.18) return 'expanding';
    if (rangeRatio <= 0.72) return 'compressed';
    return 'stable';
};

const clampConfidence = (value: number) => Math.max(35, Math.min(88, Math.round(value)));

const buildIdea = ({
    direction,
    title,
    confidence,
    reasons,
    invalidation,
    price,
    timeframe,
}: {
    confidence: number;
    direction: AnalysisIdea['direction'];
    invalidation: string;
    price: number;
    reasons: string[];
    timeframe: TimeframeOption;
    title: string;
}): AnalysisIdea => ({
    confidence: clampConfidence(confidence),
    direction,
    horizon: timeframe.horizon,
    id: `${direction}-${title}-${price}-${timeframe.granularity}`,
    invalidation,
    price,
    reasons,
    title,
});

export const generateAnalysisSnapshot = (
    candles: AnalysisCandle[],
    symbol: AnalysisSymbol | null,
    timeframe: TimeframeOption
): AnalysisSnapshot => {
    const closes = candles.map(candle => candle.close);
    const lastCandle = candles[candles.length - 1];
    const lastPrice = lastCandle?.close ?? null;
    const emaFast = calculateEma(closes, 9);
    const emaSlow = calculateEma(closes, 21);
    const rsi = calculateRsi(closes);
    const momentum = closes.length > 8 ? closes[closes.length - 1] - closes[closes.length - 8] : null;
    const rangeRatio = getRangeRatio(candles);
    const volatility = classifyVolatility(rangeRatio);
    const pip = symbol?.pip;

    const trend =
        emaFast !== null && emaSlow !== null && lastPrice !== null
            ? emaFast > emaSlow && lastPrice > emaFast
                ? 'up'
                : emaFast < emaSlow && lastPrice < emaFast
                  ? 'down'
                  : 'mixed'
            : 'mixed';

    const ideas: AnalysisIdea[] = [];

    if (!lastCandle || lastPrice === null || emaFast === null || emaSlow === null || rsi === null || momentum === null) {
        return {
            emaFast,
            emaSlow,
            ideas: [
                {
                    confidence: 40,
                    direction: 'wait',
                    horizon: timeframe.horizon,
                    id: 'warming-up',
                    invalidation: 'Needs more candles',
                    price: lastPrice ?? 0,
                    reasons: ['Market data loading'],
                    title: 'Waiting for structure',
                },
            ],
            lastPrice,
            momentum,
            rangeRatio,
            rsi,
            trend,
            volatility,
        };
    }

    const formattedFast = formatPrice(emaFast, pip);
    const formattedSlow = formatPrice(emaSlow, pip);

    if (volatility === 'spike') {
        ideas.push(
            buildIdea({
                confidence: 58,
                direction: 'wait',
                invalidation: 'Range normalises below recent average',
                price: lastPrice,
                reasons: ['Range spike', `RSI ${Math.round(rsi)}`, `EMA 9 ${formattedFast}`],
                timeframe,
                title: 'Wait for volatility to settle',
            })
        );
    }

    if (trend === 'up' && momentum > 0 && rsi < 70 && volatility !== 'spike') {
        ideas.push(
            buildIdea({
                confidence: 62 + (rsi > 45 && rsi < 62 ? 10 : 0) + (volatility === 'stable' ? 6 : 0),
                direction: 'rise',
                invalidation: `Close below EMA 21 (${formattedSlow})`,
                price: lastPrice,
                reasons: ['EMA 9 above EMA 21', 'Positive momentum', `RSI ${Math.round(rsi)}`],
                timeframe,
                title: 'Rise continuation idea',
            })
        );
    }

    if (trend === 'down' && momentum < 0 && rsi > 30 && volatility !== 'spike') {
        ideas.push(
            buildIdea({
                confidence: 62 + (rsi > 38 && rsi < 55 ? 10 : 0) + (volatility === 'stable' ? 6 : 0),
                direction: 'fall',
                invalidation: `Close above EMA 21 (${formattedSlow})`,
                price: lastPrice,
                reasons: ['EMA 9 below EMA 21', 'Negative momentum', `RSI ${Math.round(rsi)}`],
                timeframe,
                title: 'Fall continuation idea',
            })
        );
    }

    if (volatility === 'compressed' && Math.abs(emaFast - emaSlow) / lastPrice < 0.0015) {
        ideas.push(
            buildIdea({
                confidence: 55,
                direction: 'watch',
                invalidation: 'No candle expansion',
                price: lastPrice,
                reasons: ['Compressed range', 'EMA lines converging', `Last price ${formatPrice(lastPrice, pip)}`],
                timeframe,
                title: 'Breakout watch',
            })
        );
    }

    if (!ideas.length) {
        ideas.push(
            buildIdea({
                confidence: 48,
                direction: 'wait',
                invalidation: 'Trend and momentum align',
                price: lastPrice,
                reasons: [`Trend ${trend}`, `RSI ${Math.round(rsi)}`, `EMA 9 ${formattedFast}`],
                timeframe,
                title: 'No clean idea',
            })
        );
    }

    return {
        emaFast,
        emaSlow,
        ideas,
        lastPrice,
        momentum,
        rangeRatio,
        rsi,
        trend,
        volatility,
    };
};

export const formatAnalysisPrice = formatPrice;
