import { apiFetch } from '../../utils/api';
import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, AlertTriangle, ArrowRight, Activity, BarChart2 } from 'lucide-react';

const safeText = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.name) return String(val.name);
        if (val.issue) return String(val.issue);
        if (val.text) return String(val.text);
        if (val.title) return String(val.title);
        if (val.topic) return String(val.topic);
        if (val.content) return String(val.content);
        const vals = Object.values(val).filter(v => typeof v === 'string' || typeof v === 'number');
        if (vals.length > 0) return vals.join(' — ');
        return JSON.stringify(val);
    }
    return String(val);
};

const RevenueRisk = ({ userId = 1, results = null }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(!results);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (results) {
            setData(results.financial || results);
            setLoading(false);
            return;
        }
        const fetchData = async () => {
            try {
                const response = await apiFetch(`/api/analytics/financial?user_id=${userId}`);
                if (!response.ok) throw new Error('Failed to fetch financial data');
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId, results]);

    if (loading) return <div className="p-8 text-center text-slate-500 italic">Calculating Economic Impact...</div>;
    if (error) return <div className="p-8 text-center text-rose-500">Error loading financial data: {error}</div>;
    if (!data || (!data.revenue_risk && !data.revenueAtRisk)) return <div className="p-8 text-center text-slate-400 font-medium">No financial data available. Run analysis to generate projection.</div>;

    // Support both old and new schema
    const revenue_risk = data.revenue_risk || { 
        nominal_churn_revenue: data.revenueAtRisk || 0,
        affected_users: { high: 0 } 
    };
    const roi_report = data.roi_report || {
        summary: { top_3_recovery_potential: 0, critical_issue_count: 0 },
        full_ranking: []
    };

    return (
        <div className="space-y-6">
            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-200 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-3xl -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nominal Churn Value</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                ${revenue_risk.nominal_churn_revenue?.toLocaleString() || "0"}
                            </h3>
                        </div>
                        <div className="p-2.5 bg-rose-50 rounded-lg shadow-sm border border-rose-100">
                            <DollarSign className="w-5 h-5 text-rose-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-3xl -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Recovery Potential</p>
                            <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                                ${roi_report?.summary?.top_3_recovery_potential?.toLocaleString() || '0'}
                            </h3>
                        </div>
                        <div className="p-2.5 bg-emerald-50 rounded-lg shadow-sm border border-emerald-100">
                            <Activity className="w-5 h-5 text-emerald-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-3xl -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Critical Issues</p>
                            <h3 className="text-2xl font-bold text-amber-600 mt-1">
                                {roi_report?.summary?.critical_issue_count || (results?.fixNowPriorities?.length || 0)}
                            </h3>
                        </div>
                        <div className="p-2.5 bg-amber-50 rounded-lg shadow-sm border border-amber-100">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategic Priorities Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                        <BarChart2 className="w-5 h-5 mr-3 text-indigo-600" />
                        ROI-Prioritized Action Plan
                    </h3>
                    <span className="text-[10px] font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 uppercase tracking-wider">
                        Intelligence Insight
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-200">
                            <tr>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Issue Category</th>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">ROI Score</th>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Revenue Impact</th>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Fix Effort</th>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Priority</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(roi_report?.full_ranking?.length > 0 ? roi_report.full_ranking : (results?.fixNowPriorities || [])).slice(0, 5).map((item, idx) => {
                                const roiScore = item.roi_score_normalized || item.composite_score || 0;
                                const revenueImpact = item.revenue_at_risk || (item.volume * 50); // Fallback estimate
                                const effort = item.fix_effort || (roiScore > 80 ? 8 : roiScore > 50 ? 5 : 3);
                                
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-all font-medium">
                                        <td className="px-8 py-5 text-slate-900 font-bold">
                                            {safeText(item.pain_point_category || item.issue)}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-900 w-6">{roiScore}</span>
                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                    <div
                                                        className={`h-full rounded-full ${roiScore > 75 ? 'bg-emerald-500Shadow' :
                                                            roiScore > 50 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'
                                                            }`}
                                                        style={{ 
                                                            width: `${roiScore}%`,
                                                            backgroundColor: roiScore > 75 ? '#10b981' : roiScore > 50 ? '#6366f1' : '#94a3b8'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-slate-600 font-mono">
                                            ${(revenueImpact || 0).toLocaleString()}
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-slate-400 text-[10px] uppercase font-black tracking-tighter">
                                                {effort <= 3 ? 'Low' : effort <= 7 ? 'Medium' : 'High'} ({effort}/10)
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border
                                                ${(item.priority_tier === 'Critical' || roiScore > 80) ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-sm shadow-rose-100' :
                                                (item.priority_tier === 'High' || roiScore > 50) ? 'bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-100' :
                                                    'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm shadow-indigo-100'}`}>
                                                {safeText(item.priority_tier || (roiScore > 80 ? 'Critical' : roiScore > 50 ? 'High' : 'Moderate'))}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Strategic Recommendation */}
            <div className="bg-slate-900 p-6 rounded-lg shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-3xl animate-pulse"></div>
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Strategic Initiative Directive
                </h4>
                <p className="text-white text-base leading-relaxed font-medium">
                    {safeText(roi_report?.recommendation || results?.executiveSummary?.recommendation, 'Autonomous systems prioritizing high-impact churn recovery operations. Review thematic intelligence for specific tactical execution path.')}
                </p>
            </div>
        </div >
    );
};

export default RevenueRisk;
