import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    BarChart2,
    CheckCircle2,
    FileSpreadsheet,
    Layers,
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
import { useHorizonPreviewNotice } from './HorizonPreviewNoticeProvider';
import Contact from './Contact';

const quickStats = [
    ['7+', 'sources connected'],
    ['<24h', 'to team action'],
    ['1 view', 'for every team']
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
        title: 'Unify feedback',
        copy: 'Bring reviews, tickets, CRM, and surveys into one place.',
        icon: Layers
    },
    {
        title: 'Spot risk fast',
        copy: 'See churn signals, recurring issues, and rising friction early.',
        icon: ShieldAlert
    },
    {
        title: 'Drive action',
        copy: 'Show product, support, and growth exactly what to do next.',
        icon: Target
    }
];

const summaryCards = [
    ['Unified signals', 'Reviews, support, CRM, surveys, and uploads'],
    ['Top issue', 'Onboarding friction increasing across channels'],
    ['Next output', 'One action brief for every team']
];

const steps = [
    {
        title: 'Connect',
        copy: 'Sync the sources your customers already use.',
        icon: Layers
    },
    {
        title: 'Analyze',
        copy: 'Horizon groups patterns and ranks what matters.',
        icon: BarChart2
    },
    {
        title: 'Act',
        copy: 'Teams move from one shared priority list.',
        icon: Workflow
    }
];

const teamCards = [
    ['Product', 'Prioritize roadmap work that improves adoption and retention.'],
    ['Support', 'Catch repeating pain before it becomes ticket volume.'],
    ['Growth', 'Trigger rescue and lifecycle action from real signals.'],
    ['Leadership', 'Get one clean view of customer truth across the business.']
];

const bars = [24, 36, 48, 44, 61, 74, 66, 84];

const Home = () => {
    const navigate = useNavigate();
    const { openHorizonPreviewNotice } = useHorizonPreviewNotice();
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

            <section className="relative px-6 pt-20 md:pt-24">
                <div className="mx-auto max-w-[1520px]">
                    <div className="grid items-center gap-12 xl:grid-cols-[0.82fr_1.18fr]">
                        <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.65 }}
                            className="w-full max-w-[760px]"
                        >
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                                <Sparkles size={14} />
                                AI Feedback Intelligence Platform
                            </div>

                            <h1 className="mt-8 text-5xl font-semibold leading-[0.95] tracking-tight text-slate-950 sm:text-6xl xl:text-[84px]">
                                Customer feedback, turned into action.
                            </h1>

                            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
                                Horizon unifies reviews, tickets, CRM notes, and survey feedback so your team can spot churn risk, prioritize issues, and act faster.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-4">
                                <button
                                    onClick={openHorizonPreviewNotice}
                                    className="group inline-flex items-center gap-2 rounded-full bg-slate-950 px-7 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800"
                                >
                                    Preview Horizon
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

                            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                Built for product, support, growth, and leadership teams
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
                                        <div className={`relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br ${activePreviewLogo.gradient} p-6 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.28)]`}>
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_42%)]" />
                                            <div className="absolute -top-8 right-1 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
                                            <div className="absolute -bottom-10 left-2 h-40 w-40 rounded-full bg-cyan-200/28 blur-3xl" />
                                            <div className="absolute inset-x-8 bottom-8 h-24 rounded-full bg-white/32 blur-3xl" />

                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={activePreviewLogo.name}
                                                    initial={{ opacity: 0, scale: 0.92, y: 12 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.96, y: -12 }}
                                                    transition={{ duration: 0.22, ease: 'easeOut' }}
                                                    className="relative z-10 flex flex-col items-center gap-5 text-center"
                                                >
                                                    <div className="flex h-[230px] w-[230px] items-center justify-center rounded-[36px] border border-white/60 bg-white/88 p-6 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.3)] backdrop-blur">
                                                        <PreviewLogoArtwork logo={activePreviewLogo} />
                                                    </div>

                                                    <div className="rounded-full border border-white/60 bg-white/88 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                                                        {activePreviewLogo.name}
                                                    </div>
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid gap-3">
                                            {summaryCards.map(([label, value]) => (
                                                <div key={label} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                                                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">{value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Risk trend</p>
                                                <BarChart2 size={18} className="text-cyan-600" />
                                            </div>

                                            <div className="mt-5 flex h-32 items-end gap-2">
                                                {bars.map((height, index) => (
                                                    <motion.div
                                                        key={index}
                                                        className="flex-1 rounded-t-2xl bg-gradient-to-t from-cyan-500 via-sky-400 to-emerald-300"
                                                        initial={{ height: 12 }}
                                                        animate={{ height: `${height}%` }}
                                                        transition={{ duration: 0.6, delay: index * 0.05 }}
                                                    />
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

            <section className="relative mt-12 px-6">
                <div className="mx-auto max-w-[1520px] rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_24px_60px_-46px_rgba(15,23,42,0.25)]">
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

            <section className="relative mt-16 px-6">
                <div className="mx-auto max-w-[1520px]">
                    <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                        <div className="w-full max-w-[760px]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">What Horizon does</p>
                            <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                                Unify feedback. Find risk. Drive action.
                            </h2>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 lg:ml-auto lg:max-w-[620px]">
                            <p className="text-sm leading-relaxed text-slate-600">
                                Horizon replaces scattered feedback tools and manual synthesis with one clean operating layer for the whole company.
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

            <section id="how-it-works" className="relative mt-16 px-6 scroll-mt-32">
                <div className="mx-auto grid max-w-[1520px] gap-4 lg:grid-cols-[1.06fr_0.94fr]">
                    <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_-48px_rgba(15,23,42,0.24)] md:p-8">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">How it works</p>
                        <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                            From scattered feedback to one action plan.
                        </h2>

                        <div className="mt-8 space-y-4">
                            {[
                                'Collect feedback from every customer touchpoint',
                                'See the issues affecting churn, experience, and adoption',
                                'Give each team one clear list of next actions'
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                                    <span className="text-sm leading-relaxed text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-wrap gap-4">
                            <button
                                onClick={openHorizonPreviewNotice}
                                className="group inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800"
                            >
                                Explore the product
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

            <section className="relative mt-16 px-6">
                <div className="mx-auto max-w-[1520px] rounded-[34px] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_-48px_rgba(15,23,42,0.24)] md:p-8">
                    <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                        <div className="w-full max-w-[760px]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Built for teams that act</p>
                            <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
                                Product, support, growth, and leadership stay aligned.
                            </h2>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 lg:ml-auto lg:max-w-[620px]">
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

            <Contact />
        </div>
    );
};

export default Home;
