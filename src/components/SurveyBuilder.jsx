import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus, X, Trash2, Check, Copy, ExternalLink, Globe, Eye,
    BarChart3, Edit3, ChevronUp, ChevronDown, Loader2, Settings,
    Star, MessageSquare, List, ToggleLeft, Hash, Sliders,
    CheckCircle2, AlertTriangle, TrendingUp, Users, ClipboardList,
    ArrowLeft, GripVertical, Share2, Download, Lock
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend
} from 'recharts';

const API_BASE = '';

// ─── Constants ────────────────────────────────────────────────────────────────
const SURVEY_TYPES = [
    { id: 'nps', label: 'NPS Survey', emoji: '📊', description: 'Net Promoter Score — measure loyalty on a 0-10 scale', color: 'indigo' },
    { id: 'csat', label: 'CSAT Survey', emoji: '😊', description: 'Customer Satisfaction Score — 1 to 5 rating scale', color: 'emerald' },
    { id: 'custom', label: 'Custom Questionnaire', emoji: '📋', description: 'Build your own survey with any question types', color: 'violet' },
];

const QUESTION_TYPES = [
    { id: 'nps', label: 'NPS (0-10)', icon: Hash, color: 'text-indigo-600' },
    { id: 'csat', label: 'CSAT (1-5)', icon: Star, color: 'text-emerald-600' },
    { id: 'rating', label: 'Rating Scale', icon: Sliders, color: 'text-violet-600' },
    { id: 'text', label: 'Open Text', icon: MessageSquare, color: 'text-gray-600' },
    { id: 'multiple_choice', label: 'Multiple Choice', icon: List, color: 'text-amber-600' },
    { id: 'yes_no', label: 'Yes / No', icon: ToggleLeft, color: 'text-rose-600' },
];

const THEMES = [
    { id: 'indigo', label: 'Ocean', primary: '#6366f1', bg: '#eef2ff' },
    { id: 'emerald', label: 'Forest', primary: '#10b981', bg: '#ecfdf5' },
    { id: 'violet', label: 'Royal', primary: '#8b5cf6', bg: '#f5f3ff' },
    { id: 'rose', label: 'Rose', primary: '#f43f5e', bg: '#fff1f2' },
    { id: 'amber', label: 'Sunrise', primary: '#f59e0b', bg: '#fffbeb' },
    { id: 'slate', label: 'Carbon', primary: '#475569', bg: '#f8fafc' },
];

const themeOf = (tid) => THEMES.find(t => t.id === tid) || THEMES[0];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusBadge = (status) => {
    if (status === 'published') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Live' };
    if (status === 'closed') return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Closed' };
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Draft' };
};

const shortLink = (token) => `${window.location.origin}/s/${token}`;

// ─── NPS Preview Widget ───────────────────────────────────────────────────────
const NPSWidget = ({ value, onChange }) => (
    <div className="space-y-2">
        <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => (
                <button key={i} type="button" onClick={() => onChange && onChange(i)}
                    className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all ${value === i
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-400'}`}>
                    {i}
                </button>
            ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 px-1">
            <span>Not at all likely</span><span>Extremely likely</span>
        </div>
    </div>
);

// ─── CSAT / Rating Preview Widget ────────────────────────────────────────────
const StarWidget = ({ max = 5, value, onChange, labels = {} }) => (
    <div className="space-y-2">
        <div className="flex gap-2">
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                <button key={n} type="button" onClick={() => onChange && onChange(n)}
                    className={`w-10 h-10 rounded-xl border-2 text-base font-bold transition-all ${value === n
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-400'}`}>
                    {value >= n ? '★' : '☆'}
                </button>
            ))}
        </div>
        {Object.keys(labels).length > 0 && (
            <div className="flex justify-between text-[10px] text-gray-400 px-1">
                <span>{labels['1']}</span><span>{labels[String(max)]}</span>
            </div>
        )}
    </div>
);

// ─── Question Editor ──────────────────────────────────────────────────────────
const QuestionEditor = ({ question, index, total, onChange, onRemove, onMove }) => {
    const qtype = QUESTION_TYPES.find(t => t.id === question.question_type);
    const [localChoices, setLocalChoices] = useState(
        (question.config?.choices || ['Option A', 'Option B']).join('\n')
    );

    const updateConfig = (key, val) => {
        onChange({ ...question, config: { ...(question.config || {}), [key]: val } });
    };

    const handleChoicesChange = (text) => {
        setLocalChoices(text);
        const arr = text.split('\n').map(s => s.trim()).filter(Boolean);
        if (arr.length) updateConfig('choices', arr);
    };

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
            <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button className="p-1 text-gray-300 hover:text-gray-500 cursor-grab" title="Drag to reorder">
                        <GripVertical size={16} />
                    </button>
                    <span className="text-xs font-bold text-gray-400">Q{index + 1}</span>
                    {qtype && (
                        <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-gray-200 ${qtype.color}`}>
                            <qtype.icon size={11} />{qtype.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => onMove(index, -1)} disabled={index === 0}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-white disabled:opacity-30 transition-colors"><ChevronUp size={14} /></button>
                    <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-white disabled:opacity-30 transition-colors"><ChevronDown size={14} /></button>
                    <button onClick={() => onRemove(index)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                </div>
            </div>
            <div className="p-4 space-y-3">
                <input
                    type="text"
                    value={question.title}
                    onChange={e => onChange({ ...question, title: e.target.value })}
                    placeholder="Question text..."
                    className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-200 focus:border-indigo-400 focus:outline-none pb-1 placeholder-gray-300"
                />
                <input
                    type="text"
                    value={question.description || ''}
                    onChange={e => onChange({ ...question, description: e.target.value })}
                    placeholder="Optional description or helper text..."
                    className="w-full text-xs text-gray-500 bg-transparent border-none focus:outline-none placeholder-gray-300"
                />

                {/* Type-specific config */}
                {question.question_type === 'multiple_choice' && (
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Options (one per line)</label>
                        <textarea rows={4} value={localChoices} onChange={e => handleChoicesChange(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none resize-none font-mono" />
                        <div className="flex items-center gap-2 mt-2">
                            <input type="checkbox" id={`multi-${index}`} checked={question.config?.allow_multiple || false}
                                onChange={e => updateConfig('allow_multiple', e.target.checked)} />
                            <label htmlFor={`multi-${index}`} className="text-xs text-gray-600">Allow multiple selections</label>
                        </div>
                    </div>
                )}
                {question.question_type === 'rating' && (
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Max Scale</label>
                            <select value={question.config?.max || 5} onChange={e => updateConfig('max', parseInt(e.target.value))}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-400 outline-none">
                                {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                    </div>
                )}
                {(question.question_type === 'csat' || question.question_type === 'nps') && (
                    <p className="text-xs text-indigo-500 font-medium">
                        {question.question_type === 'nps' ? '0–10 scale (preset)' : '1–5 satisfaction scale (preset)'}
                    </p>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                    <input type="checkbox" id={`req-${index}`} checked={!!question.is_required}
                        onChange={e => onChange({ ...question, is_required: e.target.checked })} />
                    <label htmlFor={`req-${index}`} className="text-xs text-gray-500">Required</label>
                </div>
            </div>
        </div>
    );
};

// ─── Survey Preview ───────────────────────────────────────────────────────────
const SurveyPreview = ({ survey, questions }) => {
    const theme = themeOf(survey.theme || 'indigo');
    const [answers, setAnswers] = useState({});

    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm min-h-full">
                {/* Header bar */}
                <div className="h-2" style={{ backgroundColor: theme.primary }} />
                <div className="px-6 pt-6 pb-4" style={{ backgroundColor: theme.bg }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: theme.primary }}>
                        {survey.branding_name || 'Survey Preview'}
                    </p>
                    <h2 className="text-lg font-black text-gray-900">{survey.title || 'Untitled Survey'}</h2>
                    {survey.description && <p className="text-sm text-gray-600 mt-1">{survey.description}</p>}
                </div>
                <div className="px-6 py-4 space-y-6">
                    {questions.length === 0 && (
                        <div className="text-center py-8 text-gray-300">
                            <MessageSquare size={32} className="mx-auto mb-2" />
                            <p className="text-sm">Add questions to see a preview</p>
                        </div>
                    )}
                    {questions.map((q, i) => {
                        const val = answers[String(i)];
                        const setVal = (v) => setAnswers(a => ({ ...a, [String(i)]: v }));
                        return (
                            <div key={i} className="space-y-3">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">
                                        {i + 1}. {q.title || '(untitled)'}
                                        {q.is_required && <span className="text-red-400 ml-1">*</span>}
                                    </p>
                                    {q.description && <p className="text-xs text-gray-500 mt-0.5">{q.description}</p>}
                                </div>
                                {q.question_type === 'nps' && <NPSWidget value={val} onChange={setVal} />}
                                {(q.question_type === 'csat') && (
                                    <StarWidget max={5} value={val} onChange={setVal} labels={q.config?.labels || {}} />
                                )}
                                {q.question_type === 'rating' && (
                                    <StarWidget max={q.config?.max || 5} value={val} onChange={setVal} />
                                )}
                                {q.question_type === 'text' && (
                                    <textarea rows={3} value={val || ''} onChange={e => setVal(e.target.value)}
                                        placeholder="Your answer..."
                                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none resize-none" />
                                )}
                                {q.question_type === 'yes_no' && (
                                    <div className="flex gap-3">
                                        {['Yes', 'No'].map(opt => (
                                            <button key={opt} type="button" onClick={() => setVal(opt.toLowerCase())}
                                                className={`px-6 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${val === opt.toLowerCase()
                                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-400'}`}>
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {q.question_type === 'multiple_choice' && (
                                    <div className="space-y-2">
                                        {(q.config?.choices || []).map((ch, ci) => (
                                            <button key={ci} type="button"
                                                onClick={() => {
                                                    if (q.config?.allow_multiple) {
                                                        const prev = Array.isArray(val) ? val : [];
                                                        setVal(prev.includes(ch) ? prev.filter(v => v !== ch) : [...prev, ch]);
                                                    } else {
                                                        setVal(ch);
                                                    }
                                                }}
                                                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm border-2 transition-all ${(q.config?.allow_multiple ? (Array.isArray(val) && val.includes(ch)) : val === ch)
                                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800 font-semibold'
                                                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'}`}>
                                                {ch}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {questions.length > 0 && (
                        <button className="w-full py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all hover:opacity-90 mt-4"
                            style={{ backgroundColor: theme.primary }}>
                            Submit Response
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Analytics View ───────────────────────────────────────────────────────────
const AnalyticsView = ({ survey, userId, onBack }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await apiFetch(`${API_BASE}/api/surveys/${survey.id}/analytics`);
                setData(await res.json());
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, [survey.id, userId]);

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-200 text-gray-600 transition-colors"><ArrowLeft size={18} /></button>
                    <div>
                        <h2 className="text-lg font-black text-gray-900">{survey.title}</h2>
                        <p className="text-xs text-gray-400">{data?.total_responses ?? '…'} total responses</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>
                ) : data && Object.keys(data.questions || {}).length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <BarChart3 size={36} className="mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-400">No responses yet</p>
                    </div>
                ) : (
                    Object.entries(data?.questions || {}).map(([qid, qa]) => (
                        <div key={qid} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h3 className="font-bold text-gray-900 mb-1">{qa.title}</h3>
                            <p className="text-xs text-gray-400 mb-4">{qa.total} responses</p>

                            {/* NPS */}
                            {qa.type === 'nps' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className={`text-4xl font-black ${qa.nps_score >= 50 ? 'text-emerald-600' : qa.nps_score >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                                {qa.nps_score > 0 ? '+' : ''}{qa.nps_score}
                                            </p>
                                            <p className="text-xs text-gray-400 font-semibold">NPS Score</p>
                                        </div>
                                        <div className="flex gap-4 text-sm">
                                            {[
                                                { label: 'Promoters', count: qa.promoters, color: 'text-emerald-600' },
                                                { label: 'Passives', count: qa.passives, color: 'text-amber-500' },
                                                { label: 'Detractors', count: qa.detractors, color: 'text-red-500' },
                                            ].map(k => (
                                                <div key={k.label} className="text-center">
                                                    <p className={`text-2xl font-black ${k.color}`}>{k.count}</p>
                                                    <p className="text-xs text-gray-400">{k.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={100}>
                                        <BarChart data={Array.from({ length: 11 }, (_, i) => ({ score: i, count: qa.distribution?.[String(i)] || 0 }))}>
                                            <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                                            <YAxis hide />
                                            <Tooltip />
                                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                {Array.from({ length: 11 }, (_, i) => (
                                                    <Cell key={i} fill={i >= 9 ? '#10b981' : i >= 7 ? '#f59e0b' : '#f43f5e'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Rating / CSAT */}
                            {(qa.type === 'rating' || qa.type === 'csat') && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-4xl font-black text-indigo-600">{qa.average}</span>
                                        <div>
                                            <p className="text-xs text-gray-400">Average Score</p>
                                            <div className="flex mt-1">
                                                {Array.from({ length: Object.keys(qa.distribution || {}).length }, (_, i) => i + 1).map(n => (
                                                    <Star key={n} size={14} className={n <= Math.round(qa.average) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={100}>
                                        <BarChart data={Object.entries(qa.distribution || {}).map(([k, v]) => ({ label: k, count: v }))}>
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                            <YAxis hide />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Multiple Choice */}
                            {qa.type === 'multiple_choice' && (
                                <div className="space-y-2">
                                    {Object.entries(qa.counts || {}).sort((a, b) => b[1] - a[1]).map(([opt, cnt], i) => (
                                        <div key={opt} className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-sm text-gray-700 flex-1">{opt}</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[200px]">
                                                <div className="h-2 rounded-full" style={{ width: `${Math.round(cnt / Math.max(qa.total, 1) * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                            </div>
                                            <span className="text-xs font-bold text-gray-600 min-w-[30px] text-right">{cnt}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Yes / No */}
                            {qa.type === 'yes_no' && (
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <p className="text-4xl font-black text-emerald-600">{qa.yes_pct}%</p>
                                        <p className="text-xs text-gray-400">Said Yes</p>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex h-6 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500 transition-all" style={{ width: `${qa.yes_pct}%` }} />
                                            <div className="bg-red-400 flex-1" />
                                        </div>
                                        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                            <span>Yes ({qa.yes})</span><span>No ({qa.no})</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Text / Open-ended */}
                            {qa.type === 'text' && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {(qa.answers || []).slice(0, 20).map((ans, i) => (
                                        <div key={i} className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-100">{ans}</div>
                                    ))}
                                    {qa.total > 20 && <p className="text-xs text-gray-400 text-center">+{qa.total - 20} more answers</p>}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// ─── Survey Builder Editor ────────────────────────────────────────────────────
const SurveyEditor = ({ survey: initialSurvey, userId, onBack, onUpdated }) => {
    const [survey, setSurvey] = useState(initialSurvey);
    const [questions, setQuestions] = useState(initialSurvey.questions || []);
    const [activePanel, setActivePanel] = useState('build'); // build | preview | analytics | settings
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState(null);
    const saveTimer = useRef(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 2500);
    };

    const saveQuestions = useCallback(async (qs) => {
        try {
            await apiFetch(`${API_BASE}/api/surveys/${survey.id}/questions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: qs })
            });
        } catch (e) { console.error(e); }
    }, [survey.id]);

    const handleQuestionChange = (index, updated) => {
        const newQs = [...questions];
        newQs[index] = updated;
        setQuestions(newQs);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveQuestions(newQs), 800);
    };

    const handleAddQuestion = (type) => {
        const defaults = {
            nps: { title: 'How likely are you to recommend us?', config: { min: 0, max: 10 } },
            csat: { title: 'How satisfied are you with your experience?', config: { min: 1, max: 5, labels: { '1': 'Very Unsatisfied', '5': 'Very Satisfied' } } },
            rating: { title: 'How would you rate this?', config: { min: 1, max: 5 } },
            text: { title: 'Tell us more...', config: {} },
            multiple_choice: { title: 'Which of these best applies?', config: { choices: ['Option A', 'Option B', 'Option C'], allow_multiple: false } },
            yes_no: { title: 'Would you recommend us?', config: {} },
        };
        const newQ = {
            question_type: type,
            title: defaults[type]?.title || '',
            description: '',
            is_required: false,
            config: defaults[type]?.config || {}
        };
        const newQs = [...questions, newQ];
        setQuestions(newQs);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveQuestions(newQs), 800);
    };

    const handleRemoveQuestion = (index) => {
        const newQs = questions.filter((_, i) => i !== index);
        setQuestions(newQs);
        saveQuestions(newQs);
    };

    const handleMove = (index, dir) => {
        const newQs = [...questions];
        const target = index + dir;
        if (target < 0 || target >= newQs.length) return;
        [newQs[index], newQs[target]] = [newQs[target], newQs[index]];
        setQuestions(newQs);
        saveQuestions(newQs);
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await apiFetch(`${API_BASE}/api/surveys/${survey.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: survey.title, description: survey.description, theme: survey.theme, branding_name: survey.branding_name })
            });
            onUpdated();
            showToast('Settings saved');
        } catch (e) { showToast('Save failed', 'error'); }
        finally { setSaving(false); }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            // Save questions first
            await saveQuestions(questions);
            const res = await apiFetch(`${API_BASE}/api/surveys/${survey.id}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // Empty body or relevant data, not userId directly
            });
            const data = await res.json();
            setSurvey(s => ({ ...s, status: data.status }));
            onUpdated();
            showToast(data.status === 'published' ? '🎉 Survey is now live!' : 'Survey unpublished');
        } catch (e) { showToast('Publish failed', 'error'); }
        finally { setPublishing(false); }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shortLink(survey.token)).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isPublished = survey.status === 'published';
    const sba = statusBadge(survey.status);

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
            {/* Topbar */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"><ArrowLeft size={18} /></button>
                <div className="flex-1 min-w-0">
                    <input value={survey.title} onChange={e => setSurvey(s => ({ ...s, title: e.target.value }))}
                        className="text-base font-bold text-gray-900 bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-indigo-400 focus:outline-none w-full" />
                </div>
                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${sba.bg} ${sba.text}`}>{sba.label}</span>
                <div className="flex items-center gap-2">
                    {['build', 'preview', 'analytics', 'settings'].map(p => (
                        <button key={p} onClick={() => setActivePanel(p)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${activePanel === p ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                            {p}
                        </button>
                    ))}
                </div>
                {isPublished && (
                    <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
                        {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied!' : 'Copy Link'}
                    </button>
                )}
                <button onClick={handlePublish} disabled={publishing}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-60 ${isPublished ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}>
                    {publishing ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                    {isPublished ? 'Unpublish' : 'Publish'}
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Build Panel */}
                {activePanel === 'build' && (
                    <>
                        {/* Question List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {questions.length === 0 && (
                                <div className="text-center py-16 text-gray-300">
                                    <ClipboardList size={40} className="mx-auto mb-3" />
                                    <p className="text-sm font-medium">No questions yet</p>
                                    <p className="text-xs mt-1">Add a question from the right panel</p>
                                </div>
                            )}
                            {questions.map((q, i) => (
                                <QuestionEditor key={i} question={q} index={i} total={questions.length}
                                    onChange={(upd) => handleQuestionChange(i, upd)}
                                    onRemove={handleRemoveQuestion}
                                    onMove={handleMove} />
                            ))}
                        </div>

                        {/* Add Question Sidebar */}
                        <div className="w-52 border-l border-gray-100 bg-white p-4 flex-shrink-0">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Add Question</p>
                            <div className="space-y-2">
                                {QUESTION_TYPES.map(qt => (
                                    <button key={qt.id} onClick={() => handleAddQuestion(qt.id)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all ${qt.color}`}>
                                        <qt.icon size={13} />{qt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Preview Panel */}
                {activePanel === 'preview' && <SurveyPreview survey={survey} questions={questions} />}

                {/* Analytics Panel */}
                {activePanel === 'analytics' && <AnalyticsView survey={survey} userId={userId} onBack={() => setActivePanel('build')} />}

                {/* Settings Panel */}
                {activePanel === 'settings' && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-lg space-y-6">
                            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                                <h3 className="font-bold text-gray-900">Survey Settings</h3>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Title</label>
                                    <input value={survey.title} onChange={e => setSurvey(s => ({ ...s, title: e.target.value }))}
                                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                                    <textarea rows={3} value={survey.description || ''}
                                        onChange={e => setSurvey(s => ({ ...s, description: e.target.value }))}
                                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Brand Name</label>
                                    <input value={survey.branding_name || ''}
                                        onChange={e => setSurvey(s => ({ ...s, branding_name: e.target.value }))}
                                        placeholder="Your company name"
                                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-2">Theme Color</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {THEMES.map(t => (
                                            <button key={t.id} onClick={() => setSurvey(s => ({ ...s, theme: t.id }))}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${survey.theme === t.id ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: t.primary }} title={t.label} />
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleSaveSettings} disabled={saving}
                                    className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Settings
                                </button>
                            </div>

                            {/* Share section */}
                            {isPublished && (
                                <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2"><Share2 size={16} className="text-indigo-500" /> Share Your Survey</h3>
                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                                        <Globe size={13} className="text-indigo-400 flex-shrink-0" />
                                        <span className="text-xs text-gray-600 flex-1 truncate font-mono">{shortLink(survey.token)}</span>
                                        <button onClick={handleCopyLink}
                                            className="text-indigo-600 hover:text-indigo-800 flex-shrink-0">
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 mb-1">Embed code</p>
                                        <div className="bg-gray-900 rounded-xl p-3 font-mono text-[10px] text-green-400 overflow-x-auto">
                                            {`<iframe src="${shortLink(survey.token)}" width="100%" height="600" frameborder="0"></iframe>`}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    <CheckCircle2 size={15} />{toast.msg}
                </div>
            )}
        </div>
    );
};

// ─── Main SurveyBuilder View ──────────────────────────────────────────────────
const SurveyBuilder = ({ user, activeWorkspace }) => {
    const userId = user?.id || 1;
    const workspaceId = activeWorkspace?.id || null;

    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSurvey, setActiveSurvey] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selectedType, setSelectedType] = useState('custom');
    const [newTitle, setNewTitle] = useState('');

    const fetchSurveys = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/surveys?${workspaceId ? `workspace_id=${workspaceId}` : ''}`);
            const data = await res.json();
            setSurveys(data.surveys || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [workspaceId]);

    useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        setCreating(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/surveys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, workspace_id: workspaceId, title: newTitle, survey_type: selectedType })
            });
            const data = await res.json();
            if (data.survey) {
                setActiveSurvey(data.survey);
                setShowCreate(false);
                setNewTitle('');
                fetchSurveys();
            }
        } catch (e) { console.error(e); }
        finally { setCreating(false); }
    };

    const handleDelete = async (surveyId) => {
        if (!window.confirm('Delete this survey and all its responses?')) return;
        await apiFetch(`${API_BASE}/api/surveys/${surveyId}?user_id=${userId}`, { method: 'DELETE' });
        fetchSurveys();
    };

    if (activeSurvey) {
        return <SurveyEditor survey={activeSurvey} userId={userId}
            onBack={() => { setActiveSurvey(null); fetchSurveys(); }}
            onUpdated={fetchSurveys} />;
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50 overflow-y-auto">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Survey Builder</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Create CSAT, NPS & custom questionnaires</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                    <Plus size={15} /> New Survey
                </button>
            </div>

            {/* KPI Bar */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 flex-shrink-0">
                {[
                    { label: 'Total Surveys', value: surveys.length, icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Live Surveys', value: surveys.filter(s => s.status === 'published').length, icon: Globe, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Total Responses', value: surveys.reduce((acc, s) => acc + (s.response_count || 0), 0), icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
                ].map(k => (
                    <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
                            <k.icon size={18} className={k.color} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
                            <p className="text-2xl font-black text-gray-900 mt-0.5">{k.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Survey List */}
            <div className="px-6 pb-6 flex-1">
                {loading ? (
                    <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                        <Loader2 size={26} className="text-indigo-500 animate-spin" />
                    </div>
                ) : surveys.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
                        <ClipboardList size={44} className="mx-auto mb-4 text-gray-200" />
                        <h3 className="text-base font-semibold text-gray-600">No surveys yet</h3>
                        <p className="text-sm text-gray-400 mt-1 mb-5">Create your first NPS, CSAT or custom survey</p>
                        <button onClick={() => setShowCreate(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                            <Plus size={15} /> Create Survey
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {surveys.map(s => {
                            const sba = statusBadge(s.status);
                            const theme = themeOf(s.theme || 'indigo');
                            const typeIcon = SURVEY_TYPES.find(t => t.id === s.survey_type)?.emoji || '📋';
                            return (
                                <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
                                    onClick={() => setActiveSurvey(s)}>
                                    <div className="h-1.5" style={{ backgroundColor: theme.primary }} />
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <span className="text-2xl">{typeIcon}</span>
                                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${sba.bg} ${sba.text}`}>{sba.label}</span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-sm group-hover:text-indigo-700 transition-colors leading-snug">{s.title}</h3>
                                        {s.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.description}</p>}

                                        <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><MessageSquare size={11} />{s.question_count || 0} questions</span>
                                            <span className="flex items-center gap-1"><Users size={11} />{s.response_count || 0} responses</span>
                                        </div>

                                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
                                            <button onClick={(e) => { e.stopPropagation(); setActiveSurvey(s); }}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
                                                <Edit3 size={12} /> Edit
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setActiveSurvey({ ...s, _startTab: 'analytics' }); }}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                                <BarChart3 size={12} /> Results
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Survey Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
                            <h3 className="text-base font-bold text-gray-900">Create New Survey</h3>
                            <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/80 text-gray-400"><X size={16} /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Type Selector */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Survey Type</p>
                                {SURVEY_TYPES.map(t => (
                                    <button key={t.id} onClick={() => { setSelectedType(t.id); if (!newTitle || SURVEY_TYPES.some(x => x.label === newTitle)) setNewTitle(t.label); }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedType === t.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-indigo-300'}`}>
                                        <span className="text-2xl">{t.emoji}</span>
                                        <div>
                                            <p className={`text-sm font-bold ${selectedType === t.id ? 'text-indigo-800' : 'text-gray-700'}`}>{t.label}</p>
                                            <p className="text-xs text-gray-400">{t.description}</p>
                                        </div>
                                        {selectedType === t.id && <Check size={16} className="ml-auto text-indigo-600 flex-shrink-0" />}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Survey Title</label>
                                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                    placeholder="e.g. Q2 2026 NPS Survey"
                                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                    className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setShowCreate(false)}
                                    className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                                <button onClick={handleCreate} disabled={!newTitle.trim() || creating}
                                    className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Survey
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SurveyBuilder;
