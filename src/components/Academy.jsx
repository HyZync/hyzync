import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
    Check,
    ArrowRight,
    ArrowUp,
    Users,
    TrendingUp,
    Zap,
    MessageCircle,
    Shield,
    Target,
    BarChart2,
    PieChart,
    Layers,
    ChevronDown,
    Activity,
    Sparkles,
    Quote
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Academy = () => {
    const navigate = useNavigate();
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
    const heroY = useTransform(scrollYProgress, [0, 1], [0, 50]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-purple-500/30 selection:text-white overflow-x-hidden">

            {/* --- HERO: VISUAL EFFECTS UPGRADE --- */}
            <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
                {/* Ambient Deep Space Background */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-50">
                    <div className="absolute top-[20%] left-[20%] w-[600px] h-[600px] bg-purple-600/20 blur-[130px] rounded-full animate-pulse-slow"></div>
                    <div className="absolute bottom-[20%] right-[15%] w-[500px] h-[500px] bg-blue-600/15 blur-[100px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                </div>

                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-10 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:border-white/20 transition-colors cursor-default">
                            <Sparkles size={14} className="text-purple-400" />
                            <span className="text-sm font-light tracking-wide text-slate-300">Hyzync Knowledge Hub</span>
                        </div>

                        <h1 className="text-6xl md:text-9xl font-light tracking-tighter text-white mb-10 leading-[1]">
                            The math of <br />
                            {/* Shimmer Effect Text */}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-purple-300 font-medium bg-[length:200%_auto] animate-text-shimmer">
                                retention.
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light mb-14 tracking-wide">
                            Acquiring a new customer costs <span className="text-white font-medium">5x more</span> than keeping an existing one. <br />
                            We help you fix the leaky bucket.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <button
                                onClick={() => document.getElementById('comparison').scrollIntoView({ behavior: 'smooth' })}
                                className="px-10 py-5 bg-white text-black text-lg font-medium rounded-full hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center gap-2 group relative overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    See the Data <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            </button>
                            <button
                                onClick={() => document.getElementById('reality-check').scrollIntoView({ behavior: 'smooth' })}
                                className="px-10 py-5 text-white border border-white/10 bg-white/5 backdrop-blur-md text-lg font-light rounded-full hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                Take the Quiz
                            </button>
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    style={{ opacity }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 text-slate-500 animate-bounce"
                >
                    <ChevronDown size={24} />
                </motion.div>
            </section>

            {/* --- COMPARISON SECTION (Visual Effects Added) --- */}
            <section id="comparison" className="py-20 text-white relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0f0f16] to-[#0a0a0f] opacity-80 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="text-center mb-24 px-6 max-w-4xl mx-auto">
                        <h2 className="text-4xl md:text-7xl font-extralight text-white mb-8 tracking-tighter">Why Retention Wins</h2>
                        <p className="text-xl text-slate-400 font-light leading-relaxed">
                            The difference between <span className="text-slate-500 line-through decoration-slate-600">linear growth</span> and <span className="text-white font-medium border-b border-purple-500/50 pb-1">exponential profit</span> is simply keeping who you acquire.
                        </p>
                    </div>

                    {/* SPLIT LAYOUT CONTAINER */}
                    <ComparisonGrid>
                        {/* LEFT: Acquisition (Faded / Ghost / Gritty) */}
                        <div className="p-12 lg:p-24 flex flex-col justify-center border-r border-white/5 relative overflow-hidden transition-colors hover:bg-white/[0.005] group/left">
                            {/* Gritty Texture */}
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

                            {/* Cursor Glow (Red/Trap) */}
                            <div
                                className="pointer-events-none absolute -inset-px opacity-0 group-hover/left:opacity-100 transition duration-500"
                                style={{
                                    background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(127, 29, 29, 0.1), transparent 40%)`
                                }}
                            />

                            <div className="relative z-10 opacity-60 group-hover/split:opacity-40 transition-opacity duration-700">
                                <div className="text-red-900/60 font-mono uppercase tracking-[0.4em] text-xs mb-6 pl-1 border-l-2 border-red-900/20">Old Model</div>
                                <h3 className="text-5xl md:text-6xl font-thin text-slate-500 mb-2 tracking-tighter">Acquisition Focus</h3>
                                <p className="text-red-900/50 font-medium tracking-widest text-sm uppercase">Diminishing Returns</p>
                            </div>

                            <div className="space-y-16 mt-16 relative z-10 opacity-60 group-hover/split:opacity-40 transition-opacity duration-700">
                                <div>
                                    <div className="text-slate-700 text-xs uppercase tracking-[0.2em] mb-3 font-bold">Cost to Acquire</div>
                                    <div className="text-7xl font-thin text-slate-600 tabular-nums relative inline-block tracking-tighter">
                                        $100
                                        <span className="text-[10px] font-bold text-red-900/40 absolute -top-3 -right-6 border border-red-900/20 px-1.5 py-0.5 rounded uppercase tracking-widest">High</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-700 text-xs uppercase tracking-[0.2em] mb-3 font-bold">Success Rate</div>
                                    <div className="text-7xl font-thin text-slate-600 tabular-nums tracking-tighter">15%</div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Retention (Vibrant / Active / Clean) */}
                        <div className="p-12 lg:p-24 flex flex-col justify-center relative bg-gradient-to-br from-purple-900/5 to-transparent overflow-hidden group/right">
                            {/* Glowing Threshold Line with Energy Pulse */}
                            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-purple-500/50 to-transparent shadow-[0_0_25px_rgba(168,85,247,0.8)] hidden lg:block overflow-hidden">
                                <motion.div
                                    className="w-full h-[50%] bg-gradient-to-b from-transparent via-purple-400 to-transparent blur-sm"
                                    animate={{ top: ['-100%', '200%'] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    style={{ position: 'absolute' }}
                                />
                            </div>

                            {/* Cursor Glow (Purple/Energy) */}
                            <div
                                className="pointer-events-none absolute -inset-px opacity-0 group-hover/right:opacity-100 transition duration-500"
                                style={{
                                    background: `radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(168, 85, 247, 0.15), transparent 40%)`
                                }}
                            />

                            {/* Background Glows (Static) */}
                            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none"></div>

                            <div className="relative z-10">
                                <div className="text-purple-400 font-mono uppercase tracking-[0.3em] text-xs mb-6 pl-1 border-l-2 border-purple-500 flex items-center gap-3">
                                    Hyzync Protocol
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_10px_rgba(168,85,247,1)]"></span>
                                </div>
                                <h3 className="text-5xl md:text-6xl font-light text-white mb-2 tracking-tighter shadow-black drop-shadow-md">Retention Focus</h3>
                                <p className="text-emerald-400 font-medium tracking-widest text-sm uppercase drop-shadow-lg shadow-emerald-500/20">Exponential Growth</p>
                            </div>

                            <div className="space-y-16 mt-16 relative z-10">
                                <div>
                                    <div className="text-purple-300/60 text-xs uppercase tracking-[0.2em] mb-3 font-bold flex items-center gap-4">
                                        Cost to Retain
                                    </div>
                                    <div className="flex items-baseline gap-6">
                                        <div className="text-8xl md:text-9xl font-medium text-white tabular-nums tracking-tighter drop-shadow-2xl relative z-10">
                                            $20
                                        </div>
                                        {/* Massive 5x Efficiency Badge */}
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: 0.5, duration: 0.8 }}
                                            className="flex flex-col items-start"
                                        >
                                            <span className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 italic tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                                                5x
                                            </span>
                                            <span className="text-emerald-500/80 text-xs font-mono tracking-widest uppercase">More Efficient</span>
                                        </motion.div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-purple-300/60 text-xs uppercase tracking-[0.2em] mb-3 font-bold flex items-center gap-4">
                                        Profit Impact
                                        <span className="text-purple-400 text-[9px] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded tracking-wide">MAXIMIZE LTV</span>
                                    </div>
                                    <div className="text-8xl md:text-9xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-300 to-white tabular-nums tracking-tighter drop-shadow-lg animate-pulse-slow">
                                        +95%
                                    </div>
                                </div>
                            </div>
                        </div>

                    </ComparisonGrid>
                </div>
            </section>

            {/* --- PLAYBOOK SECTION (Spotlight Cards with Insights Sidebar) --- */}
            <section className="py-40 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">

                        {/* LEFT: Rules Grid */}
                        <div className="flex-1">
                            <div className="mb-20 px-4">
                                <h2 className="text-4xl md:text-7xl font-extralight text-white mb-8 tracking-tighter">How to Stop Churn</h2>
                                <p className="text-xl text-slate-400 max-w-xl font-light leading-relaxed">
                                    Five simple rules to turn "users" into "loyalists".
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SpotlightCard
                                    icon={Zap}
                                    title="1. Speed to Value"
                                    desc="Don't make them wait. Deliver the first 'Aha!' moment in under 5 minutes."
                                />
                                <SpotlightCard
                                    icon={Activity}
                                    title="2. Catch the Drift"
                                    desc="Users fade before they quit. Monitor login drops to predict churn early."
                                />
                                <SpotlightCard
                                    icon={MessageCircle}
                                    title="3. Close the Loop"
                                    desc="Reply to feedback fast. Even a 'No' is better than silence."
                                />
                                <SpotlightCard
                                    icon={Target}
                                    title="4. Exit Interviews"
                                    desc="Find out why they left. Was it price? Product? Support? Ask them."
                                />
                                <SpotlightCard
                                    icon={Shield}
                                    title="5. Assign Ownership"
                                    desc="Make one person responsible for the Retention number. Give them power."
                                />

                                {/* Call to Action Card */}
                                <div
                                    className="bg-white text-black p-8 rounded-[2rem] flex flex-col justify-between group cursor-pointer hover:scale-[1.02] transition-all shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative overflow-hidden"
                                    onClick={() => navigate('/#contact')}
                                >
                                    <div className="relative z-10">
                                        <h3 className="text-2xl font-light tracking-tight mb-4">Need Help?</h3>
                                        <p className="text-slate-600 font-light leading-relaxed text-base">Get a full Hyzync audit of your retention strategy.</p>
                                    </div>
                                    <div className="flex items-center gap-3 font-medium mt-10 relative z-10">
                                        Book Audit <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Insights Sidebar */}
                        <div className="lg:w-80 flex-shrink-0">
                            <div className="sticky top-32 space-y-8">
                                <div className="inline-block px-3 py-1 rounded-sm bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-mono uppercase tracking-[0.2em]">
                                    Market Insights
                                </div>

                                <div className="group relative bg-white/[0.03] border border-white/5 p-8 rounded-3xl overflow-hidden hover:border-purple-500/30 transition-all duration-500">
                                    <Quote size={24} className="text-purple-500/30 mb-6" />
                                    <p className="text-lg md:text-xl font-light text-slate-300 leading-relaxed mb-8 tracking-tight">
                                        "the retained customers usually <span className="text-white font-normal underline decoration-purple-500/50 underline-offset-4">boosts the nps</span> improving the public sentiment about the product or service thereby attracting more customers in <span className="text-emerald-400 font-medium italic">less cac</span>."
                                    </p>

                                    <div className="pt-6 border-t border-white/5">
                                        <div className="flex items-center gap-3 mb-2">
                                            <BarChart2 size={16} className="text-purple-400" />
                                            <span className="text-xs font-medium text-white">Survey 2025 AI61</span>
                                        </div>
                                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest pl-7">Hyzync Research</div>
                                    </div>

                                    {/* Subtle pulse background */}
                                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full group-hover:bg-purple-500/10 transition-all duration-700"></div>
                                </div>

                                <div className="p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <TrendingUp size={14} className="text-emerald-400" />
                                        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Growth Driver</span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed italic">
                                        Retained cohorts generate 2.4x more organic referrals than new acquisitions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- REALITY CHECK (Futuristic Quiz) --- */}
            <section id="reality-check" className="py-40 px-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute bottom-[-20%] right-[-10%] w-[1000px] h-[1000px] bg-purple-900/10 blur-[200px] rounded-full pointer-events-none"></div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono uppercase tracking-widest mb-10">
                        Interactive Assessment
                    </div>
                    <h2 className="text-4xl md:text-7xl font-extralight text-white mb-8 tracking-tighter">Where Do You Stand?</h2>
                    <p className="text-xl text-slate-400 mb-20 font-light tracking-wide">
                        Check the boxes below that are TRUE for your company.
                    </p>

                    <RealityCheckInterface />
                </div>
            </section>

            {/* --- FOOTER CTA --- */}
            <section className="py-40 text-center px-6 border-t border-white/5 bg-[#0a0a0f]">
                <h2 className="text-5xl md:text-9xl font-extralight text-white mb-16 tracking-tighter">
                    Engineer Loyalty.
                </h2>
                <button
                    onClick={() => navigate('/#contact')}
                    className="px-14 py-7 bg-white text-black text-xl font-medium rounded-full hover:scale-105 transition-all shadow-[0_0_80px_rgba(255,255,255,0.2)]"
                >
                    Get Started with Hyzync
                </button>
            </section>
        </div>
    );
};

// --- SUB-COMPONENTS ---

// New Spotlight Card Component
const SpotlightCard = ({ icon: Icon, title, desc }) => {
    const divRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e) => {
        if (!divRef.current) return;

        const div = divRef.current;
        const rect = div.getBoundingClientRect();

        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleFocus = () => {
        setIsFocused(true);
        setOpacity(1);
    };

    const handleBlur = () => {
        setIsFocused(false);
        setOpacity(0);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleFocus}
            onMouseLeave={handleBlur}
            className="relative bg-white/[0.02] border border-white/5 p-10 rounded-[2rem] overflow-hidden group transition-all duration-500 cursor-default hover:shadow-[0_10px_50px_rgba(0,0,0,0.5)]"
        >
            {/* Spotlight Gradient */}
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.06), transparent 40%)`
                }}
            />
            {/* Border Glow Gradient */}
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(168,85,247,0.15), transparent 40%)`,
                    zIndex: -1
                }}
            />

            <div className="relative z-10">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-8 text-white group-hover:scale-110 transition-transform duration-500 border border-white/5 group-hover:border-purple-500/30 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                    <Icon size={26} className="text-slate-300 group-hover:text-purple-400 transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-light text-white mb-4 tracking-tight">{title}</h3>
                <p className="text-slate-400 leading-relaxed font-light text-lg">{desc}</p>
            </div>
        </div>
    );
};

const RealityCheckInterface = () => {
    const [items] = useState([
        { id: 1, label: "We know exactly why users leave." },
        { id: 2, label: "Users see value in their first session." },
        { id: 3, label: "We get alerts when usage drops." },
        { id: 4, label: "We reply to customer feedback in < 24h." },
        { id: 5, label: "Someone has a bonus tied to Retention." },
        { id: 6, label: "We review Churn metrics weekly." }
    ]);

    const [checkedState, setCheckedState] = useState(new Array(6).fill(false));

    const handleToggle = (index) => {
        const next = [...checkedState];
        next[index] = !next[index];
        setCheckedState(next);
    };

    const score = checkedState.filter(Boolean).length;

    // Statuses
    let status = { label: "Danger Zone", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    if (score >= 3) status = { label: "Getting There", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
    if (score >= 5) status = { label: "World Class", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };

    return (
        <div className="bg-white/[0.02] backdrop-blur-xl rounded-[3rem] p-8 md:p-16 border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left relative z-10">
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        onClick={() => handleToggle(idx)}
                        className={`p-6 rounded-2xl cursor-pointer transition-all duration-300 border flex items-center gap-5 group ${checkedState[idx] ? 'bg-purple-600/20 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)] transform scale-[1.01]' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                    >
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${checkedState[idx] ? 'bg-purple-500 border-purple-500 scale-100' : 'border-white/20 group-hover:border-white/40'}`}>
                            {checkedState[idx] && <Check size={16} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={`text-lg font-light transition-colors duration-300 ${checkedState[idx] ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{item.label}</span>
                    </div>
                ))}
            </div>

            <div className="mt-20 flex flex-col items-center relative z-10 border-t border-white/5 pt-12">
                <div className="text-xs font-mono uppercase tracking-[0.3em] text-slate-500 mb-6 transition-colors duration-500">Diagnostic Score</div>
                <div className="relative mb-8">
                    <div className="text-9xl font-extralight text-white tracking-tighter transition-all duration-500 ease-out transform">
                        {score}
                    </div>
                    <span className="absolute top-4 -right-12 text-4xl text-slate-700 font-thin">/6</span>
                </div>

                <div className={`px-10 py-4 rounded-full font-medium border backdrop-blur-md ${status.color} ${status.bg} tracking-widest uppercase text-sm shadow-[0_0_30px_rgba(0,0,0,0.2)] transition-all duration-300`}>
                    {status.label}
                </div>
            </div>
        </div>
    );
};

const ComparisonGrid = ({ children }) => {
    const gridRef = useRef(null);

    const handleMouseMove = (e) => {
        if (!gridRef.current) return;
        const rect = gridRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        gridRef.current.style.setProperty('--mouse-x', `${x}px`);
        gridRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <div
            ref={gridRef}
            onMouseMove={handleMouseMove}
            className="grid grid-cols-1 lg:grid-cols-2 min-h-[700px] border-y border-white/5 bg-black/40 backdrop-blur-sm relative group/split"
        >
            {children}
        </div>
    );
};

export default Academy;
