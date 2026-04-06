import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    BarChart2,
    CheckCircle2,
    FileSpreadsheet,
    Layers,
    Lock,
    MessageSquareQuote,
    ShieldAlert,
    Sparkles,
    Target,
    Workflow
} from 'lucide-react';
import logoAppStore from '../assets/appstore.png';
import logoPlayStore from '../assets/playstore.png';
import logoCRM from '../assets/sforce.png';
import logoSurveyMonkey from '../assets/surveymonkey.png';
import logoWebhook from '../assets/webhook.png';
import logoCsv from '../assets/xcel.png';
import logoHubSpot from '../assets/hubspot.svg';
import logoTrustpilot from '../assets/trustpilot.svg';
import Contact from './Contact';
import { useHorizonAvailabilityNotice } from './HorizonAvailabilityNoticeProvider';

const quickStats = [
    ['5%+', 'retention lift targeted'],
    ['75%', 'revenue upside potential'],
    ['<24h', 'to team action']
];

const heroHighlights = [
    'One unified customer timeline',
    'Early churn alerts',
    'Fast team action'
];

const retentionImpactPoints = [
    {
        title: 'Unified Signals',
        value: '8 live sources',
        copy: 'Reviews, CRM, support, and surveys in one view.',
        fill: '82%'
    },
    {
        title: 'Churn Response',
        value: '<24h action',
        copy: 'Critical issues routed instantly to the right team.',
        fill: '74%'
    },
    {
        title: 'Revenue Impact',
        value: 'Up to +75%',
        copy: 'A 5% retention lift can compound revenue growth.',
        fill: '68%'
    }
];

const integrations = [
    { name: 'App Store', image: logoAppStore },
    { name: 'Play Store', image: logoPlayStore },
    { name: 'Salesforce', image: logoCRM },
    { name: 'HubSpot', image: logoHubSpot },
    { name: 'SurveyMonkey', image: logoSurveyMonkey },
    { name: 'CSV', image: logoCsv },
    { name: 'Trustpilot', image: logoTrustpilot },
    { name: 'Webhooks', image: logoWebhook }
];

const rotatingPreviewLogos = [
    {
        name: 'App Store',
        image: logoAppStore,
        gradient: 'from-sky-300 via-cyan-400 to-blue-500'
    },
    {
        name: 'Play Store',
        image: logoPlayStore,
        gradient: 'from-emerald-200 via-cyan-200 to-sky-300'
    },
    {
        name: 'Trustpilot',
        image: logoTrustpilot,
        gradient: 'from-emerald-100 via-lime-100 to-green-200'
    },
    {
        name: 'SurveyMonkey',
        image: logoSurveyMonkey,
        gradient: 'from-lime-200 via-emerald-200 to-cyan-200'
    },
    {
        name: 'CSV',
        kind: 'csv',
        gradient: 'from-emerald-100 via-teal-100 to-cyan-100'
    },
    {
        name: 'HubSpot',
        image: logoHubSpot,
        gradient: 'from-orange-100 via-amber-100 to-orange-200'
    },
    {
        name: 'Salesforce',
        image: logoCRM,
        gradient: 'from-sky-100 via-cyan-100 to-blue-200'
    }
];

const PreviewLogoArtwork = ({ logo }) => {
    if (logo.kind === 'csv') {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.92))] text-emerald-700">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <FileSpreadsheet size={54} strokeWidth={1.8} />
                </div>
                <div className="mt-5 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-xs font-bold tracking-[0.32em] text-emerald-700">
                    CSV
                </div>
                <p className="mt-3 text-sm font-medium text-slate-500">Uploads</p>
            </div>
        );
    }

    return (
        <img
            src={logo.image}
            alt={logo.name}
            className="max-h-[150px] w-auto max-w-full object-contain"
        />
    );
};

const coreCards = [
    {
        title: 'Know customers clearly',
        copy: 'Unify reviews, support, CRM, and surveys into one customer truth.',
        icon: Layers
    },
    {
        title: 'Act quickly on risk',
        copy: 'Surface churn signals, recurring friction, and renewal blockers early.',
        icon: ShieldAlert
    },
    {
        title: 'Protect recurring revenue',
        copy: 'Give product, support, and growth teams a shared retention action plan.',
        icon: Target
    }
];

const summaryToneStyles = {
    cyan: {
        icon: 'bg-cyan-100 text-cyan-700',
        badge: 'border-cyan-200 bg-cyan-50/90 text-cyan-700',
        glow: 'from-cyan-300/25 via-cyan-100/0 to-transparent'
    },
    amber: {
        icon: 'bg-amber-100 text-amber-700',
        badge: 'border-amber-200 bg-amber-50/90 text-amber-700',
        glow: 'from-amber-300/30 via-amber-100/0 to-transparent'
    },
    emerald: {
        icon: 'bg-emerald-100 text-emerald-700',
        badge: 'border-emerald-200 bg-emerald-50/90 text-emerald-700',
        glow: 'from-emerald-300/25 via-emerald-100/0 to-transparent'
    }
};

const summaryCards = [
    {
        label: 'Unified signals',
        value: 'Reviews, support, CRM, surveys, and subscriptions',
        meta: '8 live feeds',
        tone: 'cyan',
        icon: Layers
    },
    {
        label: 'Top churn driver',
        value: 'Onboarding and feature-gap friction rising across channels',
        meta: 'Escalating',
        tone: 'amber',
        icon: ShieldAlert
    },
    {
        label: 'Next best action',
        value: 'One retention brief with team-level ownership',
        meta: 'Auto-routed',
        tone: 'emerald',
        icon: Workflow
    }
];

const previewSignalPills = ['Reviews', 'Support', 'CRM'];

const riskTrendTags = ['Onboarding', 'Feature gaps', 'Support lag'];

const steps = [
    {
        title: 'Connect',
        copy: 'Sync the channels where subscribers share feedback.',
        icon: Layers
    },
    {
        title: 'Analyze',
        copy: 'Horizon groups root problems and ranks impact by churn risk.',
        icon: BarChart2
    },
    {
        title: 'Act',
        copy: 'Teams execute from one shared priority list and close the loop faster.',
        icon: Workflow
    }
];

const feedbackDemo = {
    source: 'App Store review',
    app: 'OrbitFlow iOS',
    plan: 'Annual Pro subscription',
    rating: '2-star',
    author: 'Maya K.',
    persona: 'Power user',
    tenure: '14 months active',
    renewalWindow: 'Due in 3 days',
    status: 'Renewal cancelled',
    summary: 'Billing access broke right before renewal.',
    quote: 'Logged out again, paywall back, and support arrived too late.',
    feedback:
        'I like the product, but I keep getting logged out and the paywall shows up again even though I already paid for Pro. Support replied too late, so I cancelled my renewal for now.'
};

const feedbackReviewTags = [feedbackDemo.source, feedbackDemo.app, feedbackDemo.rating];

const feedbackSentimentSummary = [
    { label: 'Primary sentiment', value: 'Negative', tone: 'rose' },
    { label: 'Business risk', value: 'High churn risk', tone: 'amber' },
    { label: 'Owning teams', value: 'Product + Support', tone: 'cyan' }
];

const feedbackMainProblem = {
    title: 'Billing and entitlement mismatch',
    problem: 'The subscriber keeps losing Pro access and sees the paywall again right before renewal.',
    impact: 'Because support replies too late, the account cancels before the team can recover it.',
    retention: 'Send a rescue note, restore access, add a credit, and escalate billing.'
};

const teamCards = [
    ['Product', 'Prioritize roadmap work that removes churn drivers and feature gaps.'],
    ['Support', 'Catch recurring pain quickly and resolve issues before renewals fail.'],
    ['Growth', 'Trigger rescue and lifecycle actions from real customer risk signals.'],
    ['Leadership', 'Monitor retention impact and recurring revenue exposure in one place.']
];

const bars = [24, 36, 48, 44, 61, 74, 66, 84];

const Home = () => {
    const navigate = useNavigate();
    const { openHorizonAvailabilityNotice, isHorizonLocked } = useHorizonAvailabilityNotice();
    const [activeLogoIndex, setActiveLogoIndex] = useState(0);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setActiveLogoIndex((current) => (current + 1) % rotatingPreviewLogos.length);
        }, 1200);

        return () => window.clearInterval(intervalId);
    }, []);

    const activePreviewLogo = rotatingPreviewLogos[activeLogoIndex];

    return (
        <div className="relative overflow-hidden pb-24 text-left text-slate-900">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(circle_at_8%_8%,rgba(59,130,246,0.24),transparent_24%),radial-gradient(circle_at_92%_10%,rgba(34,211,238,0.28),transparent_25%),radial-gradient(circle_at_48%_18%,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,251,255,0.12))]" />
            <div className="pointer-events-none absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-300/30 blur-[120px]" />
            <div className="pointer-events-none absolute right-[-56px] top-16 h-80 w-80 rounded-full bg-blue-300/28 blur-[140px]" />
            <div className="pointer-events-none absolute left-[42%] top-28 h-64 w-64 rounded-full bg-emerald-200/22 blur-[130px]" />

            <div className="relative px-4 pt-16 md:hidden">
                <motion.section
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="rounded-[30px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.28)]"
                >
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                        <Sparkles size={12} />
                        Unified Feedback Intelligence
                    </div>

                    <h1 className="mt-4 text-[34px] font-semibold leading-[0.95] tracking-tight text-slate-950">
                        Know customers.
                        <br />
                        Retain subscribers.
                    </h1>

                    <p className="mt-4 text-sm leading-relaxed text-slate-600">
                        Built for subscription brands to unify feedback and act fast on churn signals.
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                        <Lock size={12} />
                        Horizon Available Soon
                    </div>

                    <div className="mt-5 flex flex-col gap-2.5">
                        <button
                            onClick={openHorizonAvailabilityNotice}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                        >
                            <Lock size={14} />
                            Horizon Available Soon
                        </button>
                        <button
                            onClick={() => navigate('/#contact')}
                            className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                        >
                            Join waitlist
                        </button>
                    </div>
                </motion.section>

                <section className="mt-4 rounded-[30px] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.24)]">
                    <div className={`relative overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br ${activePreviewLogo.gradient} p-4`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_44%)]" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">Live feedback stream</p>
                                <span className="rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                                    {activePreviewLogo.name}
                                </span>
                            </div>
                            <div className="mt-4 flex items-center justify-center">
                                <div className="flex h-[132px] w-[132px] items-center justify-center rounded-[28px] border border-white/70 bg-white/88 p-4 shadow-[0_22px_45px_-36px_rgba(15,23,42,0.42)]">
                                    <PreviewLogoArtwork logo={activePreviewLogo} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {heroHighlights.map((item) => (
                            <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                                {item}
                            </span>
                        ))}
                    </div>
                </section>

                <section className="mt-4 grid grid-cols-3 gap-2">
                    {quickStats.map(([value, label]) => (
                        <div key={value} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_35px_-36px_rgba(15,23,42,0.4)]">
                            <p className="text-xl font-semibold leading-none text-slate-950">{value}</p>
                            <p className="mt-2 text-[11px] leading-tight text-slate-500">{label}</p>
                        </div>
                    ))}
                </section>

                <section className="mt-4 rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.24)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">How it works</p>
                    <h2 className="mt-2 text-xl font-semibold leading-tight text-slate-950">Clear path from feedback to action</h2>

                    <div className="mt-4 space-y-2.5">
                        {steps.map((step, idx) => {
                            const Icon = step.icon;

                            return (
                                <article key={step.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                                    <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                                        <Icon size={15} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                            Step {idx + 1}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.copy}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="mt-4 rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.24)]">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Integrations</p>
                        <span className="text-xs font-semibold text-slate-500">Live sources</span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                        {integrations.slice(0, 8).map((item) => (
                            <div key={item.name} className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2">
                                <img src={item.image} alt={item.name} className="max-h-7 w-auto max-w-full object-contain" />
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <div className="hidden md:block">
            <section className="relative px-6 pt-20 md:pt-24 xl:px-8">
                <div className="mx-auto max-w-[1760px]">
                    <div className="grid items-center gap-12 xl:grid-cols-[0.82fr_1.18fr]">
                        <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.65 }}
                            className="w-full max-w-[880px]"
                        >
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                                <Sparkles size={14} />
                                Unified Feedback Intelligence Platform
                            </div>

                            <h1 className="mt-8 text-5xl font-semibold leading-[0.95] tracking-tight text-slate-950 sm:text-6xl xl:text-[84px]">
                                Know your customers.
                                <br />
                                Act on feedback quickly.
                            </h1>

                            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
                                Built for subscription brands to unify feedback, spot churn early, and act fast.
                            </p>

                            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800">
                                A 5% retention lift can drive up to 75% revenue growth.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-4">
                                <button
                                    onClick={openHorizonAvailabilityNotice}
                                    className="group inline-flex items-center gap-2 rounded-full bg-slate-950 px-7 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800"
                                >
                                    {isHorizonLocked && <Lock size={15} />}
                                    {isHorizonLocked ? 'Horizon Available Soon' : 'Preview Horizon'}
                                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                                </button>
                                <button
                                    onClick={() => navigate('/#contact')}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    Book a walkthrough
                                </button>
                            </div>

                            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                                {quickStats.map(([value, label]) => (
                                    <div key={value} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.35)]">
                                        <p className="text-3xl font-semibold text-slate-950">{value}</p>
                                        <p className="mt-2 text-sm text-slate-500">{label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2.5">
                                {heroHighlights.map((item) => (
                                    <div
                                        key={item}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.35)]"
                                    >
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                Built for subscription-first product, support, growth, and leadership teams
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.75, delay: 0.12 }}
                            className="relative"
                        >
                            <div className="absolute -top-12 right-0 h-56 w-56 rounded-full bg-cyan-300/72 blur-[110px]" />
                            <div className="absolute bottom-0 -left-6 h-60 w-60 rounded-full bg-blue-300/62 blur-[120px]" />
                            <div className="absolute left-[34%] top-24 h-40 w-40 rounded-full bg-emerald-200/45 blur-[95px]" />

                            <div className="relative rounded-[34px] border border-slate-200 bg-white p-4 shadow-[0_40px_90px_-45px_rgba(15,23,42,0.35)] sm:p-5">
                                <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                    </div>
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                        Live preview
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-3">
                                        <div className={`relative overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br ${activePreviewLogo.gradient} p-5 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.28)] sm:p-6`}>
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.66),transparent_42%)]" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="h-[220px] w-[220px] rounded-full border border-white/45 bg-white/8 sm:h-[250px] sm:w-[250px]" />
                                                <div className="absolute h-[300px] w-[300px] rounded-full border border-white/28 sm:h-[340px] sm:w-[340px]" />
                                                <div className="absolute h-[380px] w-[380px] rounded-full border border-white/18 sm:h-[430px] sm:w-[430px]" />
                                            </div>
                                            <div className="absolute -top-8 right-1 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
                                            <div className="absolute -bottom-10 left-2 h-40 w-40 rounded-full bg-cyan-200/28 blur-3xl" />
                                            <div className="absolute inset-x-10 bottom-8 h-20 rounded-full bg-white/28 blur-3xl" />

                                            <div className="relative z-10 flex min-h-[360px] flex-col">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="flex max-w-[58%] flex-wrap gap-2">
                                                        {previewSignalPills.map((pill, index) => (
                                                            <span
                                                                key={pill}
                                                                className={`rounded-full border border-white/60 bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 backdrop-blur ${
                                                                    index === 2 ? 'hidden sm:inline-flex' : ''
                                                                }`}
                                                            >
                                                                {pill}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/60 bg-white/76 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 backdrop-blur">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.18)]" />
                                                        Live sync
                                                    </div>
                                                </div>

                                                <div className="flex flex-1 items-center justify-center px-2 pb-2 pt-5 sm:px-4 sm:pt-6">
                                                    <AnimatePresence mode="wait">
                                                        <motion.div
                                                            key={activePreviewLogo.name}
                                                            initial={{ opacity: 0, scale: 0.92, y: 12 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.96, y: -12 }}
                                                            transition={{ duration: 0.22, ease: 'easeOut' }}
                                                            className="relative z-10 flex flex-col items-center gap-4 text-center"
                                                        >
                                                            <div className="relative flex h-[204px] w-[204px] items-center justify-center rounded-[32px] border border-white/65 bg-white/88 p-5 shadow-[0_24px_72px_-36px_rgba(15,23,42,0.32)] backdrop-blur sm:h-[228px] sm:w-[228px] sm:rounded-[36px] sm:p-6">
                                                                <div className="absolute inset-x-10 bottom-4 h-10 rounded-full bg-slate-900/10 blur-2xl" />
                                                                <PreviewLogoArtwork logo={activePreviewLogo} />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <div className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/88 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                                                                    <CheckCircle2 size={15} className="text-emerald-500" />
                                                                    {activePreviewLogo.name}
                                                                </div>
                                                                <p className="mx-auto max-w-[24ch] text-xs font-medium leading-relaxed text-slate-600">
                                                                    Connected cleanly into one shared feedback stream.
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid gap-3">
                                            {summaryCards.map(({ label, value, meta, tone, icon: Icon }) => {
                                                const styles = summaryToneStyles[tone];

                                                return (
                                                    <div
                                                        key={label}
                                                        className="relative overflow-hidden rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,248,252,0.92))] p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.2)]"
                                                    >
                                                        <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-br ${styles.glow}`} />
                                                        <div className="relative flex items-start gap-3">
                                                            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
                                                                <Icon size={17} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                                                                    <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${styles.badge}`}>
                                                                        {meta}
                                                                    </span>
                                                                </div>
                                                                <p className="mt-2 text-[15px] font-semibold leading-relaxed text-slate-900">{value}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,247,255,0.94))] p-5 shadow-[0_24px_55px_-40px_rgba(15,23,42,0.22)]">
                                            <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 bg-cyan-200/35 blur-3xl" />
                                            <div className="pointer-events-none absolute left-8 bottom-0 h-24 w-24 bg-emerald-200/25 blur-3xl" />

                                            <div className="relative flex items-start justify-between gap-4">
                                                <div className="max-w-[24ch]">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Risk trend</p>
                                                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
                                                        Onboarding and feature gaps are rising together in churn feedback.
                                                    </p>
                                                </div>

                                                <div className="rounded-full border border-cyan-200 bg-white/88 px-3 py-2 text-right shadow-sm">
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700">+31% 30 days</p>
                                                </div>
                                            </div>

                                            <div className="relative mt-5">
                                                <div className="pointer-events-none absolute inset-x-0 top-4 h-px bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.3),transparent)]" />
                                                <div className="flex h-32 items-end gap-2 sm:gap-3">
                                                    {bars.map((height, index) => (
                                                        <div key={index} className="relative flex h-full flex-1 items-end">
                                                            <div className="absolute inset-x-0 bottom-0 h-full rounded-t-[20px] bg-slate-100/70" />
                                                            <motion.div
                                                                className="relative w-full rounded-t-[20px] bg-gradient-to-t from-cyan-500 via-sky-400 to-emerald-300 shadow-[0_18px_30px_-20px_rgba(14,165,233,0.7)]"
                                                                initial={{ height: 12 }}
                                                                animate={{ height: `${height}%` }}
                                                                transition={{ duration: 0.6, delay: index * 0.05 }}
                                                            />
                                                            {index === bars.length - 1 && (
                                                                <div className="absolute right-0 top-1 rounded-full border border-cyan-200 bg-white/92 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-700 shadow-sm">
                                                                    Peak
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {riskTrendTags.map((tag) => (
                                                    <span key={tag} className="rounded-full border border-slate-200 bg-white/88 px-3 py-1 text-[11px] font-medium text-slate-600">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            <section className="relative mt-12 px-6 xl:px-8">
                <div className="relative mx-auto max-w-[1760px] overflow-hidden rounded-[34px] border border-slate-200 bg-[linear-gradient(170deg,rgba(255,255,255,0.99),rgba(236,252,255,0.95))] p-6 shadow-[0_30px_80px_-56px_rgba(14,116,144,0.45)] md:p-7">
                    <div className="pointer-events-none absolute left-0 top-0 h-40 w-40 rounded-full bg-cyan-200/35 blur-[100px]" />
                    <div className="pointer-events-none absolute right-4 top-8 h-40 w-40 rounded-full bg-emerald-200/35 blur-[100px]" />

                    <div className="relative grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
                        <div className="max-w-2xl">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Retention impact</p>
                            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                                Retention growth in one glance.
                            </h2>
                            <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
                                Clean signals. Faster fixes. Better renewals.
                            </p>
                        </div>
                        <div className="rounded-[22px] border border-cyan-200 bg-white/90 p-4 text-sm leading-relaxed text-slate-700 shadow-[0_24px_50px_-44px_rgba(14,116,144,0.45)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Revenue truth</p>
                            <p className="mt-2 text-base font-semibold text-slate-950">
                                A 5% improvement in retention can boost revenue by up to 75%.
                            </p>
                        </div>
                    </div>

                    <div className="relative mt-6 grid gap-4 md:grid-cols-3">
                        {retentionImpactPoints.map(({ title, value, copy, fill }) => (
                            <article key={title} className="rounded-[26px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_50px_-44px_rgba(15,23,42,0.35)]">
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
                                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-700">{copy}</p>
                                <div className="mt-4 h-2 rounded-full bg-slate-100">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400"
                                        style={{ width: fill }}
                                    />
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="relative mt-12 px-6 xl:px-8">
                <div className="relative mx-auto max-w-[1760px] overflow-hidden rounded-[34px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,250,255,0.92))] p-5 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.24)] md:p-6">
                    <div className="pointer-events-none absolute left-10 top-16 h-40 w-40 rounded-full bg-cyan-200/26 blur-[90px]" />
                    <div className="pointer-events-none absolute right-10 top-12 h-48 w-48 rounded-full bg-blue-200/22 blur-[110px]" />

                    <div className="relative">
                        <div className="grid gap-4 border-b border-slate-200/80 pb-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
                            <div className="max-w-2xl">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Feedback intelligence demo</p>
                                <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 md:text-4xl">
                                    One unhappy subscriber turned into a precise retention action plan.
                                </h2>
                                <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
                                    One review in, clear action out.
                                </p>
                            </div>

                            <div className="rounded-[24px] border border-slate-200 bg-white/82 px-4 py-3 text-sm leading-relaxed text-slate-600 lg:justify-self-end lg:max-w-[720px]">
                                Theme, urgency, owner, and impact in one compact card.
                            </div>
                        </div>

                        <div className="relative mt-5 overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,255,0.94))] p-4 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.2)] md:p-5">
                            <div className="pointer-events-none absolute left-[8%] top-16 h-28 w-28 rounded-full bg-cyan-100/60 blur-3xl" />
                            <div className="pointer-events-none absolute right-[10%] top-20 h-28 w-28 rounded-full bg-rose-100/45 blur-3xl" />
                            <div className="pointer-events-none absolute right-[18%] bottom-8 h-32 w-32 rounded-full bg-amber-100/45 blur-3xl" />
                            <div className="pointer-events-none absolute inset-x-12 top-[108px] hidden h-px bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.28),transparent)] lg:block" />

                            <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="max-w-2xl">
                                    <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                                        Simple flow
                                    </div>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                        Review to sentiment to root problem, with a quick AI retention action at the end.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                                        {feedbackDemo.plan}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                                        {feedbackDemo.tenure}
                                    </span>
                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700">
                                        {feedbackDemo.renewalWindow}
                                    </span>
                                </div>
                            </div>

                            <div className="relative mt-6">
                                <div className="pointer-events-none absolute inset-x-[14%] top-10 hidden h-px bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.3),transparent)] lg:block" />

                                <div className="relative grid gap-4 lg:grid-cols-[1.02fr_0.86fr_1.12fr] lg:items-stretch">
                                <motion.article
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-80px' }}
                                    transition={{ duration: 0.42 }}
                                    className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,250,253,0.96))] shadow-[0_28px_72px_-50px_rgba(15,23,42,0.22)] ring-1 ring-white/80"
                                >
                                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-500" />

                                    <div className="relative flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.96))] px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                                            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                        </div>
                                        <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                                            Review
                                        </span>
                                    </div>

                                    <div className="relative flex flex-1 flex-col gap-5 p-6">
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="max-w-[18ch] text-lg font-semibold leading-tight text-slate-950">
                                                {feedbackDemo.summary}
                                            </h3>
                                            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-700">
                                                Cancelled
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {feedbackReviewTags.map((item) => (
                                                <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="mt-auto rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200">
                                                    <MessageSquareQuote size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold text-slate-950">{feedbackDemo.author}</p>
                                                        <span className="text-xs text-slate-400">{feedbackDemo.persona}</span>
                                                    </div>
                                                    <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-slate-700">
                                                        "{feedbackDemo.quote}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.article>

                                <motion.article
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-80px' }}
                                    transition={{ duration: 0.42, delay: 0.07 }}
                                    className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,249,252,0.96))] shadow-[0_28px_72px_-50px_rgba(15,23,42,0.2)] ring-1 ring-white/80"
                                >
                                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-rose-300 via-rose-400 to-amber-300" />

                                    <div className="relative flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.96))] px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                                            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                        </div>
                                        <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-700">
                                            Sentiment
                                        </span>
                                    </div>

                                    <div className="relative flex flex-1 flex-col gap-5 p-6">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-[30px] font-semibold leading-none tracking-tight text-slate-950 sm:text-[34px]">Negative</h3>
                                                <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-slate-600">
                                                    Loyal usage is turning into churn right before renewal.
                                                </p>
                                            </div>
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                                High risk
                                            </span>
                                        </div>

                                        <div className="mt-auto grid gap-2.5">
                                            {feedbackSentimentSummary.map((item) => (
                                                <div key={item.label} className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                                                    <p
                                                        className={`text-xs font-semibold ${
                                                            item.tone === 'rose'
                                                                ? 'text-rose-700'
                                                                : item.tone === 'amber'
                                                                    ? 'text-amber-700'
                                                                    : 'text-cyan-700'
                                                        }`}
                                                    >
                                                        {item.value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.article>

                                <motion.article
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-80px' }}
                                    transition={{ duration: 0.42, delay: 0.14 }}
                                    className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(251,249,244,0.92))] shadow-[0_28px_78px_-52px_rgba(15,23,42,0.22)] ring-1 ring-white/80"
                                >
                                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-300 via-amber-400 to-orange-300" />

                                    <div className="relative flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.96))] px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                                            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                        </div>
                                        <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                                            Main problem
                                        </span>
                                    </div>

                                    <div className="relative flex flex-1 flex-col gap-5 p-6">
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="max-w-[22ch] text-xl font-semibold leading-tight text-slate-950">
                                                {feedbackMainProblem.title}
                                            </h3>
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                                Urgent
                                            </span>
                                        </div>

                                        <div className="grid gap-3 xl:grid-cols-2">
                                            <div className="rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,252,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Problem</p>
                                                <p className="mt-2 text-sm leading-relaxed text-slate-700">{feedbackMainProblem.problem}</p>
                                            </div>
                                            <div className="rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,252,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Impact</p>
                                                <p className="mt-2 text-sm leading-relaxed text-slate-700">{feedbackMainProblem.impact}</p>
                                            </div>
                                        </div>

                                        <div className="mt-auto rounded-[24px] border border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,250,255,0.88))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                                            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100">
                                                <Sparkles size={16} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700">Generate with AI</p>
                                                <p className="mt-1 text-sm font-semibold text-slate-950">Retention rescue draft</p>
                                                <p className="mt-2 text-xs leading-relaxed text-slate-600">{feedbackMainProblem.retention}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={openHorizonAvailabilityNotice}
                                                className="inline-flex shrink-0 items-center justify-center self-start rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:self-auto"
                                            >
                                                {isHorizonLocked && <Lock size={13} className="mr-1.5" />}
                                                {isHorizonLocked ? 'Available Soon' : 'Generate'}
                                            </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.article>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative mt-12 px-6 xl:px-8">
                <div className="mx-auto max-w-[1760px] rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.25)]">
                    <div className="grid gap-6 lg:grid-cols-[0.68fr_1.32fr] lg:items-center">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Connects with the tools you already use</p>
                            <h2 className="mt-3 text-2xl font-semibold text-slate-950">Bring every customer signal into one place.</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                            {integrations.map((item) => (
                                <div key={item.name} className="flex h-20 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <img src={item.image} alt={item.name} className="max-h-10 w-auto max-w-full object-contain" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative mt-16 px-6 xl:px-8">
                <div className="mx-auto max-w-[1760px]">
                    <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                        <div className="w-full max-w-[880px]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">What Horizon does</p>
                            <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                                Unify feedback. Know customers. Improve retention.
                            </h2>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 lg:ml-auto lg:max-w-[760px]">
                            <p className="text-sm leading-relaxed text-slate-600">
                                For subscription teams: collect signals, extract real problems, and execute before churn happens.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {coreCards.map((card, idx) => {
                            const Icon = card.icon;

                            return (
                                <motion.article
                                    key={card.title}
                                    initial={{ opacity: 0, y: 18 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-80px' }}
                                    transition={{ duration: 0.45, delay: idx * 0.06 }}
                                    className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)]"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                                        <Icon size={20} />
                                    </div>
                                    <h3 className="mt-5 text-2xl font-semibold leading-tight text-slate-950">{card.title}</h3>
                                    <p className="mt-4 text-base leading-relaxed text-slate-600">{card.copy}</p>
                                </motion.article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="relative mt-16 px-6 scroll-mt-32 xl:px-8">
                <div className="mx-auto grid max-w-[1760px] gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                    <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_-48px_rgba(15,23,42,0.24)] md:p-8">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">How it works</p>
                        <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                            From scattered feedback to one action plan.
                        </h2>

                        <div className="mt-8 space-y-4">
                            {[
                                'Collect feedback from every customer touchpoint in one feed',
                                'Identify churn drivers with clear root-cause and urgency context',
                                'Launch team-specific actions and track retention impact quickly'
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                                    <span className="text-sm leading-relaxed text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-wrap gap-4">
                            <button
                                onClick={openHorizonAvailabilityNotice}
                                className="group inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800"
                            >
                                {isHorizonLocked && <Lock size={15} />}
                                {isHorizonLocked ? 'Horizon Available Soon' : 'Explore the product'}
                                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                            </button>
                            <button
                                onClick={() => navigate('/#contact')}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                Speak with Hyzync
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {steps.map((step, idx) => {
                            const Icon = step.icon;

                            return (
                                <motion.article
                                    key={step.title}
                                    initial={{ opacity: 0, y: 18 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-80px' }}
                                    transition={{ duration: 0.45, delay: idx * 0.06 }}
                                    className={`rounded-[30px] border border-slate-200 p-6 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.22)] ${
                                        idx === 0 ? 'bg-cyan-50' : 'bg-white'
                                    }`}
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                                        <Icon size={20} />
                                    </div>
                                    <h3 className="mt-5 text-2xl font-semibold leading-tight text-slate-950">{step.title}</h3>
                                    <p className="mt-3 text-base leading-relaxed text-slate-600">{step.copy}</p>
                                </motion.article>
                            );
                        })}

                        <div className="rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_28px_70px_-46px_rgba(15,23,42,0.34)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Core outcome</p>
                            <h3 className="mt-4 text-2xl font-semibold leading-tight">
                                Every team sees the same customer truth.
                            </h3>
                            <p className="mt-3 text-base leading-relaxed text-white/70">
                                That means faster prioritization, cleaner ownership, and fewer missed customer signals.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative mt-16 px-6 xl:px-8">
                <div className="mx-auto max-w-[1760px] rounded-[34px] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_-48px_rgba(15,23,42,0.24)] md:p-8">
                    <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                        <div className="w-full max-w-[880px]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Built for teams that act</p>
                            <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                                Product, support, growth, and leadership stay aligned.
                            </h2>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 lg:ml-auto lg:max-w-[760px]">
                            <p className="text-sm leading-relaxed text-slate-600">
                                Different teams use the same signal differently, but Horizon makes sure everyone starts from the same customer truth.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {teamCards.map(([team, copy], idx) => (
                            <motion.article
                                key={team}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ duration: 0.45, delay: idx * 0.05 }}
                                className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{team}</p>
                                <p className="mt-4 text-base leading-relaxed text-slate-700">{copy}</p>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>
            </div>

            <Contact />
        </div>
    );
};

export default Home;
