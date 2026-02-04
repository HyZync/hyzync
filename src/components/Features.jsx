import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, BarChart, Shield, Lock, Bell, ChevronRight, Brain, Activity, Network } from 'lucide-react';

const Features = () => {
    return (
        <section id="features" className="pt-0 pb-24 px-6 max-w-screen-2xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="inline-block py-2 px-4 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple font-light text-sm mb-6">
                    Our Expertise
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                    Comprehensive Retention <br />
                    <span className="text-gradient">Intelligence</span>
                </h2>
                <p className="text-xl text-secondary">
                    We combine human expertise with our proprietary Horizon engine to solve your most complex churn challenges.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-6 auto-rows-[300px] md:auto-rows-[300px]">
                {/* 1. Horizon Intelligence (Large, Hero) */}
                <BentoCard
                    className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-brand-purple/20 to-black"
                    title="Horizon Intelligence"
                    subtitle="Gen AI-enabled, context-aware VOC analytics."
                    icon={Brain}
                    color="text-brand-purple"
                >
                    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                        <Network size={200} className="text-brand-purple animate-pulse" strokeWidth={0.5} />
                    </div>
                </BentoCard>

                {/* 2. Quick Scan (Tall, Right) */}
                <BentoCard
                    className="md:col-span-1 md:row-span-2 bg-white-5"
                    title="Quick Scan"
                    subtitle="Instant pulse-checks on sentiment and risk."
                    icon={Zap}
                    color="text-brand-cyan"
                >
                    <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-around pb-8 px-4 opacity-50">
                        {[40, 70, 50, 90, 60].map((h, i) => (
                            <motion.div
                                key={i}
                                className="w-2 bg-brand-cyan rounded-t-full"
                                initial={{ height: 10 }}
                                whileInView={{ height: `${h}%` }}
                                transition={{ duration: 1, delay: i * 0.1, repeat: Infinity, repeatType: "reverse" }}
                            />
                        ))}
                    </div>
                </BentoCard>

                {/* 3. Advisory (Standard) */}
                <BentoCard
                    className="md:col-span-1 md:row-span-1 bg-white-5"
                    title="Context Intelligence"
                    subtitle="GenAI-powered semantic analysis for open-ended feedback."
                    icon={BarChart}
                    color="text-brand-magenta"
                />

                {/* 4. Retention Protocol (Wide-ish in middle row... wait, grid logic) */}
                {/* Row 1-2 cols 1-2 is Horizon. Row 1-2 col 3 is Quick Scan. Row 1 col 4 is... Advisory? */}
                {/* Let's fix grid placements */}
                {/* R1: [Horizon 2x2] [Quick Scan 1x2] [Advisory 1x1] */}
                {/* R2: ... ... [Retention 1x1] */}
                {/* R3: [Rapid 1x1] [Privacy 2x1] [Some filler?] */}

                {/* Better Grid: 3 Cols maybe? */}
                {/* R1: [Horizon 2x2] [Quick Scan 1x2] */}
                {/* R2: ... ... */}
                {/* This leaves a gap. 2+1=3 columns. */}

                <BentoCard
                    className="md:col-span-1 md:row-span-1 bg-white-5"
                    title="Retention Protocol"
                    subtitle="Automated intervention strategies."
                    icon={Shield}
                    color="text-brand-green"
                />

                {/* 5. Rapid Insight */}
                <BentoCard
                    className="md:col-span-2 md:row-span-1 bg-gradient-to-r from-brand-blue/10 to-transparent"
                    title="Rapid Insight"
                    subtitle="Deep analysis within hours, turning raw feedback into action."
                    icon={Bell}
                    color="text-brand-orange"
                />

                {/* 6. Privacy */}
                <BentoCard
                    className="md:col-span-2 md:row-span-1 bg-white-5"
                    title="Data Privacy & Security"
                    subtitle="Enterprise-grade security & confidentiality."
                    icon={Lock}
                    color="text-brand-blue"
                />
            </div>
        </section>
    );
};

const BentoCard = ({ className, title, subtitle, icon: Icon, color, children }) => {
    return (
        <motion.div
            whileHover={{ scale: 0.98, boxShadow: '0 0 35px rgba(139,92,246,0.4)' }}
            className={`group relative p-8 rounded-3xl border border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)] overflow-hidden flex flex-col justify-between hover:border-purple-400/50 transition-all cursor-crosshair backdrop-blur-sm ${className}`}
        >
            {/* Neon Glow Orbs */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/25 transition-all duration-500"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-purple/10 rounded-full blur-[40px] translate-y-1/2 -translate-x-1/2 group-hover:bg-brand-purple/25 transition-all duration-500"></div>

            {/* Background Content */}
            {children}

            {/* Content */}
            <div className="relative z-10 transition-transform duration-300 group-hover:-translate-y-2">
                <div className={`w-12 h-12 rounded-xl bg-white-5 border border-purple-500/20 flex items-center justify-center mb-4 ${color}`}>
                    <Icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-secondary text-sm leading-relaxed max-w-[90%]">
                    {subtitle}
                </p>
            </div>

            {/* Hover Action */}
            <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0 text-white">
                <ChevronRight />
            </div>
        </motion.div>
    );
}

export default Features;
