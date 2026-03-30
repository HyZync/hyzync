import React from 'react';
import { AlertTriangle, ArrowUpRight, DollarSign, HeartPulse, LineChart, Target } from 'lucide-react';

const safeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map((v) => safeText(v)).filter(Boolean).join(', ') || fallback;
    if (typeof value === 'object') {
        if (value.label) return String(value.label);
        if (value.name) return String(value.name);
        if (value.title) return String(value.title);
        if (value.issue) return String(value.issue);
        if (value.text) return String(value.text);
        const flatValues = Object.values(value).filter((v) => typeof v === 'string' || typeof v === 'number');
        if (flatValues.length > 0) return flatValues.join(' | ');
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }
    return String(value);
};

const safeNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'null') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const asCurrency = (value) => `$${safeNumber(value, 0).toLocaleString()}`;

const SummaryMetricCard = ({ icon: Icon, label, value, hint, tone = 'neutral' }) => {
    const toneClasses = {
        danger: 'text-rose-600 border-rose-100 bg-rose-50/80',
        success: 'text-emerald-600 border-emerald-100 bg-emerald-50/80',
        neutral: 'text-slate-700 border-slate-200 bg-white',
    };
    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="absolute -right-7 -top-7 h-16 w-16 rounded-full bg-slate-100/70" />
            <div className="relative flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>
                </div>
                <div className={`rounded-xl border p-2.5 ${toneClasses[tone] || toneClasses.neutral}`}>
                    <Icon size={16} />
                </div>
            </div>
        </div>
    );
};

const ExecutiveSummaryTab = ({ results }) => {
    const summary = results?.executiveSummary || {};
    const fixNow = Array.isArray(results?.fixNowPriorities) ? results.fixNowPriorities : [];
    const topIssues = Array.isArray(results?.thematic?.top_issues) ? results.thematic.top_issues : [];
    const recommendations = Array.isArray(results?.recommendations) ? results.recommendations : [];

    const topProblem = safeText(
        summary.biggest_problem ||
            summary.primary_problem ||
            summary.problem_statement ||
            summary.problem ||
            summary.headline ||
            fixNow[0]?.pain_point_category ||
            fixNow[0]?.issue ||
            topIssues[0]?.name,
        'Signal quality is still low to isolate one primary blocker.'
    );

    const revenueAtRisk =
        safeNumber(summary.revenue_at_risk ?? summary.revenueAtRisk) ||
        safeNumber(results?.revenueAtRisk ?? results?.revenue_at_risk) ||
        safeNumber(results?.financial?.revenue_risk?.nominal_churn_revenue) ||
        fixNow.reduce((sum, issue) => sum + safeNumber(issue?.revenue_at_risk), 0);

    const firstFix = safeText(
        summary.fix_first ||
            summary.top_priority ||
            summary.recommendation ||
            recommendations[0]?.directive ||
            fixNow[0]?.issue ||
            fixNow[0]?.pain_point_category,
        'Run another pass with richer review segmentation to prioritize interventions.'
    );

    const supportingContext = safeText(
        summary.context ||
            summary.rationale ||
            summary.note ||
            recommendations[0]?.rationale ||
            'Trends indicate concentrated dissatisfaction patterns. Focus effort on repeated friction points before broad feature work.'
    );

    const nps = safeNumber(results?.nps ?? results?.healthMetrics?.nps_score);
    const csat = safeNumber(results?.csat ?? results?.healthMetrics?.csat_score);
    const totalSignals = safeNumber(results?.totalReviews ?? results?.healthMetrics?.total_reviews);
    const themeCount = Object.keys(results?.thematic?.theme_hierarchy || {}).length || topIssues.length || 0;

    const rootCauses = fixNow.slice(0, 4).map((issue, idx) => ({
        id: `${safeText(issue?.issue, `cause-${idx}`)}-${idx}`,
        title: safeText(issue?.pain_point_category || issue?.issue, `Priority issue ${idx + 1}`),
        churnProbability: safeNumber(issue?.avg_churn_probability ?? issue?.churn_probability, 0),
        mentions: safeNumber(issue?.volume ?? issue?.mentions ?? issue?.affected_users, 0),
        revenue: safeNumber(issue?.revenue_at_risk ?? issue?.revenueImpact, 0),
    }));

    let actionPlan = recommendations.slice(0, 3).map((item, idx) => ({
        id: `rec-${idx}`,
        title: safeText(item?.directive, `Intervention ${idx + 1}`),
        rationale: safeText(item?.rationale, 'High-confidence intervention recommended by analysis engine.'),
        lift: safeText(item?.expected_nps_lift, ''),
    }));
    if (actionPlan.length === 0) {
        actionPlan = rootCauses.slice(0, 3).map((item, idx) => ({
            id: `derived-${idx}`,
            title: `Address: ${item.title}`,
            rationale: `Observed in ${item.mentions} signals with ${(item.churnProbability * 100).toFixed(0)}% churn probability.`,
            lift: '',
        }));
    }

    return (
        <div className="w-full space-y-5">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <div className="relative overflow-hidden rounded-[28px] border border-slate-800/60 bg-[radial-gradient(circle_at_12%_20%,rgba(56,189,248,0.18),transparent_38%),radial-gradient(circle_at_88%_10%,rgba(16,185,129,0.20),transparent_34%),linear-gradient(145deg,#0f172a,#1f2937_56%,#111827)] p-7 shadow-[0_36px_85px_-55px_rgba(15,23,42,0.75)] xl:col-span-8">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />
                    <div className="relative space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
                            <LineChart size={12} />
                            Executive Situation Brief
                        </div>

                        <div className="space-y-5">
                            <div>
                                <p className="text-sm font-bold text-cyan-200">1. Biggest problem right now</p>
                                <h2 className="mt-2 text-4xl font-black leading-tight tracking-tight text-white">{topProblem}</h2>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-cyan-200">2. Estimated revenue at risk</p>
                                <p className="mt-2 text-4xl font-black tracking-tight text-rose-300">{asCurrency(revenueAtRisk)}</p>
                                <p className="mt-1 text-xs font-medium text-slate-300">
                                    Calculated from churn projection, affected volume, and impact weighting.
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-cyan-200">3. What to fix first</p>
                                <p className="mt-2 text-3xl font-black tracking-tight text-emerald-300">{firstFix}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 px-4 py-3">
                            <p className="text-sm leading-relaxed text-slate-200">{supportingContext}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-[11px] font-bold text-cyan-100">
                                {totalSignals} review signals
                            </span>
                            <span className="rounded-full border border-emerald-200/30 bg-emerald-200/10 px-3 py-1 text-[11px] font-bold text-emerald-100">
                                {themeCount} tracked themes
                            </span>
                            <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-[11px] font-bold text-amber-100">
                                {fixNow.length} high-priority pain points
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:col-span-4 xl:grid-cols-1">
                    <SummaryMetricCard
                        icon={Target}
                        label="NPS Score"
                        value={String(nps)}
                        hint={nps >= 0 ? 'Promoters are balanced or ahead.' : 'Detractors currently exceed promoters.'}
                        tone={nps >= 0 ? 'success' : 'danger'}
                    />
                    <SummaryMetricCard
                        icon={HeartPulse}
                        label="CSAT"
                        value={`${csat}%`}
                        hint={csat >= 50 ? 'Satisfaction trend is stabilizing.' : 'Satisfaction trend needs active intervention.'}
                        tone={csat >= 50 ? 'success' : 'danger'}
                    />
                    <SummaryMetricCard
                        icon={DollarSign}
                        label="Revenue at Risk"
                        value={asCurrency(revenueAtRisk)}
                        hint="Estimated impact from unresolved churn drivers."
                        tone="danger"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Root Causes To Address</h3>
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                            Top {Math.max(rootCauses.length, 1)}
                        </span>
                    </div>
                    {rootCauses.length > 0 ? (
                        <div className="space-y-3">
                            {rootCauses.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-[15px] font-bold text-slate-900">{item.title}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                        <span className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 font-semibold text-rose-700">
                                            {(item.churnProbability * 100).toFixed(0)}% churn risk
                                        </span>
                                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                                            {item.mentions} mentions
                                        </span>
                                        {item.revenue > 0 && (
                                            <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                                                {asCurrency(item.revenue)} impact
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
                            <AlertTriangle size={18} className="text-slate-400" />
                            <p className="text-sm font-medium text-slate-500">
                                No prioritized issues yet. Add more tagged reviews or run calibration to surface root causes.
                            </p>
                        </div>
                    )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Action Plan</h3>
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                            Next best moves
                        </span>
                    </div>
                    {actionPlan.length > 0 ? (
                        <div className="space-y-3">
                            {actionPlan.map((item, idx) => (
                                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-[15px] font-bold text-slate-900">{item.title}</p>
                                        <span className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-700">
                                            P{idx + 1}
                                            <ArrowUpRight size={12} />
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-600">{item.rationale}</p>
                                    {item.lift && (
                                        <p className="mt-2 text-xs font-semibold text-emerald-700">Expected NPS lift: {item.lift}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
                            <Target size={18} className="text-slate-400" />
                            <p className="text-sm font-medium text-slate-500">
                                Action plan will appear once recommendation synthesis completes.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExecutiveSummaryTab;
