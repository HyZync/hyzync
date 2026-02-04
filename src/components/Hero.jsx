import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, DollarSign, TrendingUp, Users, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const CountUp = ({ end, duration = 2 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const increment = end / (duration * 60);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(start);
            }
        }, 1000 / 60);
        return () => clearInterval(timer);
    }, [end, duration]);

    return <span>{Number.isInteger(end) ? Math.ceil(count) : count.toFixed(1)}</span>;
};

// Space-Themed Compact Calculator - Transparent & Neon
const RetentionCalculator = () => {
    const [customers, setCustomers] = useState(5000);
    const [arpu, setArpu] = useState(50);
    const [retentionImprovement, setRetentionImprovement] = useState(10);

    // Calculate results
    const monthlyRevenue = customers * arpu;
    const annualRevenue = monthlyRevenue * 12;
    const additionalRevenue = (annualRevenue * retentionImprovement) / 100;

    const formatCurrency = (value) => {
        if (value >= 1000000) {
            return '$' + (value / 1000000).toFixed(1) + 'M';
        }
        if (value >= 1000) {
            return '$' + (value / 1000).toFixed(0) + 'k';
        }
        return '$' + value;
    };

    return (
        <div className="relative w-full max-w-md mx-auto">
            {/* Main Container */}
            <motion.div
                className="relative p-6 rounded-[2rem] border border-purple-500/20 shadow-[0_0_15px_rgba(139,92,246,0.15)] backdrop-blur-[2px]"
                style={{ background: 'rgba(0,0,0,0.1)' }} // Very transparent
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    boxShadow: ['0 0 15px rgba(139,92,246,0.15)', '0 0 25px rgba(139,92,246,0.3)', '0 0 15px rgba(139,92,246,0.15)']
                }}
                transition={{
                    scale: { type: "spring", duration: 0.8 },
                    boxShadow: { duration: 4, repeat: Infinity }
                }}
            >
                {/* Header */}
                <div className="text-center mb-8 relative">
                    <motion.div
                        className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-purple-400/30 mb-3 relative"
                        style={{ background: 'rgba(147, 51, 234, 0.1)' }}
                    >
                        <div className="absolute inset-0 rounded-full blur-md bg-purple-500/20 animate-pulse"></div>
                        <Sparkles className="w-5 h-5 text-purple-300 relative z-10" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-1 tracking-wide drop-shadow-md">ROI Engine</h3>
                    <p className="text-purple-200/80 text-xs uppercase tracking-widest font-medium">Calculate Retention Boost</p>
                </div>

                {/* Cosmic Sliders - Semi-transparent tracks */}
                <div className="space-y-6 mb-8">
                    {/* Customers Slider */}
                    <div className="group">
                        <div className="flex justify-between text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-1">
                            <span className="flex items-center gap-2 drop-shadow-sm"><Users className="w-3 h-3 text-cyan-400" /> Users</span>
                            <span className="text-cyan-300 font-mono drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{customers.toLocaleString()}</span>
                        </div>
                        <input
                            type="range"
                            min="100"
                            max="50000"
                            step="100"
                            value={customers}
                            onChange={(e) => setCustomers(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer overflow-hidden backdrop-blur-sm"
                            style={{
                                backgroundImage: `linear-gradient(to right, #22d3ee 0%, #0891b2 ${(customers - 100) / (50000 - 100) * 100}%, rgba(255,255,255,0.02) ${(customers - 100) / (50000 - 100) * 100}%, rgba(255,255,255,0.02) 100%)`
                            }}
                        />
                    </div>

                    {/* ARPU Slider */}
                    <div className="group">
                        <div className="flex justify-between text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-1">
                            <span className="flex items-center gap-2 drop-shadow-sm"><DollarSign className="w-3 h-3 text-violet-400" /> ARPU</span>
                            <span className="text-violet-300 font-mono drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]">${arpu}</span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="500"
                            step="5"
                            value={arpu}
                            onChange={(e) => setArpu(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer overflow-hidden backdrop-blur-sm"
                            style={{
                                backgroundImage: `linear-gradient(to right, #a78bfa 0%, #7c3aed ${(arpu - 5) / (500 - 5) * 100}%, rgba(255,255,255,0.02) ${(arpu - 5) / (500 - 5) * 100}%, rgba(255,255,255,0.02) 100%)`
                            }}
                        />
                    </div>

                    {/* Retention Slider */}
                    <div className="group">
                        <div className="flex justify-between text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-1">
                            <span className="flex items-center gap-2 drop-shadow-sm"><TrendingUp className="w-3 h-3 text-fuchsia-400" /> Retention Lift</span>
                            <span className="text-fuchsia-300 font-mono drop-shadow-[0_0_8px_rgba(232,121,249,0.5)]">+{retentionImprovement}%</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            step="1"
                            value={retentionImprovement}
                            onChange={(e) => setRetentionImprovement(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer overflow-hidden backdrop-blur-sm"
                            style={{
                                backgroundImage: `linear-gradient(to right, #e879f9 0%, #c026d3 ${(retentionImprovement - 1) / (50 - 1) * 100}%, rgba(255,255,255,0.02) ${(retentionImprovement - 1) / (50 - 1) * 100}%, rgba(255,255,255,0.02) 100%)`
                            }}
                        />
                    </div>
                </div>

                {/* Result Card - Transparent, Text Only */}
                <motion.div
                    className="p-5 text-center relative overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                >
                    {/* Subtle neon pulse inside card - kept for some effect? User said "let the text sit on background directly" so maybe remove this too or make it very subtle? I will keep the pulse but remove the box. */}
                    <motion.div
                        className="absolute inset-0 opacity-20 bg-gradient-to-tr from-purple-500/10 to-transparent"
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 4, repeat: Infinity }}
                    />

                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em] mb-1 relative z-10">Projected Annual Gain</p>
                    <motion.div
                        className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-white tracking-tight relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                        key={additionalRevenue}
                        initial={{ scale: 0.9, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        {formatCurrency(additionalRevenue)}
                    </motion.div>
                    <div className="mt-2 text-xs text-purple-200/90 relative z-10">
                        <span className="text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">+{formatCurrency(additionalRevenue / 12)}</span> / month recurring
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
};

const Hero = () => {
    const navigate = useNavigate();
    const handleNavClick = (path) => {
        navigate(path);
    };

    return (
        <section className="relative min-h-screen flex flex-col justify-center px-6 pt-32 pb-8 overflow-hidden">

            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-50">
                <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-brand-purple/20 blur-[100px] rounded-full"></div>
                <div className="absolute bottom-[20%] right-[15%] w-[350px] h-[350px] bg-brand-blue/15 blur-[90px] rounded-full"></div>
            </div>

            <div className="max-w-screen-2xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start relative z-10">

                {/* Left Column: Text Content */}
                <div className="flex flex-col gap-8 max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white-10 bg-white-5 w-fit"
                    >
                        <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse"></div>
                        <span className="text-xs font-medium text-secondary tracking-wide uppercase">Strategic Retention Intelligence</span>
                    </motion.div>

                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.05]">
                        <motion.span
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="block"
                        >
                            Stop AI Churn
                        </motion.span>
                        <motion.span
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="block"
                        >
                            Before It <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-brand-purple to-brand-blue animate-gradient-x">Happens</span>
                        </motion.span>
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="text-base md:text-lg text-secondary leading-relaxed max-w-xl font-light"
                    >
                        Strategic retention for <span className="text-white font-normal">Subscription, Retail, Insurance, & Hospitality Brands</span>.
                        Powered by <span className="text-white font-normal">Horizon</span>, our internal engine for high-impact customer intelligence.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex flex-wrap items-center gap-4 mt-2"
                    >
                        <button
                            onClick={() => handleNavClick('/#contact')}
                            className="group relative inline-flex items-center gap-2 px-8 py-4 bg-brand-purple text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] overflow-hidden cursor-pointer"
                        >
                            <span className="relative z-10">Consult with an Expert</span>
                            <ChevronRight className="relative z-10 group-hover:translate-x-1 transition-transform" size={20} />

                            {/* Shine Effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent z-0" />
                        </button>

                        <button
                            onClick={() => handleNavClick('/#how-it-works')}
                            className="px-8 py-4 rounded-full border border-white-10 text-white font-medium hover:bg-white-5 transition-colors cursor-pointer"
                        >
                            Our Process
                        </button>
                        <div className="w-full mt-2 text-center sm:text-left">
                            <span className="text-xs text-brand-purple/80 font-medium tracking-wide border border-brand-purple/20 px-2 py-1 rounded bg-brand-purple/5">Limited Offer: Ends March 31st</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.8 }}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-8 sm:gap-12 border-t border-white-10 py-8 sm:py-0 sm:border-t-0 mt-8"
                    >
                        <div className="flex flex-col items-center sm:items-start">
                            <span className="text-4xl font-bold text-white leading-none">
                                <CountUp end={100} />%
                            </span>
                            <span className="text-sm text-secondary mt-1">Feedback Coverage</span>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-white-10"></div>
                        <div className="flex flex-col items-center sm:items-start">
                            <span className="text-4xl font-bold text-white leading-none">
                                &lt; <CountUp end={24} />h
                            </span>
                            <span className="text-sm text-secondary mt-1">Insight Turnaround</span>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-white-10"></div>
                        <div className="flex flex-col items-center sm:items-start">
                            <span className="text-4xl font-bold text-white leading-none">
                                <CountUp end={360} />°
                            </span>
                            <span className="text-sm text-secondary mt-1">Risk Visibility</span>
                        </div>
                    </motion.div>

                    {/* Integrations & Industries Panel - Fixed Spacing & Visibility */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 1 }}
                        className="mt-12 pt-8 border-t border-white/5 w-full"
                    >
                        <div className="flex flex-col xl:flex-row items-start justify-between gap-40 w-full">
                            {/* Left Side: Integrations (Compact) */}
                            <div className="flex flex-col gap-6 items-start shrink-0">
                                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Seamlessly Integrates With</p>
                                <div className="flex items-center gap-x-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
                                    {['Zendesk', 'HubSpot', 'Salesforce', 'Intercom', 'Jira'].map((source) => (
                                        <span
                                            key={source}
                                            className="text-xl font-bold text-white font-display uppercase tracking-tight whitespace-nowrap hover:text-[#29B5E8] hover:drop-shadow-[0_0_10px_rgba(41,181,232,0.5)] transition-all duration-300 cursor-default"
                                        >
                                            {source}
                                        </span>
                                    ))}
                                    <span className="text-sm text-white/60 italic whitespace-nowrap">+ many more</span>
                                </div>
                            </div>

                            {/* Right Side: Industries (Matched Style & Alignment) */}
                            <div className="flex flex-col gap-6 items-start flex-1 w-full">
                                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Core Industries</p>
                                <div className="flex items-center justify-between gap-x-12 w-full opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
                                    {['Subscription', 'Retail', 'Insurance', 'Hospitality'].map((industry, i) => (
                                        <span
                                            key={i}
                                            className="text-xl font-bold text-white font-display uppercase tracking-tight whitespace-nowrap hover:text-[#29B5E8] hover:drop-shadow-[0_0_10px_rgba(41,181,232,0.5)] transition-all duration-300 cursor-default"
                                        >
                                            {industry}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Academy Quiz Redirect */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 1.2 }}
                        className="mt-8 pt-6 border-t border-white/5"
                    >
                        <p className="text-sm text-white/40 mb-4 uppercase tracking-widest font-medium">Recommended Diagnostics</p>
                        <button
                            onClick={() => navigate('/academy#reality-check')}
                            className="group flex items-center gap-3 text-white/70 hover:text-white transition-colors"
                        >
                            <span className="text-lg font-light tracking-wide border-b border-transparent group-hover:border-white/50 transition-all">Know where are you now on retention</span>
                            <ChevronRight size={16} className="text-brand-purple group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                </div>

                {/* Right Column: Retention Calculator */}
                <div className="relative w-full flex justify-center py-8 lg:py-0 lg:pt-[76px]">
                    <RetentionCalculator />
                </div>
            </div>

            <style jsx>{`
                /* Custom slider styles */
                input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
                }

                input[type="range"]::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
                }

                .slider-blue::-webkit-slider-thumb {
                    background: #60a5fa;
                }
                .slider-blue::-moz-range-thumb {
                    background: #60a5fa;
                }

                .slider-green::-webkit-slider-thumb {
                    background: #34d399;
                }
                .slider-green::-moz-range-thumb {
                    background: #34d399;
                }

                .slider-purple::-webkit-slider-thumb {
                    background: #a855f7;
                }
                .slider-purple::-moz-range-thumb {
                    background: #a855f7;
                }
            `}</style>
        </section >
    );
};

export default Hero;
