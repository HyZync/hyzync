import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Cloud, Cpu, Zap, Gauge, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

// Speed lines animation component
const SpeedLines = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute h-[2px] bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent"
                style={{
                    top: `${15 + i * 12}%`,
                    left: '-100%',
                    width: `${60 + Math.random() * 40}%`,
                }}
                animate={{
                    left: ['−100%', '200%'],
                    opacity: [0, 0.4, 0]
                }}
                transition={{
                    duration: 1.5 + Math.random() * 1,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: "easeOut"
                }}
            />
        ))}
    </div>
);

// RPM Gauge component
const RPMGauge = () => (
    <div className="relative w-48 h-48">
        {/* Outer glow ring (restricted to arc shape via mask or just simplified) */}
        <motion.div
            className="absolute inset-0 rounded-full opacity-20"
            style={{
                background: 'radial-gradient(circle, rgba(0,210,190,0.2) 0%, transparent 60%)',
            }}
            animate={{ scale: [0.8, 1, 0.8], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Main gauge ring */}
        <svg className="w-full h-full" viewBox="0 0 100 100">
            <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A855F7" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
            </defs>

            {/* Background Track - 270 degree arc */}
            {/* Start 135deg (bottom-left), End 405deg (bottom-right) */}
            <path
                d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
                strokeLinecap="round"
            />

            {/* Animated Value Arc */}
            <motion.path
                d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0.1, 0.85, 0.1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
            >
                <Gauge size={40} className="text-white mb-2" strokeWidth={1.5} />
            </motion.div>
            <motion.div
                className="text-4xl font-black text-white tracking-tighter"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 0.5, repeat: Infinity }}
            >
                18,500
            </motion.div>
            <div className="text-[8px] tracking-[0.4em] text-[#06B6D4] uppercase font-bold mt-1">RPM</div>
        </div>

        {/* Peak indicator */}
        <motion.div
            className="absolute top-2 right-4 flex items-center gap-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.3, repeat: Infinity }}
        >
            <div className="w-2 h-2 rounded-full bg-[#06B6D4]" />
            <span className="text-[8px] text-[#06B6D4] font-bold tracking-wider">PEAK</span>
        </motion.div>
    </div>
);



const IQteaser = () => {
    return (
        <section className="py-20 px-6 relative overflow-hidden">


            {/* Speed lines background effect */}
            <SpeedLines />

            <div className="max-w-7xl mx-auto">
                <Link to="/iq" className="block group">
                    <motion.div
                        whileHover={{ scale: 1.01 }}
                        className="relative"
                    >
                        {/* Ferrari Accent Lines - Racing style */}
                        <motion.div
                            className="absolute -top-4 left-0 right-0 flex justify-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <motion.div
                                className="h-1 bg-gradient-to-r from-[#A855F7] via-[#3B82F6] to-[#06B6D4] rounded-full shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                                animate={{ width: ['3rem', '12rem', '3rem'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <motion.div
                                className="h-1 w-4 bg-[#E0E0E0] rounded-full shadow-[0_0_10px_rgba(224,224,224,0.6)]"
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                        </motion.div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-12">

                            {/* Left Column - Text */}
                            <div className="space-y-6">


                                {/* Title with glow */}
                                <motion.h2
                                    className="text-6xl md:text-8xl font-black italic tracking-tighter text-white uppercase leading-none"
                                    initial={{ opacity: 0, x: -30 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                >
                                    IQ <motion.span
                                        className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] via-[#3B82F6] to-[#06B6D4] inline-block"
                                        animate={{
                                            filter: ['drop-shadow(0 0 10px rgba(168,85,247,0.3))', 'drop-shadow(0 0 20px rgba(6,182,212,0.5))', 'drop-shadow(0 0 10px rgba(168,85,247,0.3))']
                                        }}
                                        transition={{ duration: 4, repeat: Infinity }}
                                    >CLOUD.</motion.span>
                                </motion.h2>

                                {/* Clear cloud service description */}
                                <p className="text-xl text-zinc-300 leading-relaxed max-w-lg font-light">
                                    High-performance GPU cloud for AI & ML workloads. <span className="text-[#3B82F6] font-medium">Zero compromise.</span>
                                </p>

                                {/* Stats with racing style */}
                                <div className="flex items-center gap-6 pt-4">
                                    <motion.div
                                        className="flex flex-col"
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        <span className="text-[9px] text-[#A855F7] uppercase tracking-[0.3em] font-bold mb-1 flex items-center gap-2">
                                            <Zap size={10} /> Network
                                        </span>
                                        <span className="text-3xl font-black text-white tracking-tighter">800 Gbps</span>
                                    </motion.div>
                                    <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#3B82F6] to-transparent"></div>
                                    <motion.div
                                        className="flex flex-col"
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        <span className="text-[9px] text-[#E0E0E0] uppercase tracking-[0.3em] font-bold mb-1 flex items-center gap-2">
                                            <Cpu size={10} /> Latency
                                        </span>
                                        <span className="text-3xl font-black text-white tracking-tighter">&lt; 1ms</span>
                                    </motion.div>
                                    <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                                    <motion.div
                                        className="flex flex-col"
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        <span className="text-[9px] text-white/50 uppercase tracking-[0.3em] font-bold mb-1 flex items-center gap-2">
                                            <Activity size={10} /> GPUs
                                        </span>
                                        <span className="text-3xl font-black text-white tracking-tighter">H100</span>
                                    </motion.div>
                                </div>

                                {/* GPU info */}
                                <p className="text-sm text-zinc-500 max-w-md tracking-wide">
                                    Instant deployment. Hourly billing. No contracts.
                                </p>

                                {/* CTA with racing arrow animation */}
                                <motion.div
                                    className="pt-4 inline-flex items-center gap-4"
                                    whileHover={{ x: 10 }}
                                >
                                    <span className="text-[#06B6D4] font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-3 group-hover:gap-6 transition-all">
                                        Join the Waitlist
                                        <motion.div
                                            animate={{ x: [0, 5, 0] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                        >
                                            <ChevronRight size={20} />
                                        </motion.div>
                                    </span>
                                </motion.div>
                            </div>

                            {/* Right Column - RPM Gauge */}
                            <div className="relative flex items-center justify-center min-h-[300px]">
                                <motion.div
                                    animate={{ y: [0, -5, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <RPMGauge />
                                </motion.div>
                            </div>
                        </div>

                        {/* Telemetry strip at bottom */}


                        {/* Bottom racing stripe */}
                        <motion.div
                            className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1"
                        >
                            <motion.div
                                className="h-0.5 w-16 bg-[#3B82F6]"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            <div className="h-0.5 w-4 bg-white/30" />
                            <div className="h-0.5 w-4 bg-white/30" />
                        </motion.div>
                    </motion.div>
                </Link>
            </div>
        </section>
    );
};

export default IQteaser;
