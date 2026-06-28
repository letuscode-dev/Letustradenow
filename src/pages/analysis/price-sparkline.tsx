import type { AnalysisCandle } from './analysis-types';

type PriceSparklineProps = {
    candles: AnalysisCandle[];
    trend: 'up' | 'down' | 'mixed';
};

const getPath = (candles: AnalysisCandle[], width: number, height: number) => {
    if (candles.length < 2) return '';

    const closes = candles.map(candle => candle.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const step = width / (candles.length - 1);

    return candles
        .map((candle, index) => {
            const x = index * step;
            const y = height - ((candle.close - min) / range) * height;
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');
};

const PriceSparkline = ({ candles, trend }: PriceSparklineProps) => {
    const width = 640;
    const height = 190;
    const path = getPath(candles.slice(-90), width, height);
    const className = `analysis-sparkline analysis-sparkline--${trend}`;

    return (
        <svg className={className} viewBox={`0 0 ${width} ${height}`} role='img' aria-label='Price line'>
            <line className='analysis-sparkline__grid' x1='0' x2={width} y1={height / 2} y2={height / 2} />
            {path ? <path className='analysis-sparkline__line' d={path} /> : null}
        </svg>
    );
};

export default PriceSparkline;
