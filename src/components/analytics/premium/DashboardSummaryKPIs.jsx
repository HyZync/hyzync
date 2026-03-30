import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KPIScore = ({ title, score, change, min = -100, max = 100, isPercentage = false, reverseColors = false }) => {
    const normalizedScore = (score - min) / (max - min);

    const getScoreColor = (val) => {
        if (reverseColors) {
            if (val > 0) return 'bg-rose-500';
            if (val < -10) return 'bg-emerald-500';
            return 'bg-amber-500';
        } else {
            if (val > 0) return 'bg-emerald-500';
            if (val < -10) return 'bg-rose-500';
            return 'bg-amber-500';
        }
    };

    const getTextColor = (val) => {
        if (reverseColors) {
            if (val > 0) return 'text-rose-500';
            if (val < -10) return 'text-emerald-500';
            return 'text-amber-500';
        } else {
            if (val > 0) return 'text-emerald-500';
            if (val < -10) return 'text-rose-500';
            return 'text-amber-500';
        }
    };

    const getPillStyle = (val) => {
        if (val > 0) return 'bg-emerald-50 text-emerald-700';
        if (val < 0) return 'bg-rose-50 text-rose-700';
        return 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex flex-col justify-between h-full">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">{title}</h3>

            <div className="flex items-baseline gap-3 mb-4 mt-2">
                <span className={`text-4xl font-bold tracking-tight ${getTextColor(score)}`}>
                    {score > 0 && !reverseColors ? '+' : ''}{score}{isPercentage ? '%' : ''}
                </span>

                {change !== undefined && (
                    <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${getPillStyle(change)}`}>
                        {Math.abs(change)}
                        {change > 0 ? <TrendingUp size={12} /> : change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                    </div>
                )}
            </div>

            {/* Minimal Scale Visualization */}
            <div className="relative mt-auto pt-4">
                <div className="flex justify-between text-[10px] text-gray-400 font-medium mb-1.5 px-1">
                    <span>{min}</span>
                    <span>0</span>
                    <span>+{max}</span>
                </div>

                <div className="relative h-2 bg-gray-100 rounded-full w-full overflow-hidden">
                    <div
                        className={`absolute top-0 left-0 h-full rounded-full ${getScoreColor(score)} transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.max(0, Math.min(100, normalizedScore * 100))}%` }}
                    />

                    {/* Zero Marker */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${((0 - min) / (max - min)) * 100}%` }} />
                </div>
            </div>
        </div>
    );
};

const DashboardSummaryKPIs = ({ results }) => {
    const kpis = useMemo(() => {
        if (!results) {
            return {
                csatImpact: { title: "GLOBAL CSAT", score: 0, change: undefined, min: 0, max: 100, reverse: false },
                sentimentScore: { title: "SENTIMENT POLARITY", score: 0, change: undefined, min: -1, max: 1, reverse: false },
                npsImpact: { title: "NET PROMOTER SCORE", score: 0, change: undefined, min: -100, max: 100, reverse: false }
            };
        }

        const nps = parseFloat(results.nps) || 0;
        const csatStr = String(results.csat || '0').replace(/[^0-9.-]/g, '');
        const csat = parseFloat(csatStr) || 0;

        let sentimentVal = 0;
        if (results.sentimentDistribution) {
            const dist = results.sentimentDistribution;
            const pos = dist.Positive || dist.positive || 0;
            const neg = dist.Negative || dist.negative || 0;
            const total = pos + (dist.Neutral || dist.neutral || 0) + neg;
            if (total > 0) sentimentVal = (pos - neg) / total;
        }

        return {
            csatImpact: { title: "GLOBAL CSAT", score: parseFloat(csat.toFixed(1)), change: undefined, min: 0, max: 100, reverse: false },
            sentimentScore: { title: "SENTIMENT POLARITY", score: parseFloat(sentimentVal.toFixed(2)), change: undefined, min: -1, max: 1, reverse: false },
            npsImpact: { title: "NET PROMOTER SCORE", score: parseFloat(nps.toFixed(1)), change: undefined, min: -100, max: 100, reverse: false }
        };
    }, [results]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KPIScore
                title={kpis.csatImpact.title}
                score={kpis.csatImpact.score}
                change={kpis.csatImpact.change}
                min={kpis.csatImpact.min}
                max={kpis.csatImpact.max}
                reverseColors={kpis.csatImpact.reverse}
            />

            <KPIScore
                title={kpis.sentimentScore.title}
                score={kpis.sentimentScore.score}
                change={kpis.sentimentScore.change}
                min={kpis.sentimentScore.min}
                max={kpis.sentimentScore.max}
                reverseColors={kpis.sentimentScore.reverse}
            />

            <KPIScore
                title={kpis.npsImpact.title}
                score={kpis.npsImpact.score}
                change={kpis.npsImpact.change}
                min={kpis.npsImpact.min}
                max={kpis.npsImpact.max}
                reverseColors={kpis.npsImpact.reverse}
            />
        </div>
    );
};

export default DashboardSummaryKPIs;
