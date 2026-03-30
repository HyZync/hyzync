import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Smile, Frown, TrendingUp, TrendingDown, Minus, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InteractiveThemesImpactWidget from './InteractiveThemesImpactWidget';

// --- Shared Sub-Components ---

const SentimentBar = ({ scores = [0, 0, 0] }) => {
    const total = (scores || []).reduce((sum, val) => sum + (val || 0), 0) || 1;
    const [amber = 0, rose = 0, emerald = 0] = scores || [];

    const amberPct = (amber / total) * 100;
    const rosePct = (rose / total) * 100;
    const emeraldPct = (emerald / total) * 100;

    return (
        <div className="flex w-16 md:w-20 h-2 rounded-sm overflow-hidden bg-gray-100 gap-[1px]">
            {amberPct > 0 && <div style={{ width: `${amberPct}%` }} className="bg-amber-400" />}
            {rosePct > 0 && <div style={{ width: `${rosePct}%` }} className="bg-rose-500" />}
            {emeraldPct > 0 && <div style={{ width: `${emeraldPct}%` }} className="bg-emerald-500" />}
        </div>
    );
};

const SectionContainer = ({ title, children, className = "" }) => (
    <div className={`bg-white rounded-lg border border-slate-200 p-6 shadow-sm ${className}`}>
        {title && (
            <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest mb-4">
                {title}
            </h3>
        )}
        {children}
    </div>
);

// --- Individual Widgets ---

const SeverityBadge = ({ level }) => {
    const colors = {
        5: 'bg-rose-100 text-rose-700 border-rose-200',
        4: 'bg-orange-100 text-orange-700 border-orange-200',
        3: 'bg-amber-100 text-amber-700 border-amber-200',
        2: 'bg-blue-100 text-blue-700 border-blue-200',
        1: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    };
    return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${colors[level] || colors[2]}`}>L{level}</span>;
}

const ThemesWidget = ({ results }) => {
    const data = useMemo(() => {
        const hierarchy = results?.thematic?.theme_hierarchy || {};
        const categories = Object.keys(hierarchy);
        if (categories.length === 0) return [];

        return categories.map(macro => {
            const subIssues = hierarchy[macro] || [];

            // Aggregate totals for the macro row
            const totalMentions = subIssues.reduce((sum, sub) => sum + (sub?.mentions || 0), 0);
            const avgSentiment = totalMentions > 0
                ? subIssues.reduce((sum, sub) => sum + ((sub?.avg_sentiment || 0) * (sub?.mentions || 0)), 0) / totalMentions
                : 0.0;

            // Map sub-issues for expandable rows
            const mappedSubs = subIssues.map(sub => ({
                name: sub.label,
                mentions: sub.mentions,
                sentiment: parseFloat(sub.avg_sentiment).toFixed(2),
                impact: parseFloat(sub.impact_score).toFixed(2),
                confidence: Math.round((sub.confidence || 0) * 100),
                severity: sub.severity || 2
            }));

            // Basic sentiment bar approximation (macro level)
            const posCount = subIssues.filter(s => s.avg_sentiment > 0.3).reduce((acc, s) => acc + s.mentions, 0);
            const negCount = subIssues.filter(s => s.avg_sentiment < -0.3).reduce((acc, s) => acc + s.mentions, 0);
            const neuCount = Math.max(0, totalMentions - posCount - negCount);

            return {
                name: macro,
                score: parseFloat(avgSentiment).toFixed(2),
                bar: [neuCount, negCount, posCount],
                subthemes: mappedSubs.length > 0 ? mappedSubs : undefined,
            };
        }).sort((a, b) => Math.abs(parseFloat(b.score)) - Math.abs(parseFloat(a.score)));
    }, [results]);

    const [expandedRows, setExpandedRows] = useState({ 0: true });

    const toggleRow = (idx) => {
        setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    if (data.length === 0) {
        return (
            <SectionContainer title="THEMES">
                <div className="flex items-center justify-center p-6 text-sm text-gray-400">No theme data available</div>
            </SectionContainer>
        );
    }

    return (
        <SectionContainer title="THEMES">
            <div className="w-full text-left">
                <div className="flex border-b border-gray-100 pb-2 mb-2 px-2">
                    <div className="flex-1 text-[11px] font-semibold text-gray-500 uppercase flex items-center gap-1 cursor-pointer">
                        Themes <span className="flex flex-col text-[8px] leading-tight text-gray-300"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></span>
                    </div>
                    <div className="flex-shrink-0 w-80 text-[11px] font-semibold text-gray-500 uppercase flex items-center justify-end gap-1 cursor-pointer">
                        Details (Impact / Conf / Sev)
                    </div>
                </div>

                <div className="w-full">
                    {data.map((item, idx) => (
                        <div key={idx} className="border-b border-gray-50 last:border-0 pb-1 mb-1">
                            <div
                                className={`flex items-center py-2 px-2 hover:bg-gray-50 rounded-md transition-colors ${item.subthemes ? 'cursor-pointer' : ''}`}
                                onClick={() => item.subthemes && toggleRow(idx)}
                            >
                                <div className="flex-1 flex items-center gap-2 pr-2">
                                    {item.subthemes ? (
                                        expandedRows[idx] ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                    ) : (
                                        <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                    )}
                                    <span className="text-[13px] font-medium text-gray-700 leading-tight">{item.name}</span>
                                </div>
                                <div className="flex-shrink-0 flex items-center justify-end gap-2.5 w-64">
                                    {item.bar && <SentimentBar scores={item.bar} />}
                                    <span className="text-xs font-semibold text-gray-500 w-8 text-right">{item.score}</span>
                                </div>
                            </div>

                            <AnimatePresence>
                                {item.subthemes && expandedRows[idx] && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden bg-gray-50/50 rounded-md mt-1"
                                    >
                                        {item.subthemes.map((sub, sIdx) => (
                                            <div key={sIdx} className="flex items-center py-2 pl-9 pr-2 border-b border-gray-100/50 last:border-0">
                                                <div className="flex-1 pr-2">
                                                    <span className="text-[13px] font-medium text-gray-600 leading-tight block">{sub.name}</span>
                                                </div>
                                                <div className="flex-shrink-0 flex items-center justify-end gap-2 w-80">
                                                    <span className="text-[10px] text-gray-400">Impact: </span>
                                                    <span className="text-[11px] font-bold text-gray-700 w-8">{sub.impact}</span>

                                                    <span className="text-[10px] text-gray-400 ml-2">Conf: </span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sub.confidence >= 80 ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'} w-9 text-center`}>
                                                        {sub.confidence}%
                                                    </span>

                                                    <div className="ml-2 w-8 flex justify-end">
                                                        <SeverityBadge level={sub.severity} />
                                                    </div>
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

const AgentsWidget = ({ results }) => {
    const agents = results?.agents || [];

    return (
        <SectionContainer title="AGENTS">
            <p className="text-xs text-gray-500 mb-4 pr-10">
                Agent performance based on review mentions
            </p>
            {agents.length === 0 ? (
                <div className="flex items-center justify-center p-6 text-sm text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                    No agent data available for this analysis.
                </div>
            ) : (
                <div className="w-full text-left">
                    <div className="flex border-b border-gray-100 pb-2 mb-2 px-2">
                        <div className="flex-1 text-[11px] font-semibold text-gray-500 uppercase flex items-center gap-1">
                            Agent <span className="flex flex-col text-[8px] leading-tight text-gray-300"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></span>
                        </div>
                        <div className="flex-shrink-0 w-24 text-[11px] font-semibold text-gray-500 uppercase flex items-center justify-end gap-1">
                            Sentiment <span className="flex flex-col text-[8px] leading-tight text-gray-300"><ChevronRight className="rotate-[-90deg] -mb-1" size={10} /><ChevronRight className="rotate-90" size={10} /></span>
                        </div>
                    </div>

                    <div className="w-full">
                        {agents.map((agent, idx) => (
                            <div key={idx} className="flex items-center py-2.5 px-2 hover:bg-gray-50 rounded-md border-b border-gray-50 last:border-0">
                                <div className="flex-1 pr-2">
                                    <span className="text-[13px] font-medium text-gray-700 leading-tight block">{agent.name}</span>
                                </div>
                                <div className="flex-shrink-0 flex justify-end">
                                    <SentimentBar scores={agent.bar || [33, 33, 34]} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </SectionContainer>
    );
};

const KPICard = ({ title, score, change, changeIndicator = 'up', color = 'red' }) => {
    const scoreColorClass = color === 'red' ? 'text-rose-500' : 'text-emerald-500';

    return (
        <SectionContainer className="flex flex-col justify-center items-center text-center p-3 md:p-4">
            <h4 className="text-[10px] md:text-[11px] font-bold text-gray-700 tracking-wider uppercase mb-2">
                {title}
            </h4>
            <div className="flex flex-col xl:flex-row items-center gap-1 xl:gap-2">
                <span className={`text-3xl xl:text-[34px] leading-none font-bold ${scoreColorClass}`}>
                    {score}
                </span>
                {change !== undefined && (
                    <div className="flex items-center text-[10px] xl:text-[11px] font-semibold text-gray-500 bg-gray-50/50 px-1.5 py-0.5 rounded-full border border-gray-100">
                        {change}
                        {changeIndicator === 'up' && <TrendingUp size={10} className="ml-0.5" />}
                        {changeIndicator === 'down' && <TrendingDown size={10} className="ml-0.5" />}
                    </div>
                )}
            </div>
        </SectionContainer>
    );
}

const KeyDriversWidget = ({ results }) => {
    const { positiveDrivers, negativeDrivers } = useMemo(() => {
        const reviews = results?.reviews || [];
        const thematic = results?.thematic || {};

        const posIssueMap = {};
        const negIssueMap = {};

        reviews.forEach(r => {
            const issue = r.issue || r.root_cause;
            if (!issue || ['N/A', 'None', '', 'null', 'n/a', 'none'].includes(issue)) return;

            const score = r.sentiment_score ?? 0;
            const sentiment = (r.sentiment || '').toLowerCase();

            if (sentiment === 'positive' || score > 0.3) {
                posIssueMap[issue] = (posIssueMap[issue] || 0) + 1;
            } else if (sentiment === 'negative' || score < -0.3) {
                negIssueMap[issue] = (negIssueMap[issue] || 0) + 1;
            }
        });

        let pos = Object.entries(posIssueMap).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, count }));
        let neg = Object.entries(negIssueMap).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, count }));

        if (neg.length === 0 && thematic.top_issues?.length > 0) {
            neg = thematic.top_issues.slice(0, 4).map(i => ({ name: i.name, count: i.count }));
        }
        if (pos.length === 0 && thematic.top_features?.length > 0) {
            pos = thematic.top_features.slice(0, 4).map(f => ({ name: f.name, count: f.count }));
        }

        const fixNow = results?.fixNowPriorities || [];
        const enrich = (driver) => {
            const match = fixNow.find(f => f.issue === driver.name);
            if (match) {
                driver.is_trending = match.is_trending;
                driver.avg_churn = match.avg_churn_probability;
            }
            return driver;
        };

        return { positiveDrivers: pos.map(enrich), negativeDrivers: neg.map(enrich) };
    }, [results]);

    return (
        <SectionContainer title="KEY DRIVERS" className="h-full flex flex-col">
            <div className="flex flex-col lg:flex-row gap-6 flex-1">
                {/* Positive Drivers Column */}
                <div className="flex-1 border-r-0 lg:border-r border-dashed border-gray-200 pr-0 lg:pr-4">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Smile size={16} className="text-gray-500" />
                        <h4 className="text-xs font-semibold text-gray-700">Key Positive Drivers</h4>
                    </div>
                    <div className="flex flex-row flex-wrap gap-2">
                        {positiveDrivers.length > 0 ? positiveDrivers.map((driver, idx) => (
                            <div key={idx} className="flex items-center bg-[#f0fdf4] border border-[#dcfce7] rounded-md px-2 py-1 flex-shrink-0">
                                <Smile size={12} className="text-emerald-600 mr-1.5" />
                                <span className="text-[11px] font-medium text-gray-700 mr-1.5 whitespace-nowrap">{driver.name}</span>
                                <span className="text-[11px] font-bold text-emerald-700">{driver.count}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-gray-400 italic">None detected</p>
                        )}
                    </div>
                </div>

                {/* Negative Drivers Column */}
                <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Frown size={16} className="text-gray-500" />
                        <h4 className="text-xs font-semibold text-gray-700">Key Negative Drivers</h4>
                    </div>
                    <div className="flex flex-row flex-wrap gap-2">
                        {negativeDrivers.length > 0 ? negativeDrivers.map((driver, idx) => (
                            <div key={idx} className="flex items-center bg-[#fff1f2] border border-[#ffe4e6] rounded-md px-2 py-1 flex-shrink-0 gap-1.5">
                                <Frown size={12} className="text-rose-500 flex-shrink-0" />
                                <span className="text-[11px] font-medium text-gray-700 whitespace-nowrap">{driver.name}</span>
                                <span className="text-[11px] font-bold text-rose-600 bg-white/50 px-1 rounded">{driver.count}</span>
                                {driver.is_trending && <TrendingUp size={12} className="text-rose-600 ml-1" title="Trending Up" />}
                                {driver.avg_churn > 0 && <span className="text-[9px] font-bold text-rose-700 bg-rose-200/50 px-1 py-0.5 rounded ml-1">{(driver.avg_churn * 100).toFixed(0)}% churn</span>}
                            </div>
                        )) : (
                            <p className="text-xs text-gray-400 italic">None detected</p>
                        )}
                    </div>
                </div>
            </div>
        </SectionContainer>
    );
};

const RecommendationsWidget = ({ results }) => {
    const recs = results?.recommendations || [];
    if (recs.length === 0) return null;

    return (
        <SectionContainer title="ACTION PLAN">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recs.map((rec, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-5 border border-slate-200 flex flex-col h-full relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Priority {rec.priority_rank}</div>
                            {rec.confidence >= 0.8 && <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1"><ShieldAlert size={10} /> High Confidence</div>}
                        </div>

                        <h4 className="text-[14px] font-bold text-gray-800 mb-2 leading-tight pr-2">{rec.directive}</h4>
                        <p className="text-xs text-gray-600 mb-4 flex-1">{rec.rationale}</p>

                        <div className="flex items-center gap-2 pt-3 border-t border-gray-200/60 mt-auto">
                            <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center">
                                <TrendingUp size={12} className="mr-1" /> {rec.expected_nps_lift}
                            </div>
                            {rec.revenue_protected > 0 && (
                                <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center justify-end">
                                    ${(rec.revenue_protected || 0).toLocaleString()} protected
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </SectionContainer>
    );
};

const ExecutiveOperationsDashboard = ({ results }) => {
    // Compute real KPIs from results
    const nps = results?.nps ?? 0;
    const csat = results?.csat ?? 0;

    let sentimentVal = 0;
    if (results?.sentimentDistribution) {
        const dist = results.sentimentDistribution;
        const pos = dist.Positive || dist.positive || 0;
        const neg = dist.Negative || dist.negative || 0;
        const neu = dist.Neutral || dist.neutral || 0;
        const total = pos + neu + neg;
        if (total > 0) sentimentVal = parseFloat(((pos - neg) / total).toFixed(2));
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full h-full">
            {/* ROW 1: KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 xl:gap-5">
                <KPICard
                    title="CSAT"
                    score={`${csat}%`}
                    color={csat >= 50 ? 'green' : 'red'}
                />
                <KPICard
                    title="NPS"
                    score={String(nps)}
                    color={nps >= 0 ? 'green' : 'red'}
                />
                <KPICard
                    title="SENTIMENT"
                    score={String(sentimentVal)}
                    color={sentimentVal >= 0 ? 'green' : 'red'}
                />
            </div>

            {/* ROW 2: Key Drivers & Agents */}
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full">
                <div className="flex-1 min-w-0">
                    <KeyDriversWidget results={results} />
                </div>
                <div className="w-full lg:w-[350px] xl:w-[400px] flex-shrink-0">
                    <AgentsWidget results={results} />
                </div>
            </div>

            {/* ROW 3: Themes */}
            <div className="w-full">
                <ThemesWidget results={results} />
            </div>

            {/* ROW 4: Action Plan */}
            <div className="w-full">
                <RecommendationsWidget results={results} />
            </div>
        </div>
    );
};

export default ExecutiveOperationsDashboard;
