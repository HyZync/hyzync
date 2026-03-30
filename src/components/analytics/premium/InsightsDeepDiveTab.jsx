import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Smile, Frown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- SHARED COMPONENTS ---

const SectionContainer = ({ title, subtitle, children, className = "" }) => (
    <div className={`bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col ${className}`}>
        <div className="mb-4">
            {title && (
                <h3 className="text-[13px] font-bold text-gray-800 uppercase tracking-widest leading-none">
                    {title}
                </h3>
            )}
            {subtitle && (
                <p className="text-xs text-gray-500 font-medium mt-2">{subtitle}</p>
            )}
        </div>
        <div className="flex-1 flex flex-col">
            {children}
        </div>
    </div>
);

const SentimentBar = ({ scores }) => {
    const total = scores.reduce((sum, val) => sum + val, 0) || 1;
    const [amber, rose, emerald] = scores;

    const amberPct = (amber / total) * 100;
    const rosePct = (rose / total) * 100;
    const emeraldPct = (emerald / total) * 100;

    return (
        <div className="flex w-24 h-[10px] rounded-sm overflow-hidden bg-gray-100 gap-[2px]">
            {amberPct > 0 && <div style={{ width: `${amberPct}%` }} className="bg-amber-400" />}
            {rosePct > 0 && <div style={{ width: `${rosePct}%` }} className="bg-rose-500" />}
            {emeraldPct > 0 && <div style={{ width: `${emeraldPct}%` }} className="bg-emerald-500" />}
        </div>
    );
};

// --- QUADRANT 1: THEMES ACCORDION ---

const InsightThemesWidget = ({ results }) => {
    // Build themes from thematic.pain_points (categories) and thematic.top_issues (sub-items)
    const data = useMemo(() => {
        const thematic = results?.thematic || {};
        const painPoints = thematic.pain_points || {};
        const topIssues = thematic.top_issues || [];
        const reviews = results?.reviews || [];

        // If we have pain point categories, group issues under them
        const categories = Object.keys(painPoints);

        if (categories.length > 0) {
            return categories.map(cat => {
                // Find issues belonging to this category from reviews
                const catReviews = reviews.filter(r => r.pain_point_category === cat);
                const catTotal = catReviews.length || painPoints[cat]?.count || 0;

                // Calculate sentiment for this category
                const posCount = catReviews.filter(r => r.sentiment === 'Positive' || r.sentiment_score > 0.3).length;
                const negCount = catReviews.filter(r => r.sentiment === 'Negative' || r.sentiment_score < -0.3).length;
                const neuCount = catTotal - posCount - negCount;
                const avgScore = catTotal > 0
                    ? (catReviews.reduce((s, r) => s + (r.sentiment_score || 0), 0) / catTotal).toFixed(1)
                    : '0.0';

                // Get top issues for this category
                const issueMap = {};
                catReviews.forEach(r => {
                    const issue = r.issue || r.root_cause;
                    if (issue && !['N/A', 'None', '', 'null'].includes(issue)) {
                        issueMap[issue] = (issueMap[issue] || 0) + 1;
                    }
                });

                const subthemes = Object.entries(issueMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([name, count]) => {
                        const issueReviews = catReviews.filter(r => r.issue === name || r.root_cause === name);
                        const iPos = issueReviews.filter(r => r.sentiment === 'Positive' || r.sentiment_score > 0.3).length;
                        const iNeg = issueReviews.filter(r => r.sentiment === 'Negative' || r.sentiment_score < -0.3).length;
                        const iNeu = count - iPos - iNeg;
                        const iAvg = count > 0
                            ? (issueReviews.reduce((s, r) => s + (r.sentiment_score || 0), 0) / count).toFixed(1)
                            : '0.0';
                        return { name, score: iAvg, bar: [Math.max(0, iNeu), Math.max(0, iNeg), Math.max(0, iPos)] };
                    });

                return {
                    name: cat,
                    score: avgScore,
                    bar: [Math.max(0, neuCount), Math.max(0, negCount), Math.max(0, posCount)],
                    subthemes: subthemes.length > 0 ? subthemes : undefined,
                    hasChildren: subthemes.length > 0,
                };
            }).sort((a, b) => Math.abs(parseFloat(b.score)) - Math.abs(parseFloat(a.score)));
        }

        // Fallback: just use top_issues flat
        if (topIssues.length > 0) {
            return topIssues.slice(0, 8).map(issue => ({
                name: issue.name,
                score: issue.share ? `${issue.share}%` : String(issue.count),
                bar: null,
            }));
        }

        return [];
    }, [results]);

    const [expandedRows, setExpandedRows] = useState({ 0: true });

    const toggleRow = (idx) => {
        setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    if (data.length === 0) {
        return (
            <SectionContainer title="THEMES" className="h-full">
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">No theme data available</div>
            </SectionContainer>
        );
    }

    return (
        <SectionContainer title="THEMES" className="h-full">
            <div className="w-full text-left flex-1 flex flex-col">
                <div className="flex border-b border-gray-100 pb-2 mb-2 px-2">
                    <div className="flex-1 text-[11px] font-semibold text-gray-500 uppercase flex items-center gap-1">
                        Themes <span className="flex flex-col text-[8px] leading-tight text-gray-300"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></span>
                    </div>
                    <div className="w-28 text-[11px] font-semibold text-gray-500 uppercase flex items-center justify-end gap-1">
                        Sentiment <span className="flex flex-col text-[8px] leading-tight text-gray-300"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></span>
                    </div>
                </div>

                <div className="w-full flex-1 overflow-y-auto pr-1">
                    {data.map((item, idx) => (
                        <div key={idx} className="border-b border-gray-50 last:border-0 pb-1 mb-1">
                            <div
                                className={`flex items-center py-2 px-2 rounded-md transition-colors ${item.subthemes || item.hasChildren ? 'cursor-pointer hover:bg-gray-50' : ''} ${expandedRows[idx] ? 'bg-gray-50/50' : ''}`}
                                onClick={() => (item.subthemes || item.hasChildren) && toggleRow(idx)}
                            >
                                <div className="flex-1 flex items-center gap-2 pr-2">
                                    {(item.subthemes || item.hasChildren) ? (
                                        expandedRows[idx] ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                    ) : (
                                        <div className="w-3.5" /> // Spacer
                                    )}
                                    <span className={`text-[13px] text-gray-700 leading-tight ${expandedRows[idx] ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>
                                </div>
                                <div className="flex-shrink-0 flex items-center justify-end gap-3 w-28">
                                    {item.bar && <SentimentBar scores={item.bar} />}
                                    <span className="text-xs font-semibold text-gray-500 w-6 text-right">{item.score}</span>
                                </div>
                            </div>

                            <AnimatePresence>
                                {item.subthemes && expandedRows[idx] && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden bg-white mt-1"
                                    >
                                        {item.subthemes.map((sub, sIdx) => (
                                            <div key={sIdx} className="flex items-center py-2.5 pl-9 pr-2 hover:bg-gray-50 transition-colors">
                                                <div className="flex-1 pr-2">
                                                    <span className="text-[12px] font-medium text-gray-600 leading-tight block">{sub.name}</span>
                                                </div>
                                                <div className="flex-shrink-0 flex items-center justify-end gap-3 w-28">
                                                    <SentimentBar scores={sub.bar} />
                                                    <span className="text-xs font-semibold text-gray-400 w-6 text-right">{sub.score}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </SectionContainer>
    );
};

// --- QUADRANT 2: SENTIMENT BREAKDOWN ---

const InsightSentimentWidget = ({ results }) => {
    const { overallScore, positivePct, neutralPct, negativePct } = useMemo(() => {
        const dist = results?.sentimentDistribution || {};
        const reviews = results?.reviews || [];

        // Calculate counts from distribution or from reviews
        let pos = dist.Positive || dist.positive || 0;
        let neg = dist.Negative || dist.negative || 0;
        let neu = dist.Neutral || dist.neutral || 0;

        // If distribution is empty, compute from reviews
        if (pos === 0 && neg === 0 && neu === 0 && reviews.length > 0) {
            reviews.forEach(r => {
                const s = r.sentiment?.toLowerCase?.() || '';
                if (s === 'positive') pos++;
                else if (s === 'negative') neg++;
                else neu++;
            });
        }

        const total = pos + neg + neu || 1;
        const pPct = Math.round((pos / total) * 100);
        const nPct = Math.round((neg / total) * 100);
        const nuPct = 100 - pPct - nPct;

        // Overall sentiment score: average sentiment_score from reviews, or derive from distribution
        let avgScore = 0;
        if (reviews.length > 0 && reviews[0]?.sentiment_score !== undefined) {
            const sum = reviews.reduce((s, r) => s + (r.sentiment_score || 0), 0);
            avgScore = (sum / reviews.length).toFixed(1);
        } else {
            // Derive: +1 per positive, -1 per negative, 0 per neutral → normalized
            avgScore = ((pos - neg) / total).toFixed(1);
        }

        return { overallScore: parseFloat(avgScore), positivePct: pPct, neutralPct: nuPct, negativePct: nPct };
    }, [results]);

    const isNegative = overallScore < 0;
    const scoreColor = isNegative ? 'text-rose-500' : overallScore > 0 ? 'text-emerald-500' : 'text-gray-500';

    return (
        <SectionContainer title="SENTIMENT" subtitle="Overall Sentiment score and breakdown" className="h-full">
            <div className="flex flex-col h-full">

                {/* Score Header */}
                <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[42px] font-bold tracking-tighter leading-none ${scoreColor}`}>
                        {overallScore > 0 ? '+' : ''}{overallScore}
                    </span>
                </div>

                <p className="text-xs font-semibold text-gray-600 mb-6">
                    Based on <span className="text-gray-900">{results?.totalReviews || results?.reviews?.length || 0}</span> reviews
                </p>

                {/* Breakdown Bars */}
                <div className="flex flex-col justify-end gap-5 flex-1">
                    {/* Positive */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2">
                            <Smile size={16} className="text-emerald-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-700">Positive</span>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full" style={{ width: `${positivePct}%` }}></div>
                        </div>
                        <span className="w-8 text-right text-[13px] font-bold text-gray-800">{positivePct}%</span>
                    </div>

                    {/* Neutral */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2">
                            <Minus size={16} className="text-amber-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-700">Neutral</span>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 bg-amber-400 rounded-full" style={{ width: `${neutralPct}%` }}></div>
                        </div>
                        <span className="w-8 text-right text-[13px] font-bold text-gray-800">{neutralPct}%</span>
                    </div>

                    {/* Negative */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2">
                            <Frown size={16} className="text-rose-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-700">Negative</span>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 bg-rose-500 rounded-full" style={{ width: `${negativePct}%` }}></div>
                        </div>
                        <span className="w-8 text-right text-[13px] font-bold text-gray-800">{negativePct}%</span>
                    </div>
                </div>
            </div>
        </SectionContainer>
    );
};

// --- QUADRANT 3: NPS IMPACT ---

const InsightNPSWidget = ({ results }) => {
    const nps = results?.nps ?? 0;
    const topTheme = useMemo(() => {
        const thematic = results?.thematic || {};
        const issues = thematic.top_issues || [];
        return issues.length > 0 ? issues[0].name : 'Overall';
    }, [results]);

    // NPS ranges from -100 to +100; calculate fill for the bar
    const fillPercentage = Math.min(Math.abs(nps), 100);
    const isNegative = nps < 0;

    return (
        <SectionContainer title="NPS IMPACT" subtitle={`Overall impact of ${topTheme} on NPS Score`} className="h-full">
            <div className="flex flex-col h-full justify-between mt-6">

                {/* Score Display */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <span className={`text-6xl font-bold tracking-tighter leading-none ${isNegative ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {nps > 0 ? '+' : ''}{nps}
                    </span>
                </div>

                {/* Zero-Centered Bar Graph */}
                <div className="mt-auto px-1 w-full max-w-[280px] mx-auto">
                    {/* Axis Labels */}
                    <div className="flex justify-between text-[10px] font-bold mb-2">
                        <span className="text-rose-500">-100</span>
                        <span className="text-rose-400">-50</span>
                        <span className="text-gray-400">0</span>
                        <span className="text-emerald-400">+50</span>
                        <span className="text-emerald-500">+100</span>
                    </div>

                    {/* Background Track */}
                    <div className="relative h-4 w-full rounded-sm flex">
                        {/* Left side (Negative) */}
                        <div className="w-1/2 h-full bg-[#fae8e8] rounded-l-sm relative">
                            {isNegative && (
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${fillPercentage}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className="absolute right-0 top-0 bottom-0 bg-rose-500 rounded-l-sm"
                                />
                            )}
                            <div className="absolute right-0 top-[-4px] bottom-[-4px] w-px bg-rose-300"></div>
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/50"></div>
                        </div>

                        {/* Right side (Positive) */}
                        <div className="w-1/2 h-full bg-[#e8f5ec] rounded-r-sm relative border-l-2 border-white">
                            {!isNegative && nps > 0 && (
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${fillPercentage}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-r-sm"
                                />
                            )}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/50"></div>
                            <div className="absolute left-0 top-[-4px] bottom-[-4px] w-px bg-emerald-300"></div>
                        </div>
                    </div>
                </div>
            </div>
        </SectionContainer>
    );
};

// --- QUADRANT 4: KEY DRIVERS ---

const DriverPill = ({ name, count, type }) => {
    const isPositive = type === 'positive';
    return (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${isPositive ? 'bg-[#eefcf2]' : 'bg-[#fff1f2]'} w-full`}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {isPositive ? <Smile size={18} className="text-emerald-500 flex-shrink-0" /> : <Frown size={18} className="text-rose-400 flex-shrink-0" />}
                <span className={`text-[13px] font-medium truncate ${isPositive ? 'text-emerald-800' : 'text-gray-700'}`}>{name}</span>
            </div>
            <span className={`text-[13px] font-bold ml-2 flex-shrink-0 ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>{count}</span>
        </div>
    );
};

const InsightDriversWidget = ({ results }) => {
    const { positiveDrivers, negativeDrivers } = useMemo(() => {
        const reviews = results?.reviews || [];
        const thematic = results?.thematic || {};

        // Derive positive drivers: issues from high-sentiment reviews
        const posIssueMap = {};
        const negIssueMap = {};

        reviews.forEach(r => {
            const issue = r.issue || r.root_cause;
            if (!issue || ['N/A', 'None', '', 'null', 'n/a', 'none'].includes(issue)) return;

            const score = r.sentiment_score ?? 0;
            const sentiment = r.sentiment?.toLowerCase?.() || '';

            if (sentiment === 'positive' || score > 0.3) {
                posIssueMap[issue] = (posIssueMap[issue] || 0) + 1;
            } else if (sentiment === 'negative' || score < -0.3) {
                negIssueMap[issue] = (negIssueMap[issue] || 0) + 1;
            }
        });

        let posDrv = Object.entries(posIssueMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count]) => ({ name, count }));

        let negDrv = Object.entries(negIssueMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count]) => ({ name, count }));

        // Fallback: use thematic top_issues for negative, top_features for positive
        if (negDrv.length === 0 && thematic.top_issues?.length > 0) {
            negDrv = thematic.top_issues.slice(0, 4).map(i => ({ name: i.name, count: i.count }));
        }
        if (posDrv.length === 0 && thematic.top_features?.length > 0) {
            posDrv = thematic.top_features.slice(0, 4).map(f => ({ name: f.name, count: f.count }));
        }

        return { positiveDrivers: posDrv, negativeDrivers: negDrv };
    }, [results]);

    if (positiveDrivers.length === 0 && negativeDrivers.length === 0) {
        return (
            <SectionContainer title="KEY DRIVERS" className="h-full">
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">No driver data available</div>
            </SectionContainer>
        );
    }

    return (
        <SectionContainer title="KEY DRIVERS" className="h-full">
            <div className="grid grid-cols-2 gap-8 mt-4 h-full">

                {/* Positive Drivers Column */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Smile size={20} className="text-gray-700" />
                        <span className="text-sm font-semibold text-gray-700">Key Positive Drivers</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                        {positiveDrivers.length > 0 ? positiveDrivers.map((d, i) => (
                            <DriverPill key={i} name={d.name} count={d.count} type="positive" />
                        )) : (
                            <p className="text-xs text-gray-400 italic">None detected</p>
                        )}
                    </div>
                </div>

                {/* Negative Drivers Column */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Frown size={20} className="text-gray-700" />
                        <span className="text-sm font-semibold text-gray-700">Key Negative Drivers</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                        {negativeDrivers.length > 0 ? negativeDrivers.map((d, i) => (
                            <DriverPill key={i} name={d.name} count={d.count} type="negative" />
                        )) : (
                            <p className="text-xs text-gray-400 italic">None detected</p>
                        )}
                    </div>
                </div>

            </div>
        </SectionContainer>
    );
};

// --- MAIN WRAPPER ---

const InsightsDeepDiveTab = ({ results }) => {
    return (
        <div className="flex flex-col gap-4 w-full h-full max-w-[1000px] mx-auto">
            {/* Top Row: Themes (w-2/3) + Sentiment (w-1/3) */}
            <div className="flex flex-col md:flex-row gap-4 h-[320px]">
                <div className="flex-1">
                    <InsightThemesWidget results={results} />
                </div>
                <div className="w-full md:w-[320px] flex-shrink-0">
                    <InsightSentimentWidget results={results} />
                </div>
            </div>

            {/* Bottom Row: NPS (w-1/3) + Drivers (w-2/3) */}
            <div className="flex flex-col md:flex-row gap-4 h-[320px]">
                <div className="w-full md:w-[320px] flex-shrink-0">
                    <InsightNPSWidget results={results} />
                </div>
                <div className="flex-1">
                    <InsightDriversWidget results={results} />
                </div>
            </div>
        </div>
    );
};

export default InsightsDeepDiveTab;
