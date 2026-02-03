import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users, DollarSign, Activity, Zap } from 'lucide-react';

const RetentionVisual = () => {
    const [scenario, setScenario] = useState('active'); // 'active' | 'passive'
    const [simulationDay, setSimulationDay] = useState(0);
    const containerRef = useRef(null);

    // Auto-play simulation
    useEffect(() => {
        const interval = setInterval(() => {
            setSimulationDay(prev => (prev >= 30 ? 0 : prev + 1));
        }, 200);
        return () => clearInterval(interval);
    }, []);

    return (
        <section className="py-16 md:py-24 px-4 md:px-6 overflow-hidden relative">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                {/* Text Content */}
                <div className="order-2 lg:order-1 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-xs font-bold mb-6">
                        <Activity size={12} />
                        REVENUE IMPACT SIMULATOR
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold mb-8">
                        The Compounding Effect of <span className="text-brand-green">Retention</span>
                    </h2>

                    <div className="space-y-6 text-lg text-secondary leading-relaxed mb-10">
                        <p>
                            Churn isn't just a percentage; it's a leak in your valuation. Just a <strong className="text-white">5% increase in retention</strong> can boost profits by <strong className="text-white">25-95%</strong>.
                        </p>
                        <p>
                            Horizon transforms reactive support into proactive revenue defense. Watch how intervening at the right moment changes the trajectory of a cohort.
                        </p>
                    </div>

                    {/* Scenario Toggles */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={() => setScenario('passive')}
                            className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-300 text-left ${scenario === 'passive' ? 'bg-brand-magenta/10 border-brand-magenta text-white' : 'bg-white/5 border-white/10 text-secondary hover:bg-white/10'}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${scenario === 'passive' ? 'bg-brand-magenta text-white' : 'bg-white/10 text-secondary'}`}>
                                <TrendingUp size={20} className="rotate-180" />
                            </div>
                            <div>
                                <div className="text-sm font-bold">Standard Churn</div>
                                <div className="text-xs opacity-70">No intervention</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setScenario('active')}
                            className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-300 text-left ${scenario === 'active' ? 'bg-brand-green/10 border-brand-green text-white' : 'bg-white/5 border-white/10 text-secondary hover:bg-white/10'}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${scenario === 'active' ? 'bg-brand-green text-black' : 'bg-white/10 text-secondary'}`}>
                                <Zap size={20} />
                            </div>
                            <div>
                                <div className="text-sm font-bold">Horizon Powered</div>
                                <div className="text-xs opacity-70">Proactive Defense</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* The "Delight" Visualization */}
                <div className="order-1 lg:order-2 relative" ref={containerRef}>
                    {/* Background Glow */}
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] blur-[100px] rounded-full transition-colors duration-700 ${scenario === 'active' ? 'bg-brand-green/20' : 'bg-brand-magenta/10'}`}></div>

                    <div className="relative bg-black/40 border border-white/10 rounded-3xl p-1 shadow-2xl backdrop-blur-md overflow-hidden ring-1 ring-white/5 group">

                        {/* Status Bar */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <span className="text-xs font-mono text-secondary flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${scenario === 'active' ? 'bg-brand-green animate-pulse' : 'bg-brand-magenta'}`}></span>
                                SIMULATION_RUNNING
                            </span>
                            <span className="text-xs font-mono text-secondary">
                                DAY: {simulationDay} / 30
                            </span>
                        </div>

                        {/* Chart Area */}
                        <div className="h-[350px] relative w-full overflow-hidden">
                            {/* Grid */}
                            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
                                {[...Array(16)].map((_, i) => (
                                    <div key={i} className="border-r border-b border-white/10"></div>
                                ))}
                            </div>

                            {/* Simulation Area */}
                            <div className="absolute inset-0 p-6 flex items-end">

                                {/* Dynamic Bars / Particles */}
                                <div className="w-full h-full flex items-end justify-between px-2">
                                    {[...Array(20)].map((_, i) => {
                                        // Calculate simulated heights based on scenario
                                        const x = i / 20;
                                        // Active: Logarithmic growth then plateau. Passive: Exponential decay.
                                        const activeHeight = 40 + (Math.log(i + 1) * 30);
                                        const passiveHeight = 100 - (Math.pow(i, 1.5) * 0.8);

                                        const targetHeight = scenario === 'active' ? activeHeight : Math.max(10, passiveHeight);

                                        // Add some "live" randomness
                                        const height = targetHeight + (Math.sin(simulationDay + i) * 5);

                                        return (
                                            <motion.div
                                                key={i}
                                                className={`w-2 rounded-t-full relative group/bar ${scenario === 'active' ? 'bg-brand-green' : 'bg-brand-magenta'}`}
                                                animate={{
                                                    height: `${height}%`,
                                                    opacity: i < (simulationDay / 30) * 20 ? 1 : 0.2 // Progressive reveal effect
                                                }}
                                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            >
                                                {/* Particle Emitter at top of bar */}
                                                <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-8 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none`}>
                                                    <div className={`absolute top-0 left-1/2 w-1 h-1 rounded-full ${scenario === 'active' ? 'bg-brand-green shadow-[0_0_10px_#10b981]' : 'bg-brand-magenta shadow-[0_0_10px_#c026d3]'}`}></div>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </div>

                                {/* Floating Stats Card - Changes with Scenario */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={scenario}
                                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                                        transition={{ duration: 0.4 }}
                                        className="absolute top-8 left-8 bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`p-2 rounded-lg ${scenario === 'active' ? 'bg-brand-green/20 text-brand-green' : 'bg-brand-magenta/20 text-brand-magenta'}`}>
                                                {scenario === 'active' ? <TrendingUp size={18} /> : <Activity size={18} />}
                                            </div>
                                            <div>
                                                <div className="text-xs text-secondary uppercase tracking-wider">Projected LTV</div>
                                                <div className="text-xl font-bold text-white flex items-end gap-1">
                                                    {scenario === 'active' ? '$12,450' : '$4,200'}
                                                    <span className={`text-xs mb-1 ${scenario === 'active' ? 'text-brand-green' : 'text-brand-magenta'}`}>
                                                        {scenario === 'active' ? '+196%' : '-32%'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </AnimatePresence>

                            </div>
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute -z-10 -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                </div>
            </div>
        </section>
    );
};

export default RetentionVisual;
