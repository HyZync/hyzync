import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database,
    Cpu,
    BarChart2,
    Globe,
    Search,
    Filter,
    Zap,
    Layers,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    Terminal,
    Code,
    Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import xcelLogo from '../assets/xcel.png';
import salesforceLogo from '../assets/sforce.png';
import appStoreLogo from '../assets/app.png';
import typeformLogo from '../assets/typeform.png';

const HorizonStandalone = () => {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);

    // Simulation steps
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % 4);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <section id="horizon" className="py-24 px-6 max-w-full mx-auto relative scroll-mt-32 overflow-hidden min-h-screen flex items-center justify-center flex-col">

            {/* Background Ambience */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[800px] h-[800px] bg-brand-cyan/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Horizontal Grid Lines Background */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '100% 40px' }}>
            </div>

            {/* Header - Centered */}
            <div className="relative z-10 text-center mb-16 w-full">
                <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-brand-cyan/5 border border-brand-cyan/20 text-brand-cyan font-mono text-[10px] mb-6 tracking-widest uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></span>
                    System: Horizon_v5.0
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-4 font-display tracking-tight text-white">
                    Unified <span className="text-brand-cyan">Intelligence</span> Command
                </h2>
                <p className="text-lg text-secondary max-w-4xl mx-auto leading-relaxed mt-4 opacity-80">
                    Advanced intelligence platform engineered for customer retention analysis and predictive insights.
                </p>
                <div className="flex items-center justify-center gap-6 mt-8 opacity-40">
                    <span className="text-[10px] font-mono text-secondary uppercase tracking-[0.2em] border border-white/10 px-3 py-1.5 rounded-sm backdrop-blur-sm">System: INTERNAL_ENGINE_V5.0</span>
                    <span className="text-[10px] font-mono text-secondary uppercase tracking-[0.2em] border border-white/10 px-3 py-1.5 rounded-sm backdrop-blur-sm">Security: AUTH_LEVEL_ROOT</span>
                </div>
            </div>

            <div className="w-full flex items-start justify-center gap-16 px-6 max-w-[1600px] mx-auto">

                {/* Main Command Center Panel */}
                <div className="flex-1 max-w-5xl relative z-10">
                    {/* HUD Corners */}
                    <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-brand-cyan/30 rounded-tl-lg hidden md:block"></div>
                    <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-brand-cyan/30 rounded-br-lg hidden md:block"></div>

                    <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl relative overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.05)]">

                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-4">
                                <div className="flex gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
                                </div>
                                <span className="text-[10px] font-mono text-white/40 ml-2 tracking-wider">/USR/BIN/HORIZON_CORE</span>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-secondary">
                                    <span>CPU: <span className="text-white">12%</span></span>
                                    <span>MEM: <span className="text-white">4.2GB</span></span>
                                    <span>LATENCY: <span className="text-brand-cyan">24ms</span></span>
                                </div>
                                <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></span>
                                    <span className="text-[10px] font-mono text-brand-cyan font-bold">ONLINE</span>
                                </span>
                            </div>
                        </div>

                        {/* Dashboard Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px] divide-y lg:divide-y-0 lg:divide-x divide-white/5 relative">

                            {/* Animated Connector Lines (SVG Overlay) */}
                            <div className="absolute inset-0 pointer-events-none z-0 hidden lg:block">
                                <svg className="w-full h-full opacity-30">
                                    <path d="M 280 150 C 350 150, 350 250, 420 250" fill="none" stroke="url(#gradient-line)" strokeWidth="1" />
                                    <path d="M 280 250 C 350 250, 350 250, 420 250" fill="none" stroke="url(#gradient-line)" strokeWidth="1" />
                                    <path d="M 280 350 C 350 350, 350 250, 420 250" fill="none" stroke="url(#gradient-line)" strokeWidth="1" />

                                    <path d="M 750 250 C 820 250, 820 150, 890 150" fill="none" stroke="url(#gradient-line)" strokeWidth="1" />
                                    <path d="M 750 250 C 820 250, 820 350, 890 350" fill="none" stroke="url(#gradient-line)" strokeWidth="1" />

                                    <defs>
                                        <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="transparent" />
                                            <stop offset="50%" stopColor="#06b6d4" />
                                            <stop offset="100%" stopColor="transparent" />
                                        </linearGradient>
                                    </defs>
                                </svg>

                                <motion.div
                                    className="absolute w-2 h-2 bg-brand-cyan rounded-full blur-[2px]"
                                    animate={{ offsetDistance: "100%" }}
                                    style={{ offsetPath: "path('M 280 150 C 350 150, 350 250, 420 250')", offsetRotate: "0deg" }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                />
                            </div>

                            {/* COLUMN 1: INGEST */}
                            <div className="lg:col-span-3 p-6 bg-black/20 flex flex-col relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
                                        <Database size={14} className="text-brand-cyan" /> INPUT_SIGNAL_BUFFER
                                    </h3>
                                    <Activity size={12} className="text-secondary animate-pulse" />
                                </div>
                                <div className="space-y-4 flex-1">
                                    <SourceCard name="App Store Connect" status="Active" count="12k" delay={0} icon={appStoreLogo} isImage={true} />
                                    <SourceCard name="Google Play Console" status="Active" count="8.5k" delay={0.2} icon={'https://cdn.simpleicons.org/googleplay'} isImage={true} />
                                    <SourceCard name="Zendesk Support" status="Syncing" count="450" delay={0.4} icon={'https://cdn.simpleicons.org/zendesk'} isImage={true} />
                                </div>
                                <div className="mt-8 pt-6 border-t border-white/5">
                                    <div className="flex justify-between items-center text-[10px] font-mono text-secondary mb-3">
                                        <span>TOTAL_SIGNALS</span>
                                        <span className="text-brand-cyan">23,050</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden relative">
                                        <motion.div
                                            className="h-full bg-brand-cyan shadow-[0_0_10px_#06b6d4]"
                                            animate={{ width: ["0%", "100%"] }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* COLUMN 2: CORTEX CORE */}
                            <div className="lg:col-span-6 p-0 relative flex flex-col bg-black/40 z-10 border-x border-white/5">
                                <div className="absolute inset-0 opacity-10 pointer-events-none"
                                    style={{
                                        backgroundImage: `linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)`,
                                        backgroundSize: '40px 40px'
                                    }}>
                                </div>
                                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-sm">
                                    <h3 className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
                                        <Cpu size={14} className="text-brand-cyan" /> Cortex Processing
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[9px] font-mono text-brand-cyan/40 uppercase tracking-widest">Model: Elemental_Zeta</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(i => <span key={i} className={`w-1 h-3 bg-brand-cyan/${i * 20}`}></span>)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 p-8 relative overflow-hidden font-mono text-xs md:text-sm leading-8 min-h-[300px]">
                                    <div className="absolute inset-x-8 bottom-8 flex flex-col justify-end h-full mask-gradient-t space-y-2">
                                        <TerminalLine text="> Initializing sentiment analysis..." color="text-white/40" />
                                        <TerminalLine text="> Normalizing data structures..." color="text-white/40" />
                                        <TerminalLine text="> Detecting sarcasm patterns: 98% conf." color="text-white/60" />
                                        <TerminalLine text="> Clustering operational inefficiencies..." color="text-brand-purple" />
                                        <TerminalLine text="> Identifying churn risk signals..." color="text-red-400" />
                                        <TerminalLine text="> Synthesizing executive summary..." color="text-brand-cyan" active={true} />
                                    </div>
                                </div>
                                <motion.div
                                    className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-cyan to-transparent shadow-[0_0_20px_#06b6d4] z-20"
                                    animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                />
                            </div>

                            {/* COLUMN 3: INTELLIGENCE HUB */}
                            <div className="lg:col-span-3 p-6 bg-black/20 flex flex-col relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
                                        <BarChart2 size={14} className="text-brand-cyan" /> ANALYSIS_OUTPUT_STREAM
                                    </h3>
                                </div>
                                <div className="space-y-6 flex-1">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-[10px] font-mono text-secondary uppercase">Sentiment</span>
                                            <span className="text-2xl font-bold text-white font-mono">78.4</span>
                                        </div>
                                        <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 w-full relative">
                                                <motion.div
                                                    className="absolute top-0 bottom-0 w-1 bg-white"
                                                    initial={{ left: "0%" }}
                                                    animate={{ left: "78%" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <InsightCard label="PRIORITY_FLAG::PAIN" title="Exception: Login Loop" desc="45% mentions" icon={AlertCircle} iconColor="text-red-500" />
                                    <InsightCard label="PRIORITY_FLAG::GROWTH" title="Feat_Req: Auto_PDF" desc="High demand" icon={TrendingUp} iconColor="text-brand-green" />
                                </div>
                                <button
                                    onClick={() => navigate('/#contact')}
                                    className="w-full mt-8 py-3 rounded border border-brand-cyan/20 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan font-mono text-[10px] tracking-wider flex items-center justify-center gap-2 transition-all group"
                                >
                                    <Terminal size={14} /> EXPORT_DEBUG_LOGS
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Independent Neon Tubes (Refined from user sketch) */}
                <div className="w-auto hidden lg:flex items-center justify-center gap-8 h-[550px] z-20">

                    {/* Tube 1 */}
                    <div className="w-12 h-full rounded-2xl border-2 border-white/20 relative overflow-hidden backdrop-blur-sm shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                        <div className="absolute inset-0 bg-white/5 pointer-events-none z-10"></div>
                        <motion.div
                            className="absolute bottom-0 left-0 right-0 bg-brand-cyan shadow-[0_0_30px_#06b6d4] opacity-80"
                            animate={{ height: ["0%", "40%", "20%", "60%", "30%"] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        />
                        {/* Bubble Stream */}
                        <motion.div className="absolute bottom-0 left-1/2 w-1 h-1 bg-white rounded-full" animate={{ y: -500, opacity: [0, 1, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
                    </div>

                    {/* Tube 2 */}
                    <div className="w-12 h-full rounded-2xl border-2 border-white/20 relative overflow-hidden backdrop-blur-sm shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                        <div className="absolute inset-0 bg-white/5 pointer-events-none z-10"></div>
                        <motion.div
                            className="absolute bottom-0 left-0 right-0 bg-brand-cyan shadow-[0_0_30px_#06b6d4] opacity-80"
                            animate={{ height: ["30%", "70%", "50%", "90%", "40%"] }}
                            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        />
                        <motion.div className="absolute bottom-0 left-1/3 w-1.5 h-1.5 bg-white rounded-full" animate={{ y: -500, opacity: [0, 1, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} />
                    </div>

                    {/* Tube 3 */}
                    <div className="w-12 h-full rounded-2xl border-2 border-white/20 relative overflow-hidden backdrop-blur-sm shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                        <div className="absolute inset-0 bg-white/5 pointer-events-none z-10"></div>
                        <motion.div
                            className="absolute bottom-0 left-0 right-0 bg-brand-cyan shadow-[0_0_30px_#06b6d4] opacity-80"
                            animate={{ height: ["50%", "20%", "80%", "30%", "60%"] }}
                            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                        />
                        <motion.div className="absolute bottom-0 left-1/2 w-1 h-1 bg-white rounded-full" animate={{ y: -500, opacity: [0, 1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "linear", delay: 1 }} />
                    </div>

                    {/* Floating Label */}
                    <div className="absolute -right-16 bottom-16 -rotate-90 origin-bottom-left text-[9px] font-mono text-brand-cyan/50 tracking-[0.2em] whitespace-nowrap">
                        COOLANT_LEVEL // NOMINAL
                    </div>
                </div>
            </div>

        </section>
    );
};

// --- Sub-components ---

const SourceCard = ({ name, status, count, delay, icon: IconOrUrl, isImage }) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="flex items-center justify-between p-2.5 rounded bg-white/5 border border-white/5 hover:border-brand-cyan/30 transition-all group overflow-hidden relative"
    >
        <div className="flex items-center gap-3 z-10">
            <div className="w-6 h-6 rounded bg-black/40 flex items-center justify-center overflow-hidden">
                {isImage ? <img src={IconOrUrl} alt={name} className="w-4 h-4 object-contain grayscale group-hover:grayscale-0 transition-all" /> : <IconOrUrl size={14} />}
            </div>
            <div>
                <div className="text-xs font-medium text-white group-hover:text-brand-cyan transition-colors">{name}</div>
                <div className="text-[8px] font-mono text-secondary uppercase tracking-wider">{status}</div>
            </div>
        </div>
        <span className="text-[9px] font-mono text-white/40">{count}</span>
    </motion.div>
);

const TerminalLine = ({ text, color, active }) => (
    <div className={`flex items-center gap-2 py-0.5 ${color} ${active ? 'animate-pulse' : ''}`}>
        <span className="text-[10px] font-mono tracking-tight opacity-80">{text}</span>
        {active && <span className="w-1 h-2 bg-brand-cyan animate-pulse"></span>}
    </div>
);

const InsightCard = ({ label, title, desc, icon: Icon, iconColor }) => (
    <div className="p-3 rounded bg-white/5 border border-white/5 hover:border-white/20 transition-colors group">
        <div className="flex items-center gap-2 mb-1">
            <Icon size={12} className={iconColor} />
            <span className="text-[8px] font-mono uppercase text-secondary">{label}</span>
        </div>
        <h4 className="text-xs font-bold text-white group-hover:text-brand-cyan transition-colors">{title}</h4>
        <p className="text-[10px] text-secondary leading-tight mt-1">{desc}</p>
    </div>
);

export default HorizonStandalone;
