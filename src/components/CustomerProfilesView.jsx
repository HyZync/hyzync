import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Users, Search, Filter, Plus, X, Upload, Download,
    RefreshCw, ChevronRight, Star, Activity, AlertTriangle,
    CheckCircle2, Loader2, TrendingUp, TrendingDown,
    Mail, Building2, CreditCard, Calendar, Tag, MessageSquare,
    BarChart3, Trash2, Edit3, Clock, Zap, Brain, Copy, Sparkles
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, ReferenceLine
} from 'recharts';

import { Tooltip as ChartTooltip, Legend } from 'recharts';
import { apiFetch } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const churnColor = (prob) => {
    if (prob === null || prob === undefined) return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Unknown' };
    if (prob >= 0.7) return { bg: 'bg-red-100', text: 'text-red-700', label: 'High' };
    if (prob >= 0.4) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' };
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Low' };
};

const sentimentColor = (score) => {
    if (score === null || score === undefined) return 'text-gray-400';
    if (score >= 0.65) return 'text-emerald-600';
    if (score >= 0.4) return 'text-amber-600';
    return 'text-red-600';
};

const StarRating = ({ value, onChange, readOnly = false }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
            <button
                key={n}
                type="button"
                onClick={() => !readOnly && onChange && onChange(n)}
                className={`${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
                <Star
                    size={16}
                    className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                />
            </button>
        ))}
    </div>
);

const SentimentBadge = ({ score }) => {
    if (score === null || score === undefined) return <span className="text-xs text-gray-400">—</span>;
    const pct = Math.round(score * 100);
    const cls = score >= 0.65 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : score >= 0.4 ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-red-50 text-red-700 border-red-200';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
            {score >= 0.65 ? <TrendingUp size={11} /> : score >= 0.4 ? <Activity size={11} /> : <TrendingDown size={11} />}
            {pct}%
        </span>
    );
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────
const parseNumeric = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanInsightLabel = (value = '') =>
    String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const titleCase = (value = '') =>
    cleanInsightLabel(value)
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const truncateText = (value = '', max = 180) => {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
};

const formatPercent = (value) => {
    const parsed = parseNumeric(value);
    if (parsed === null) return '—';
    return `${Math.round(parsed * 100)}%`;
};

const getSentimentDescriptor = (score) => {
    const parsed = parseNumeric(score);
    if (parsed === null) {
        return {
            label: 'Unclear',
            summary: 'Analyze more feedback to confirm how this customer feels.',
            value: 'Awaiting analysis',
            textClass: 'text-slate-700',
            badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
        };
    }

    if (parsed <= -0.25) {
        return {
            label: 'Negative',
            summary: 'Recent feedback shows clear dissatisfaction and active friction.',
            value: `${Math.abs(Math.round(parsed * 100))}% negative tilt`,
            textClass: 'text-rose-700',
            badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
        };
    }

    if (parsed < 0.25) {
        return {
            label: 'Mixed',
            summary: 'Signals are mixed, so this account may still be recoverable with a fast follow-up.',
            value: 'Mixed sentiment',
            textClass: 'text-amber-700',
            badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
        };
    }

    return {
        label: 'Positive',
        summary: 'This customer is generally satisfied, with isolated friction to resolve.',
        value: `${Math.round(parsed * 100)}% positive tilt`,
        textClass: 'text-emerald-700',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
};

const getRiskDescriptor = (probability) => {
    const parsed = parseNumeric(probability);
    if (parsed === null) {
        return {
            label: 'Unknown',
            summary: 'Churn exposure will appear after enough analyzed feedback is available.',
            badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
            textClass: 'text-slate-700',
        };
    }

    if (parsed >= 0.7) {
        return {
            label: 'High churn risk',
            summary: 'This signal needs immediate recovery work before the account drifts further.',
            badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
            textClass: 'text-rose-700',
        };
    }

    if (parsed >= 0.4) {
        return {
            label: 'Medium churn risk',
            summary: 'This account is slipping and should be actively monitored.',
            badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
            textClass: 'text-amber-700',
        };
    }

    return {
        label: 'Low churn risk',
        summary: 'Risk is contained, but resolving the root issue will protect long-term sentiment.',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        textClass: 'text-emerald-700',
    };
};

const getRenewalStatus = (value) => {
    if (!value) return null;

    const renewalDate = new Date(value);
    if (Number.isNaN(renewalDate.getTime())) return null;

    const oneDayMs = 1000 * 60 * 60 * 24;
    const diffDays = Math.ceil((renewalDate.getTime() - Date.now()) / oneDayMs);

    if (diffDays > 1) return `Due in ${diffDays} days`;
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays === 0) return 'Due today';
    if (diffDays === -1) return 'Renewal passed yesterday';
    return `${Math.abs(diffDays)} days overdue`;
};

const inferOwningTeams = ({ issue, category, churnProbability }) => {
    const source = `${issue || ''} ${category || ''}`.toLowerCase();
    const teams = new Set();

    if (/(billing|paywall|payment|subscription|invoice|renewal|entitlement)/.test(source)) {
        teams.add('Product');
        teams.add('Support');
    }
    if (/(support|ticket|reply|service|help|response)/.test(source)) {
        teams.add('Support');
    }
    if (/(bug|crash|error|sync|login|auth|reliability|performance|slow|broken)/.test(source)) {
        teams.add('Engineering');
        teams.add('Product');
    }
    if (/(onboarding|setup|activation|trial|adoption|value|pricing|feature|ux|usability)/.test(source)) {
        teams.add('Product');
        teams.add('Growth');
    }

    if (!teams.size) {
        teams.add(parseNumeric(churnProbability, 0) >= 0.7 ? 'Product' : 'Support');
    }

    return Array.from(teams).join(' + ');
};

const buildActionSuggestion = ({ issue, category, churnProbability, renewalStatus }) => {
    const source = `${issue || ''} ${category || ''}`.toLowerCase();
    const isUrgent = parseNumeric(churnProbability, 0) >= 0.7 || Boolean(renewalStatus && /today|tomorrow|due in/i.test(renewalStatus));

    if (/(billing|paywall|payment|subscription|invoice|renewal|entitlement)/.test(source)) {
        return {
            title: 'Retention rescue draft',
            description: 'Restore account access, verify billing state, send a make-good note, and escalate the entitlement fix before renewal.',
            badge: isUrgent ? 'Urgent' : 'Priority',
        };
    }

    if (/(support|ticket|reply|service|help|response)/.test(source)) {
        return {
            title: 'Support recovery plan',
            description: 'Send a human follow-up, acknowledge the delay, and assign one owner to close the loop with a clear resolution.',
            badge: isUrgent ? 'Urgent' : 'Follow up',
        };
    }

    if (/(bug|crash|error|sync|login|auth|reliability|performance|slow|broken)/.test(source)) {
        return {
            title: 'Escalate product fix',
            description: 'Capture the failing workflow, push the issue to engineering, and send a status note so the customer knows the bug is actively owned.',
            badge: isUrgent ? 'Urgent' : 'Engineering',
        };
    }

    if (/(onboarding|setup|activation|trial|adoption|ux|usability|feature|value|pricing)/.test(source)) {
        return {
            title: 'Adoption rescue plan',
            description: 'Simplify the next step for the customer, give a guided path forward, and pair product messaging with a targeted success follow-up.',
            badge: isUrgent ? 'Priority' : 'Adoption',
        };
    }

    return {
        title: 'Customer recovery brief',
        description: 'Acknowledge the issue, assign a single owner, and deliver one concrete next step the customer can expect from the team.',
        badge: isUrgent ? 'Priority' : 'Next step',
    };
};

const buildSegmentSummary = (profiles = [], label = '') => {
    if (!profiles.length) return null;

    const analyzedProfiles = profiles.filter((item) => item.last_analyzed);
    const avgSentiment = analyzedProfiles.length
        ? analyzedProfiles.reduce((total, item) => total + (parseNumeric(item.latest_sentiment, 0) || 0), 0) / analyzedProfiles.length
        : null;
    const avgChurn = analyzedProfiles.length
        ? analyzedProfiles.reduce((total, item) => total + (parseNumeric(item.latest_churn, 0) || 0), 0) / analyzedProfiles.length
        : null;
    const highRiskCount = profiles.filter((item) => parseNumeric(item.latest_churn, 0) >= 0.7).length;

    const topIssues = {};
    analyzedProfiles.forEach((item) => {
        const key = cleanInsightLabel(item.latest_top_issue || '');
        if (!key) return;
        topIssues[key] = (topIssues[key] || 0) + 1;
    });

    const dominantIssue = Object.entries(topIssues)
        .sort((left, right) => right[1] - left[1])[0]?.[0] || '';
    const action = buildActionSuggestion({
        issue: dominantIssue,
        churnProbability: avgChurn,
    });

    return {
        segmentLabel: label || profiles[0]?.segment || 'Selected segment',
        totalProfiles: profiles.length,
        analyzedProfiles: analyzedProfiles.length,
        highRiskCount,
        avgSentiment,
        avgChurn,
        dominantIssue,
        sentiment: getSentimentDescriptor(avgSentiment),
        risk: getRiskDescriptor(avgChurn),
        action,
        actionBrief: [
            `Segment: ${label || profiles[0]?.segment || 'Selected segment'}`,
            `Profiles in scope: ${profiles.length}`,
            `Analyzed profiles: ${analyzedProfiles.length}`,
            `High churn risk: ${highRiskCount}`,
            dominantIssue ? `Dominant issue: ${titleCase(dominantIssue)}` : null,
            `Recommended action: ${action.description}`,
        ].filter(Boolean).join('\n'),
    };
};

const buildCustomerPlaybook = ({ profile, detail, latestAnalysis, segmentProfiles, selectedSegment }) => {
    const feedbacks = Array.isArray(detail?.feedbacks) ? detail.feedbacks.filter((item) => item.content) : [];
    const analyzedFeedbacks = feedbacks.filter((item) =>
        item.is_analyzed || item.issue || item.churn_risk || item.sentiment || item.sentiment_score !== null
    );

    if (!latestAnalysis && analyzedFeedbacks.length === 0) return null;

    const sortedFeedbacks = [...(analyzedFeedbacks.length ? analyzedFeedbacks : feedbacks)].sort((left, right) => {
        const leftRisk = left.churn_risk === 'high' ? 3 : left.churn_risk === 'medium' ? 2 : left.churn_risk === 'low' ? 1 : 0;
        const rightRisk = right.churn_risk === 'high' ? 3 : right.churn_risk === 'medium' ? 2 : right.churn_risk === 'low' ? 1 : 0;
        if (leftRisk !== rightRisk) return rightRisk - leftRisk;

        const leftSentiment = parseNumeric(left.sentiment_score, 0);
        const rightSentiment = parseNumeric(right.sentiment_score, 0);
        if (leftSentiment !== rightSentiment) return leftSentiment - rightSentiment;

        return String(right.feedback_date || right.created_at || '').localeCompare(String(left.feedback_date || left.created_at || ''));
    });

    const focusFeedback = sortedFeedbacks[0] || null;
    const focusIssue = cleanInsightLabel(
        focusFeedback?.issue ||
        latestAnalysis?.top_issue ||
        focusFeedback?.pain_point_category ||
        'Customer friction'
    );
    const riskProbability = parseNumeric(
        latestAnalysis?.churn_probability,
        focusFeedback?.churn_risk === 'high' ? 0.85 : focusFeedback?.churn_risk === 'medium' ? 0.55 : focusFeedback?.churn_risk === 'low' ? 0.2 : null
    );
    const renewalStatus = getRenewalStatus(profile?.next_renewal);
    const categoryLabel = titleCase(focusFeedback?.pain_point_category || '');
    const action = buildActionSuggestion({
        issue: focusIssue,
        category: categoryLabel,
        churnProbability: riskProbability,
        renewalStatus,
    });
    const sentiment = getSentimentDescriptor(
        parseNumeric(latestAnalysis?.avg_sentiment, parseNumeric(focusFeedback?.sentiment_score))
    );
    const risk = getRiskDescriptor(riskProbability);
    const owningTeams = inferOwningTeams({
        issue: focusIssue,
        category: categoryLabel,
        churnProbability: riskProbability,
    });

    const scopedSegment = selectedSegment || profile?.segment || '';
    const peerProfiles = Array.isArray(segmentProfiles)
        ? segmentProfiles.filter((item) => !scopedSegment || item.segment === scopedSegment)
        : [];
    const segmentContext = peerProfiles.length > 1 ? buildSegmentSummary(peerProfiles, scopedSegment || profile?.segment) : null;

    const problemText = focusIssue
        ? `The customer keeps reporting ${focusIssue.toLowerCase()}.`
        : 'This account is showing repeat friction across recent feedback.';

    let impactText = risk.summary;
    if (renewalStatus) {
        impactText = `${renewalStatus}. ${risk.summary}`;
    } else if (profile?.plan) {
        impactText = `${profile.plan} plan account. ${risk.summary}`;
    }

    return {
        reviewTitle: titleCase(focusIssue || 'Customer signal'),
        reviewBadges: [
            focusFeedback?.source ? titleCase(focusFeedback.source) : null,
            profile?.plan || null,
            profile?.segment || null,
            focusFeedback?.score ? `${focusFeedback.score}-star` : null,
        ].filter(Boolean),
        customerLabel: profile?.name || 'Selected customer',
        customerMeta: [profile?.company || null, renewalStatus || null].filter(Boolean).join(' · '),
        quote: truncateText(focusFeedback?.content || latestAnalysis?.summary || 'No analyzed feedback is available yet.', 220),
        sentiment,
        risk,
        owningTeams,
        action,
        problemTitle: titleCase(focusIssue || categoryLabel || 'Root issue'),
        problemText,
        impactText,
        actionBrief: [
            `Customer: ${profile?.name || 'Selected customer'}`,
            profile?.segment ? `Segment: ${profile.segment}` : null,
            profile?.plan ? `Plan: ${profile.plan}` : null,
            renewalStatus ? `Renewal: ${renewalStatus}` : null,
            `Primary sentiment: ${sentiment.label}`,
            `Business risk: ${risk.label}`,
            `Owning teams: ${owningTeams}`,
            `Main problem: ${titleCase(focusIssue || categoryLabel || 'Root issue')}`,
            `Recommended action: ${action.description}`,
        ].filter(Boolean).join('\n'),
        segmentContext,
    };
};

function parseCSVText(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    return lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
    });
}

// ─── Add Feedback Modal ────────────────────────────────────────────────────────
const AddFeedbackModal = ({ profile, userId, onClose, onAdded }) => {
    const [form, setForm] = useState({ content: '', score: 3, source: 'manual', feedback_date: new Date().toISOString().split('T')[0] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.content.trim()) { setError('Feedback content is required.'); return; }
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/crm/profiles/${profile.id}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, ...form })
            });
            if (!res.ok) throw new Error('Failed to add feedback');
            onAdded();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Add Feedback</h3>
                        <p className="text-xs text-gray-500 mt-0.5">For {profile.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/80 text-gray-400 hover:text-gray-700 transition-colors"><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Feedback Content *</label>
                        <textarea
                            rows={4}
                            value={form.content}
                            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                            placeholder="What did the customer say..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Rating</label>
                            <StarRating value={form.score} onChange={v => setForm(f => ({ ...f, score: v }))} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                            <input type="date" value={form.feedback_date}
                                onChange={e => setForm(f => ({ ...f, feedback_date: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
                        <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                            <option value="manual">Manual Entry</option>
                            <option value="email">Email</option>
                            <option value="intercom">Intercom</option>
                            <option value="support">Support Ticket</option>
                            <option value="nps">NPS Survey</option>
                            <option value="csv">CSV Import</option>
                        </select>
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            Add Feedback
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── CSV Import Modal ─────────────────────────────────────────────────────────
const ImportCSVModal = ({ userId, workspaceId, onClose, onImported }) => {
    const [rows, setRows] = useState([]);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const fileRef = useRef();

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const parsed = parseCSVText(ev.target.result);
            setRows(parsed);
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!rows.length) { setError('No data to import.'); return; }
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/crm/profiles/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, workspace_id: workspaceId, profiles: rows })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Import failed');
            setResult(data);
            onImported();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Import from CSV</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Supported columns: name, email, company, segment, plan, mrr, joined_date, external_id, tags, notes</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/80 text-gray-400 hover:text-gray-700 transition-colors"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div
                        onClick={() => fileRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
                    >
                        <Upload size={28} className="mx-auto mb-3 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                        <p className="text-sm font-medium text-gray-600">{fileName || 'Click to upload CSV file'}</p>
                        <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
                        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                    </div>

                    {rows.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm font-semibold text-gray-700 mb-2">{rows.length} rows detected</p>
                            <div className="overflow-x-auto max-h-40 text-xs font-mono">
                                <table className="min-w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            {Object.keys(rows[0]).slice(0, 6).map(k => (
                                                <th key={k} className="px-2 py-1 text-gray-500 font-semibold">{k}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="border-b border-gray-100">
                                                {Object.values(row).slice(0, 6).map((v, j) => (
                                                    <td key={j} className="px-2 py-1 text-gray-700 max-w-[120px] truncate">{v}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <span>Imported: <strong>{result.added}</strong> new, <strong>{result.updated}</strong> updated</span>
                        </div>
                    )}
                    {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                            {result ? 'Close' : 'Cancel'}
                        </button>
                        {!result && (
                            <button onClick={handleImport} disabled={loading || !rows.length}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                Import {rows.length} Profiles
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Profile Detail Drawer ────────────────────────────────────────────────────
const ProfileDrawer = ({ profile, userId, vertical, segmentProfiles = [], selectedSegment = '', onClose, onUpdated, onCopyAction }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeResult, setAnalyzeResult] = useState(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [schedule, setSchedule] = useState(profile.schedule || 'manual');

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/crm/profiles/${profile.id}?user_id=${userId}`);
            const data = await res.json();
            setDetail(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [profile.id, userId]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleAnalyze = async () => {
        setAnalyzing(true);
        setAnalyzeResult(null);
        try {
            const res = await apiFetch(`${API_BASE}/api/crm/profiles/${profile.id}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, schedule, vertical: vertical || 'saas' })
            });
            const data = await res.json();
            setAnalyzeResult(data);
            fetchDetail();
            onUpdated();
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleScheduleChange = async (val) => {
        const prev = schedule;
        setSchedule(val); // optimistic update
        try {
            const res = await apiFetch(`/api/crm/profiles/${profile.id}`, {
                method: 'PUT',
                body: JSON.stringify({ schedule: val })
            });
            if (!res.ok) throw new Error(`Schedule update failed: ${res.status}`);
        } catch (e) {
            console.error(e);
            setSchedule(prev); // revert on failure
        }
    };

    // Build trend data from history
    const trendData = (detail?.history || []).slice().reverse().map((h, i) => ({
        label: h.run_at ? new Date(h.run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Run ${i + 1}`,
        sentiment: h.avg_sentiment !== null && h.avg_sentiment !== undefined ? Math.round(h.avg_sentiment * 100) : null,
        churn: h.churn_probability !== null && h.churn_probability !== undefined ? Math.round(h.churn_probability * 100) : null,
    }));

    const profileMeta = detail?.profile || profile;
    const latestAnalysis = detail?.history?.[0];
    const analysisSnapshot = analyzeResult?.success ? { ...latestAnalysis, ...analyzeResult } : latestAnalysis;
    const churnInfo = churnColor(analysisSnapshot?.churn_probability);
    const playbook = buildCustomerPlaybook({
        profile: profileMeta,
        detail,
        latestAnalysis: analysisSnapshot,
        segmentProfiles,
        selectedSegment,
    });

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Activity },
        { id: 'feedbacks', label: `Feedbacks (${detail?.feedbacks?.length || 0})`, icon: MessageSquare },
        { id: 'trend', label: 'Trend', icon: BarChart3 },
    ];

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[1180px] bg-white shadow-2xl shadow-indigo-900/20 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white flex items-start justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-xl font-bold border border-white/20">
                            {(profileMeta.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold leading-tight">{profileMeta.name}</h2>
                            <p className="text-slate-300 text-xs mt-0.5">{profileMeta.email || '—'}</p>
                            {profileMeta.company && <p className="text-indigo-300 text-xs mt-0.5">{profileMeta.company}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors mt-0.5">
                        <X size={18} />
                    </button>
                </div>

                {/* Stats Strip */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/80 border-b border-gray-100 flex-shrink-0">
                    {[
                        { label: 'Plan', value: profileMeta.plan || '—', icon: CreditCard },
                        { label: 'MRR', value: profileMeta.mrr ? `$${Number(profileMeta.mrr || 0).toLocaleString()}` : '—', icon: TrendingUp },
                        { label: 'Segment', value: profileMeta.segment || 'Unknown', icon: Tag },
                    ].map(s => (
                        <div key={s.label} className="px-4 py-3 text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                            <p className="text-sm font-semibold text-gray-800 mt-0.5">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-colors border-b-2 ${activeTab === t.id
                                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                            <t.icon size={13} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 size={24} className="text-indigo-500 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <div className="p-5 space-y-4">
                                    {/* Latest Analysis Card */}
                                    {analysisSnapshot ? (
                                        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Latest Analysis</h4>
                                                <span className="text-[10px] text-gray-400">{analysisSnapshot.run_at ? new Date(analysisSnapshot.run_at).toLocaleDateString() : 'Just now'}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Sentiment</p>
                                                    <p className={`text-xl font-black mt-1 ${sentimentColor(analysisSnapshot.avg_sentiment)}`}>
                                                        {analysisSnapshot.avg_sentiment !== null ? `${Math.round(analysisSnapshot.avg_sentiment * 100)}%` : '—'}
                                                    </p>
                                                </div>
                                                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Churn Risk</p>
                                                    <p className={`text-sm font-black mt-1 ${churnInfo.text}`}>{churnInfo.label}</p>
                                                    {analysisSnapshot.churn_probability !== null && (
                                                        <p className="text-[10px] text-gray-400">{Math.round(analysisSnapshot.churn_probability * 100)}%</p>
                                                    )}
                                                </div>
                                            </div>
                                            {analysisSnapshot.top_issue && (
                                                <div className="bg-white rounded-lg px-3 py-2 text-xs text-gray-700 shadow-sm">
                                                    <span className="font-semibold text-orange-600">Top Issue: </span>{analysisSnapshot.top_issue}
                                                </div>
                                            )}
                                            {analysisSnapshot.summary && (
                                                <p className="text-xs text-gray-600 leading-relaxed">{analysisSnapshot.summary}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                                            <Brain size={24} className="mx-auto mb-2 text-gray-300" />
                                            <p className="text-sm font-medium text-gray-500">No analysis yet</p>
                                            <p className="text-xs text-gray-400 mt-1">Add feedbacks and click Analyze Now</p>
                                        </div>
                                    )}

                                    {analyzeResult?.success === false && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                                            <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-amber-800">{analyzeResult.message || 'Analysis could not run for this customer yet.'}</p>
                                        </div>
                                    )}

                                    {analyzeResult?.success && analyzeResult.summary && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                                            <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-emerald-800">{analyzeResult.summary}</p>
                                        </div>
                                    )}

                                    {playbook && (
                                        <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 shadow-sm">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                                                        <Sparkles size={12} />
                                                        Simple Flow
                                                    </span>
                                                    <p className="mt-3 text-sm text-slate-600">
                                                        Review to sentiment to root problem, with a quick action plan at the end.
                                                    </p>
                                                </div>
                                                {onCopyAction && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onCopyAction(playbook.actionBrief, `${playbook.customerLabel} action brief copied.`)}
                                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                                    >
                                                        <Copy size={13} />
                                                        Copy action brief
                                                    </button>
                                                )}
                                            </div>

                                            <div className="mt-4 grid gap-4 xl:grid-cols-3">
                                                <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-700">Review</p>
                                                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${playbook.risk.badgeClass}`}>
                                                            {playbook.risk.label}
                                                        </span>
                                                    </div>
                                                    <h4 className="mt-4 text-2xl font-black leading-tight text-slate-950">{playbook.reviewTitle}</h4>
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {playbook.reviewBadges.map((badge) => (
                                                            <span key={badge} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                                                                {badge}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="mt-6 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                                                        <p className="text-sm font-semibold text-slate-950">{playbook.customerLabel}</p>
                                                        {playbook.customerMeta && <p className="mt-1 text-xs text-slate-500">{playbook.customerMeta}</p>}
                                                        <p className="mt-3 text-sm leading-relaxed text-slate-700">"{playbook.quote}"</p>
                                                    </div>
                                                </article>

                                                <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-700">Sentiment</p>
                                                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${playbook.risk.badgeClass}`}>
                                                            {playbook.action.badge}
                                                        </span>
                                                    </div>
                                                    <h4 className={`mt-4 text-4xl font-black leading-none ${playbook.sentiment.textClass}`}>{playbook.sentiment.label}</h4>
                                                    <p className="mt-4 text-sm leading-relaxed text-slate-600">{playbook.sentiment.summary}</p>
                                                    <div className="mt-6 space-y-3">
                                                        {[
                                                            ['Primary sentiment', playbook.sentiment.label],
                                                            ['Business risk', playbook.risk.label],
                                                            ['Owning teams', playbook.owningTeams],
                                                        ].map(([label, value]) => (
                                                            <div key={label} className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                                                                <p className="text-xs font-semibold text-slate-700 text-right">{value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </article>

                                                <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">Main Problem</p>
                                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">
                                                            {playbook.action.badge}
                                                        </span>
                                                    </div>
                                                    <h4 className="mt-4 text-2xl font-black leading-tight text-slate-950">{playbook.problemTitle}</h4>
                                                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Problem</p>
                                                            <p className="mt-2 text-sm leading-relaxed text-slate-700">{playbook.problemText}</p>
                                                        </div>
                                                        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Impact</p>
                                                            <p className="mt-2 text-sm leading-relaxed text-slate-700">{playbook.impactText}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 rounded-[20px] border border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,250,255,0.9))] px-4 py-4">
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-700">Suggested Action</p>
                                                        <p className="mt-2 text-base font-bold text-slate-950">{playbook.action.title}</p>
                                                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{playbook.action.description}</p>
                                                    </div>
                                                </article>
                                            </div>

                                            {playbook.segmentContext && (
                                                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Segment Context</p>
                                                            <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                                                                {playbook.segmentContext.segmentLabel} has {playbook.segmentContext.totalProfiles} visible customers in this view.
                                                            </p>
                                                        </div>
                                                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${playbook.segmentContext.risk.badgeClass}`}>
                                                            {playbook.segmentContext.highRiskCount} high risk
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                                                        <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Profiles</p>
                                                            <p className="mt-2 text-lg font-black text-slate-900">{playbook.segmentContext.totalProfiles}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Analyzed</p>
                                                            <p className="mt-2 text-lg font-black text-slate-900">{playbook.segmentContext.analyzedProfiles}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Avg churn</p>
                                                            <p className="mt-2 text-lg font-black text-slate-900">{formatPercent(playbook.segmentContext.avgChurn)}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Top issue</p>
                                                            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900">
                                                                {playbook.segmentContext.dominantIssue ? titleCase(playbook.segmentContext.dominantIssue) : 'No dominant issue yet'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    {/* Profile Info */}
                                    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Profile Info</h4>
                                        {[
                                            { icon: Mail, label: 'Email', value: profileMeta.email },
                                            { icon: Building2, label: 'Company', value: profileMeta.company },
                                            { icon: Calendar, label: 'Joined', value: profileMeta.joined_date },
                                            { icon: Calendar, label: 'Renewal', value: profileMeta.next_renewal },
                                        ].map(f => f.value && (
                                            <div key={f.label} className="flex items-center gap-3 text-sm">
                                                <f.icon size={14} className="text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-500 min-w-[60px]">{f.label}</span>
                                                <span className="text-gray-800 font-medium">{f.value}</span>
                                            </div>
                                        ))}
                                        {profileMeta.notes && (
                                            <div className="pt-2 border-t border-gray-100 text-xs text-gray-600 leading-relaxed">{profileMeta.notes}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Feedbacks Tab */}
                            {activeTab === 'feedbacks' && (
                                <div className="p-5 space-y-3">
                                    {(!detail?.feedbacks || detail.feedbacks.length === 0) ? (
                                        <div className="text-center py-10">
                                            <MessageSquare size={32} className="mx-auto mb-3 text-gray-200" />
                                            <p className="text-sm text-gray-400">No feedbacks yet</p>
                                        </div>
                                    ) : (
                                        detail.feedbacks.map(fb => (
                                            <div key={fb.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <StarRating value={fb.score || 3} readOnly />
                                                        {fb.sentiment && (
                                                            <SentimentBadge score={fb.sentiment_score} />
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-gray-400">{fb.feedback_date || fb.created_at?.split('T')[0]}</p>
                                                        <p className="text-[10px] text-indigo-400 capitalize">{fb.source}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-700 leading-relaxed">{fb.content}</p>
                                                {fb.churn_risk && (
                                                    <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${churnColor(String(fb.churn_risk).toLowerCase() === 'high' ? 0.8 : String(fb.churn_risk).toLowerCase() === 'medium' ? 0.5 : 0.1).bg} ${churnColor(String(fb.churn_risk).toLowerCase() === 'high' ? 0.8 : String(fb.churn_risk).toLowerCase() === 'medium' ? 0.5 : 0.1).text}`}>
                                                        {titleCase(fb.churn_risk)} Risk
                                                    </div>
                                                )}
                                                {fb.issue && <p className="text-xs text-orange-600 mt-1">⚠ {fb.issue}</p>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Trend Tab */}
                            {activeTab === 'trend' && (
                                <div className="p-5 space-y-4">
                                    {trendData.length < 2 ? (
                                        <div className="text-center py-10">
                                            <BarChart3 size={32} className="mx-auto mb-3 text-gray-200" />
                                            <p className="text-sm text-gray-400">Need at least 2 analyses to show a trend</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-white border border-gray-100 rounded-xl p-4">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Sentiment Over Time</h4>
                                                <ResponsiveContainer width="100%" height={140}>
                                                    <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} />
                                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} />
                                                        <Tooltip formatter={(v, n) => [`${v}%`, n === 'sentiment' ? 'Sentiment' : 'Churn Risk']} />
                                                        <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="4 4" />
                                                        <Line type="monotone" dataKey="sentiment" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} connectNulls />
                                                        <Line type="monotone" dataKey="churn" stroke="#f43f5e" strokeWidth={2.5} dot={{ fill: '#f43f5e', r: 4 }} strokeDasharray="5 3" connectNulls />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                                <div className="flex items-center gap-4 mt-2 justify-center">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-5 h-0.5 bg-indigo-500 rounded inline-block" />Sentiment</div>
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-5 h-0.5 bg-rose-500 rounded inline-block" />Churn Risk</div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {detail.history.slice(0, 5).map((h, i) => (
                                                    <div key={h.id || i} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                                                        <div className="text-[10px] text-gray-400 min-w-[70px]">{h.run_at ? new Date(h.run_at).toLocaleDateString() : '—'}</div>
                                                        <SentimentBadge score={h.avg_sentiment} />
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${churnColor(h.churn_probability).bg} ${churnColor(h.churn_probability).text}`}>
                                                            {churnColor(h.churn_probability).label} Churn
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 ml-auto capitalize">{h.schedule}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-100 p-4 bg-gray-50/80 flex-shrink-0 space-y-3">
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Schedule:</label>
                        <select value={schedule} onChange={e => handleScheduleChange(e.target.value)}
                            className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                            <option value="manual">Manual Only</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFeedbackModal(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
                            <Plus size={13} /> Add Feedback
                        </button>
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm shadow-indigo-200">
                            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                            {analyzing ? 'Analyzing…' : 'Analyze Now'}
                        </button>
                    </div>
                </div>
            </div>

            {showFeedbackModal && (
                <AddFeedbackModal
                    profile={profile}
                    userId={userId}
                    onClose={() => setShowFeedbackModal(false)}
                    onAdded={() => { fetchDetail(); onUpdated(); }}
                />
            )}
        </>
    );
};

// ─── Main CustomerProfilesView ────────────────────────────────────────────────
const CustomerProfilesView = ({ user, activeWorkspace }) => {
    const userId = user?.id || 1;
    const workspaceId = activeWorkspace?.id || null;
    const vertical = activeWorkspace?.vertical || 'saas';

    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [search, setSearch] = useState('');
    const [segment, setSegment] = useState('');
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [showAddProfile, setShowAddProfile] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', email: '', company: '', segment: 'Unknown', plan: '', mrr: '' });
    const [addLoading, setAddLoading] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);
    const [batchRunning, setBatchRunning] = useState(false);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const params = new URLSearchParams();
            if (workspaceId) params.append('workspace_id', workspaceId);
            if (search) params.append('search', search);
            if (segment) params.append('segment', segment);
            const res = await apiFetch(`/api/crm/profiles?${params}`);
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const data = await res.json();
            setProfiles(data.profiles || []);
        } catch (e) {
            console.error(e);
            setFetchError('Failed to load profiles. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }, [userId, workspaceId, search, segment]);

    useEffect(() => {
        const timer = setTimeout(fetchProfiles, search ? 350 : 0);
        return () => clearTimeout(timer);
    }, [fetchProfiles, search]);

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3000);
    };

    const copyActionBrief = async (text, successMessage = 'Action brief copied') => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast(successMessage);
        } catch (e) {
            console.error(e);
            showToast('Could not copy action brief', 'error');
        }
    };

    const handleAddProfile = async (e) => {
        e.preventDefault();
        if (!addForm.name.trim()) return;
        setAddLoading(true);
        try {
            await apiFetch(`${API_BASE}/api/crm/profiles/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    workspace_id: workspaceId,
                    profiles: [{ ...addForm, mrr: parseFloat(addForm.mrr) || 0 }]
                })
            });
            setShowAddProfile(false);
            setAddForm({ name: '', email: '', company: '', segment: 'Unknown', plan: '', mrr: '' });
            fetchProfiles();
            showToast('Profile added successfully');
        } catch (e) {
            console.error(e);
        } finally {
            setAddLoading(false);
        }
    };

    const handleBatchAnalyze = async () => {
        setBatchRunning(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/crm/batch-analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, vertical, days_since: 7 })
            });
            const data = await res.json();
            showToast(`${data.queued} profiles queued for analysis`);
        } catch (e) {
            showToast('Batch analyze failed', 'error');
        } finally {
            setBatchRunning(false);
        }
    };

    const handleDelete = async (profileId) => {
        if (!window.confirm('Delete this profile?')) return;
        try {
            const res = await apiFetch(`/api/crm/profiles/${profileId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
            fetchProfiles();
            if (selectedProfile?.id === profileId) setSelectedProfile(null);
            showToast('Profile deleted');
        } catch (e) {
            console.error(e);
            showToast('Failed to delete profile', 'error');
        }
    };

    // KPI summaries
    const totalProfiles = profiles.length;
    const highChurnCount = profiles.filter(p => p.latest_churn >= 0.7).length;
    const avgSentiment = profiles.length
        ? Math.round((profiles.reduce((s, p) => s + (p.latest_sentiment ?? 0.5), 0) / profiles.length) * 100)
        : 0;
    const totalMRR = profiles.reduce((s, p) => s + (p.mrr || 0), 0);

    const segments = [...new Set(profiles.map(p => p.segment).filter(Boolean))];
    const activeSegmentSummary = segment ? buildSegmentSummary(profiles, segment) : null;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50 overflow-y-auto">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Customer Profiles</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Track sentiment trends and churn risk per customer</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBatchAnalyze}
                            disabled={batchRunning || !profiles.length}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors">
                            {batchRunning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                            Analyze Stale
                        </button>
                        <button
                            onClick={() => setShowImport(true)}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                            <Upload size={13} /> Import CSV
                        </button>
                        <button
                            onClick={() => setShowAddProfile(true)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                            <Plus size={13} /> Add Profile
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 flex-shrink-0">
                {[
                    { label: 'Total Profiles', value: totalProfiles, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'High Churn Risk', value: highChurnCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Avg Sentiment', value: `${avgSentiment}%`, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Total MRR at Risk', value: `$${(totalMRR || 0).toLocaleString()}`, icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(k => (
                    <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
                            <k.icon size={18} className={k.color} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
                            <p className="text-xl font-black text-gray-900 mt-0.5">{k.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search + Filters */}
            <div className="px-6 pb-3 flex items-center gap-3 flex-shrink-0">
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, company…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">Segment:</span>
                    {['', ...segments].map(s => (
                        <button key={s || 'all'} onClick={() => setSegment(s)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${segment === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'}`}>
                            {s || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {activeSegmentSummary && (
                <div className="px-6 pb-4 flex-shrink-0">
                    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">Selected Segment</p>
                                <h3 className="mt-2 text-lg font-black text-slate-950 capitalize">{activeSegmentSummary.segmentLabel} snapshot</h3>
                                <p className="mt-2 text-sm text-slate-600">{activeSegmentSummary.sentiment.summary}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${activeSegmentSummary.risk.badgeClass}`}>
                                    {activeSegmentSummary.highRiskCount} high risk
                                </span>
                                <button
                                    type="button"
                                    onClick={() => copyActionBrief(activeSegmentSummary.actionBrief, `${activeSegmentSummary.segmentLabel} segment brief copied.`)}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <Copy size={13} />
                                    Copy segment brief
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSegment('')}
                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    Clear filter
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {[
                                    { label: 'Profiles', value: activeSegmentSummary.totalProfiles },
                                    { label: 'Analyzed', value: activeSegmentSummary.analyzedProfiles },
                                    { label: 'Avg Sentiment', value: formatPercent(activeSegmentSummary.avgSentiment) },
                                    { label: 'Avg Churn', value: formatPercent(activeSegmentSummary.avgChurn) },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                                        <p className="mt-2 text-lg font-black text-slate-900">{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-[22px] border border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,250,255,0.92))] px-4 py-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-700">Recommended action</p>
                                <p className="mt-2 text-base font-bold text-slate-950">{activeSegmentSummary.action.title}</p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">{activeSegmentSummary.action.description}</p>
                                <p className="mt-3 text-xs text-slate-500">
                                    {activeSegmentSummary.dominantIssue ? `Dominant issue: ${titleCase(activeSegmentSummary.dominantIssue)}.` : 'A dominant issue will appear after more profiles are analyzed.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Table */}
            <div className="px-6 pb-6 flex-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                        <Loader2 size={28} className="text-indigo-500 animate-spin mb-3" />
                        <p className="text-sm text-gray-400">Loading profiles…</p>
                    </div>
                ) : fetchError ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-red-50 rounded-xl border border-red-100">
                        <AlertTriangle size={28} className="text-red-400 mb-3" />
                        <p className="text-sm font-semibold text-red-700">Could not load profiles</p>
                        <p className="text-xs text-red-500 mt-1 mb-4">{fetchError}</p>
                        <button onClick={fetchProfiles} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">
                            <RefreshCw size={12} /> Retry
                        </button>
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
                        <Users size={40} className="mx-auto mb-4 text-gray-200" />
                        <h3 className="text-base font-semibold text-gray-600">No profiles yet</h3>
                        <p className="text-sm text-gray-400 mt-1 mb-5">Import from CSV or add profiles manually</p>
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={() => setShowImport(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
                                <Upload size={15} /> Import CSV
                            </button>
                            <button onClick={() => setShowAddProfile(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors">
                                <Plus size={15} /> Add Profile
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-50">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    {['Customer', 'Company / Plan', 'Segment', 'Sentiment', 'Churn Risk', 'Feedbacks', 'Last Analyzed', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {profiles.map(p => {
                                    const churn = churnColor(p.latest_churn);
                                    return (
                                        <tr key={p.id}
                                            onClick={() => setSelectedProfile(p)}
                                            className="hover:bg-indigo-50/30 cursor-pointer transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                                                        {(p.name || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{p.name}</p>
                                                        <p className="text-xs text-gray-400">{p.email || '—'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-700">{p.company || '—'}</p>
                                                <p className="text-xs text-gray-400">{p.plan || '—'}{p.mrr ? ` · $${Number(p.mrr || 0).toLocaleString()}/mo` : ''}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 text-[11px] font-semibold bg-gray-100 text-gray-600 rounded-lg">
                                                    {p.segment || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <SentimentBadge score={p.latest_sentiment} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-[11px] font-semibold rounded-lg ${churn.bg} ${churn.text}`}>
                                                    {churn.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                                                {p.feedback_count || 0}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Clock size={11} />
                                                    {p.last_analyzed ? new Date(p.last_analyzed).toLocaleDateString() : 'Never'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                        <Trash2 size={13} />
                                                    </button>
                                                    <ChevronRight size={14} className="text-gray-300" />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Profile Inline Modal */}
            {showAddProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
                            <h3 className="text-base font-bold text-gray-900">Add Profile</h3>
                            <button onClick={() => setShowAddProfile(false)} className="p-1.5 rounded-lg hover:bg-white/80 text-gray-400 hover:text-gray-700"><X size={16} /></button>
                        </div>
                        <form onSubmit={handleAddProfile} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { key: 'name', label: 'Full Name *', type: 'text', required: true },
                                    { key: 'email', label: 'Email', type: 'email' },
                                    { key: 'company', label: 'Company', type: 'text' },
                                    { key: 'plan', label: 'Plan', type: 'text' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                                        <input type={f.type} required={f.required}
                                            value={addForm[f.key]} onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Segment</label>
                                    <select value={addForm.segment} onChange={e => setAddForm(p => ({ ...p, segment: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                        {['Enterprise', 'SMB', 'Startup', 'Free', 'Unknown'].map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">MRR ($)</label>
                                    <input type="number" value={addForm.mrr} onChange={e => setAddForm(p => ({ ...p, mrr: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAddProfile(false)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                                <button type="submit" disabled={addLoading}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                    {addLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Add Profile
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toastMsg && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toastMsg.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    <CheckCircle2 size={16} />
                    {toastMsg.msg}
                </div>
            )}

            {/* Import Modal */}
            {showImport && (
                <ImportCSVModal
                    userId={userId}
                    workspaceId={workspaceId}
                    onClose={() => setShowImport(false)}
                    onImported={fetchProfiles}
                />
            )}

            {/* Profile Drawer */}
            {selectedProfile && (
                <ProfileDrawer
                    profile={selectedProfile}
                    userId={userId}
                    vertical={vertical}
                    segmentProfiles={profiles}
                    selectedSegment={segment}
                    onClose={() => setSelectedProfile(null)}
                    onUpdated={fetchProfiles}
                    onCopyAction={copyActionBrief}
                />
            )}
        </div>
    );
};

export default CustomerProfilesView;
