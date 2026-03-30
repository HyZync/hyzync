import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Sparkline component for sentiment change visualization
const Sparkline = ({ data, color }) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 80 - 10;
        return `${x},${y}`;
    }).join(' ');

    const strokeColor = color === 'red' ? '#f43f5e' : color === 'green' ? '#10b981' : '#cbd5e1';

    return (
        <svg viewBox="0 0 100 30" className="w-16 h-6 overflow-visible" preserveAspectRatio="none">
            <polyline
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-80"
            />
            <line x1="0" y1="20" x2="100" y2="20" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2,2" />
        </svg>
    );
};

const SentimentBar = ({ positive, neutral, negative }) => {
    const total = (positive + neutral + negative) || 1;
    const pPct = (positive / total) * 100;
    const nPct = (neutral / total) * 100;
    const negPct = (negative / total) * 100;

    return (
        <div className="flex items-center gap-3 w-48">
            <div className="flex w-full h-2.5 rounded-sm overflow-hidden bg-gray-100">
                {nPct > 0 && <div style={{ width: `${nPct}%` }} className="bg-amber-400" />}
                {negPct > 0 && <div style={{ width: `${negPct}%` }} className="bg-rose-500" />}
                {pPct > 0 && <div style={{ width: `${pPct}%` }} className="bg-emerald-500" />}
            </div>
        </div>
    );
};

const ThemeRow = ({ theme, depth = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = theme.subthemes && theme.subthemes.length > 0;

    const sentimentScore = theme.sentimentScore?.toFixed(1) || "0.0";
    const trendColor = theme.trend < 0 ? 'text-rose-500' : theme.trend > 0 ? 'text-emerald-500' : 'text-gray-500';

    return (
        <>
            <tr
                className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${depth === 0 ? '' : 'bg-gray-50/30'}`}
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                style={{ cursor: hasChildren ? 'pointer' : 'default' }}
            >
                <td className="py-4 px-6">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 2}rem` }}>
                        {hasChildren ? (
                            isExpanded ? <ChevronDown size={14} className="text-gray-400 font-bold" /> : <ChevronRight size={14} className="text-gray-400 font-bold" />
                        ) : (
                            <div className="w-3.5" />
                        )}
                        <span className={`text-sm ${depth === 0 ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'}`}>
                            {theme.name}
                        </span>
                    </div>
                </td>
                <td className="py-4 px-6">
                    <div className="flex items-center gap-4">
                        <SentimentBar
                            positive={theme.sentiment.positive || 0}
                            neutral={theme.sentiment.neutral || 0}
                            negative={theme.sentiment.negative || 0}
                        />
                        <span className={`text-xs font-bold w-6 text-right ${theme.sentimentScore > 0 ? 'text-emerald-600' : theme.sentimentScore < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                            {sentimentScore}
                        </span>
                    </div>
                </td>
                <td className="py-4 px-6">
                    <span className="text-sm font-semibold text-gray-700">{(theme.volume || 0).toLocaleString()}</span>
                </td>
                <td className="py-4 px-6">
                    <div className="flex items-center gap-4">
                        <span className={`text-sm font-bold w-12 ${trendColor}`}>
                            {theme.trend > 0 ? '+' : ''}{theme.trend}%
                        </span>
                        {theme.trendData && (
                            <Sparkline
                                data={theme.trendData}
                                color={theme.trend < 0 ? 'red' : theme.trend > 0 ? 'green' : 'gray'}
                            />
                        )}
                    </div>
                </td>
            </tr>
            {hasChildren && isExpanded && (
                theme.subthemes.map((sub, i) => (
                    <ThemeRow key={`${theme.name}-sub-${i}`} theme={sub} depth={depth + 1} />
                ))
            )}
        </>
    );
};

const ThemesDetailedTable = ({ results }) => {
    const data = useMemo(() => {
        const reviews = results?.reviews || [];
        const thematic = results?.thematic || {};
        const painPoints = thematic.pain_points || {};

        // Build from pain_points categories with real sentiment from reviews
        if (Object.keys(painPoints).length > 0) {
            return Object.entries(painPoints).map(([catName, info]) => {
                const catReviews = reviews.filter(r => r.pain_point_category === catName);
                const catCount = catReviews.length || info.count || 0;

                // Calculate real sentiment distribution
                let posCount = 0, negCount = 0, neuCount = 0;
                let totalScore = 0;
                catReviews.forEach(r => {
                    const s = (r.sentiment || '').toLowerCase();
                    const score = r.sentiment_score ?? 0;
                    totalScore += score;
                    if (s === 'positive' || score > 0.3) posCount++;
                    else if (s === 'negative' || score < -0.3) negCount++;
                    else neuCount++;
                });

                const avgScore = catCount > 0 ? totalScore / catCount : 0;

                // Build subthemes from issue breakdown
                const issueMap = {};
                catReviews.forEach(r => {
                    const issue = r.issue || r.root_cause;
                    if (issue && !['N/A', 'None', '', 'null', 'n/a', 'none'].includes(issue)) {
                        if (!issueMap[issue]) issueMap[issue] = { reviews: [], count: 0 };
                        issueMap[issue].count++;
                        issueMap[issue].reviews.push(r);
                    }
                });

                const subthemes = Object.entries(issueMap)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 5)
                    .map(([name, data]) => {
                        let sPos = 0, sNeg = 0, sNeu = 0, sTotal = 0;
                        data.reviews.forEach(r => {
                            const s = (r.sentiment || '').toLowerCase();
                            const score = r.sentiment_score ?? 0;
                            sTotal += score;
                            if (s === 'positive' || score > 0.3) sPos++;
                            else if (s === 'negative' || score < -0.3) sNeg++;
                            else sNeu++;
                        });
                        const sAvg = data.count > 0 ? sTotal / data.count : 0;
                        return {
                            name,
                            sentimentScore: parseFloat(sAvg.toFixed(1)),
                            sentiment: { positive: sPos, neutral: sNeu, negative: sNeg },
                            volume: data.count,
                            trend: 0,
                            trendData: null,
                            subthemes: []
                        };
                    });

                return {
                    name: catName,
                    sentimentScore: parseFloat(avgScore.toFixed(1)),
                    sentiment: { positive: posCount, neutral: neuCount, negative: negCount },
                    volume: catCount,
                    trend: 0,
                    trendData: null,
                    subthemes,
                };
            }).sort((a, b) => b.volume - a.volume);
        }

        // Fallback: use top_issues flat
        if ((thematic.top_issues || []).length > 0) {
            return thematic.top_issues.map(i => {
                // Try to compute real sentiment from reviews matching this issue
                const issueReviews = reviews.filter(r => r.issue === i.name || r.root_cause === i.name);
                let posC = 0, negC = 0, neuC = 0, totalS = 0;
                issueReviews.forEach(r => {
                    const s = (r.sentiment || '').toLowerCase();
                    const score = r.sentiment_score ?? 0;
                    totalS += score;
                    if (s === 'positive' || score > 0.3) posC++;
                    else if (s === 'negative' || score < -0.3) negC++;
                    else neuC++;
                });
                const avgS = issueReviews.length > 0 ? totalS / issueReviews.length : 0;

                return {
                    name: i.name,
                    sentimentScore: parseFloat(avgS.toFixed(1)),
                    sentiment: { positive: posC, neutral: neuC, negative: negC },
                    volume: i.count || 0,
                    trend: 0,
                    trendData: null,
                    subthemes: []
                };
            });
        }

        return [];
    }, [results]);

    if (data.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-[13px] font-bold text-gray-800 tracking-wide uppercase">Themes</h3>
                </div>
                <div className="flex items-center justify-center p-8 text-sm text-gray-400">
                    No theme data available. Run an analysis first.
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-[13px] font-bold text-gray-800 tracking-wide uppercase">Themes</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50">
                            <th className="py-3 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-gray-600">
                                Themes <div className="flex flex-col"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></div>
                            </th>
                            <th className="py-3 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider items-center gap-1 cursor-pointer hover:text-gray-600">
                                <div className="flex items-center gap-1">Sentiment <div className="flex flex-col"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></div></div>
                            </th>
                            <th className="py-3 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider items-center gap-1 cursor-pointer hover:text-gray-600">
                                <div className="flex items-center gap-1">Volume <div className="flex flex-col"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></div></div>
                            </th>
                            <th className="py-3 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Sentiment Change
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence>
                            {data.map((theme, idx) => (
                                <ThemeRow key={idx} theme={theme} />
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ThemesDetailedTable;
