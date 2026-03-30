import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import {
    Activity, TrendingUp, TrendingDown, BarChart2, Heart,
    AlertTriangle, Zap, Target, ChevronRight, ArrowUpRight, ArrowDownRight,
    Layers, Cpu, Shield
} from 'lucide-react';

const API_BASE = '';

// Safely render any value
const safeText = (val, fallback = '—') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.name) return String(val.name);
        if (val.issue) return String(val.issue);
        const vals = Object.values(val).filter(v => typeof v === 'string' || typeof v === 'number');
        if (vals.length > 0) return vals.join(' — ');
        return JSON.stringify(val);
    }
    return String(val);
};

// ── KPI Metric Card ─────────────────────────────────────────────
const MetricCard = ({ label, value, subtitle, icon: Icon, color = 'indigo', trend }) => {
    const colorMap = {
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', ring: 'shadow-indigo-100' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', ring: 'shadow-emerald-100' },
        rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', ring: 'shadow-rose-100' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', ring: 'shadow-amber-100' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100', ring: 'shadow-violet-100' },
        cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100', ring: 'shadow-cyan-100' },
    };
    const c = colorMap[color] || colorMap.indigo;

    return (
        <div className={`bg-white p-6 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group hover:${c.border} transition-all duration-300`}>
            <div className={`absolute top-0 right-0 w-20 h-20 ${c.bg} rounded-bl-3xl -mr-10 -mt-10 transition-transform group-hover:scale-125`}></div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
                    <div className={`p-2 ${c.bg} rounded-xl ${c.border} border shadow-sm ${c.ring}`}>
                        <Icon className={`w-4 h-4 ${c.text}`} />
                    </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
                {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(trend).toFixed(1)}% vs prev. period
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Sentiment Bar ────────────────────────────────────────────────
const SentimentBar = ({ positive, neutral, negative }) => {
    const total = positive + neutral + negative;
    if (total === 0) return null;
    const pPct = ((positive / total) * 100).toFixed(1);
    const nPct = ((neutral / total) * 100).toFixed(1);
    const negPct = ((negative / total) * 100).toFixed(1);
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Sentiment Distribution</span>
                <span>{total} signals</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 border border-slate-200">
                <div className="bg-emerald-500 transition-all duration-700 rounded-l-full" style={{ width: `${pPct}%` }} title={`Positive: ${pPct}%`} />
                <div className="bg-slate-300 transition-all duration-700" style={{ width: `${nPct}%` }} title={`Neutral: ${nPct}%`} />
                <div className="bg-rose-500 transition-all duration-700 rounded-r-full" style={{ width: `${negPct}%` }} title={`Negative: ${negPct}%`} />
            </div>
            <div className="flex items-center gap-6 text-xs font-medium">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> <span className="text-slate-600">Positive {pPct}%</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-300" /> <span className="text-slate-600">Neutral {nPct}%</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> <span className="text-slate-600">Negative {negPct}%</span></div>
            </div>
        </div>
    );
};

// ── Theme Card ───────────────────────────────────────────────────
const ThemeCard = ({ name, mentions, sentiment, pct, type = 'weakness' }) => {
    const isStrength = type === 'strength';
    return (
        <div className={`p-4 rounded-2xl border transition-all hover:shadow-md ${
            isStrength 
                ? 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-200' 
                : 'bg-rose-50/30 border-rose-100 hover:border-rose-200'
        }`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900 truncate flex-1 mr-2">{safeText(name)}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                    isStrength ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                    {isStrength ? 'Strength' : 'Issue'}
                </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                <span>{mentions} mentions</span>
                <span>•</span>
                <span>{pct}% of signals</span>
                <span>•</span>
                <span className={sentiment > 0 ? 'text-emerald-600' : sentiment < 0 ? 'text-rose-600' : 'text-slate-500'}>
                    {sentiment > 0 ? '+' : ''}{sentiment?.toFixed(2)} avg
                </span>
            </div>
        </div>
    );
};

// ── Trend Item ───────────────────────────────────────────────────
const TrendItem = ({ item, type = 'improving' }) => {
    const isImproving = type === 'improving';
    return (
        <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isImproving ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                    {isImproving ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </div>
                <span className="text-sm font-semibold text-slate-900">{safeText(item.name)}</span>
            </div>
            <span className={`text-sm font-bold ${isImproving ? 'text-emerald-600' : 'text-rose-600'}`}>
                {item.change > 0 ? '+' : ''}{item.change}%
            </span>
        </div>
    );
};


// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
const FeedbackIntelligence = ({ results = null, userId = 1 }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (results) {
            // Build data from the analysis results object directly
            const analytics = results.analytics || results;
            const healthMetrics = analytics.healthMetrics || {};
            const categorized = analytics.categorizedMetrics || {};
            const trends = analytics.sentimentTrends || { improving: [], worsening: [] };

            setData({
                health: {
                    nps: healthMetrics.nps_score ?? analytics.npsScore ?? 0,
                    csat: healthMetrics.csat_score ?? analytics.csatScore ?? 0,
                    ces: healthMetrics.ces_score ?? analytics.cesScore ?? 0,
                    health_score: healthMetrics.health_score ?? 0,
                    retention_risk: healthMetrics.retention_risk_pct ?? analytics.retentionRiskPct ?? 0,
                    total_reviews: healthMetrics.total_reviews ?? analytics.totalReviews ?? results.totalReviews ?? 0,
                },
                sentiment: {
                    positive: analytics.totalPositive ?? results.totalPositive ?? 0,
                    neutral: analytics.totalNeutral ?? results.totalNeutral ?? 0,
                    negative: analytics.totalNegative ?? results.totalNegative ?? 0,
                },
                themes: {
                    important_strengths: categorized?.important_strengths || [],
                    important_weaknesses: categorized?.important_weaknesses || [],
                    unimportant_strengths: categorized?.unimportant_strengths || [],
                    unimportant_weaknesses: categorized?.unimportant_weaknesses || [],
                },
                trends,
                fixNow: analytics?.fixNowPriorities || results?.fixNowPriorities || [],
            });
            setLoading(false);
            return;
        }

        // Fallback: fetch from API
        const fetchData = async () => {
            try {
                const res = await apiFetch(`${API_BASE}/api/analytics/intelligence?user_id=${userId}`);
                if (!res.ok) throw new Error('Failed to fetch intelligence data');
                const result = await res.json();
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [results, userId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
                <div className="w-16 h-16 border-2 border-indigo-100 rounded-full" />
                <div className="w-16 h-16 border-2 border-t-indigo-600 rounded-full absolute inset-0 animate-spin" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Synthesizing Intelligence...</p>
        </div>
    );

    if (error) return (
        <div className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-rose-300 mx-auto mb-4" />
            <p className="text-rose-500 font-medium">{error}</p>
        </div>
    );

    if (!data) return (
        <div className="p-12 text-center">
            <Cpu className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No intelligence data available. Run an analysis to populate this view.</p>
        </div>
    );

    const { health, sentiment, themes, trends, fixNow } = data;
    const allThemes = [
        ...(themes.important_weaknesses || []).map(t => ({ ...t, type: 'weakness' })),
        ...(themes.important_strengths || []).map(t => ({ ...t, type: 'strength' })),
        ...(themes.unimportant_weaknesses || []).map(t => ({ ...t, type: 'weakness' })),
        ...(themes.unimportant_strengths || []).map(t => ({ ...t, type: 'strength' })),
    ].sort((a, b) => (b.mentions || 0) - (a.mentions || 0));

    return (
        <div className="space-y-8">
            {/* ── Section 1: Health Pulse KPIs ──────────────────────────── */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <Heart size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Health Pulse</h2>
                        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Real-time experience metrics</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <MetricCard label="Health Score" value={health.health_score || 0} icon={Activity} color="indigo" subtitle="Composite index" />
                    <MetricCard label="NPS" value={health.nps} icon={TrendingUp} color={health.nps > 0 ? 'emerald' : 'rose'} subtitle={health.nps > 50 ? 'Strong' : health.nps < 0 ? 'Critical' : 'Moderate'} />
                    <MetricCard label="CSAT" value={`${health.csat}%`} icon={Target} color={health.csat > 70 ? 'emerald' : 'amber'} subtitle="Satisfaction rate" />
                    <MetricCard label="CES" value={health.ces} icon={Layers} color="violet" subtitle="Effort score (1-5)" />
                    <MetricCard label="Churn Risk" value={`${health.retention_risk}%`} icon={AlertTriangle} color={health.retention_risk > 10 ? 'rose' : 'emerald'} subtitle="High-risk signals" />
                    <MetricCard label="Signals" value={health.total_reviews?.toLocaleString() || '0'} icon={BarChart2} color="cyan" subtitle="Total analyzed" />
                </div>
            </div>

            {/* ── Section 2: Sentiment Overview ────────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <SentimentBar
                    positive={sentiment.positive}
                    neutral={sentiment.neutral}
                    negative={sentiment.negative}
                />
            </div>

            {/* ── Section 3: Thematic Landscape ────────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-violet-50 flex items-center justify-center">
                            <Zap size={16} className="text-violet-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Thematic Landscape</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {allThemes.length} themes identified
                    </span>
                </div>
                {allThemes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {allThemes.slice(0, 10).map((theme, idx) => (
                            <ThemeCard
                                key={idx}
                                name={theme.category || theme.name}
                                mentions={theme.mentions || theme.count || 0}
                                sentiment={theme.sentiment || theme.avg_sentiment || 0}
                                pct={theme.pct || 0}
                                type={theme.type}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-slate-400 py-8 font-medium">No thematic data available for this analysis.</p>
                )}
            </div>

            {/* ── Section 4: Sentiment Trends ──────────────────────────── */}
            {trends && (trends.improving?.length > 0 || trends.worsening?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Improving */}
                    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center">
                                <TrendingUp size={14} className="text-emerald-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900">Improving Themes</h4>
                        </div>
                        {(trends.improving || []).length > 0 ? (
                            <div className="space-y-0">
                                {trends.improving.slice(0, 5).map((item, idx) => (
                                    <TrendItem key={idx} item={item} type="improving" />
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm text-center py-6">No improving themes detected</p>
                        )}
                    </div>

                    {/* Worsening */}
                    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-md bg-rose-50 flex items-center justify-center">
                                <TrendingDown size={14} className="text-rose-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900">Worsening Themes</h4>
                        </div>
                        {(trends.worsening || []).length > 0 ? (
                            <div className="space-y-0">
                                {trends.worsening.slice(0, 5).map((item, idx) => (
                                    <TrendItem key={idx} item={item} type="worsening" />
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm text-center py-6">No worsening themes detected</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Section 5: Fix-Now Priorities ────────────────────────── */}
            {fixNow && fixNow.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-rose-50 flex items-center justify-center">
                                <AlertTriangle size={16} className="text-rose-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Fix-Now Priorities</h3>
                        </div>
                        <span className="text-[10px] font-black px-3 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100 uppercase tracking-widest">
                            {fixNow.length} critical
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 border-b border-slate-200">
                                <tr>
                                    <th className="px-8 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">#</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Issue</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Category</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Volume</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Churn %</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase text-[10px] tracking-widest">Sentiment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fixNow.slice(0, 8).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-all">
                                        <td className="px-8 py-4 text-slate-400 font-bold">{item.priority_rank || idx + 1}</td>
                                        <td className="px-4 py-4 text-slate-900 font-bold max-w-[200px] truncate">{safeText(item.issue)}</td>
                                        <td className="px-4 py-4">
                                            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-lg uppercase tracking-wider">
                                                {safeText(item.category || item.pain_point_category, 'Other')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-slate-700 font-mono font-bold">{item.volume || 0}</td>
                                        <td className="px-4 py-4">
                                            <span className={`font-bold ${(item.high_churn_pct || 0) > 30 ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {(item.high_churn_pct || 0).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`font-mono font-bold ${(item.avg_sentiment || 0) < -0.3 ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {(item.avg_sentiment || 0).toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Footer ──────────────────────────────────────────────── */}
            <div className="text-center py-4">
                <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.3em]">
                    Feedback Intelligence • Powered by Horizon Cortex
                </p>
            </div>
        </div>
    );
};

export default FeedbackIntelligence;
