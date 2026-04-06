import React, { useState, useEffect, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Settings,
    HelpCircle,
    Zap,
    LogOut,
    Plus,
    Trash2,
    Loader2,
    X,
    AlertCircle,
    ArrowLeft,
    Database,
    Cpu,
    BarChart2,
    ChevronRight,
    Search,
    Bell,
    User,
    ArrowRight,
    Frown,
    Target,
    DollarSign,
    Terminal,
    TrendingUp,
    AppWindow,
    FileJson,
    Play,
    Star,
    Calendar,
    Filter,
    Check,
    BarChart,
    PieChart,
    MessageSquare,
    Lightbulb,
    FileText,
    Activity as ActivityIcon,
    Upload,
    FileUp,
    Globe,
    RefreshCw,
    Download,
    Shield,
    Network,
    Users,
    Briefcase,
    ClipboardList,
    RotateCcw,
    Sparkles,
    Moon,
    Sun
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Assuming API_BASE is handled elsewhere or defined here
const API_BASE = ''; 

const RESOLUTION_BASE_VIEWPORT = { width: 1536, height: 864 };
const RESOLUTION_SCALE_LIMITS = { min: 0.88, max: 1.28 };
const THEME_STORAGE_KEY = 'horizon_theme_mode';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getInitialThemeMode = () => {
    if (typeof window === 'undefined') return 'light';

    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') return stored;
    } catch (_) {
        // Storage access can fail in private contexts; default below.
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
};

const computeResolutionScale = () => {
    if (typeof window === 'undefined') return 1;

    const width = window.innerWidth || RESOLUTION_BASE_VIEWPORT.width;
    const height = window.innerHeight || RESOLUTION_BASE_VIEWPORT.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return 1;
    }

    const scale = Math.min(
        width / RESOLUTION_BASE_VIEWPORT.width,
        height / RESOLUTION_BASE_VIEWPORT.height
    );

    return clamp(scale, RESOLUTION_SCALE_LIMITS.min, RESOLUTION_SCALE_LIMITS.max);
};

const useResolutionScale = () => {
    const [scale, setScale] = useState(() => computeResolutionScale());

    useEffect(() => {
        const handleResize = () => setScale(computeResolutionScale());
        handleResize();

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
            }
        };
    }, []);

    return scale;
};

const ResolutionAdaptiveShell = ({ children, className = '' }) => {
    const scale = useResolutionScale();
    const inverseScale = scale > 0 ? 1 / scale : 1;

    return (
        <div className={`h-screen w-screen overflow-hidden ${className}`}>
            <div
                className="h-full origin-top-left"
                style={{
                    transform: `scale(${scale})`,
                    width: `${inverseScale * 100}%`,
                    height: `${inverseScale * 100}%`,
                }}
            >
                {children}
            </div>
        </div>
    );
};

// surviving sub-components (stubs if not fully integrated yet)
import CopilotChat from './copilot/CopilotChat';
import { 
  PredictiveIntelligenceTab, CompetitiveIntelligenceTab, CausalDiagnosticsTab, TrustCenterTab, PrioritizationTab
} from './analytics/AdvancedIntelligenceTabs';
import ExecutiveSummaryTab from './analytics/premium/ExecutiveSummaryTab';
import ExecutiveOperationsDashboard from './analytics/premium/ExecutiveOperationsDashboard';
import StrategicNarrative from './analytics/StrategicNarrative';
import RevenueRisk from './analytics/RevenueRisk';
import CustomerProfilesView from './CustomerProfilesView';
import SurveyBuilder from './SurveyBuilder';
import FeedbackIntelligence from './FeedbackIntelligence';
import FeedbackCRM from './FeedbackCRM';
import { ConnectorStudio, CalibrationStudio } from './HorizonSetupViews';
import HorizonAccessPortal from './HorizonAccessPortal';
import HorizonWorkspaceOps from './HorizonWorkspaceOps';
import HelpSupport from './HelpSupport';

import { apiFetch } from '../utils/api';
import logoAppStore from '../assets/appstore.png';
import logoPlayStore from '../assets/playstore.png';
import logoCSV from '../assets/xcel.png';
import logoTypeform from '../assets/typeform.png';
import logoCRM from '../assets/sforce.png';
import logoAPI from '../assets/app.png';
import logoSurveyMonkey from '../assets/surveymonkey.png';
import logoWebhook from '../assets/webhook.png';
import {
    HORIZON_SESSION_STORAGE_KEY,
    HORIZON_PREVIEW_USER,
    HORIZON_PREVIEW_WORKSPACE,
    HORIZON_PREVIEW_CONNECTORS,
    HORIZON_PREVIEW_REVIEWS,
} from '../data/horizonPreviewData';

// ── Defensive Parsing Utilities ─────────────────────────────────

// Safely converts any value to a renderable string (handles nested objects, arrays, Maps)
const safeText = (val, fallback = '', _depth = 0) => {
    if (_depth > 3) return fallback; // prevent infinite recursion
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val instanceof Map) return Array.from(val.values()).map(v => safeText(v, '', _depth + 1)).join(' — ');
    if (val instanceof Set) return Array.from(val).map(v => safeText(v, '', _depth + 1)).join(', ');
    if (Array.isArray(val)) return val.map(v => safeText(v, '', _depth + 1)).filter(Boolean).join(', ') || fallback;
    if (typeof val === 'object') {
        if (val.name) return String(val.name);
        if (val.label) return String(val.label);
        if (val.title) return String(val.title);
        if (val.issue) return String(val.issue);
        if (val.text) return String(val.text);
        if (val.message) return String(val.message);
        const vals = Object.values(val).filter(v => typeof v === 'string' || typeof v === 'number');
        if (vals.length > 0) return vals.join(' — ');
        try { return JSON.stringify(val); } catch { return fallback; }
    }
    return String(val);
};

// Safely extract a number from any value — returns fallback on NaN/null/undefined/string
const safeNumber = (val, fallback = 0) => {
    if (val === null || val === undefined || val === '' || val === 'N/A' || val === 'null') return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
};

// Always returns an array regardless of input
const safeArray = (val) => {
    if (Array.isArray(val)) return val;
    if (val === null || val === undefined) return [];
    if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
};

// Safely parse a field that might be stringified JSON
const safeParse = (val, fallback = null) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return fallback; }
    }
    return fallback;
};

// Hardens the results object to ensure all required fields exist for sub-components
const hardenResults = (raw) => {
    if (!raw) return null;
    // Handle double-stringified JSON
    let data = raw;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return null; }
    }
    data = data.analytics || data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return null; }
    }

    // Build comprehensive healthMetrics with snake_case ↔ camelCase fallbacks
    const hm = data.healthMetrics || data.health_metrics || {};
    const healthMetrics = {
        nps_score: safeNumber(hm.nps_score ?? hm.npsScore ?? data.nps_score ?? data.npsScore),
        csat_score: safeNumber(hm.csat_score ?? hm.csatScore ?? data.csat_score ?? data.csatScore),
        ces_score: safeNumber(hm.ces_score ?? hm.cesScore ?? data.ces_score ?? data.cesScore),
        health_score: safeNumber(hm.health_score ?? hm.healthScore ?? data.health_score ?? data.healthScore),
        retention_risk_pct: safeNumber(hm.retention_risk_pct ?? hm.retentionRiskPct ?? data.retention_risk_pct ?? data.retentionRiskPct),
        total_reviews: safeNumber(hm.total_reviews ?? hm.totalReviews ?? data.total_reviews ?? data.totalReviews),
    };

    // Sentiment distribution
    const sd = data.sentimentDistribution || data.sentiment_distribution || {};
    const sentimentDistribution = {
        Positive: safeNumber(sd.Positive ?? sd.positive ?? data.totalPositive),
        Neutral: safeNumber(sd.Neutral ?? sd.neutral ?? data.totalNeutral),
        Negative: safeNumber(sd.Negative ?? sd.negative ?? data.totalNegative),
    };

    // Thematic deep merge
    const th = safeParse(data.thematic) || {};
    const thematic = {
        theme_hierarchy: th.theme_hierarchy || th.themeHierarchy || {},
        pain_points: th.pain_points || th.painPoints || {},
        top_issues: safeArray(th.top_issues || th.topIssues),
        emerging_themes: safeArray(th.emerging_themes || th.emergingThemes),
    };

    // Analysis accounting summary (fetched/analyzed/fallback/etc.)
    const ac = data.analysisCounts || data.analysis_counts || {};
    const analysisCounts = {
        fetched: safeNumber(ac.fetched ?? ac.fetched_reviews ?? data.fetched_reviews ?? data.total_reviews ?? data.totalReviews),
        analyzed: safeNumber(ac.analyzed ?? ac.analyzed_reviews ?? data.analyzed_reviews ?? data.total_reviews ?? data.totalReviews),
        fallback: safeNumber(ac.fallback ?? ac.fallback_reviews ?? data.fallback_reviews),
        unresolved: safeNumber(ac.unresolved ?? ac.unresolved_reviews ?? data.unresolved_reviews),
        dropped: safeNumber(ac.dropped ?? ac.dropped_reviews ?? data.dropped_reviews),
        coverage_pct: safeNumber(ac.coverage_pct ?? ac.coveragePct ?? data.coverage_pct),
        summary: ac.summary || data.analysisSummary || data.analysis_summary || '',
    };

    // Churn/retention production summary payload
    const cr = data.churnRetention || data.churn_retention || {};
    const crDist = safeParse(cr.risk_distribution ?? cr.riskDistribution, {}) || {};
    const crPct = safeParse(cr.risk_percentages ?? cr.riskPercentages, {}) || {};
    const churnRetention = {
        at_risk_reviews: safeNumber(cr.at_risk_reviews ?? cr.atRiskReviews),
        at_risk_pct: safeNumber(cr.at_risk_pct ?? cr.atRiskPct),
        high_risk_reviews: safeNumber(cr.high_risk_reviews ?? cr.highRiskReviews),
        medium_risk_reviews: safeNumber(cr.medium_risk_reviews ?? cr.mediumRiskReviews),
        low_risk_reviews: safeNumber(cr.low_risk_reviews ?? cr.lowRiskReviews),
        promoter_share_pct: safeNumber(cr.promoter_share_pct ?? cr.promoterSharePct),
        detractor_share_pct: safeNumber(cr.detractor_share_pct ?? cr.detractorSharePct),
        net_retention_signal_pct: safeNumber(cr.net_retention_signal_pct ?? cr.netRetentionSignalPct),
        alert_level: (cr.alert_level || cr.alertLevel || 'stable'),
        risk_distribution: {
            high: safeNumber(crDist.high),
            medium: safeNumber(crDist.medium),
            low: safeNumber(crDist.low),
            null: safeNumber(crDist.null),
        },
        risk_percentages: {
            high: safeNumber(crPct.high),
            medium: safeNumber(crPct.medium),
            low: safeNumber(crPct.low),
            null: safeNumber(crPct.null),
        },
        top_churn_drivers: safeArray(cr.top_churn_drivers ?? cr.topChurnDrivers),
        top_retention_drivers: safeArray(cr.top_retention_drivers ?? cr.topRetentionDrivers),
    };

    return {
        ...data,
        healthMetrics,
        sentimentDistribution,
        fixNowPriorities: safeArray(data.fixNowPriorities || data.fix_now_priorities),
        thematic,
        recommendations: safeArray(data.recommendations),
        executiveSummary: data.executiveSummary || data.executive_summary || null,
        strategicNarrative: data.strategicNarrative || data.strategic_narrative || null,
        analysisCounts,
        churnRetention,
        totalReviews: safeNumber(data.totalReviews ?? data.total_reviews ?? healthMetrics.total_reviews),
        totalPositive: sentimentDistribution.Positive,
        totalNeutral: sentimentDistribution.Neutral,
        totalNegative: sentimentDistribution.Negative,
    };
};

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("GlobalErrorBoundary caught an error:", error, errorInfo);
        this.setState({ errorInfo });
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-[#020408] text-slate-100 h-screen w-full overflow-auto flex flex-col items-center justify-center relative selection:bg-rose-500/30">
                   {/* Background Glow */}
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none"></div>
                   
                   <div className="max-w-3xl w-full bg-slate-900/80 backdrop-blur-xl p-10 rounded-3xl border border-slate-800 shadow-2xl relative z-10">
                       <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6 border border-rose-500/20 shadow-inner">
                           <AlertCircle className="text-rose-500" size={32} />
                       </div>
                       
                       <h2 className="text-[26px] font-black tracking-tight mb-3 text-white">System Exception Caught</h2>
                       <p className="text-[14px] font-medium mb-8 text-slate-400 leading-relaxed max-w-xl">An unexpected error occurred while rendering the intelligence dashboard. This is likely due to an anomalous data payload from the analysis core.</p>
                       
                       <div className="mb-6 p-5 bg-black/60 rounded-2xl border border-slate-800/80">
                           <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3 flex items-center gap-2">
                               <Terminal size={12} />
                               Diagnostic Context
                           </p>
                           <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto custom-scrollbar">
                               {JSON.stringify({
                                   currentStep: this.props.currentStep,
                                   hasResults: !!this.props.results,
                                   sidebarTab: this.props.sidebarTab,
                                   resultsTab: this.props.resultsTab,
                                   timestamp: new Date().toISOString()
                               }, null, 2)}
                           </pre>
                       </div>

                       <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3 mt-8 flex items-center gap-2">
                           <ActivityIcon size={12} />
                           Error Stack Trace
                       </p>
                       <pre className="text-[11px] bg-black/60 p-5 rounded-2xl border border-slate-800/80 shadow-inner whitespace-pre-wrap overflow-x-auto text-rose-400/90 font-mono custom-scrollbar max-h-48">
                          {this.state.error && this.state.error.toString()}
                          {"\n\nComponent Stack:\n"}
                          {this.state.errorInfo && this.state.errorInfo.componentStack}
                       </pre>
                       
                       <div className="flex items-center gap-4 mt-10">
                           <button onClick={() => window.location.reload()} className="px-8 py-3.5 bg-rose-600 text-white rounded-xl text-[12px] font-bold uppercase tracking-wider shadow-lg shadow-rose-600/20 hover:bg-rose-500 hover:shadow-rose-600/40 transition-all active:scale-95 flex items-center gap-2">
                               <RefreshCw size={14} />
                               Reinitialize UI
                           </button>
                           <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-8 py-3.5 bg-slate-800 text-slate-300 rounded-xl text-[12px] font-bold uppercase tracking-wider hover:bg-slate-700 hover:text-white transition-all active:scale-95 border border-slate-700">
                               Terminate Session
                           </button>
                       </div>
                   </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const getStoredHorizonSession = () => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = localStorage.getItem(HORIZON_SESSION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (_err) {
        return null;
    }
};

const persistHorizonSession = ({ mode, user, code }) => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(
        HORIZON_SESSION_STORAGE_KEY,
        JSON.stringify({
            mode,
            code: code || null,
            user: user || null,
            savedAt: new Date().toISOString(),
        })
    );
};

const clearHorizonSession = () => {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(HORIZON_SESSION_STORAGE_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('horizon_allow_dev_token');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_profile');
    sessionStorage.removeItem('horizon_allow_dev_token');
};

const PreviewStatusBanner = ({ compact = false, message }) => (
    <div
        className={`rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 shadow-sm ${
            compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3 text-[13px]'
        }`}
    >
        <div className="flex items-start gap-3">
            <Shield size={compact ? 15 : 17} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
                <p className="font-black uppercase tracking-[0.18em] text-amber-700">
                    Preview Mode
                </p>
                <p className={`${compact ? 'mt-1 leading-5' : 'mt-1.5 leading-6'}`}>
                    {message || 'This workspace is read-only. Explore the interface, but saving, syncing, exporting, and analysis actions stay locked until a valid access code is used.'}
                </p>
            </div>
        </div>
    </div>
);

const PreviewReadOnlyPanel = ({ title, description, accent = 'amber' }) => (
    <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_30px_90px_-58px_rgba(15,23,42,0.35)]">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${
                accent === 'rose'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : accent === 'emerald'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : accent === 'violet'
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
                <Shield size={12} />
                Read-only preview
            </div>
            <h2 className="mt-5 text-[28px] font-black tracking-[-0.04em] text-slate-950">{title}</h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-500">{description}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                    'Browse the layout and navigation.',
                    'Inspect the information architecture.',
                    'Unlock actions with a valid Horizon invite code.',
                ].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[13px] font-medium text-slate-600">
                        {item}
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const HorizonStandalone = () => {
    const [session, setSession] = useState(() => {
        const storedSession = getStoredHorizonSession();
        if (storedSession?.mode === 'authenticated' && storedSession.user && localStorage.getItem('auth_token')) {
            return {
                mode: 'authenticated',
                code: storedSession.code || null,
                user: storedSession.user,
            };
        }
        if (storedSession?.mode === 'preview') {
            return {
                mode: 'preview',
                code: null,
                user: HORIZON_PREVIEW_USER,
            };
        }
        return {
            mode: 'locked',
            code: null,
            user: null,
        };
    });
    const [themeMode, setThemeMode] = useState(() => getInitialThemeMode());

    useEffect(() => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, themeMode);
        } catch (_) {
            // Ignore storage write failures and keep the in-memory preference.
        }
    }, [themeMode]);

    const handleToggleThemeMode = () => {
        setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    const handleAuthenticated = ({ token, user, code }) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_profile', JSON.stringify(user));
        localStorage.removeItem('horizon_allow_dev_token');
        persistHorizonSession({ mode: 'authenticated', user, code });
        setSession({ mode: 'authenticated', code: code || null, user });
    };

    const handlePreview = () => {
        clearHorizonSession();
        persistHorizonSession({ mode: 'preview', user: HORIZON_PREVIEW_USER, code: null });
        setSession({ mode: 'preview', code: null, user: HORIZON_PREVIEW_USER });
    };

    const handleUserUpdated = (nextUser) => {
        setSession((prev) => {
            if (!prev?.user) return prev;
            const mergedUser = { ...prev.user, ...nextUser };
            localStorage.setItem('user_profile', JSON.stringify(mergedUser));
            persistHorizonSession({ mode: prev.mode, user: mergedUser, code: prev.code || null });
            return { ...prev, user: mergedUser };
        });
    };

    const handleLogout = () => {
        clearHorizonSession();
        setSession({ mode: 'locked', code: null, user: null });
    };

    const isDarkMode = themeMode === 'dark';
    const horizonRootClass = [
        session.mode !== 'locked' ? 'horizon-theme-frost' : '',
        isDarkMode ? 'horizon-theme-dark' : '',
    ].filter(Boolean).join(' ');
    const appView = session.mode === 'locked' ? (
        <>
            <HorizonAccessPortal
                onAuthenticated={handleAuthenticated}
                onPreview={handlePreview}
            />
            <ThemeModeToggle
                isDarkMode={isDarkMode}
                onToggle={handleToggleThemeMode}
            />
        </>
    ) : (
        <GlobalErrorBoundary>
            <HorizonDashboard
                user={session.user}
                onLogout={handleLogout}
                isPreviewMode={session.mode === 'preview'}
                onUserUpdated={handleUserUpdated}
                isDarkMode={isDarkMode}
                onToggleThemeMode={handleToggleThemeMode}
            />
        </GlobalErrorBoundary>
    );

    return (
        <div className={horizonRootClass}>
            {appView}
        </div>
    );
};

const HorizonDashboard = ({ user, onLogout, isPreviewMode = false, onUserUpdated, isDarkMode, onToggleThemeMode }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('workspaces');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [workspaceLaunchTab, setWorkspaceLaunchTab] = useState('connectors');
    const [workspaceLaunchDocSlug, setWorkspaceLaunchDocSlug] = useState('');
    const [newWsName, setNewWsName] = useState('');
    const [newWsDesc, setNewWsDesc] = useState('');
    const [newWsVertical, setNewWsVertical] = useState('generic');
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(null);
    const [lastFetchError, setLastFetchError] = useState(null);

    const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'ok' | 'down' | 'auth'
    const latestWorkspaceFetchRef = useRef(0);

    // Load workspaces on mount. The first load uses a resilient timeout/retry
    // profile so slow backend warmups do not leave the workspace panel empty.
    useEffect(() => {
        if (isPreviewMode) {
            setWorkspaces([HORIZON_PREVIEW_WORKSPACE]);
            setIsLoading(false);
            setBackendStatus('ok');
            setLastFetchError(null);
            return;
        }
        fetchWorkspaces({ isInitial: true });
    }, [isPreviewMode, user?.id]);

    // Silent background auto-retry every 10s when service is unreachable
    useEffect(() => {
        if (isPreviewMode) return;
        if (backendStatus !== 'down') return;
        const interval = setInterval(() => {
            fetchWorkspaces({ isInitial: false, silent: true });
        }, 10000);
        return () => clearInterval(interval);
    }, [backendStatus, isPreviewMode, user?.id]);

    const fetchWorkspaces = async ({ isInitial = false, silent = false } = {}) => {
        if (isPreviewMode) {
            setWorkspaces([HORIZON_PREVIEW_WORKSPACE]);
            setBackendStatus('ok');
            setLastFetchError(null);
            if (!silent) setIsLoading(false);
            return;
        }
        const requestId = silent
            ? latestWorkspaceFetchRef.current
            : latestWorkspaceFetchRef.current + 1;
        if (!silent) {
            latestWorkspaceFetchRef.current = requestId;
        }
        if (!silent) setIsLoading(true);
        setError(null);
        if (!user?.id) {
            if (!silent) setIsLoading(false);
            return;
        }
        try {
            const res = await apiFetch(
                `${API_BASE}/api/workspaces`,
                {},
                isInitial ? { retries: 2, timeoutMs: 12000 } : { retries: 2, timeoutMs: 10000 }
            );
            if (!silent && requestId !== latestWorkspaceFetchRef.current) return;
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    setBackendStatus('auth');
                    setWorkspaces([]);
                    setLastFetchError(`HTTP ${res.status}: authorization required`);
                    setError('Session expired. Please sign in again.');
                    return;
                }
                const errText = await res.text().catch(() => 'No detail');
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }
            const data = await res.json();
            setWorkspaces(data.workspaces || []);
            setBackendStatus('ok');
            setLastFetchError(null);
        } catch (err) {
            if (!silent && requestId !== latestWorkspaceFetchRef.current) return;
            console.error("Workspace fetch failed:", err);
            setBackendStatus('down');
            setLastFetchError(err.message);
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    };


    const handleCreateWorkspace = async () => {
        if (isPreviewMode) {
            setError('Preview mode is read-only. Sign in with an access code to create workspaces.');
            return;
        }
        if (!newWsName.trim()) return;
        setIsCreating(true);
        setError(null);
        try {
            const res = await apiFetch(`${API_BASE}/api/workspaces`, {
                method: 'POST',
                body: JSON.stringify({
                    name: newWsName,
                    description: newWsDesc,
                    vertical: newWsVertical,
                    user_id: user.id
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                await fetchWorkspaces();
                setShowCreateForm(false);
                setNewWsName('');
                setNewWsDesc('');
            } else {
                setError(data.detail || 'Could not create workspace. Please try again.');
            }
        } catch (_) {
            setError('Service is temporarily unavailable. Please try again in a moment.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteWorkspace = async (e, workspaceId) => {
        e.stopPropagation(); // prevent activating the workspace
        if (isPreviewMode) {
            setError('Preview mode is read-only. Workspace changes are disabled until you sign in.');
            return;
        }
        if (!window.confirm("Are you sure you want to delete this workspace and all its data?")) return;
        
        setIsDeleting(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/workspaces/${workspaceId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.status === 'success') {
                await fetchWorkspaces();
            } else {
                setError(data.detail || 'Failed to delete workspace.');
            }
        } catch (_) {
             setError('Service is temporarily unavailable. Please try again in a moment.');
        } finally {
             setIsDeleting(false);
        }
    };

    const handleWorkspaceUpdated = (nextWorkspace) => {
        if (!nextWorkspace?.id) return;
        setWorkspaces((prev) => prev.map((ws) => (ws.id === nextWorkspace.id ? { ...ws, ...nextWorkspace } : ws)));
        setActiveWorkspace((prev) => (prev?.id === nextWorkspace.id ? { ...prev, ...nextWorkspace } : prev));
    };

    const openWorkspace = (targetWorkspace, initialTab = 'connectors', options = {}) => {
        if (!targetWorkspace) return;
        setWorkspaceLaunchTab(initialTab);
        setWorkspaceLaunchDocSlug(options.docSlug || '');
        setActiveWorkspace(targetWorkspace);
        setActiveTab('workspaces');
    };

    const handleOpenSettings = () => {
        const targetWorkspace = workspaces[0] || (isPreviewMode ? HORIZON_PREVIEW_WORKSPACE : null);
        if (targetWorkspace) {
            openWorkspace(targetWorkspace, 'settings');
            return;
        }
        setActiveTab('workspaces');
        setError('Create a workspace first to configure production settings.');
        setShowCreateForm(true);
    };

    const handleOpenSupport = () => {
        setActiveTab('support');
    };

    const handleOpenDocs = (docSlug = '') => {
        const targetWorkspace = workspaces[0] || (isPreviewMode ? HORIZON_PREVIEW_WORKSPACE : null);
        if (targetWorkspace) {
            openWorkspace(targetWorkspace, 'docs', { docSlug });
            return;
        }
        setActiveTab('workspaces');
        setError('Create a workspace first to browse documentation.');
        setShowCreateForm(true);
    };

    if (activeWorkspace) {
        return (
            <AnalysisFlow 
                user={user} 
                workspace={activeWorkspace} 
                onBack={() => {
                    setActiveWorkspace(null);
                    setWorkspaceLaunchTab('connectors');
                    setWorkspaceLaunchDocSlug('');
                }} 
                isPreviewMode={isPreviewMode}
                onUserUpdated={onUserUpdated}
                onWorkspaceUpdated={handleWorkspaceUpdated}
                initialSidebarTab={workspaceLaunchTab}
                initialDocSlug={workspaceLaunchDocSlug}
            />
        );
    }

    if (activeTab === 'feedback-crm') {
        if (isPreviewMode) {
            return (
                <ResolutionAdaptiveShell className="horizon-shell-bg">
                    <div className="horizon-shell-bg h-full text-[#0f172a] font-sans selection:bg-indigo-500/20 overflow-hidden">
                        <div className="p-8">
                            <PreviewStatusBanner compact message="CRM workflows stay locked in preview. Sign in with an access code to import feedback, generate responses, and work inside the live CRM." />
                        </div>
                        <PreviewReadOnlyPanel
                            title="Feedback CRM preview"
                            description="Preview visitors can inspect the workspace shell, but CRM ingestion, response drafting, and issue management remain disabled until authentication is completed."
                            accent="rose"
                        />
                    </div>
                </ResolutionAdaptiveShell>
            );
        }
        return (
            <ResolutionAdaptiveShell className="horizon-shell-bg">
                <div className="horizon-shell-bg h-full text-[#0f172a] font-sans selection:bg-indigo-500/20 overflow-hidden">
                    <FeedbackCRM
                        user={user}
                        onBack={() => setActiveTab('workspaces')}
                    />
                </div>
            </ResolutionAdaptiveShell>
        );
    }

    const VERTICAL_OPTIONS = [
        { value: 'generic', label: 'General', desc: 'Multi-purpose analysis' },
        { value: 'saas', label: 'SaaS', desc: 'Software as a Service' },
        { value: 'ecommerce', label: 'E-Commerce', desc: 'Online retail & marketplace' },
        { value: 'subscription', label: 'Subscription', desc: 'Recurring billing products' },
        { value: 'fintech', label: 'Fintech', desc: 'Financial services & banking' },
        { value: 'healthcare', label: 'Healthcare', desc: 'Health & wellness products' },
    ];

    return (
        <ResolutionAdaptiveShell className="horizon-shell-bg">
        <div className="horizon-shell-bg flex h-full text-[#0f172a] font-sans selection:bg-indigo-500/20 overflow-hidden">
            {/* Sidebar */}
            <div className="w-[272px] bg-white border-r border-slate-200/80 flex flex-col z-20 relative shrink-0">
                {/* Logo Area */}
                <div className="px-5 py-5 border-b border-slate-100">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="group flex w-full items-center justify-between gap-4 rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(243,248,255,0.9))] px-4 py-3.5 text-left shadow-[0_18px_34px_-28px_rgba(15,23,42,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-200/80 hover:shadow-[0_22px_44px_-28px_rgba(14,116,144,0.26)]"
                    >
                        <div className="min-w-0 flex-1">
                            <span className="block text-[19px] font-semibold tracking-[-0.04em] text-slate-950 leading-none">
                                Horizon
                            </span>
                            <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                                Feedback Intelligence
                            </span>
                        </div>

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-400 transition-colors duration-300 group-hover:border-cyan-200 group-hover:text-cyan-700">
                            <ArrowLeft size={14} />
                        </div>
                    </button>
                </div>

                {/* Main Navigation */}
                <div className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5 custom-scrollbar">
                    <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Platform</p>
                    {[
                        { id: 'workspaces', label: 'Workspaces', icon: LayoutDashboard, color: 'indigo' },
                        { id: 'feedback-crm', label: 'Feedback CRM', icon: Target, color: 'rose' },
                        { id: 'profiles', label: 'Customer Profiles', icon: Users, color: 'emerald' },
                        { id: 'surveys', label: 'Surveys', icon: ClipboardList, color: 'violet' },
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                                activeTab === item.id 
                                    ? `bg-${item.color}-50 text-${item.color}-700 font-semibold shadow-sm border border-${item.color}-100` 
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                            }`}
                        >
                            <item.icon size={17} className={activeTab === item.id ? `text-${item.color}-600` : 'text-slate-400'} />
                            {item.label}
                        </button>
                    ))}

                    {workspaces.length > 0 && (
                        <div className="pt-6 pb-2">
                            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Recent Workspaces</p>
                            <div className="space-y-0.5">
                                {workspaces.slice(0, 5).map(ws => (
                                    <button 
                                        key={ws.id}
                                        onClick={() => openWorkspace(ws)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all text-slate-500 hover:bg-slate-50 hover:text-indigo-600 group"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors shrink-0"></div>
                                        <span className="truncate">{ws.name}</span>
                                        <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-400 transition-colors ml-auto shrink-0 opacity-0 group-hover:opacity-100" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Profile Area */}
                <div className="p-3 border-t border-slate-100 space-y-0.5">
                    <button onClick={handleOpenSettings} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800">
                        <Settings size={15} className="text-slate-400" />
                        Settings
                    </button>
                    <button onClick={handleOpenSupport} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${activeTab === 'support' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'}`}>
                        <HelpCircle size={15} className="text-slate-400" />
                        Help & Support
                    </button>
                    <div className="pt-2">
                        <ThemeModeToggle
                            isDarkMode={isDarkMode}
                            onToggle={onToggleThemeMode}
                            inline
                        />
                    </div>
                    <div className="h-px bg-slate-100 my-1.5"></div>
                    <div className="px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm">
                                {user.name.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[12px] font-semibold text-slate-800 leading-tight">{user.name}</span>
                                <span className="text-[10px] text-slate-400">{user.contactEmail || user.email}</span>
                            </div>
                        </div>
                        <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 hover:bg-rose-50 rounded-lg" title="Log Out">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {activeTab === 'support' ? (
                    <HelpSupport
                        onBrowseDocs={() => handleOpenDocs('getting-started-guide')}
                        onOpenResource={(slug) => handleOpenDocs(slug)}
                        docsEnabled={Boolean(workspaces[0] || isPreviewMode)}
                    />
                ) : activeTab === 'profiles' && isPreviewMode ? (
                    <PreviewReadOnlyPanel
                        title="Customer profiles preview"
                        description="The live customer profile graph, transcript aggregation, and relationship tracking remain disabled in preview mode."
                        accent="emerald"
                    />
                ) : activeTab === 'profiles' ? (
                    <CustomerProfilesView user={user} />
                ) : activeTab === 'surveys' && isPreviewMode ? (
                    <PreviewReadOnlyPanel
                        title="Survey studio preview"
                        description="You can browse Horizon first, then activate an access code to build surveys, publish links, and collect real responses."
                        accent="violet"
                    />
                ) : activeTab === 'surveys' ? (
                    <SurveyBuilder user={user} />
                ) : (
                    <>
                        {/* Header Strip */}
                        <div className="h-14 border-b border-slate-200/80 bg-white flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-1.5 text-[13px] text-slate-400 font-medium">
                                    <span className="hover:text-slate-700 cursor-pointer transition-colors">Horizon</span>
                                    <ChevronRight size={12} />
                                    <span className="text-slate-800 font-semibold">Workspaces</span>
                                </div>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" placeholder="Search workspaces..." className="w-56 pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-all placeholder:text-slate-400" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
                                    <Bell size={17} />
                                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full"></div>
                                </button>
                                <button
                                    onClick={() => setShowCreateForm(true)}
                                    disabled={isPreviewMode}
                                    className={`px-4 py-2 rounded-lg text-[13px] font-semibold shadow-sm shadow-indigo-600/15 transition-all flex items-center gap-2 ${
                                        isPreviewMode
                                            ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                                    }`}
                                >
                                    <Plus size={15} />
                                    {isPreviewMode ? 'Preview Only' : 'New Workspace'}
                                </button>
                            </div>
                        </div>

                        {/* Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-6xl mx-auto">
                                {isPreviewMode && (
                                    <div className="mb-6">
                                        <PreviewStatusBanner />
                                    </div>
                                )}
                                
                                <div className="mb-8">
                                    <h1 className="text-[22px] font-bold text-slate-900 mb-1 tracking-tight">Workspaces</h1>
                                    <p className="text-slate-500 text-[13px]">Manage your analysis environments and data connections.</p>
                                </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200/60 text-rose-600 text-[13px] flex items-center gap-3 animate-shake">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {[1,2,3].map(i => (
                                    <div key={i} className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden h-[260px]">
                                        <div className="h-1.5 skeleton-shimmer"></div>
                                        <div className="p-6 space-y-4">
                                            <div className="w-10 h-10 rounded-xl skeleton-shimmer"></div>
                                            <div className="w-3/4 h-4 rounded skeleton-shimmer"></div>
                                            <div className="w-full h-3 rounded skeleton-shimmer"></div>
                                            <div className="w-2/3 h-3 rounded skeleton-shimmer"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : backendStatus === 'auth' ? (
                            <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-slate-200 bg-white">
                                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5">
                                    <User size={28} className="text-blue-500" />
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">Sign In Required</h3>
                                <p className="text-[14px] font-medium text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed text-center">
                                    Your session is not valid anymore. Sign in again to load workspaces.
                                </p>
                                <button
                                    onClick={onLogout}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center gap-2"
                                >
                                    <LogOut size={14} />
                                    Go To Sign In
                                </button>
                            </div>
                        ) : backendStatus === 'down' ? (
                            <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-slate-200 bg-white">
                                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
                                    <AlertCircle size={28} className="text-amber-400" />
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">Service Unavailable</h3>
                                    <p className="text-[14px] font-medium text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
                                        We're having trouble connecting to the backend. This usually resolves in a few seconds.
                                    </p>
                                    
                                    {lastFetchError && (
                                        <div className="mb-6 p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/80 mb-1">Last Diagnostic Signal</p>
                                            <p className="text-[12px] font-mono text-rose-300 break-all">{lastFetchError}</p>
                                        </div>
                                    )}
                                <button
                                    onClick={() => fetchWorkspaces({ isInitial: true })}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center gap-2"
                                >
                                    <RefreshCw size={14} />
                                    Retry Connection
                                </button>
                                <div className="flex items-center gap-2 mt-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
                                    <p className="text-[11px] text-slate-400">Auto-retrying every 10 seconds</p>
                                </div>
                            </div>
                        ) : workspaces.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {workspaces.map((ws, idx) => {
                                    const gradients = [
                                        'from-indigo-500 to-blue-500', 'from-violet-500 to-purple-500',
                                        'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
                                        'from-amber-500 to-orange-500', 'from-cyan-500 to-sky-500',
                                    ];
                                    const gradient = gradients[idx % gradients.length];
                                    return (
                                        <motion.div 
                                            key={ws.id} 
                                            whileHover={{ y: -3 }}
                                            onClick={() => openWorkspace(ws)}
                                            className="group relative bg-white border border-slate-200/60 rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:border-slate-300/80 overflow-hidden flex flex-col"
                                        >
                                            {/* Gradient accent bar */}
                                            <div className={`h-1.5 bg-gradient-to-r ${gradient} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                                            
                                            <div className="p-5 flex flex-col flex-1">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} bg-opacity-10 flex items-center justify-center shadow-sm`}>
                                                        <Database size={18} className="text-white" />
                                                    </div>
                                                    <button 
                                                        onClick={(e) => handleDeleteWorkspace(e, ws.id)}
                                                        disabled={isDeleting || isPreviewMode}
                                                        className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                                                            isPreviewMode
                                                                ? 'cursor-not-allowed text-slate-300'
                                                                : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'
                                                        }`}
                                                        title="Delete Workspace"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                
                                                <h3 className="text-[15px] font-semibold text-slate-900 mb-1.5 line-clamp-1 group-hover:text-indigo-600 transition-colors">{ws.name}</h3>
                                                <p className="text-[12px] text-slate-500 line-clamp-2 mb-4 flex-1 leading-relaxed">
                                                    {ws.description || 'No description provided.'}
                                                </p>
                                                
                                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider bg-slate-50 px-2 py-0.5 rounded">{ws.vertical || 'Generic'}</span>
                                                        <span className="text-[11px] font-medium text-slate-500">{ws.analyses_count || 0} analyses</span>
                                                    </div>
                                                    <div className="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-indigo-600 flex items-center justify-center transition-all text-slate-400 group-hover:text-white">
                                                        <ArrowRight size={13} />
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-24 rounded-2xl border border-dashed border-slate-200 bg-white">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
                                    <Sparkles size={26} className="text-indigo-400" />
                                </div>
                                <h3 className="text-base font-bold mb-1.5 text-slate-900">Create your first workspace</h3>
                                <p className="text-slate-400 max-w-sm mx-auto mb-6 text-[13px]">
                                    Workspaces help you organize data sources and run independent analyses for different products or teams.
                                </p>
                                <button 
                                    onClick={() => setShowCreateForm(true)}
                                    disabled={isPreviewMode}
                                    className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all shadow-sm flex items-center gap-2 mx-auto ${
                                        isPreviewMode
                                            ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                                >
                                    <Plus size={15} />
                                    {isPreviewMode ? 'Preview Only' : 'New Workspace'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                </>
            )}
            </div>

            {/* Create Workspace Modal */}
            <AnimatePresence>
                {showCreateForm && !isPreviewMode && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateForm(false)}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.96, opacity: 0, y: 8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white border border-slate-200/80 rounded-2xl p-0 w-full max-w-lg relative z-10 shadow-float overflow-hidden"
                        >
                            {/* Modal header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                        <Plus size={16} className="text-indigo-600" />
                                    </div>
                                    <h2 className="text-[15px] font-semibold text-slate-900">Create Workspace</h2>
                                </div>
                                <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-1.5 rounded-lg transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Workspace Name <span className="text-rose-500">*</span></label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        value={newWsName}
                                        onChange={(e) => setNewWsName(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all text-slate-800 text-[13px] placeholder:text-slate-400"
                                        placeholder="e.g. Q4 Product Feedback"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Description</label>
                                    <textarea 
                                        value={newWsDesc}
                                        onChange={(e) => setNewWsDesc(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all text-slate-800 text-[13px] min-h-[80px] resize-none placeholder:text-slate-400"
                                        placeholder="Optional context for this workspace..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Industry Vertical</label>
                                    <select
                                        value={newWsVertical}
                                        onChange={(e) => setNewWsVertical(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all text-slate-800 text-[13px] cursor-pointer"
                                    >
                                        {VERTICAL_OPTIONS.map(v => (
                                            <option key={v.value} value={v.value}>{v.label} — {v.desc}</option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-400 mt-1.5">Optimizes analysis prompts and domain keywords for your industry.</p>
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-3">
                                    <button 
                                        onClick={() => setShowCreateForm(false)}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        disabled={isCreating}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleCreateWorkspace}
                                        disabled={isCreating || !newWsName.trim()}
                                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isCreating ? <Loader2 size={16} className="animate-spin" /> : null}
                                        {isCreating ? 'Creating...' : 'Create Workspace'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
        </ResolutionAdaptiveShell>
    );
};

const AnalysisFlow = ({ user, workspace, onBack, isPreviewMode = false, onUserUpdated, onWorkspaceUpdated, initialSidebarTab = 'connectors', initialDocSlug = '' }) => {
    const [sidebarTab, setSidebarTab] = useState(initialSidebarTab);
    const [currentStep, setCurrentStep] = useState(0); // 0=idle, 3=analyzing, 4=results
    
    // Step 1: Connectors
    const [activeNodes, setActiveNodes] = useState([]);
    const [isFetchingNodes, setIsFetchingNodes] = useState(false);
    const [configuringConnector, setConfiguringConnector] = useState(null);
    const [syncStats, setSyncStats] = useState({ added: 0, skipped: 0 });
    const [error, setError] = useState(null);
    const [tempFile, setTempFile] = useState(null); // Mock file storage for CSV
    // CSV column mapping state
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvColumnMap, setCsvColumnMap] = useState({ content: '', score: '', date: '', author: '' });
    const [csvFiles, setCsvFiles] = useState({}); // { [filename]: File } — persists File objects for sync
    
    // Step 2: Calibration
    const [previewReviews, setPreviewReviews] = useState([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [filters, setFilters] = useState({
        rating: [1, 2, 3, 4, 5],
        dateRange: 'all',
        limit: 100
    });
    const [arpu, setArpu] = useState('');
    const [countRange, setCountRange] = useState([1, 1]);
    const [ratingFilter, setRatingFilter] = useState([1, 2, 3, 4, 5]);
    const [sourceFilter, setSourceFilter] = useState([]); // which sources to include
    const [cleaningOptions, setCleaningOptions] = useState({
        token_efficiency: true,  // dedup + boilerplate removal
        magic_clean: true,       // noise scoring via pattern_intelligence
        language_focus: false,   // English-only filter
        html_shield: true,       // strip HTML/markup artifacts
    });
    // derived from previewReviews/filters in calibration view
    const getFilteredReviews = () => {
        let reviews = previewReviews || [];
        if (sourceFilter.length > 0) reviews = reviews.filter(r => sourceFilter.includes(r.source));
        reviews = reviews.filter(r => ratingFilter.includes(Number(r.score)));
        if (cleaningOptions.removeShort) reviews = reviews.filter(r => (r.content || '').length >= 10);
        if (cleaningOptions.removeDuplicates) {
            const seen = new Set();
            reviews = reviews.filter(r => { const key = (r.content || '').trim().toLowerCase().slice(0, 80); if (seen.has(key)) return false; seen.add(key); return true; });
        }
        if (cleaningOptions.nonEnglishFilter) reviews = reviews.filter(r => { const t = r.content || ''; if (!t) return false; const ascii = t.split('').filter(c => c.charCodeAt(0) < 128).length; return ascii / Math.max(t.length, 1) > 0.75; });
        // apply count range
        const totalInWindow = Math.max(1, reviews.length);
        const from = Math.max(1, Math.min(Number(countRange?.[0]) || 1, totalInWindow));
        const to = Math.max(from, Math.min(Number(countRange?.[1]) || totalInWindow, totalInWindow));
        reviews = reviews.slice(from - 1, to);
        return reviews;
    };
    
    // Step 4: Results
    const [results, setResults] = useState(null);
    
    // Analysis State
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [resultsTab, setResultsTab] = useState('overview'); // overview, predictive, competitive, causal, trust, history, chat
    const [advancedData, setAdvancedData] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState('');
    const [analysisLog, setAnalysisLog] = useState([]);
    const [processedReviews, setProcessedReviews] = useState(0);
    const [totalReviewsForTask, setTotalReviewsForTask] = useState(0);
    const [inFlightReviews, setInFlightReviews] = useState(0);
    const [taskId, setTaskId] = useState(null); // Added taskId state
    const [isPaused, setIsPaused] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const [isAnalysisOverlayOpen, setIsAnalysisOverlayOpen] = useState(false);
    const [connectorConfigs, setConnectorConfigs] = useState({}); // Stores per-connector config
    const [selectedConnectors, setSelectedConnectors] = useState([]); // Tracks selected connector types
    const pollTimerRef = useRef(null);
    const activePollingTaskRef = useRef(null);

    useEffect(() => {
        if (!isPreviewMode) return;

        setActiveNodes(HORIZON_PREVIEW_CONNECTORS);
        setPreviewReviews(HORIZON_PREVIEW_REVIEWS);
        setCountRange([1, Math.max(1, HORIZON_PREVIEW_REVIEWS.length)]);
        setSyncStats({ added: HORIZON_PREVIEW_REVIEWS.length, skipped: 0 });
        setIsFetchingNodes(false);
        setError(null);
    }, [isPreviewMode, workspace?.id]);

    useEffect(() => {
        setSidebarTab(initialSidebarTab || 'connectors');
    }, [initialSidebarTab, workspace?.id]);

    const clearTaskPollTimer = () => {
        if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    const resetAnalysisRuntimeState = () => {
        clearTaskPollTimer();
        activePollingTaskRef.current = null;
        setResults(null);
        setTaskId(null);
        setAnalysisProgress(0);
        setAnalysisStatus('');
        setAnalysisLog([]);
        setProcessedReviews(0);
        setTotalReviewsForTask(0);
        setInFlightReviews(0);
        setIsPaused(false);
        setIsStopped(false);
        setIsAnalysisOverlayOpen(false);
    };

    const handleNewScan = () => {
        resetAnalysisRuntimeState();
        setResultsTab('overview');
        setCurrentStep(0);
        setSidebarTab('connectors');
        setError(null);
    };

    useEffect(() => {
        return () => {
            clearTaskPollTimer();
            activePollingTaskRef.current = null;
        };
    }, []);

    // Fetch workspace connectors on load
    useEffect(() => {
        if (isPreviewMode) return;
        if (workspace?.id) {
            fetchWorkspaceConnectors();
        }
    }, [isPreviewMode, workspace?.id]);

    const fetchWorkspaceConnectors = async () => {
        if (isPreviewMode) {
            setActiveNodes(HORIZON_PREVIEW_CONNECTORS);
            setIsFetchingNodes(false);
            return;
        }
        setIsFetchingNodes(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/user/connectors?workspace_id=${workspace.id}`);
            if (res.ok) {
                const data = await res.json();
                setActiveNodes(data.connectors || []);
            }
        } catch (err) {
            console.error("Failed to fetch connectors:", err);
            setError("Failed to load active data sources.");
        } finally {
            setIsFetchingNodes(false);
        }
    };

    // Parse CSV headers from a File object and auto-guess column roles
    const parseCsvHeaders = (file) => {
        if (!file) return;
        const name = (file.name || '').toLowerCase();

        // Excel files can't be parsed as text — mark them for auto-detection
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            setCsvHeaders(['__EXCEL__']);
            setCsvColumnMap({ content: '__EXCEL__', score: '', date: '', author: '' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const firstLine = text.split('\n')[0] || '';
                // Handle both comma and semicolon delimited
                const delimiter = firstLine.includes(';') ? ';' : ',';
                const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean);
                if (headers.length === 0) {
                    setCsvHeaders([]);
                    return;
                }
                setCsvHeaders(headers);

                // Auto-guess column roles
                const guess = { content: '', score: '', date: '', author: '' };
                headers.forEach(h => {
                    const hl = h.toLowerCase();
                    if (!guess.content && /review|feedback|comment|text|body|message|content/.test(hl)) guess.content = h;
                    else if (!guess.score && /score|rating|stars|rating_value|review_rating/.test(hl)) guess.score = h;
                    else if (!guess.date && /date|timestamp|created|submitted|posted|at$/.test(hl)) guess.date = h;
                    else if (!guess.author && /author|user|reviewer|name|username/.test(hl)) guess.author = h;
                });
                setCsvColumnMap(guess);
            } catch {
                setCsvHeaders([]);
            }
        };
        reader.readAsText(file.slice(0, 16384)); // read first 16KB for header extraction
    };

    const handleRemoveNode = async (connectorId) => {
        if (isPreviewMode) {
            setError('Preview mode is read-only. Connector changes are disabled until you sign in.');
            return;
        }
        try {
            const res = await apiFetch(`${API_BASE}/api/user/connectors/${connectorId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchWorkspaceConnectors();
            }
        } catch (err) {
            console.error("Failed to remove connector:", err);
            setError("Removal failed.");
        }
    };

    const handleEnableConnector = async (type, identifier, name, config, options = {}) => {
        if (isPreviewMode) {
            setError('Preview mode is read-only. Sign in with an access code to save connectors.');
            return;
        }
        try {
            const res = await apiFetch(`${API_BASE}/api/user/connectors`, {
                method: 'POST',
                body: JSON.stringify({
                    connector_type: type,
                    identifier: identifier,
                    name: name || `${type.charAt(0).toUpperCase() + type.slice(1)}: ${identifier}`,
                    config: config,
                    workspace_id: workspace.id,
                    fetch_interval: options.fetchInterval,
                    analysis_interval: options.analysisInterval,
                    max_reviews: options.maxReviews,
                })
            });
            if (res.ok) {
                fetchWorkspaceConnectors();
                setConfiguringConnector(null);
                setTempFile(null);
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to save connector.");
            }
        } catch (err) {
            console.error("Failed to enable connector:", err);
            setError("Connection failed.");
        }
    };

    // Fetch advanced diagnostics when results are ready
    useEffect(() => {
        if (isPreviewMode) return;
        if (currentStep === 4 && results?.id) { // Changed appPhase to currentStep
            fetchAdvancedData(results.id);
        }
    }, [currentStep, isPreviewMode, results?.id]); // Changed appPhase to currentStep

    const fetchAdvancedData = async (analysisId) => {
        if (isPreviewMode) return;
        try {
            // Assuming API_BASE is defined globally or passed as prop
            const res = await apiFetch(`${API_BASE}/api/analytics/advanced/${analysisId}`); // Using apiFetch
            if (res.ok) {
                const data = await res.json();
                setAdvancedData(data);
            }
        } catch (err) {
            console.error("Failed to fetch advanced intelligence data:", err);
        }
    };

    const handleExport = async () => {
        if (isPreviewMode) {
            setError('Preview mode cannot export analysis packages. Sign in with an access code to unlock exports.');
            return;
        }
        if (!results?.id) return;
        setIsExporting(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/analytics/export/${results.id}?format=zip`, { // Using apiFetch
                responseType: 'blob' // Indicate that the response is a blob
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Horizon_Analysis_Export_${results.id}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                console.error("Export failed with status:", res.status);
            }
        } catch (err) {
            console.error("Export failed:", err);
        } finally {
            setIsExporting(false);
        }
    };

    const pollTaskStatus = async (tid) => {
        if (!tid) return;
        if (activePollingTaskRef.current && activePollingTaskRef.current !== tid) {
            return;
        }
        activePollingTaskRef.current = tid;

        try {
            const res = await apiFetch(
                `${API_BASE}/task/${tid}?_=${Date.now()}`,
                {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache',
                    },
                },
                { retries: 0, timeoutMs: 10000 }
            );
            if (!res.ok) {
                if (res.status === 404) {
                    setAnalysisStatus('Waiting for analysis worker...');
                }
                clearTaskPollTimer();
                pollTimerRef.current = setTimeout(() => pollTaskStatus(tid), 1500);
                return;
            }
            const data = await res.json();
            const runningStatuses = new Set(['initializing', 'fetching', 'analyzing', 'calculating', 'finalizing', 'paused', 'stopping']);
            const isRunning = runningStatuses.has(data.status);
            const totalCount = Number(data.total_reviews) || 0;
            const processedCount = Number(data.processed_reviews) || 0;
            const rawInFlight = data.in_flight_reviews;
            const pendingCount = Math.max(
                0,
                rawInFlight === null || rawInFlight === undefined || rawInFlight === ''
                    ? (totalCount > 0 ? totalCount - processedCount : 0)
                    : (Number(rawInFlight) || 0)
            );
             
            setAnalysisProgress(data.progress || 0);
            setAnalysisStatus(data.message || 'Processing...');
            if (data.log) setAnalysisLog(data.log);
            setProcessedReviews(processedCount);
            setTotalReviewsForTask(totalCount);
            setInFlightReviews(pendingCount);
            if (isRunning && (Number(data.progress) || 0) <= 25) {
                setIsAnalysisOverlayOpen(true);
            }

            if (data.status === 'paused') {
                setIsPaused(true);
            } else if (data.status === 'analyzing' || data.status === 'initializing' || data.status === 'fetching' || data.status === 'calculating' || data.status === 'finalizing') {
                setIsPaused(false);
            }

            if (data.status === 'completed') {
                console.log("[DIAG] Analysis completed. Results payload:", data.analytics);
                const hardened = hardenResults(data.analytics);
                setResults({ ...hardened, id: data.id });
                clearTaskPollTimer();
                activePollingTaskRef.current = null;
                setAnalysisProgress(100);
                setResultsTab('overview');
                setIsAnalysisOverlayOpen(false);
                setCurrentStep(4);
                setIsPaused(false);
                setIsStopped(false);
                setInFlightReviews(0);
            } else if (data.status === 'failed') {
                console.error("[DIAG] Analysis failed:", data.message);
                setAnalysisStatus('Neural Processing Failed');
                clearTaskPollTimer();
                activePollingTaskRef.current = null;
                setIsPaused(false);
                setIsStopped(false);
                setInFlightReviews(0);
            } else if (data.status === 'cancelled' || data.status === 'stopping') {
                 // If stopped, we might want to wait for it to be 'cancelled' and then show partial results 
                 // and transition to inactive. The requirement says "result until that moment should be shown"
                 if (data.status === 'cancelled') {
                    setAnalysisStatus('Analysis Detached');
                    clearTaskPollTimer();
                    activePollingTaskRef.current = null;
                    setInFlightReviews(0);
                    // If backend saved partial results, we could fetch them here. 
                    // For now, let's just allow user to go back or see what we have.
                 } else {
                     clearTaskPollTimer();
                     pollTimerRef.current = setTimeout(() => pollTaskStatus(tid), 1000);
                  }
            } else {
                // Keep polling until terminal status.
                clearTaskPollTimer();
                pollTimerRef.current = setTimeout(() => pollTaskStatus(tid), 1000);
            }
        } catch (err) {
            console.error('Polling error:', err);
            clearTaskPollTimer();
            pollTimerRef.current = setTimeout(() => pollTaskStatus(tid), 1500);
        }
    };

    const handleTaskControl = async (action) => {
        if (isPreviewMode) {
            setError('Preview mode cannot control live analysis jobs.');
            return;
        }
        if (!taskId) return;
        try {
            const res = await apiFetch(`${API_BASE}/task/${taskId}/control`, {
                method: 'POST',
                body: JSON.stringify({ action })
            });
            if (res.ok) {
                if (action === 'pause') setIsPaused(true);
                if (action === 'resume') setIsPaused(false);
                if (action === 'stop') {
                    setIsStopped(true);
                    setAnalysisStatus('Stopping analysis...');
                }
            }
        } catch (err) {
            console.error(`Failed to ${action} task:`, err);
        }
    };

    const handleSyncNodes = async () => {
        if (isPreviewMode) {
            setSyncStats({ added: HORIZON_PREVIEW_REVIEWS.length, skipped: 0 });
            setPreviewReviews(HORIZON_PREVIEW_REVIEWS);
            setCurrentStep(2);
            setError(null);
            return;
        }
        if (activeNodes.length === 0) return;
        setIsLoadingPreview(true);
        setError(null);
        setSyncStats({ added: 0, skipped: 0 });
        try {
            let totalAdded = 0;
            let totalSkipped = 0;
            let combinedReviews = [];
            const errors = [];

            for (const node of activeNodes) {
                // ── CSV nodes use multipart upload directly ──
                if (node.connector_type === 'csv') {
                    const fileObj = csvFiles[node.identifier];
                    if (!fileObj) {
                        errors.push(`Re-select file "${node.identifier}" — CSV files must be re-uploaded each session.`);
                        continue;
                    }
                    const mapping = node.config?.columnMap || {};
                    const formData = new FormData();
                    formData.append('file', fileObj);
                    // Only append mapping if it's real (not the Excel sentinel '__EXCEL__')
                    if (mapping.content && mapping.content !== '__EXCEL__') formData.append('content_col', mapping.content);
                    if (mapping.score   && mapping.score   !== '__EXCEL__') formData.append('score_col',   mapping.score);
                    if (mapping.date    && mapping.date    !== '__EXCEL__') formData.append('date_col',    mapping.date);
                    if (mapping.author  && mapping.author  !== '__EXCEL__') formData.append('author_col',  mapping.author);
                    try {
                        const res = await fetch(`${API_BASE}/upload-csv`, { method: 'POST', body: formData });
                        let data;
                        try { data = await res.json(); } catch { data = {}; }
                        if (res.ok && data.reviews) {
                            combinedReviews = [...combinedReviews, ...data.reviews];
                            totalAdded += data.reviews.length;
                        } else {
                            const detail = data?.detail;
                            if (detail?.error_code === 'MISSING_COLUMNS') {
                                errors.push(`CSV column mapping issue: ${detail.message} Available: ${detail.available_columns?.join(', ')}`);
                            } else {
                                errors.push(typeof detail === 'string' ? detail : (data?.message || 'CSV upload failed.'));
                            }
                        }
                    } catch (csvErr) {
                        errors.push(`Failed to upload CSV "${node.identifier}": ${csvErr.message}`);
                    }
                    continue;
                }

                // ── Non-CSV nodes use preload ──
                try {
                    let res;
                    if (node.id) {
                        res = await apiFetch(`${API_BASE}/api/user/connectors/${node.id}/fetch`, {
                            method: 'POST',
                        }, { timeoutMs: 60000 });
                    } else {
                        const preloadBody = {
                            source_type:  node.connector_type,
                            identifier:   node.identifier,
                            country:      node.config?.country || 'us',
                            max_reviews:  Number(node.config?.count || node.config?.max_reviews || 200),
                            user_id:      user.id,
                            workspace_id: workspace.id,
                        config:       node.config || {},   // ← pass full config (tokens, URLs, auth, etc.)
                        };

                        res = await apiFetch(`${API_BASE}/api/source/preload`, {
                        method: 'POST',
                        body: JSON.stringify(preloadBody)
                    }, { timeoutMs: 60000 });
                    }
                    let data;
                    try { data = await res.json(); } catch { data = {}; }

                    if (res.ok && data.status === 'success') {
                        totalAdded   += data.added   || 0;
                        totalSkipped += data.skipped || 0;

                        if (Array.isArray(data.reviews) && data.reviews.length > 0) {
                            combinedReviews = [...combinedReviews, ...data.reviews];
                        } else {
                            const revRes  = await apiFetch(
                                `${API_BASE}/api/source/reviews?source_type=${node.connector_type}&identifier=${encodeURIComponent(node.identifier)}&workspace_id=${workspace.id}`
                            );
                            let revData;
                            try { revData = await revRes.json(); } catch { revData = {}; }
                            if (revData.reviews) {
                                combinedReviews = [...combinedReviews, ...revData.reviews];
                            }
                        }
                    } else {
                        errors.push(`${node.name || node.connector_type}: ${data.message || data.detail || 'Sync failed.'}`);
                    }
                } catch (nodeErr) {
                    errors.push(`${node.name || node.connector_type}: ${nodeErr.message}`);
                }
            }

            setSyncStats({ added: totalAdded, skipped: totalSkipped });
            setPreviewReviews(combinedReviews);
            setCountRange([1, Math.max(1, combinedReviews.length)]);

            if (errors.length > 0 && combinedReviews.length === 0) {
                setError(errors.join(' | '));
            } else if (errors.length > 0) {
                // Partial success — show warning but continue
                console.warn('Partial sync errors:', errors);
            }

            if (combinedReviews.length > 0) {
                setCurrentStep(2);
            } else if (errors.length === 0) {
                setError('No reviews found. Make sure your connectors have synced data, then try again.');
            }
        } catch (err) {
            console.warn('Sync error:', err.message);
            setError('Could not load review data. Please check that the backend is running and try again.');
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleStartAnalysis = async () => {
        if (isPreviewMode) {
            setError('Preview mode is read-only. Analysis starts after signing in with a valid access code.');
            return;
        }
        const filteredForAnalysis = getFilteredReviews();
        if (filteredForAnalysis.length === 0) {
            setError('No reviews match your current filters. Adjust filters before launching analysis.');
            return;
        }
        // Always start from a clean runtime state so overlay/task polling is visible for every new run.
        resetAnalysisRuntimeState();
        /* setCurrentStep(3); -> Removed for background processing */
        clearTaskPollTimer();
        activePollingTaskRef.current = null;
        setAnalysisProgress(5);
        setAnalysisStatus('Initializing Neural Pipeline...');
        setProcessedReviews(0);
        setTotalReviewsForTask(filteredForAnalysis.length);
        setInFlightReviews(0);
        setIsAnalysisOverlayOpen(true); /* Open the overlay immediately on start */

        // Build cleaning_mode from toggle selections
        const cleaning_mode = (cleaningOptions.token_efficiency || cleaningOptions.magic_clean) ? 'magic' : 'manual';
        const manual_filters_parts = [];
        if (cleaningOptions.language_focus) manual_filters_parts.push('english_only');
        if (cleaningOptions.html_shield) manual_filters_parts.push('strip_html');
        const manual_filters = manual_filters_parts.join(',');

        try {
            const res = await apiFetch(`${API_BASE}/process`, {
                method: 'POST',
                body: JSON.stringify({
                    reviews: filteredForAnalysis,
                    vertical: workspace.vertical || 'generic',
                    user_id: user.id,
                    arpu: arpu ? parseFloat(arpu) : 50.0,
                    cleaning_mode,
                    manual_filters,
                    nps_mode: false,
                })
            });
            let data;
            try { data = await res.json(); } catch { data = {}; }
            if (data.task_id) {
                setTaskId(data.task_id);
                activePollingTaskRef.current = data.task_id;
                pollTaskStatus(data.task_id);
            } else {
                setAnalysisStatus('Failed to start analysis: ' + (data.detail || data.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('Analysis trigger error:', err);
            setAnalysisStatus('Failed to trigger analysis: ' + err.message);
        }
    };

    // Analysis History state
    const [analysisHistory, setAnalysisHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [expandedConnector, setExpandedConnector] = useState(null);
    const [bulkSurveyMode, setBulkSurveyMode] = useState(false);

    const fetchAnalysisHistory = async () => {
        if (isPreviewMode) {
            setAnalysisHistory([]);
            setIsLoadingHistory(false);
            return;
        }
        setIsLoadingHistory(true);
        try {
            const res = await apiFetch(`${API_BASE}/api/history/${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setAnalysisHistory(data.analyses || []);
            }
        } catch (err) {
            console.error('Failed to fetch analysis history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (sidebarTab === 'history') {
            fetchAnalysisHistory();
        }
    }, [sidebarTab]);

    const CONNECTOR_CATALOG = [
        { id: 'appstore',     name: 'App Store',    desc: 'Fetch iOS app reviews',        icon: AppWindow,     img: logoAppStore,     placeholder: 'e.g. spotify',                 label: 'iOS App Name/ID',            hasCountry: true, hasLimit: true, hasInterval: true },
        { id: 'playstore',    name: 'Play Store',   desc: 'Fetch Android app reviews',     icon: Play,          img: logoPlayStore,    placeholder: 'e.g. com.spotify.music',       label: 'Android Package ID',         hasCountry: true, hasLimit: true, hasInterval: true },
        { id: 'trustpilot',   name: 'Trustpilot',  desc: 'Business review platform',      icon: Star,          img: null,             placeholder: 'e.g. apple.com',               label: 'Company Domain or URL',      hasLimit: true, hasInterval: true },
        { id: 'csv',          name: 'CSV File',     desc: 'Upload CSV or Excel data',      icon: FileJson,      img: logoCSV,          isFile: true,                                label: 'Upload Data Source' },
        { id: 'surveymonkey', name: 'SurveyMonkey', desc: 'Survey responses via API',      icon: Database,      img: logoSurveyMonkey, placeholder: 'e.g. 123456789',               label: 'Survey ID',                  hasToken: true, tokenLabel: 'Access Token (OAuth Bearer)', tokenPlaceholder: 'Paste your SurveyMonkey access token', hasInterval: true },
        { id: 'typeform',     name: 'Typeform',     desc: 'Form responses via API',        icon: LayoutDashboard, img: logoTypeform,  placeholder: 'e.g. aBc123Xy',               label: 'Form ID',                    hasToken: true, tokenLabel: 'Personal Access Token', tokenPlaceholder: 'Paste your Typeform personal token', hasInterval: true },
        { id: 'crm',          name: 'Salesforce',   desc: 'CRM feedback data',             icon: User,          img: logoCRM,          placeholder: 'e.g. https://mycompany.my.salesforce.com', label: 'Salesforce Instance URL', hasSalesforce: true, hasInterval: true },
        { id: 'api',          name: 'REST API',     desc: 'Any REST endpoint or webhook',  icon: Terminal,      img: logoWebhook,      placeholder: 'https://api.example.com/reviews', label: 'API Endpoint URL',         hasApiConfig: true, hasInterval: true },
    ];

    const sidebarItems = [
        { id: 'connectors', label: 'Connectors', icon: Database, color: 'indigo' },
        { id: 'history', label: 'Analysis History', icon: BarChart2, color: 'violet' },
        { id: 'surveys', label: 'Survey Builder', icon: ClipboardList, color: 'emerald' },
        { id: 'chat', label: 'Copilot Chat', icon: MessageSquare, color: 'sky' },
        { id: 'settings', label: 'Settings', icon: Settings, color: 'slate' },
        { id: 'billing', label: 'Billing', icon: DollarSign, color: 'emerald' },
        { id: 'docs', label: 'Documentation', icon: HelpCircle, color: 'amber' },
    ];

    const resultsTabsList = [
        { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard, color: 'indigo' },
        { id: 'intelligence', label: 'Intelligence', icon: Lightbulb, color: 'amber' },
        { id: 'predictive', label: 'Predictive', icon: TrendingUp, color: 'emerald' },
        { id: 'competitive', label: 'Competitive', icon: Globe, color: 'sky' },
        { id: 'causal', label: 'Causal', icon: Search, color: 'violet' },
        { id: 'prioritization', label: 'Priority', icon: Target, color: 'rose' },
        { id: 'trust', label: 'Trust', icon: Shield, color: 'slate' },
        { id: 'chat', label: 'Copilot', icon: MessageSquare, color: 'cyan' }
    ];

    const analysisTone = isPaused
        ? {
            badge: 'Paused',
            badgeClass: 'border-amber-300/60 bg-amber-100/90 text-amber-800',
            glowClass: 'from-amber-400/35 via-orange-300/20 to-transparent',
            iconWrap: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200/80',
            progressBar: 'from-amber-400 via-orange-400 to-amber-500',
            statusText: 'text-amber-700',
            panelRing: 'border-amber-200/70',
        }
        : isStopped
            ? {
                badge: 'Stopping',
                badgeClass: 'border-rose-300/60 bg-rose-100/90 text-rose-800',
                glowClass: 'from-rose-500/30 via-pink-300/15 to-transparent',
                iconWrap: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200/80',
                progressBar: 'from-rose-500 via-pink-500 to-orange-400',
                statusText: 'text-rose-700',
                panelRing: 'border-rose-200/70',
            }
            : {
                badge: 'Live',
                badgeClass: 'border-emerald-300/60 bg-emerald-100/90 text-emerald-800',
                glowClass: 'from-indigo-500/35 via-cyan-400/20 to-transparent',
                iconWrap: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/80',
                progressBar: 'from-indigo-500 via-cyan-400 to-sky-400',
                statusText: 'text-indigo-700',
                panelRing: 'border-indigo-200/70',
            };

    const analysisStages = [
        { label: 'Ingest', threshold: 18 },
        { label: 'Calibrate', threshold: 42 },
        { label: 'Synthesize', threshold: 74 },
        { label: 'Narrate', threshold: 100 },
    ];


    const handleAddConnectorInline = (connector) => {
        let idValue = document.getElementById(`inline-id-${connector.id}`)?.value?.trim();
        if (connector.isFile && tempFile) {
            idValue = tempFile.name;
        }
        if (!idValue) return;

        // For CSV connectors, just save the file — no hard block if content column not selected,
        // backend auto-detects. Only show error if user EXPLICITLY selected a bad value.
        if (connector.id === 'csv') {
            if (tempFile) {
                setCsvFiles(prev => ({ ...prev, [tempFile.name]: tempFile }));
            }
        }

        const config = {};

        // App Store
        if (connector.id === 'appstore') {
            config.country = document.getElementById(`inline-country-${connector.id}`)?.value?.trim() || 'us';
            config.max_reviews = parseInt(document.getElementById(`inline-limit-${connector.id}`)?.value) || 200;
        }

        // Play Store
        if (connector.id === 'playstore') {
            config.country = document.getElementById(`inline-country-${connector.id}`)?.value?.trim() || 'us';
            config.max_reviews = parseInt(document.getElementById(`inline-limit-${connector.id}`)?.value) || 200;
        }

        // Trustpilot
        if (connector.id === 'trustpilot') {
            config.max_reviews = parseInt(document.getElementById(`inline-limit-${connector.id}`)?.value) || 200;
        }

        // SurveyMonkey
        if (connector.id === 'surveymonkey') {
            config.token = document.getElementById(`inline-token-${connector.id}`)?.value?.trim() || '';
            config.max_reviews = 200;
        }

        // Typeform
        if (connector.id === 'typeform') {
            config.token = document.getElementById(`inline-token-${connector.id}`)?.value?.trim() || '';
            config.max_reviews = 200;
        }

        // Salesforce / CRM
        if (connector.id === 'crm') {
            config.instance_url = idValue; // identifier IS the instance URL
            config.client_id     = document.getElementById(`inline-sf-client_id-${connector.id}`)?.value?.trim() || '';
            config.client_secret = document.getElementById(`inline-sf-client_secret-${connector.id}`)?.value?.trim() || '';
            config.username      = document.getElementById(`inline-sf-username-${connector.id}`)?.value?.trim() || '';
            config.password      = document.getElementById(`inline-sf-password-${connector.id}`)?.value?.trim() || '';
            config.object_name   = document.getElementById(`inline-sf-object-${connector.id}`)?.value?.trim() || 'Case';
            config.content_field = document.getElementById(`inline-sf-content-${connector.id}`)?.value?.trim() || 'Description';
            config.score_field   = document.getElementById(`inline-sf-score-${connector.id}`)?.value?.trim() || '';
            config.max_reviews   = 200;
        }

        // API / Webhook
        if (connector.id === 'api') {
            config.url           = idValue; // identifier IS the endpoint URL
            config.method        = document.getElementById(`inline-api-method-${connector.id}`)?.value || 'GET';
            config.auth_type     = document.getElementById(`inline-api-auth_type-${connector.id}`)?.value || 'none';
            config.auth_value    = document.getElementById(`inline-api-auth_value-${connector.id}`)?.value?.trim() || '';
            config.data_path     = document.getElementById(`inline-api-data_path-${connector.id}`)?.value?.trim() || '';
            config.content_field = document.getElementById(`inline-api-content_field-${connector.id}`)?.value?.trim() || '';
            config.score_field   = document.getElementById(`inline-api-score_field-${connector.id}`)?.value?.trim() || '';
            config.max_reviews   = parseInt(document.getElementById(`inline-limit-${connector.id}`)?.value) || 200;
        }

        // CSV
        if (connector.id === 'csv') {
            config.columnMap = { ...csvColumnMap };
            config.originalFileName = tempFile?.name;
        }

        const fetchInterval = document.getElementById(`inline-interval-${connector.id}`)?.value || 'manual';
        const maxReviews = parseInt(document.getElementById(`inline-limit-${connector.id}`)?.value) || 200;

        handleEnableConnector(
            connector.id,
            idValue,
            null,
            { ...config, fetch_interval: fetchInterval, max_reviews: maxReviews },
            {
                fetchInterval,
                analysisInterval: fetchInterval === 'manual' ? 'manual' : fetchInterval,
                maxReviews,
            },
        );
        setTempFile(null);
        setCsvHeaders([]);
        setCsvColumnMap({ content: '', score: '', date: '', author: '' });
        setError(null);
    };


    // We removed currentStep === 3 rendering block completely. It is now handled by AnalysisProgressOverlay
    
    // Components for the Miniplayer and the Full Overlay
    const renderAnalysisMiniplayer = () => {
        if (!taskId || results) return null;

        const progressPct = Math.max(0, Math.min(100, Number(analysisProgress) || 0));
        const hasReviewCounts = totalReviewsForTask > 0;
        const statusLabel = isPaused ? 'Paused' : isStopped ? 'Stopping' : 'Running';
        const statusClass = isPaused
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : isStopped
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700';

        return (
            <AnimatePresence initial={false}>
                {!isAnalysisOverlayOpen && (
                    <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 20, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.96 }}
                        className="fixed bottom-6 right-6 z-50 w-[320px] rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-[0_20px_60px_-34px_rgba(15,23,42,0.35)]"
                        onClick={() => setIsAnalysisOverlayOpen(true)}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-slate-900">Analysis Progress</p>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                        <p className="truncate text-xs text-slate-600">
                            {analysisStatus || 'Initializing analysis pipeline...'}
                        </p>
                        {hasReviewCounts && (
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                {processedReviews} / {totalReviewsForTask} reviews processed{inFlightReviews > 0 ? ` (${inFlightReviews} in-flight)` : ''}
                            </p>
                        )}
                        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>{progressPct}% complete</span>
                            <span>{activeNodes.length || 0} sources</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>
        );
    };

    const renderAnalysisProgressOverlay = () => {
        const progressPct = Math.max(0, Math.min(100, Number(analysisProgress) || 0));
        const hasReviewCounts = totalReviewsForTask > 0;
        const statusLabel = isPaused ? 'Paused' : isStopped ? 'Stopping' : 'Running';
        const statusClass = isPaused
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : isStopped
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700';

        return (
            <AnimatePresence initial={false}>
                {isAnalysisOverlayOpen && !results && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.97, opacity: 0, y: 14 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.97, opacity: 0, y: 14 }}
                            className="w-full max-w-3xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_40px_120px_-60px_rgba(15,23,42,0.35)]"
                        >
                            <div className="border-b border-slate-200 px-6 py-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Analysis Progress</p>
                                        <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Processing Feedback</h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {analysisStatus || 'Initializing analysis pipeline...'}
                                        </p>
                                        {hasReviewCounts && (
                                            <p className="mt-2 text-sm font-semibold text-slate-500">
                                                {processedReviews} / {totalReviewsForTask} reviews processed{inFlightReviews > 0 ? ` (${inFlightReviews} in-flight)` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusClass}`}>
                                            {statusLabel}
                                        </span>
                                        <button
                                            onClick={() => setIsAnalysisOverlayOpen(false)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                        >
                                            <X size={14} />
                                            Minimize
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5 px-6 py-5">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-600">
                                    <span>{progressPct}% complete</span>
                                    <span>{activeNodes.length || 0} connected sources</span>
                                </div>
                                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                    <motion.div
                                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPct}%` }}
                                    />
                                </div>

                                <div className="grid gap-2 sm:grid-cols-4">
                                    {analysisStages.map((stage, index) => {
                                        const done = progressPct >= stage.threshold;
                                        const current = !done && (index === 0 || progressPct >= analysisStages[index - 1].threshold);
                                        return (
                                            <div
                                                key={stage.label}
                                                className={`rounded-2xl border px-3 py-3 ${
                                                    done
                                                        ? 'border-emerald-200 bg-emerald-50'
                                                        : current
                                                            ? 'border-indigo-200 bg-indigo-50'
                                                            : 'border-slate-200 bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black ${
                                                        done ? 'bg-emerald-500 text-white' : current ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'
                                                    }`}>
                                                        {done ? <Check size={12} /> : index + 1}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700">{stage.label}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {analysisLog.length > 0 && (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Latest Update</p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {analysisLog[analysisLog.length - 1]}
                                        </p>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                                    {isPaused ? (
                                        <button
                                            onClick={() => handleTaskControl('resume')}
                                            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo-700 transition-colors hover:bg-indigo-100"
                                        >
                                            <Zap size={14} />
                                            Resume
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleTaskControl('pause')}
                                            disabled={isStopped}
                                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <X size={14} />
                                            Pause
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleTaskControl('stop')}
                                        disabled={isStopped || isPaused}
                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <X size={14} className="rotate-45" />
                                        Stop
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    };


    // Main sidebar-driven dashboard layout
    return (
        <GlobalErrorBoundary currentStep={currentStep} results={results} sidebarTab={sidebarTab} resultsTab={resultsTab}>
        <ResolutionAdaptiveShell className="horizon-shell-bg">
        <div className="horizon-shell-bg flex h-full text-slate-900 overflow-hidden relative">
            {renderAnalysisMiniplayer()}
            {renderAnalysisProgressOverlay()}

            {/* Sidebar */}
            <div className="w-[260px] bg-white border-r border-slate-200/80 flex flex-col shrink-0">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <button onClick={onBack} className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700">
                            <ArrowLeft size={13} />
                        </button>
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm">
                                <Zap size={12} className="text-white" />
                            </div>
                            <span className="text-[13px] font-semibold text-slate-800 truncate">{workspace.name}</span>
                        </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isPreviewMode ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                        <span className={`text-[10px] font-medium uppercase tracking-wider ${isPreviewMode ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {isPreviewMode ? 'Preview' : 'Live'}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-auto font-medium">{workspace.vertical || 'Generic'}</span>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar">
                    {currentStep === 4 && results ? (
                        <>
                            <div className="px-3 pb-1 mb-1 flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Analysis Results</p>
                                <button 
                                    onClick={handleNewScan}
                                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                                >
                                    <RotateCcw size={10} />
                                    New
                                </button>
                            </div>
                            {resultsTabsList.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setResultsTab(tab.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                                        resultsTab === tab.id
                                            ? `bg-${tab.color}-50 text-${tab.color}-700 font-semibold shadow-sm border border-${tab.color}-100`
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                                    }`}
                                >
                                    <tab.icon size={16} className={resultsTab === tab.id ? `text-${tab.color}-600` : 'text-slate-400'} />
                                    {tab.label}
                                </button>
                            ))}
                        </>
                    ) : (
                        <>
                            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Workspace</p>
                            {sidebarItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { setSidebarTab(item.id); if (currentStep === 4) setCurrentStep(0); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                                        sidebarTab === item.id
                                            ? `bg-${item.color}-50 text-${item.color}-700 font-semibold shadow-sm border border-${item.color}-100`
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                                    }`}
                                >
                                    <item.icon size={16} className={sidebarTab === item.id ? `text-${item.color}-600` : 'text-slate-400'} />
                                    {item.label}
                                    {item.id === 'connectors' && activeNodes.length > 0 && (
                                        <span className="ml-auto text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{activeNodes.length}</span>
                                    )}
                                </button>
                            ))}
                        </>
                    )}


                    {/* Active Sources Quick View */}
                     {activeNodes.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-slate-100">
                            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Active Sources</p>
                            <div className="space-y-0.5">
                                {activeNodes.slice(0, 5).map(node => (
                                    <div key={node.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-slate-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                                        <span className="truncate">{node.name || node.identifier}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Footer - User Profile */}
                <div className="p-3 border-t border-slate-100">
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-[10px] uppercase shadow-sm">{user.name?.charAt(0) || 'U'}</div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[12px] font-semibold text-slate-800 leading-tight truncate">{user.name}</span>
                            <span className="text-[10px] text-slate-400 truncate">{user.contactEmail || user.email}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {isPreviewMode && (
                        <div className="p-6 pb-0">
                            <PreviewStatusBanner compact />
                        </div>
                    )}
                    {currentStep === 4 && !results && (
                        <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none"></div>
                            
                            <div className="relative z-10 flex flex-col items-center text-center">
                                {/* Animated Logo Container */}
                                <div className="relative w-24 h-24 mb-6">
                                    <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-xl opacity-20 animate-pulse"></div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 animate-float">
                                        <Zap size={36} className="text-white drop-shadow-md" />
                                    </div>
                                    
                                    {/* Orbiting particles */}
                                    <div className="absolute top-0 right-0 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
                                    <div className="absolute bottom-0 left-0 w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
                                </div>
                                
                                <h2 className="text-[22px] font-black tracking-tight text-slate-900 mb-2">Synthesizing Intelligence</h2>
                                <p className="text-[14px] text-slate-500 mb-8 max-w-[280px] leading-relaxed">Processing millions of data points through our neural engines to uncover hidden insights.</p>
                                
                                {/* Progress Bar Container */}
                                <div className="w-64 max-w-full space-y-3">
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-600 rounded-full w-[85%] relative overflow-hidden">
                                            {/* Shimmer effect inside progress bar */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                        <span>Finalizing Data Pipeline</span>
                                        <span className="text-indigo-600">85%</span>
                                    </div>
                                </div>
                                
                                <div className="text-[10px] uppercase font-bold text-slate-400 mt-12 px-3 py-1.5 bg-slate-50 rounded-lg flex items-center gap-2 border border-slate-100 shadow-sm">
                                    <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
                                    Awaiting payload from cortex
                                </div>
                            </div>
                        </div>
                    )}
                    {currentStep === 4 && results ? (
                        <div id="results-container" className="p-8 h-full flex flex-col overflow-hidden">
                            {console.log("[DIAG] Rendering Results Dashboard. Tab:", resultsTab)}
                            {/* Diagnostic hidden marker */}
                            <div id="results-ready" className="hidden" />
                            <div className="flex items-center justify-between mb-8 shrink-0 bg-white/50 backdrop-blur-xl border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shadow-lg shadow-slate-200">
                                        <Zap size={24} className="text-white drop-shadow-sm" />
                                    </div>
                                    <div>
                                        <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none mb-2">Intelligence Dashboard</h1>
                                        <div className="flex items-center gap-3.5 text-[13px] text-slate-500 font-medium">
                                            <span className="flex items-center gap-1.5"><Users size={14} className="opacity-50" /> {results?.totalReviews || 0} Review Signals</span>
                                            {results?.analysisCounts?.fetched > 0 && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="text-[12px]">Fetched {results.analysisCounts.fetched}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="text-[12px]">Analyzed {results.analysisCounts.analyzed}</span>
                                                </>
                                            )}
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-bold"><Briefcase size={12} className="opacity-50" /> {workspace?.vertical || 'Enterprise'}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-emerald-100/50 flex items-center gap-2 shadow-sm shadow-emerald-100/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                Live Analysis
                                            </span>
                                        </div>
                                        {results?.analysisCounts?.summary && (
                                            <p className="mt-2 text-[11px] font-medium text-slate-500">{results.analysisCounts.summary}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-slate-100/80 p-1 rounded-xl mr-2 border border-slate-200/50">
                                        {['24h', '7d', '30d', 'All'].map(t => (
                                            <button key={t} className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${t === 'All' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>{t}</button>
                                        ))}
                                    </div>
                                    <div className="w-px h-8 bg-slate-200 mx-2"></div>
                                    <button 
                                        onClick={handleExport} 
                                        disabled={isExporting} 
                                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-[12px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50 group"
                                    >
                                        {isExporting ? <RefreshCw size={14} className="animate-spin text-slate-400" /> : <Download size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />} 
                                        Export
                                    </button>
                                    <button 
                                        onClick={handleNewScan} 
                                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-[12px] font-bold uppercase tracking-wider hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/50 active:scale-95 group"
                                    >
                                        <RotateCcw size={14} className="group-hover:-rotate-90 transition-transform duration-300" />
                                        New Scan
                                    </button>
                                </div>
                            </div>

                            {/* Global Results Filter Bar */}
                            <div className="flex items-center gap-4 mb-8 p-1.5 bg-white border border-slate-200/80 rounded-[1rem] shrink-0 shadow-sm">
                                <div className="flex items-center gap-2 px-4 border-r border-slate-100 shrink-0">
                                    <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center">
                                        <Filter size={12} className="text-slate-500" />
                                    </div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Global Filters</span>
                                </div>
                                <div className="flex items-center gap-3 flex-1 overflow-x-auto custom-scrollbar px-1">
                                    <select className="bg-transparent text-[13px] font-semibold text-slate-700 py-1 outline-none border-none cursor-pointer hover:text-indigo-600 transition-colors focus:ring-0">
                                        <option>All Sentiment</option>
                                        <option>Positive Only</option>
                                        <option>Critical Issues</option>
                                    </select>
                                    <div className="w-[1px] h-4 bg-slate-200 shrink-0"></div>
                                    <select className="bg-transparent text-[13px] font-semibold text-slate-700 py-1 outline-none border-none cursor-pointer hover:text-indigo-600 transition-colors focus:ring-0">
                                        <option>All Sources</option>
                                        {activeNodes.map(n => <option key={n.id}>{n.name || n.identifier}</option>)}
                                    </select>
                                    <div className="w-[1px] h-4 bg-slate-200 shrink-0"></div>
                                    <select className="bg-transparent text-[13px] font-semibold text-slate-700 py-1 outline-none border-none cursor-pointer hover:text-indigo-600 transition-colors focus:ring-0">
                                        <option>Global Themes</option>
                                        <option>Churn Risk Themes</option>
                                        <option>Growth Drivers</option>
                                    </select>
                                </div>
                                <div className="px-4 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1.5 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                    Showing: {results?.totalReviews || 0} signals
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                <AnimatePresence mode="wait">
                                    {resultsTab === 'overview' && (
                                        <motion.div key="overview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="space-y-6 pb-10">
                                            <ExecutiveSummaryTab results={results} />
                                            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6 shadow-sm">
                                                <ExecutiveOperationsDashboard results={results} />
                                            </section>
                                            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                                                <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                                                    <StrategicNarrative results={results} />
                                                </section>
                                                <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                                                    <RevenueRisk results={results} />
                                                </section>
                                            </div>
                                        </motion.div>
                                    )}
                                    {resultsTab === 'intelligence' && (<motion.div key="intelligence" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}><FeedbackIntelligence results={results} userId={user.id} /></motion.div>)}
                                    {resultsTab === 'predictive' && (<motion.div key="predictive" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}><PredictiveIntelligenceTab data={advancedData?.predictive} /></motion.div>)}
                                    {resultsTab === 'competitive' && (<motion.div key="competitive" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}><CompetitiveIntelligenceTab data={advancedData?.competitive} /></motion.div>)}
                                    {resultsTab === 'causal' && (<motion.div key="causal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}><CausalDiagnosticsTab data={advancedData?.causal} /></motion.div>)}
                                    {resultsTab === 'prioritization' && (<motion.div key="prioritization" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}><PrioritizationTab data={advancedData?.prioritization} /></motion.div>)}
                                    {resultsTab === 'trust' && (<motion.div key="trust" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}><TrustCenterTab data={advancedData?.trust} /></motion.div>)}
                                    {resultsTab === 'chat' && (<motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="bg-white rounded-3xl border border-slate-200 shadow-xl h-[700px] overflow-hidden"><CopilotChat /></motion.div>)}
                                </AnimatePresence>
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">

                        {/* ====== CONNECTORS TAB ====== */}
                        {sidebarTab === 'connectors' && (
                            <motion.div key="connectors" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="p-8 max-w-[1600px] mx-auto px-10">
                                {currentStep === 0 && (
                                    <ConnectorStudio
                                        connectorCatalog={CONNECTOR_CATALOG}
                                        bulkSurveyMode={bulkSurveyMode}
                                        setBulkSurveyMode={setBulkSurveyMode}
                                        activeNodes={activeNodes}
                                        csvFiles={csvFiles}
                                        setCsvFiles={setCsvFiles}
                                        handleRemoveNode={handleRemoveNode}
                                        handleSyncNodes={handleSyncNodes}
                                        isLoadingPreview={isLoadingPreview}
                                        expandedConnector={expandedConnector}
                                        setExpandedConnector={setExpandedConnector}
                                        tempFile={tempFile}
                                        setTempFile={setTempFile}
                                        parseCsvHeaders={parseCsvHeaders}
                                        csvHeaders={csvHeaders}
                                        csvColumnMap={csvColumnMap}
                                        setCsvColumnMap={setCsvColumnMap}
                                        handleAddConnectorInline={handleAddConnectorInline}
                                        isPreviewMode={isPreviewMode}
                                    />
                                )}

                                {false && currentStep === 0 && (
                                    <>
                                        <div className="relative mb-8 overflow-hidden rounded-[32px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_#ffffff,_#f8fafc)] p-8 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.35)]">
                                            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),transparent)]" />
                                            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                                                <div className="max-w-2xl">
                                                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-indigo-700">
                                                        <Network size={12} />
                                                        Horizon Intake Layer
                                                    </div>
                                                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Connect every source that shapes the customer story.</h1>
                                                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Bring in app reviews, survey responses, CRM signals, and APIs from one polished control surface. Select a source, configure it inline, and move straight into calibration.</p>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Catalog</p>
                                                        <p className="mt-2 text-2xl font-black text-slate-900">{CONNECTOR_CATALOG.length}</p>
                                                        <p className="text-[11px] text-slate-500">available connectors</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Workspace</p>
                                                        <p className="mt-2 text-2xl font-black text-slate-900">{activeNodes.length}</p>
                                                        <p className="text-[11px] text-slate-500">connected sources</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Mode</p>
                                                        <p className="mt-2 text-sm font-black text-slate-900">{bulkSurveyMode ? 'Bulk survey intake' : 'Direct review intake'}</p>
                                                        <p className="text-[11px] text-slate-500">ready for calibration</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bulk Survey Mode Toggle */}
                                        <div className="mb-6 flex items-center justify-between gap-4 rounded-[24px] border border-violet-200/80 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(99,102,241,0.06))] p-5 shadow-[0_16px_35px_-28px_rgba(109,40,217,0.55)]">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setBulkSurveyMode(!bulkSurveyMode)}
                                                    className={`relative h-6 w-11 rounded-full transition-colors ${bulkSurveyMode ? 'bg-violet-600' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${bulkSurveyMode ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-violet-950">Bulk Survey Review Analysis</span>
                                                        <span className="rounded-full border border-violet-200 bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-700">
                                                            {bulkSurveyMode ? 'Enabled' : 'Optional'}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-violet-700/80">Switch this on when you want Horizon to treat imported survey responses as a batch review dataset.</p>
                                                </div>
                                            </div>
                                            <div className="hidden items-center gap-2 rounded-2xl border border-white/50 bg-white/60 px-4 py-3 text-[11px] font-medium text-violet-800 shadow-sm md:flex">
                                                <Sparkles size={14} />
                                                Better for large CSV and API survey payloads
                                            </div>
                                        </div>

                                        <div className="mb-8 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_28px_80px_-55px_rgba(15,23,42,0.45)]">
                                            <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.92))] px-8 py-7">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Source Connector</p>
                                                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Choose your intake channel</h2>
                                                        <p className="mt-2 text-sm text-slate-500">Every connector opens inside the same workspace so setup feels fast, consistent, and easy to review.</p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                                            <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">{CONNECTOR_CATALOG.length} Available</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                                                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">{activeNodes.length} Connected</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-8">
                                                <div className="mb-6 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">App reviews</span>
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Surveys</span>
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">CRM feedback</span>
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Custom APIs</span>
                                                </div>
                                            <div className="flex items-center justify-between mb-8">
                                                <div>
                                                    <h2 className="text-lg font-bold text-slate-900">Select Data Source</h2>
                                                    <p className="text-xs text-slate-500 mt-1">Choose where to fetch your review data from</p>
                                                </div>
                                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{CONNECTOR_CATALOG.length} Available</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                {CONNECTOR_CATALOG.map(c => {
                                                    const isSelected = expandedConnector === c.id;
                                                    const isAlreadyAdded = activeNodes.some(n => n.connector_type === c.id);
                                                    return (
                                                        <motion.button
                                                            key={c.id}
                                                            whileHover={{ y: -2 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => setExpandedConnector(isSelected ? null : c.id)}
                                                            className={`group relative flex flex-col items-start gap-4 overflow-hidden rounded-[24px] border p-5 text-left transition-all duration-300 ${
                                                                isSelected
                                                                    ? 'border-indigo-300 bg-[linear-gradient(180deg,rgba(238,242,255,0.95),rgba(255,255,255,1))] shadow-[0_18px_40px_-28px_rgba(79,70,229,0.55)]'
                                                                    : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]'
                                                            }`}
                                                        >
                                                            <div className={`absolute inset-x-0 top-0 h-1.5 ${isSelected ? 'bg-gradient-to-r from-indigo-500 via-sky-400 to-cyan-400' : 'bg-gradient-to-r from-slate-200 via-slate-100 to-transparent group-hover:from-indigo-300 group-hover:via-sky-200'}`}></div>
                                                            <div className="flex w-full items-start justify-between">
                                                                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center p-2.5 shadow-sm transition-colors ${
                                                                    isSelected ? 'border-indigo-100 bg-white' : 'border-slate-200 bg-slate-50 group-hover:border-indigo-100 group-hover:bg-white'
                                                                }`}>
                                                                    {c.img ? <img src={c.img} alt={c.name} className="w-full h-full object-contain" /> : <c.icon size={22} className="text-slate-500" />}
                                                                </div>
                                                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                                                    isSelected ? 'border-indigo-500 bg-indigo-500 shadow-lg shadow-indigo-200' : 'border-slate-200 bg-white group-hover:border-indigo-300'
                                                                }`}>
                                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className={`mb-1 block text-base font-black tracking-tight ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>{c.name}</span>
                                                                <p className="text-[11px] leading-relaxed text-slate-500">{c.desc}</p>
                                                            </div>
                                                            <div className="mt-auto flex flex-wrap gap-2">
                                                                {c.hasInterval && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Scheduled</span>}
                                                                {c.hasToken && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Secure token</span>}
                                                                {c.isFile && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Upload</span>}
                                                                {c.hasApiConfig && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Flexible schema</span>}
                                                            </div>
                                                            {isAlreadyAdded && (
                                                                <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100/90 px-2.5 py-1 text-emerald-700 shadow-sm">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                    <span className="text-[8px] font-black uppercase tracking-[0.22em]">Active</span>
                                                                </div>
                                                            )}
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>

                                            <AnimatePresence>
                                                {expandedConnector && (() => {
                                                    const c = CONNECTOR_CATALOG.find(x => x.id === expandedConnector);
                                                    if (!c) return null;
                                                    return (
                                                        <motion.div
                                                            key={c.id}
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="mt-6 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98))] p-6 shadow-inner shadow-slate-100/70">
                                                                <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-sm">
                                                                        {c.img ? <img src={c.img} className="w-full h-full object-contain" /> : <c.icon size={14} className="text-slate-500" />}
                                                                    </div>
                                                                    <span className="text-sm font-bold text-slate-900">{c.name}</span>
                                                                    <span className="text-xs text-slate-400">— {c.desc}</span>
                                                                </div>
                                                                </div>

                                                                {c.isFile ? (
                                                                    <div className="space-y-3">
                                                                        <label className="block text-xs font-semibold text-slate-700 mb-2">{c.label}</label>
                                                                        {/* File drop zone */}
                                                                        <div
                                                                            className={`border-2 border-dashed rounded-[24px] p-7 flex flex-col items-center gap-3 cursor-pointer transition-all ${tempFile ? 'border-emerald-300 bg-emerald-50/80 shadow-[0_16px_35px_-28px_rgba(16,185,129,0.65)]' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'}`}
                                                                            onClick={() => document.getElementById('file-upload-hidden')?.click()}
                                                                        >
                                                                            <input type="file" id="file-upload-hidden" className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setTempFile(f); parseCsvHeaders(f); } }} />
                                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tempFile ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                                {tempFile ? <Check size={16} /> : <FileUp size={16} />}
                                                                            </div>
                                                                            <span className="text-sm font-semibold text-slate-800">{tempFile ? tempFile.name : 'Select or drag file'}</span>
                                                                            <span className="text-[10px] text-slate-400">CSV, XLSX, XLS — Max 25MB</span>
                                                                        </div>

                                                                        {/* Column mapping panel — shown once headers are parsed */}
                                                                        {csvHeaders.length > 0 && (
                                                                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                                                                                        <span className="text-white text-[8px] font-bold">→</span>
                                                                                    </div>
                                                                                    <p className="text-xs font-bold text-indigo-900">Map your columns</p>
                                                                                    <span className="text-[10px] text-indigo-400 ml-auto">{csvHeaders.length} columns detected</span>
                                                                                </div>

                                                                                {/* Feedback Text — required */}
                                                                                <div>
                                                                                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                                                                                        Feedback Text <span className="text-rose-500">*</span>
                                                                                        <span className="text-[10px] font-normal text-slate-400 ml-1">The review or comment column</span>
                                                                                    </label>
                                                                                    <select
                                                                                        value={csvColumnMap.content}
                                                                                        onChange={e => setCsvColumnMap(p => ({ ...p, content: e.target.value }))}
                                                                                        className={`w-full text-xs px-3 py-2 rounded-lg border outline-none focus:ring-1 focus:ring-indigo-500 bg-white ${csvColumnMap.content ? 'border-emerald-300 text-slate-900' : 'border-rose-300 text-slate-500'}`}
                                                                                    >
                                                                                        <option value="">— Select column —</option>
                                                                                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                                                    </select>
                                                                                </div>

                                                                                {/* Rating / Score — optional */}
                                                                                <div>
                                                                                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                                                                                        Rating / Score
                                                                                        <span className="text-[10px] font-normal text-slate-400 ml-1">Numeric 1–5 column (optional)</span>
                                                                                    </label>
                                                                                    <select
                                                                                        value={csvColumnMap.score}
                                                                                        onChange={e => setCsvColumnMap(p => ({ ...p, score: e.target.value }))}
                                                                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
                                                                                    >
                                                                                        <option value="">— Skip (defaults to neutral) —</option>
                                                                                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                                                    </select>
                                                                                </div>

                                                                                {/* Date — optional */}
                                                                                <div>
                                                                                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                                                                                        Date
                                                                                        <span className="text-[10px] font-normal text-slate-400 ml-1">Timestamp or date column (optional)</span>
                                                                                    </label>
                                                                                    <select
                                                                                        value={csvColumnMap.date}
                                                                                        onChange={e => setCsvColumnMap(p => ({ ...p, date: e.target.value }))}
                                                                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
                                                                                    >
                                                                                        <option value="">— Skip —</option>
                                                                                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                                                    </select>
                                                                                </div>

                                                                                {/* Author — optional */}
                                                                                <div>
                                                                                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                                                                                        Author / Reviewer Name
                                                                                        <span className="text-[10px] font-normal text-slate-400 ml-1">Optional</span>
                                                                                    </label>
                                                                                    <select
                                                                                        value={csvColumnMap.author}
                                                                                        onChange={e => setCsvColumnMap(p => ({ ...p, author: e.target.value }))}
                                                                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
                                                                                    >
                                                                                        <option value="">— Skip —</option>
                                                                                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                                                    </select>
                                                                                </div>

                                                                                {!csvColumnMap.content && (
                                                                                    <p className="text-[10px] text-rose-500 font-semibold">⚠ You must select the Feedback Text column to continue.</p>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{c.label} <span className="text-rose-500">*</span></label>
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            id={`inline-id-${c.id}`}
                                                                            placeholder={c.placeholder}
                                                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500 text-sm text-slate-900"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {/* Extra fields: Country + Interval + Limit */}
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {c.hasCountry && (
                                                                        <div>
                                                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Country Code</label>
                                                                            <input type="text" id={`inline-country-${c.id}`} defaultValue="us" placeholder="us" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                                                                        </div>
                                                                    )}
                                                                    {c.hasInterval && (
                                                                        <div>
                                                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Fetch Interval</label>
                                                                            <select id={`inline-interval-${c.id}`} defaultValue="manual" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                                                                                <option value="manual">Manual Pull Only</option>
                                                                                <option value="hourly">Every Hour</option>
                                                                                <option value="daily">Every 24 Hours</option>
                                                                                <option value="weekly">Every Week</option>
                                                                            </select>
                                                                        </div>
                                                                    )}
                                                                    {c.hasLimit && (
                                                                        <div className={!c.hasCountry && !c.hasInterval ? 'col-span-2' : ''}>
                                                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Max Reviews to Fetch</label>
                                                                            <input type="number" id={`inline-limit-${c.id}`} defaultValue="200" min="10" max="2000" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Extra fields: Access Token (SurveyMonkey / Typeform) */}
                                                                {c.hasToken && (
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-700 mb-1">{c.tokenLabel} <span className="text-rose-500">*</span></label>
                                                                        <input type="password" id={`inline-token-${c.id}`} placeholder={c.tokenPlaceholder} autoComplete="off" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500 text-sm text-slate-900 font-mono" />
                                                                        <p className="text-[10px] text-slate-400 mt-1">Stored only in this workspace. Never shared externally.</p>
                                                                    </div>
                                                                )}

                                                                {/* Extra fields: Salesforce OAuth */}
                                                                {c.hasSalesforce && (
                                                                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">OAuth Credentials</p>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Client ID</label><input type="text" id={`inline-sf-client_id-${c.id}`} placeholder="Connected app client ID" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Client Secret</label><input type="password" id={`inline-sf-client_secret-${c.id}`} placeholder="Client secret" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Username</label><input type="text" id={`inline-sf-username-${c.id}`} placeholder="user@company.com" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Password + Security Token</label><input type="password" id={`inline-sf-password-${c.id}`} placeholder="mypasswordXXXXXXX" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                                                        </div>
                                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pt-1">Data Mapping</p>
                                                                        <div className="grid grid-cols-3 gap-2">
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Object Name</label><input type="text" id={`inline-sf-object-${c.id}`} defaultValue="Case" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Content Field</label><input type="text" id={`inline-sf-content-${c.id}`} defaultValue="Description" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Score Field (opt)</label><input type="text" id={`inline-sf-score-${c.id}`} placeholder="CSAT_Score__c" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400" /></div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Extra fields: REST API / Webhook full config */}
                                                                {c.hasApiConfig && (
                                                                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Request Config</p>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">HTTP Method</label>
                                                                                <select id={`inline-api-method-${c.id}`} defaultValue="GET" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400">
                                                                                    <option value="GET">GET</option><option value="POST">POST</option>
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pt-1">Authentication</p>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Auth Type</label>
                                                                                <select id={`inline-api-auth_type-${c.id}`} defaultValue="none" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400">
                                                                                    <option value="none">None</option><option value="bearer">Bearer Token</option><option value="apikey">API Key Header</option><option value="basic">Basic Auth</option>
                                                                                </select>
                                                                            </div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Auth Value / Token</label><input type="password" id={`inline-api-auth_value-${c.id}`} placeholder="Token or user:password" autoComplete="off" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-400" /></div>
                                                                        </div>
                                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pt-1">Field Mapping (leave blank for auto-detect)</p>
                                                                        <div className="grid grid-cols-3 gap-2">
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Path</label><input type="text" id={`inline-api-data_path-${c.id}`} placeholder="data.reviews" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-400" /></div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Content Field</label><input type="text" id={`inline-api-content_field-${c.id}`} placeholder="text, body…" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-400" /></div>
                                                                            <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Score Field</label><input type="text" id={`inline-api-score_field-${c.id}`} placeholder="rating, score…" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-400" /></div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center justify-end gap-3 pt-1">
                                                                    <button onClick={() => { setExpandedConnector(null); setTempFile(null); }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                                                                    <button
                                                                        onClick={() => handleAddConnectorInline(c)}
                                                                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                                                                    >
                                                                        <Plus size={14} /> Add Source
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })()}
                                            </AnimatePresence>
                                        </div>
                                        </div>

                                        {/* Added Connectors Card */}
                                        {activeNodes.length > 0 && (
                                            <div className="mb-6 overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-6 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]">
                                                <div className="mb-5 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Workspace Sources</p>
                                                        <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Configured inputs</h2>
                                                    </div>
                                                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-700">{activeNodes.length} live</span>
                                                </div>
                                                <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                    {activeNodes.map(node => {
                                                        const catalogItem = CONNECTOR_CATALOG.find(i => i.id === node.connector_type);
                                                        const isCsv = node.connector_type === 'csv';
                                                        const csvFileReady = isCsv ? !!csvFiles[node.identifier] : true;
                                                        return (
                                                            <div key={node.id} className={`rounded-[22px] border px-4 py-4 transition-all ${isCsv && !csvFileReady ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_35px_-30px_rgba(15,23,42,0.25)]'}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center p-2 shadow-sm shrink-0">
                                                                            {catalogItem?.img ? <img src={catalogItem.img} className="w-full h-full object-contain" /> : <Database size={14} className="text-slate-400" />}
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-sm font-black text-slate-900 truncate">{node.name || node.identifier}</span>
                                                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{node.connector_type}</span>
                                                                                {isCsv && (
                                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${csvFileReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                        {csvFileReady ? '✓ File ready' : '⚠ Re-upload needed'}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveNode(node.id)}
                                                                        disabled={isPreviewMode}
                                                                        className={`ml-2 shrink-0 rounded-xl p-2 transition-all ${
                                                                            isPreviewMode
                                                                                ? 'cursor-not-allowed text-slate-300'
                                                                                : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'
                                                                        }`}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                                {/* CSV re-upload prompt */}
                                                                {isCsv && !csvFileReady && (
                                                                    <div className="mt-2 pt-2 border-t border-amber-100">
                                                                        <label className="flex items-center gap-2 cursor-pointer text-[10px] text-amber-700 font-semibold hover:text-amber-900 transition-colors">
                                                                            <Upload size={11} />
                                                                            Click to re-select "{node.identifier}"
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                accept=".csv,.xlsx,.xls"
                                                                                onChange={(e) => {
                                                                                    const f = e.target.files?.[0];
                                                                                    if (f) setCsvFiles(prev => ({ ...prev, [node.identifier]: f }));
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                                                    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                        <span className="text-xs font-semibold text-emerald-700">Ready for synchronization</span>
                                                    </div>
                                                    <button
                                                        onClick={handleSyncNodes}
                                                        disabled={isLoadingPreview}
                                                        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] hover:from-indigo-700 hover:to-sky-600 active:scale-[0.98] disabled:opacity-50"
                                                    >
                                                        {isLoadingPreview ? (
                                                            <><Loader2 className="animate-spin" size={16} /> Syncing Data...</>
                                                        ) : (
                                                            <><Zap size={16} className="fill-white" /> {isPreviewMode ? 'Open Calibration Preview' : 'Sync & Calibrate'}</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {currentStep === 2 && (
                                    <CalibrationStudio
                                        previewReviews={previewReviews}
                                        getFilteredReviews={getFilteredReviews}
                                        sourceFilter={sourceFilter}
                                        setSourceFilter={setSourceFilter}
                                        ratingFilter={ratingFilter}
                                        setRatingFilter={setRatingFilter}
                                        countRange={countRange}
                                        setCountRange={setCountRange}
                                        arpu={arpu}
                                        setArpu={setArpu}
                                        cleaningOptions={cleaningOptions}
                                        setCleaningOptions={setCleaningOptions}
                                        handleStartAnalysis={handleStartAnalysis}
                                        isPreviewMode={isPreviewMode}
                                    />
                                )}

                                {false && currentStep === 2 && (() => {
                                    const filteredReviews = getFilteredReviews();
                                    const allSources = [...new Set((previewReviews || []).map(r => r.source).filter(Boolean))];
                                    const avgScore = filteredReviews.length > 0
                                        ? (filteredReviews.reduce((a, r) => a + (Number(r.score) || 0), 0) / filteredReviews.length).toFixed(2)
                                        : '0.00';
                                    const cleanCount = Object.values(cleaningOptions).filter(Boolean).length;

                                    // Noise badge helper
                                    const getNoiseBadge = (score) => {
                                        const s = Number(score) || 0;
                                        if (s >= 5) return { label: '1★', color: 'bg-red-50 text-red-500 border-red-200', border: 'border-l-rose-400' };
                                        if (s >= 4) return { label: '4★', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', border: 'border-l-emerald-400' };
                                        if (s >= 3) return { label: '3★', color: 'bg-amber-50 text-amber-600 border-amber-200', border: 'border-l-amber-400' };
                                        if (s >= 2) return { label: '2★', color: 'bg-orange-50 text-orange-500 border-orange-200', border: 'border-l-orange-400' };
                                        return { label: '1★', color: 'bg-red-50 text-red-500 border-red-200', border: 'border-l-rose-500' };
                                    };

                                    const scoreBorderColor = (score) => {
                                        const s = Number(score) || 3;
                                        if (s >= 4) return 'border-l-emerald-400';
                                        if (s === 3) return 'border-l-amber-400';
                                        return 'border-l-rose-400';
                                    };

                                    return (
                                    <div className="flex h-[calc(100vh-180px)] gap-0 overflow-hidden rounded-[34px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-[0_30px_90px_-55px_rgba(15,23,42,0.45)]">

                                        {/* ── LEFT PANEL: Formal Calibration Sidebar ── */}
                                            <div style={{width:'320px',minWidth:'320px'}} className="z-10 flex flex-col overflow-hidden border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                                                <div className="shrink-0 border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-6 py-6">
                                                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-indigo-700">
                                                        <Cpu size={12} />
                                                        Calibration Studio
                                                    </div>
                                                    <h2 className="text-xl font-black tracking-tight text-slate-950">Analysis Calibration</h2>
                                                    <p className="mt-2 text-sm leading-6 text-slate-500">Tune which feedback gets analyzed, how it is cleaned, and the commercial context Horizon should optimize for.</p>
                                                    <div className="mt-5 grid grid-cols-3 gap-2">
                                                        <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-3 text-center shadow-sm">
                                                            <p className="text-lg font-black text-slate-900">{filteredReviews.length}</p>
                                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Reviews</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-3 text-center shadow-sm">
                                                            <p className="text-lg font-black text-slate-900">{avgScore}</p>
                                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Avg score</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-3 text-center shadow-sm">
                                                            <p className="text-lg font-black text-slate-900">{cleanCount}</p>
                                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Cleaners</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/40 p-6 custom-scrollbar">

                                                    {/* Source Filter */}
                                                    {(() => {
                                                        const sources = [...new Set((previewReviews||[]).map(r => r.source).filter(Boolean))];
                                                        return sources.length > 1 ? (
                                                            <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                                                                <label className="mb-2.5 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Data Sources</label>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {sources.map(src => {
                                                                        const active = sourceFilter.length === 0 || sourceFilter.includes(src);
                                                                        return (
                                                                            <button key={src}
                                                                                onClick={() => setSourceFilter(prev =>
                                                                                    prev.length === 0 ? sources.filter(s => s !== src)
                                                                                    : prev.includes(src) ? (prev.length > 1 ? prev.filter(s => s !== src) : sources)
                                                                                    : [...prev, src]
                                                                                )}
                                                                                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                                                                                    active
                                                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                                                    : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                                                                                }`}
                                                                            >{src}</button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : null;
                                                    })()}

                                                    {/* Star Rating Filter */}
                                                    <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <label className="text-xs font-bold tracking-[0.18em] uppercase text-slate-700">Rating Filter</label>
                                                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">{ratingFilter.length}/5 selected</span>
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            {[1,2,3,4,5].map(s => (
                                                                <button key={s}
                                                                    onClick={() => setRatingFilter(prev => prev.includes(s) ? (prev.length > 1 ? prev.filter(r => r !== s) : prev) : [...prev, s].sort())}
                                                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                                                        ratingFilter.includes(s)
                                                                            ? s >= 4 ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.3)]'
                                                                            : s === 3 ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-[0_2px_10px_-3px_rgba(245,158,11,0.3)]'
                                                                            : 'bg-rose-50 border-rose-500 text-rose-700 shadow-[0_2px_10px_-3px_rgba(244,63,94,0.3)]'
                                                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                                                                    }`}
                                                                >{s}★</button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Review Count */}
                                                    <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                                                        <div className="flex items-center justify-between mb-2.5">
                                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Review Count</label>
                                                            <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">{countRange[0]}–{countRange[1]}</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {[
                                                                { label: 'From', idx: 0, min: 1, max: countRange[1] - 1 },
                                                                { label: 'To', idx: 1, min: countRange[0] + 1, max: Math.max((previewReviews||[]).length, 500) }
                                                            ].map(({ label, idx, min, max }) => (
                                                                <div key={label} className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-semibold text-slate-400 w-8">{label}</span>
                                                                    <input type="range" min={min} max={max}
                                                                        value={countRange[idx]}
                                                                        onChange={e => setCountRange(prev => idx === 0 ? [Number(e.target.value), prev[1]] : [prev[0], Number(e.target.value)])}
                                                                        className="flex-1 accent-indigo-600 h-1.5 cursor-pointer"
                                                                    />
                                                                    <input type="number" min={min} max={max}
                                                                        value={countRange[idx]}
                                                                        onChange={e => setCountRange(prev => idx === 0 ? [Number(e.target.value), prev[1]] : [prev[0], Number(e.target.value)])}
                                                                        className="w-14 text-[11px] text-center bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 font-bold text-slate-700 outline-none focus:border-indigo-400"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* ARPU */}
                                                    <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">ARPU — Monthly Revenue/User</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                                            <input
                                                                type="number" min={0} step={0.01} value={arpu}
                                                                onChange={e => setArpu(e.target.value)}
                                                                placeholder="e.g. 49.99"
                                                                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30"
                                                            />
                                                        </div>
                                                        {arpu > 0 && (
                                                            <p className="text-[10px] text-emerald-600 mt-1.5 font-medium">
                                                                ≈ ${(Number(arpu) * 12 * filteredReviews.length).toLocaleString()} est. ARR at risk
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Cleaning Options */}
                                                    <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                                                        <label className="mb-4 block text-xs font-bold uppercase tracking-[0.18em] text-slate-700">Cleaning Pipeline</label>
                                                        <div className="space-y-2.5">
                                                            {[
                                                                { key: 'token_efficiency', label: 'Dedup & Boilerplate', desc: 'Remove duplicates & filler' },
                                                                { key: 'magic_clean', label: 'AI Noise Filter', desc: 'ML scoring to remove low-signal' },
                                                                { key: 'html_shield', label: 'Strip HTML Artifacts', desc: 'Clean tags & encoded entities' },
                                                                { key: 'language_focus', label: 'English Only', desc: 'Filter non-English feedback' },
                                                            ].map(opt => {
                                                                const isOn = !!cleaningOptions[opt.key];
                                                                return (
                                                                    <button key={opt.key}
                                                                        onClick={() => setCleaningOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                                                                        className={`group w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                                                                            isOn ? 'bg-indigo-50/50 border-indigo-600 shadow-[0_2px_10px_-3px_rgba(79,70,229,0.2)]' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                                                                        }`}
                                                                    >
                                                                        <div className={`mt-0.5 w-5 h-5 rounded-[6px] flex items-center justify-center shrink-0 border-2 transition-colors ${
                                                                            isOn ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'
                                                                        }`}>
                                                                            {isOn && <svg className="w-3 h-3 text-white" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                                                        </div>
                                                                        <div>
                                                                            <p className={`text-[13px] font-bold leading-tight mb-0.5 ${isOn ? 'text-indigo-900' : 'text-slate-700'}`}>{opt.label}</p>
                                                                            <p className="text-[11px] text-slate-500 leading-snug">{opt.desc}</p>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                </div>

                                                {/* CTA Footer */}
                                                <div className="shrink-0 border-t border-slate-200/80 bg-white/95 p-4 backdrop-blur">
                                                    <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                                                        <div>
                                                            <div className="text-base font-black text-slate-800">{filteredReviews.length}</div>
                                                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Reviews</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-base font-black text-slate-800">{avgScore}</div>
                                                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Avg Score</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-base font-black text-slate-800">{Object.values(cleaningOptions).filter(Boolean).length}</div>
                                                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Cleaners</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={handleStartAnalysis}
                                                        disabled={filteredReviews.length === 0}
                                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-bold tracking-wide text-white transition-all hover:from-indigo-700 hover:to-sky-600 hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <Cpu size={15} />
                                                        Run Analysis ({filteredReviews.length} reviews)
                                                    </button>
                                                </div>
                                            </div>

                                        {/* ── RIGHT PANEL: Review Table ── */}
                                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.7),rgba(255,255,255,0.92))]">
                                            {/* Table Header Bar */}
                                            <div className="z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-8 py-5 shadow-sm backdrop-blur shrink-0">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-lg font-black tracking-tight text-slate-950">Review Preview</h3>
                                                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">{filteredReviews.length} records</span>
                                                        {filteredReviews.length < (previewReviews||[]).length && (
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{(previewReviews||[]).length - filteredReviews.length} Filtered</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {cleaningOptions.token_efficiency && <span className="text-[10px] font-bold shadow-sm flex items-center gap-1.5 text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-xl"><Zap size={12} className="text-yellow-500" /> Token Eff.</span>}
                                                    {cleaningOptions.magic_clean && <span className="text-[10px] font-bold shadow-sm flex items-center gap-1.5 text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl"><Sparkles size={12} className="text-violet-500" /> Magic</span>}
                                                    {cleaningOptions.html_shield && <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">🛡 HTML</span>}
                                                    {cleaningOptions.language_focus && <span className="text-[9px] font-black uppercase tracking-tighter text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">🔤 EN</span>}
                                                </div>
                                            </div>

                                            {/* Scrollable Table */}
                                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur shadow-[0_1px_rgba(0,0,0,0.06)]">
                                                        <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                            <th className="px-8 py-4 w-32 font-bold">Date</th>
                                                            <th className="px-6 py-4 w-28 font-bold">Source</th>
                                                            <th className="px-6 py-4 font-bold">Review</th>
                                                            <th className="px-8 py-4 text-right w-36 font-bold">Rating</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100/50 bg-white">
                                                        {filteredReviews.length === 0 ? (
                                                            <tr><td colSpan={4} className="px-8 py-32 text-center">
                                                                <div className="flex flex-col items-center gap-4">
                                                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                                        <Filter size={28} className="text-slate-300" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-700 mb-1">No matching reviews</p>
                                                                        <p className="text-xs text-slate-400">Adjust filters in the left panel to expand your search</p>
                                                                    </div>
                                                                </div>
                                                            </td></tr>
                                                        ) : filteredReviews.map((rev, idx) => {
                                                            const score = Number(rev?.score) || 3;
                                                            const borderCls = score >= 4 ? 'border-l-emerald-400' : score <= 2 ? 'border-l-rose-400' : 'border-l-amber-400';
                                                            const qualityBadge = score >= 4
                                                                ? { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Clean' }
                                                                : score <= 2
                                                                ? { cls: 'bg-rose-50 text-rose-700 border-rose-200', label: 'At-Risk' }
                                                                : { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Neutral' };
                                                            return (
                                                                <tr key={idx} className={`border-l-[3px] border-y hover:bg-slate-50/80 transition-all duration-200 group ${borderCls} ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                                    <td className="px-8 py-5 text-[11px] text-slate-400 font-bold whitespace-nowrap align-top tabular-nums pt-6">
                                                                        {rev?.date?.split('T')[0] || '—'}
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top pt-6">
                                                                        <span className="inline-flex items-center text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 group-hover:bg-white group-hover:border-slate-300 group-hover:shadow-sm transition-all">
                                                                            {rev?.source || '—'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top">
                                                                        <p className="text-[13px] text-slate-600 font-medium leading-[1.6] group-hover:text-slate-900 transition-colors line-clamp-3 mb-2.5 pr-8">
                                                                            {rev?.content || '—'}
                                                                        </p>
                                                                        <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${qualityBadge.cls}`}>
                                                                            {qualityBadge.label}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-8 py-5 text-right align-top pt-6">
                                                                        <div className="flex justify-end gap-1">
                                                                            {[...Array(5)].map((_, i) => (
                                                                                <Star key={i} size={14}
                                                                                    className={i < score ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-slate-200'}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Footer Stats Bar */}
                                            <div className="flex items-center justify-between border-t border-slate-200/80 bg-white/90 px-6 py-4 backdrop-blur shrink-0">
                                                <div className="flex gap-8">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dataset</div>
                                                        <div className="text-lg font-black text-slate-900 leading-none mt-0.5">
                                                            {filteredReviews.length} <span className="text-[10px] font-bold text-slate-400">reviews</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Score</div>
                                                        <div className="text-lg font-black text-slate-900 leading-none mt-0.5">
                                                            {avgScore} <span className="text-[10px] font-bold text-slate-400">/ 5</span>
                                                        </div>
                                                    </div>
                                                    {arpu > 0 && (
                                                        <div className="border-l border-slate-200 pl-8">
                                                            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">ARPU</div>
                                                            <div className="text-lg font-black text-emerald-600 leading-none mt-0.5">${Number(arpu).toFixed(2)}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    <span className="text-[11px] font-bold text-slate-500">Ready to analyze</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })()}

                                {error && (
                                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm mt-6">
                                        <AlertCircle size={16} /> {error}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ====== ANALYSIS HISTORY TAB ====== */}
                        {sidebarTab === 'history' && (
                            <motion.div key="history" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="p-8 max-w-[1200px] mx-auto px-10">
                                <div className="mb-8">
                                    <h1 className="text-[22px] font-bold text-slate-900 mb-1 tracking-tight">Analysis History</h1>
                                    <p className="text-slate-500 text-[13px]">View and revisit past analysis runs.</p>
                                </div>
                                {isLoadingHistory ? (
                                    <div className="flex flex-col items-center py-20 gap-4">
                                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                                        <span className="text-[13px] text-slate-400 font-medium">Loading history...</span>
                                    </div>
                                ) : analysisHistory.length > 0 ? (
                                    <div className="space-y-4">
                                        {analysisHistory.map(a => (
                                            <div key={a.id} className="bg-white border border-slate-200/80 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-card-hover transition-all cursor-pointer group"
                                                onClick={() => { 
                                                    const hardened = hardenResults(a.results);
                                                    setResults(hardened); 
                                                    setCurrentStep(4); 
                                                }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                                <BarChart2 size={16} className="text-indigo-600" />
                                                            </div>
                                                            <span className="text-[15px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Analysis #{a.id}</span>
                                                            <span className="text-[10px] bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider ml-1">{a.vertical || 'generic'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[12px] text-slate-400 ml-10">
                                                            <span className="flex items-center gap-1.5"><Database size={12} /> {a.total_reviews || 0} records analyzed</span>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {new Date(a.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-indigo-600 flex items-center justify-center transition-colors text-slate-400 group-hover:text-white">
                                                        <ArrowRight size={14} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-24 border border-dashed border-slate-200 rounded-2xl bg-white">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-5">
                                            <BarChart2 size={24} className="text-slate-300" />
                                        </div>
                                        <h3 className="text-[15px] font-bold text-slate-800 mb-1.5">No analyses yet</h3>
                                        <p className="text-[13px] text-slate-400">Run your first analysis from the Connectors tab.</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ====== SURVEY BUILDER TAB ====== */}
                        {sidebarTab === 'surveys' && (
                            isPreviewMode ? (
                                <motion.div key="surveys" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="h-full">
                                    <PreviewReadOnlyPanel
                                        title="Survey builder preview"
                                        description="Preview mode keeps survey authoring and publishing disabled. Activate an access code to create questionnaires and capture live responses."
                                        accent="violet"
                                    />
                                </motion.div>
                            ) : (
                                <motion.div key="surveys" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="h-full">
                                    <SurveyBuilder user={user} />
                                </motion.div>
                            )
                        )}

                        {/* ====== COPILOT CHAT TAB ====== */}
                        {sidebarTab === 'chat' && (
                            isPreviewMode ? (
                                <motion.div key="chat" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="h-full">
                                    <PreviewReadOnlyPanel
                                        title="Copilot preview"
                                        description="The assistant shell is visible in preview, but message sending and workspace-aware reasoning stay disabled until the user signs in."
                                        accent="amber"
                                    />
                                </motion.div>
                            ) : (
                                <motion.div key="chat" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="h-full">
                                    <CopilotChat />
                                </motion.div>
                            )
                        )}

                        {/* ====== OPERATIONS TABS ====== */}
                        {['settings', 'billing', 'docs'].includes(sidebarTab) && (
                            <motion.div key={sidebarTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="h-full">
                                <HorizonWorkspaceOps
                                    panel={sidebarTab}
                                    user={user}
                                    workspace={workspace}
                                    connectors={activeNodes}
                                    isPreviewMode={isPreviewMode}
                                    onUserUpdated={onUserUpdated}
                                    onWorkspaceUpdated={onWorkspaceUpdated}
                                    onConnectorsUpdated={fetchWorkspaceConnectors}
                                    initialDocSlug={initialDocSlug}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    )}
                </div>
            </div>

            <CopilotAnchor />
        </div>
        </ResolutionAdaptiveShell>
        </GlobalErrorBoundary>
    );
};


const CopilotAnchor = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={`fixed right-0 top-16 bottom-0 bg-white border-l border-slate-200/80 transition-all duration-500 ease-in-out z-50 shadow-2xl ${isOpen ? 'w-[450px] translate-x-0' : 'w-[450px] translate-x-full overflow-hidden'}`}>
            {isOpen && (
                <div className="h-full flex flex-col relative overflow-hidden bg-[#f7f8fa]">
                    <div className="p-6 border-b border-slate-200/60 flex items-center justify-between bg-white shadow-sm z-10 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-200 group cursor-pointer border border-indigo-500/30">
                                <Cpu size={22} className="group-hover:rotate-90 transition-transform duration-500 text-white drop-shadow-sm" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[16px] tracking-tight text-slate-900 leading-none mb-1">Cortex Navigator</h3>
                                <p className="text-[10px] text-slate-400 font-semibold tracking-[0.15em] uppercase flex items-center gap-1.5 opacity-80">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Autonomous Intelligence
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center hover:bg-slate-100 hover:text-rose-500 hover:border-rose-200 transition-all text-slate-400">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        {/* Gradient bleed from top */}
                        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white to-transparent pointer-events-none z-10"></div>
                        <CopilotChat />
                    </div>
                </div>
            )}
            
            {!isOpen && (
                <motion.button 
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    onClick={() => setIsOpen(true)}
                    className="absolute -left-20 bottom-8 w-14 h-14 rounded-2xl bg-slate-900 text-white hover:bg-indigo-600 flex items-center justify-center shadow-xl hover:shadow-indigo-600/40 transition-all duration-300 z-[70] group border border-slate-700 hover:border-indigo-500"
                >
                    <Cpu size={24} className="group-hover:rotate-180 transition-transform duration-500 drop-shadow-sm" />
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-white animate-pulse shadow-sm"></div>
                </motion.button>
            )}
        </div>
    );
};

const ThemeModeToggle = ({ isDarkMode, onToggle, inline = false }) => {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`horizon-theme-static inline-flex items-center gap-2 border border-slate-300/80 bg-white/90 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur transition-all hover:border-slate-400 hover:bg-white ${
                inline
                    ? 'w-full justify-between rounded-xl px-3 py-2.5'
                    : 'fixed bottom-4 right-4 z-[140] rounded-xl px-3 py-2'
            }`}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <span className="inline-flex items-center gap-2">
                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </span>
            {inline && <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Appearance</span>}
        </button>
    );
};

// The Landing Page view that survived the reset - Cinematic Reconstruction
const HorizonLandingView = ({ onStart }) => {
    return (
        <section id="horizon" className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#020408] selection:bg-cyan-500/30">
            {/* Cinematic Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/15 rounded-full blur-[140px] animate-pulse"></div>
                <div className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]"></div>
                
                {/* Grid Pattern Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,4,8,0.85)_100%),url('https://grainy-gradients.vercel.app/noise.svg')] opacity-25 pointer-events-none mix-blend-overlay"></div>
                
                {/* Scan lines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,.15)_50%),linear-gradient(90deg,rgba(255,0,0,.04),rgba(0,255,0,.02),rgba(0,0,255,.04))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-20"></div>
            </div>

            <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center"
                >
                    <div className="inline-flex items-center gap-3 py-1.5 px-5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl text-white/80 font-mono text-[10px] mb-12 tracking-[0.3em] uppercase shadow-2xl">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping shadow-[0_0_10px_rgba(6,182,212,0.8)]"></span>
                        <span className="opacity-60">System:</span> Horizon_<span className="text-cyan-400 font-bold">Intelligence_Core</span>_v5.0
                    </div>

                    <h1 className="text-6xl md:text-[7rem] font-black mb-6 tracking-tight leading-[0.85] text-white">
                        The <span className="bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 via-indigo-400 to-fuchsia-400 drop-shadow-[0_0_40px_rgba(99,102,241,0.2)]">Ultimate</span>
                        <br />
                        <span className="opacity-50">Intelligence.</span>
                    </h1>
                    
                    <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-16 leading-relaxed font-medium uppercase tracking-[0.15em] text-[13px]">
                        Autonomous Strategic Mapping for <span className="text-white drop-shadow-sm">Enterprise Signal Analysis</span>.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <motion.button 
                            whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onStart}
                            className="px-12 py-5 bg-white text-black font-black rounded-2xl group relative overflow-hidden transition-all duration-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 border border-transparent shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                        >
                            <span className="relative z-10 uppercase tracking-[0.15em] text-[13px]">Enter Command Center</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                        </motion.button>
                        
                        <div className="flex items-center gap-4 px-8 py-6 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md opacity-60 hover:opacity-100 transition-opacity cursor-wait">
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] font-black font-mono tracking-tighter text-slate-500">LATENCY_SYNC_OK</span>
                                <span className="text-sm font-bold text-white tracking-widest">0.04ms</span>
                            </div>
                            <div className="h-4 w-[1px] bg-white/10 mx-2"></div>
                            <Terminal size={20} className="text-cyan-500" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Matrix-like floating elements */}
            <div className="absolute bottom-12 left-12 space-y-2 opacity-10 font-mono text-[10px] hidden lg:block">
                <div>[SYSTEM_KERNEL_UPLINK] 127.0.0.1:8000</div>
                <div>[CORTEX_INIT] SUCCEEDED</div>
                <div>[NEURAL_SYNC] 100%</div>
                <div>[SIGNAL_VECTORS] STABLE</div>
            </div>
            
            <div className="absolute top-12 right-12 opacity-10 animate-pulse hidden lg:block">
                <div className="w-12 h-1 bg-white mb-1"></div>
                <div className="w-8 h-1 bg-white mb-1 ml-4"></div>
                <div className="w-14 h-1 bg-white ml-2"></div>
            </div>
        </section>
    );
};

export default HorizonStandalone;
