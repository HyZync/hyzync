import { apiFetch } from '../../utils/api';
import React, { useState, useEffect } from 'react';
import { ClipboardList, Download } from 'lucide-react';

// Safely converts any value to a renderable string
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
        if (val.description) return String(val.description);
        const vals = Object.values(val).filter(v => typeof v === 'string' || typeof v === 'number');
        if (vals.length > 0) return vals.join(' — ');
        return JSON.stringify(val);
    }
    return String(val);
};

const StrategicNarrative = ({ userId = 1, results = null }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(!results);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('scr'); // 'scr' or 'onepager'

    useEffect(() => {
        if (results) {
            setData(results.strategicNarrative || results);
            setLoading(false);
            return;
        }
        const fetchData = async () => {
            try {
                const response = await apiFetch(`/api/analytics/strategy?user_id=${userId}`);
                if (!response.ok) throw new Error('Failed to fetch strategic data');
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

    if (loading) return <div className="p-8 text-center text-gray-500 italic">Generating Strategic Briefs...</div>;
    if (error) return <div className="p-8 text-center text-rose-500">Error loading strategy data: {error}</div>;
    if (!data) return <div className="p-8 text-center text-slate-400">No strategic data available. Run analysis to generate context.</div>;

    const { scr_brief, one_pager } = data;

    return (
        <div className="space-y-6">
            {/* Toggle Tabs */}
            <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('scr')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all
                        ${activeTab === 'scr' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    SCR Brief (Internal)
                </button>
                <button
                    onClick={() => setActiveTab('onepager')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all
                        ${activeTab === 'onepager' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Executive One-Pager (External)
                </button>
            </div>

            {/* SCR View */}
            {activeTab === 'scr' && (
                scr_brief ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center">
                                <ClipboardList className="w-5 h-5 mr-2 text-indigo-600" />
                                Situation-Complication-Resolution Brief
                            </h3>
                            <span className="text-xs text-slate-500">
                                Generated: {new Date(scr_brief.generated_at || Date.now()).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Situation */}
                            <section className="relative pl-6 border-l-4 border-blue-200">
                                <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-400"></div>
                                <h4 className="text-lg font-bold text-slate-900 mb-2">Situation</h4>
                                <div className="prose text-slate-600 leading-relaxed whitespace-pre-line text-sm font-medium">
                                    {safeText(scr_brief.situation)}
                                </div>
                            </section>

                            {/* Complication */}
                            <section className="relative pl-6 border-l-4 border-amber-200">
                                <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-amber-100 border-2 border-amber-400"></div>
                                <h4 className="text-lg font-bold text-slate-900 mb-2">Complication</h4>
                                <div className="prose text-slate-600 leading-relaxed whitespace-pre-line text-sm font-medium">
                                    {safeText(scr_brief.complication)}
                                </div>
                            </section>

                            {/* Resolution */}
                            <section className="relative pl-6 border-l-4 border-emerald-200">
                                <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-emerald-100 border-2 border-emerald-400"></div>
                                <h4 className="text-lg font-bold text-slate-900 mb-2">Resolution</h4>
                                <div className="prose text-slate-600 leading-relaxed whitespace-pre-line text-sm font-medium">
                                    {safeText(scr_brief.resolution)}
                                </div>
                            </section>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                        <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-medium">Internal SCR Brief is still being synthesized. Please check back in a few moments.</p>
                    </div>
                )
            )}

            {/* One-Pager View */}
            {activeTab === 'onepager' && (
                one_pager ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-4xl mx-auto">
                        <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-6">
                            <div>
                                <h2 className="text-3xl font-serif font-bold text-slate-900">{one_pager.client_name || 'Executive Report'}</h2>
                                <p className="text-slate-500 mt-1">Strategic Performance Review</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-700">{one_pager.date_range || 'Current Period'}</p>
                                <button className="mt-2 text-xs flex items-center text-indigo-600 hover:text-indigo-800 font-bold uppercase tracking-widest">
                                    <Download className="w-3 h-3 mr-1" /> Export PDF
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-6 mb-8">
                            <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100 shadow-sm">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Risk Exposure</p>
                                <p className="text-xl font-bold text-rose-600">
                                    ${one_pager.key_metrics?.revenue_at_risk?.toLocaleString() || '0'}
                                </p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100 shadow-sm">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">At-Risk Count</p>
                                <p className="text-xl font-bold text-slate-800">
                                    {one_pager.key_metrics?.high_risk_users || '0'}
                                </p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100 shadow-sm">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Sentiment</p>
                                <p className="text-xl font-bold text-slate-800">
                                    {one_pager.key_metrics?.avg_sentiment || '0.0'}
                                </p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100 shadow-sm">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Total Signals</p>
                                <p className="text-xl font-bold text-slate-800">
                                    {one_pager.key_metrics?.total_reviews || '0'}
                                </p>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Executive Summary</h4>
                            <p className="text-lg text-slate-800 leading-relaxed font-medium italic">
                                {safeText(one_pager.executive_summary)}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Top Strategic Risks</h4>
                                <ul className="space-y-4">
                                    {(one_pager.top_3_risks || []).map((risk, i) => (
                                    <li key={i} className="flex items-start">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black mr-3 mt-0.5 shadow-sm border border-rose-200">
                                                {i + 1}
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-800 text-[15px]">{safeText(risk.topic || risk.issue)}</p>
                                                <p className="text-xs text-slate-500 font-medium">
                                                    ${risk.revenue_at_risk?.toLocaleString() || '0'} impact • {risk.affected_users || 'N/A'} affected
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Strategic Initiatives</h4>
                                <div className="bg-indigo-50/50 p-6 rounded-lg text-[13px] text-indigo-900 whitespace-pre-line leading-relaxed border border-indigo-100 font-medium italic">
                                    {safeText(one_pager.recommended_initiatives)}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                        <Download className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-medium">Executive One-Pager is currently being architected. Please stand by.</p>
                    </div>
                )
            )}
        </div>
    );
};

export default StrategicNarrative;
