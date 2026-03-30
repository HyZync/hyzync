import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

const API_BASE = '';

const STEPS = [
  { id: 1, title: 'Connect Data', hint: 'Curiosity' },
  { id: 2, title: 'Analyze Silently', hint: 'No complexity' },
  { id: 3, title: 'Aha Screen', hint: 'Core value' },
  { id: 4, title: 'Drill-down', hint: 'Optional depth' },
  { id: 5, title: 'Action', hint: 'Ship insights' },
];

const RULES = [
  { id: 'pricing', label: 'Pricing', keys: ['price', 'pricing', 'expensive', 'cost', 'billing'], fix: 'Clarify packaging and value framing.', seg: 'Long-term users' },
  { id: 'feature', label: 'Missing feature X', keys: ['missing', 'feature', 'integration', 'capability'], fix: 'Prioritize the most requested feature gap.', seg: 'Pro plan users' },
  { id: 'onboarding', label: 'Onboarding confusion', keys: ['onboarding', 'setup', 'start', 'confusing', 'figure out'], fix: 'Simplify first-session onboarding steps.', seg: 'New users' },
  { id: 'stability', label: 'Reliability issues', keys: ['bug', 'crash', 'slow', 'error', 'performance'], fix: 'Fix top reliability regressions by impact.', seg: 'All segments' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (v) => String(v || '').trim();

const inferSegment = (t) => {
  const s = t.toLowerCase();
  if (/(new user|first time|onboarding|getting started)/.test(s)) return 'New users';
  if (/(pro|enterprise|team plan|advanced)/.test(s)) return 'Pro plan users';
  if (/(renew|renewal|annual|subscription|long term)/.test(s)) return 'Long-term users';
  return 'General users';
};

const classify = (entry) => {
  const s = entry.text.toLowerCase();
  let best = { rule: RULES[RULES.length - 1], score: 0 };
  RULES.forEach((rule) => {
    const score = rule.keys.reduce((n, k) => (s.includes(k) ? n + 1 : n), 0);
    if (score > best.score) best = { rule, score };
  });
  return {
    ...entry,
    driverId: best.rule.id,
    driver: best.rule.label,
    fix: best.rule.fix,
    segment: inferSegment(entry.text) || best.rule.seg,
  };
};

const summarize = (entries) => {
  const rows = entries.filter((e) => e.text.length > 4).map(classify);
  const total = Math.max(rows.length, 1);
  const driverBuckets = new Map();
  const segmentBuckets = new Map();
  rows.forEach((r) => {
    const d = driverBuckets.get(r.driverId) || { id: r.driverId, label: r.driver, fix: r.fix, items: [] };
    d.items.push(r);
    driverBuckets.set(r.driverId, d);
    segmentBuckets.set(r.segment, (segmentBuckets.get(r.segment) || 0) + 1);
  });
  const topDrivers = Array.from(driverBuckets.values())
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, 3)
    .map((d, i) => ({
      ...d,
      pct: Math.max(1, Math.round((d.items.length / total) * 100)),
      impact: i === 0 ? 'High impact, easy fix' : i === 1 ? 'High impact, medium effort' : 'Medium impact',
    }));
  const affected = Array.from(segmentBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([segment, count]) => ({ segment, pct: Math.max(1, Math.round((count / total) * 100)) }));
  const quotes = rows.slice(0, 6).map((r) => ({ text: r.text.length > 180 ? `${r.text.slice(0, 177)}...` : r.text, source: r.source, driverId: r.driverId }));
  return { total: rows.length, topDrivers, affected, quotes, rows };
};

const parseConnected = (data) =>
  (Array.isArray(data?.items) ? data.items : [])
    .map((i, idx) => ({ id: i?.id || `api-${idx}`, text: text(i?.content || i?.text || i?.feedback), source: i?.source_name || i?.source_type || 'Connected source' }))
    .filter((e) => e.text.length > 4);

const parseLines = (raw, source) =>
  String(raw || '')
    .split(/\r?\n/)
    .map((line, idx) => ({ id: `${source}-${idx}`, text: text(line), source }))
    .filter((e) => e.text.length > 4);

const StepPill = ({ step, current }) => {
  const done = current > step.id;
  const active = current === step.id;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className={`text-[11px] font-bold ${done ? 'text-emerald-700' : active ? 'text-slate-900' : 'text-slate-500'}`}>{step.title}</p>
      <p className="text-[10px] text-slate-400">{step.hint}</p>
    </div>
  );
};

const FeedbackCRMFlow = ({ user }) => {
  const [step, setStep] = useState(1);
  const [includeConnected, setIncludeConnected] = useState(true);
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/api/fi/connectors`);
        if (!res.ok || !active) return;
        const data = await res.json();
        setConnectedCount((data?.connectors || []).length);
      } catch (_e) {
        if (active) setConnectedCount(0);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedDriver = useMemo(() => {
    if (!analysis?.topDrivers?.length) return null;
    return analysis.topDrivers.find((d) => d.id === selectedDriverId) || analysis.topDrivers[0];
  }, [analysis, selectedDriverId]);

  const drillRows = useMemo(() => {
    if (!analysis || !selectedDriver) return [];
    return analysis.rows.filter((r) => r.driverId === selectedDriver.id).slice(0, 80);
  }, [analysis, selectedDriver]);

  const run = async () => {
    setError('');
    setNotice('');
    setStep(2);
    setProgress(12);
    setProgressLabel('Collecting sources...');

    let connected = [];
    if (includeConnected) {
      try {
        const res = await apiFetch(`${API_BASE}/api/fi/feedback?limit=500`);
        if (res.ok) connected = parseConnected(await res.json());
      } catch (_e) {
        connected = [];
      }
    }

    let uploaded = [];
    if (file) {
      try {
        const raw = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(String(e?.target?.result || ''));
          reader.onerror = () => reject(new Error('read error'));
          reader.readAsText(file);
        });
        uploaded = parseLines(raw, file.name || 'Uploaded file');
      } catch (_e) {
        uploaded = [];
      }
    }

    const local = parseLines(pasted, 'Pasted feedback');
    const all = [...connected, ...uploaded, ...local];
    if (!all.length) {
      setStep(1);
      setError('Add connected data, pasted feedback, or a file before analysis.');
      return;
    }

    await sleep(450);
    setProgress(42);
    setProgressLabel('Cleaning and unifying data...');
    await sleep(500);
    setProgress(74);
    setProgressLabel(`Analyzing ${all.length.toLocaleString()} feedback entries...`);
    const result = summarize(all);
    await sleep(450);
    setProgress(100);
    setProgressLabel('Preparing your Aha screen...');
    setAnalysis(result);
    setSelectedDriverId(result.topDrivers[0]?.id || '');
    setStep(3);
  };

  const report = useMemo(() => {
    if (!analysis) return '';
    const lines = [
      'Feedback CRM - Aha Summary',
      `Generated for: ${user?.name || 'Workspace user'}`,
      `Analyzed entries: ${analysis.total}`,
      '',
      'Top churn drivers:',
      ...analysis.topDrivers.map((d) => `- ${d.label}: ${d.pct}%`),
      '',
      'Who is affected:',
      ...analysis.affected.map((a) => `- ${a.segment}: ${a.pct}%`),
      '',
      'Sample quotes:',
      ...analysis.quotes.slice(0, 4).map((q) => `- "${q.text}" (${q.source})`),
    ];
    return lines.join('\n');
  }, [analysis, user?.name]);

  const copy = async (content, okMsg) => {
    try {
      await navigator.clipboard.writeText(content);
      setNotice(okMsg);
    } catch (_e) {
      setNotice('Could not copy automatically.');
    }
  };

  const exportTxt = () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feedback-crm-aha-report.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotice('Report exported.');
  };

  const mailShare = () => {
    const subject = encodeURIComponent('Feedback CRM Insight Summary');
    const body = encodeURIComponent(report);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fa] p-8 custom-scrollbar">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-xl font-black text-slate-900">Feedback CRM</h1>
          <p className="mt-1 text-sm text-slate-500">A 5-step flow: connect, analyze, aha, drill down, and act.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-5">{STEPS.map((s) => <StepPill key={s.id} step={s} current={step} />)}</div>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><div className="flex items-center gap-2"><AlertCircle size={16} />{error}</div></div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><div className="flex items-center gap-2"><CheckCircle2 size={16} />{notice}</div></div> : null}

        {step === 1 && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Step 1</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Connect or upload data</h2>
              <p className="mt-1 text-sm text-slate-500">Keep it simple: connected sources, pasted feedback, or a CSV/TXT upload.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">Connected sources</p>
                <p className="mt-1 text-xs text-slate-500">{connectedCount} connector(s) are available.</p>
                <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={includeConnected} onChange={(e) => setIncludeConnected(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  Use connected sources
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">Upload feedback file</p>
                <p className="mt-1 text-xs text-slate-500">Upload CSV/TXT. Each line is treated as feedback input.</p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-400">
                  <Upload size={14} />
                  {file ? file.name : 'Choose file'}
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Paste feedback</label>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={'Too expensive for what it offers\nI could not figure out how to start\nMissing integration with our stack'}
                className="mt-2 min-h-[130px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <button onClick={run} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-slate-800">
                <Sparkles size={14} />
                Analyze Feedback
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Step 2</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Processing silently</h2>
            <p className="mt-2 text-sm text-slate-500">{progressLabel}</p>
            <div className="mx-auto mt-6 flex max-w-md items-center gap-3">
              <Loader2 size={18} className="animate-spin text-slate-600" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-600">{progress}%</span>
            </div>
          </div>
        )}

        {step === 3 && analysis && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Step 3</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Aha Screen</h2>
                <p className="mt-1 text-sm text-slate-500">Why users are leaving and what to fix now.</p>
              </div>
              <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{analysis.total.toLocaleString()} analyzed</span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">Top churn drivers</h3>
                <div className="mt-3 space-y-2">
                  {analysis.topDrivers.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setSelectedDriverId(d.id);
                        setStep(4);
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300"
                    >
                      <span className="text-sm font-semibold text-slate-900">{d.label}</span>
                      <span className="text-sm font-black text-slate-700">{d.pct}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">What to fix first</h3>
                <div className="mt-3 space-y-3">
                  {analysis.topDrivers.map((d) => (
                    <div key={d.id} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                      <p className="text-sm font-bold text-slate-900">{d.label}</p>
                      <p className="mt-1 text-xs text-slate-600">{d.fix}</p>
                      <p className="mt-2 text-[11px] font-semibold text-slate-500">{d.impact}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">Who is affected</h3>
                <div className="mt-3 space-y-2">
                  {analysis.affected.map((a) => (
                    <div key={a.segment} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{a.segment}</p>
                      <p className="text-xs font-bold text-slate-600">{a.pct}%</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">Real user quotes</h3>
                <div className="mt-3 space-y-2">
                  {analysis.quotes.slice(0, 4).map((q, idx) => (
                    <blockquote key={`${q.driverId}-${idx}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm italic text-slate-700">
                      "{q.text}"
                    </blockquote>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <button onClick={() => setStep(4)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400">Drill-down</button>
              <button onClick={() => setStep(5)} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-slate-800">Action Layer</button>
            </div>
          </div>
        )}

        {step === 4 && analysis && selectedDriver && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Step 4</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Drill-down: {selectedDriver.label}</h2>
                <p className="mt-1 text-sm text-slate-500">Optional detail by driver, not forced complexity.</p>
              </div>
              <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400">
                <ArrowLeft size={14} />
                Back to Aha screen
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {analysis.topDrivers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDriverId(d.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      d.id === selectedDriver.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-semibold">{d.label}</p>
                    <p className="text-[11px] opacity-80">{d.pct}% of churn mentions</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">{drillRows.length} related feedback entries</p>
                <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {drillRows.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm text-slate-700">{r.text}</p>
                      <p className="mt-2 text-[11px] text-slate-500">{r.segment} • {r.source}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <button onClick={() => setStep(5)} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-slate-800">Move to action</button>
            </div>
          </div>
        )}

        {step === 5 && analysis && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Step 5</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Action layer</h2>
              <p className="mt-1 text-sm text-slate-500">Export, share, or copy insights for your team.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button onClick={exportTxt} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400"><Download size={16} />Export report</button>
              <button onClick={mailShare} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400"><Send size={16} />Share with team</button>
              <button onClick={() => copy(report, 'Insights copied.')} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400"><Copy size={16} />Copy insights</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => copy(`Title: [Feedback] Address ${analysis.topDrivers[0]?.label || 'top churn driver'}\n\nContext:\n${report}`, 'Jira ticket draft copied.')}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                <FileText size={16} />
                Create Jira ticket draft
              </button>
              <button onClick={mailShare} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"><Mail size={16} />Send to product team</button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"><ArrowLeft size={14} />Back to Aha screen</button>
              <button
                onClick={() => {
                  setStep(1);
                  setAnalysis(null);
                  setSelectedDriverId('');
                  setError('');
                  setNotice('');
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
              >
                Start new analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackCRMFlow;
