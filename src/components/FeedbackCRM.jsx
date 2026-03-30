import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Eye, Send, ArrowLeft, Tag, Zap, Activity, Plug, Mail,
  BarChart3, Inbox, AlertTriangle, Users, Loader2, MessageSquare,
  ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown,
  RefreshCw, Check, ChevronRight, ChevronDown, Clock, Search, Sparkles, X, AlertCircle
} from 'lucide-react';
import { apiFetch } from '../utils/api';

const API_BASE = '';
const FI_SETUP_STORAGE_KEY = 'fi_crm_setup_v1';

// ── Helpers ─────────────────────────────────────────────────────────────────
const sentimentColor = (s) => ({ positive: 'emerald', negative: 'rose', neutral: 'slate' }[s] || 'slate');
const sentimentBg = (s) => ({ positive: 'bg-emerald-50 text-emerald-700 border-emerald-200', negative: 'bg-rose-50 text-rose-700 border-rose-200', neutral: 'bg-slate-50 text-slate-600 border-slate-200' }[s] || 'bg-slate-50 text-slate-600 border-slate-200');
const priorityBg = (p) => ({ critical: 'bg-red-50 text-red-700 border-red-200', high: 'bg-orange-50 text-orange-700 border-orange-200', medium: 'bg-amber-50 text-amber-700 border-amber-200', low: 'bg-slate-50 text-slate-600 border-slate-200' }[p] || 'bg-slate-50 text-slate-600 border-slate-200');
const trendIcon = (t) => t === 'rising' ? <ArrowUpRight size={14} className="text-rose-500" /> : t === 'declining' ? <ArrowDownRight size={14} className="text-emerald-500" /> : <Minus size={14} className="text-slate-400" />;
const statusBg = (s) => ({ open: 'bg-blue-50 text-blue-700 border-blue-200', resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200', investigating: 'bg-amber-50 text-amber-700 border-amber-200' }[s] || 'bg-slate-50 text-slate-600 border-slate-200');
const normalizePriority = (value) => {
  const priority = String(value || '').trim().toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium';
};
const normalizeSentiment = (value) => {
  const sentiment = String(value || '').trim().toLowerCase();
  return ['positive', 'neutral', 'negative'].includes(sentiment) ? sentiment : 'neutral';
};
const isFeedbackAnalyzed = (feedback) => Boolean(feedback?.last_analyzed_at);
const sentimentDisplayForFeedback = (feedback) => {
  if (!isFeedbackAnalyzed(feedback)) {
    return {
      sentiment: null,
      label: 'Pending analysis',
      className: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  }
  const sentiment = normalizeSentiment(feedback?.sentiment);
  return {
    sentiment,
    label: sentiment,
    className: sentimentBg(sentiment),
  };
};
const priorityDisplayForFeedback = (feedback) => {
  if (!isFeedbackAnalyzed(feedback)) {
    return {
      priority: null,
      label: 'Pending analysis',
      className: 'bg-slate-100 text-slate-500 border-slate-200',
      editable: false,
    };
  }
  const priority = normalizePriority(feedback?.priority);
  return {
    priority,
    label: priority,
    className: priorityBg(priority),
    editable: true,
  };
};
const issueDisplayForFeedback = (feedback) => {
  if (!isFeedbackAnalyzed(feedback)) return 'Pending analysis';
  return feedback?.issue_name || '-';
};
const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const formatDateLabel = (value) => {
  const parsed = toDateOrNull(value);
  if (parsed) {
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const fallback = String(value || '').split('T')[0];
  return fallback || 'N/A';
};
const formatDateTimeLabel = (value) => {
  const parsed = toDateOrNull(value);
  if (parsed) {
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const fallback = String(value || '').replace('T', ' ').slice(0, 16);
  return fallback || 'N/A';
};
const CONTACT_EMAIL_KEYS = new Set([
  'email',
  'user_email',
  'customer_email',
  'respondent_email',
  'contact_email',
]);
const CONTACT_PHONE_KEYS = new Set([
  'phone',
  'phone_number',
  'mobile',
  'mobile_number',
  'contact_number',
  'contact_phone',
]);
const CONTACT_NAME_KEYS = new Set([
  'name',
  'customer_name',
  'full_name',
  'user_name',
  'contact_name',
  'respondent_name',
]);
const safeJsonParse = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch (_e) {
    return fallback;
  }
};
const extractContactValue = (payload, keys) => {
  if (!payload || typeof payload !== 'object') return '';
  const queue = [payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      current.forEach((item) => {
        if (item && typeof item === 'object') queue.push(item);
      });
      continue;
    }
    if (!current || typeof current !== 'object') continue;
    Object.entries(current).forEach(([rawKey, rawValue]) => {
      const key = String(rawKey || '').trim().toLowerCase();
      if (rawValue && typeof rawValue === 'object') {
        queue.push(rawValue);
        return;
      }
      if (!keys.has(key)) return;
      const text = String(rawValue ?? '').trim();
      if (text) {
        queue.length = 0;
      }
    });
    const matched = Object.entries(current).find(([rawKey, rawValue]) => {
      const key = String(rawKey || '').trim().toLowerCase();
      if (!keys.has(key)) return false;
      return typeof rawValue !== 'object' && String(rawValue ?? '').trim().length > 0;
    });
    if (matched) return String(matched[1] ?? '').trim();
  }
  return '';
};
const normalizeEmail = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text || !text.includes('@')) return '';
  const [local, domain] = text.split('@');
  if (!local || !domain || !domain.includes('.')) return '';
  return text;
};
const normalizeMobile = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 7) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00') && digits.length > 2) return `+${digits.slice(2)}`;
  return digits;
};
const guessNameFromIdentifier = (identifier) => {
  const text = String(identifier || '').trim();
  if (!text) return '';
  if (text.includes('@')) {
    const [namePart] = text.split('@');
    return namePart.replace(/[._-]/g, ' ').trim();
  }
  if (/^\+?\d[\d\s()-]{6,}$/.test(text)) return 'Customer';
  return text;
};
const extractFeedbackContact = (metadata, customerIdentifier = '') => {
  const payload = metadata && typeof metadata === 'object' ? metadata : {};
  let email = normalizeEmail(extractContactValue(payload, CONTACT_EMAIL_KEYS));
  let mobile = normalizeMobile(extractContactValue(payload, CONTACT_PHONE_KEYS));
  let name = String(extractContactValue(payload, CONTACT_NAME_KEYS) || '').trim();
  const identifier = String(customerIdentifier || '').trim();
  if (!email) email = normalizeEmail(identifier);
  if (!mobile) mobile = normalizeMobile(identifier);
  if (!name) name = guessNameFromIdentifier(identifier);
  if (!name && email) name = email.split('@')[0].replace(/[._-]/g, ' ').trim();
  return {
    email,
    mobile,
    name: name || 'Customer',
  };
};
const normalizeWhatsAppNumber = (value) => String(value || '').replace(/[^\d]/g, '');
const summarizeLlmEndpointError = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower.includes('forcibly closed') || lower.includes('connection reset') || lower.includes('10054') || lower.includes('protocolerror')) {
    return 'The remote LLM server closed the connection unexpectedly. The tunnel needs to recover.';
  }
  if (lower.includes('bad gateway') || lower.includes('502')) {
    return 'The remote LLM tunnel is unavailable right now.';
  }
  if (lower.includes('524') || lower.includes('timeout occurred')) {
    return 'The remote LLM tunnel timed out.';
  }
  if (lower.includes('timed out')) {
    return 'The LLM request timed out.';
  }
  if (lower.includes('actively refused') || lower.includes('10061') || lower.includes('connection refused')) {
    return 'The local standby endpoint is not running.';
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
};

const connectorScopeOf = (connector) => {
  const rawScope = connector?.scope || connector?.connector_scope || connector?.config?._scope || connector?.config?.integration_scope;
  const normalized = String(rawScope || 'workspace').trim().toLowerCase();
  return normalized === 'feedback_crm' ? 'feedback_crm' : 'workspace';
};

const connectorIconForType = (connectorType) => {
  const key = String(connectorType || '').toLowerCase();
  if (key === 'csv') return Inbox;
  if (key === 'surveymonkey' || key === 'typeform') return Mail;
  if (key === 'crm' || key === 'salesforce') return Users;
  if (key === 'api' || key === 'generic_api' || key === 'webhook') return Zap;
  if (key === 'trustpilot') return Activity;
  return MessageSquare;
};

const ConnectorTypeGlyph = ({ connectorType, size = 12, className = '' }) => {
  const Icon = connectorIconForType(connectorType);
  return <Icon size={size} className={className} />;
};

// ── Main Component ──────────────────────────────────────────────────────────
const FeedbackCRM = ({ user, onBack = null }) => {
  const [activeView, setActiveView] = useState(() => {
    try {
      if (typeof window === 'undefined') return 'setup';
      const raw = localStorage.getItem(FI_SETUP_STORAGE_KEY);
      if (!raw) return 'setup';
      return 'setup';
    } catch (_err) {
      return 'setup';
    }
  });
  const [dashboard, setDashboard] = useState(null);
  const [feedback, setFeedback] = useState({ items: [], total: 0, limit: 100, offset: 0 });
  const [issues, setIssues] = useState({ items: [], total: 0 });
  const [customers, setCustomers] = useState({ items: [], total: 0 });
  const [knowledgeOffers, setKnowledgeOffers] = useState({ items: [], total: 0, limit: 200, offset: 0 });
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [analysisLimit, setAnalysisLimit] = useState('');
  const [analysisStartIndex, setAnalysisStartIndex] = useState('');
  const [analysisEndIndex, setAnalysisEndIndex] = useState('');
  const [analysisSelectedStars, setAnalysisSelectedStars] = useState([]);
  const [feedbackLimit, setFeedbackLimit] = useState(100);
  const [feedbackOffset, setFeedbackOffset] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailView, setDetailView] = useState(null); // 'feedback'|'issue'|'customer'
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [showCreateFeedback, setShowCreateFeedback] = useState(false);
  const [showAIResponse, setShowAIResponse] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisTaskId, setAnalysisTaskId] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisLog, setAnalysisLog] = useState([]);
  const [analysisProcessedReviews, setAnalysisProcessedReviews] = useState(0);
  const [analysisTotalReviews, setAnalysisTotalReviews] = useState(0);
  const [analysisInFlightReviews, setAnalysisInFlightReviews] = useState(0);
  const [analysisOverlayOpen, setAnalysisOverlayOpen] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState('');
  const [analysisResultModalOpen, setAnalysisResultModalOpen] = useState(false);
  const [analysisResultSummary, setAnalysisResultSummary] = useState(null);
  const [analysisResultFilters, setAnalysisResultFilters] = useState(null);
  const [analysisPaused, setAnalysisPaused] = useState(false);
  const [analysisStopping, setAnalysisStopping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConnectorIds, setSelectedConnectorIds] = useState([]);
  const [connectorIntervals, setConnectorIntervals] = useState({});
  const [connectorAnalysisIntervals, setConnectorAnalysisIntervals] = useState({});
  const [fetchScope, setFetchScope] = useState('full');
  const [fetchDays, setFetchDays] = useState(7);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [setupMessage, setSetupMessage] = useState('');
  const [knowledgeMessage, setKnowledgeMessage] = useState('');
  const [savingSetup, setSavingSetup] = useState(false);
  const [llmSettings, setLlmSettings] = useState(null);
  const [llmUsage, setLlmUsage] = useState(null);
  const [llmBusy, setLlmBusy] = useState(false);
  const [outreachGeneratingId, setOutreachGeneratingId] = useState(null);
  const [showCustomerMessageModal, setShowCustomerMessageModal] = useState(false);
  const [customerMessageLoading, setCustomerMessageLoading] = useState(false);
  const [customerMessageNotice, setCustomerMessageNotice] = useState('');
  const [customerMessageState, setCustomerMessageState] = useState({
    customerId: null,
    feedbackId: null,
    channel: 'email',
    to: '',
    contactEmail: '',
    contactMobile: '',
    subject: '',
    message: '',
    drafts: {},
    availableChannels: [],
    autoDraftReason: '',
    customerName: '',
  });
  const llmConnected = !!llmSettings?.preferences?.is_enabled;
  const llmEndpointActive = !!llmSettings?.endpoint?.active;
  const llmGateway = llmSettings?.gateway || null;
  const llmGatewayMode = String(llmGateway?.mode || (llmConnected ? (llmEndpointActive ? 'live' : 'unavailable') : 'paused'));
  const llmGatewayTools = llmGateway?.tools || {};
  const llmGatewayEndpoints = (Array.isArray(llmGateway?.endpoints) ? llmGateway.endpoints : []).filter((endpoint) => endpoint?.role === 'primary' || endpoint?.active);
  const llmGatewayStatusLabel = ({
    live: 'Live',
    degraded: 'Connected',
    unavailable: 'Tunnel unavailable',
    paused: 'Usage paused',
  }[llmGatewayMode] || 'Unknown');
  const llmEndpointError = summarizeLlmEndpointError(llmSettings?.endpoint?.error);
  const llmGatewayWarning = summarizeLlmEndpointError(llmGateway?.warning);
  const llmDisconnectedMessage = 'LLM usage is paused. Enable it to use CRM analysis and AI drafting.';
  const allConnectorIds = useMemo(
    () =>
      connectors
        .map((connector) => Number(connector?.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    [connectors]
  );

  const clearFeedbackFilters = () => {
    setSearchQuery('');
    setFilterStatus('');
    setFilterSentiment('');
    setFilterPriority('');
    setFilterRating('');
    setFilterSource('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFeedbackOffset(0);
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/dashboard`);
      if (res.ok) setDashboard(await res.json());
    } catch (e) { console.error('Dashboard fetch error:', e); }
  }, []);

  const fetchFeedback = useCallback(async (overrides = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const search = overrides.search ?? searchQuery;
      const status = overrides.status ?? filterStatus;
      const sentiment = overrides.sentiment ?? filterSentiment;
      const priority = overrides.priority ?? filterPriority;
      const rating = overrides.rating ?? filterRating;
      const source = overrides.source ?? filterSource;
      const startDate = overrides.startDate ?? filterStartDate;
      const endDate = overrides.endDate ?? filterEndDate;
      const limit = Math.max(25, Math.min(500, Number(overrides.limit ?? feedbackLimit) || 100));
      const offset = Math.max(0, Number(overrides.offset ?? feedbackOffset) || 0);
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (sentiment) params.set('sentiment', sentiment);
      if (priority) params.set('priority', priority);
      if (rating) params.set('rating', rating);
      if (source) params.set('source', source);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const res = await apiFetch(`${API_BASE}/api/fi/feedback?${params}`);
      if (res.ok) {
        const payload = await res.json();
        setFeedback(payload);
        setFeedbackLimit(Number(payload?.limit || limit));
        setFeedbackOffset(Number(payload?.offset || offset));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [searchQuery, filterStatus, filterSentiment, filterPriority, filterRating, filterSource, filterStartDate, filterEndDate, feedbackLimit, feedbackOffset]);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/issues?sort_by=impact_score&limit=50`);
      if (res.ok) setIssues(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '50');
      const res = await apiFetch(`${API_BASE}/api/fi/customers?${params}`);
      if (res.ok) setCustomers(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [searchQuery]);

  const fetchKnowledgeOffers = useCallback(async () => {
    setKnowledgeLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/offers?limit=500&offset=0`);
      if (res.ok) {
        const payload = await res.json();
        setKnowledgeOffers(payload || { items: [], total: 0, limit: 500, offset: 0 });
      } else {
        const body = await res.json().catch(() => ({}));
        setKnowledgeMessage(body?.detail || 'Failed to load knowledge base offers.');
      }
    } catch (e) {
      console.error(e);
      setKnowledgeMessage('Failed to load knowledge base offers.');
    }
    setKnowledgeLoading(false);
  }, []);

  const fetchAnalysisResultSummary = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (Array.isArray(filters?.feedbackIds) && filters.feedbackIds.length > 0) {
        params.set('feedback_ids', filters.feedbackIds.join(','));
      }
      if (Array.isArray(filters?.sourceIds) && filters.sourceIds.length > 0) {
        params.set('source_ids', filters.sourceIds.join(','));
      }
      if (filters?.source) params.set('source', String(filters.source));
      if (filters?.startDate) params.set('start_date', filters.startDate);
      if (filters?.endDate) params.set('end_date', filters.endDate);
      if (filters?.rating) params.set('rating', String(filters.rating));
      if (Array.isArray(filters?.ratingValues) && filters.ratingValues.length > 0) {
        params.set('rating_values', filters.ratingValues.join(','));
      }
      const query = params.toString();
      const res = await apiFetch(`${API_BASE}/api/fi/analysis/summary${query ? `?${query}` : ''}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (_e) {
      return null;
    }
  }, []);

  const createKnowledgeOffer = useCallback(async (payload) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/offers`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: data?.detail || 'Failed to create offer.' };
      }
      await fetchKnowledgeOffers();
      return { ok: true, message: 'Offer added to knowledge base.' };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to create offer.' };
    }
  }, [fetchKnowledgeOffers]);

  const updateKnowledgeOffer = useCallback(async (offerId, payload) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/offers/${offerId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: data?.detail || 'Failed to update offer.' };
      }
      await fetchKnowledgeOffers();
      return { ok: true, message: 'Offer updated.' };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to update offer.' };
    }
  }, [fetchKnowledgeOffers]);

  const deleteKnowledgeOffer = useCallback(async (offerId) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/offers/${offerId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: data?.detail || 'Failed to delete offer.' };
      }
      await fetchKnowledgeOffers();
      return { ok: true, message: 'Offer removed from knowledge base.' };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to delete offer.' };
    }
  }, [fetchKnowledgeOffers]);

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const [fiRes, workspaceRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/fi/connectors`),
        apiFetch(`${API_BASE}/api/user/connectors?connector_scope=workspace`),
      ]);

      const merged = new Map();
      const addList = (items = []) => {
        items.forEach((connector) => {
          if (!connector || !connector.id) return;
          merged.set(connector.id, {
            ...connector,
            scope: connectorScopeOf(connector),
          });
        });
      };

      if (fiRes.ok) {
        const fiData = await fiRes.json();
        addList(fiData.connectors || []);
      }

      if (workspaceRes.ok) {
        const workspaceData = await workspaceRes.json();
        addList(workspaceData.connectors || []);
      }

      const nextConnectors = Array.from(merged.values());
      setConnectors(nextConnectors);
      setConnectorIntervals(prev => {
        const next = { ...prev };
        nextConnectors.forEach(connector => {
          next[connector.id] = connector.fetch_interval || next[connector.id] || 'manual';
        });
        return next;
      });
      setConnectorAnalysisIntervals(prev => {
        const next = { ...prev };
        nextConnectors.forEach(connector => {
          next[connector.id] = connector.analysis_interval || next[connector.id] || 'manual';
        });
        return next;
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchLlmState = useCallback(async (forceRefresh = false) => {
    try {
      const settingsPath = forceRefresh
        ? `${API_BASE}/api/llm/settings?force_refresh=1`
        : `${API_BASE}/api/llm/settings`;
      const [settingsRes, usageRes] = await Promise.all([
        apiFetch(settingsPath),
        apiFetch(`${API_BASE}/api/llm/usage-summary`),
      ]);
      if (settingsRes.ok) setLlmSettings(await settingsRes.json());
      if (usageRes.ok) setLlmUsage(await usageRes.json());
    } catch (e) {
      console.error('Failed to fetch LLM state', e);
    }
  }, []);

  const toggleLlmConnection = async () => {
    const enabled = llmConnected;
    const nextEnabled = !enabled;
    setLlmBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/llm/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ is_enabled: !enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSetupMessage(data?.detail || 'Failed to update LLM connection state.');
        return;
      }
      if (!nextEnabled) {
        setSetupMessage('LLM usage paused. Fetching stays available, but CRM analysis and AI drafting are paused.');
        setAnalysisNotice('LLM usage paused. New CRM AI actions are paused.');
        if (analysisTaskId) {
          await handleAnalysisTaskControl('stop');
        }
      } else {
        setSetupMessage('LLM usage enabled. CRM analysis and drafting will use the tunnel route when it is available.');
        setAnalysisNotice('LLM usage enabled. CRM AI actions will follow the current gateway mode.');
      }
      await fetchLlmState(true);
    } catch (e) {
      console.error('Failed to toggle LLM connection', e);
      setSetupMessage('Failed to update LLM connection state.');
    } finally {
      setLlmBusy(false);
    }
  };

  const toggleBilling = async () => {
    const enabled = !!llmSettings?.preferences?.billing_enabled;
    setLlmBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/llm/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ billing_enabled: !enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSetupMessage(data?.detail || 'Failed to update token billing.');
        return;
      }
      setSetupMessage(enabled ? 'Token billing disabled.' : 'Token billing enabled.');
      await fetchLlmState(true);
    } catch (e) {
      console.error('Failed to toggle token billing', e);
      setSetupMessage('Failed to update token billing.');
    } finally {
      setLlmBusy(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FI_SETUP_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.selected_connector_ids)) {
        const ids = saved.selected_connector_ids
          .map(v => Number(v))
          .filter(v => Number.isInteger(v) && v > 0);
        setSelectedConnectorIds(ids);
      }
      if (typeof saved.scope === 'string') {
        const scope = saved.scope.toLowerCase();
        if (scope === 'full' || scope === 'days' || scope === 'range') setFetchScope(scope);
      }
      if (typeof saved.days === 'number' && Number.isFinite(saved.days)) {
        setFetchDays(Math.max(1, Math.min(3650, Math.round(saved.days))));
      }
      if (typeof saved.start_date === 'string') setRangeStart(saved.start_date);
      if (typeof saved.end_date === 'string') setRangeEnd(saved.end_date);
    } catch (e) {
      console.error('Failed to read saved FI setup', e);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchLlmState(); }, [fetchLlmState]);
  useEffect(() => {
    if (activeView === 'feedback') fetchFeedback();
    else if (activeView === 'issues') fetchIssues();
    else if (activeView === 'customers') fetchCustomers();
    else if (activeView === 'setup') fetchConnectors();
    else if (activeView === 'knowledge_base') fetchKnowledgeOffers();
  }, [activeView, fetchFeedback, fetchIssues, fetchCustomers, fetchConnectors, fetchKnowledgeOffers]);

  useEffect(() => {
    if (detailView !== 'customer' || !selectedItem) return undefined;
    const onEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setDetailView(null);
        setSelectedItem(null);
      }
    };
    window.addEventListener('keydown', onEscapeKey);
    return () => window.removeEventListener('keydown', onEscapeKey);
  }, [detailView, selectedItem]);

  useEffect(() => {
    if (!connectors.length) return;
    const validConnectorIdSet = new Set(allConnectorIds);
    setSelectedConnectorIds((prev) => {
      const filtered = (prev || []).filter((id) => validConnectorIdSet.has(Number(id)));
      // Default to all configured connectors when nothing is explicitly selected.
      return filtered.length ? filtered : allConnectorIds;
    });
    setConnectorIntervals(prev => {
      const allowed = {};
      connectors.forEach(connector => {
        allowed[connector.id] = prev[connector.id] || connector.fetch_interval || 'manual';
      });
      return allowed;
    });
    setConnectorAnalysisIntervals(prev => {
      const allowed = {};
      connectors.forEach(connector => {
        allowed[connector.id] = prev[connector.id] || connector.analysis_interval || 'manual';
      });
      return allowed;
    });
  }, [connectors, allConnectorIds]);

  useEffect(() => {
    if (!analysisTaskId) return undefined;

    let cancelled = false;
    let timerId = null;
    const runningStatuses = new Set(['initializing', 'fetching', 'analyzing', 'calculating', 'finalizing', 'paused', 'stopping']);

    const pollTask = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/task/${analysisTaskId}?_=${Date.now()}`, {}, { retries: 0, timeoutMs: 10000 });
        if (!res.ok) {
          if (!cancelled) {
            timerId = window.setTimeout(pollTask, 1200);
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        const totalCount = Number(data.total_reviews) || 0;
        const processedCount = Number(data.processed_reviews) || 0;
        const pendingCount = Math.max(
          0,
          data.in_flight_reviews === null || data.in_flight_reviews === undefined || data.in_flight_reviews === ''
            ? (totalCount > 0 ? totalCount - processedCount : 0)
            : (Number(data.in_flight_reviews) || 0)
        );

        setAnalysisProgress(Number(data.progress) || 0);
        setAnalysisStatus(data.message || 'Processing Feedback CRM analysis...');
        setAnalysisLog(Array.isArray(data.log) ? data.log : []);
        setAnalysisProcessedReviews(processedCount);
        setAnalysisTotalReviews(totalCount);
        setAnalysisInFlightReviews(pendingCount);
        setAnalysisPaused(data.status === 'paused');
        setAnalysisStopping(data.status === 'stopping');

        if (runningStatuses.has(data.status)) {
          timerId = window.setTimeout(pollTask, 1000);
          return;
        }

        if (data.status === 'completed') {
          setAnalysisNotice(data.message || 'Feedback CRM analysis completed.');
          setAnalysisTaskId('');
          setAnalysisPaused(false);
          setAnalysisStopping(false);
          const summary = await fetchAnalysisResultSummary(analysisResultFilters || {});
          if (summary) {
            setAnalysisResultSummary(summary);
            setAnalysisResultModalOpen(true);
          }
          await Promise.all([fetchDashboard(), fetchFeedback(), fetchIssues(), fetchCustomers()]);
          setActiveView('dashboard');
          timerId = window.setTimeout(() => {
            if (!cancelled) setAnalysisOverlayOpen(false);
          }, 900);
          return;
        }

        if (data.status === 'failed' || data.status === 'cancelled') {
          setAnalysisNotice(data.message || 'Feedback CRM analysis did not complete.');
          setAnalysisTaskId('');
          setAnalysisPaused(false);
          setAnalysisStopping(false);
          return;
        }

        timerId = window.setTimeout(pollTask, 1200);
      } catch (_e) {
        if (!cancelled) {
          timerId = window.setTimeout(pollTask, 1500);
        }
      }
    };

    pollTask();
    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [analysisTaskId, analysisResultFilters, fetchAnalysisResultSummary, fetchCustomers, fetchDashboard, fetchFeedback, fetchIssues]);

  const handleAnalysisTaskControl = async (action) => {
    if (!analysisTaskId) return;
    try {
      const res = await apiFetch(`${API_BASE}/task/${analysisTaskId}/control`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      if (action === 'pause') {
        setAnalysisPaused(true);
        setAnalysisStopping(false);
        setAnalysisStatus('Analysis paused');
      } else if (action === 'resume') {
        setAnalysisPaused(false);
        setAnalysisStopping(false);
        setAnalysisStatus('Analysis resumed');
      } else if (action === 'stop') {
        setAnalysisStopping(true);
        setAnalysisPaused(false);
        setAnalysisStatus('Stopping analysis...');
      }
    } catch (e) {
      console.error(`Failed to ${action} CRM analysis`, e);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await apiFetch(`${API_BASE}/api/fi/refresh`, { method: 'POST' }); } catch {}
    await fetchDashboard();
    if (activeView === 'issues') await fetchIssues();
    if (activeView === 'feedback') await fetchFeedback();
    setRefreshing(false);
  };

  const toggleConnectorSelection = (connectorId) => {
    setSelectedConnectorIds(prev =>
      prev.includes(connectorId) ? prev.filter(id => id !== connectorId) : [...prev, connectorId]
    );
  };

  const saveSetupPreferences = () => {
    setSavingSetup(true);
    try {
      const raw = localStorage.getItem(FI_SETUP_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(FI_SETUP_STORAGE_KEY, JSON.stringify({
        ...prev,
        selected_connector_ids: selectedConnectorIds,
        scope: fetchScope,
        days: Number(fetchDays) || 7,
        start_date: rangeStart,
        end_date: rangeEnd,
      }));
      setSetupMessage('Source selection saved.');
    } catch (e) {
      setSetupMessage('Could not save setup preferences.');
      console.error(e);
    } finally {
      setSavingSetup(false);
    }
  };

  const buildFetchPayload = () => {
    const resolvedConnectorIds = (selectedConnectorIds.length ? selectedConnectorIds : allConnectorIds)
      .map((value) => Number(value))
      .filter((value, index, arr) => Number.isInteger(value) && value > 0 && arr.indexOf(value) === index);

    return {
      connector_ids: resolvedConnectorIds,
      scope: fetchScope,
      days: Number(fetchDays) || 7,
      start_date: rangeStart || null,
      end_date: rangeEnd || null,
    };
  };

  const parseApiResponse = async (res) => {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawBody = await res.text();
    if (!rawBody) return {};

    try {
      return JSON.parse(rawBody);
    } catch (_e) {
      const trimmed = rawBody.trim();
      if (contentType.includes('text/html') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
        return { detail: 'Server returned HTML instead of JSON for this request.' };
      }
      return { detail: trimmed.slice(0, 240) };
    }
  };

  const handleFetchIntoCRM = async ({ payload = null, showAlert = true } = {}) => {
    const fetchPayload = payload || buildFetchPayload();
    if (!fetchPayload) return;

    if (!fetchPayload.connector_ids?.length) {
      setSetupMessage(connectors.length > 0 ? 'Select at least one connector before fetching.' : 'Add at least one connector before fetching.');
      return;
    }

    try {
      const raw = localStorage.getItem(FI_SETUP_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(FI_SETUP_STORAGE_KEY, JSON.stringify({
        ...prev,
        selected_connector_ids: fetchPayload.connector_ids,
        scope: fetchScope,
        days: Number(fetchDays) || 7,
        start_date: rangeStart,
        end_date: rangeEnd,
      }));
    } catch (e) {
      console.error('Failed to persist FI setup before import', e);
    }

    setRefreshing(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/connectors/fetch`, {
        method: 'POST',
        body: JSON.stringify(fetchPayload),
      }, { retries: 0, timeoutMs: 180000 });
      const data = await parseApiResponse(res);
      if (res.ok) {
        const connectorCount = Array.isArray(data?.connectors) ? data.connectors.length : fetchPayload.connector_ids.length;
        const failedConnectors = Array.isArray(data?.connectors)
          ? data.connectors.filter(item => item && item.ok === false)
          : [];
        const failureDetails = failedConnectors
          .slice(0, 3)
          .map(item => item.name || item.source_type || `#${item.connector_id}`)
          .join(', ');

        let message = `Fetched ${connectorCount} connector(s). Imported ${data.imported || 0} feedback items (${data.skipped || 0} skipped).`;
        if (failedConnectors.length) {
          message += ` ${failedConnectors.length} connector(s) failed${failureDetails ? `: ${failureDetails}` : ''}.`;
        }
        if (data?.import_error) {
          message += ` Import warning: ${data.import_error}.`;
        }
        if (data?.post_process_error) {
          message += ` Post-process warning: ${data.post_process_error}.`;
        }
        const fetchedSourceLabels = Array.isArray(data?.connectors)
          ? data.connectors
            .map(item => String(item?.source_label || '').trim())
            .filter(Boolean)
          : [];
        try {
          const raw = localStorage.getItem(FI_SETUP_STORAGE_KEY);
          const prev = raw ? JSON.parse(raw) : {};
          localStorage.setItem(FI_SETUP_STORAGE_KEY, JSON.stringify({
            ...prev,
            selected_connector_ids: fetchPayload.connector_ids,
            scope: fetchScope,
            days: Number(fetchDays) || 7,
            start_date: rangeStart,
            end_date: rangeEnd,
            setup_complete: true,
            last_fetched_at: new Date().toISOString(),
          }));
        } catch (_err) {}
        const postFetchNote = connectorCount > 0
          ? (llmConnected
            ? ' Use Run Analysis in Feedback Inbox to analyze selected reviews.'
                      : ' AI analysis was skipped because LLM usage is paused.')
          : '';
        const fetchMessage = `${message}${postFetchNote}`;
        setSetupMessage(fetchMessage);
        if (showAlert) alert(fetchMessage);
        clearFeedbackFilters();
        setDetailView(null);
        setSelectedItem(null);
        setActiveView('feedback');
        await Promise.all([
          fetchDashboard(),
          fetchConnectors(),
          fetchFeedback({
            search: '',
            status: '',
            sentiment: '',
            priority: '',
            rating: '',
            source: '',
            offset: 0,
          }),
        ]);
        if (connectorCount > 0) {
          if (llmConnected) {
            setAnalysisNotice('Fetch completed. Apply filters and click Run Analysis to start CRM analysis.');
          } else {
        setAnalysisNotice('Reviews fetched successfully. LLM usage is paused, so CRM analysis is currently unavailable.');
          }
        }
      } else {
        const message = data?.detail || `Fetch failed (HTTP ${res.status}).`;
        setSetupMessage(message);
        if (showAlert) alert(message);
      }
    } catch (e) {
      const message = `Fetch failed: ${e.message}`;
      setSetupMessage(message);
      if (showAlert) alert(message);
    }
    setRefreshing(false);
  };

  const handleConnectorCreatedFromSetup = async (sourceId, fetchInterval = 'manual', analysisInterval = 'manual') => {
    if (sourceId) {
      setSelectedConnectorIds(prev => (prev.includes(sourceId) ? prev : [...prev, sourceId]));
      setFilterSource('');
      setConnectorIntervals(prev => ({ ...prev, [sourceId]: fetchInterval || 'manual' }));
      setConnectorAnalysisIntervals(prev => ({ ...prev, [sourceId]: analysisInterval || 'manual' }));
    }
    await fetchConnectors();
    setSetupMessage('Connector added and selected. Initial fetch will include all selected connectors.');
  };

  const handleConnectorRemovedFromSetup = async (connectorId) => {
    const connector = connectors.find(c => c.id === connectorId);
    const scope = connectorScopeOf(connector);
    const endpoint = scope === 'feedback_crm'
      ? `${API_BASE}/api/fi/connectors/${connectorId}`
      : `${API_BASE}/api/user/connectors/${connectorId}`;

    if (scope === 'workspace') {
      const confirmed = window.confirm('Remove this workspace source? It will also be unavailable in Feedback CRM.');
      if (!confirmed) return;
    }

    try {
      const res = await apiFetch(endpoint, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSetupMessage(data?.detail || 'Failed to remove connector.');
        return;
      }
      await fetchConnectors();
      setSelectedConnectorIds(prev => prev.filter(id => id !== connectorId));
      setSetupMessage(scope === 'workspace' ? 'Workspace source removed.' : 'Connector removed from Feedback CRM.');
    } catch (e) {
      setSetupMessage(`Failed to remove connector: ${e.message}`);
    }
  };

  const handleConnectorIntervalChange = (connectorId, interval) => {
    setConnectorIntervals(prev => ({ ...prev, [connectorId]: interval }));
  };

  const handleConnectorAnalysisIntervalChange = (connectorId, interval) => {
    setConnectorAnalysisIntervals(prev => ({ ...prev, [connectorId]: interval }));
  };

  const handleSaveConnectorInterval = async (connectorId) => {
    const interval = connectorIntervals[connectorId] || 'manual';
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/connectors/${connectorId}/interval`, {
        method: 'POST',
        body: JSON.stringify({ fetch_interval: interval }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSetupMessage(data?.detail || 'Failed to update interval.');
        return;
      }
      await fetchConnectors();
      setSetupMessage('Connector interval updated.');
    } catch (e) {
      setSetupMessage(`Failed to update interval: ${e.message}`);
    }
  };

  const handleSaveConnectorAnalysisInterval = async (connectorId) => {
    const interval = connectorAnalysisIntervals[connectorId] || 'manual';
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/connectors/${connectorId}/analysis-interval`, {
        method: 'POST',
        body: JSON.stringify({ analysis_interval: interval }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSetupMessage(data?.detail || 'Failed to update analysis interval.');
        return;
      }
      await fetchConnectors();
      setSetupMessage('Connector analysis interval updated.');
    } catch (e) {
      setSetupMessage(`Failed to update analysis interval: ${e.message}`);
    }
  };

  const handleSaveBulkConnectorIntervals = async (connectorIds = [], interval = 'manual') => {
    const ids = (Array.isArray(connectorIds) ? connectorIds : [])
      .map(v => Number(v))
      .filter(v => Number.isInteger(v) && v > 0);

    if (!ids.length) {
      setSetupMessage('Select at least one connector to set interval.');
      return { ok: false, failed: [] };
    }

    setConnectorIntervals(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        next[id] = interval;
      });
      return next;
    });

    const results = await Promise.all(ids.map(async (connectorId) => {
      try {
        const res = await apiFetch(`${API_BASE}/api/fi/connectors/${connectorId}/interval`, {
          method: 'POST',
          body: JSON.stringify({ fetch_interval: interval }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { connectorId, ok: false, detail: data?.detail || `HTTP ${res.status}` };
        }
        return { connectorId, ok: true };
      } catch (e) {
        return { connectorId, ok: false, detail: e.message || 'Request failed' };
      }
    }));

    const failed = results.filter(item => !item.ok);
    const successCount = results.length - failed.length;
    await fetchConnectors();

    if (!failed.length) {
      setSetupMessage(`Applied "${interval}" interval to ${successCount} connector(s).`);
    } else {
      setSetupMessage(`Applied "${interval}" to ${successCount}/${results.length} connector(s). ${failed.length} failed.`);
    }

    return { ok: failed.length === 0, failed };
  };

  const handleSaveBulkConnectorAnalysisIntervals = async (connectorIds = [], interval = 'manual') => {
    const ids = (Array.isArray(connectorIds) ? connectorIds : [])
      .map(v => Number(v))
      .filter(v => Number.isInteger(v) && v > 0);

    if (!ids.length) {
      setSetupMessage('Select at least one connector to set analysis interval.');
      return { ok: false, failed: [] };
    }

    setConnectorAnalysisIntervals(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        next[id] = interval;
      });
      return next;
    });

    const results = await Promise.all(ids.map(async (connectorId) => {
      try {
        const res = await apiFetch(`${API_BASE}/api/fi/connectors/${connectorId}/analysis-interval`, {
          method: 'POST',
          body: JSON.stringify({ analysis_interval: interval }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { connectorId, ok: false, detail: data?.detail || `HTTP ${res.status}` };
        }
        return { connectorId, ok: true };
      } catch (e) {
        return { connectorId, ok: false, detail: e.message || 'Request failed' };
      }
    }));

    const failed = results.filter(item => !item.ok);
    const successCount = results.length - failed.length;
    await fetchConnectors();

    if (!failed.length) {
      setSetupMessage(`Applied "${interval}" analysis interval to ${successCount} connector(s).`);
    } else {
      setSetupMessage(`Applied analysis interval "${interval}" to ${successCount}/${results.length} connector(s). ${failed.length} failed.`);
    }

    return { ok: failed.length === 0, failed };
  };

  const updateFeedbackStatus = async (id, status) => {
    await apiFetch(`${API_BASE}/api/fi/feedback/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    fetchFeedback();
  };

  const updateFeedbackPriority = async (id, priority) => {
    await apiFetch(`${API_BASE}/api/fi/feedback/${id}/priority`, { method: 'PATCH', body: JSON.stringify({ priority }) });
    fetchFeedback();
  };

  const generateAIResponse = async (feedbackText, issueName = '', issueStatus = '') => {
    if (!llmConnected) {
      setAnalysisNotice(llmDisconnectedMessage);
      setSetupMessage(llmDisconnectedMessage);
      return;
    }
    setAiLoading(true);
    setShowAIResponse(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/ai/generate-response`, {
        method: 'POST',
        body: JSON.stringify({ feedback_text: feedbackText, issue_name: issueName, issue_status: issueStatus, response_type: 'support_reply' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAiResponse(data.generated_response);
      } else {
        setAiResponse(data?.detail || 'Failed to generate response.');
      }
    } catch (e) { setAiResponse('Failed to generate response.'); }
    setAiLoading(false);
  };

  const generateAgenticOutreach = async (feedbackId) => {
    setOutreachGeneratingId(feedbackId);
    setAiLoading(true);
    setShowAIResponse(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/feedback/${feedbackId}/agentic-outreach`, {
        method: 'POST',
        body: JSON.stringify({ persist: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiResponse(data?.detail || 'Failed to generate outreach draft.');
        return;
      }

      if (data?.status !== 'ready') {
        const reason = data?.reason || 'No eligible offer/contact match found.';
        setAiResponse(`Agentic outreach skipped.\n\nReason: ${reason}`);
        return;
      }

      const contact = data?.contact || {};
      const drafts = data?.drafts || {};
      const blocks = [];
      if (drafts.email) {
        blocks.push(
          [
            `Email To: ${drafts.email.to || contact.email || 'N/A'}`,
            `Subject: ${drafts.email.subject || ''}`,
            '',
            drafts.email.message || '',
          ].join('\n')
        );
      }
      if (drafts.sms) {
        blocks.push(
          [
            `SMS To: ${drafts.sms.to || contact.mobile || 'N/A'}`,
            '',
            drafts.sms.message || '',
          ].join('\n')
        );
      }

      const header = [
        `Segment: ${data?.segment || 'all'}`,
        `Matched Offer: ${data?.offer_name || data?.offer_title || 'N/A'}`,
        '',
      ].join('\n');
      setAiResponse(`${header}${blocks.join('\n\n------------------------------\n\n')}`);
      setKnowledgeMessage('Instant outreach draft generated using knowledge base offers.');
    } catch (e) {
      setAiResponse(e?.message || 'Failed to generate outreach draft.');
    } finally {
      setAiLoading(false);
      setOutreachGeneratingId(null);
    }
  };

  const triggerInboxAnalysis = async (options = {}) => {
    if (!llmConnected) {
      setAnalysisOverlayOpen(false);
      setAnalysisNotice('LLM usage is paused. Enable it to run Feedback CRM analysis.');
      setSetupMessage(llmDisconnectedMessage);
      return;
    }
    try {
      const sourceFilter = Object.prototype.hasOwnProperty.call(options, 'source')
        ? (options.source ?? null)
        : null;
      const selectedSourceIds = Array.isArray(options.sourceIds) && options.sourceIds.length
        ? options.sourceIds
        : null;
      const startDateFilter = options.startDate || filterStartDate || null;
      const endDateFilter = options.endDate || filterEndDate || null;
      const ratingFilter = options.rating || (filterRating ? Number(filterRating) : null);
      const requestedRatingValues = Array.isArray(options.ratingValues) && options.ratingValues.length > 0
        ? options.ratingValues
        : analysisSelectedStars;
      const ratingValuesFilter = Array.from(
        new Set(
          (requestedRatingValues || [])
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5)
        )
      ).sort((a, b) => a - b);
      const effectiveSingleRating = ratingValuesFilter.length === 0 && Number.isFinite(Number(ratingFilter))
        ? Number(ratingFilter)
        : null;

      const statusFilter = options.status || filterStatus || null;
      const requestedStartIndex = Number.isFinite(Number(options.startIndex))
        ? Number(options.startIndex)
        : Number(analysisStartIndex);
      const requestedEndIndex = Number.isFinite(Number(options.endIndex))
        ? Number(options.endIndex)
        : Number(analysisEndIndex);
      const hasStartIndex = Number.isFinite(requestedStartIndex) && requestedStartIndex > 0;
      const hasEndIndex = Number.isFinite(requestedEndIndex) && requestedEndIndex > 0;
      const rawRequestedLimit = Object.prototype.hasOwnProperty.call(options, 'limit')
        ? options.limit
        : analysisLimit;
      const baseLimit = Number.isFinite(Number(rawRequestedLimit)) && Number(rawRequestedLimit) > 0
        ? Math.max(1, Math.min(5000, Math.floor(Number(rawRequestedLimit))))
        : null;
      let limitFilter = baseLimit;
      let offsetFilter = null;
      if (hasStartIndex && hasEndIndex) {
        const start = Math.min(requestedStartIndex, requestedEndIndex);
        const end = Math.max(requestedStartIndex, requestedEndIndex);
        offsetFilter = Math.max(0, Math.floor(start - 1));
        limitFilter = Math.max(1, Math.floor(end - start + 1));
      } else if (hasStartIndex) {
        offsetFilter = Math.max(0, Math.floor(requestedStartIndex - 1));
      } else if (hasEndIndex && !baseLimit) {
        limitFilter = Math.max(1, Math.floor(requestedEndIndex));
      }

      const resolveSelectedFeedbackIds = async () => {
        const params = new URLSearchParams();
        const searchFilter = String(searchQuery || '').trim();
        const sentimentFilter = filterSentiment || null;
        const priorityFilter = filterPriority || null;
        const resolvedOffset = Number.isFinite(Number(offsetFilter)) ? Math.max(0, Math.floor(Number(offsetFilter))) : 0;
        const filteredTotal = Math.max(0, Number(feedback?.total || 0));
        let resolvedLimit = Number.isFinite(Number(limitFilter)) && Number(limitFilter) > 0
          ? Math.max(1, Math.min(5000, Math.floor(Number(limitFilter))))
          : Math.max(1, Math.min(5000, filteredTotal > resolvedOffset ? filteredTotal - resolvedOffset : filteredTotal));
        if (!resolvedLimit && Array.isArray(feedback?.items)) {
          resolvedLimit = Math.max(1, Math.min(5000, feedback.items.length));
        }

        if (searchFilter) params.set('search', searchFilter);
        if (statusFilter) params.set('status', statusFilter);
        if (sentimentFilter) params.set('sentiment', sentimentFilter);
        if (priorityFilter) params.set('priority', priorityFilter);
        if (sourceFilter) params.set('source', sourceFilter);
        if (startDateFilter) params.set('start_date', startDateFilter);
        if (endDateFilter) params.set('end_date', endDateFilter);
        if (ratingValuesFilter.length > 0) {
          params.set('rating_values', ratingValuesFilter.join(','));
        } else if (Number.isFinite(Number(effectiveSingleRating))) {
          params.set('rating', String(Number(effectiveSingleRating)));
        }
        params.set('limit', String(resolvedLimit));
        params.set('offset', String(resolvedOffset));

        const selectionRes = await apiFetch(`${API_BASE}/api/fi/feedback?${params.toString()}`, {}, { retries: 0, timeoutMs: 60000 });
        const selectionData = await parseApiResponse(selectionRes);
        if (!selectionRes.ok) {
          throw new Error(selectionData?.detail || `Failed to resolve selected reviews (HTTP ${selectionRes.status}).`);
        }
        const selectedIds = Array.isArray(selectionData?.items)
          ? selectionData.items
            .map((item) => Number(item?.id))
            .filter((id) => Number.isInteger(id) && id > 0)
          : [];
        if (!selectedIds.length) {
          throw new Error('No reviews matched the current analysis selection.');
        }
        return selectedIds;
      };

      const selectedFeedbackIds = await resolveSelectedFeedbackIds();

      setAnalysisResultFilters({
        feedbackIds: selectedFeedbackIds,
        source: sourceFilter,
        sourceIds: selectedSourceIds,
        startDate: startDateFilter,
        endDate: endDateFilter,
        rating: Number.isFinite(Number(effectiveSingleRating)) ? Number(effectiveSingleRating) : null,
        ratingValues: ratingValuesFilter,
      });
      setAnalysisResultModalOpen(false);
      setAnalysisResultSummary(null);
      setAnalysisNotice('');
      setAnalysisProgress(0);
      setAnalysisStatus('Queueing Feedback CRM analysis...');
      setAnalysisLog([]);
      setAnalysisProcessedReviews(0);
      setAnalysisTotalReviews(0);
      setAnalysisInFlightReviews(0);
      setAnalysisPaused(false);
      setAnalysisStopping(false);
      setAnalysisOverlayOpen(true);
      const res = await apiFetch(`${API_BASE}/api/fi/analyze`, {
        method: 'POST',
        body: JSON.stringify({
          feedback_ids: selectedFeedbackIds,
          source: sourceFilter,
          source_ids: selectedSourceIds,
          start_date: startDateFilter,
          end_date: endDateFilter,
          rating: Number.isFinite(Number(effectiveSingleRating)) ? Number(effectiveSingleRating) : null,
          rating_values: ratingValuesFilter.length ? ratingValuesFilter : null,
          status: statusFilter,
          limit: null,
          offset: null,
          vertical: 'generic',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAnalysisNotice(data?.detail || `Analysis trigger failed (HTTP ${res.status}).`);
        setAnalysisOverlayOpen(false);
        return;
      }
      setAnalysisTaskId(data?.task_id || '');
      setAnalysisNotice(data?.message || `Feedback CRM analysis started for ${selectedFeedbackIds.length} selected review(s).`);
    } catch (e) {
      setAnalysisNotice(e.message || 'Failed to trigger analysis.');
      setAnalysisOverlayOpen(false);
    }
  };

  const viewIssueDetail = async (issueId) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/issues/${issueId}`);
      if (res.ok) { setSelectedItem(await res.json()); setDetailView('issue'); }
    } catch {}
  };

  const viewCustomerTimeline = async (customerId) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/customers/${customerId}/timeline`);
      if (res.ok) { setSelectedItem(await res.json()); setDetailView('customer'); }
    } catch {}
  };
  const closeCustomerDetailCard = () => {
    setDetailView(null);
    setSelectedItem(null);
    setShowCustomerMessageModal(false);
    setCustomerMessageLoading(false);
    setCustomerMessageNotice('');
  };

  const generateWinbackDraft = async (customerId) => {
    if (!llmConnected) {
      setAnalysisNotice(llmDisconnectedMessage);
      setSetupMessage(llmDisconnectedMessage);
      return;
    }
    setAiLoading(true);
    setShowAIResponse(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/customers/${customerId}/winback-draft`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAiResponse(`Subject: ${data.subject}\n\n${data.body}`);
      } else {
        setAiResponse(data?.detail || 'Failed to draft winback email.');
      }
    } catch (e) { setAiResponse('Failed to draft winback email.'); }
    setAiLoading(false);
  };

  const closeCustomerMessageComposer = () => {
    setShowCustomerMessageModal(false);
    setCustomerMessageLoading(false);
    setCustomerMessageNotice('');
    setCustomerMessageState({
      customerId: null,
      feedbackId: null,
      channel: 'email',
      to: '',
      contactEmail: '',
      contactMobile: '',
      subject: '',
      message: '',
      drafts: {},
      availableChannels: [],
      autoDraftReason: '',
      customerName: '',
    });
  };

  const applyAutoDraftForChannel = (channel) => {
    setCustomerMessageState((prev) => {
      const drafts = prev?.drafts || {};
      const draft = drafts[channel] || (channel === 'whatsapp' ? drafts.sms : null) || null;
      const fallbackTo = channel === 'email' ? prev.contactEmail : prev.contactMobile;
      const nextTo = draft?.to || fallbackTo || '';
      const nextSubject = channel === 'email'
        ? (draft?.subject || prev.subject || `Quick update for ${prev.customerName || 'you'}`)
        : '';
      const fallbackBody = prev.message || `Hi ${prev.customerName || 'there'},\n\nThank you for your feedback. We wanted to share a quick update and a support offer for you.\n\nBest regards,\nCustomer Success Team`;
      const nextMessage = draft?.message || fallbackBody;
      return {
        ...prev,
        channel,
        to: nextTo,
        subject: nextSubject,
        message: nextMessage,
      };
    });
  };

  const openCustomerMessageComposer = async (customerProfile) => {
    const timeline = Array.isArray(customerProfile?.timeline) ? customerProfile.timeline : [];
    if (!timeline.length) {
      setAnalysisNotice('No feedback timeline exists for this customer yet.');
      return;
    }

    const newestFirst = [...timeline].reverse();
    let selectedFeedback = newestFirst[0];
    let selectedContact = extractFeedbackContact(
      safeJsonParse(newestFirst[0]?.metadata_json, {}) || {},
      customerProfile?.customer_identifier || ''
    );

    for (const entry of newestFirst) {
      const metadata = safeJsonParse(entry?.metadata_json, {}) || {};
      const contact = extractFeedbackContact(metadata, customerProfile?.customer_identifier || '');
      if (contact.email || contact.mobile) {
        selectedFeedback = entry;
        selectedContact = contact;
        break;
      }
    }

    const baseName = selectedContact?.name || customerProfile?.customer_identifier || 'Customer';
    const baseChannel = selectedContact.email ? 'email' : (selectedContact.mobile ? 'sms' : 'email');
    const baseSubject = `Quick update for ${baseName}`;
    const baseMessage = `Hi ${baseName},\n\nThank you for your feedback. We reviewed your experience and wanted to share a quick update along with a support offer.\n\nBest regards,\nCustomer Success Team`;
    setCustomerMessageNotice('');
    setCustomerMessageState({
      customerId: customerProfile?.id || null,
      feedbackId: selectedFeedback?.id || null,
      channel: baseChannel,
      to: baseChannel === 'email' ? selectedContact.email : selectedContact.mobile,
      contactEmail: selectedContact.email || '',
      contactMobile: selectedContact.mobile || '',
      subject: baseSubject,
      message: baseMessage,
      drafts: {},
      availableChannels: [],
      autoDraftReason: '',
      customerName: baseName,
    });
    setShowCustomerMessageModal(true);

    if (!selectedFeedback?.id) return;

    setCustomerMessageLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/feedback/${selectedFeedback.id}/agentic-outreach`, {
        method: 'POST',
        body: JSON.stringify({ persist: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCustomerMessageState((prev) => ({
          ...prev,
          autoDraftReason: data?.detail || 'Could not generate auto draft from knowledge base.',
        }));
        return;
      }
      if (data?.status !== 'ready') {
        setCustomerMessageState((prev) => ({
          ...prev,
          autoDraftReason: data?.reason || 'No eligible offer/contact combination found for auto draft.',
        }));
        return;
      }

      const contact = data?.contact || {};
      const drafts = data?.drafts || {};
      const contactEmail = normalizeEmail(contact.email) || selectedContact.email || '';
      const contactMobile = normalizeMobile(contact.mobile) || selectedContact.mobile || '';
      const availableChannels = Object.keys(drafts).filter(Boolean);
      const preferredChannel = drafts.email
        ? 'email'
        : drafts.sms
          ? (contactMobile ? 'whatsapp' : 'sms')
          : baseChannel;
      const preferredDraft = drafts[preferredChannel === 'whatsapp' ? 'sms' : preferredChannel] || null;
      setCustomerMessageState((prev) => ({
        ...prev,
        channel: preferredChannel,
        to: preferredDraft?.to || (preferredChannel === 'email' ? contactEmail : contactMobile),
        contactEmail,
        contactMobile,
        subject: preferredChannel === 'email'
          ? (preferredDraft?.subject || prev.subject)
          : '',
        message: preferredDraft?.message || prev.message,
        drafts,
        availableChannels,
        autoDraftReason: '',
        customerName: contact.name || prev.customerName,
      }));
      setCustomerMessageNotice('Auto draft prepared from the knowledge base. You can edit before sending.');
    } catch (e) {
      setCustomerMessageState((prev) => ({
        ...prev,
        autoDraftReason: e?.message || 'Could not generate auto draft from knowledge base.',
      }));
    } finally {
      setCustomerMessageLoading(false);
    }
  };

  const handleSendCustomerMessage = () => {
    const channel = String(customerMessageState?.channel || '').toLowerCase();
    const to = String(customerMessageState?.to || '').trim();
    const subject = String(customerMessageState?.subject || '').trim();
    const message = String(customerMessageState?.message || '').trim();

    if (!to) {
      setCustomerMessageNotice('Add a recipient before sending.');
      return;
    }
    if (!message) {
      setCustomerMessageNotice('Message body cannot be empty.');
      return;
    }

    let launchUrl = '';
    if (channel === 'email') {
      const encodedTo = encodeURIComponent(to);
      const encodedSubject = encodeURIComponent(subject || `Update for ${customerMessageState.customerName || 'you'}`);
      const encodedBody = encodeURIComponent(message);
      launchUrl = `mailto:${encodedTo}?subject=${encodedSubject}&body=${encodedBody}`;
    } else if (channel === 'sms') {
      const encodedBody = encodeURIComponent(message);
      launchUrl = `sms:${to}?body=${encodedBody}`;
    } else {
      const waNumber = normalizeWhatsAppNumber(to);
      if (!waNumber) {
        setCustomerMessageNotice('WhatsApp requires a valid mobile number.');
        return;
      }
      const encodedBody = encodeURIComponent(message);
      launchUrl = `https://wa.me/${waNumber}?text=${encodedBody}`;
    }

    window.open(launchUrl, '_blank', 'noopener,noreferrer');
    setCustomerMessageNotice(`Opened ${channel.toUpperCase()} draft. Confirm send in your channel app.`);
  };

  const navItems = [
    { id: 'setup', label: 'Source Setup', icon: Plug, color: 'violet' },
    { id: 'knowledge_base', label: 'Offer KB', icon: Tag, color: 'fuchsia' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, color: 'indigo' },
    { id: 'feedback', label: 'Feedback Inbox', icon: Inbox, color: 'blue' },
    { id: 'issues', label: 'Issues', icon: AlertTriangle, color: 'amber' },
    { id: 'customers', label: 'Customers', icon: Users, color: 'emerald' },
  ];

  // ── Detail Views ────────────────────────────────────────────────────────
  if (detailView === 'issue' && selectedItem) {
    return (
      <div className="h-full overflow-y-auto p-8 custom-scrollbar">
        <button onClick={() => { setDetailView(null); setSelectedItem(null); }} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Issues
        </button>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 mb-1">{selectedItem.name}</h1>
                <p className="text-sm text-slate-500">{selectedItem.description || 'No description'}</p>
              </div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusBg(selectedItem.status)}`}>{selectedItem.status}</span>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-6">
              {[
                { label: 'Mentions', value: selectedItem.mention_count, icon: MessageSquare },
                { label: 'Neg. Ratio', value: `${Math.round((selectedItem.negative_ratio || 0) * 100)}%`, icon: AlertTriangle },
                { label: 'Impact Score', value: Math.round(selectedItem.impact_score || 0), icon: Zap },
                { label: 'Trend', value: selectedItem.trend, icon: TrendingUp },
              ].map((m, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2"><m.icon size={14} className="text-slate-400" /><span className="text-xs text-slate-500">{m.label}</span></div>
                  <p className="text-lg font-bold text-slate-900">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Sentiment Breakdown */}
          {selectedItem.sentiment_breakdown && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Sentiment Breakdown</h3>
              <div className="flex gap-4">
                {['positive', 'neutral', 'negative'].map(s => (
                  <div key={s} className={`flex-1 rounded-xl p-3 border ${sentimentBg(s)}`}>
                    <p className="text-xs font-medium capitalize">{s}</p>
                    <p className="text-lg font-bold">{selectedItem.sentiment_breakdown[s] || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Quotes */}
          {selectedItem.quotes?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Representative Quotes</h3>
              <div className="space-y-3">
                {selectedItem.quotes.map((q, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 italic">"{q}"</div>
                ))}
              </div>
            </div>
          )}
          {/* Related Feedback */}
          {selectedItem.related_feedback?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Related Feedback ({selectedItem.related_feedback.length})</h3>
              <div className="space-y-2">
                {selectedItem.related_feedback.map(f => {
                  const sentimentUi = sentimentDisplayForFeedback(f);
                  const priorityUi = priorityDisplayForFeedback(f);
                  return (
                    <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between gap-4">
                      <p className="text-sm text-slate-700 flex-1 line-clamp-2">{f.text}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${sentimentUi.className}`}>{sentimentUi.label}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${priorityUi.className}`}>{priorityUi.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const customerDetail = detailView === 'customer' && selectedItem ? selectedItem : null;
  const customerTimeline = Array.isArray(customerDetail?.timeline) ? customerDetail.timeline : [];
  const latestCustomerFeedback = customerTimeline.length ? customerTimeline[customerTimeline.length - 1] : null;
  const customerTimelinePreview = [...customerTimeline].reverse();
  const latestCustomerSentiment = latestCustomerFeedback
    ? sentimentDisplayForFeedback(latestCustomerFeedback)
    : { label: 'No feedback yet', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  const analysisSummary = analysisResultSummary || {};
  const analysisTotalReviewsValue = Math.max(0, Number(analysisSummary?.total_reviews || 0));
  const positivePct = analysisTotalReviewsValue > 0 ? Math.round((Number(analysisSummary?.positive_count || 0) / analysisTotalReviewsValue) * 100) : 0;
  const neutralPct = analysisTotalReviewsValue > 0 ? Math.round((Number(analysisSummary?.neutral_count || 0) / analysisTotalReviewsValue) * 100) : 0;
  const negativePct = analysisTotalReviewsValue > 0 ? Math.round((Number(analysisSummary?.negative_count || 0) / analysisTotalReviewsValue) * 100) : 0;

  // ── Main Layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#f7f8fa] overflow-hidden">
      {/* Left Nav */}
      <div className="w-56 bg-white border-r border-slate-200/80 flex flex-col shrink-0 py-4 px-3">
        {typeof onBack === 'function' && (
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Back to Home
          </button>
        )}
        <div className="flex items-center gap-2.5 px-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/25">
            <Activity size={15} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[14px] tracking-tight text-slate-900 leading-none">Feedback CRM</span>
            <span className="text-[9px] text-slate-400 font-medium tracking-wider uppercase">Intelligence</span>
          </div>
        </div>
        <div className="space-y-0.5 flex-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveView(item.id); setDetailView(null); setSelectedItem(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${activeView === item.id ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm border border-indigo-100' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
              <item.icon size={17} className={activeView === item.id ? 'text-indigo-600' : 'text-slate-400'} />
              {item.label}
            </button>
          ))}
        </div>
        <div className="space-y-1 pt-4 border-t border-slate-100">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 mb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">LLM Usage</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Current Status</p>
                <p className="text-[12px] font-semibold text-slate-900">
                  {llmGatewayStatusLabel}
                </p>
                {llmGatewayWarning && (
                  <p className="mt-1 text-[10px] text-amber-600 line-clamp-2" title={String(llmGatewayWarning)}>
                    {String(llmGatewayWarning)}
                  </p>
                )}
                {llmConnected && !llmEndpointActive && llmEndpointError && (
                  <p className="mt-1 text-[10px] text-rose-500 line-clamp-2" title={String(llmEndpointError)}>
                    {String(llmEndpointError)}
                  </p>
                )}
              </div>
              <button
                onClick={toggleLlmConnection}
                disabled={llmBusy}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${llmConnected ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'} disabled:opacity-50`}
              >
                {llmBusy ? 'Saving...' : llmConnected ? 'Pause Usage' : 'Enable Usage'}
              </button>
            </div>
            {false && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <p className="uppercase tracking-[0.12em] font-bold text-[10px] text-slate-400">Gateway Routes</p>
                <div className="mt-2 space-y-1">
                  {llmGatewayEndpoints.slice(0, 3).map((endpoint) => (
                    <div key={endpoint.url} className="flex items-start justify-between gap-2 text-[10px]">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-700 truncate">
                          {endpoint.label}
                          {endpoint.active ? ' • Active' : ''}
                        </p>
                        <p className="text-slate-400 truncate" title={String(endpoint.url)}>{String(endpoint.url)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold ${
                        endpoint.status === 'connected'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : endpoint.status === 'standby'
                            ? 'bg-slate-50 text-slate-500 border-slate-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {endpoint.status === 'connected' ? 'Online' : endpoint.status === 'standby' ? 'Standby' : 'Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Token Used</p>
                <p className="text-[13px] font-bold text-slate-900">{Number(llmUsage?.usage?.total_tokens || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          {(analysisTaskId || analysisProgress > 0) && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">Analysis Progress</p>
              <p className="mt-1 text-[12px] font-semibold text-indigo-900">
                {analysisProcessedReviews} of {analysisTotalReviews || 0} processed
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, Number(analysisProgress) || 0))}%` }}
                />
              </div>
            </div>
          )}
          <button onClick={() => handleFetchIntoCRM({ showAlert: false })} disabled={refreshing} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:bg-slate-50 transition-all">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Fetch Into CRM
          </button>
          <button onClick={handleRefresh} disabled={refreshing} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:bg-slate-50 transition-all">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Recalculate Scores
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeView === 'setup' && (
          <SourceSetupView
            connectors={connectors}
            loading={loading}
            selectedConnectorIds={selectedConnectorIds}
            onToggleConnector={toggleConnectorSelection}
            fetchScope={fetchScope}
            onFetchScopeChange={setFetchScope}
            fetchDays={fetchDays}
            onFetchDaysChange={setFetchDays}
            rangeStart={rangeStart}
            onRangeStartChange={setRangeStart}
            rangeEnd={rangeEnd}
            onRangeEndChange={setRangeEnd}
            savingSetup={savingSetup}
            refreshing={refreshing}
            setupMessage={setupMessage}
            onSaveSetup={saveSetupPreferences}
            connectorIntervals={connectorIntervals}
            onConnectorIntervalChange={handleConnectorIntervalChange}
            onSaveConnectorInterval={handleSaveConnectorInterval}
            onSaveBulkConnectorIntervals={handleSaveBulkConnectorIntervals}
            connectorAnalysisIntervals={connectorAnalysisIntervals}
            onConnectorAnalysisIntervalChange={handleConnectorAnalysisIntervalChange}
            onSaveConnectorAnalysisInterval={handleSaveConnectorAnalysisInterval}
            onSaveBulkConnectorAnalysisIntervals={handleSaveBulkConnectorAnalysisIntervals}
            onRemoveConnector={handleConnectorRemovedFromSetup}
            onFetchNow={() => handleFetchIntoCRM({ showAlert: false })}
            onConnectorCreated={handleConnectorCreatedFromSetup}
          />
        )}
        {activeView === 'knowledge_base' && (
          <KnowledgeBaseView
            data={knowledgeOffers}
            loading={knowledgeLoading}
            message={knowledgeMessage}
            onCreateOffer={createKnowledgeOffer}
            onUpdateOffer={updateKnowledgeOffer}
            onDeleteOffer={deleteKnowledgeOffer}
            onRefresh={fetchKnowledgeOffers}
            onMessage={setKnowledgeMessage}
          />
        )}
        {activeView === 'dashboard' && <DashboardView dashboard={dashboard} onViewIssue={viewIssueDetail} onNav={setActiveView} />}
        {activeView === 'feedback' && (
          <FeedbackInboxView
            data={feedback} loading={loading} search={searchQuery} onSearch={setSearchQuery}
            filterStatus={filterStatus} onFilterStatus={setFilterStatus}
            filterSentiment={filterSentiment} onFilterSentiment={setFilterSentiment}
            filterPriority={filterPriority} onFilterPriority={setFilterPriority}
            filterRating={filterRating} onFilterRating={setFilterRating}
            filterSource={filterSource} onFilterSource={setFilterSource}
            filterStartDate={filterStartDate} onFilterStartDate={setFilterStartDate}
            filterEndDate={filterEndDate} onFilterEndDate={setFilterEndDate}
            analysisLimit={analysisLimit} onAnalysisLimit={setAnalysisLimit}
            analysisStartIndex={analysisStartIndex} onAnalysisStartIndex={setAnalysisStartIndex}
            analysisEndIndex={analysisEndIndex} onAnalysisEndIndex={setAnalysisEndIndex}
            analysisSelectedStars={analysisSelectedStars} onAnalysisSelectedStars={setAnalysisSelectedStars}
            feedbackLimit={feedbackLimit}
            feedbackOffset={feedbackOffset}
            onChangePageSize={(nextLimit) => {
              setFeedbackLimit(nextLimit);
              fetchFeedback({ limit: nextLimit, offset: 0 });
            }}
            onUpdateStatus={updateFeedbackStatus} onUpdatePriority={updateFeedbackPriority}
            onGenerateResponse={generateAIResponse} onRefresh={fetchFeedback}
            onGenerateOutreach={generateAgenticOutreach}
            onClearFilters={clearFeedbackFilters}
            onShowCreate={() => setShowCreateFeedback(true)}
            onRunAnalysis={triggerInboxAnalysis}
            llmConnected={llmConnected}
            analysisTriggering={Boolean(analysisTaskId)}
            analysisTriggerMessage={analysisNotice}
            analysisProgress={analysisProgress}
            analysisStatus={analysisStatus}
            outreachGeneratingId={outreachGeneratingId}
          />
        )}
        {activeView === 'issues' && <IssuesView data={issues} loading={loading} onViewDetail={viewIssueDetail} onShowCreate={() => setShowCreateIssue(true)} />}
        {activeView === 'customers' && <CustomersView data={customers} loading={loading} search={searchQuery} onSearch={setSearchQuery} onViewTimeline={viewCustomerTimeline} />}
      </div>

      {/* AI Response Modal */}
      <AnimatePresence>
        {analysisOverlayOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/35 p-4">
            <motion.div initial={{ scale: 0.97, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0, y: 12 }} className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_120px_-50px_rgba(15,23,42,0.45)]">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Feedback CRM Analysis</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Processing Inbox Feedback</h3>
                    <p className="mt-2 text-sm text-slate-600">{analysisStatus || 'Preparing analysis pipeline...'}</p>
                    {analysisTotalReviews > 0 && (
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {analysisProcessedReviews} / {analysisTotalReviews} feedback records processed
                        {analysisInFlightReviews > 0 ? ` (${analysisInFlightReviews} in-flight)` : ''}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setAnalysisOverlayOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                    Minimize
                  </button>
                </div>
              </div>
              <div className="space-y-5 px-6 py-5">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                  <span>{Math.max(0, Math.min(100, Number(analysisProgress) || 0))}% complete</span>
                  <span>{analysisPaused ? 'Paused' : analysisStopping ? 'Stopping' : `${analysisTotalReviews || 0} total records`}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${analysisPaused ? 'from-amber-400 via-orange-400 to-amber-500' : analysisStopping ? 'from-rose-500 via-pink-500 to-orange-400' : 'from-emerald-500 via-cyan-500 to-sky-500'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, Number(analysisProgress) || 0))}%` }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Processed</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{analysisProcessedReviews}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">In Flight</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{analysisInFlightReviews}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{analysisPaused ? 'Paused' : analysisStopping ? 'Stopping' : analysisTaskId ? 'Running' : 'Finishing'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {analysisPaused ? (
                    <button
                      onClick={() => handleAnalysisTaskControl('resume')}
                      disabled={!analysisTaskId || analysisStopping}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Zap size={14} />
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAnalysisTaskControl('pause')}
                      disabled={!analysisTaskId || analysisStopping}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Clock size={14} />
                      Pause
                    </button>
                  )}
                  <button
                    onClick={() => handleAnalysisTaskControl('stop')}
                    disabled={!analysisTaskId || analysisStopping}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={14} className="rotate-45" />
                    Stop
                  </button>
                </div>
                {analysisLog.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-sm text-slate-100">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Live Log</p>
                    <div className="space-y-2">
                      {analysisLog.slice(-5).map((entry, index) => (
                        <p key={`${index}-${entry}`} className="text-sm leading-6 text-slate-200">{entry}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        {analysisResultModalOpen && analysisResultSummary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-900/45 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAnalysisResultModalOpen(false)}
              className="absolute inset-0"
            />
            <motion.div initial={{ scale: 0.97, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0, y: 10 }} className="relative z-10 w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_45px_140px_-60px_rgba(15,23,42,0.75)]">
              <button
                onClick={() => setAnalysisResultModalOpen(false)}
                className="absolute right-4 top-4 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Analysis Complete</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">General Results and User Segments</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {analysisTotalReviewsValue.toLocaleString()} analyzed reviews with grouped problem segments.
                </p>
                {(analysisResultFilters?.startDate || analysisResultFilters?.endDate || analysisResultFilters?.rating || analysisResultFilters?.source || (analysisResultFilters?.ratingValues && analysisResultFilters.ratingValues.length > 0)) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysisResultFilters?.source && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                        Source: {analysisResultFilters.source}
                      </span>
                    )}
                    {analysisResultFilters?.startDate && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                        From: {analysisResultFilters.startDate}
                      </span>
                    )}
                    {analysisResultFilters?.endDate && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                        To: {analysisResultFilters.endDate}
                      </span>
                    )}
                    {analysisResultFilters?.rating && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                        Rating: {analysisResultFilters.rating} star
                      </span>
                    )}
                    {Array.isArray(analysisResultFilters?.ratingValues) && analysisResultFilters.ratingValues.length > 0 && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                        Stars: {[...analysisResultFilters.ratingValues].sort((a, b) => a - b).map((value) => `${value}★`).join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Avg Sentiment</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{Number(analysisSummary?.avg_sentiment || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Avg Churn</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{Number(analysisSummary?.avg_churn || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">High Churn</p>
                  <p className="mt-1 text-2xl font-black text-rose-600">{Number(analysisSummary?.high_churn || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Trend</p>
                  <p className={`mt-1 text-sm font-bold capitalize ${analysisSummary?.sentiment_trend === 'improving' ? 'text-emerald-600' : analysisSummary?.sentiment_trend === 'degrading' ? 'text-rose-600' : 'text-slate-700'}`}>
                    {analysisSummary?.sentiment_trend || 'stable'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Sentiment Mix</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-emerald-700">Positive</p>
                    <p className="text-lg font-black text-emerald-800">{positivePct}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold text-slate-700">Neutral</p>
                    <p className="text-lg font-black text-slate-800">{neutralPct}%</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-rose-700">Negative</p>
                    <p className="text-lg font-black text-rose-800">{negativePct}%</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Main Problem To Fix</p>
                  <h4 className="mt-1 text-lg font-black text-slate-900">{analysisSummary?.main_problem_to_fix?.pain_point || 'none'}</h4>
                  <p className="mt-2 text-sm text-slate-600">{analysisSummary?.main_problem_to_fix?.why_now || 'No dominant pain point detected.'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <p className="text-slate-500">Affected Reviews</p>
                      <p className="font-bold text-slate-900">{Number(analysisSummary?.main_problem_to_fix?.affected_reviews || 0)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <p className="text-slate-500">Impact Score</p>
                      <p className="font-bold text-slate-900">{Number(analysisSummary?.main_problem_to_fix?.impact_score || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">User Segments (Same Problem Groups)</p>
                  <div className="mt-2 space-y-2">
                    {(analysisSummary?.user_segments || []).slice(0, 6).map((segment) => (
                      <div key={`${segment.segment}-${segment.count}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="font-medium text-slate-700">{segment.segment}</span>
                        <span className="font-semibold text-indigo-700">{segment.count}</span>
                      </div>
                    ))}
                    {(!analysisSummary?.user_segments || analysisSummary.user_segments.length === 0) && (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">No segment clusters yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Top Pain Points</p>
                  <div className="mt-2 space-y-2">
                    {(analysisSummary?.top_pain_points || []).slice(0, 5).map((pain) => (
                      <div key={`${pain.pain_point}-${pain.count}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-800">{pain.pain_point}</p>
                        <p className="text-xs text-slate-500">{pain.count} reviews | impact {Number(pain.impact_score || 0).toFixed(2)}</p>
                      </div>
                    ))}
                    {(!analysisSummary?.top_pain_points || analysisSummary.top_pain_points.length === 0) && (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">No pain points found yet.</div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Growth Opportunities</p>
                  <div className="mt-2 space-y-2">
                    {(analysisSummary?.growth_opportunities || []).slice(0, 5).map((item) => (
                      <div key={`${item.suggestion}-${item.count}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{item.suggestion}</p>
                        <p className="text-xs text-slate-500">{item.count} mentions</p>
                      </div>
                    ))}
                    {(!analysisSummary?.growth_opportunities || analysisSummary.growth_opportunities.length === 0) && (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">No opportunity patterns detected.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setAnalysisResultModalOpen(false);
                    setActiveView('knowledge_base');
                  }}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                >
                  Open Offer KB
                </button>
                <button
                  onClick={() => {
                    setAnalysisResultModalOpen(false);
                    setActiveView('customers');
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  View Customer Profiles
                </button>
                <button
                  onClick={() => setAnalysisResultModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {customerDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-900/35 p-3 sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCustomerDetailCard}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-5xl rounded-[34px] border border-slate-200/80 bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200/80 p-4 shadow-[0_50px_120px_-50px_rgba(15,23,42,0.65)] sm:p-7"
            >
              <button
                onClick={closeCustomerDetailCard}
                className="absolute right-4 top-4 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                title="Close customer details"
              >
                <X size={16} />
              </button>
              <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-5">
                <div className="rounded-[26px] border border-slate-200/90 bg-white/95 p-5 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.55)] sm:p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Customer Detail Card</p>
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-base font-black text-white">
                        {(customerDetail.customer_identifier || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-black tracking-tight text-slate-900">{customerDetail.customer_identifier || 'Unknown Customer'}</h2>
                        <p className="text-xs text-slate-500">Customer since {formatDateLabel(customerDetail.first_seen_at)}</p>
                      </div>
                    </div>
                    <span className={`h-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize ${sentimentBg(customerDetail.overall_sentiment)}`}>
                      {customerDetail.overall_sentiment || 'neutral'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Feedback Count</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">{customerDetail.total_feedback_count || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Sentiment Trend</p>
                      <p className={`mt-1 text-sm font-bold capitalize ${customerDetail.sentiment_trend === 'improving' ? 'text-emerald-600' : customerDetail.sentiment_trend === 'degrading' ? 'text-rose-600' : 'text-slate-700'}`}>
                        {customerDetail.sentiment_trend || 'stable'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Latest Update</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDateTimeLabel(latestCustomerFeedback?.date || customerDetail.last_feedback_at || customerDetail.first_seen_at)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() => openCustomerMessageComposer(customerDetail)}
                      disabled={!customerTimeline.length}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Send size={15} />
                      Message Customer
                    </button>
                    <button
                      onClick={() => generateWinbackDraft(customerDetail.id)}
                      disabled={!llmConnected}
                title={llmConnected ? 'Draft a personalized winback email' : 'Enable LLM usage to draft winback emails'}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Sparkles size={15} />
                  {llmConnected ? 'Draft Winback Email' : 'LLM Paused'}
                    </button>
                    <button
                      onClick={closeCustomerDetailCard}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200/90 bg-white/95 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.5)] sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Customer Timeline ({customerTimeline.length})</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${latestCustomerSentiment.className}`}>
                      {latestCustomerSentiment.label}
                    </span>
                  </div>
                  {customerTimelinePreview.length > 0 ? (
                    <div className="space-y-2.5">
                      {customerTimelinePreview.map((entry) => {
                        const entrySentiment = sentimentDisplayForFeedback(entry);
                        const entryPriority = priorityDisplayForFeedback(entry);
                        const ratingLabel = Number.isFinite(Number(entry?.rating)) && Number(entry.rating) > 0
                          ? `${Math.max(1, Math.min(5, Math.round(Number(entry.rating))))} Star`
                          : null;
                        return (
                          <div key={entry.id || `${entry.date}-${entry.feedback}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${entrySentiment.className}`}>{entrySentiment.label}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${entryPriority.className}`}>{entryPriority.label}</span>
                                {ratingLabel && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{ratingLabel}</span>}
                                {entry?.status && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBg(entry.status)}`}>{entry.status}</span>}
                              </div>
                              <span className="text-[11px] text-slate-500">{formatDateLabel(entry.date)}</span>
                            </div>
                            <p className="line-clamp-2 text-sm text-slate-700">{entry.feedback || 'No feedback text available.'}</p>
                            {entry.issue_name && <p className="mt-1.5 text-[11px] font-semibold text-indigo-600">Issue: {entry.issue_name}</p>}
                            {entry.source && <p className="mt-1 text-[10px] uppercase tracking-[0.11em] text-slate-500">Source: {entry.source}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      No timeline feedback is available for this customer yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="pointer-events-none absolute -left-2 top-[42%] hidden w-64 -translate-x-3/4 -translate-y-1/2 xl:block">
                <div className="pointer-events-auto rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)]">
                  <h4 className="text-[26px] font-black tracking-tight text-slate-900">Capacity</h4>
                  <p className="mt-1 text-sm text-slate-500">Set engagement capacity for this customer profile.</p>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-slate-500">Feedback Volume</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{customerDetail.total_feedback_count || 0}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Status</p>
                      <p className="text-sm font-bold text-slate-800">{customerTimeline.length > 0 ? 'Monitored' : 'New profile'}</p>
                    </div>
                    <span className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white">Running</span>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute -right-3 top-[58%] hidden w-72 translate-x-3/4 -translate-y-1/2 xl:block">
                <div className="pointer-events-auto rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)]">
                  <h4 className="text-3xl font-black tracking-tight text-slate-900">Refresh Rhythm</h4>
                  <p className="mt-1 text-sm text-slate-500">Recent interaction checkpoints for this customer.</p>
                  <div className="mt-4 space-y-2.5 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Current Time</p>
                      <p className="font-semibold text-slate-800">{formatDateTimeLabel(new Date())}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Last Feedback Time</p>
                      <p className="font-semibold text-slate-800">
                        {formatDateTimeLabel(latestCustomerFeedback?.date || customerDetail.last_feedback_at || customerDetail.first_seen_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Last Linked Issue</p>
                      <p className="font-semibold text-slate-800">{latestCustomerFeedback?.issue_name || 'No issue linked yet'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showCustomerMessageModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99] flex items-center justify-center bg-slate-900/45 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCustomerMessageComposer}
              className="absolute inset-0"
            />
            <motion.div initial={{ scale: 0.97, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0, y: 10 }} className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Customer Outreach</p>
                  <h3 className="text-lg font-black text-slate-900">Send Offer Message</h3>
                  <p className="text-sm text-slate-500">Auto draft from knowledge base is editable before sending.</p>
                </div>
                <button onClick={closeCustomerMessageComposer} className="rounded-lg border border-slate-200 px-2.5 py-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>

              {customerMessageLoading && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                  <Loader2 size={14} className="animate-spin" />
                  Preparing auto draft...
                </div>
              )}
              {!customerMessageLoading && customerMessageState?.autoDraftReason && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {customerMessageState.autoDraftReason}
                </div>
              )}
              {customerMessageNotice && (
                <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {customerMessageNotice}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { id: 'email', label: 'Email' },
                  { id: 'sms', label: 'SMS' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                ].map((channelItem) => (
                  <button
                    key={channelItem.id}
                    onClick={() => applyAutoDraftForChannel(channelItem.id)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      customerMessageState.channel === channelItem.id
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {channelItem.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Customer</label>
                  <input
                    value={customerMessageState.customerName || ''}
                    onChange={(e) => setCustomerMessageState((prev) => ({ ...prev, customerName: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    {customerMessageState.channel === 'email' ? 'Email To' : 'Mobile To'}
                  </label>
                  <input
                    value={customerMessageState.to || ''}
                    onChange={(e) => setCustomerMessageState((prev) => ({ ...prev, to: e.target.value }))}
                    placeholder={customerMessageState.channel === 'email' ? 'customer@email.com' : '+15551234567'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
                {customerMessageState.channel === 'email' && (
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Subject</label>
                    <input
                      value={customerMessageState.subject || ''}
                      onChange={(e) => setCustomerMessageState((prev) => ({ ...prev, subject: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Message</label>
                  <textarea
                    value={customerMessageState.message || ''}
                    onChange={(e) => setCustomerMessageState((prev) => ({ ...prev, message: e.target.value }))}
                    className="min-h-[180px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => applyAutoDraftForChannel(customerMessageState.channel || 'email')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reapply Auto Draft
                </button>
                <button
                  onClick={handleSendCustomerMessage}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Open {String(customerMessageState.channel || '').toUpperCase()} Draft
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showAIResponse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAIResponse(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-white rounded-2xl p-6 w-full max-w-lg relative z-10 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" /><h3 className="font-semibold text-slate-900">AI Generated Response</h3></div>
                <button onClick={() => setShowAIResponse(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X size={18} /></button>
              </div>
              {aiLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /><span className="ml-3 text-sm text-slate-500">Generating response...</span></div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiResponse}</div>
              )}
              <div className="flex justify-end mt-4 gap-3">
                <button onClick={() => { navigator.clipboard.writeText(aiResponse); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2">
                  <Check size={14} /> Copy Response
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Issue Modal */}
      <CreateIssueModal show={showCreateIssue} onClose={() => setShowCreateIssue(false)} onCreated={() => { setShowCreateIssue(false); fetchIssues(); }} />
      <CreateFeedbackModal show={showCreateFeedback} onClose={() => setShowCreateFeedback(false)} onCreated={() => { setShowCreateFeedback(false); fetchFeedback(); }} />
    </div>
  );
};

// ── Dashboard View ──────────────────────────────────────────────────────────
const SOURCE_CONNECTOR_OPTIONS = [
  { id: 'appstore', label: 'App Store', desc: 'Fetch iOS app reviews', category: 'Reviews', trait: 'Recurring Sync', placeholder: 'e.g. spotify, 324684580, or apps.apple.com/.../id324684580' },
  { id: 'playstore', label: 'Play Store', desc: 'Fetch Android app reviews', category: 'Reviews', trait: 'Recurring Sync', placeholder: 'e.g. com.example.app' },
  { id: 'trustpilot', label: 'Trustpilot', desc: 'Business review platform', category: 'Reviews', trait: 'Recurring Sync', placeholder: 'e.g. company-domain' },
  { id: 'csv', label: 'CSV File', desc: 'Upload CSV or Excel data', category: 'Files', trait: 'File Upload', placeholder: 'e.g. q1-feedback.csv' },
  { id: 'surveymonkey', label: 'SurveyMonkey', desc: 'Survey responses via API', category: 'Surveys', trait: 'Authenticated', placeholder: 'e.g. 123456789' },
  { id: 'typeform', label: 'Typeform', desc: 'Form responses via API', category: 'Surveys', trait: 'Authenticated', placeholder: 'e.g. aBc123Xy' },
  { id: 'crm', label: 'Salesforce', desc: 'CRM feedback data', category: 'CRM', trait: 'Recurring Sync', placeholder: 'e.g. https://mycompany.my.salesforce.com' },
  { id: 'api', label: 'REST API', desc: 'Any REST endpoint or webhook', category: 'APIs', trait: 'Recurring Sync', placeholder: 'https://api.example.com/reviews' },
];

const SourceSetupView = ({
  connectors,
  loading,
  selectedConnectorIds,
  onToggleConnector,
  fetchScope,
  onFetchScopeChange,
  fetchDays,
  onFetchDaysChange,
  rangeStart,
  onRangeStartChange,
  rangeEnd,
  onRangeEndChange,
  savingSetup,
  refreshing,
  setupMessage,
  onSaveSetup,
  connectorIntervals,
  onConnectorIntervalChange,
  onSaveConnectorInterval,
  onSaveBulkConnectorIntervals,
  connectorAnalysisIntervals,
  onConnectorAnalysisIntervalChange,
  onSaveConnectorAnalysisInterval,
  onSaveBulkConnectorAnalysisIntervals,
  onRemoveConnector,
  onFetchNow,
  onConnectorCreated,
}) => {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [newConnectorType, setNewConnectorType] = useState('playstore');
  const [newConnectorIdentifier, setNewConnectorIdentifier] = useState('');
  const [newConnectorName, setNewConnectorName] = useState('');
  const [creatingConnector, setCreatingConnector] = useState(false);
  const [addConnectorError, setAddConnectorError] = useState('');
  const [csvUploadFile, setCsvUploadFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvColumnMap, setCsvColumnMap] = useState({ content: '', score: '', date: '', author: '' });
  const [csvFilesByConnector, setCsvFilesByConnector] = useState({});
  const [csvUploadingByConnector, setCsvUploadingByConnector] = useState({});
  const [analysisWindow, setAnalysisWindow] = useState('weekly');
  const [analysisCustomStart, setAnalysisCustomStart] = useState('');
  const [analysisCustomEnd, setAnalysisCustomEnd] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [analysisTrends, setAnalysisTrends] = useState([]);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisUpdatedAt, setAnalysisUpdatedAt] = useState(null);
  const [newConnectorCountry, setNewConnectorCountry] = useState('us');
  const [newConnectorMaxReviews, setNewConnectorMaxReviews] = useState(200);
  const [newConnectorFetchInterval, setNewConnectorFetchInterval] = useState('manual');
  const [newConnectorToken, setNewConnectorToken] = useState('');
  const [newApiMethod, setNewApiMethod] = useState('GET');
  const [newApiAuthType, setNewApiAuthType] = useState('none');
  const [newApiAuthHeaderName, setNewApiAuthHeaderName] = useState('X-Api-Key');
  const [newApiAuthValue, setNewApiAuthValue] = useState('');
  const [newApiDataPath, setNewApiDataPath] = useState('');
  const [newApiContentField, setNewApiContentField] = useState('');
  const [newApiScoreField, setNewApiScoreField] = useState('');
  const [newApiAuthorField, setNewApiAuthorField] = useState('');
  const [newApiDateField, setNewApiDateField] = useState('');
  const [newApiIdField, setNewApiIdField] = useState('');
  const [newCrmClientId, setNewCrmClientId] = useState('');
  const [newCrmClientSecret, setNewCrmClientSecret] = useState('');
  const [newCrmUsername, setNewCrmUsername] = useState('');
  const [newCrmPassword, setNewCrmPassword] = useState('');
  const [newCrmObjectName, setNewCrmObjectName] = useState('Case');
  const [newCrmContentField, setNewCrmContentField] = useState('Description');
  const [newCrmScoreField, setNewCrmScoreField] = useState('');
  const [bulkInterval, setBulkInterval] = useState('manual');
  const [bulkAnalysisInterval, setBulkAnalysisInterval] = useState('manual');
  const [bulkIntervalSaving, setBulkIntervalSaving] = useState(false);
  const [bulkAnalysisIntervalSaving, setBulkAnalysisIntervalSaving] = useState(false);
  const [showIntervalOverrides, setShowIntervalOverrides] = useState(false);

  const selectedOption = SOURCE_CONNECTOR_OPTIONS.find(opt => opt.id === newConnectorType);
  const identifierLabel = (
    newConnectorType === 'appstore' ? 'App Name / Apple ID / URL' :
    newConnectorType === 'playstore' ? 'Package Name' :
    newConnectorType === 'trustpilot' ? 'Domain / Company' :
    newConnectorType === 'surveymonkey' ? 'Survey ID' :
    newConnectorType === 'typeform' ? 'Form ID' :
    newConnectorType === 'crm' ? 'Instance URL' :
    newConnectorType === 'api' ? 'Endpoint URL' :
    'Identifier'
  );
  const isCsvConnectorDraft = newConnectorType === 'csv';
  const fetchModeOptions = [
    { id: 'full', label: 'Full', desc: 'Import all available reviews.' },
    { id: 'days', label: 'Last N Days', desc: 'Import recent reviews only.' },
    { id: 'range', label: 'Date Range', desc: 'Import by custom date window.' },
  ];
  const analysisWindowOptions = [
    { id: 'weekly', label: 'Weekly', desc: 'Last 7 days view' },
    { id: 'monthly', label: 'Monthly', desc: 'Last 30 days view' },
    { id: 'custom', label: 'Custom', desc: 'Pick your own dates' },
  ];
  const activeFetchModeOption = fetchModeOptions.find(opt => opt.id === fetchScope) || fetchModeOptions[0];
  const activeAnalysisWindowOption = analysisWindowOptions.find(opt => opt.id === analysisWindow) || analysisWindowOptions[0];
  const selectedConnectors = useMemo(
    () => selectedConnectorIds
      .map(id => connectors.find(c => c.id === id))
      .filter(Boolean),
    [selectedConnectorIds, connectors]
  );

  useEffect(() => {
    if (!selectedConnectors.length) return;
    const fetchValues = selectedConnectors.map(connector => connectorIntervals[connector.id] || 'manual');
    const fetchFirst = fetchValues[0];
    const unifiedFetch = fetchValues.every(v => v === fetchFirst) ? fetchFirst : 'manual';
    setBulkInterval(unifiedFetch);

    const analysisValues = selectedConnectors.map(connector => connectorAnalysisIntervals[connector.id] || 'manual');
    const analysisFirst = analysisValues[0];
    const unifiedAnalysis = analysisValues.every(v => v === analysisFirst) ? analysisFirst : 'manual';
    setBulkAnalysisInterval(unifiedAnalysis);
  }, [selectedConnectors, connectorIntervals, connectorAnalysisIntervals]);

  const parseApiResponse = async (res) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_err) {
      return { detail: text.slice(0, 240) };
    }
  };

  useEffect(() => {
    if (analysisCustomStart && analysisCustomEnd) return;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const toDateInput = (d) => d.toISOString().split('T')[0];
    setAnalysisCustomStart(toDateInput(start));
    setAnalysisCustomEnd(toDateInput(end));
  }, [analysisCustomStart, analysisCustomEnd]);

  const parseCsvHeaders = (file) => {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      setCsvHeaders(['__EXCEL__']);
      setCsvColumnMap({ content: '__EXCEL__', score: '', date: '', author: '' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        const firstLine = text.split('\n')[0] || '';
        const delimiter = firstLine.includes(';') ? ';' : ',';
        const headers = firstLine
          .split(delimiter)
          .map((h) => h.trim().replace(/^"|"$/g, ''))
          .filter(Boolean);
        if (!headers.length) {
          setCsvHeaders([]);
          setCsvColumnMap({ content: '', score: '', date: '', author: '' });
          return;
        }
        setCsvHeaders(headers);
        const guess = { content: '', score: '', date: '', author: '' };
        headers.forEach((header) => {
          const h = header.toLowerCase();
          if (!guess.content && /review|feedback|comment|text|body|message|content/.test(h)) guess.content = header;
          else if (!guess.score && /score|rating|stars|rating_value|review_rating/.test(h)) guess.score = header;
          else if (!guess.date && /date|timestamp|created|submitted|posted|at$/.test(h)) guess.date = header;
          else if (!guess.author && /author|user|reviewer|name|username/.test(h)) guess.author = header;
        });
        setCsvColumnMap(guess);
      } catch (_e) {
        setCsvHeaders([]);
        setCsvColumnMap({ content: '', score: '', date: '', author: '' });
      }
    };
    reader.readAsText(file.slice(0, 16384));
  };

  const getAuthToken = () => {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || (isLocalDev ? 'dev_token_123' : null);
  };

  const parsePlainOrJsonResponse = async (res) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_e) {
      return { detail: text.slice(0, 240) };
    }
  };

  const toErrorText = (value, fallback = 'Request failed.') => {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value?.message === 'string') return value.message;
    try {
      return JSON.stringify(value);
    } catch (_e) {
      return fallback;
    }
  };

  const uploadCsvToConnector = async (connectorId, file, map = null) => {
    const formData = new FormData();
    formData.append('file', file);

    const mapping = map || {};
    if (mapping.content && mapping.content !== '__EXCEL__') formData.append('content_col', mapping.content);
    if (mapping.score && mapping.score !== '__EXCEL__') formData.append('score_col', mapping.score);
    if (mapping.date && mapping.date !== '__EXCEL__') formData.append('date_col', mapping.date);
    if (mapping.author && mapping.author !== '__EXCEL__') formData.append('author_col', mapping.author);

    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/api/fi/connectors/${connectorId}/csv-upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await parsePlainOrJsonResponse(res);
    return { ok: res.ok, data };
  };

  const handleCsvUploadForExistingConnector = async (connector) => {
    const file = csvFilesByConnector[connector.id];
    if (!file) {
      setAddConnectorError('Select a CSV/XLSX file first.');
      return;
    }

    setCsvUploadingByConnector((prev) => ({ ...prev, [connector.id]: true }));
    setAddConnectorError('');
    try {
      const mapping = connector?.config?.columnMap || {};
      const result = await uploadCsvToConnector(connector.id, file, mapping);
      if (!result.ok) {
        setAddConnectorError(toErrorText(result?.data?.detail || result?.data?.message, 'CSV upload failed.'));
        return;
      }
      setCsvFilesByConnector((prev) => {
        const next = { ...prev };
        delete next[connector.id];
        return next;
      });
      setAddConnectorError('');
    } catch (e) {
      setAddConnectorError(e.message || 'CSV upload failed.');
    } finally {
      setCsvUploadingByConnector((prev) => ({ ...prev, [connector.id]: false }));
    }
  };

  const handlePickConnectorType = (type) => {
    setNewConnectorType(type);
    setShowAddDropdown(false);
    setAddConnectorError('');
    setNewConnectorIdentifier('');
    setNewConnectorName('');
    setNewConnectorCountry('us');
    setNewConnectorMaxReviews(200);
    setNewConnectorFetchInterval('manual');
    setNewConnectorToken('');
    setNewApiMethod('GET');
    setNewApiAuthType('none');
    setNewApiAuthHeaderName('X-Api-Key');
    setNewApiAuthValue('');
    setNewApiDataPath('');
    setNewApiContentField('');
    setNewApiScoreField('');
    setNewApiAuthorField('');
    setNewApiDateField('');
    setNewApiIdField('');
    setNewCrmClientId('');
    setNewCrmClientSecret('');
    setNewCrmUsername('');
    setNewCrmPassword('');
    setNewCrmObjectName('Case');
    setNewCrmContentField('Description');
    setNewCrmScoreField('');
    if (type !== 'csv') {
      setCsvUploadFile(null);
      setCsvHeaders([]);
      setCsvColumnMap({ content: '', score: '', date: '', author: '' });
    }
  };

  const handleCreateConnector = async () => {
    const isCsvConnector = newConnectorType === 'csv';
    const connectorType = (newConnectorType || '').trim().toLowerCase();
    const identifier = isCsvConnector
      ? String(csvUploadFile?.name || '').trim()
      : newConnectorIdentifier.trim();
    const maxReviews = Math.max(1, Math.min(5000, Number(newConnectorMaxReviews) || 200));

    if (!identifier) {
      setAddConnectorError(isCsvConnector ? 'Select a CSV/XLSX file.' : 'Identifier is required.');
      return;
    }

    if ((connectorType === 'surveymonkey' || connectorType === 'typeform') && !newConnectorToken.trim()) {
      setAddConnectorError('Access token is required for this connector.');
      return;
    }

    if (connectorType === 'api' && !/^https?:\/\//i.test(identifier)) {
      setAddConnectorError('REST API endpoint must start with http:// or https://');
      return;
    }

    if (connectorType === 'crm') {
      if (!/^https?:\/\//i.test(identifier)) {
        setAddConnectorError('Salesforce instance URL must start with http:// or https://');
        return;
      }
      if (!newCrmClientId.trim() || !newCrmClientSecret.trim() || !newCrmUsername.trim() || !newCrmPassword.trim()) {
        setAddConnectorError('Salesforce credentials are required (client id, client secret, username, password).');
        return;
      }
    }

    setCreatingConnector(true);
    setAddConnectorError('');
    try {
      const connectorConfig = {
        count: maxReviews,
      };
      if (isCsvConnector) {
        connectorConfig.columnMap = { ...csvColumnMap };
        connectorConfig.originalFileName = csvUploadFile?.name || identifier;
      } else if (connectorType === 'appstore' || connectorType === 'playstore') {
        connectorConfig.country = String(newConnectorCountry || 'us').trim().toLowerCase() || 'us';
      } else if (connectorType === 'surveymonkey' || connectorType === 'typeform') {
        connectorConfig.token = newConnectorToken.trim();
      } else if (connectorType === 'crm') {
        connectorConfig.instance_url = identifier;
        connectorConfig.client_id = newCrmClientId.trim();
        connectorConfig.client_secret = newCrmClientSecret.trim();
        connectorConfig.username = newCrmUsername.trim();
        connectorConfig.password = newCrmPassword.trim();
        connectorConfig.object_name = newCrmObjectName.trim() || 'Case';
        connectorConfig.content_field = newCrmContentField.trim() || 'Description';
        connectorConfig.score_field = newCrmScoreField.trim();
      } else if (connectorType === 'api') {
        connectorConfig.api_url = identifier;
        connectorConfig.method = newApiMethod;
        connectorConfig.auth_type = newApiAuthType;
        connectorConfig.auth_value = newApiAuthValue.trim();
        connectorConfig.auth_header_name = newApiAuthHeaderName.trim() || 'X-Api-Key';
        connectorConfig.data_path = newApiDataPath.trim();
        connectorConfig.content_field = newApiContentField.trim();
        connectorConfig.score_field = newApiScoreField.trim();
        connectorConfig.author_field = newApiAuthorField.trim();
        connectorConfig.date_field = newApiDateField.trim();
        connectorConfig.id_field = newApiIdField.trim();
      }

      const selectedFetchInterval = connectorType === 'csv'
        ? 'manual'
        : (newConnectorFetchInterval || 'manual');
      const selectedAnalysisInterval = 'manual';
      const defaultConnectorName = newConnectorName.trim() || `${selectedOption?.label || newConnectorType} (${identifier})`;

      const res = await apiFetch(`${API_BASE}/api/fi/connectors`, {
        method: 'POST',
        body: JSON.stringify({
          connector_type: connectorType,
          identifier,
          name: defaultConnectorName,
          config: connectorConfig,
          fetch_interval: selectedFetchInterval,
          analysis_interval: selectedAnalysisInterval,
          max_reviews: maxReviews,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddConnectorError(data?.detail || 'Failed to add connector.');
        return;
      }

      if (isCsvConnector && data?.source_id && csvUploadFile) {
        const uploadResult = await uploadCsvToConnector(data.source_id, csvUploadFile, csvColumnMap);
        if (!uploadResult.ok) {
          const uploadError = uploadResult?.data?.detail || uploadResult?.data?.message;
          setAddConnectorError(toErrorText(uploadError, 'CSV file upload failed after connector creation.'));
          if (onConnectorCreated) onConnectorCreated(data?.source_id);
          return;
        }
      }

      setNewConnectorIdentifier('');
      setNewConnectorName('');
      setNewConnectorCountry('us');
      setNewConnectorMaxReviews(200);
      setNewConnectorFetchInterval('manual');
      setNewConnectorToken('');
      setNewApiMethod('GET');
      setNewApiAuthType('none');
      setNewApiAuthHeaderName('X-Api-Key');
      setNewApiAuthValue('');
      setNewApiDataPath('');
      setNewApiContentField('');
      setNewApiScoreField('');
      setNewApiAuthorField('');
      setNewApiDateField('');
      setNewApiIdField('');
      setNewCrmClientId('');
      setNewCrmClientSecret('');
      setNewCrmUsername('');
      setNewCrmPassword('');
      setNewCrmObjectName('Case');
      setNewCrmContentField('Description');
      setNewCrmScoreField('');
      setCsvUploadFile(null);
      setCsvHeaders([]);
      setCsvColumnMap({ content: '', score: '', date: '', author: '' });
      if (onConnectorCreated) await onConnectorCreated(data?.source_id, selectedFetchInterval, selectedAnalysisInterval);
    } catch (e) {
      setAddConnectorError(e.message || 'Failed to add connector.');
    } finally {
      setCreatingConnector(false);
    }
  };

  const resolveAnalysisRange = () => {
    const now = new Date();
    const toDateInput = (d) => d.toISOString().split('T')[0];

    if (analysisWindow === 'weekly') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return {
        startDate: toDateInput(start),
        endDate: toDateInput(now),
        trendPeriod: 'day',
        trendDays: 7,
      };
    }

    if (analysisWindow === 'monthly') {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      return {
        startDate: toDateInput(start),
        endDate: toDateInput(now),
        trendPeriod: 'week',
        trendDays: 30,
      };
    }

    const customStart = analysisCustomStart || toDateInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const customEnd = analysisCustomEnd || toDateInput(now);
    const startMs = new Date(customStart).getTime();
    const endMs = new Date(customEnd).getTime();
    const diffDays = Math.max(1, Math.ceil((Math.max(endMs, startMs) - Math.min(endMs, startMs)) / (1000 * 60 * 60 * 24)) + 1);
    return {
      startDate: customStart <= customEnd ? customStart : customEnd,
      endDate: customStart <= customEnd ? customEnd : customStart,
      trendPeriod: 'day',
      trendDays: diffDays,
    };
  };

  const sentimentJourney = useMemo(() => {
    const grouped = new Map();
    for (const row of analysisHistory) {
      const author = row.author || 'Anonymous';
      if (!grouped.has(author)) grouped.set(author, []);
      grouped.get(author).push(row);
    }

    const score = (s) => ({ positive: 1, neutral: 0, negative: -1 }[s] ?? 0);
    const journeys = [];
    for (const [author, rows] of grouped.entries()) {
      const sorted = [...rows].sort((a, b) => new Date(a.reviewed_at || a.created_at || 0) - new Date(b.reviewed_at || b.created_at || 0));
      const sentiments = sorted.map(r => (r.sentiment || 'neutral').toLowerCase());
      const first = sentiments[0] || 'neutral';
      const last = sentiments[sentiments.length - 1] || 'neutral';
      const delta = score(last) - score(first);

      journeys.push({
        author,
        reviews: sorted.length,
        first,
        last,
        trend: delta > 0 ? 'improving' : delta < 0 ? 'declining' : 'stable',
        path: sentiments.slice(-6),
      });
    }

    return journeys.sort((a, b) => b.reviews - a.reviews).slice(0, 12);
  }, [analysisHistory]);

  const handleRunStandaloneAnalysis = async () => {
    if (!selectedConnectorIds.length) {
      setAnalysisError('Select at least one connector to run analysis.');
      return;
    }

    const range = resolveAnalysisRange();
    const sourceIds = selectedConnectorIds.join(',');
    const startIso = `${range.startDate}T00:00:00`;
    const endIso = `${range.endDate}T23:59:59`;
    const historyLimitPerSource = selectedConnectorIds.length > 1 ? 35 : 120;

    const summaryParams = new URLSearchParams({
      source_ids: sourceIds,
      start_date: startIso,
      end_date: endIso,
    });
    const trendParams = new URLSearchParams({
      period: range.trendPeriod,
      days: String(range.trendDays),
      source_ids: sourceIds,
      start_date: startIso,
      end_date: endIso,
    });

    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const [summaryRes, trendRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/fi/analysis/summary?${summaryParams.toString()}`, {}, { retries: 0, timeoutMs: 60000 }),
        apiFetch(`${API_BASE}/api/fi/analysis/trends?${trendParams.toString()}`, {}, { retries: 0, timeoutMs: 60000 }),
      ]);
      const summaryData = await parseApiResponse(summaryRes);
      const trendData = await parseApiResponse(trendRes);

      if (!summaryRes.ok || !trendRes.ok) {
        setAnalysisError(summaryData?.detail || trendData?.detail || 'Could not load analysis insights for this range.');
        setAnalysisLoading(false);
        return;
      }

      const historyBatches = await Promise.all(
        selectedConnectorIds.map(async (sourceId) => {
          const historyParams = new URLSearchParams({
            source_id: String(sourceId),
            start_date: startIso,
            end_date: endIso,
            limit: String(historyLimitPerSource),
            offset: '0',
          });
          const res = await apiFetch(`${API_BASE}/api/fi/analysis/reviews?${historyParams.toString()}`, {}, { retries: 0, timeoutMs: 60000 });
          if (!res.ok) return [];
          const data = await parseApiResponse(res);
          return Array.isArray(data.reviews) ? data.reviews : [];
        })
      );

      const mergedHistory = historyBatches
        .flat()
        .sort((a, b) => new Date(b.reviewed_at || b.created_at || 0) - new Date(a.reviewed_at || a.created_at || 0));

      setAnalysisSummary(summaryData || {});
      setAnalysisTrends(Array.isArray(trendData?.trends) ? trendData.trends : []);
      setAnalysisHistory(mergedHistory);
      setAnalysisUpdatedAt(new Date().toISOString());
    } catch (e) {
      setAnalysisError(e.message || 'Failed to run analysis.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleFetchNowFromSetup = async () => {
    const selectedCsvConnectors = connectors.filter(
      (connector) => selectedConnectorIds.includes(connector.id) && String(connector.connector_type || '').toLowerCase() === 'csv'
    );
    for (const connector of selectedCsvConnectors) {
      const file = csvFilesByConnector[connector.id];
      if (!file) continue;
      const mapping = connector?.config?.columnMap || {};
      setCsvUploadingByConnector((prev) => ({ ...prev, [connector.id]: true }));
      try {
        const result = await uploadCsvToConnector(connector.id, file, mapping);
        if (!result.ok) {
          setAddConnectorError(toErrorText(result?.data?.detail || result?.data?.message, 'CSV upload failed.'));
          setCsvUploadingByConnector((prev) => ({ ...prev, [connector.id]: false }));
          return;
        }
        setCsvFilesByConnector((prev) => {
          const next = { ...prev };
          delete next[connector.id];
          return next;
        });
      } catch (e) {
        setAddConnectorError(e.message || 'CSV upload failed.');
        setCsvUploadingByConnector((prev) => ({ ...prev, [connector.id]: false }));
        return;
      }
      setCsvUploadingByConnector((prev) => ({ ...prev, [connector.id]: false }));
    }
    setAddConnectorError('');
    await onFetchNow();
  };

  const handleApplyBulkInterval = async () => {
    if (!selectedConnectors.length) return;
    if (!onSaveBulkConnectorIntervals) {
      for (const connector of selectedConnectors) {
        onConnectorIntervalChange(connector.id, bulkInterval);
        await onSaveConnectorInterval(connector.id);
      }
      return;
    }
    setBulkIntervalSaving(true);
    const result = await onSaveBulkConnectorIntervals(selectedConnectors.map(c => c.id), bulkInterval);
    if (result?.failed?.length) {
      setShowIntervalOverrides(true);
    }
    setBulkIntervalSaving(false);
  };

  const handleApplyBulkAnalysisInterval = async () => {
    if (!selectedConnectors.length) return;
    if (!onSaveBulkConnectorAnalysisIntervals) {
      for (const connector of selectedConnectors) {
        onConnectorAnalysisIntervalChange(connector.id, bulkAnalysisInterval);
        await onSaveConnectorAnalysisInterval(connector.id);
      }
      return;
    }
    setBulkAnalysisIntervalSaving(true);
    const result = await onSaveBulkConnectorAnalysisIntervals(selectedConnectors.map(c => c.id), bulkAnalysisInterval);
    if (result?.failed?.length) {
      setShowIntervalOverrides(true);
    }
    setBulkAnalysisIntervalSaving(false);
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto space-y-5 px-5 py-6 xl:px-8 2xl:px-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Feedback CRM Source Setup</h1>
          <p className="text-sm text-slate-500">Select connectors and use their saved connector settings to fetch CRM feedback.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowAddDropdown(v => !v)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2">
              <Plus size={15} /> Add Connector <ChevronDown size={14} />
            </button>
            {showAddDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                {SOURCE_CONNECTOR_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => handlePickConnectorType(opt.id)} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 xl:p-7 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Connector Directory</p>
            <h3 className="text-sm font-semibold text-slate-900 mt-1">All workspace and CRM sources stay visible here. Select one to open setup.</h3>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {SOURCE_CONNECTOR_OPTIONS.length} visible
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {SOURCE_CONNECTOR_OPTIONS.map(opt => {
            const active = opt.id === newConnectorType;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handlePickConnectorType(opt.id)}
                className={`rounded-2xl border p-5 text-left transition-all min-h-[112px] ${active ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-6 w-6 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500">
                      <ConnectorTypeGlyph connectorType={opt.id} size={12} />
                    </span>
                    <p className="text-sm font-bold text-slate-900 truncate">{opt.label}</p>
                  </div>
                  <ChevronRight size={14} className={active ? 'text-indigo-500' : 'text-slate-300'} />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{opt.desc}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{opt.category}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{opt.trait}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 xl:p-7 space-y-5">
        <h3 className="text-sm font-semibold text-slate-900">Add Connector To Feedback CRM</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Connector</label>
            <select value={newConnectorType} onChange={e => handlePickConnectorType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
              {SOURCE_CONNECTOR_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          {isCsvConnectorDraft ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Local File</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={e => {
                  const file = e.target.files?.[0] || null;
                  setCsvUploadFile(file);
                  parseCsvHeaders(file);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">{csvUploadFile?.name || 'Choose CSV/XLSX file from local system'}</p>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{identifierLabel}</label>
              <input value={newConnectorIdentifier} onChange={e => setNewConnectorIdentifier(e.target.value)} placeholder={selectedOption?.placeholder || 'identifier'} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
            <input value={newConnectorName} onChange={e => setNewConnectorName(e.target.value)} placeholder="Friendly name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Max Reviews</label>
            <input type="number" min="1" max="5000" value={newConnectorMaxReviews} onChange={e => setNewConnectorMaxReviews(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fetch Interval</label>
            <select
              value={isCsvConnectorDraft ? 'manual' : newConnectorFetchInterval}
              onChange={e => setNewConnectorFetchInterval(e.target.value)}
              disabled={isCsvConnectorDraft}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isCsvConnectorDraft ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:border-indigo-400'}`}
            >
              <option value="manual">Manual</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        {(newConnectorType === 'appstore' || newConnectorType === 'playstore') && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Country</label>
              <input value={newConnectorCountry} onChange={e => setNewConnectorCountry(e.target.value)} placeholder="us" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>
        )}
        {(newConnectorType === 'surveymonkey' || newConnectorType === 'typeform') && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Access Token</label>
              <input type="password" value={newConnectorToken} onChange={e => setNewConnectorToken(e.target.value)} placeholder="Paste API token" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>
        )}
        {newConnectorType === 'crm' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client ID</label>
                <input value={newCrmClientId} onChange={e => setNewCrmClientId(e.target.value)} placeholder="Salesforce client id" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client Secret</label>
                <input type="password" value={newCrmClientSecret} onChange={e => setNewCrmClientSecret(e.target.value)} placeholder="Client secret" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
                <input value={newCrmUsername} onChange={e => setNewCrmUsername(e.target.value)} placeholder="Salesforce username" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password + Token</label>
                <input type="password" value={newCrmPassword} onChange={e => setNewCrmPassword(e.target.value)} placeholder="Password and security token" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Object Name</label>
                <input value={newCrmObjectName} onChange={e => setNewCrmObjectName(e.target.value)} placeholder="Case" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Content Field</label>
                <input value={newCrmContentField} onChange={e => setNewCrmContentField(e.target.value)} placeholder="Description" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Score Field (optional)</label>
                <input value={newCrmScoreField} onChange={e => setNewCrmScoreField(e.target.value)} placeholder="NPS__c" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
            </div>
          </div>
        )}
        {newConnectorType === 'api' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Method</label>
                <select value={newApiMethod} onChange={e => setNewApiMethod(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Auth Type</label>
                <select value={newApiAuthType} onChange={e => setNewApiAuthType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                  <option value="none">None</option>
                  <option value="bearer">Bearer</option>
                  <option value="apikey">API Key</option>
                  <option value="basic">Basic</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Auth Value</label>
                <input type="password" value={newApiAuthValue} onChange={e => setNewApiAuthValue(e.target.value)} placeholder="Token / key / user:pass" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
            </div>
            {newApiAuthType === 'apikey' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">API Key Header</label>
                  <input value={newApiAuthHeaderName} onChange={e => setNewApiAuthHeaderName(e.target.value)} placeholder="X-Api-Key" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data Path (optional)</label>
                  <input value={newApiDataPath} onChange={e => setNewApiDataPath(e.target.value)} placeholder="data.reviews" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
                </div>
              </div>
            )}
            {newApiAuthType !== 'apikey' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data Path (optional)</label>
                  <input value={newApiDataPath} onChange={e => setNewApiDataPath(e.target.value)} placeholder="data.reviews" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Content Field</label>
                <input value={newApiContentField} onChange={e => setNewApiContentField(e.target.value)} placeholder="content" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Score Field</label>
                <input value={newApiScoreField} onChange={e => setNewApiScoreField(e.target.value)} placeholder="rating" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Author Field</label>
                <input value={newApiAuthorField} onChange={e => setNewApiAuthorField(e.target.value)} placeholder="author" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Field</label>
                <input value={newApiDateField} onChange={e => setNewApiDateField(e.target.value)} placeholder="created_at" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">ID Field</label>
                <input value={newApiIdField} onChange={e => setNewApiIdField(e.target.value)} placeholder="id" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
            </div>
          </div>
        )}
        {newConnectorType === 'csv' && csvHeaders.length > 0 && csvHeaders[0] !== '__EXCEL__' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Content Column</label>
              <select value={csvColumnMap.content} onChange={e => setCsvColumnMap(prev => ({ ...prev, content: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                <option value="">Auto-detect</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Score Column</label>
              <select value={csvColumnMap.score} onChange={e => setCsvColumnMap(prev => ({ ...prev, score: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                <option value="">Auto-detect</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Column</label>
              <select value={csvColumnMap.date} onChange={e => setCsvColumnMap(prev => ({ ...prev, date: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                <option value="">Auto-detect</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Author Column</label>
              <select value={csvColumnMap.author} onChange={e => setCsvColumnMap(prev => ({ ...prev, author: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                <option value="">Auto-detect</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs ${addConnectorError ? 'text-rose-500' : 'text-slate-500'}`}>
            {addConnectorError || (newConnectorType === 'csv'
              ? 'CSV uses local upload flow (same pattern as Workspace). Pick file, create connector, then fetch into CRM.'
              : 'Choose the fetch interval here, then fetch reviews to move straight into the CRM inbox.')}
          </p>
          <button onClick={handleCreateConnector} disabled={creatingConnector} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2">
            {creatingConnector ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Connector
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 xl:p-7">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Connector Selection</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
        ) : connectors.length === 0 ? (
          <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No connectors available. Add connectors, then return here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {connectors.map(connector => {
              const selected = selectedConnectorIds.includes(connector.id);
              const isCsvConnector = String(connector.connector_type || '').toLowerCase() === 'csv';
              const connectorScope = connectorScopeOf(connector);
              const selectedCsvFile = csvFilesByConnector[connector.id] || null;
              const csvUploadBusy = !!csvUploadingByConnector[connector.id];
              return (
                <div
                  key={connector.id}
                  className={`rounded-xl border p-4 transition-all ${selected ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <button type="button" onClick={() => onToggleConnector(connector.id)} className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                          <ConnectorTypeGlyph connectorType={connector.connector_type} size={12} />
                        </span>
                        <p className="text-sm font-semibold text-slate-900 truncate">{connector.name || connector.connector_type}</p>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{connector.identifier}</p>
                      <p className="text-[11px] text-slate-400 mt-1 capitalize">Type: {connector.connector_type}</p>
                      <p className="text-[11px] text-slate-400 mt-1 capitalize">
                        Scope: {connectorScope === 'feedback_crm' ? 'Feedback CRM' : 'Workspace'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 capitalize">Interval: {connector.fetch_interval || 'manual'}</p>
                      <p className="text-[11px] text-slate-400 mt-1 capitalize">Analysis: {connector.analysis_interval || 'manual'}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded border flex items-center justify-center ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent'}`}>
                        <Check size={12} />
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveConnector(connector.id)}
                        className="text-[11px] px-2 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {isCsvConnector && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Local CSV/XLSX File</label>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={e => {
                          const file = e.target.files?.[0] || null;
                          setCsvFilesByConnector(prev => ({ ...prev, [connector.id]: file }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500 truncate">
                          {selectedCsvFile?.name || 'Choose a local file before fetching this CSV connector.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCsvUploadForExistingConnector(connector)}
                          disabled={!selectedCsvFile || csvUploadBusy}
                          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {csvUploadBusy ? 'Uploading...' : 'Upload File'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 xl:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Auto Intervals (after initial fetch)</h3>
            <p className="text-xs text-slate-500 mt-1">Configure fetch cadence and churn-analysis cadence separately.</p>
          </div>
          {!!selectedConnectors.length && (
            <span className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600">
              {selectedConnectors.length} selected
            </span>
          )}
        </div>
        {!selectedConnectors.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            Select one or more connectors to set interval.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="grid grid-cols-1 md:grid-cols-[220px_auto] gap-2 items-center">
                <div className="md:hidden text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fetch interval</div>
                <select
                  value={bulkInterval}
                  onChange={e => setBulkInterval(e.target.value)}
                  className="bg-white border border-slate-200 rounded-md px-2.5 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="manual">Manual</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyBulkInterval}
                    disabled={bulkIntervalSaving}
                    className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {bulkIntervalSaving && <Loader2 size={13} className="animate-spin" />}
                    Apply Fetch Interval
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIntervalOverrides(v => !v)}
                    className="px-3 py-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {showIntervalOverrides ? 'Hide Advanced' : 'Advanced Per Connector'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="grid grid-cols-1 md:grid-cols-[220px_auto] gap-2 items-center">
                <div className="md:hidden text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Analysis interval</div>
                <select
                  value={bulkAnalysisInterval}
                  onChange={e => setBulkAnalysisInterval(e.target.value)}
                  className="bg-white border border-slate-200 rounded-md px-2.5 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="manual">Manual</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyBulkAnalysisInterval}
                    disabled={bulkAnalysisIntervalSaving}
                    className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {bulkAnalysisIntervalSaving && <Loader2 size={13} className="animate-spin" />}
                    Apply Analysis Interval
                  </button>
                </div>
              </div>
            </div>

            {showIntervalOverrides && (
              <div className="space-y-2.5">
                {selectedConnectors.map(connector => (
                <div key={connector.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">{connector.name || connector.connector_type}</p>
                    <p className="text-[11px] text-slate-500">{connector.identifier}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Fetch</span>
                    <select
                      value={connectorIntervals[connector.id] || 'manual'}
                      onChange={e => onConnectorIntervalChange(connector.id, e.target.value)}
                      className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                    >
                      <option value="manual">Manual</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onSaveConnectorInterval(connector.id)}
                      className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Save Fetch
                    </button>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider ml-1">Analysis</span>
                    <select
                      value={connectorAnalysisIntervals[connector.id] || 'manual'}
                      onChange={e => onConnectorAnalysisIntervalChange(connector.id, e.target.value)}
                      className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                    >
                      <option value="manual">Manual</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onSaveConnectorAnalysisInterval(connector.id)}
                      className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Save Analysis
                    </button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        )}
      </div>


      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-xs text-slate-500">{setupMessage || `${selectedConnectorIds.length} connector(s) selected.`}</p>
        <div className="flex items-center gap-3">
          <button onClick={onSaveSetup} disabled={savingSetup} className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {savingSetup && <Loader2 size={14} className="animate-spin" />} Save Selection
          </button>
          <button onClick={handleFetchNowFromSetup} disabled={refreshing || Object.values(csvUploadingByConnector).some(Boolean) || connectors.length === 0 || selectedConnectorIds.length === 0} className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Fetch Reviews Into CRM
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ dashboard, onViewIssue, onNav }) => {
  if (!dashboard) return <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>;
  const d = dashboard;
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-2"><h1 className="text-xl font-bold text-slate-900">Product Health Dashboard</h1><p className="text-sm text-slate-500">Overview of feedback intelligence metrics</p></div>
      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Feedback', value: d.total_feedback, icon: MessageSquare, color: 'indigo', onClick: () => onNav('feedback') },
          { label: 'Negative %', value: `${d.negative_sentiment}%`, icon: AlertTriangle, color: 'rose' },
          { label: 'Active Issues', value: d.issue_count, icon: AlertCircle, color: 'amber', onClick: () => onNav('issues') },
          { label: 'Customers', value: d.customer_count, icon: Users, color: 'emerald', onClick: () => onNav('customers') },
        ].map((m, i) => (
          <div key={i} onClick={m.onClick} className={`bg-white rounded-2xl border border-slate-200/60 p-5 ${m.onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300/80' : ''} transition-all`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-${m.color}-50 flex items-center justify-center`}><m.icon size={18} className={`text-${m.color}-500`} /></div>
              {m.onClick && <ChevronRight size={14} className="text-slate-300" />}
            </div>
            <p className="text-2xl font-bold text-slate-900">{m.value}</p>
            <p className="text-xs text-slate-500 mt-1">{m.label}</p>
          </div>
        ))}
      </div>
      {/* Top Issues & Rising */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Top Issues by Impact</h3>
          {d.top_issues?.length > 0 ? (
            <div className="space-y-2">
              {d.top_issues.slice(0, 6).map((iss, i) => (
                <div key={i} onClick={() => onViewIssue(iss.id)} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                    <span className="text-sm font-medium text-slate-800">{iss.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {trendIcon(iss.trend)}
                    <span className="text-sm font-bold text-indigo-600">{Math.round(iss.impact_score)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 py-4 text-center">No issues tracked yet</p>}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2"><ArrowUpRight size={14} className="text-rose-500" /> Rising Issues</h3>
          {d.rising_issues?.length > 0 ? (
            <div className="space-y-2">{d.rising_issues.map((iss, i) => (
              <div key={i} onClick={() => onViewIssue(iss.id)} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100 cursor-pointer hover:bg-rose-100 transition-all">
                <span className="text-sm font-medium text-rose-800">{iss.name}</span>
                <span className="text-xs font-bold text-rose-600">{iss.mention_count} mentions</span>
              </div>
            ))}</div>
          ) : <p className="text-sm text-slate-400 py-4 text-center">No rising issues</p>}
        </div>
      </div>
      {/* Recent Feedback */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Recent Feedback</h3>
        {d.recent_feedback?.length > 0 ? (
          <div className="space-y-2">{d.recent_feedback.map((f, i) => {
            const sentimentUi = sentimentDisplayForFeedback(f);
            return (
              <div key={i} className="flex items-start justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 gap-4">
                <p className="text-sm text-slate-700 flex-1 line-clamp-1">{f.text}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {f.issue_name && <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">{f.issue_name}</span>}
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${sentimentUi.className}`}>{sentimentUi.label}</span>
                </div>
              </div>
            );
          })}</div>
        ) : <p className="text-sm text-slate-400 py-4 text-center">No feedback yet. Import data or add feedback manually.</p>}
      </div>
    </div>
  );
};

// Feedback Inbox View
const FeedbackInboxView = ({
  data,
  loading,
  search,
  onSearch,
  filterStatus,
  onFilterStatus,
  filterSentiment,
  onFilterSentiment,
  filterPriority,
  onFilterPriority,
  filterRating,
  onFilterRating,
  filterSource,
  onFilterSource,
  filterStartDate,
  onFilterStartDate,
  filterEndDate,
  onFilterEndDate,
  analysisLimit,
  onAnalysisLimit,
  analysisStartIndex,
  onAnalysisStartIndex,
  analysisEndIndex,
  onAnalysisEndIndex,
  analysisSelectedStars,
  onAnalysisSelectedStars,
  feedbackLimit,
  feedbackOffset,
  onChangePageSize,
  onUpdateStatus,
  onUpdatePriority,
  onGenerateResponse,
  onGenerateOutreach,
  onRefresh,
  onClearFilters,
  onShowCreate,
  onRunAnalysis,
  llmConnected,
  analysisTriggering,
  analysisTriggerMessage,
  analysisProgress,
  analysisStatus,
  outreachGeneratingId,
}) => {
  const sourceOptions = Array.isArray(data?.source_options) ? data.source_options : [];
  const sourceFilterOptions = sourceOptions
    .map((opt) => {
      const sourceValue = String(opt?.source || '').trim();
      if (!sourceValue) return null;
      const sourceType = String(opt?.source_type || '').trim();
      const count = Number(opt?.count || 0);
      const label = sourceType
        ? `${sourceValue} (${sourceType})${count > 0 ? ` - ${count}` : ''}`
        : `${sourceValue}${count > 0 ? ` - ${count}` : ''}`;
      return {
        key: `${sourceValue}:${sourceType || 'unknown'}`,
        value: sourceValue,
        label,
      };
    })
    .filter(Boolean);
  const activeFilterCount = [search?.trim(), filterStatus, filterSentiment, filterPriority, filterRating, filterSource, filterStartDate, filterEndDate].filter(Boolean).length;
  const totalCount = Math.max(0, Number(data?.total || 0));
  const pageLimit = Math.max(1, Number(data?.limit || feedbackLimit || 100));
  const pageOffset = Math.max(0, Number(data?.offset || feedbackOffset || 0));
  const rowsOnPage = Array.isArray(data?.items) ? data.items.length : 0;
  const pageStart = totalCount === 0 ? 0 : pageOffset + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(totalCount, pageOffset + rowsOnPage);
  const canPrevPage = pageOffset > 0;
  const canNextPage = pageOffset + rowsOnPage < totalCount;
  const topHorizontalScrollRef = useRef(null);
  const topHorizontalTrackRef = useRef(null);
  const tableHorizontalScrollRef = useRef(null);
  const horizontalSyncLockRef = useRef(false);

  const syncHorizontalScroll = (sourceRef, targetRef) => {
    const sourceEl = sourceRef?.current;
    const targetEl = targetRef?.current;
    if (!sourceEl || !targetEl) return;
    if (horizontalSyncLockRef.current) return;
    horizontalSyncLockRef.current = true;
    targetEl.scrollLeft = sourceEl.scrollLeft;
    requestAnimationFrame(() => {
      horizontalSyncLockRef.current = false;
    });
  };

  useEffect(() => {
    const syncTrackWidth = () => {
      const tableViewport = tableHorizontalScrollRef.current;
      const topTrack = topHorizontalTrackRef.current;
      if (!tableViewport || !topTrack) return;
      const trackWidth = Math.max(tableViewport.scrollWidth, tableViewport.clientWidth);
      topTrack.style.width = `${trackWidth}px`;
    };

    syncTrackWidth();
    window.addEventListener('resize', syncTrackWidth);
    return () => {
      window.removeEventListener('resize', syncTrackWidth);
    };
  }, [data?.items, totalCount, pageLimit, pageOffset, loading]);

  return (
    <div className="p-6 xl:p-8 max-w-[1440px] mx-auto space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Feedback Inbox</h1>
          <p className="text-sm text-slate-500">Fetched reviews land here immediately so teams can review, filter, and act.</p>
          {!llmConnected && (
            <div className="mt-3 inline-flex max-w-xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>LLM usage is paused. You can still fetch and manage feedback, but CRM analysis and AI replies are paused.</span>
            </div>
          )}
          {analysisTriggerMessage && (
            <p className="mt-2 text-sm text-slate-600">{analysisTriggerMessage}</p>
          )}
          {analysisTriggering && (
            <div className="mt-3 max-w-xl">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{analysisStatus || 'Running Feedback CRM analysis...'}</span>
                <span>{Math.max(0, Math.min(100, Number(analysisProgress) || 0))}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, Number(analysisProgress) || 0))}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRunAnalysis({
              source: filterSource || null,
              startDate: filterStartDate || null,
              endDate: filterEndDate || null,
              rating: filterRating ? Number(filterRating) : null,
              ratingValues: Array.isArray(analysisSelectedStars) ? analysisSelectedStars : [],
              status: filterStatus || null,
              limit: analysisLimit ? Number(analysisLimit) : null,
              startIndex: analysisStartIndex ? Number(analysisStartIndex) : null,
              endIndex: analysisEndIndex ? Number(analysisEndIndex) : null,
            })}
            disabled={analysisTriggering || !llmConnected}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    title={llmConnected ? 'Queue analysis for pending reviews' : 'Enable LLM usage to run CRM analysis'}
          >
            {analysisTriggering ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                    {analysisTriggering ? 'Starting Analysis...' : llmConnected ? 'Run Analysis' : 'LLM Paused'}
          </button>
          <button
            onClick={() => onRefresh({ offset: 0 })}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button onClick={onShowCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2"><Plus size={15} /> Add Feedback</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start min-w-0">
        <aside className="bg-white rounded-2xl border border-slate-200/60 p-5 space-y-4 xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Filters</p>
              <h2 className="text-sm font-semibold text-slate-900 mt-1">Review stream controls</h2>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {data.total} reviews
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Active filters</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{activeFilterCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">Search, source, status, sentiment, priority, star rating, and date range update this table.</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Reviews</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => onSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onRefresh({ offset: 0 })}
                placeholder="Search message text"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-300 transition-all"
              />
            </div>
          </div>

          {[
            { value: filterStatus, onChange: onFilterStatus, options: ['', 'open', 'resolved'], label: 'Status' },
            { value: filterSentiment, onChange: onFilterSentiment, options: ['', 'positive', 'neutral', 'negative'], label: 'Sentiment' },
            { value: filterPriority, onChange: onFilterPriority, options: ['', 'low', 'medium', 'high', 'critical'], label: 'Priority' },
            { value: filterRating, onChange: onFilterRating, options: ['', '5', '4', '3', '2', '1'], label: 'Star Rating' },
          ].map((filterItem) => (
            <div key={filterItem.label}>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{filterItem.label}</label>
              <select
                value={filterItem.value}
                onChange={e => filterItem.onChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300 cursor-pointer"
              >
                <option value="">All {filterItem.label}</option>
                {filterItem.options.filter(Boolean).map(option => (
                  <option key={option} value={option} className="capitalize">{filterItem.label === 'Star Rating' ? `${option} Star` : option}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">From Date</label>
              <input
                type="date"
                value={filterStartDate || ''}
                onChange={e => onFilterStartDate?.(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Date</label>
              <input
                type="date"
                value={filterEndDate || ''}
                onChange={e => onFilterEndDate?.(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reviews For Analysis</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={analysisLimit || ''}
              onChange={e => {
                const raw = e.target.value;
                if (!raw) {
                  onAnalysisLimit?.('');
                  return;
                }
                const parsed = Number(raw);
                onAnalysisLimit?.(Number.isFinite(parsed) ? Math.max(1, Math.min(5000, Math.floor(parsed))) : '');
              }}
              placeholder="e.g. 20"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
            />
            <p className="mt-1 text-[10px] text-slate-400">Exact number of reviews to analyze. Leave blank only if you use a review range.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Review Range Start</label>
              <input
                type="number"
                min={1}
                value={analysisStartIndex || ''}
                onChange={e => onAnalysisStartIndex?.(e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : '')}
                placeholder="e.g. 20"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Review Range End</label>
              <input
                type="number"
                min={1}
                value={analysisEndIndex || ''}
                onChange={e => onAnalysisEndIndex?.(e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : '')}
                placeholder="e.g. 45"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stars For Analysis</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const selected = Array.isArray(analysisSelectedStars) && analysisSelectedStars.includes(star);
                return (
                  <label
                    key={`analysis-star-${star}`}
                    className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                      selected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-slate-300"
                      checked={selected}
                      onChange={() => {
                        const current = Array.isArray(analysisSelectedStars) ? analysisSelectedStars : [];
                        const next = selected
                          ? current.filter((value) => value !== star)
                          : [...current, star].sort((a, b) => a - b);
                        onAnalysisSelectedStars?.(next);
                      }}
                    />
                    {star}
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Selected: {Array.isArray(analysisSelectedStars) && analysisSelectedStars.length
                ? [...analysisSelectedStars].sort((a, b) => a - b).map((star) => `${star}★`).join(', ')
                : 'All stars'}
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => onRefresh({ offset: 0 })}
              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all"
            >
              Apply / Refresh Results
            </button>
            <button
              onClick={() => {
                onClearFilters();
                onAnalysisStartIndex?.('');
                onAnalysisEndIndex?.('');
                onAnalysisSelectedStars?.([]);
                onRefresh({
                  search: '',
                  status: '',
                  sentiment: '',
                  priority: '',
                  rating: '',
                  source: '',
                  startDate: '',
                  endDate: '',
                  offset: 0,
                });
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Clear Filters
            </button>
          </div>
        </aside>

        <section className="bg-white rounded-2xl border border-slate-200/60 min-w-0 h-[72vh] xl:h-[calc(100vh-3rem)] flex flex-col overflow-hidden xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Inbox Source View</p>
            <select
              value={filterSource}
              onChange={e => onFilterSource(e.target.value)}
              className="w-full max-w-[340px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-300 cursor-pointer"
            >
              <option value="">All Sources</option>
              {sourceFilterOptions.map((option) => (
                <option key={`table-${option.key}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
          ) : (
            <>
              <div className="z-30 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                <div
                  ref={topHorizontalScrollRef}
                  onScroll={() => syncHorizontalScroll(topHorizontalScrollRef, tableHorizontalScrollRef)}
                  className="overflow-x-auto custom-scrollbar"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  aria-label="Top horizontal scroll"
                >
                  <div ref={topHorizontalTrackRef} className="h-3 min-w-full" />
                </div>
              </div>
              <div
                ref={tableHorizontalScrollRef}
                onScroll={() => syncHorizontalScroll(tableHorizontalScrollRef, topHorizontalScrollRef)}
                className="relative flex-1 min-h-0 overflow-auto custom-scrollbar min-w-0"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <table className="w-full min-w-[1280px] text-sm">
                  <thead className="sticky top-0 z-20 bg-slate-50">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Review', 'Source', 'Customer', 'Date', 'Rating', 'Sentiment', 'Priority', 'Status', 'Issue', 'Actions'].map(h => <th key={h} className="bg-slate-50 text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map(f => {
                      const sentimentUi = sentimentDisplayForFeedback(f);
                      const priorityUi = priorityDisplayForFeedback(f);
                      return (
                        <tr key={f.id} className="border-b border-slate-100 align-top hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4 min-w-[360px] max-w-[560px]">
                            <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap break-words">{f.text || 'No review text available.'}</p>
                          </td>
                          <td className="px-4 py-4"><span className="text-xs font-semibold text-slate-700 capitalize">{f.source || 'Unknown'}</span></td>
                          <td className="px-4 py-4"><span className="text-xs text-slate-600">{f.customer_identifier || 'Anonymous'}</span></td>
                          <td className="px-4 py-4"><span className="text-xs text-slate-500 whitespace-nowrap">{f.created_at?.split('T')[0] || '-'}</span></td>
                          <td className="px-4 py-4">
                            <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                              {Number.isFinite(Number(f.rating)) && Number(f.rating) > 0 ? `${Math.max(1, Math.min(5, Math.round(Number(f.rating))))} Star` : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${sentimentUi.className}`}>{sentimentUi.label}</span>
                          </td>
                          <td className="px-4 py-4">
                            {priorityUi.editable ? (
                              <select value={priorityUi.priority} onChange={e => onUpdatePriority(f.id, e.target.value)} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border cursor-pointer outline-none capitalize ${priorityUi.className}`}>
                                {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${priorityUi.className}`}>{priorityUi.label}</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button onClick={() => onUpdateStatus(f.id, f.status === 'open' ? 'resolved' : 'open')} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border cursor-pointer ${statusBg(f.status)}`}>
                              {f.status === 'open' ? <><Clock size={10} className="inline mr-1" />Open</> : <><Check size={10} className="inline mr-1" />Resolved</>}
                            </button>
                          </td>
                          <td className="px-4 py-4"><span className={`text-xs font-medium ${isFeedbackAnalyzed(f) ? 'text-indigo-600' : 'text-slate-500'}`}>{issueDisplayForFeedback(f)}</span></td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onGenerateResponse(f.text, f.issue_name, '')}
                                disabled={!llmConnected}
                                className="text-indigo-500 hover:text-indigo-700 p-1.5 rounded-lg hover:bg-indigo-50 transition-all disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                          title={llmConnected ? 'Generate AI Response' : 'Enable LLM usage to generate AI responses'}
                              >
                                <Sparkles size={14} />
                              </button>
                              <button
                                onClick={() => onGenerateOutreach?.(f.id)}
                                disabled={outreachGeneratingId === f.id}
                                className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition-all disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                                title="Generate instant offer outreach from knowledge base"
                              >
                                {outreachGeneratingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {data.items.length === 0 && <tr><td colSpan={10} className="text-center py-16 text-slate-400">No feedback found for the selected filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-medium text-slate-500">Showing {pageStart}-{pageEnd} of {totalCount} reviews</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500">Rows</label>
                  <select
                    value={pageLimit}
                    onChange={(e) => onChangePageSize?.(Number(e.target.value) || 100)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-indigo-300"
                  >
                    {[50, 100, 200, 500].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRefresh({ limit: pageLimit, offset: Math.max(0, pageOffset - pageLimit) })}
                    disabled={!canPrevPage}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => onRefresh({ limit: pageLimit, offset: pageOffset + pageLimit })}
                    disabled={!canNextPage}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

// Issues View
// ── Issues View ─────────────────────────────────────────────────────────────
const IssuesView = ({ data, loading, onViewDetail, onShowCreate }) => (
  <div className="p-8 max-w-6xl mx-auto space-y-4">
    <div className="flex items-center justify-between mb-2">
      <div><h1 className="text-xl font-bold text-slate-900">Issue Tracker</h1><p className="text-sm text-slate-500">{data.total} issues — sorted by impact score</p></div>
      <button onClick={onShowCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2"><Plus size={15} /> Create Issue</button>
    </div>
    {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div> : (
      <div className="space-y-3">
        {data.items.map(iss => (
          <div key={iss.id} onClick={() => onViewDetail(iss.id)} className="bg-white rounded-2xl border border-slate-200/60 p-5 cursor-pointer hover:shadow-md hover:border-slate-300/80 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><AlertTriangle size={18} className="text-amber-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{iss.name}</h3>
                  <p className="text-xs text-slate-500">{iss.description || 'No description'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {trendIcon(iss.trend)}<span className="text-xs text-slate-500 capitalize">{iss.trend}</span>
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${statusBg(iss.status)}`}>{iss.status}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
              <span><strong className="text-slate-700">{iss.mention_count}</strong> mentions</span>
              <span><strong className="text-slate-700">{Math.round((iss.negative_ratio || 0) * 100)}%</strong> negative</span>
              <span className="text-indigo-600 font-bold">Impact: {Math.round(iss.impact_score)}</span>
            </div>
          </div>
        ))}
        {data.items.length === 0 && <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">No issues tracked yet</div>}
      </div>
    )}
  </div>
);

// ── Customers View ──────────────────────────────────────────────────────────
const CustomersView = ({ data, loading, search, onSearch, onViewTimeline }) => (
  <div className="p-8 max-w-6xl mx-auto space-y-4">
    <div className="flex items-center justify-between mb-2">
      <div><h1 className="text-xl font-bold text-slate-900">Customers</h1><p className="text-sm text-slate-500">{data.total} customers tracked</p></div>
      <div className="relative w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300 transition-all" />
      </div>
    </div>
    {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div> : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.items.map(c => (
          <div key={c.id} onClick={() => onViewTimeline(c.id)} className="bg-white rounded-2xl border border-slate-200/60 p-5 cursor-pointer hover:shadow-md hover:border-slate-300/80 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                {(c.customer_identifier || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">{c.customer_identifier}</h3>
                <p className="text-[10px] text-slate-400">Since {c.first_seen_at?.split('T')[0] || 'N/A'}</p>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${sentimentBg(c.overall_sentiment)}`}>{c.overall_sentiment}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span><strong className="text-slate-700">{c.total_feedback_count || 0}</strong> feedback</span>
              <span className="capitalize">Trend: <strong className={c.sentiment_trend === 'improving' ? 'text-emerald-600' : c.sentiment_trend === 'degrading' ? 'text-rose-600' : 'text-slate-600'}>{c.sentiment_trend || 'stable'}</strong></span>
            </div>
          </div>
        ))}
        {data.items.length === 0 && <div className="col-span-2 text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">No customers tracked yet</div>}
      </div>
    )}
  </div>
);

// ── Create Issue Modal ──────────────────────────────────────────────────────
const createDefaultKnowledgeOfferForm = () => ({
  name: '',
  segment: 'all',
  channel: 'any',
  offer_title: '',
  offer_details: '',
  discount_code: '',
  cta_text: '',
  email_subject: '',
  template_email: '',
  template_sms: '',
  customer_identifiers: [],
  priority: 100,
  active: true,
});

const createDefaultEmailConnectorForm = () => ({
  connector_name: 'Primary Email',
  from_name: '',
  from_email: '',
  reply_to: '',
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_security: 'starttls',
  active: true,
  configured: false,
  has_password: false,
  last_error: '',
  last_tested_at: null,
});

const createDefaultDirectSendState = () => ({
  offerId: '',
  segment: 'all',
  customer_identifiers: [],
  subject: '',
  message: '',
});

const KnowledgeBaseView = ({
  data,
  loading,
  message,
  onCreateOffer,
  onUpdateOffer,
  onDeleteOffer,
  onRefresh,
  onMessage,
}) => {
  const [form, setForm] = useState(() => createDefaultKnowledgeOfferForm());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [audienceData, setAudienceData] = useState({
    segments: [],
    customers: [],
    total_segments: 0,
    total_customers: 0,
    contactable_customers: 0,
  });
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [connectorForm, setConnectorForm] = useState(() => createDefaultEmailConnectorForm());
  const [connectorLoading, setConnectorLoading] = useState(false);
  const [connectorSaving, setConnectorSaving] = useState(false);
  const [directSend, setDirectSend] = useState(() => createDefaultDirectSendState());
  const [directSending, setDirectSending] = useState(false);
  const offers = Array.isArray(data?.items) ? data.items : [];
  const segmentCards = Array.isArray(audienceData?.segments) ? audienceData.segments : [];
  const audienceCustomers = Array.isArray(audienceData?.customers) ? audienceData.customers : [];

  const hydrateConnectorForm = useCallback((payload = {}) => {
    setConnectorForm({
      ...createDefaultEmailConnectorForm(),
      ...payload,
      smtp_port: Number(payload?.smtp_port || 587),
      smtp_password: '',
      configured: Boolean(payload?.configured),
      has_password: Boolean(payload?.has_password),
      active: payload?.active !== false,
    });
  }, []);

  const refreshAudienceData = useCallback(async () => {
    setAudienceLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/audiences`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage?.(payload?.detail || 'Could not load analyzed audience segments.');
        return;
      }
      setAudienceData({
        segments: Array.isArray(payload?.segments) ? payload.segments : [],
        customers: Array.isArray(payload?.customers) ? payload.customers : [],
        total_segments: Number(payload?.total_segments || 0),
        total_customers: Number(payload?.total_customers || 0),
        contactable_customers: Number(payload?.contactable_customers || 0),
      });
    } catch (e) {
      onMessage?.(e?.message || 'Could not load analyzed audience segments.');
    } finally {
      setAudienceLoading(false);
    }
  }, [onMessage]);

  const refreshEmailConnector = useCallback(async () => {
    setConnectorLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/email-connector`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage?.(payload?.detail || 'Could not load the email connector.');
        return;
      }
      hydrateConnectorForm(payload);
    } catch (e) {
      onMessage?.(e?.message || 'Could not load the email connector.');
    } finally {
      setConnectorLoading(false);
    }
  }, [hydrateConnectorForm, onMessage]);

  const refreshKnowledgeSupport = useCallback(async () => {
    await Promise.all([
      Promise.resolve(onRefresh?.()),
      refreshAudienceData(),
      refreshEmailConnector(),
    ]);
  }, [onRefresh, refreshAudienceData, refreshEmailConnector]);

  useEffect(() => {
    refreshAudienceData();
    refreshEmailConnector();
  }, [refreshAudienceData, refreshEmailConnector]);

  const availableSegments = useMemo(() => {
    const seen = new Set(['all']);
    const ordered = [{ value: 'all', label: 'All analyzed segments' }];
    segmentCards.forEach((segment) => {
      const key = String(segment?.segment || '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push({
        value: String(segment.segment),
        label: `${segment.segment} (${Number(segment.customer_count || 0)})`,
      });
    });
    return ordered;
  }, [segmentCards]);

  const filteredOfferCustomers = useMemo(() => {
    const scoped = form.segment && form.segment !== 'all'
      ? audienceCustomers.filter((customer) => customer.segment === form.segment)
      : audienceCustomers;
    return scoped.slice(0, 18);
  }, [audienceCustomers, form.segment]);

  const directAudienceOptions = useMemo(() => {
    const scoped = directSend.segment && directSend.segment !== 'all'
      ? audienceCustomers.filter((customer) => customer.segment === directSend.segment)
      : audienceCustomers;
    return scoped.filter((customer) => customer.contact_email).slice(0, 18);
  }, [audienceCustomers, directSend.segment]);

  const selectedDirectOffer = useMemo(
    () => offers.find((offer) => String(offer.id) === String(directSend.offerId)) || null,
    [offers, directSend.offerId],
  );

  const directAudienceRecipients = useMemo(() => {
    const explicit = new Set(
      (directSend.customer_identifiers || [])
        .map((identifier) => String(identifier || '').trim().toLowerCase())
        .filter(Boolean),
    );
    const scoped = explicit.size > 0
      ? audienceCustomers.filter((customer) =>
          explicit.has(String(customer.customer_identifier || '').trim().toLowerCase()),
        )
      : (
          directSend.segment && directSend.segment !== 'all'
            ? audienceCustomers.filter((customer) => customer.segment === directSend.segment)
            : audienceCustomers
        );
    return scoped.filter((customer) => customer.contact_email);
  }, [audienceCustomers, directSend.customer_identifiers, directSend.segment]);

  const connectorReady = Boolean(
    connectorForm?.configured
      && connectorForm?.active
      && connectorForm?.from_email
      && connectorForm?.smtp_host
      && (connectorForm?.has_password || connectorForm?.smtp_password),
  );

  const applyEditOffer = (offer) => {
    setEditingId(offer?.id || null);
    setForm({
      ...createDefaultKnowledgeOfferForm(),
      name: offer?.name || '',
      segment: offer?.segment || 'all',
      channel: offer?.channel || 'any',
      offer_title: offer?.offer_title || '',
      offer_details: offer?.offer_details || '',
      discount_code: offer?.discount_code || '',
      cta_text: offer?.cta_text || '',
      email_subject: offer?.email_subject || '',
      template_email: offer?.template_email || '',
      template_sms: offer?.template_sms || '',
      customer_identifiers: Array.isArray(offer?.customer_identifiers) ? offer.customer_identifiers : [],
      priority: Number(offer?.priority || 100),
      active: Boolean(offer?.active),
    });
    onMessage?.('Editing offer. Save to update.');
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(createDefaultKnowledgeOfferForm());
  };

  const toggleOfferCustomer = (identifier) => {
    setForm((prev) => {
      const next = Array.isArray(prev.customer_identifiers) ? [...prev.customer_identifiers] : [];
      const exists = next.includes(identifier);
      return {
        ...prev,
        customer_identifiers: exists
          ? next.filter((item) => item !== identifier)
          : [...next, identifier],
      };
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.offer_title.trim()) {
      onMessage?.('Offer name and offer title are required.');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      priority: Math.max(1, Math.min(9999, Number(form.priority) || 100)),
      customer_identifiers: Array.isArray(form.customer_identifiers) ? form.customer_identifiers : [],
    };
    let result;
    if (editingId) {
      result = await onUpdateOffer?.(editingId, payload);
    } else {
      result = await onCreateOffer?.(payload);
    }
    if (result?.ok) {
      onMessage?.(result.message || (editingId ? 'Offer updated.' : 'Offer created.'));
      clearForm();
    } else {
      onMessage?.(result?.message || 'Could not save offer.');
    }
    setSaving(false);
  };

  const handleDelete = async (offerId) => {
    const confirmed = window.confirm('Delete this offer from the knowledge base?');
    if (!confirmed) return;
    const result = await onDeleteOffer?.(offerId);
    if (result?.ok) {
      onMessage?.(result.message || 'Offer deleted.');
      if (editingId === offerId) clearForm();
    } else {
      onMessage?.(result?.message || 'Could not delete offer.');
    }
  };

  const handleSaveConnector = async () => {
    if (!connectorForm.from_email.trim() || !connectorForm.smtp_host.trim()) {
      onMessage?.('From email and SMTP host are required for the email connector.');
      return;
    }
    if (!connectorForm.smtp_password && !connectorForm.has_password) {
      onMessage?.('Add the SMTP password the first time you save this connector.');
      return;
    }
    setConnectorSaving(true);
    try {
      const payload = {
        connector_name: connectorForm.connector_name,
        from_name: connectorForm.from_name,
        from_email: connectorForm.from_email,
        reply_to: connectorForm.reply_to,
        smtp_host: connectorForm.smtp_host,
        smtp_port: Math.max(1, Number(connectorForm.smtp_port) || 587),
        smtp_username: connectorForm.smtp_username,
        smtp_password: connectorForm.smtp_password,
        smtp_security: connectorForm.smtp_security,
        active: !!connectorForm.active,
      };
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/email-connector`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage?.(response?.detail || 'Could not save the email connector.');
        return;
      }
      hydrateConnectorForm(response);
      onMessage?.('Email connector saved. Direct delivery is ready.');
    } catch (e) {
      onMessage?.(e?.message || 'Could not save the email connector.');
    } finally {
      setConnectorSaving(false);
    }
  };

  const clearDirectSend = () => {
    setDirectSend(createDefaultDirectSendState());
  };

  const startDirectSend = (offer) => {
    if (!offer) {
      clearDirectSend();
      return;
    }
    const fallbackMessage = [
      'Hi {customer_name},',
      '',
      offer.offer_title || 'We have an offer for you.',
      offer.offer_details || '',
      offer.discount_code ? `Use code ${offer.discount_code}.` : '',
      '',
      offer.cta_text || 'Reply to this email and we will help right away.',
      '',
      'Best regards,',
      connectorForm.from_name || 'Customer Experience Team',
    ].filter(Boolean).join('\n');
    setDirectSend({
      offerId: String(offer.id),
      segment: offer.segment || 'all',
      customer_identifiers: Array.isArray(offer.customer_identifiers) ? offer.customer_identifiers : [],
      subject: offer.email_subject || `${offer.offer_title || 'Offer'} for {customer_name}`,
      message: offer.template_email || fallbackMessage,
    });
    onMessage?.('Direct email composer loaded from the selected offer.');
  };

  const toggleDirectCustomer = (identifier) => {
    setDirectSend((prev) => {
      const next = Array.isArray(prev.customer_identifiers) ? [...prev.customer_identifiers] : [];
      const exists = next.includes(identifier);
      return {
        ...prev,
        customer_identifiers: exists
          ? next.filter((item) => item !== identifier)
          : [...next, identifier],
      };
    });
  };

  const handleDirectSend = async () => {
    if (!selectedDirectOffer) {
      onMessage?.('Choose an offer before sending.');
      return;
    }
    if (String(selectedDirectOffer.channel || '').toLowerCase() === 'sms') {
      onMessage?.('This offer is marked SMS only. Change the offer channel before sending email.');
      return;
    }
    if (!connectorReady) {
      onMessage?.('Save an active email connector before sending direct email.');
      return;
    }
    if (!directAudienceRecipients.length) {
      onMessage?.('No contactable customers match the selected segment or individual audience.');
      return;
    }
    setDirectSending(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/fi/knowledge-base/offers/send-email`, {
        method: 'POST',
        body: JSON.stringify({
          offer_id: Number(selectedDirectOffer.id),
          segment: directSend.segment || 'all',
          customer_identifiers: directSend.customer_identifiers || [],
          subject: directSend.subject || '',
          message: directSend.message || '',
        }),
      }, { timeoutMs: 30000 });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage?.(payload?.detail || 'Direct email delivery failed.');
        return;
      }
      onMessage?.(
        payload?.failed_count
          ? `Sent ${payload.sent_count || 0} emails with ${payload.failed_count || 0} failures.`
          : `Sent ${payload.sent_count || 0} emails directly from the Offer KB.`,
      );
      await refreshEmailConnector();
    } catch (e) {
      onMessage?.(e?.message || 'Direct email delivery failed.');
    } finally {
      setDirectSending(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Offer Knowledge Base</h1>
          <p className="text-sm text-slate-500">
            Cluster analyzed customers into real audience groups, attach offers to those segments or named customers,
            and send direct email from the same workspace.
          </p>
        </div>
        <button
          onClick={refreshKnowledgeSupport}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Analyzed Customer Segments</h2>
            <p className="mt-1 text-sm text-slate-500">
              These groups come from CRM analysis and can be used directly inside Offer KB.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
              {audienceData.total_segments || 0} segments
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
              {audienceData.contactable_customers || 0} email-ready
            </span>
          </div>
        </div>

        {audienceLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
          </div>
        ) : segmentCards.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
            Run CRM analysis first. Segment clusters will appear here after feedback has been analyzed.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {segmentCards.map((segment) => (
              <button
                key={segment.segment}
                onClick={() => {
                  setForm((prev) => ({ ...prev, segment: segment.segment }));
                  setDirectSend((prev) => ({
                    ...prev,
                    segment: segment.segment,
                    customer_identifiers: [],
                  }));
                  onMessage?.(`Audience pinned to ${segment.segment}.`);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 capitalize">{segment.segment}</p>
                    <p className="text-xs text-slate-500">{segment.feedback_count || 0} analyzed feedback items</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 border border-slate-200">
                    {segment.customer_count || 0} customers
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1">
                    {segment.contactable_count || 0} email-ready
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(segment.customers || []).slice(0, 4).map((customer) => (
                    <span
                      key={`${segment.segment}-${customer.customer_identifier}`}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 border border-slate-200"
                    >
                      {customer.contact_name || customer.customer_identifier}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Email Connector</h2>
            <p className="mt-1 text-sm text-slate-500">
              Save one SMTP connector here so Offer KB can send direct email without leaving the app.
            </p>
          </div>
          {connectorLoading ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
              connectorReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {connectorReady ? 'Connected' : 'Needs setup'}
            </span>
          )}
        </div>

        {connectorForm.last_error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Last delivery error: {connectorForm.last_error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={connectorForm.connector_name}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, connector_name: e.target.value }))}
            placeholder="Connector name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={connectorForm.from_name}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, from_name: e.target.value }))}
            placeholder="From name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={connectorForm.from_email}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, from_email: e.target.value }))}
            placeholder="From email"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={connectorForm.reply_to}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, reply_to: e.target.value }))}
            placeholder="Reply-to email (optional)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={connectorForm.smtp_host}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, smtp_host: e.target.value }))}
            placeholder="SMTP host"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            type="number"
            min={1}
            value={connectorForm.smtp_port}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, smtp_port: e.target.value }))}
            placeholder="SMTP port"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={connectorForm.smtp_username}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, smtp_username: e.target.value }))}
            placeholder="SMTP username"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            type="password"
            value={connectorForm.smtp_password}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, smtp_password: e.target.value }))}
            placeholder={connectorForm.has_password ? 'Password saved. Enter only to replace it.' : 'SMTP password'}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <select
            value={connectorForm.smtp_security}
            onChange={(e) => setConnectorForm((prev) => ({ ...prev, smtp_security: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          >
            <option value="starttls">STARTTLS</option>
            <option value="ssl">SSL / TLS</option>
            <option value="none">No encryption</option>
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={!!connectorForm.active}
              onChange={(e) => setConnectorForm((prev) => ({ ...prev, active: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Connector active
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Use any SMTP-compatible provider. Saved passwords stay hidden on reload.
          </p>
          <button
            onClick={handleSaveConnector}
            disabled={connectorSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            {connectorSaving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Save Connector
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Direct Email Dispatch</h2>
            <p className="mt-1 text-sm text-slate-500">
              Send an offer directly to a whole analyzed segment or a hand-picked list of customers.
            </p>
          </div>
          {selectedDirectOffer && (
            <button
              onClick={clearDirectSend}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Clear Composer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={directSend.offerId}
            onChange={(e) => startDirectSend(offers.find((offer) => String(offer.id) === e.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          >
            <option value="">Choose offer to send</option>
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.name} · {offer.segment || 'all'}
              </option>
            ))}
          </select>
          <select
            value={directSend.segment}
            onChange={(e) => setDirectSend((prev) => ({ ...prev, segment: e.target.value, customer_identifiers: [] }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          >
            {availableSegments.map((segment) => (
              <option key={`direct-${segment.value}`} value={segment.value}>{segment.label}</option>
            ))}
          </select>
          <input
            value={directSend.subject}
            onChange={(e) => setDirectSend((prev) => ({ ...prev, subject: e.target.value }))}
            placeholder="Subject template"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 md:col-span-2"
          />
          <textarea
            value={directSend.message}
            onChange={(e) => setDirectSend((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Email body template"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 min-h-[130px] resize-y md:col-span-2"
          />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Recipient Preview</p>
              <p className="mt-1 text-xs text-slate-500">
                Choose people explicitly below, or leave this empty to send to the selected segment.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 border border-slate-200">
              {directAudienceRecipients.length} email recipients
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {directAudienceOptions.length === 0 ? (
              <span className="text-xs text-slate-500">No email-ready customers match this segment yet.</span>
            ) : (
              directAudienceOptions.map((customer) => {
                const isSelected = directSend.customer_identifiers.includes(customer.customer_identifier);
                return (
                  <button
                    key={`direct-target-${customer.customer_identifier}`}
                    onClick={() => toggleDirectCustomer(customer.customer_identifier)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {customer.contact_name || customer.customer_identifier}
                  </button>
                );
              })
            )}
          </div>
          {directAudienceRecipients.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {directAudienceRecipients.slice(0, 6).map((customer) => (
                <span
                  key={`preview-${customer.customer_identifier}`}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600"
                >
                  {customer.contact_name || customer.customer_identifier} · {customer.contact_email}
                </span>
              ))}
              {directAudienceRecipients.length > 6 && (
                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500">
                  +{directAudienceRecipients.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Supported placeholders in direct email: {`{customer_name}, {segment}, {offer_title}, {offer_details}, {discount_line}, {cta_text}`}.
          </p>
          <button
            onClick={handleDirectSend}
            disabled={directSending || !selectedDirectOffer || !connectorReady || directAudienceRecipients.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            {directSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send {directAudienceRecipients.length || ''} {directAudienceRecipients.length === 1 ? 'Email' : 'Emails'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{editingId ? 'Edit Offer' : 'Create Offer'}</h2>
          {editingId && (
            <button
              onClick={clearForm}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Cancel Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Offer name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={form.offer_title}
            onChange={(e) => setForm((prev) => ({ ...prev, offer_title: e.target.value }))}
            placeholder="Offer title"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <select
            value={form.segment}
            onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          >
            {availableSegments.map((segment) => (
              <option key={segment.value} value={segment.value}>{segment.label}</option>
            ))}
          </select>
          <select
            value={form.channel}
            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          >
            <option value="any">Any Available Channel</option>
            <option value="email">Email Only</option>
            <option value="sms">SMS Only</option>
            <option value="both">Email + SMS</option>
          </select>
          <input
            value={form.discount_code}
            onChange={(e) => setForm((prev) => ({ ...prev, discount_code: e.target.value }))}
            placeholder="Discount code (optional)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={form.cta_text}
            onChange={(e) => setForm((prev) => ({ ...prev, cta_text: e.target.value }))}
            placeholder="CTA text (optional)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300"
          />
          <input
            value={form.email_subject}
            onChange={(e) => setForm((prev) => ({ ...prev, email_subject: e.target.value }))}
            placeholder="Email subject template (optional)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 md:col-span-2"
          />
          <textarea
            value={form.offer_details}
            onChange={(e) => setForm((prev) => ({ ...prev, offer_details: e.target.value }))}
            placeholder="Offer details"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 min-h-[84px] resize-y md:col-span-2"
          />
          <textarea
            value={form.template_email}
            onChange={(e) => setForm((prev) => ({ ...prev, template_email: e.target.value }))}
            placeholder="Email template. Supported placeholders: {customer_name}, {offer_title}, {offer_details}, {discount_line}, {cta_text}, {segment}"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 min-h-[100px] resize-y md:col-span-2"
          />
          <textarea
            value={form.template_sms}
            onChange={(e) => setForm((prev) => ({ ...prev, template_sms: e.target.value }))}
            placeholder="SMS template (optional). Same placeholders supported."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-300 min-h-[84px] resize-y md:col-span-2"
          />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Individual Customer Overrides</p>
              <p className="mt-1 text-xs text-slate-500">
                Select specific customers when this offer should target named people in addition to the chosen segment.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 border border-slate-200">
              {form.customer_identifiers.length} selected
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {filteredOfferCustomers.length === 0 ? (
              <span className="text-xs text-slate-500">No analyzed customers available for this segment yet.</span>
            ) : (
              filteredOfferCustomers.map((customer) => {
                const isSelected = form.customer_identifiers.includes(customer.customer_identifier);
                return (
                  <button
                    key={`offer-target-${customer.customer_identifier}`}
                    onClick={() => toggleOfferCustomer(customer.customer_identifier)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {customer.contact_name || customer.customer_identifier}
                    <span className="ml-1 text-slate-400">· {customer.contact_email ? 'email ready' : 'no email'}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Priority</label>
          <input
            type="number"
            min={1}
            max={9999}
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-300"
          />
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            Active
          </label>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {editingId ? 'Update Offer' : 'Add Offer'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Configured Offers</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {data?.total || offers.length} total
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
          </div>
        ) : offers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
            No offers yet. Add one above to activate agentic outreach.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {offers.map((offer) => (
              <div key={offer.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{offer.name}</p>
                    <p className="text-xs text-slate-500">{offer.offer_title}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.11em] ${offer.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {offer.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 line-clamp-3">{offer.offer_details || 'No offer details provided.'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-md bg-white border border-slate-200 px-2 py-1">Segment: {offer.segment || 'all'}</span>
                  <span className="rounded-md bg-white border border-slate-200 px-2 py-1">Channel: {offer.channel || 'any'}</span>
                  <span className="rounded-md bg-white border border-slate-200 px-2 py-1">Priority: {offer.priority || 100}</span>
                  <span className="rounded-md bg-white border border-slate-200 px-2 py-1">
                    Individuals: {Array.isArray(offer.customer_identifiers) ? offer.customer_identifiers.length : 0}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => startDirectSend(offer)}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Send Email
                  </button>
                  <button
                    onClick={() => applyEditOffer(offer)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(offer.id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CreateIssueModal = ({ show, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  if (!show) return null;
  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await apiFetch(`${API_BASE}/api/fi/issues`, { method: 'POST', body: JSON.stringify({ name, description: desc }) });
      setName(''); setDesc(''); onCreated();
    } catch {} finally { setCreating(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="bg-white rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl">
        <h3 className="font-semibold text-slate-900 mb-4">Create Issue</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Issue name" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 mb-3 text-sm outline-none focus:border-indigo-500" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-indigo-500 min-h-[80px] resize-none" />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleCreate} disabled={creating || !name.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {creating && <Loader2 size={14} className="animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Create Feedback Modal ───────────────────────────────────────────────────
const CreateFeedbackModal = ({ show, onClose, onCreated }) => {
  const [text, setText] = useState('');
  const [sentiment, setSentiment] = useState('neutral');
  const [source, setSource] = useState('manual');
  const [priority, setPriority] = useState('medium');
  const [customerIdent, setCustomerIdent] = useState('');
  const [creating, setCreating] = useState(false);

  if (!show) return null;
  const handleCreate = async () => {
    if (!text.trim()) return;
    setCreating(true);
    try {
      await apiFetch(`${API_BASE}/api/fi/feedback`, { method: 'POST', body: JSON.stringify({ text, sentiment, source, priority, customer_identifier: customerIdent || null }) });
      setText(''); onCreated();
    } catch {} finally { setCreating(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="bg-white rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl">
        <h3 className="font-semibold text-slate-900 mb-4">Add Feedback</h3>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Feedback text..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 mb-3 text-sm outline-none focus:border-indigo-500 min-h-[100px] resize-none" />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select value={sentiment} onChange={e => setSentiment(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
            <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
        </div>
        <input value={customerIdent} onChange={e => setCustomerIdent(e.target.value)} placeholder="Customer email/ID (optional)" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-indigo-500" />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleCreate} disabled={creating || !text.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {creating && <Loader2 size={14} className="animate-spin" />} Add
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Connectors View ─────────────────────────────────────────────────────────
const ConnectorsView = ({ data, loading, onRefresh }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState('playstore');
  const [fetchInterval, setFetchInterval] = useState('daily');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!identifier) return alert('Identifier is required');
    setCreating(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/user/connectors`, {
        method: 'POST',
        body: JSON.stringify({ 
          connector_type: type, 
          identifier: identifier,
          name: name || `${type} Source`,
          fetch_interval: fetchInterval,
          max_reviews: 50
        })
      });
      if (res.ok) {
        setShowCreate(false);
        setIdentifier('');
        setName('');
        onRefresh();
      }
    } catch (e) { alert('Failed to create connector'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove global connector? This affects Workspace as well.')) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/user/connectors/${id}`, { method: 'DELETE' });
      if (res.ok) onRefresh();
    } catch {}
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workspace Connectors</h1>
          <p className="text-sm text-slate-500">Shared sources feeding both Workspace analysis and CRM Intelligence</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2">
          <Plus size={15} /> Add Global Connector
        </button>
      </div>
      
      {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200/60 p-5 pt-6 relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-80" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <Plug size={20} className="text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 capitalize leading-tight">{c.name || c.connector_type}</h3>
                    <p className="text-[11px] font-medium text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-[140px]">{c.identifier}</p>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">Active</p>
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">Auto-Fetch</span>
                  <span className="text-slate-900 font-semibold capitalize bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">{c.fetch_interval}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-medium">Type: <span className="capitalize">{c.connector_type}</span></p>
                <button onClick={() => handleDelete(c.id)} className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 px-2 py-1 hover:bg-rose-50 rounded transition-colors">Remove</button>
              </div>
            </div>
          ))}
          {data.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center">
              <Plug size={32} className="text-slate-300 mb-3" />
              No connectors found. Add a Workspace connector to start pulling data.
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setShowCreate(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900 mb-5">Add Global Connector</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Source Type</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:bg-white transition-all appearance-none cursor-pointer">
                  <option value="playstore">Google Play Store</option>
                  <option value="appstore">Apple App Store</option>
                  <option value="trustpilot">Trustpilot</option>
                  <option value="generic_api">Generic API</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Identifier (App ID / URL)</label>
                <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="e.g. com.example.app" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Friendly Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="My Android App" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fetch Interval</label>
                <select value={fetchInterval} onChange={e => setFetchInterval(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:bg-white transition-all appearance-none cursor-pointer">
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="px-6 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-600/30 disabled:opacity-50 flex items-center gap-2 transition-all">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create Connector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackCRM;
