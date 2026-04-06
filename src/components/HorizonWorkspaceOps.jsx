import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  Shield,
  User,
  Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiFetch } from '../utils/api';

const API_BASE = '';
const INTERVAL_OPTIONS = ['manual', 'hourly', 'daily', 'weekly'];
const PLAN_STATUS_OPTIONS = ['active', 'trialing', 'past_due', 'paused', 'cancelled'];
const SECURITY_OPTIONS = ['standard', 'strict', 'enterprise'];
const EXPORT_OPTIONS = ['zip', 'csv', 'json', 'pdf'];
const DOC_ICON_MAP = { Zap, Database, Cpu, Settings, DollarSign, Shield, FileText };

const fieldClassName = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const textareaClassName = `${fieldClassName} min-h-[92px] resize-none`;
const cardClassName = 'rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm';

const buildPreviewDocs = () => ([
  {
    slug: 'getting-started-guide',
    title: 'Getting Started Guide',
    category: 'setup',
    summary: 'Preview the production checklist for a clean workspace launch.',
    estimated_minutes: 5,
    icon: 'Zap',
    body: '# Getting Started\n\nUse one workspace per product or business stream. Add connectors, sync data, calibrate filters, then launch analysis.',
  },
  {
    slug: 'connecting-data-sources',
    title: 'Connecting Data Sources',
    category: 'connectors',
    summary: 'Preview how production connectors should be configured and scheduled.',
    estimated_minutes: 6,
    icon: 'Database',
    body: '# Connecting Data Sources\n\nUse stable identifiers, clear display names, and explicit fetch and analysis intervals for every source.',
  },
  {
    slug: 'understanding-health-metrics',
    title: 'Understanding Health Metrics',
    category: 'analysis',
    summary: 'Preview how to interpret executive signals and health trends.',
    estimated_minutes: 5,
    icon: 'Cpu',
    body: '# Understanding Health Metrics\n\nReview sentiment, executive summary, retention signals, and prioritization outputs together before acting.',
  },
  {
    slug: 'exporting-reports',
    title: 'Exporting Reports',
    category: 'api',
    summary: 'Preview how export-ready analysis packages should be used operationally.',
    estimated_minutes: 5,
    icon: 'FileText',
    body: '# Exporting Reports\n\nExport completed analyses for audit history, stakeholder review, and downstream reporting workflows.',
  },
]);

const buildConnectorDrafts = (connectors = []) => {
  const drafts = {};
  connectors.forEach((connector) => {
    const config = connector?.config || {};
    const endpointFallback = ['api', 'generic_api', 'webhook'].includes(String(connector?.connector_type || '').toLowerCase())
      ? (connector?.identifier || '')
      : '';
    drafts[connector.id] = {
      name: connector?.name || '',
      fetch_interval: connector?.fetch_interval || 'manual',
      analysis_interval: connector?.analysis_interval || 'manual',
      max_reviews: Number(config.count || config.max_reviews || 200),
      country: config.country || 'us',
      endpoint: config.api_url || config.url || config.endpoint || endpointFallback,
      method: config.method || 'GET',
      auth_value: '',
    };
  });
  return drafts;
};

const formatCurrency = (amount, currency = 'USD') => {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: value < 10 ? 4 : 2,
    }).format(value);
  } catch (_) {
    return `$${value.toFixed(2)}`;
  }
};

const InfoBanner = ({ tone = 'neutral', children }) => {
  const toneClass = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-700';
  return <div className={`mb-5 rounded-2xl border px-4 py-3 text-[13px] ${toneClass}`}>{children}</div>;
};

const SectionHeader = ({ icon: Icon, title, description }) => (
  <div className="mb-6 flex items-start gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
      <Icon size={18} />
    </div>
    <div>
      <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-[13px] text-slate-500">{description}</p>
    </div>
  </div>
);

const HorizonWorkspaceOps = ({
  panel,
  user,
  workspace,
  connectors = [],
  isPreviewMode = false,
  onUserUpdated,
  onWorkspaceUpdated,
  onConnectorsUpdated,
  initialDocSlug = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [userBundle, setUserBundle] = useState(null);
  const [workspaceBundle, setWorkspaceBundle] = useState(null);
  const [billingBundle, setBillingBundle] = useState(null);
  const [docsBundle, setDocsBundle] = useState({ articles: [], categories: [] });
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [profileForm, setProfileForm] = useState({});
  const [workspaceForm, setWorkspaceForm] = useState({});
  const [billingForm, setBillingForm] = useState({});
  const [connectorDrafts, setConnectorDrafts] = useState({});
  const [docQuery, setDocQuery] = useState('');
  const [docCategory, setDocCategory] = useState('all');

  const connectorById = useMemo(
    () => Object.fromEntries((connectors || []).map((connector) => [connector.id, connector])),
    [connectors]
  );

  const showMessage = (text, tone = 'success') => {
    setMessage(text);
    setMessageTone(tone);
  };

  useEffect(() => {
    setConnectorDrafts(buildConnectorDrafts(connectors));
  }, [connectors]);

  const applyPreviewSettings = () => {
    const previewUser = {
      user: {
        name: user?.name || 'Preview Guest',
        email: user?.email || 'preview@horizon.local',
        contact_email: user?.contactEmail || user?.email || 'preview@horizon.local',
        company: user?.company || 'Read-only sandbox',
        role: user?.role || 'Explorer',
        notes: user?.notes || '',
        access_code: user?.accessCode || null,
      },
      preferences: {
        theme_mode: 'light',
        timezone: 'UTC',
        digest_frequency: 'weekly',
        notify_analysis_complete: true,
        notify_connector_failures: true,
        notify_billing_updates: true,
      },
    };
    const previewWorkspace = {
      workspace,
      settings: {
        locale: 'en-US',
        currency: 'USD',
        timezone: 'UTC',
        default_arpu: 50,
        renewal_cycle: 'monthly',
        auto_sync_enabled: true,
        auto_analysis_enabled: false,
        daily_digest_enabled: true,
        slack_webhook_url: '',
        retention_target: 92,
        export_format: 'zip',
        security_mode: 'strict',
        data_retention_days: 365,
      },
    };
    setUserBundle(previewUser);
    setWorkspaceBundle(previewWorkspace);
    setProfileForm({ ...previewUser.user, ...previewUser.preferences });
    setWorkspaceForm({ ...previewWorkspace.workspace, ...previewWorkspace.settings });
  };

  const applyPreviewBilling = () => {
    const previewBilling = {
      account: {
        plan_name: 'Growth',
        plan_status: 'active',
        billing_email: user?.contactEmail || user?.email || 'preview@horizon.local',
        company_name: user?.company || workspace?.name || 'Preview Workspace',
        currency: 'USD',
        seats: 8,
        base_fee: 299,
        per_seat_fee: 39,
        token_budget: 250000,
        overage_rate: 0.0015,
        auto_renew: true,
        next_invoice_date: '2026-04-01',
        payment_brand: 'Visa',
        payment_last4: '4242',
        billing_address: '',
        tax_id: '',
        notes: '',
        estimated_monthly_total: 611.45,
      },
      current_period: { total_analyses: 12, total_reviews: 2480, total_cost: 19.45 },
      usage: { total_analyses: 42, total_reviews: 8421 },
      llm_preferences: { billing_enabled: true },
      invoices: [
        { invoice_number: 'HZ-preview-202603', period_start: '2026-03-01', period_end: '2026-03-31', status: 'open', total: 611.45, currency: 'USD' },
        { invoice_number: 'HZ-preview-202602', period_start: '2026-02-01', period_end: '2026-02-28', status: 'paid', total: 598.2, currency: 'USD' },
      ],
    };
    setBillingBundle(previewBilling);
    setBillingForm({ ...previewBilling.account, token_billing_enabled: true });
  };

  const applyPreviewDocs = () => {
    const previewDocs = buildPreviewDocs();
    setDocsBundle({ articles: previewDocs, categories: ['setup', 'billing', 'security'] });
    const target = previewDocs.find((article) => article.slug === initialDocSlug) || previewDocs[0];
    setSelectedDoc(target || null);
  };

  const loadSettings = async () => {
    if (isPreviewMode) {
      applyPreviewSettings();
      return;
    }
    setLoading(true);
    try {
      const [userRes, workspaceRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/me`),
        apiFetch(`${API_BASE}/api/workspaces/${workspace.id}/settings`),
      ]);
      if (!userRes.ok || !workspaceRes.ok) throw new Error('Failed to load settings.');
      const userData = await userRes.json();
      const workspaceData = await workspaceRes.json();
      setUserBundle(userData);
      setWorkspaceBundle(workspaceData);
      setProfileForm({ ...userData.user, ...userData.preferences });
      setWorkspaceForm({ ...workspaceData.workspace, ...workspaceData.settings });
    } catch (err) {
      showMessage(err.message || 'Failed to load settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadBilling = async () => {
    if (isPreviewMode) {
      applyPreviewBilling();
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/workspaces/${workspace.id}/billing`);
      if (!res.ok) throw new Error('Failed to load billing.');
      const data = await res.json();
      setBillingBundle(data);
      setBillingForm({ ...data.account, token_billing_enabled: !!data?.llm_preferences?.billing_enabled });
    } catch (err) {
      showMessage(err.message || 'Failed to load billing.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDocs = async () => {
    if (isPreviewMode) {
      applyPreviewDocs();
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/workspaces/${workspace.id}/docs?query=${encodeURIComponent(docQuery)}&category=${encodeURIComponent(docCategory === 'all' ? '' : docCategory)}`);
      if (!res.ok) throw new Error('Failed to load documentation.');
      const data = await res.json();
      setDocsBundle(data);
      if (!data.articles?.length) {
        setSelectedDoc(null);
        return;
      }
      const nextSlug = initialDocSlug && data.articles.some((article) => article.slug === initialDocSlug)
        ? initialDocSlug
        : selectedDoc?.slug && data.articles.some((article) => article.slug === selectedDoc.slug)
          ? selectedDoc.slug
          : data.articles[0].slug;
      const detailRes = await apiFetch(`${API_BASE}/api/workspaces/${workspace.id}/docs/${nextSlug}`);
      if (!detailRes.ok) throw new Error('Failed to load documentation article.');
      const detail = await detailRes.json();
      setSelectedDoc(detail.article);
    } catch (err) {
      showMessage(err.message || 'Failed to load documentation.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!workspace?.id) return;
    if (panel === 'settings') loadSettings();
    if (panel === 'billing') loadBilling();
    if (panel === 'docs') loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, workspace?.id, isPreviewMode, initialDocSlug]);

  useEffect(() => {
    if (panel !== 'docs' || isPreviewMode || !workspace?.id) return;
    const timer = setTimeout(() => {
      loadDocs();
    }, 160);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docQuery, docCategory]);

  const handleSaveProfile = async () => {
    if (isPreviewMode) {
      showMessage('Preview mode is read-only. Sign in to save account settings.', 'error');
      return;
    }
    setSavingKey('profile');
    try {
      const res = await apiFetch(`${API_BASE}/api/me`, {
        method: 'PATCH',
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save account settings.');
      setUserBundle({ user: data.user, preferences: data.preferences });
      onUserUpdated?.({
        ...user,
        name: data.user.name,
        email: data.user.email,
        contactEmail: data.user.contact_email,
        company: data.user.company,
        role: data.user.role,
        notes: data.user.notes,
        accessCode: data.user.access_code,
      });
      showMessage('Account settings saved.', 'success');
    } catch (err) {
      showMessage(err.message || 'Failed to save account settings.', 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleSaveWorkspace = async () => {
    if (isPreviewMode) {
      showMessage('Preview mode is read-only. Sign in to save workspace settings.', 'error');
      return;
    }
    setSavingKey('workspace');
    try {
      const res = await apiFetch(`${API_BASE}/api/workspaces/${workspace.id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(workspaceForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save workspace settings.');
      setWorkspaceBundle({ workspace: data.workspace, settings: data.settings });
      onWorkspaceUpdated?.(data.workspace);
      showMessage('Workspace settings saved.', 'success');
    } catch (err) {
      showMessage(err.message || 'Failed to save workspace settings.', 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleSaveBilling = async () => {
    if (isPreviewMode) {
      showMessage('Preview mode is read-only. Sign in to save billing settings.', 'error');
      return;
    }
    setSavingKey('billing');
    try {
      const res = await apiFetch(`${API_BASE}/api/workspaces/${workspace.id}/billing`, {
        method: 'PATCH',
        body: JSON.stringify(billingForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save billing settings.');
      setBillingBundle(data);
      setBillingForm({ ...data.account, token_billing_enabled: !!data?.llm_preferences?.billing_enabled });
      showMessage('Billing settings saved.', 'success');
    } catch (err) {
      showMessage(err.message || 'Failed to save billing settings.', 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleSaveConnector = async (connectorId) => {
    if (isPreviewMode) {
      showMessage('Preview mode is read-only. Sign in to save connector settings.', 'error');
      return;
    }
    const draft = connectorDrafts[connectorId];
    const original = connectorById[connectorId];
    if (!draft || !original) return;

    setSavingKey(`connector-${connectorId}`);
    try {
      const nextConfig = {
        ...(original.config || {}),
        country: draft.country,
        method: draft.method,
      };
      if (draft.endpoint) {
        nextConfig.api_url = draft.endpoint;
        nextConfig.url = draft.endpoint;
        nextConfig.endpoint = draft.endpoint;
      }
      if (draft.auth_value?.trim()) nextConfig.auth_value = draft.auth_value.trim();
      const res = await apiFetch(`${API_BASE}/api/user/connectors/${connectorId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          fetch_interval: draft.fetch_interval,
          analysis_interval: draft.analysis_interval,
          max_reviews: Number(draft.max_reviews || 200),
          config: nextConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save connector settings.');
      setConnectorDrafts((prev) => ({
        ...prev,
        [connectorId]: {
          ...prev[connectorId],
          auth_value: '',
        },
      }));
      await onConnectorsUpdated?.();
      showMessage(`Connector "${data?.connector?.name || draft.name}" saved.`, 'success');
    } catch (err) {
      showMessage(err.message || 'Failed to save connector settings.', 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleOpenDoc = async (slug) => {
    if (isPreviewMode) {
      const found = docsBundle.articles.find((article) => article.slug === slug);
      if (found) setSelectedDoc(found);
      return;
    }
    setSavingKey('doc');
    try {
      const res = await apiFetch(`${API_BASE}/api/workspaces/${workspace.id}/docs/${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load documentation article.');
      setSelectedDoc(data.article);
    } catch (err) {
      showMessage(err.message || 'Failed to load documentation article.', 'error');
    } finally {
      setSavingKey('');
    }
  };

  if (loading && !userBundle && !workspaceBundle && !billingBundle && panel !== 'docs') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[13px] text-slate-500 shadow-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading workspace operations...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl">
        {message ? <InfoBanner tone={messageTone}>{message}</InfoBanner> : null}

        {panel === 'settings' ? (
          <>
            <div className="mb-8">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Settings</h1>
              <p className="mt-1 text-[13px] text-slate-500">Manage account preferences, workspace defaults, and connector-level configuration.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className={cardClassName}>
                <SectionHeader icon={User} title="Account Profile" description="Persist the personal and notification settings used across Horizon." />
                <div className="grid gap-4 md:grid-cols-2">
                  <input className={fieldClassName} value={profileForm.name || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" />
                  <input className={fieldClassName} value={profileForm.contact_email || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, contact_email: e.target.value }))} placeholder="Contact email" />
                  <input className={fieldClassName} value={profileForm.company || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, company: e.target.value }))} placeholder="Company" />
                  <input className={fieldClassName} value={profileForm.role || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, role: e.target.value }))} placeholder="Role" />
                  <select className={fieldClassName} value={profileForm.theme_mode || 'light'} onChange={(e) => setProfileForm((prev) => ({ ...prev, theme_mode: e.target.value }))}>
                    {['light', 'dark', 'system'].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                  <input className={fieldClassName} value={profileForm.timezone || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, timezone: e.target.value }))} placeholder="Timezone" />
                  <select className={fieldClassName} value={profileForm.digest_frequency || 'weekly'} onChange={(e) => setProfileForm((prev) => ({ ...prev, digest_frequency: e.target.value }))}>
                    {['off', 'daily', 'weekly'].map((freq) => <option key={freq} value={freq}>{freq}</option>)}
                  </select>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
                    Access code: <span className="font-semibold text-slate-700">{profileForm.access_code || 'Not linked'}</span>
                  </div>
                </div>
                <textarea className={`${textareaClassName} mt-4`} value={profileForm.notes || ''} onChange={(e) => setProfileForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Operational notes" />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    ['notify_analysis_complete', 'Analysis complete'],
                    ['notify_connector_failures', 'Connector failures'],
                    ['notify_billing_updates', 'Billing updates'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-700">
                      <input type="checkbox" checked={!!profileForm[key]} onChange={(e) => setProfileForm((prev) => ({ ...prev, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
                <button onClick={handleSaveProfile} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  {savingKey === 'profile' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save Account
                </button>
              </div>

              <div className={cardClassName}>
                <SectionHeader icon={Settings} title="Workspace Controls" description="Make the active workspace behave like a real production environment." />
                <div className="grid gap-4 md:grid-cols-2">
                  <input className={fieldClassName} value={workspaceForm.name || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Workspace name" />
                  <input className={fieldClassName} value={workspaceForm.vertical || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, vertical: e.target.value }))} placeholder="Vertical" />
                  <input className={fieldClassName} value={workspaceForm.locale || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, locale: e.target.value }))} placeholder="Locale" />
                  <input className={fieldClassName} value={workspaceForm.currency || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, currency: e.target.value }))} placeholder="Currency" />
                  <input className={fieldClassName} value={workspaceForm.timezone || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, timezone: e.target.value }))} placeholder="Timezone" />
                  <input className={fieldClassName} type="number" value={workspaceForm.default_arpu || 0} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, default_arpu: e.target.value }))} placeholder="Default ARPU" />
                  <input className={fieldClassName} value={workspaceForm.renewal_cycle || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, renewal_cycle: e.target.value }))} placeholder="Renewal cycle" />
                  <input className={fieldClassName} type="number" value={workspaceForm.retention_target || 0} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, retention_target: e.target.value }))} placeholder="Retention target" />
                  <select className={fieldClassName} value={workspaceForm.export_format || 'zip'} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, export_format: e.target.value }))}>
                    {EXPORT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <select className={fieldClassName} value={workspaceForm.security_mode || 'standard'} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, security_mode: e.target.value }))}>
                    {SECURITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <textarea className={`${textareaClassName} mt-4`} value={workspaceForm.description || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Workspace description" />
                <input className={`${fieldClassName} mt-4`} value={workspaceForm.slack_webhook_url || ''} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, slack_webhook_url: e.target.value }))} placeholder="Alert webhook URL" />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    ['auto_sync_enabled', 'Auto-sync'],
                    ['auto_analysis_enabled', 'Auto-analysis'],
                    ['daily_digest_enabled', 'Daily digest'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-700">
                      <input type="checkbox" checked={!!workspaceForm[key]} onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
                <button onClick={handleSaveWorkspace} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  {savingKey === 'workspace' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save Workspace
                </button>
              </div>
            </div>

            <div className={`${cardClassName} mt-6`}>
              <SectionHeader icon={Database} title="Connector Settings" description="Each connector can now be adjusted and saved independently from the workspace shell." />
              {!connectors.length ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[13px] text-slate-500">No connectors are configured for this workspace yet.</div>
              ) : (
                <div className="space-y-4">
                  {connectors.map((connector) => {
                    const draft = connectorDrafts[connector.id] || {};
                    return (
                      <div key={connector.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[14px] font-semibold text-slate-900">{connector.name}</p>
                            <p className="text-[12px] text-slate-500">{connector.identifier}</p>
                          </div>
                          <button onClick={() => handleSaveConnector(connector.id)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100">
                            {savingKey === `connector-${connector.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <input className={fieldClassName} value={draft.name || ''} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], name: e.target.value } }))} placeholder="Display name" />
                          <select className={fieldClassName} value={draft.fetch_interval || 'manual'} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], fetch_interval: e.target.value } }))}>
                            {INTERVAL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <select className={fieldClassName} value={draft.analysis_interval || 'manual'} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], analysis_interval: e.target.value } }))}>
                            {INTERVAL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <input className={fieldClassName} type="number" value={draft.max_reviews || 200} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], max_reviews: e.target.value } }))} placeholder="Max reviews" />
                          <input className={fieldClassName} value={draft.country || 'us'} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], country: e.target.value } }))} placeholder="Country" />
                          <input className={fieldClassName} value={draft.method || 'GET'} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], method: e.target.value } }))} placeholder="Method" />
                          <input className={`md:col-span-2 ${fieldClassName}`} value={draft.endpoint || ''} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], endpoint: e.target.value } }))} placeholder="Endpoint URL (if applicable)" />
                          <input className={fieldClassName} value={draft.auth_value || ''} onChange={(e) => setConnectorDrafts((prev) => ({ ...prev, [connector.id]: { ...prev[connector.id], auth_value: e.target.value } }))} placeholder="New secret (optional)" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}

        {panel === 'billing' ? (
          <>
            <div className="mb-8">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Billing</h1>
              <p className="mt-1 text-[13px] text-slate-500">Manage plan metadata, seat pricing, payment references, AI billing, and invoice history.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className={cardClassName}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Plan</p>
                <p className="mt-3 text-[24px] font-bold text-slate-900">{billingBundle?.account?.plan_name || 'Growth'}</p>
                <p className="mt-1 text-[13px] text-slate-500 capitalize">{billingBundle?.account?.plan_status || 'active'}</p>
              </div>
              <div className={cardClassName}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Monthly Estimate</p>
                <p className="mt-3 text-[24px] font-bold text-slate-900">{formatCurrency(billingBundle?.account?.estimated_monthly_total, billingBundle?.account?.currency)}</p>
                <p className="mt-1 text-[13px] text-slate-500">Base + seats + AI overage</p>
              </div>
              <div className={cardClassName}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI Usage</p>
                <p className="mt-3 text-[24px] font-bold text-slate-900">{formatCurrency(billingBundle?.current_period?.total_cost, billingBundle?.account?.currency)}</p>
                <p className="mt-1 text-[13px] text-slate-500">{billingBundle?.current_period?.total_analyses || 0} analyses this month</p>
              </div>
              <div className={cardClassName}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Invoices</p>
                <p className="mt-3 text-[24px] font-bold text-slate-900">{billingBundle?.invoices?.length || 0}</p>
                <p className="mt-1 text-[13px] text-slate-500">Tracked billing periods</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
              <div className={cardClassName}>
                <SectionHeader icon={CreditCard} title="Billing Configuration" description="Keep finance-ready plan, payment, and AI billing values persisted per workspace." />
                <div className="grid gap-4 md:grid-cols-2">
                  <input className={fieldClassName} value={billingForm.plan_name || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, plan_name: e.target.value }))} placeholder="Plan name" />
                  <select className={fieldClassName} value={billingForm.plan_status || 'active'} onChange={(e) => setBillingForm((prev) => ({ ...prev, plan_status: e.target.value }))}>
                    {PLAN_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <input className={fieldClassName} value={billingForm.billing_email || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, billing_email: e.target.value }))} placeholder="Billing email" />
                  <input className={fieldClassName} value={billingForm.company_name || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, company_name: e.target.value }))} placeholder="Company name" />
                  <input className={fieldClassName} value={billingForm.currency || 'USD'} onChange={(e) => setBillingForm((prev) => ({ ...prev, currency: e.target.value }))} placeholder="Currency" />
                  <input className={fieldClassName} type="number" value={billingForm.seats || 1} onChange={(e) => setBillingForm((prev) => ({ ...prev, seats: e.target.value }))} placeholder="Seats" />
                  <input className={fieldClassName} type="number" value={billingForm.base_fee || 0} onChange={(e) => setBillingForm((prev) => ({ ...prev, base_fee: e.target.value }))} placeholder="Base fee" />
                  <input className={fieldClassName} type="number" value={billingForm.per_seat_fee || 0} onChange={(e) => setBillingForm((prev) => ({ ...prev, per_seat_fee: e.target.value }))} placeholder="Per-seat fee" />
                  <input className={fieldClassName} type="number" value={billingForm.token_budget || 0} onChange={(e) => setBillingForm((prev) => ({ ...prev, token_budget: e.target.value }))} placeholder="Token budget" />
                  <input className={fieldClassName} type="number" value={billingForm.overage_rate || 0} onChange={(e) => setBillingForm((prev) => ({ ...prev, overage_rate: e.target.value }))} placeholder="Overage rate" />
                  <input className={fieldClassName} value={billingForm.next_invoice_date || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, next_invoice_date: e.target.value }))} placeholder="Next invoice date" />
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-700">
                    <input type="checkbox" checked={!!billingForm.auto_renew} onChange={(e) => setBillingForm((prev) => ({ ...prev, auto_renew: e.target.checked }))} />
                    Auto-renew plan
                  </label>
                  <input className={fieldClassName} value={billingForm.payment_brand || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, payment_brand: e.target.value }))} placeholder="Payment brand" />
                  <input className={fieldClassName} value={billingForm.payment_last4 || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, payment_last4: e.target.value }))} placeholder="Last 4 digits" />
                </div>
                <textarea className={`${textareaClassName} mt-4`} value={billingForm.billing_address || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, billing_address: e.target.value }))} placeholder="Billing address" />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input className={fieldClassName} value={billingForm.tax_id || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, tax_id: e.target.value }))} placeholder="Tax ID" />
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-700">
                    <input type="checkbox" checked={!!billingForm.token_billing_enabled} onChange={(e) => setBillingForm((prev) => ({ ...prev, token_billing_enabled: e.target.checked }))} />
                    Token billing enabled
                  </label>
                </div>
                <textarea className={`${textareaClassName} mt-4`} value={billingForm.notes || ''} onChange={(e) => setBillingForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Internal billing notes" />
                <button onClick={handleSaveBilling} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  {savingKey === 'billing' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save Billing
                </button>
              </div>

              <div className={cardClassName}>
                <SectionHeader icon={DollarSign} title="Invoices" description="Recent invoice periods are persisted and updated from real usage summaries." />
                <div className="space-y-3">
                  {(billingBundle?.invoices || []).map((invoice) => (
                    <div key={invoice.invoice_number} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900">{invoice.invoice_number}</p>
                          <p className="mt-1 text-[12px] text-slate-500">{invoice.period_start} to {invoice.period_end}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-bold text-slate-900">{formatCurrency(invoice.total, invoice.currency)}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{invoice.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!billingBundle?.invoices?.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[13px] text-slate-500">No invoices have been generated yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {panel === 'docs' ? (
          <>
            <div className="mb-8">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Documentation</h1>
              <p className="mt-1 text-[13px] text-slate-500">Search operator guidance, billing notes, connector playbooks, and platform references directly in the workspace.</p>
            </div>

            <div className="mb-5 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <BookOpen size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${fieldClassName} pl-9`} value={docQuery} onChange={(e) => setDocQuery(e.target.value)} placeholder="Search docs..." />
              </div>
              <select className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 md:w-56" value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                <option value="all">All categories</option>
                {(docsBundle.categories || []).map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <button onClick={loadDocs} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className={`${cardClassName} space-y-3`}>
                {(docsBundle.articles || []).map((article) => {
                  const Icon = DOC_ICON_MAP[article.icon] || FileText;
                  const isActive = selectedDoc?.slug === article.slug;
                  return (
                    <button key={article.slug} onClick={() => handleOpenDoc(article.slug)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${isActive ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-slate-500'}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-900">{article.title}</p>
                          <p className="mt-1 text-[12px] leading-5 text-slate-500">{article.summary}</p>
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{article.category} · {article.estimated_minutes || 5} min</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!docsBundle.articles?.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[13px] text-slate-500">No documentation matched the current filters.</div>
                ) : null}
              </div>

              <div className={cardClassName}>
                {selectedDoc ? (
                  <>
                    <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{selectedDoc.category}</p>
                        <h2 className="mt-2 text-[24px] font-bold tracking-tight text-slate-900">{selectedDoc.title}</h2>
                        <p className="mt-2 text-[13px] text-slate-500">{selectedDoc.summary}</p>
                      </div>
                      {savingKey === 'doc' ? <Loader2 size={16} className="mt-1 animate-spin text-slate-400" /> : <CheckCircle2 size={18} className="mt-1 text-emerald-500" />}
                    </div>
                    <div className="prose prose-slate max-w-none prose-headings:tracking-tight prose-p:text-[14px] prose-p:leading-7">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedDoc.body || ''}
                      </ReactMarkdown>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center text-[13px] text-slate-500">
                    Select an article to view documentation.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default HorizonWorkspaceOps;
