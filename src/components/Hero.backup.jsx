import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronRight, Database, AlertCircle, ShieldCheck, Brain, TrendingUp, Activity } from 'lucide-react';

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

const Hero = () => {
    return (
        <section className="relative min-h-screen flex flex-col justify-center px-6 pt-32 pb-20 overflow-hidden">

            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-purple/10 blur-[120px] rounded-full animate-pulse-slow"></div>
                <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] bg-brand-blue/10 blur-[100px] rounded-full animate-blob animation-delay-4000"></div>
            </div>

            <div className="max-w-screen-2xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center relative z-10">

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
                            Stop Churn
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
                        Strategic retention for <span className="text-white font-normal">Subscription, Retail, Insurance, & Hospitality</span>.
                        Powered by <span className="text-white font-normal">Horizon</span>, our internal engine for high-impact customer intelligence.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex flex-wrap items-center gap-4 mt-2"
                    >
                        <a href="#contact" className="group relative inline-flex items-center gap-2 px-8 py-4 bg-brand-purple text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] overflow-hidden">
                            <span className="relative z-10">Consult with an Expert</span>
                            <ChevronRight className="relative z-10 group-hover:translate-x-1 transition-transform" size={20} />

                            {/* Shine Effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent z-0" />
                        </a>

                        <a href="#how-it-works" className="px-8 py-4 rounded-full border border-white-10 text-white font-medium hover:bg-white-5 transition-colors">
                            Our Process
                        </a>
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
                </div>

                {/* Right Column: Visuals (Floating Cards) */}
                <div className="relative h-[600px] w-full hidden lg:block perspective-1000">
                    <div className="relative w-full h-full transform-style-3d">

                        {/* Central Hub (Orbit Center) */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full animate-spin-slow opacity-30"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border border-brand-purple/10 rounded-full animate-reverse-spin opacity-50"></div>

                        <FloatingCard
                            icon={Database}
                            text="Data Unified"
                            color="text-brand-magenta"
                            position="top-[12%] right-[45%]"
                            delay={0}
                        />
                        <FloatingCard
                            icon={Brain}
                            text="Pattern Found"
                            color="text-brand-blue"
                            position="top-[28%] right-[5%]"
                            delay={1}
                        />
                        <FloatingCard
                            icon={Activity}
                            text="Signals Active"
                            color="text-brand-orange"
                            position="top-[48%] right-[30%]"
                            delay={2}
                        />
                        <FloatingCard
                            icon={AlertCircle}
                            text="Churn Detected"
                            color="text-brand-cyan"
                            position="bottom-[25%] right-[0%]"
                            delay={3}
                        />
                        <FloatingCard
                            icon={ShieldCheck}
                            text="Customer Saved"
                            color="text-brand-green"
                            position="bottom-[15%] right-[55%]"
                            delay={1.5}
                        />
                        <FloatingCard
                            icon={TrendingUp}
                            text="ROI Projected"
                            color="text-brand-yellow"
                            position="bottom-[5%] right-[20%]"
                            delay={2.5}
                        />

                    </div>
                </div>
            </div>
        </section>
    );
};

// Helper for Floating Cards
const FloatingCard = ({ icon: Icon, text, color, position, delay }) => (
    <motion.div
        className={`absolute ${position} px-4 py-3 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl flex items-center gap-3 shadow-xl z-20 cursor-grab active:cursor-grabbing`}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
            opacity: 1,
            scale: 1,
            y: [0, -15, 0]
        }}
        transition={{
            opacity: { duration: 0.5, delay },
            scale: { duration: 0.5, delay },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: delay * 2 }
        }}
        whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.08)" }}
        drag
        dragConstraints={{ left: -50, right: 50, top: -50, bottom: 50 }}
        dragElastic={0.1}
        whileDrag={{ scale: 1.15, cursor: "grabbing" }}
    >
        <div className={`p-1.5 rounded-lg bg-white/5 ${color}`}>
            <Icon size={18} />
        </div>
        <span className="text-sm font-medium text-white/90">{text}</span>
    </motion.div>
);

export default Hero;
